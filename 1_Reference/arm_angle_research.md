# 실제 투수 팔 각도 조사 (2026-09-05)

## 결론
MLB 투수의 팔 각도(Statcast arm angle, 0°=수평 사이드암, 90°=완전 오버핸드)는 중앙값 39.6°입니다. 5~95% 구간은 17~57°이며, 70°를 넘는 투수는 사실상 없습니다. 팔 각도는 어깨 외전 각이 아니라 몸통 측면 기울기가 만듭니다. 어깨 외전은 슬롯과 무관하게 84~95°로 거의 일정하고, 오버핸드일수록 몸통을 글러브 쪽으로 더 기울입니다(34° vs 사이드암 24°). v0.4 프로필 A·E(유효 슬롯 80~90°, 릴리스 높이 2.1 m)는 실존하지 않는 조합이므로 수정이 필요합니다.

## 1. Statcast 2024 실측 분포 (Baseball Savant, 712명 ≥100구, 투구수 가중)
데이터: `statcast_arm_angle_2024/pitcher_arm_angles_2024.csv`, 분석 스크립트 `analyze_arm_angles.py`, 출력 `arm_angle_summary.txt`.

| 지표 | 5% | 25% | 50% | 75% | 95% | 평균 |
|---|---|---|---|---|---|---|
| 팔 각도 (°) | 17.1 | 31.2 | 39.6 | 45.7 | 56.6 | 38.1 (SD 12.5) |
| 릴리스 높이 (m) | 1.52 | 1.68 | 1.76 | 1.85 | 1.97 | 1.75 |
| 릴리스 좌우 \|x\| (m) | 0.31 | 0.47 | 0.56 | 0.67 | 0.83 | – |
| 어깨 높이 (m) | 1.20 | 1.27 | 1.33 | 1.38 | 1.46 | 1.33 |
| 어깨→공 거리 (m) | 0.64 | 0.68 | 0.71 | 0.73 | 0.76 | 0.70 |

| 슬롯 구간 | 투수 수 | 투구 비중 | 평균 릴리스 높이 | 평균 \|x\| |
|---|---|---|---|---|
| 서브마린/언더 (<0°) | 8 | 0.9% | 1.03 m | 0.94 m |
| 사이드암 (0~20°) | 46 | 5.4% | 1.52 m | 0.84 m |
| 로우 쓰리쿼터 (20~35°) | 207 | 27.8% | 1.67 m | 0.70 m |
| 쓰리쿼터 (35~50°) | 354 | 52.2% | 1.80 m | 0.52 m |
| 하이 쓰리쿼터 (50~65°) | 93 | 13.0% | 1.89 m | 0.34 m |
| 오버핸드 (>65°) | 4 | 0.7% | 2.05 m | 0.13 m |

회귀: 릴리스 높이(m) ≈ 1.377 + 0.0099 × 팔 각도(°), 상관 0.81. 릴리스 좌우(m) ≈ 0.985 − 0.0110 × 팔 각도(°).
극단값: Tyler Rogers −64° (높이 0.34 m), Tim Hill −20°, Chris Sale 12°, Josh Hader 35°, José Alvarado 65°, Chris Flexen 70° (최고).
리그 평균 참고치(MLB.com): 팔 각도 37°, 수직 릴리스 5.8 ft(1.77 m). 익스텐션은 키의 약 1.04배(6′3″ 투수 6.4 ft ≈ 1.95 m), 최대 1.15~1.17배(Strider·Peralta).

## 2. 생체역학 문헌값
Escamilla·Fleisig 등, 프로 288명 (PMC10601404, 2023). 팔 슬롯을 수직 기준 각으로 정의(클수록 사이드암). 수평 기준으로 환산하면 오버핸드군 46°, 쓰리쿼터군 32°, 사이드암군 15°.

| 릴리스 시 변수 | 오버핸드군 | 쓰리쿼터군 | 사이드암군 |
|---|---|---|---|
| 어깨 외전 | 95±7° | 91±7° | 84±9° |
| 몸통 측면 기울기 | 34±8° | 30±9° | 24±11° |
| 몸통 전방 기울기 | 7±11° | 10±11° | 15±12° |
| 팔꿈치 굴곡 | 30±6° | 32±5° | 35±6° |
| 스트라이드 (키 대비) | 76±9% | 76±5% | 75±5% |

Fleisig 임상 가이드(2023)의 앞발 착지 시 기준값은 다음과 같습니다. 팔꿈치 90° 굴곡, 어깨 외전 약 90°, 외회전 45°, 스트라이드 83±4% 키. 앞무릎은 착지 45±9°에서 릴리스 30°로 펴집니다. 착지 이후 순서: 앞무릎 신전 → 골반 회전 → 상체 회전 → 팔꿈치 신전 → 어깨 내회전. 스트라이드 10% 증가당 구속 0.9 m/s 증가(관찰 연구); 스트라이드 80% 이상에서 팔꿈치 토크 증가 없이 구속 상승.

핵심 관계: 팔 각도(수평 기준) ≈ (어깨 외전 − 90°) + 몸통 측면 기울기 + 팔꿈치 굴곡 기여(약 5°). 프로 데이터로 검산하면 (95−90)+34=39 vs 실측 46, (91−90)+30=31 vs 32, (84−90)+24=18 vs 15로 잘 맞습니다.

## 3. v0.4 모델과의 비교 (`statcast_arm_angle_2024/model_check_v04.py`)

| 프로필 | v0.4 유효 슬롯 | 릴리스 높이 | \|x\| | 익스텐션 | 실측 대비 판정 |
|---|---|---|---|---|---|
| A 오버핸드 파워 | 90° | 2.15 m | 0.04 m | 1.85 m | 실존 최대 70°·2.05 m 초과. 좌우 0.04 m는 불가능(어깨 반폭만 0.2 m) |
| B 쓰리쿼터 표준 | 60° | 2.03 m | 0.46 m | 1.54 m | "표준"이라면 40°·1.76 m여야 함. 익스텐션 0.4 m 부족 |
| C 사이드암 기교 | 7° | 1.40 m | 0.94 m | 1.45 m | 각도·높이는 사이드암 평균(≈10°, 1.52 m)과 근사. 익스텐션 부족 |
| D 좌완 언더핸드 | −35° | 0.77 m | 0.88 m | 1.40 m | 실존 범위(Rogers −64°, Hill −20°) 안. 높이 0.77은 Cimber(−23°, 0.73)와 유사 |
| E 좌완 하이슬롯 | 80° | 2.14 m | 0.12 m | 1.63 m | 실존 최대 초과. 65°·1.95 m 수준으로 낮춰야 함 |

원인 두 가지. (1) v0.4는 '어깨 외전 각' 슬라이더를 슬롯 그 자체로 쓰고 측면 기울기를 더해 80~90°가 나옵니다. 실제로는 외전이 90° 근처에 고정되고 슬롯은 측면 기울기가 만듭니다. (2) 익스텐션이 골반 전진 0.60·스트라이드 + 팔 전방 각으로만 결정되어 실측(키의 1.04배)보다 0.3~0.5 m 짧습니다. 몸통 전방 기울기가 어깨를 앞으로 보내는 항이 부족합니다.

## 4. 모델 수정안 (v0.5 반영 예정)
- 슬롯 정의를 바꿉니다: 유효 팔 각도 = (어깨 외전 − 90°) + 몸통 측면 기울기 + 5°(팔꿈치). 어깨 외전 슬라이더 범위 75~105°, 기본 90°.
- 프로필 재설정. 표의 값은 (어깨 외전, 측면 기울기) → 팔 각도, 목표 릴리스 높이입니다.

| 프로필 | 외전 | 측면 기울기 | 팔 각도 | 목표 릴리스 높이 |
|---|---|---|---|---|
| A 오버핸드 파워 | 95° | 35° | 45° | 1.85 m |
| B 쓰리쿼터 표준 | 91° | 30° | 36° | 1.76 m |
| C 사이드암 | 84° | 12° | 11° | 1.52 m |
| D 언더핸드 | 80° | −10° | −15° | 1.05 m |
| E 하이슬롯 | 98° | 40° | 53° | 1.92 m |
- 익스텐션. 몸통 전방 기울기 항(Ltr·sin(lean))은 이미 있습니다. 골반 전진 계수를 0.60→0.75·스트라이드로, 팔 전방 각 기본값을 22°→35°로 올려 키의 1.0~1.05배를 맞춥니다.
- 릴리스 높이 검산식: Statcast 회귀 1.377 + 0.0099×팔 각도를 모델 출력과 비교하는 자동 검사를 둡니다.

## 출처
- Baseball Savant Arm Angle Leaderboard 2024 (CSV 미러: huggingface TJStatsApps/pitch_plot_select_mlb) — https://baseballsavant.mlb.com/leaderboard/pitcher-arm-angles?season=2024
- MLB.com, "The range of pitcher arm angles in the 2024 postseason" — https://www.mlb.com/news/the-range-of-pitcher-arm-angles-in-the-2024-mlb-postseason
- MLB.com, "How arm slot and arm angle affect pitches" (리그 평균 37°, 5.8 ft) — https://www.mlb.com/news/how-arm-slot-and-arm-angle-affect-pitches
- Kinematic and Kinetic Comparisons of Arm Slot Position Between High School and Professional Pitchers, PMC10601404 — https://pmc.ncbi.nlm.nih.gov/articles/PMC10601404/
- Diffendaffer, Fleisig et al., The Clinician's Guide to Baseball Pitching Biomechanics, Sports Health 2023 — https://journals.sagepub.com/doi/10.1177/19417381221078537
- Escamilla et al., Differences Among Overhand, Three-Quarter, and Sidearm Pitching Biomechanics in Professional Baseball Players (2018) — https://www.researchgate.net/publication/324507653
- RPP Baseball, Release Extension (키 대비 1.04배) — https://rocklandpeakperformance.com/extension-at-release-why-its-important-and-how-to-maximize-it/
- SABR, The Effect of Stride Length on Pitched Ball Velocity — https://sabr.org/journal/article/the-effect-of-stride-length-on-pitched-ball-velocity/
