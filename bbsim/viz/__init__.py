"""Optional matplotlib renderers. The engine does not import this package."""
from . import palette
from .plots import (animate_pitch, plot_batted_ball, plot_collision_sweep, plot_pitch,
                    plot_plate_appearance)

__all__ = ["palette", "animate_pitch", "plot_batted_ball", "plot_collision_sweep",
           "plot_pitch", "plot_plate_appearance"]
