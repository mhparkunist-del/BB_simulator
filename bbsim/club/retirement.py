"""End-of-season retirement probability. TODO: calibrate on KBO/MLB career-length data."""


def retirement_probability(age: int, value_now: float, value_peak: float, has_contract: bool, injuries: int,
                           professionalism: float = 0.5) -> float:
    p = 0.0
    if age >= 34:
        p += 0.15 + 0.08 * (age - 34)
    elif age >= 31:
        p += 0.03
    decline = max(0.0, 1.0 - value_now / max(value_peak, 1e-6))
    p += 0.4 * decline
    if not has_contract:
        p += 0.15
    p += 0.03 * injuries
    p *= 1.0 - 0.3 * (professionalism - 0.5)
    return float(min(0.95, max(0.0, p)))
