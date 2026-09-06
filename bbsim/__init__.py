"""bbsim — physics-first baseball simulation engine.

Layered package (see docs/ARCHITECTURE.md):

    bbsim.physics   ball flight (drag + Magnus), bat–ball impulse collision
    bbsim.agents    independent pitcher / catcher / batter decision makers
    bbsim.engine    plate-appearance orchestration, umpire, outcome model
    bbsim.viz       matplotlib renderers (optional, not needed by the engine)
    bbsim.game      player cards, training catalog, coaching staff (game layer)

The engine layer only ever hands an agent the information that agent could
observe in reality (see ``bbsim.agents.base``). Ground-truth ball state never
crosses into an agent.
"""

__version__ = "2.6.0"
__all__ = ["__version__"]
