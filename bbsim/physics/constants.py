"""Physical constants and field geometry (SI units).

Coordinate system (Statcast convention):
    origin  = rear point of home plate, ground level
    +x      = catcher's right (first-base side)
    +y      = toward the pitcher / center field
    +z      = up
"""

# --- environment ---------------------------------------------------------
RHO_AIR = 1.225          # kg/m^3, sea level 15 degC
G = 9.81                 # m/s^2

# --- ball (MLB spec: 5.125 oz, 9.125 in circumference) ---------------------
BALL_MASS = 0.1449       # kg
BALL_RADIUS = 0.03689    # m
BALL_AREA = 3.141592653589793 * BALL_RADIUS ** 2
BALL_INERTIA = 0.4 * BALL_MASS * BALL_RADIUS ** 2   # solid sphere

# --- bat (34 in, 31 oz wood, 2.61 in barrel) -------------------------------
BAT_BARREL_RADIUS = 0.0332   # m
BAT_LENGTH = 0.864           # m
BAT_MASS = 0.879             # kg

# --- field geometry ---------------------------------------------------------
MOUND_TO_PLATE = 18.44       # m (60 ft 6 in) rubber to rear point
RELEASE_Y = 16.76            # m, typical release extension (55 ft)
PLATE_FRONT_Y = 0.4318       # m (17 in) front edge of plate
PLATE_HALF_WIDTH = 0.2159    # m (8.5 in)
STRIKE_ZONE_HALF_WIDTH = PLATE_HALF_WIDTH + BALL_RADIUS

# unit conversions
MPH_TO_MS = 0.44704
MS_TO_MPH = 1.0 / MPH_TO_MS
RPM_TO_RADS = 2.0 * 3.141592653589793 / 60.0
RADS_TO_RPM = 1.0 / RPM_TO_RADS
FT_TO_M = 0.3048
M_TO_FT = 1.0 / FT_TO_M
