"""Game layer: player cards, training catalog, coaching staff (v0.2.0)."""
from .coaching import Coach, Diagnosis, Staff, WeekReport, diagnose, elite_staff, weak_staff
from .player import DOMAINS, SKILLS, SKILL_DOMAIN, PlayerCard, Talent, make_prospect
from .training import BASE_GAIN, CATALOG, TrainingAxis

__all__ = ["Coach", "Diagnosis", "Staff", "WeekReport", "diagnose", "elite_staff", "weak_staff",
           "DOMAINS", "SKILLS", "SKILL_DOMAIN", "PlayerCard", "Talent", "make_prospect",
           "BASE_GAIN", "CATALOG", "TrainingAxis"]
