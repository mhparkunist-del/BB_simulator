"""Agent interfaces and the information boundary.

Design rule (non-negotiable): an agent receives ONLY what its real
counterpart could know.

    PitcherAgent   game context + own body/feel + noisy scouting -> PitchIntent
                   (+ catcher's sign)                             -> PitchCall
    CatcherAgent   game context + situation + umpire read + accurate scouting
                   + the pitcher's stated intent                  -> CatcherSign
    BatterAgent    game context + noisy ball sightings + release point seen -> SwingDecision

The batter never sees spin, pitch type, release speed, or the true
trajectory; it sees a short list of (time, noisy position) samples that end
at its commit deadline, plus where the ball was released (which it can
compare against its memory of this pitcher).
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

Vec3 = np.ndarray


# ---------------------------------------------------------------- public info
@dataclass
class GameContext:
    balls: int = 0
    strikes: int = 0
    outs: int = 0
    inning: int = 1
    batter_hand: str = "R"
    pitcher_hand: str = "R"
    runners: Tuple[bool, bool, bool] = (False, False, False)
    score_diff: int = 0                       # batting team minus fielding team
    previous_pitch_codes: List[str] = field(default_factory=list)
    previous_results: List[str] = field(default_factory=list)
    zone_top: float = 1.05
    zone_bottom: float = 0.50
    pitch_count: int = 0                      # this pitcher's pitches so far today
    pitcher_id: str = "P"
    batter_id: str = "B"
    runner_speed: float = 0.5                 # 0..1 steal threat of the runner on first
    umpire_low_shift: float = 0.0             # m, + = umpire gives the low strike (catcher's read)
    fielder_shift: str = "none"               # none | pull | opposite | bench calls: bunt take power (offense) inside outside infield_in outfield_deep (defense)

    @property
    def leverage(self) -> float:
        """0..1 crude leverage: late, close, runners."""
        late = min(1.0, self.inning / 9.0)
        close = 1.0 - min(1.0, abs(self.score_diff) / 4.0)
        run = 0.3 * sum(self.runners)
        return float(np.clip(0.4 * late + 0.4 * close + run, 0, 1))


@dataclass
class BatterTendencies:
    """Public scouting facts about a batter (rates 0..1)."""
    hand: str = "R"
    chase_low: float = 0.5
    chase_away: float = 0.5
    chase_in: float = 0.5
    whiff_breaking: float = 0.5
    whiff_high_ff: float = 0.5
    first_pitch_swing: float = 0.35
    power_zone: str = "middle"                # in | away | low | high | middle
    contact_vs_offspeed: float = 0.5


# ---------------------------------------------------------------- pitcher/catcher
@dataclass
class PitchIntent:
    code: str
    zone: str
    target_xz: Tuple[float, float]
    effort: float = 1.0
    score: float = 0.0
    reasons: List[str] = field(default_factory=list)
    ranked: List[Tuple[str, str, float]] = field(default_factory=list)   # (code, zone, score)


@dataclass
class CatcherSign:
    code: str
    target_xz: Tuple[float, float]
    zone: str = ""
    score: float = 0.0
    reasons: List[str] = field(default_factory=list)
    ranked: List[Tuple[str, str, float]] = field(default_factory=list)


@dataclass
class PitchCall:
    code: str
    target_xz: Tuple[float, float]
    effort: float = 1.0
    spin_scale: float = 1.0
    zone: str = ""
    reasons: List[str] = field(default_factory=list)
    pitcher_choice: str = ""
    catcher_choice: str = ""
    shake_offs: int = 0
    agreed: bool = True


# ---------------------------------------------------------------- batter
@dataclass
class BallSighting:
    t: float
    pos: Vec3


@dataclass
class BatterObservation:
    context: GameContext
    eye_pos: Vec3
    sightings: List[BallSighting]
    t_deadline: float
    contact_y: float
    release_seen: Optional[Vec3] = None      # noisy release point (visible to the batter)


@dataclass
class ExecutionProfile:
    timing_sigma: float = 0.008
    vertical_sigma: float = 0.015
    horizontal_sigma: float = 0.025


@dataclass
class SwingDecision:
    swing: bool
    t_contact: float = 0.0
    x_bat: float = 0.0
    z_bat: float = 0.0
    spray_plan_deg: float = 0.0
    attack_angle_deg: float = 8.0
    bat_speed: float = 31.0
    execution: ExecutionProfile = field(default_factory=ExecutionProfile)
    predicted_xz: Tuple[float, float] = (0.0, 0.0)
    note: str = ""
    tipped: bool = False
    adjusted: bool = False                   # late correction applied after commit
    checked: bool = False                    # check swing (bat held back)
    late_shift: Tuple[float, float] = (0.0, 0.0)
    pressure: float = 0.0


# ---------------------------------------------------------------- interfaces
class PitcherAgent(ABC):
    hand: str = "R"
    name: str = "P"
    repertoire_codes: Tuple[str, ...] = ("FF",)

    @abstractmethod
    def intent(self, ctx: GameContext, rng: np.random.Generator) -> PitchIntent:
        """What the pitcher wants to throw, from its own information only."""

    @abstractmethod
    def decide(self, ctx: GameContext, sign: Optional[CatcherSign],
               rng: np.random.Generator) -> PitchCall: ...

    @abstractmethod
    def command_sigma(self, code: str) -> float: ...

    def scout(self, tendencies: BatterTendencies, rng: np.random.Generator) -> None:
        """Receive (and privately blur) the scouting report on the batter."""

    def begin_game(self, rng: np.random.Generator) -> None: ...

    def note_pitch(self, code: str, result: str) -> None: ...


class CatcherAgent(ABC):
    @abstractmethod
    def sign(self, ctx: GameContext, repertoire_codes: Tuple[str, ...],
             rng: np.random.Generator, pitcher_intent: Optional[PitchIntent] = None,
             exclude: Tuple[str, ...] = ()) -> CatcherSign: ...

    def scout(self, tendencies: BatterTendencies, rng: np.random.Generator, batter_id: str = "B") -> None: ...

    def learn_pitcher(self, pitcher) -> None: ...

    def note_pitch(self, code: str, result: str) -> None: ...

    def observe_swing(self, ctx: GameContext, code: str, plate_xz, swung: bool, result: str, quality: float) -> None: ...

    def framing(self) -> float:
        return 0.5

    def blocking(self) -> float:
        return 0.5

    def rapport(self) -> float:
        return 0.5


class BatterAgent(ABC):
    hand: str = "R"
    height: float = 1.85
    reaction_time: float = 0.15
    name: str = "B"

    @abstractmethod
    def decide(self, obs: BatterObservation, rng: np.random.Generator) -> SwingDecision: ...

    def tendencies(self) -> BatterTendencies:
        return BatterTendencies(hand=self.hand)

    def learn(self, obs_full: "BatterObservation") -> None:
        """After the pitch: the batter watched the whole flight (still only noisy sightings)."""

    def eye_sigma_factor(self) -> float:
        return 1.0

    def late_blur(self, frac: float) -> float:
        """Noise multiplier along the flight (1 = clean); default: no blur."""
        return 1.0

    def bat_spec(self):
        return None                              # engine default BatSpec

    def note_result(self, result: str, quality: float = 0.0) -> None: ...

    def begin_game(self) -> None: ...

    def late_window(self) -> float:
        """Seconds before contact until which sightings are delivered (default: commit deadline)."""
        return self.reaction_time

    def eye_position(self, contact_y: float) -> Vec3:
        side = -1.0 if self.hand.upper().startswith("R") else 1.0
        return np.array([side * 0.75, contact_y - 0.30, 0.90 * self.height])
