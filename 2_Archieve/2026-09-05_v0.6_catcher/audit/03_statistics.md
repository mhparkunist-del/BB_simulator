# 외부 감사 03 — 산출 통계의 현실성 (블라인드, 2026-09-06)

감사자 역할: 야구 통계 연구자(Statcast 계열 타석 결과 모델링). 대상: `/home/mhpark/취미/2_BB_simulator/` 의 `bbsim/`, `tests/`, `examples/`, 허용된 docs 5편. 프로젝트 이력·README·아카이브는 열지 않았습니다.

측정 스크립트·원자료(전부 절대경로):
- 실행기 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/measure.py`
- 집계기 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/analyze.py`
- 판단 편향 진단 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/diag_pred.py`
- 결과표 진단 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/diag_outcome.py`
- 구성별 투구 단위 원자료 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/runs/*.json`, 집계 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/summary_all.json`

---

## 1. 측정 설정과 결과

### 1.1 설정
- 배터리: `HeuristicPitcher(PitcherProfile.from_params(id))` + `HeuristicCatcher(CatcherProfile())`, 한 투수가 300 PA 연속 등판(25 PA마다 `new_game=True`, `examples/run_plate_appearance.py`와 동일 방식). 심판 `Umpire(low_shift=0.02)`.
- 타자: `PerceptiveBatter(BatterProfile(...))` 를 PA마다 새로 생성(예제 스크립트와 동일; 좌타 1/3, power_zone 순환). 기본 능력치 = recognition 0.6, discipline 0.6, 나머지 0.5, bat_speed 31 m/s. 비교군으로 `HeuristicBatter`(예제 기본)와 "같은 타자 객체 유지(학습 누적)" 구성을 추가했습니다.
- 주자·아웃·이닝·점수차는 예제와 같은 순환 패턴. 존 판정은 `StrikeZone.contains`(공 반경 포함), 타구 유형은 Statcast 기준(GB<10°, LD 10–25°, FB 25–50°, PU ≥50°).
- 총 25 구성, 6,100 PA, 약 24,000 구. 구성당 1 프로세스 약 3분.

### 1.2 리그 평균 대조 (기본 타자 × 투수 A~E 풀 1,500 PA, 괄호는 표준 투수 B 300 PA)

| 지표 | 시뮬 | MLB 2023–25 | 판정 |
|---|---|---|---|
| 투구수/PA | 3.91 (4.04) | 3.9 | 근접 |
| K% | 27.6 (26.0) | 22.5 | 높음(+5) |
| BB% | 15.5 (14.3) | 8.5 | 크게 높음(+7) |
| HR/PA | 0.0 (0.0) | 3.2 | 사실상 0 |
| BABIP | .254 (.279) | .295 | 낮음 |
| AVG / OBP / SLG | .171 / .300 / .227 | .248 / .318 / .404 | SLG 절반 |
| 투구 결과 비율 ball / called K / swinging K / foul / in play | 37.9 / 26.9 / 14.8 / 5.8 / 14.6 | 36 / 17 / 11 / 17.5 / 17 | 콜 스트라이크 과다, 파울 1/3 |
| Swing% | 35.2 (33.2) | 47 | 크게 낮음(−12) |
| Whiff% (헛스윙/스윙) | 42.1 (39.3) | 24–25 | 크게 높음(+17) |
| Zone% | 49.3 (49.4) | 48–50 | 근접 |
| Chase% (O-Swing) | 23.5 (22.2) | 28–31 | 약간 낮음 |
| Z-Swing% | 47.2 (44.5) | 65–68 | 크게 낮음 |
| Z-Contact% / O-Contact% | 58.8 / 56.2 | 82–85 / 58–62 | 존 안 컨택 크게 낮음 |
| 테이크 중 콜 스트라이크% | 41.5 (43.8) | 32 | 높음 |
| 초구 스트라이크% | 71.0 (72.0) | 61 | 높음 |
| 초구 스윙% | 22 | 30 | 낮음 |
| 파울/스윙, 인플레이/스윙 | 16.5 / 41.4 | 37 / 39 | 파울 절반 이하 |
| 평균 EV (mph) | 81.8 (80.4) | 89 | 낮음(−7) |
| EV 90백분위 | 93.8 | 104 | 낮음 |
| 강타구%(EV≥95) / 배럴% | 7.7 / 0.0 | 40 / 8 | 크게 낮음 |
| 평균 LA (°) / 표준편차 | 0.3 / 35.8 | 12 / ~26 | 평균 −12, 산포 과대 |
| GB / LD / FB / PU (%) | 59.6 / 15.5 / 16.3 / 8.7 | 43 / 21 / 30 / 6 (요청 기준 43/36/21) | 땅볼 과다 |
| 구종 비율 CH / FF / SI / SL / CU / CT | 38.6 / 21.1 / 17.7 / 12.0 / 8.2 / 2.4 | 11 / 32 / 15 / 22 / 8 / 7 | 체인지업 3.5배 |
| 2S 카운트 패스트볼% / Zone% | 22.9 / 17–29 (카운트별) | ~45 / 40–55 | 2S에서 존 밖 일변도 |
| 3-0 패스트볼% | 100 | ~90 | 근접 |
| 사인 거부(흔들기) 회수/100구 | 20.4 | (공식 통계 없음, 5–10 추정) (추측) | 과다 |
| 심판 콜 스트라이크율: 존 중심 / 가장자리 / 존 밖 | 100 / 82 / 5 | ~99 / 60–70 / 3–8(섀도우 ~25) | 가장자리·섀도우 과대 |
| 피로: 투구수 0–30 → 90+ 구간 FF 평균 mph, 제구 σ | 88.2→87.1 mph, 0.126→0.141 m | −0.5~−1.0 mph, BB% 소폭 상승 | 방향·크기 타당 |
| 플래툰(좌타 vs 우타, RHP B 상대) K% / Whiff% | 29.0 / 42.7 vs 24.5 / 37.6 | 좌타가 우투 상대 유리(K% −2~3p) | 방향 반대, 표본 100 PA로 잡음 범위, 기본값에서 플래툰 기전 없음 |

### 1.3 다른 타자 모델·학습 조건 (투수 B 300 PA)

| 구성 | K% | BB% | HR/PA | BABIP | Swing% | Whiff% | EV | LA | GB/LD/FB |
|---|---|---|---|---|---|---|---|---|---|
| PerceptiveBatter, PA마다 새 타자(기본) | 26.0 | 14.3 | 0.0 | .279 | 33.2 | 39.3 | 80.4 | 0.1 | 60/18/13 |
| PerceptiveBatter, 같은 타자 객체 유지(학습 누적) | 12.7 | 10.3 | 0.0 | .251 | 38.4 | 19.6 | 83.7 | 1.2 | 60/14/14 |
| HeuristicBatter(예제 기본) | 6.7 | 7.7 | 1.7 | .381 | 45.7 | 12.7 | 91.6 | 16.3 | 41/18/26 |

세 구성 어느 것도 K%·BB%·HR·EV/LA 를 동시에 맞추지 못합니다. HeuristicBatter 는 타구 품질(EV 91.6, LA 16, GB 41%)만 리그와 유사하고 K% 가 1/3, PerceptiveBatter 는 K% 는 근접하나 타구가 전부 빗맞음입니다.

### 1.4 능력치 감도 (투수 B, 200 PA/구성, 기본 대비)

| 능력치 | 값 | K% | BB% | HR/PA | Whiff% | Chase% | Swing% | Z-Swing% | EV | 판정 |
|---|---|---|---|---|---|---|---|---|---|---|
| reaction | 0.1 → 0.9 | 42.0 → 17.5 | 15 → 19.5 | 0 → 0.5 | 58.0 → 30.6 | 30 → 18 | 38 → 31 | 46 → 44 | 71 → 84.5 | 과대(−27p). MLB 타자 whiff 5~95백분위 폭 약 15→35(20p). 하나의 능력치가 전 폭을 넘어섬 |
| discipline | 0.2 → 0.9 | 31.0 → 27.0 | 12 → 26 | 0 | 48 → 47 | 29 → 15 | 41 → 29 | 53 → 44 | 78 → 82 | chase 폭(29→15)은 타당. BB 26% 는 2S 존 비율 20% 와 결합해 과대 |
| recognition | 0.3 → 0.9 | 26.5 → 22.0 | 20 → 14 | 0 | 45 → 37 | 22 → 24 | 34 → 36 | 47 → 47 | 80 → 81 | 방향·크기 타당(−8p) |
| tracking | 0.1 → 0.9 | 19.5 → 22.0 | 20.5 → 16 | 0 | 38 → 40 | 24 → 24 | 33 → 34 | 42 → 45 | 78 → 81 | 효과 없음(잡음 범위) |
| boldness | 0.1 → 0.9 | 24.5 → 25.5 | 24 → 11 | 0 → 0.5 | 38 → 48 | 18 → 30 | 28 → 48 | 38 → 67 | 80 → 81 | 방향 타당, Swing% 폭 20p 는 MLB 타자 폭(38~58)과 유사 |
| bat_speed | 28 → 35 m/s | 27 → 24 | 18 → 17.5 | 0 → 2.5 | 45 → 38 | 22 → 24 | 34 → 32 | 45 → 41 | 73 → 89 | EV 기울기(+2.3 mph per m/s) 타당, 절대값 −9 mph 하향 편향 |
| power 0.9 + bat_speed 34 | | 23 | 15.5 | 4.0 | 37.5 | 22 | 33 | 44 | 92.2 | 강타자 프로파일로 타당(강타구 51%) |
| timing·barrel_placement·barrel_accuracy | 0.1 → 0.9 | 34.5 → 22 | 15.5 → 13.5 | 0 | 47.6 → 37.8 | 25 → 22 | 35 → 35 | 45 → 48 | 78.5 → 81.9 | 방향 타당, EV 영향이 작음(편향이 실행 σ 를 압도) |
| 전부 0.9(엘리트) | | 8.0 | 15.0 | 5.0 | 19.2 | 13.5 | 29 | 43 | 94.7 | .359/.629 로 슈퍼스타 상한, Z-Swing 43 은 여전히 낮음 |
| 전부 0.2(약체) | | 57.0 | 9.0 | 0 | 64.7 | 40.6 | 45 | 51 | 69.7 | 극단 하한으로 수용 가능 |

### 1.5 구종별 컨택 진단 (기본 타자 구성 5종 풀, 4,091구)

| 구종 | Zone% | 스윙% | Whiff% | 배트–공 수직 오프셋 평균±σ (mm, 음수 = 공이 배트 아래) | \|오프셋\|≥70 mm 비율 | 실제 IVB / HB (in, 투수 B) |
|---|---|---|---|---|---|---|
| FF | 49 | 22 | 7 | −8 ± 35 | 7% | +9.0 / −14.4 |
| SI | 65 | 29 | 82 | −122 ± 59 | 82% | −2.8 / −16.7 |
| SL | 29 | 28 | 12 | +7 ± 38 | 6% | +4.4 / +6.3 |
| CH | 49 | 40 | 34 | −44 ± 59 | 33% | −5.4 / −13.0 |

MLB 구종별 whiff: FF 20–22, SI 15–17, SL 34–36, CH 30–33. 시뮬은 싱커 82%, 슬라이더 12% 로 순서가 뒤집혀 있습니다.

`diag_pred.py`(투수 B, 존 근처 무작위 목표 40구/구종): 커밋 시점 예측 높이 오차 FF +3.0 cm, SI +10.9 cm, SL +2.9 cm, CH +3.1 cm(전부 실제보다 높게 예측, 표본 σ 1.6–4 cm). 30구 학습 후에도 SI +11.5 cm 로 그대로입니다. 판단 σ(`Judgment.sigma_xz`)는 9–13 cm.

---

## 2. 지적 표

| 심각도 | 지적 | 근거(측정치·코드 위치) | 수정안 |
|---|---|---|---|
| 상 | 타자 예측이 체계적으로 높음 → 싱커·체인지업 위 헛스윙, 땅볼·약한 EV 의 공통 원인 | §1.5. `bbsim/agents/batter_perception.py:90–92` `default_clusters()` 의 FB 클러스터 break_z=+0.25 m 이 이 투수 FF 실측(IVB 9 in ≈ 0.23 m)과는 맞지만 SI(−0.07 m)와 16 cm 차이. `_read_at()` 273–276행이 클러스터 사후 평균으로 잔여 변화를 더하고, `retag()` 114–119행이 속도 2.5 m/s·궤적 0.15 m 이내를 FB 로 묶어 SI 가 FB 클러스터에 흡수됨. `max_clusters=4`(107행)라 학습으로도 분리 안 됨. 최종 계획의 `offv` 평균 −40 mm(풀), SI −122 mm | (1) 초기 클러스터를 속도 3종이 아니라 (속도, IVB) 격자 6~8종으로 두고 `max_clusters` 8 이상. (2) `retag` 의 same_track 임계 0.15 → 0.08 m. (3) 커밋 예측에 `_quadratic_extrapolation` 가중 상한 0.85 를 0.95 로, 시작 frac 0.30 → 0.20. (4) 검증 게이트: 구종별 커밋 오차 평균 \|dz\| < 2 cm, whiff 순서 SL > CH > FF ≥ SI |
| 상 | 타자 학습이 PA 단위로 소실 | `examples/run_plate_appearance.py:41` 이 PA마다 `HeuristicBatter(...)` 새로 생성. `same_batter` 구성에서 whiff 39→20, K 26→13 으로 급변(§1.3). 예제 통계는 "첫 대면 4구" 상태의 통계 | 라인업 9명 객체를 유지하고 순환. `PerceptiveBatter.memory` 를 시즌 단위로 직렬화. 리그 평균은 "학습 완료 상태"로 정의하고 초기 클러스터를 리그 평균 프로파일로 채움 |
| 상 | 배터리가 2스트라이크에서 존 밖 일변도 → BB% 15.5, 3-2 스트라이크율 36% | 카운트별 Zone%: 0-2 25, 1-2 17, 2-2 19, 3-2 29 (MLB 35/40/45/55). `bbsim/agents/intent.py:79` `zone_prior` 가 s==2 이면 chase +0.7, `count_prior` 68행 2S 변화구 +0.3, `catcher.py:254–261` 약점 가족·chase 가산이 중첩. 3-2 에서만 middle +0.6(83행) | s==2 chase 가산을 +0.7 → +0.25, b≥2 & s==2 는 0. `zone_prior` 에 "b==3: chase −0.8" 추가. 검증 게이트: 2S Zone% 40–50, BB% 7.5–9.5 |
| 상 | HR 0%, 배럴 0%: 타구 품질 분포가 전체적으로 −8 mph, −12° | EV 81.8/p90 93.8, LA 0.3±35.8, GB 60%. 원인 = 위 예측 편향(공 아래를 못 맞춤: `offv` 음수 → 톱스핀·음의 LA) + `unc`>0.18 이면 컨택 스윙(bat×0.92, attack −3°, undercut 0; `batter.py:351,357–358`)이 스윙의 45%. 타구 물리 자체는 정상(100 mph/28°/2000 rpm → 408 ft, `diag_outcome.py`) | 예측 편향 수정이 선결. 그 뒤 `contact_mode` 임계를 0.14+0.08·bold → 0.20+0.08·bold, `undercut_intent` 0.008 → 0.015 m(MLB 평균 LA 12° 재현 목표). 검증 게이트: EV 87–90, LA 10–14, LA σ 24–28, HR/PA 2.5–3.5 |
| 상 | 결과표(placeholder)가 MLB 형 입력에서도 BABIP .355, 땅볼 안타 .33, 비홈런 안타 중 2·3루타 46% | `diag_outcome.py`(EV N(89,12.5), LA N(12,26) 입력): GB BABIP .330(MLB .24), FB .207(MLB ~.12), XBH 46%(MLB ~25%). `bbsim/engine/outcome.py:90–105`: la<0 → 0.22+0.010(ev−85); 0–10° → 0.40+0.012(ev−85), 75 m 이상이면 2루타; 10–25° → 0.62+0.008(ev−85), 80 m 이상 2루타 | 계수 재조정: la<0: 0.15+0.007(ev−85); 0–10°: 0.28+0.010(ev−85); 10–25°: 0.62+0.006(ev−85); 25–45°: 0.06+0.30·비율. 2루타 조건을 거리 75/80 m → 95 m 또는 \|spray\|>25°&거리>85 m. 검증: MLB 입력 BABIP .290–.300, XBH/안타 22–28% |
| 상 | 파울이 스윙의 16.5%(MLB 37%), LA −62° 도 "인플레이" | `outcome.py:82` 파울 판정 = \|spray\|>45° 뿐. 인플레이 LA 5백분위 −62°, 95백분위 +54°. 파울팁·백네트 파울·뒤로 넘어가는 팝 파울 부재 → 콜/헛스윙 비율 왜곡, 2S 연장 없음 | `resolve()` 앞단에 (a) LA < −25° 또는 LA > 65° → foul(팁/팝) 확률 0.8, (b) \|spray\| 35–45° 는 거리 비례 확률 파울, (c) 타구 스핀 축이 뒤쪽(백네트) 이면 foul. 검증: foul/swing 33–40%, 2S 파울 후 PA 길이 3.9 |
| 중 | 구종 비율 왜곡(CH 38.6%, FF 21%) 과 자기강화 | `catcher.py:180` `note_pitch` 가 헛스윙 +0.25 → `working` 가산(249행 (0.8+0.8·lev)·w). 타자 편향으로 CH/SI 가 헛스윙을 벌면 더 많이 요구 → CH 48%(투수 C). `intent.py:84–91` 저코스 SI/CH +0.3, 변화구 in/away +0.15 도 FF 를 밀어냄 | `working` 감쇠 0.8 → 0.6, 가산 상한 ±0.5. `count_prior` 의 FF 기본 +0.3 추가, b>s 패스트볼 +0.6 유지. 검증: FF+SI+CT 50–58%, CH 9–14%, SL+CU 25–33% |
| 중 | 타자 타이밍 판단이 컨택에 반영되지 않음 | `bbsim/engine/plate_appearance.py:177` `dt_err = rng.normal(0, ex.timing_sigma)` 만 사용, `decision.t_contact` 는 `contact_offsets` 기록용(183행). `late_read` 의 `t_c` 보정(`batter.py:342`), 클러스터 `delay` 학습(`batter_perception.py:79,86`)이 결과에 무영향. `diag_pred`: 계획 t_contact 가 실제보다 6–9 ms 이른 편향이 있으나 결과에 안 나타남 | `dt_err = (decision.t_contact − arrival.t) + rng.normal(0, timing_sigma)`. 이때 편향 −6~−9 ms 가 드러나므로 `PitchCluster.delay` 초기값 0.012 → 0.020 s 로 재보정 후 게이트: 평균 \|dt\| < 3 ms |
| 중 | Z-Swing 47%(MLB 66%) → 콜 스트라이크 27%(MLB 17%), 테이크 중 콜 41.5% | `batter.py:299–307` p_zone 0.75(중립)·×(1.15−1.5·unc) ≈ 0.69, 324행 `deliberate_take` 가 존 안 가장자리 6 cm 이내까지 60%·(1−bold) 확률로 강제 테이크. 존 안 테이크 note: take 782, take-to-learn 367 vs 스윙 888 | 중립 카운트 p_zone 0.60+0.30·bold → 0.72+0.25·bold, `deliberate_take` 조건을 존 밖(d_out>0)으로 한정하고 확률 0.6 → 0.35. 검증: Z-Swing 62–70, called strike 15–19% |
| 중 | 초구 스트라이크 71%, 초구 Zone 70% | `intent.py:70` 0-0 패스트볼 +0.2, `zone_prior` 0-0 chase −0.3, `catcher.py:267–271` 초구 안 치면 존 안 +0.6, 타자 0-0 p_zone 0.30+0.35·bold=0.475 | 0-0 zone_prior middle −0.4 유지, chase −0.3 → −0.1. 검증: 초구 Zone 52–58, F-Strike 58–63 |
| 중 | reaction 감도 과대(whiff −27p) 이면서 기전이 "편향 교정" | `batter.py:336–338` `max_shift = 0.10·gain`, 늦은 읽기(`late_read`, 접촉 80 ms 전)가 커밋 편향 10 cm 를 되돌림. 편향이 없으면 이 능력치 효과는 급감할 것 (추측) | 편향 수정 후 재측정. `max_shift` 0.10 → 0.05 m, 0.1→0.9 목표 whiff 폭 8–10p |
| 중 | tracking 감도 0 | `perception.py:31` 시각 노이즈 = 0.05°×거리(17 m → 1.5 cm)×(0.7~1.3). 판단 σ(9–13 cm)의 1/8 이라 무의미. `visibility()` 는 가중치만 바꿈 | `eye_sigma_deg` 0.05 → 0.15, `eye_sigma_factor` 폭 0.6~1.6. 목표: tracking 0.1→0.9 whiff 폭 6–8p |
| 중 | 심판 가장자리 콜 82%, 존 밖 5%, 존 안 100% | `rules.py:47–52` 밴드 = 0.02×1.5 = 3 cm 선형. MLB 는 가장자리(섀도우 안쪽) 60–70%, 섀도우 바깥 ~25% | `edge_noise` 0.02 → 0.035, 선형 대신 로지스틱 P(strike)=1/(1+exp(d/0.025)). 검증: 존 안 콜 86–90, 섀도우 바깥 20–28 |
| 중 | 사인 거부 20회/100구, 합의 68% | `pitcher.py:215–216` trust 0.75×(0.7+0.6×0.5)=0.75, gap/0.6 감쇠. 카드 기본값에서 매 3구마다 거부 | `trust_catcher` 0.75 → 0.90, gap 척도 0.6 → 1.2. 목표 5–10회/100구 (추측: 공개 통계 부재) |
| 중 | 투수 D(언더핸드) 평균 69 mph, 사이드암 C 평균 80 mph | `pitching_params.json` D: mph 84, lean 58(>lean_hi 50 손실), tilt −25(<tilt_lo −20 손실), slot 손실, 여기에 grips spd 0.9 가 곱해짐. 문서(forms.submarine "구속 −6~8%")와 달리 −18%. C 는 CH 48.5% 사용 때문 | `chain_efficiency` 손실을 profile `mph` 에 이중 적용하지 않도록 D 의 `mph` 를 "실측 FF" 로 정의하거나 손실 상한 합계 0.08 로 클램프 |
| 하 | 플래툰 기전이 기본값에서 비활성 | `batter.py:264–268` split 0.5 → 보정 0. 측정된 L/R 차이(K 30.4 vs 26.2)는 잡음 범위이며 방향도 반대 | 기본 split_vs_L 0.40(우타 0.55) 등 리그 평균 플래툰(wOBA 차 ~20p)을 기본값에 내장하고 게이트로 측정 |
| 하 | 수비수·주자 부재로 BABIP·XBH·희생·병살 없음 | `outcome.py` docstring, `PlayResult` 4종 | v0.2 예고대로 수비 배치·타구 도달 시간 모델로 교체. 그 전까지는 §2 결과표 재조정으로 임시 대응 |
| 하 | FF 형상이 싱커에 가까움(IVB 9 in, HB 14 in), 싱커 IVB −2.8 in | `pitch.py:104` tilt_axis = tilt0 + pron + (90 − arm_angle): 팔각도 32° → 58°. 리그 FF 는 팔각도 40° 에서 축 ~35–40°, IVB 15–17 in. `pitching_params.json` SI eff 0.85·B eff 0.92 → gyro 0.62 | tilt 규칙을 (90 − arm_angle)×0.6 으로 완화, SI grip eff 0.85 → 0.92. 검증: FF IVB 14–17, SI IVB 5–9 |

---

## 3. 종합 판정 — "현실과 비슷하다고 말할 수 있는가"

| 항목 | 판정 | 근거 |
|---|---|---|
| 투구수/PA, Zone%, 3-0 패스트볼, 피로 추세 | 예 | 3.91, 49.3%, 100%, −1 mph·σ +12% |
| Chase% | 조건부 | 23.5 로 하한 근처, discipline 폭은 타당 |
| K% | 조건부 | 27.6 은 +5p, 그러나 whiff 42% 와 Z-Swing 47% 의 상쇄로 우연히 근접(잘못된 기전) |
| BB% | 아니오 | 15.5, 2S 존 비율 20% 가 원인 |
| HR/PA, SLG, 배럴 | 아니오 | 0.0 / .227 / 0 |
| BABIP | 아니오 | .254(시뮬), 결과표 자체는 MLB 입력에 .355 로 반대 방향 편향 |
| Swing%, Z-Swing%, Z-Contact%, 콜 스트라이크 비율 | 아니오 | 35 / 47 / 59 / 27% |
| Whiff% | 아니오 | 42%, 구종 순서 역전(SI 82, SL 12) |
| 초구 스트라이크% | 조건부 | 71 (투수 D 62) |
| EV / LA / GB-FB-LD | 아니오 | 81.8 / 0.3 / 60-16-16 |
| 파울 비율 | 아니오 | 스윙의 16.5% |
| 구종 배합 | 아니오 | CH 38.6% |
| 심판 콜 | 조건부 | 존 안 100%, 가장자리 82%: 방향은 맞고 폭이 좁음 |
| 플래툰 | 아니오 | 기본값 비활성 |
| 능력치 감도 | 조건부 | recognition·boldness·bat_speed·power·discipline(chase) 는 타당. reaction 과대, tracking 무효, 타이밍 판단 무효 |

총평: 물리층(투구 궤적, 충돌, 타구 비행)과 배터리 의사결정 구조는 리그 통계를 재현할 수 있는 형태입니다. 그러나 현재 산출 통계는 리그 평균과 비슷하다고 말할 수 없습니다. 원인의 대부분은 세 곳에 모입니다. (1) 타자 예측의 체계적 높이 편향(클러스터 사전·병합 규칙), (2) 2스트라이크 존 밖 일변도 배터리 사전, (3) placeholder 결과표·파울 판정. 이 셋을 고치면 K/BB/EV/LA 가 동시에 움직이므로, 그 뒤에 감도(reaction·tracking) 재측정이 필요합니다.

---

## 4. 우선 수정 5건

1. 타자 예측 편향 제거 — `bbsim/agents/batter_perception.py` `default_clusters()`·`retag()`·`max_clusters`·`_read_at()` 의 quad 가중. 게이트: 구종별 커밋 \|dz\| < 2 cm, whiff 순서 SL > CH > FF ≥ SI, Z-Contact 80–85%.
2. 2스트라이크 존 비율 정상화 — `bbsim/agents/intent.py` `zone_prior` s==2 chase +0.7 → +0.25, b==3 chase −0.8, `catcher.py` chase 가산 상한. 게이트: 2S Zone% 40–50, BB% 7.5–9.5, 3-2 스트라이크율 50% 이상.
3. 파울 모델과 결과표 재조정 — `bbsim/engine/outcome.py` `resolve()` 에 LA 극단·스프레이 경계 파울 확률 추가, GB/FB 안타 계수 하향, 2루타 거리 조건 상향. 게이트: foul/swing 33–40%, MLB 형 입력 BABIP .290–.300, XBH/안타 22–28%.
4. 타이밍 판단을 컨택에 연결 — `bbsim/engine/plate_appearance.py:177` `dt_err` 에 `decision.t_contact − arrival.t` 를 더하고 `PitchCluster.delay` 재보정. 게이트: 평균 \|dt\| < 3 ms, spray σ 25–30°.
5. 존 안 스윙 확률·초구 사전·심판 밴드 — `batter.py` p_zone 상향과 `deliberate_take` 를 존 밖으로 한정, `intent.py` 0-0 chase −0.1, `rules.py` 로지스틱 밴드 2.5 cm. 게이트: Swing 45–49, Z-Swing 62–70, F-Strike 58–63, called strike 15–19%, 테이크 중 콜 30–34%.

수정 후 재감사 항목: reaction 0.1→0.9 whiff 폭 8–10p, tracking 폭 6–8p, HR/PA 2.5–3.5, EV 87–90, LA 10–14, 구종 비율 FF+SI+CT 50–58%. 감사에서 사용한 `measure.py`·`analyze.py` 를 그대로 게이트 스크립트로 쓸 수 있습니다(구성 25종, 총 약 4분 병렬).
