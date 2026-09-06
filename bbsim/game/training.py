"""Training catalog: the nine trainable axes (docs/PLAYER_ATTRIBUTES.md §2)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List


@dataclass(frozen=True)
class TrainingAxis:
    key: str
    name: str
    domain: str                       # coach role that teaches it best
    primary: Dict[str, float]         # skill -> weight of the gain
    load: float                       # load units per session
    injury_factor: float = 0.0        # extra injury risk per session at high fatigue
    side_effect: Dict[str, float] = field(default_factory=dict)   # skill -> per-session drift


CATALOG: Dict[str, TrainingAxis] = {a.key: a for a in [
    TrainingAxis("legs", "하체 파워", "conditioning", {"leg_power": 1.0, "bat_speed": 0.5, "power": 0.4}, 2.0, 0.02),
    # --- batter axes (docs/PLAYER_ATTRIBUTES.md §9) ---
    TrainingAxis("tee_barrel", "티·배럴 위치 드릴", "batting", {"barrel_placement": 1.0, "barrel_accuracy": 0.6}, 1.0),
    TrainingAxis("timing_bp", "타이밍 배팅(변속 머신)", "batting", {"timing": 1.0, "swing_quickness": 0.3}, 1.5),
    TrainingAxis("tracking_drill", "트래킹·구종 인식 드릴", "batting", {"tracking": 1.0, "guess_hitting": 0.3}, 1.0),
    TrainingAxis("path_work", "스윙 궤도·스프레이", "batting", {"path_control": 1.0, "spray_control": 0.6}, 1.0),
    TrainingAxis("zone_disc", "선구안·존 훈련", "batting", {"discipline": 1.0, "boldness": 0.2}, 1.0),
    TrainingAxis("bat_strength", "배트 스피드·힘", "conditioning", {"bat_speed": 1.0, "power": 0.7}, 2.0, 0.015),
    TrainingAxis("situational", "상황 타격·번트", "batting", {"bunt_skill": 1.0, "game_sense": 0.4}, 0.5),
    TrainingAxis("reaction_drill", "반응·순발력 드릴", "conditioning", {"reaction": 1.0, "swing_quickness": 0.4}, 1.0),
    TrainingAxis("pressure_sim", "부담 상황 시뮬레이션", "mental", {"composure": 1.0, "focus": 0.4}, 0.5),
    TrainingAxis("core", "코어·회전력", "conditioning", {"core_rotation": 1.0, "repeatability": 0.3}, 1.5),
    TrainingAxis("shoulder_rom", "어깨 외회전 가동범위", "medical", {}, 1.0, 0.03),
    TrainingAxis("wrist", "손목·전완", "pitching", {"wrist_speed": 1.0}, 1.0),
    TrainingAxis("grip", "악력·손가락", "pitching", {"grip_force": 1.0}, 0.8),
    TrainingAxis("repeat", "딜리버리 반복", "pitching", {"repeatability": 1.0}, 1.5),
    TrainingAxis("grips", "그립·실밥 숙련", "pitching", {"grip_skill": 1.0}, 0.8),
    TrainingAxis("endurance", "체력·회복", "conditioning", {"stamina": 1.0}, 2.0),
    TrainingAxis("mind", "정신 (집중·멘탈·배짱)", "mental", {"focus": 0.5, "mental": 0.4, "guts": 0.3}, 0.5),
    TrainingAxis("fungo_read", "펑고·타구 판단", "fielding", {"ball_reading": 1.0, "first_step": 0.5}, 1.2),
    TrainingAxis("route_drill", "루트·첫걸음 드릴", "fielding", {"route": 1.0, "first_step": 0.6, "sprint": 0.3}, 1.5, 0.01),
    TrainingAxis("glove_work", "포구 반복", "fielding", {"glove": 1.0, "transfer": 0.5}, 1.0),
    TrainingAxis("arm_program", "송구 프로그램(롱토스·정확도)", "fielding", {"arm_strength": 0.8, "arm_accuracy": 1.0}, 1.5, 0.02),
    TrainingAxis("positioning_study", "전력분석·포지셔닝", "fielding", {"positioning": 1.0, "game_sense": 0.3}, 0.5),
]}

BASE_GAIN = 1.6          # skill points per session at mid-level with an average coach


def axes_for_skill(skill: str) -> List[TrainingAxis]:
    return [a for a in CATALOG.values() if skill in a.primary]
