# 05. 블라인드 테스트 사용자 감사 — bbsim v1.0.0 승부 플랫폼

- 작성일: 2026-09-06
- 역할: 개발 문서(COMMAND_LOG·DESIGN_SUMMARY·아카이브·recent_report)를 읽지 않은 첫 사용자 시점
- 작업 로그: `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/tester/` (api_test.py, direct_run.py, *.log)

## 결론
엔진 자체(물리·결정성·속도·테스트 35건)는 안정적이지만, 웹 페이지는 기본 상태로 "승부 시작"을 누르면 `core` 입력란이 비어 있어 서버가 HTTP 500을 반환하므로 그대로는 플레이가 불가능합니다. 필드 뷰의 타구 궤적은 y축 부호가 뒤집혀 페어 타구가 캔버스 밖으로 그려지고, 손목속도·그립숙련 입력 범위(0~1)가 엔진 스케일(0~100)과 어긋납니다. 야구 팬 시점에서는 사구(HBP) 부재, 싱커 헛스윙률이 가장 높은 역전 현상, 초구 99.5% 패스트볼, 구속 편차 0.6 mph 등이 눈에 띕니다.

## 테스트 범위
| 항목 | 수행 내용 |
|---|---|
| 서버 API | `tools/serve_game.py --port 8791` 기동 후 GET /api/profiles, POST /api/simulate 45종 페이로드(기본, 프로필 A~E, 투수 극값 13종, 타자 극값 5종, 포수 0/1, 라인업 0·1·15명, 9이닝, 시드 1~5 반복, 빈 본문, 비정상 JSON, null 필드, 문자열 필드, 미지 프로필/구종, hand X, 키 극값) |
| 일관성 검사 | 이벤트별 outs_before/after·runs_before/after 연쇄, 카운트 범위, 타순 회전, 결정성(같은 시드 2회 비교) |
| 웹 페이지 | `web/game_v1.0_0906.html` 정적 분석(필드 참조·단위·라벨·애니메이션·재생 제어), node 미보유 |
| CLI | gate_league --n 60/300, gate_movement, validate_batted_ball, run_pitch --help·무인자, tests 8파일 전부 |
| 엔진 직접 호출 | HalfInning으로 프로필 A 하프이닝 투구별 출력 + 투수 B 60경기×3이닝 통계(구종별 헛스윙·예측오차·구속 산포·초구·3-0·연속 구종·타순별) |

## 발견 목록
| # | 심각도 | 현상 | 재현 방법 | 근거 |
|---|---|---|---|---|
| 1 | 상 | 페이지 기본 상태에서 승부 시작 시 HTTP 500. 프로필 JSON에 `core` 키가 없어 코어 입력란이 비고, `parseFloat("")`=NaN → JSON null → 서버 `replace(base, core=None)` → numpy clip TypeError. 코어를 손으로 채우기 전엔 플레이 불가 | POST `{"pitcher":{"profile":"B","mph":94,"cmd":0.216,"core":null,"abd":92,"tilt":30,"lean":30,"wrist_speed":60,"grip_force":60,"grip_skill":60},"lineup":[...9명],"seed":1,"innings":1}` → 500 `TypeError("'>=' not supported between instances of 'NoneType' and 'float'")` | web/game_v1.0_0906.html:119,129 · tools/serve_game.py:66-70 · /api/profiles 응답에 core 없음 |
| 2 | 상 | 필드 뷰 타구 궤적 y 부호 반전. `P=q=>[hx+q[0]*S, hy-(-q[1])*S]` = `hy+y*S` 이므로 외야(+y) 타구는 홈 아래 캔버스 밖으로, 뒤로 넘어간 파울(-y)은 외야 쪽으로 그려짐 | 기본 페이로드 안타의 batted.flight.xyz 마지막 점 `[-12.8, 83.0, -0.02]` (y=+83 m) | web/game_v1.0_0906.html:166 · pitching_params.json notes "+y toward pitcher" |
| 3 | 상 | 손목속도·그립숙련 입력이 `min=0 max=1 step=0.05`인데 엔진은 0~100 스케일(프로필 값 60~85). 사용자가 0.8을 넣으면 0.8/100으로 계산됨 | `{"pitcher":{"profile":"B","wrist_speed":0.8},"seed":4,"innings":2}` FF 평균 2204 rpm → 1909 rpm(0.8 입력) | web:61,63 · bbsim/agents/pitcher.py:125 · bbsim/physics/body.py:210,213 |
| 4 | 상 | 사구(HBP) 모델 부재. 타자 몸 위치(|x|>0.45 m, 존 높이)로 오는 공 185구 중 사구 0, cmd=0.6 극값에선 플레이트 x ±3.6 m 공도 전부 "ball" | direct_run.py (투수 B 60×3이닝) / `{"pitcher":{"profile":"B","cmd":0.6},"innings":2}` 594구, plate_xz x 범위 [-3.57, 3.61] | bbsim/engine/plate_appearance.py:174-185 · bbsim/ 에 hbp 문자열 없음 |
| 5 | 상 | 프로필 A·D 볼넷률 약 50%. A: 24 PA 중 볼넷 12, 볼 71/122구(58%); D: 22 PA 중 11. 9이닝 단일 투수는 45 PA 중 볼넷 16, fatigue 1.5, σ ×1.6 | `{"pitcher":{"profile":"A"},"innings":3,"seed":3}`, `{"innings":9,"seed":7}` | api_test.log · pitcher.py:118,150 · profiles cmd 0.252/0.234 |
| 6 | 중 | 폭투 득점이 PA 이벤트 `runs_before`에 반영되지 않음(폭투 처리를 `ev` 생성 후에 적용). 페이지 득점판(line 141)이 해당 타석 동안 1점 적게 표시 | `{"pitcher":{"profile":"A"},"innings":3,"seed":3}` → 3회 "runs_before 0 != tracked 1 (walk)" 등 총 6개 페이로드에서 검출 | bbsim/engine/inning.py:71-78,130 · web:141 |
| 7 | 중 | 폭투 주자 진루가 타석 종료 후 일괄 적용되어(발생 시점 무관) 같은 타석의 후속 투구에서 베이스 표시가 실제와 어긋남. 폭투는 타자 홈런·삼진과 무관하게 항상 사전 적용 | 위 6과 동일 페이로드, `wild_pitch` 이벤트가 PA 이벤트 앞에 삽입됨 | inning.py:73-78 |
| 8 | 중 | 재생 제어: 마지막 투구에서 `show(cur+1)`이 클램프되어 마지막 투구를 무한 반복 재생, 버튼은 "⏸ 정지" 고정. 승부 시작 직후 자동 재생 시작 | 페이지에서 1이닝 재생 후 끝까지 대기 | web:139,148,134 |
| 9 | 중 | 비정상 JSON POST 시 `json.loads`가 try 밖이라 스레드 예외 → 응답 없이 연결 종료(HTTP None). 미지 프로필/구종, 문자열 seed·mph는 500과 전체 traceback을 클라이언트에 노출 | raw body `{not json` → RemoteDisconnected; `{"pitcher":{"profile":"Z"}}` → KeyError('Z'); `{"seed":"abc"}` → ValueError | serve_game.py:135-141 · serve.log traceback |
| 10 | 중 | 싱커 헛스윙률이 전 구종 최고(30~47%), 타자 예측 z 오차 −4.5~−6.5 cm로 체계적 편향(싱커를 실제보다 높게 예측). CH 12~17%, SL 18~20%로 패스트볼(18~20%)보다 낮음 — MLB(SI ~15, SL ~35, CH ~30)와 역전 | `python3 tools/gate_league.py --n 300` whiff by pitch; direct_run.py | gate_league300.log · direct_run.log |
| 11 | 중 | 초구 99.5% 패스트볼(FF 456·SI 308·CH 3·SL 1 / 768 PA). 실제 리그 ~60% | direct_run.py | bbsim/agents/intent.py count_prior (추측: 0-0 패스트볼 사전확률 과대) |
| 12 | 중 | 구속이 구종별 상수에 가까움(SI 표준편차 0.56 mph, 매 싱커 91.9/93.7, 직구 92.8/94.6). SL과 CH가 동일 구속(spd 0.9, 83.5/85.2) | direct_run.log 구종별 mph 범위 | pitcher.py:123 (mph에 난수 없음) · pitching_params grips spd |
| 13 | 중 | 기본 타자 홈런율 0.3~1.3%(60×3이닝 768 PA 홈런 2, 2루타 51), 9이닝 환산 3.45점. gate 결과가 n에 따라 8/18(n=60)↔10/18(n=300)로 흔들림 | `gate_league.py --n 60` 8/18, `--n 300` 10/18 | gate_league.log · gate_league300.log · direct_run.log |
| 14 | 중 | 필드 뷰 펜스가 반지름 100 m 원호 고정인데 라벨은 "펜스 100~120 m", 엔진 Park는 라인 100/중앙 122 m. 중앙 110 m 타구가 펜스 밖으로 보이면서 "out" | web:163-165 · bbsim/engine/outcome.py:22-30 | 코드 대조 |
| 15 | 중 | API에서 라인업 이름 생략 시 모든 타자 이름 "B" → 포수 타자북(`books[batter_id]`)과 투수 기억이 9명을 한 명으로 합산, 이벤트 `batter` 전부 "B" | `{"innings":9,"seed":7}` pitches[*].batter == "B" | plate_appearance.py:116 · bbsim/agents/catcher.py:143-147 · batter.py:28 |
| 16 | 중 | `scout_pitcher`·`begin_game`·`learn_pitcher`가 경기 첫 타자에게만 호출됨(new_game이 첫 PA에만 True). 2~9번 타자는 투수 사전 스카우팅 없이 기본 군집으로 시작 (추측: 타순별 K% 24 vs 13~21로 차이 크지 않음) | direct_run.py 타순별 통계 | plate_appearance.py:111-120 · inning.py:65-66 |
| 17 | 중 | 라벨 혼동: `tracking`→"타구판단"(실제는 투구 시각 추적, 타구가 아님), `swing_quickness`→"스윙속도"와 `bat_speed`→"배트 m/s"가 나란히 있어 두 속도로 읽힘, 로그의 존 "tunnel"(FF@tunnel)은 위치가 아님, "제구 σ m" 0.216의 의미 미설명, 코어 칸 공란 | 페이지 라인업 표 헤더 | web:116 · docs/PLAYER_ATTRIBUTES.md:129 |
| 18 | 중 | 플레이 로그에 폭투 이벤트가 표시되지 않음(buildLog가 `type!="pa"`를 건너뜀). 병살·희생플라이는 표기되나 폭투로 난 점수는 어디서도 안 보임 | web:137 | 코드 대조 |
| 19 | 하 | 손 값 검증 없음: 타자 `hand:"X"`, 투수 `hand:"X"` 모두 200. 투수 X는 좌완으로 처리(릴리스 x +0.512, R은 −0.517) | `{"pitcher":{"profile":"B","hand":"X"}}`, `{"lineup":[{"hand":"X"}]*9}` | plate_appearance.py:198 `startswith("R")` |
| 20 | 하 | `innings` 0·음수 허용 → 빈 결과 반환, 페이지는 `DATA.pitches[0]` undefined로 예외. 키 0.5 m 투수·2.5 m 타자·bat_mass 0·seed 2^40 모두 무검증 통과 | `{"innings":0}` → pitches [] | serve_game.py:73 · web:139 |
| 21 | 하 | `bat_speed` 45 m/s → 타구 134.8 mph(실측 최고 ~122). 상한 없음 | `{"lineup":[{"bat_speed":45}]*9,"innings":2}` | api_test.log |
| 22 | 하 | 땅볼 아웃 시 1루 주자만 있으면 병살(40%) 아니면 1루 잔류(야수 선택·진루 없음). 20구 초과 "unresolved"는 조용히 아웃 처리 | inning.py:94-108,128 | 코드 대조 |
| 23 | 하 | `examples/run_pitch.py`를 인자 없이 실행하면 `3_recent_report/2026-09-05_v0.1_mvp/`를 새로 만들어 PNG 6장+CSV를 씀(보고 폴더 오염, 이번 테스트로 실제 생성됨 — 삭제는 사용자 판단 요청). `--help`에 --out/--hand 설명 없음 | `cd /tmp && python3 examples/run_pitch.py` | run_pitch_help.log · 폴더 생성 시각 11:07 |
| 24 | 하 | summary `fatigue` 1.5(0~1.5 스케일 미설명), 한 이닝 594구도 투수 교체·콜드게임 없이 진행. 9이닝 옵션이 있으나 불펜 개념 없음 | `{"pitcher":{"profile":"B","cmd":0.6},"innings":2}` | pitcher.py:118 · web:79 |
| 25 | 하 | web:164 크기 0 `strokeRect` 무의미 코드, `chain.realized` 키 부재(velocity_mult로 대체 표기), 프로필 E 레퍼토리 CT가 gate_movement 표에 없음 | `/api/simulate` summary.chain 키 목록 | web:134,164 · gate_movement.log |

## 좋았던 점
- 같은 시드 5종 2회 반복 전부 동일(결정성), 3이닝 0.4~0.9 s, 9이닝 1.4 s로 빠릅니다.
- outs/runs 연쇄·타순 회전·볼넷 밀어내기·병살·희생플라이 부기가 폭투 외에는 전부 일치했습니다.
- 서버 예외를 JSON으로 페이지에 전달하고, 투구마다 포수 사인 이유("이 타자, 변화구에 헛스윙 41%", 터널링 분리 cm)가 한국어로 붙어 배터리 판단을 따라가기 좋습니다.
- 타구 물리 검증표(EV≈0.2v_pitch+1.2v_bat, 100 mph/28° → 125 m)가 Nathan·Statcast 기준과 맞고, gate_movement 18/18 PASS, 테스트 8파일 35건 전부 PASS입니다.
- 극값 입력(구속 60/105, cmd 0.02, abd 40/140, 타자 전부 0/1, 포수 0/1, 라인업 1·15명)에도 서버가 죽지 않았습니다.

## 권고 우선순위 5건
1. (#1) 서버 `build_pitcher`에서 `None`/NaN 필드를 기본값으로 대체하고, 페이지는 프로필에 없는 필드(core)를 0.7로 채워 기본 상태에서 바로 플레이되게 할 것.
2. (#2, #14) 필드 뷰 `hy - q[1]*S`로 부호 수정, 펜스는 Park.fence_distance 형태(라인 100/중앙 122)로 그릴 것.
3. (#3, #17) 손목속도·그립숙련 입력을 0~100으로 맞추고, "타구판단"→"투구추적", "스윙속도"→"스윙 간결성" 등 라벨을 엔진 의미와 일치시킬 것.
4. (#10, #11, #12) 싱커 예측 z 편향(−5 cm) 보정, 초구 구종 사전확률 완화, 투구별 구속 난수(σ≈1 mph)와 SL/CH 구속 분리.
5. (#4, #6, #7, #9) 사구 판정 추가, 폭투를 투구 시점에 주자 상태에 반영하고 `runs_before` 정합 유지, `json.loads`를 try 안으로 옮겨 400 응답.
