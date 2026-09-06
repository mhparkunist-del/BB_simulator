# bbsim 외부 감사 02: 투구 생체역학·능력치 체계·타자 지각·포수 모델

- 감사자 역할: 스포츠과학(투구 생체역학·운동제어·타격 시지각) + 스포츠게임 선수 평가체계 설계
- 감사 방식: 블라인드. 읽은 파일은 `bbsim/data/pitching_params.json`, `bbsim/physics/{body,pitch,ball,collision}.py`, `bbsim/agents/{pitcher,catcher,batter,batter_perception,intent}.py`, `bbsim/game/{player,training,coaching}.py`, `docs/{PHYSICS,BATTER_JUDGMENT,CATCHER,PLAYER_ATTRIBUTES,INTENT,COACHING}.md`, `1_Reference/arm_angle_research.md`. 프로젝트 이력·아카이브·README는 열지 않았습니다.
- 수치 검산: `release_pose`, `chain_efficiency`, `spin_from_card`를 프로필 5종·폼 프리셋 6종에 대해 직접 실행했습니다(아래 표). 추론으로 채운 값은 '(추측)'으로 표기했습니다.
- 작성일: 2026-09-06

---

## 1. 모델 요약 (중립)

### 1.1 투수 신체 모델 (`physics/body.py`, `pitching_params.json: body / chain_efficiency / spin_model / fatigue`)
- 릴리스 순간의 정적 자세를 분절 길이(키 비율)로 조립합니다. 입력은 어깨 외전 abd, 몸통 측면 기울기 tilt, 전방 기울기 lean, 스트라이드(키 비율), 팔 전방각 fwd. 팔 각도는 어깨→공 벡터의 전두면 각(Statcast 정의)으로 산출하며 폐형식은 (abd − 90) + tilt + 5°(팔꿈치 항)입니다.
- 구속 배율 `chain_efficiency` = (1 + 스트라이드 항 + 전방기울기 항) × (1 − 외전 손실) × (1 − 측면 손실) × (1 − 슬롯 손실) × (1 − 전방 과다 손실). 코어 힘(0..1)이 잠재 효율을 실현합니다. 팔꿈치 부하 지수는 별도 산출합니다.
- 회전수 rpm = BU × mph × f_grip × f_force × 그립 계수. BU = 20 + 8·(0.6·손목속도 + 0.4·손가락길이). f_force = min(1, 악력/(35 + 0.8·(mph − 85))).
- 회전축 tilt_axis = 그립 tilt0 + 회내 + (90 − 팔 각도). 자이로 비율은 (투수 효율 × 그립 효율)에서 유도합니다.
- 피로: 60구 초과분마다 구속 −0.04 %, 제구 σ +0.4 %, 회전 −0.03 %. 경기 전 피로(카드 state)는 별도 배율입니다.

실행 결과(키·핸드는 프로필값, core 0.7):

| 프로필 | 팔 각도(기하) | 폐형식 | 릴리스 높이 / Statcast 회귀 | \|x\| | 익스텐션(h) | 구속 배율 | FF rpm(BU) |
|---|---|---|---|---|---|---|---|
| A 오버핸드 | 48.0° | 53.0° | 1.77 / 1.85 m | 0.37 | 1.10 | 0.999 | 2394 (24.7) |
| B 쓰리쿼터 | 32.0° | 37.0° | 1.67 / 1.69 m | 0.51 | 1.05 | 0.987 | 2135 (23.0) |
| C 사이드암 | 8.0° | 13.0° | 1.48 / 1.46 m | 0.73 | 0.99 | 0.964 | 2001 (23.3) |
| D 언더핸드 | −33.0° | −28.0° | 0.83 / 1.05 m | 0.88 | 1.08 | 0.880 | – |
| E 하이슬롯 | 50.0° | 55.0° | 1.76 / 1.87 m | 0.33 | 1.08 | 0.994 | 2308 (24.4) |

폼 프리셋(h 1.85, core 1.0): 오버핸드 0.990, 하이 쓰리쿼터 0.998, 쓰리쿼터 0.997, 로우 쓰리쿼터 0.988, 사이드암 0.972, 언더핸드 0.917. 외전 스윕(75/85/95/105°) 배율 0.952/0.984/0.998/0.984. 전방기울기 0°에서는 배율 0.961·제구 배율 1.20.

### 1.2 능력치 체계 (`game/player.py`, `training.py`, `coaching.py`)
- 4계층(고정 A / 반고정 B / 폼 C0 / 훈련치 C / 상태 D) + 자질 T(분야별 learn·potential·retain·sense·stability).
- 투수 산출: 구속 = (84 + 16·속근) × (0.80 + 0.20·사슬) × 나이 × 피로·컨디션, 사슬 = 0.5·하체 + 0.3·코어 + 0.2·어깨ROM. 회전·제구는 §1.1 식과 동형. 제구 σ = (0.30 − 0.14·반복성) × 피로 × 집중.
- 타자 산출: 배트 속도 25~37 m/s, recognition = 0.3 + 0.5·tracking + 0.2·vision_base, release_read = 0.2 + 0.6·tracking, 나머지 15개 타격 스킬은 0..1로 그대로 전달.
- 훈련 18축, 코치는 진단·지도·부하관리·소통·관찰 5능력으로 불완전 관측 에이전트. 주간 루프에서 이득·감쇠·피로·부상·자질 추정을 갱신합니다.

### 1.3 타자 지각·판단 (`agents/batter_perception.py`, `agents/batter.py`)
- 사전확률 P(직구): 카운트별 리그 표 + 이 투수의 학습된 직구 비율 + 직전 가족 효과. 노림수는 지수 k로 날카롭게, 침착성 부족은 부담 지수에 비례해 직구 쪽으로 쏠림.
- 구간 읽기: 비행 25/40/55/70 %에서 직선+중력 적합 대비 편차(휨)와 구속으로 군집(최대 4개, 속도·휨·지연)별 사후확률과 도달점을 계산. 가중치 = visibility(frac, tracking) × 학습된 구간 신뢰 × (0.6 + 0.4·recognition). commit 시각 = 도달 − (0.18 − 0.06·swing_quickness) s, 그 뒤 80 ms 전까지 늦은 읽기로 최대 10 cm × reaction 보정·체크 스윙.
- 학습: 군집 갱신, 가족 재태깅, 구간 신뢰(exp(−오차/10 cm) 방향), 가족별 바이어스, 릴리스 평균. 릴리스 편차 6 cm 이상이면 release_read 확률로 팁.
- 스윙 결정: 존 스윙 확률(카운트·boldness·불확실성·존 지도), 추격 폭(discipline·panic·boldness), 컨택/파워 모드, 실행 σ(timing·barrel_placement·focus·피로·감각).

### 1.4 포수 (`agents/catcher.py`)
- 능력 11종. 사인 채점 = 공통 사전 + 투수 의도(0.6) + 오늘 통하는 구종 + 타자북(가족별 헛스윙·코스별 추격·초구·2S 추격, 사전 pseudo-count k = 12·(1 − 0.7·obs) + 2) + 터널 후보(플레이트 9 m 앞 분리 ≤ 12 cm, 플레이트 분리 ≥ 20 cm) + 주자·심판·프레이밍·시프트·스카우팅 + 침착성 노이즈.
- 프레이밍은 심판 경계 판정 ±2.5 cm, 블로킹은 주자 시 원바운드 폭투 확률 0.35·(1 − 0.8·b), 소통은 투수 수락 확률.

---

## 2. 지적 표

심각도: 상 = 결과 분포나 물리 인과를 왜곡, 중 = 크기·독립성 문제, 하 = 정리·문서·누락(소).

| # | 심각도 | 지적 | 근거 (문헌·수치, 파일:함수) | 수정안 |
|---|---|---|---|---|
| 1 | 상 | 회전축 규칙 (90 − 팔 각도)가 축을 팔쪽으로 과회전시킴. 리그 중앙값 근처(프로필 B, 팔 각도 32°)의 포심이 tilt 58°(시계 1:56)로 나옴. 싱커는 93~117°로 순수 사이드스핀을 넘어 톱스핀 성분이 생김 | Statcast RHP 포심 평균 spin direction 211°(≈1:02, 백스핀 기준 ~31°), 팔 각도와 상관 0.75. 실측 팔 각도 중앙값 39.6°이므로 (90 − 40) = 50°는 약 20° 과다. `pitch.py:build_spec`, `pitching_params.json: grips.tilt0/pron` | tilt_axis = tilt0 + pron + k·(90 − arm_angle), k ≈ 0.6 (팔 각도 40°에서 포심 ≈ 30°, 사이드암 10°에서 ≈ 48°+pron). 사이드암 포심이 2:30~3:00에 오도록 SI/FF의 pron으로 미세 조정. 검증: 폼 6종의 FF 축을 Statcast arm-angle×spin-direction 회귀와 ±10° 비교 |
| 2 | 상 | 타자 '힘(power)'을 배트 유효질량 m_eff(0.50 + 0.30·power kg)로 매핑. 충돌 지속 ~1 ms 동안 손·근력은 충돌에 관여하지 않으며 m_eff는 배트 질량·MOI·타점의 함수 | Nathan(2000, 2003) 배트-공 충돌 모델: 손의 영향은 무시 가능, m_eff는 배트 관성 특성으로 결정. `batter.py:HeuristicBatter.bat_spec` | m_eff는 BatSpec(배트 질량·타점)에서만 산출. power는 (a) 배트 속도 상한(fast_twitch와 함께), (b) 같은 속도로 휘두를 수 있는 배트 질량 선택 범위로만 작용. 예: bat_speed_max = 25 + 12·(0.5·bat_speed_skill + 0.3·power + 0.2·fast_twitch) |
| 3 | 상 | 침착성·부담(panic) 효과가 과다. panic 최대 1에서 실행 σ ×1.5, 추격 폭 ×1.8, 사전확률 직구 쪽 대폭 이동, 구간 가중치 무작위 흔들림 | 리그 집계에서 레버리지·클러치 효과는 wOBA 수 포인트 수준(추측, The Book 계열 분석). 2스트라이크 자체는 p_zone에서 이미 처리되는데 pressure_index에 0.35를 또 넣어 이중 반영. `batter_perception.py:pressure_index`, `judge`, `batter.py:PerceptiveBatter.decide` | pressure_index에서 2스트라이크 항 제거(풀카운트 0.10, 주자 0.08/명, 레버리지 0.3). 계수 축소: 실행 σ ×(1 + 0.15·panic), 추격 폭 ×(1 + 0.25·panic), prior 이동 0.35 → 0.10, 가중치 노이즈 σ 0.6 → 0.2. 검증: 레버리지 상·하위 구간의 시뮬 wOBA 차 ≤ 0.015 |
| 4 | 상 | 카드→물리 이중 계산 두 곳. (a) 경기 전 피로: `derive_pitch_traits`에서 (1 − 0.04·fatigue), `HeuristicPitcher.traits`에서 다시 (1 − 0.02·p.fatigue). (b) 하체·코어: `derive_pitch_traits` 사슬(0.5·하체 + 0.3·코어)에 넣고, `from_card`가 core = (코어+하체)/2를 `chain_efficiency`에 또 넣음 | `player.py:derive_pitch_traits`, `pitcher.py:PitcherProfile.from_card`, `HeuristicPitcher.__init__`(chain_efficiency core), `traits` | 피로는 카드 산출에서만(0.04). core 인자는 카드 경로에서 1.0 고정하거나 `derive_pitch_traits`의 사슬에서 코어 항을 빼고 `chain_efficiency`에만 둠. 산출 경로를 한 함수로 통합해 "카드 → mph"를 단일 소스로 |
| 5 | 상 | 경기 내 피로가 스태미나 능력치와 무관. free_pitches 60 고정, 60구에서 기울기 불연속. 초반 상승(워밍업) 없음 | 실측: 포심 구속은 20구 근처에서 정점, 이후 완만 하락, 선발 중 최대 −2.3 mph. 스태미나는 `weekly_capacity`에만 작용. `pitcher.py:traits`, `command_sigma`, `pitching_params.json: fatigue` | free = 40 + 40·stamina (0..1). 손실을 매끄럽게: loss = c·max(0, n − free)^1.3 / 40^0.3 (c = mph 0.0004, σ 0.004, spin 0.0003 유지). 워밍업: 처음 15구 (1 − 0.01·(1 − n/15)). 회복: 이닝 사이·등판 간격을 state.fatigue로 |
| 6 | 중 | 변화구 회전수 저평가. 커브 2130~2210 rpm, 체인지업 1380~1550, 슬라이더 2056~2305 | MLB 평균(추측, Statcast 2023~2025): 커브 ~2500, 슬라이더 ~2450, 체인지업 ~1750~1800. 원인은 rpm ∝ mph인데 커브 구속이 84 %로 낮아 rpm이 함께 내려가는 구조. `pitching_params.json: grips.spin`, `body.py:spin_from_card` | 그립 spin 계수 재설정: CU 1.10 → 1.30, SL 1.07 → 1.15, CH 0.72 → 0.85, SP 0.55 → 0.60. 또는 rpm 산출을 구속 대신 손목 속도 기준으로 바꾸어 구종 간 독립성 확보 |
| 7 | 중 | 프로필 제구 σ 0.10~0.14 m가 리그 평균보다 훨씬 정밀. 카드 산출(0.16~0.30 m)과도 불일치 | MLB 평균 미스 거리 12.5~13 in(0.32 m). 2D 등방 정규에서 평균 반경 = 1.25·σ이므로 축당 σ ≈ 0.25 m. 우수 6~8 in → σ ≈ 0.13~0.16 m. `pitching_params.json: profiles.cmd`, `player.py:derive_pitch_traits` | 프로필 cmd 0.20~0.26 m(A 0.24, B 0.22, C 0.18, D 0.22, E 0.21). 카드식은 유지하되 반복성 100에서 0.15 m가 하한이 되도록 (0.31 − 0.16·rep) |
| 8 | 중 | 전방 기울기(lean) 정의 불일치. 참조 문서 표는 릴리스 시 전방 기울기 7~15°(Escamilla 계열)인데 모델 폼은 25~33°, 최적 32°(Matsuo 2001) | 두 문헌의 기준축(골반 기준 vs 절대 수직)이 다름. `1_Reference/arm_angle_research.md §2` vs `pitching_params.json: forms.lean, chain_efficiency.lean_opt` | 정의를 "릴리스 시 몸통 장축의 절대 수직 대비 전방각(ASMI)"으로 명시하고 문서 표에 환산 각주 추가. Escamilla 값을 쓰려면 lean_opt를 15°, 폼 lean을 10~18°로 재설정하고 골반 전진 계수로 익스텐션 보정 |
| 9 | 중 | 팔 각도 정의가 둘. `release_pose`의 기하값(어깨→공)이 폐형식(+5°)보다 5° 낮고, `spec_for`는 기하값을 축 규칙에 넣음. 팔꿈치 굴곡 20°도 문헌 30~35°보다 작음 | 실행값: A 48 vs 53, B 32 vs 37. 문헌 팔꿈치 굴곡 30~35°(프로 288명). `body.py:release_pose`, `arm_angle_simple`, `pitching_params.json: release.elbow_flex_deg` | elbow_flex_deg 20 → 30. `arm_angle_simple` 폐기 또는 기하값을 반환하도록 통일. 문서의 "+5°"는 기하 계산이 흡수한다고 기술 |
| 10 | 중 | 시각 가시성이 비행 35~60 %에서 붕괴하기 시작하고 81 %(늦은 읽기 시점)에서 노이즈 ×2.5. 실제 전문가는 플레이트 5.5 ft(≈1.7 m, 비행의 ~90 %) 앞까지 추적 | Bahill & LaRitz 1984: 메이저리거는 5.5 ft, 일반은 9 ft(≈83 %)까지 추적, 안구 추적 속도 120°/s. 늦은 정보가 못 쓰이는 이유는 시각이 아니라 운동 지연(commit)인데 모델은 둘을 겹쳐 이중 페널티. `batter_perception.py:visibility`, `batter.py:late_blur` | visibility를 각속도 기준으로: ω = |v|·(x 오프셋)/y² 근사, 임계 ω_c = 70 + 60·tracking (°/s), ω < ω_c이면 1.0, 이후 선형 감소·바닥 0.3. 대략 tracking 0.5에서 cutoff ≈ 0.85. commit 마감이 정보 활용 한계를 담당(이미 구현) |
| 11 | 중 | 릴리스 이전 운동학 단서(팔 속도·손 모양·글러브)가 없고 릴리스 '위치 편차 6 cm'만 팁으로 작동 | Ranganathan & Carlton 2007: 전문가는 투수 kinematics로 스텝을, 첫 100 ms 비행으로 스윙 시각을 조정. 포심-체인지업 구분에 릴리스 전 정보가 기여. `batter_perception.py:judge`(tipped) | 투수 카드에 `tip_leak`(0..1, 구종별 팔 속도·손목 차이가 새는 정도, 반복성과 음의 상관)을 두고, 타자 `release_read`×`tip_leak` 확률로 prior_fb를 ±0.15 이동. 릴리스 위치 팁은 유지 |
| 12 | 중 | 실행 σ 하한이 초인적: 타이밍 σ 3 ms(timing 1.0), 수직 σ 6 mm | 페어 타구 타이밍 창 ±7~10 ms(Adair), 실험실 타이밍 SD 10~20 ms(추측, Gray 2002 계열). 수직 정확도 ±12 mm 이내가 강타 조건. `batter.py:BatterProfile.derived_execution` | timing σ = 18 − 10·timing (8~18 ms), vertical σ = 26 − 14·barrel_placement (12~26 mm), horizontal 유지. 검증: 시뮬 whiff/contact 비율이 리그 20~25 %/75 %에 맞도록 재보정 |
| 13 | 중 | boldness와 discipline이 같은 변수(추격 폭)를 움직여 독립성 상실. boldness가 배트 속도(+2 %)·언더컷까지 건드림 | 실측 지표는 Z-swing%(존 안 스윙)와 O-swing%(존 밖 스윙)로 분리 측정 가능. `batter.py:PerceptiveBatter.decide` (chase_scale ×(0.8 + 0.4·bold), bat_speed ×(1 + 0.04(bold − 0.5))) | boldness → p_zone(Z-swing)·take-to-learn만. chase_scale에서 boldness 항 제거. 배트 속도·언더컷 항은 launch_intent/power로 이관 |
| 14 | 중 | recognition·release_read가 tracking의 선형 함수라 지각 능력 3종이 사실상 1종. 문서(PLAYER_ATTRIBUTES §9)는 별개 능력으로 기술 | `player.py:derive_bat_traits`: recognition = 0.3 + 0.5·tracking + 0.2·vision, release_read = 0.2 + 0.6·tracking | 스킬 `pitch_recognition`(occlusion 테스트로 측정 가능)과 `cue_reading`을 별도 카드 필드로. tracking은 동적 시력·추적(각속도 임계)만 담당. 훈련 축 `tracking_drill`을 둘로 분리 |
| 15 | 중 | 존 지도(zone_map)가 부과 규칙. 코스별 강약을 lookup으로 곱해 넣으면 스윙 역학과 무관한 결과가 생기고, 같은 규칙을 측정하는 순환이 됨 | `batter.py:zone_multiplier` → 스윙 확률 ×(0.6 + 0.4·값), 배트 속도 ×(0.85 + 0.15·값). 어택각·높이·몸쪽 배럴 도달은 이미 path_control·attack_angle에 있음 | 기본은 1.0 고정, 스카우팅 표시(관측된 결과)로만 사용. 역학에서 나오게 하려면 배트 속도의 높이·안쪽 의존을 명시 모델로: v_bat ×(1 − 0.06·|z − z_pref|/0.3 − 0.05·max(0, inside_frac − 0.5)) 등 |
| 16 | 중 | 블로킹: 주자 시 원바운드 폭투 확률 0.35·(1 − 0.8·b) → 평균(0.5)에서 21 % | 원바운드 투구 중 뒤로 빠지는 비율은 대체로 한 자릿수 %(추측, BP 블로킹 런 계열). `docs/CATCHER.md §1`, 엔진 측 상수 | 0.12·(1 − 0.7·b) (0.5에서 7.8 %, 최상 3.6 %, 최하 12 %) |
| 17 | 중 | 타자북 pseudo-count k = 2~14. 관찰 0.9이면 k ≈ 3.4라 헛스윙 2~3회로 사전이 뒤집힘 | 타자 whiff/chase의 시즌 간 SD는 0.05~0.08(추측)이므로 베이즈 pseudo-count는 20~40 수준. `catcher.py:sign`(k_obs), `BatterBook._blend` | k = 10 + 25·(1 − obs). 게임 내 학습이 필요하면 '가중 최근성'(0.9 감쇠)로 |
| 18 | 중 | 터널 판정이 관대. 조기 분리 12 cm 허용, 터널 지점 9 m | Baseball Prospectus 터널 지점 23.8 ft(≈7.25 m, 접촉 ~167 ms 전), 평균 tunnel differential 약 1.5 in(≈4 cm)(추측). `catcher.py: TUNNEL_Y`, `tunnel_target` | TUNNEL_Y 7.3 m, early_sep ≤ 0.06 m, 보너스 (1 − early_sep/0.06). 타자 모델의 40 % 구간과 정합시키려면 판정 시점을 commit 시각(도달 − 0.15 s)으로 정의 |
| 19 | 중 | 팔꿈치 부하 지수를 산출하고 쓰지 않음. 측면 기울기는 손실만 있고 이득이 없음 | Solomito 2015: 측면 기울기 10°당 팔꿈치 varus 토크 +3.7 N·m, 구속 +0.4 m/s(≈ +1 %). `body.py:chain_efficiency`(elbow_load), `coaching.py:run_week`(injury_risk에 미반영) | gain += 0.01·(tilt − 30)/10 (범위 −20~45°에서), elbow_load 기존식 유지. 부상: injury_risk += 0.004·(elbow_load − 1)·(경기 투구수/100) 를 게임 루프에서 누적 |
| 20 | 중 | 나이 곡선 −1.2 %/년(27세 이후) ≈ −1.1 mph/년으로 과다. 문서 §4의 "33세 이후 −1.5 %"와도 다름 | 실측 노화: 30대 초반 포심 −0.3~0.5 mph/년(추측, FanGraphs 노화 곡선). `player.py:age_multiplier` | 28~32세 −0.4 %/년, 33세 이후 −0.9 %/년, 바닥 0.80 |
| 21 | 중 | 투구 간 구속 변동이 없음(회전 3 %, 축 σ, 릴리스 σ는 있음) | 같은 투수 포심 SD ≈ 1 mph(≈1.1 %)(추측). 타자 timing 학습의 난이도가 이 항에 좌우됨. `pitcher.py:spec_for` | mph ×(1 + N(0, 0.011·(1.2 − 0.4·repeatability))) |
| 22 | 중 | commit 이후 보정 폭이 큼: 접촉 80 ms 전까지 10 cm × reaction, 체크 스윙 0.75·gain | 스윙 개시 후 궤도 수정은 초기 50~100 ms에 한정, 체크 스윙 정지는 접촉 ~100 ms 이전에 시작해야 함(추측, Gray 2009 억제 모델·Katsumata 2007) | late_window 0.08 → 0.11 s, max_shift 0.10 → 0.05 m, 체크 스윙 확률 0.75 → 0.5·gain |
| 23 | 하 | 그립 악력 포화식의 단위가 임의(skill 0..100 vs "필요 35 + 0.8·(mph − 85)") | Kinoshita 2017: 검지·중지 각 ~97 N, 근최대 악력 사용, 힘 ∝ 구속. 악력-회전수 상관은 약함(추측) → 프로는 포화 구간이라는 설계는 정합. `body.py:spin_from_card` | 포화 설계 유지. 카드에 "필요 악력 대비 여유" 표시. 단위를 N으로 바꾸려면 need = 60 + 3.5·(mph − 85) N, grip_force 카드값 → 40~140 N 매핑 |
| 24 | 하 | 스플릿 ±0.15 recognition이 큼. 플래툰 효과는 wOBA 20~30 pt(추측) | `batter.py:effective_recognition` | ±0.08로 축소, 타이밍 σ에도 ±10 % 배분 |
| 25 | 하 | 포수 arm이 사인 선택에만 쓰이고 팝타임·도루 저지 확률이 없음 | 실측 팝타임 1.85~2.10 s. `catcher.py:sign` | pop_time = 2.10 − 0.25·arm, 도루 성공 확률 = σ((주자 도달 − 팝타임 − 투수 딜리버리 시간)/0.06) |
| 26 | 하 | 투수 카드 누락: 견제·주자 억제(delivery time), 수비, 구종별 grip_skill(문서는 구종별이라 하나 코드는 스칼라), 디셉션·템포 | `player.py: PITCH_SKILLS`, `docs/PLAYER_ATTRIBUTES.md §5` | grip_skill → dict[code], delivery_time_s(1.2~1.6), hold_runners(0..1) 추가 |
| 27 | 하 | reaction이 SKILL_DOMAIN "running"에 배정되어 타격 자질(learn·potential)이 아닌 주루 자질로 성장 | `player.py:SKILL_DOMAIN` | 타격용 `swing_adjust`(batting)와 주루용 `first_step`(running) 분리 |
| 28 | 하 | 70 % 구간 읽기가 `judge`에서 사실상 사용되지 않음(commit = 도달 − 0.12~0.18 s → 포심 64 %, 커브 ~69 %) | 비행 0.42 s(포심)/0.49 s(커브) 계산. `batter_perception.py: BINS`, `judge`(t_now) | 문서에 명시하거나 BINS를 (0.20, 0.35, 0.50, 0.62)로 조정 |
| 29 | 하 | 훈련 이득 크기: legs 1세션 ≈ +1.1점 → 시즌 26주 ≈ +2.4 mph, 문서 기준(+1~2 mph)보다 다소 큼. 미훈련 감쇠 0.25·(1 − R)/주 | `coaching.py:run_week`, `training.py: BASE_GAIN` | BASE_GAIN 1.6 → 1.2. 검증 테스트에 "하체 26주 → +1~2 mph" 상한 추가 |

---

## 3. 평가요소 적절성 판정

판정: 적절 / 과다(효과나 개수가 큼) / 부족(효과나 해상도 작음) / 누락. "측정"은 실제 데이터로 관측 가능한지, "독립"은 다른 항목과 겹치지 않는지입니다.

### 3.1 투수

| 항목 | 위치 | 측정 가능 | 독립 | 판정 | 비고 |
|---|---|---|---|---|---|
| 키·손가락 길이·속근·어깨 ER 상한·시력 (고정) | fixed | 부분(속근은 대리지표) | 예 | 적절 | 속근이 구속 상한을 단독 결정(84~100). 체중·팔 길이 항 없음 → 부족 |
| 어깨 ER ROM·손목 ROM·고관절 ROM·힘줄 강성 (반고정) | semi | 예(임상 측정) | 예 | 부족 | hip_rom·tendon_stiffness는 어디에도 쓰이지 않음. wrist_rom이 '회전 효율'로 가는 매핑은 근거 약함(추측) |
| 폼 abd·tilt·lean·stride·fwd | form | 예(모션캡처·Statcast 팔 각도) | 부분(abd·tilt가 팔 각도로 합쳐짐) | 적절 | lean 정의 통일 필요(#8). tilt 이득 항 누락(#19) |
| 하체 파워·코어 회전 | skills | 예(점프·메디신볼) | 아니오(이중 계산 #4) | 과다 | 하나의 사슬 경로로 통합 |
| 손목 속도·손가락 길이 → BU | skills/fixed | 예(BU 실측 18~30) | 예 | 적절 | 출력 BU 21~27 확인. 변화구 계수만 조정(#6) |
| 악력 → f_force | skills | 예(악력계) | 예 | 적절 | 포화 설계 타당. 단위 정리(#23) |
| 반복성 → 제구 σ·릴리스 σ | skills | 예(릴리스 SD, 미스 거리) | 예 | 적절 | 프로필 σ만 재설정(#7). 구속 σ 추가(#21) |
| 그립 숙련 → f_grip·그립 효율 | skills | 부분 | 예 | 부족 | 구종별이어야 함(#26). 새 구종 습득 경로 없음 |
| 스태미나 | skills | 예(투구수 대비 구속 유지) | 예 | 부족 | 경기 내 피로에 미연결(#5) |
| 집중·멘탈·배짱 | skills | 낮음 | 아니오(셋의 물리 자리가 σ 배율로 겹침) | 과다 | 셋을 하나(σ 상황 배율)로 합치거나 각각 고유 자리(집중=σ 상시, 멘탈=실점 후 회복, 배짱=존 공략 확률)를 코드로 구현 |
| 신뢰(trust_catcher)·스카우팅 정확도·공격성·feel_sigma | PitcherProfile | 낮음 | 예 | 적절 | 게임 층 성격 변수로 타당. 카드 필드에는 없음 → 카드 연결 시 mental 계열로 |
| 회전 효율 eff | profile | 예(Statcast active spin) | 예 | 적절 | 카드에서는 wrist_rom으로 유도(약한 근거) |
| 팔꿈치 부하·부상 | chain_efficiency / coaching | 예(varus 토크 추정) | 예 | 누락 | 산출만 하고 미사용(#19) |
| 견제·딜리버리 시간·수비·디셉션 | – | 예 | 예 | 누락 | #26 |

### 3.2 타자

| 항목 | 위치 | 측정 가능 | 독립 | 판정 | 비고 |
|---|---|---|---|---|---|
| tracking(시각 노이즈·가시 구간) | profile | 예(동적 시력·추적 검사) | 아니오(recognition·release_read를 종속시킴 #14) | 과다 | 각속도 임계로 재정의(#10) |
| recognition(구간 가중·2차 외삽 혼합) | profile | 예(occlusion 테스트) | 아니오 | 적절 | 별도 스킬로 독립(#14) |
| release_read | profile | 부분 | 아니오 | 부족 | 릴리스 전 단서 추가(#11) |
| discipline(추격 폭) | profile | 예(O-swing%) | 아니오(boldness와 겹침 #13) | 적절 | |
| boldness(존 스윙·take-to-learn) | profile | 예(Z-swing%, 초구 스윙률) | 아니오 | 과다 | 배트 속도·언더컷·추격 항 제거(#13) |
| composure(panic) | profile | 낮음 | 예 | 과다 | 크기 1/3로(#3) |
| reaction(늦은 보정·체크 스윙) | profile | 부분 | 부분(swing_quickness와 겹침) | 과다 | 보정 폭 축소(#22), 도메인 정정(#27) |
| guess_hitting(사전확률 날카로움) | profile | 낮음 | 예 | 적절 | Gray 2002의 카운트·직전 구속 기대효과와 정합 |
| zone_map | profile | 예(결과 히트맵) | 아니오(역학과 겹침) | 과다 | 부과 규칙(#15) |
| bat_speed | profile | 예(Statcast 평균 71.5 mph, 75+ fast) | 예 | 적절 | 25~37 m/s(56~83 mph) 범위 정합 |
| power → m_eff | profile | 예(EV) | 아니오(물리 위반) | 과다 | #2 |
| timing σ·barrel_placement σ·barrel_accuracy | profile | 부분(타점 분포) | 예 | 과다(하한) | #12 |
| swing_quickness → commit 0.12~0.18 s | profile | 예(스윙 시간 실측 140~170 ms) | 부분(reaction) | 적절 | |
| path_control·attack_angle·undercut_intent | profile | 예(Statcast attack angle) | 예 | 적절 | undercut 8 mm 기본은 보수적(HR 최적 ~25 mm) |
| spray_control | profile | 예(pull%) | 예 | 적절 | |
| stamina·focus·game_sense(feel) | profile | 낮음 | 부분 | 적절 | feel 갱신 계수는 가정값, 검증 항목 필요 |
| split_vs_L/R | profile | 예(플래툰 스플릿) | 예 | 과다 | #24 |
| bunt_skill·bat_mass | profile | 예 | 예 | 적절 | |
| 학습 속도(attention·군집 갱신률) | memory | 낮음 | 예 | 적절 | 갱신률 0.35/0.2는 가정값 |
| 존 크기(키 기준 0.27~0.565h) | derive | 예 | 예 | 적절 | |
| 시야·투수 손 방향 별 릴리스 인지(좌완 각도 차) | – | 예 | 예 | 누락 | split의 물리적 근거로 릴리스 x 위치 차이를 지각에 넣으면 split 상수를 줄일 수 있음 |

### 3.3 포수

| 항목 | 측정 가능 | 독립 | 판정 | 비고 |
|---|---|---|---|---|
| framing(±2.5 cm, 경계 선호) | 예(Shadow zone 콜스트라이크율 33~52 %, 격차 18.7 pp) | 예 | 적절 | 극단 격차 20 pp 주장과 실측 정합. 분포는 ±1 SD ≈ ±4 pp로 좁게 |
| blocking | 예(블로킹 런) | 예 | 과다 | 기저 확률 축소(#16) |
| arm | 예(팝타임) | 예 | 부족 | 팝타임·도루 확률 누락(#25) |
| game_iq·umpire_read·sequencing | 낮음 | 부분(game_iq가 여러 항의 배율) | 적절 | sequencing 터널 문턱 조정(#18) |
| observation(타자북 k) | 낮음 | 예 | 과다 | k 하한(#17) |
| scouting_accuracy | 부분 | 예 | 적절 | 투수 0.6 vs 포수 0.85의 비대칭은 정보 경계 설계로 타당 |
| pitcher_weight·rapport·composure | 낮음 | 예 | 적절 | composure 노이즈 0.12 + 0.5·panic은 타자 쪽과 같은 이유로 0.2·panic 권장 |
| 타자북 가족 해상도(FB/BR 2종) | 예 | – | 부족 | 최소 3종(FB / BB / OS). 체인지업과 슬라이더의 약점은 다름 |
| 포수 수비(송구 정확도·타구 처리)·타격 | – | – | 누락 | 매니지먼트 게임 범위에서는 필요 |

---

## 4. 우선 수정 5건

1. **회전축 규칙 계수(#1)** — `build_spec`의 (90 − arm_angle)에 k ≈ 0.6을 곱하고 그립 pron을 재조정합니다. 리그 중앙 팔 각도(40°)에서 포심 축 30°(1:00), 사이드암(10°)에서 ~75~90°가 나오는지 Statcast spin-direction과 대조합니다. 구종 움직임·터널 표·타자 학습이 모두 이 축에 걸려 있어 파급이 가장 큽니다.
2. **카드→물리 이중 계산 제거와 경기 내 피로의 스태미나 연결(#4, #5)** — 피로·코어 항을 단일 경로로 정리하고, free_pitches = 40 + 40·stamina, 매끄러운 손실식, 워밍업 15구를 넣습니다. 훈련·코칭 시스템의 효과가 이 경로를 통해서만 물리에 닿으므로 먼저 바로잡아야 합니다.
3. **타자 힘의 물리 자리 이전(#2)과 실행 σ 하한(#12)** — m_eff는 배트 사양으로만, power는 배트 속도 상한·배트 질량 선택으로 이동합니다. 타이밍 σ 8~18 ms, 수직 σ 12~26 mm로 재설정하고 whiff/contact 비율을 리그값으로 재보정합니다.
4. **부담·침착성 효과 축소(#3)와 boldness/discipline 분리(#13)** — pressure_index에서 2스트라이크 항을 빼고 계수를 1/3로 줄입니다. boldness는 Z-swing 계열, discipline은 O-swing 계열로만 작동하게 하여 스카우팅 지표와 1:1로 대응시킵니다.
5. **시각 가시성의 각속도 기반 재정의(#10)와 릴리스 전 단서(#11)** — visibility를 추적 각속도 임계(70~130°/s)로 바꾸어 전문가가 비행 85~90 %까지 보게 하고, 늦은 정보의 무용성은 commit 마감이 담당하게 합니다. 투수 `tip_leak`와 타자 `cue_reading`을 추가해 Ranganathan & Carlton(2007)의 릴리스 전 단서 효과를 넣습니다.

---

## 참고 출처
- Solomito MJ et al., Lateral Trunk Lean in Pitchers Affects Both Ball Velocity and Upper Extremity Joint Moments, AJSM 2015 — https://www.researchgate.net/publication/273467556_Lateral_Trunk_Lean_in_Pitchers_Affects_Both_Ball_Velocity_and_Upper_Extremity_Joint_Moments
- Bahill AT, LaRitz T, Why Can't Batters Keep Their Eyes on the Ball?, American Scientist 1984 — http://sysengr.engr.arizona.edu/publishedPapers/EyeOnBall.pdf ; 정리: https://drivelinebaseball.com/blogs/blog/batters-see-ball-review-gaze-research-batting
- Kishita Y et al., Eye and Head Movements of Elite Baseball Players in Real Batting, Front. Sports Act. Living 2020 — https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2020.00003/full
- Ranganathan R, Carlton LG, Perception-Action Coupling and Anticipatory Performance in Baseball Batting, J Motor Behav 2007 — https://pubmed.ncbi.nlm.nih.gov/17827114/
- Gray R, Behavior of College Baseball Players in a Virtual Batting Task, JEP:HPP 2002 — https://pubmed.ncbi.nlm.nih.gov/12421060/
- Kinoshita H et al., Finger forces in fastball baseball pitching, Hum Mov Sci 2017 — https://www.sciencedirect.com/science/article/abs/pii/S0167945716303037
- MLB.com, New Statcast tool measures pitch spin direction (RHP 포심 평균 211°) — https://www.mlb.com/news/new-statcast-tool-measures-pitch-spin-direction ; 팔 각도-스핀 방향 상관 0.75: https://rfrey22.medium.com/what-spin-direction-tells-us-from-mlb-data-3632c772c22e
- Baseball Savant Bat Tracking (2024 평균 71.5 mph, fast swing 75+) — https://baseballsavant.mlb.com/leaderboard/bat-tracking ; https://www.espn.com/mlb/story/_/id/40120458/mlb-statcast-bat-tracking-data-giancarlo-stanton-luis-arraez
- 제구 미스 거리 12.5~13 in — https://blogs.fangraphs.com/why-we-still-dont-have-a-great-command-metric/ ; https://www.drivelinebaseball.com/2026/02/the-interaction-of-biomechanics-and-command/
- 경기 내 구속 변화(20구 정점, 최대 −2.3 mph) — https://www.beyondtheboxscore.com/2013/5/16/4334912/how-when-does-velocity-change-during-start-game-pitchfx-sabermetrics ; https://fantasy.fangraphs.com/in-game-velocity-changes-when-fatigue-attacks/
- 프레이밍 Shadow zone 33.0~51.7 %(격차 18.7 pp) — https://sportsanalytics.studentorg.berkeley.edu/articles/framing-the-zone.html ; https://baseballsavant.mlb.com/leaderboard/catcher-framing
- Nathan AM, Dynamics of the baseball–bat collision, Am. J. Phys. 68, 979 (2000); Nathan 2003 BBCOR — 손 효과 무시 가능(파일 내 인용과 동일 계열)
- Diffendaffer/Fleisig, The Clinician's Guide to Baseball Pitching Biomechanics, Sports Health 2023; Escamilla 2018·PMC10601404 — `1_Reference/arm_angle_research.md`에 인용된 값을 그대로 사용
