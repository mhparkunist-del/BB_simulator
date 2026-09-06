"""Validated default palette (dataviz reference instance, light mode).

Categorical slots are used in FIXED order; never cycle past the list.
"""
SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"]
TEXT = "#0b0b0b"
TEXT_2 = "#52514e"
MUTED = "#9a9891"
GRID = "#e6e5e0"
SURFACE = "#fcfcfb"
REFERENCE = "#b8b6ae"          # neutral for reference/ghost lines

RESULT_COLORS = {              # fixed entity -> slot mapping (never re-ranked)
    "ball": SERIES[0],
    "called_strike": SERIES[1],
    "swinging_strike": SERIES[2],
    "foul": SERIES[3],
    "in_play": SERIES[4],
}
RESULT_LABELS = {
    "ball": "Ball", "called_strike": "Called strike", "swinging_strike": "Swinging strike",
    "foul": "Foul", "in_play": "In play",
}
