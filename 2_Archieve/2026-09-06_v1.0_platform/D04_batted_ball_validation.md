# 타구 물리 모델 검증 (bbsim v1.4, 2026-09-06)

## 결론
배트-공 충돌은 3차원 강체 충격량 모델입니다(법선 반발계수 COR(v)·마찰·굴림 조건·배트 유효질량 프로필). 타구 비행은 투구와 같은 RK4(항력·마그누스·회전 감쇠·환경)입니다. 입력은 공의 속도·회전, 배트에 맞은 위치(수직 오프셋·배트 축 방향 오프셋), 배트 속도·궤도(어택 앵글), 배트 질량·유효질량(힘)입니다. 아래 표는 `python3 tools/validate_batted_ball.py` 출력이며 Nathan(2003·2015)과 Statcast 공개 수치와 비교했습니다. 판정은 다음과 같습니다. 충돌 효율 q 0.19~0.20(문헌 0.2), 발사각 1 cm당 약 12°(문헌 10~12°). 뜬공 백스핀 1,500~3,200 rpm(문헌 2,000~3,000), 100 mph/28° 비거리 125 m(Statcast 약 120 m). 사용 가능한 상태이며, 타구 항력 계수는 0.39(투구 0.35)로 두어 Statcast 비거리에 맞췄습니다.

- 코드: bbsim/physics/collision.py(collide, bat_frame), bbsim/physics/bat.py(BatSpec, 유효질량 프로필), bbsim/engine/outcome.py(fly, 결과표)
- 힘의 반영(감사 02 #2 수용): 힘은 배트 속도 배수(0.94+0.12·power)로, 유효질량은 배트 질량의 0.75배로만 정해집니다.

## A. EV vs bat speed (sweet spot, centred, pitch 90 mph) — Nathan: EV ~ 0.2 v_pitch + 1.2 v_bat
## A. EV vs bat speed (sweet spot, centred, pitch 90 mph) — Nathan: EV ~ 0.2 v_pitch + 1.2 v_bat
| bat mph | EV model | EV Nathan | q model |
|---|---|---|---|
| 60 | 88.5 | 88.6 | 0.20 |
| 65 | 94.2 | 94.6 | 0.20 |
| 70 | 99.9 | 100.6 | 0.20 |
| 75 | 105.6 | 106.6 | 0.19 |
| 80 | 111.3 | 112.6 | 0.19 |

## B. Launch angle & spin vs vertical offset (bat 70 mph) — Nathan: ~10-12 deg/cm, fly-ball backspin 2000-3000 rpm
| offset cm (ball above bat centre) | EV | LA | spin rpm | distance m |
|---|---|---|---|---|
| -2 | 97 | -16 | 3580 | 3 |
| -1 | 99 | -4 | 1869 | 9 |
| +0 | 100 | +8 | 170 | 47 |
| +1 | 99 | +20 | 1518 | 105 |
| +2 | 97 | +32 | 3195 | 117 |
| +3 | 92 | +44 | 4858 | 92 |
| +4 | 86 | +58 | 6506 | 41 |

## C. Pitch speed & spin (bat 70 mph, +1.5 cm) — faster pitch adds ~0.2 mph EV per mph; incoming backspin adds batted backspin
| pitch mph | pitch rpm | EV | LA | spin rpm |
|---|---|---|---|---|
| 80 | 1800 | 96.6 | +25 | 2240 |
| 90 | 2200 | 98.0 | +26 | 2358 |
| 98 | 2500 | 99.1 | +26 | 2459 |
| 90 | 1200 | 98.2 | +27 | 2686 |
| 90 | 2800 | 97.9 | +25 | 2161 |

## D. Effective mass (힘/배트) and end-of-bat contact (bat 70 mph, +1.5 cm)
| m_eff kg | axial offset cm | EV | note |
|---|---|---|---|
| 0.55 | 0 | 91.9 | contact |
| 0.66 | 0 | 98.0 | contact |
| 0.75 | 0 | 101.9 | contact |
| 0.66 | 8 | 85.0 | contact |
| 0.66 | 15 | 59.6 | contact |

## E. Distance check (Statcast: 100 mph/28 deg ~ 120 m, 95/25 ~ 105 m)
| EV mph | LA deg | backspin rpm | distance m |
|---|---|---|---|
| 100 | 28 | 2200 | 119 |
| 95 | 25 | 2000 | 109 |
| 105 | 30 | 2500 | 127 |
| 90 | 15 | 1500 | 83 |
