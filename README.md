# BB_simulator — 물리 기반 야구 시뮬레이션 게임 엔진

웹앱(PWA): https://mhparkunist-del.github.io/BB_simulator/web/app/ · 저장소: https://github.com/mhparkunist-del/BB_simulator


- 생성일: 2026-09-05
- 위치: /home/mhpark/취미/2_BB_simulator
- 목적: Football Manager식 구단·선수 관리 위에, 실제 역학(투구 궤적·배트-공 충돌·타구 비행)과
  독립 에이전트(투수·포수·타자)로 경기를 시뮬레이션하는 야구 게임. 코어 엔진은 상품화를 전제로 분리.

## 설계 요건 (2026-09-05 사용자 지시)
1. 공 궤적과 타격 반발이 역학을 반영하고 시각화될 것 (회전수·배트 속도·접촉 위치 → 타구 각도).
2. 타자·투수·포수가 독립 에이전트일 것. 타자는 구종·회전을 모르고 자기 시선에서 본 공의 위치만으로 판단.
3. 재사용 가능한 모듈·버전 분리. 상품화 대상(코어)과 프로토타입(예제) 구분.

## 구조
```
2_BB_simulator/
├── bbsim/                 코어 엔진 패키지 (상품화 후보, numpy만 의존)
│   ├── data/              pitching_params.json (그립·인체·회전·프로필 단일 소스, 뷰어와 공용)
│   ├── physics/           공 비행(항력·마그누스·실밥 효과·감쇠·환경)·인체 사슬(body.py)·충돌·투구 생성
│   ├── agents/            투수 의도·포수 사인·공통 채점(intent.py)·타자 판단(batter_perception.py, PerceptiveBatter)·정보 경계
│   ├── engine/            타석 오케스트레이션·심판·타구 비행·결과 모델(placeholder)
│   ├── viz/               matplotlib 렌더러 (선택 의존)
│   └── game/              게임 층: 선수 카드·자질·산출식, 훈련 카탈로그, 코칭 스태프 (v0.2.0)
├── web/                   HTML 뷰어 (templates/ + tools/build_viewer.py 로 JSON 주입 빌드, 버전 파일명)
├── tools/                 build_viewer.py
├── examples/              보고서 생성 스크립트 (비배포)
├── tests/                 물리 11건 + 에이전트 4건 + 코칭 6건 + 인체·의도 14건 + 타자 판단 7건 + 타자 능력치 7건 + 타자 전체 8건 + 포수 6건
├── docs/                  ARCHITECTURE.md, PHYSICS.md, COMMAND_LOG.md(지시 기록부), PLAYER_ATTRIBUTES.md(능력치·훈련·자질), COACHING.md(코칭 스태프), INTENT.md(투수·포수 의도), CATCHER.md(포수 시스템), BATTER_JUDGMENT.md(타자 판단), DESIGN_SUMMARY.md(전체 정리)
├── pyproject.toml         pip install -e . 가능
├── 1_Reference/           arm_angle_research.md(팔 각도 조사, 09-05), statcast_arm_angle_2024/(CSV+분석 스크립트)
├── 2_Archieve/  3_recent_report/
```

## 실행
```
cd /home/mhpark/취미/2_BB_simulator
python3 tests/test_physics.py && python3 tests/test_agents.py && python3 tests/test_coaching.py && python3 tests/test_body_intent.py
python3 tools/build_viewer.py --version v0.8.1_0905   # JSON → 뷰어 빌드
python3 examples/run_pitch.py --gif        # 구종별 궤적 3뷰 + 움직임표 + GIF
python3 examples/collision_sweep.py        # 접촉 오프셋 스윕 → EV/LA/회전
python3 examples/run_plate_appearance.py   # 타석 300회, 결과 분포·CSV
python3 examples/run_coaching.py           # 우수/부실 스태프 30주 비교
python3 examples/run_batter_judgment.py    # 타자 판단 타임라인(기억 유무 비교)
python3 examples/run_batter_attributes.py  # 능력치 저/고 × 평온/부담 스윕
```

## 버전 이력
| 버전 | 날짜 | 내용 |
|---|---|---|
| v0.0 | 2026-09-05 | 폴더 뼈대 생성 |
| bbsim v0.6.0 | 2026-09-05 | 포수 시스템: 능력치 11종·타자북·물리 기반 터널링·프레이밍·블로킹·소통 |
| bbsim v0.5.0 | 2026-09-05 | 타자 능력치 24종 전부 구현(스윙 역학·접촉·존 지도·노림수·체력·집중·감각·좌우·번트), 선수 카드→BatterProfile, 타자 훈련 축 9개 |
| bbsim v0.4.3 | 2026-09-05 | 타자 과감성/신중성(boldness): 초구 공격·파워 스윙 vs 참고 학습(attention) |
| bbsim v0.4.2 | 2026-09-05 | 타자 능력치 3종(타구판단능력·침착성·순발력): 시각 구간·부담 지수·늦은 보정/체크 스윙 |
| bbsim v0.4.1 | 2026-09-05 | 타자 판단: 직구/변화구 가족 판정(구속+휨), 카운트별 리그 직구 비율 사전확률, 구간별 시각 신뢰도·학습 신뢰, 도달 지연 학습 |
| bbsim v0.4.0 + web v0.8.1_0905 | 2026-09-05 | 타자 판단 모델(사전확률·릴리스 팁·구속 가능도·기억 군집 무브먼트·불확실성→파워/컨택 스윙), 뷰어 뼈대 기본 복귀(메시는 보류 토글) |
| web v0.8_0905 | 2026-09-05 | 3D 메시 인체(튜브·구·로프트 몸통) + 원근 카메라·음영, 인체 3D 뷰 방위각/고도 조절 |
| web v0.7_0905 | 2026-09-05 | 인체 렌더(캡슐 팔다리·몸통·머리·모자·글러브·유니폼, 깊이 정렬) 4개 뷰, 뼈대/인체 토글 |
| web v0.6.1_0905 | 2026-09-05 | 재생 배속에 1× 실시간 추가 |
| bbsim v0.3.1 + web v0.6_0905 | 2026-09-05 | 투구폼 프리셋 6종, 자세→사슬 효율(코어 힘 실현), 팔꿈치 부하, 타자 시점 지표, 기준 폼 고정 비교 |
| bbsim v0.3.0 + web v0.5_0905 | 2026-09-05 | 투구 시스템 v1: 단일 파라미터 JSON, 인체 사슬(감사 반영), 실밥 효과·회전 감쇠·환경, 투수 의도/포수 사인/흔들기, 릴리스 팁, 경기 중 피로, 심판 성향, 뷰어 v0.5(JSON 주입 빌드), 보고 `3_recent_report/2026-09-05_v0.3_pitching_system` |
| bbsim v0.2.0 | 2026-09-05 | 게임 층 `bbsim/game/`: 선수 카드(4계층+자질)·훈련 9축·코칭 스태프(진단·지도·부하관리·소통·관찰·성향) 주간 루프, 테스트 6건, 보고 `3_recent_report/2026-09-05_v0.2_coaching` |
| web v0.4_0905 | 2026-09-05 | `web/pitch_viewer_v0.4_0905.html` — 인체 운동 사슬 모델(키 비례 분절·IK 다리·몸통 기울기·어깨 회전·팔 키프레임)로 릴리스 도출, 무게중심·시선, 딜리버리 애니메이션+스크럽 |
| web v0.3_0905 | 2026-09-05 | `web/pitch_viewer_v0.3_0905.html` — 포수·타자 눈 1인칭 원근 뷰, 실제 회전각 실밥 회전, 슬로모션 배율. 명령 기록부 docs/COMMAND_LOG.md·아카이브 색인 신설 |
| web v0.2_0905 | 2026-09-05 | `web/pitch_viewer_v0.2_0905.html` — 투수 프로필(팔 슬롯·키·익스텐션·효율·제구σ)→릴리스·회전축 파생, 그립 7종, 공 회전·그립·릴리스 뷰, 산포 누적 |
| web v0.1_0905 | 2026-09-05 | `web/pitch_viewer_v0.1_0905.html` — HTML 투구 궤적 뷰어(물리 JS 포팅, 3뷰+슬로모션, Artifact 게시) |
| v0.1.0 | 2026-09-05 | MVP: 물리(비행·충돌·투구 솔버), 독립 에이전트 3종, 타석 엔진, 시각화, 테스트 15건, 보고서 `3_recent_report/2026-09-05_v0.1_mvp` |
| v0.7.0 | 2026-09-06 | 감사 반영 보정: 회전축 k=0.6·좌완 축 버그·체인지업 그립, 시각=각속도 모델·commit 잠금·순발력 late window, 군집 6종·군집별 편향, 타이밍 연결·도달 보간 버그, 카운트별 스윙 표·추격 8 cm·심판 로지스틱, 결과표·파울, 스칼라 RK4(7 ms/투구), 리그 게이트 10/18 |
| v1.0.0 | 2026-09-06 | 승부 플랫폼: engine/inning.py 하프이닝, tools/serve_game.py + web/game_v1.0_0906.html, 타구 물리 검증(docs/BATTED_BALL.md), 팀 관리 초안(docs/TEAM_MANAGEMENT.md, bbsim/club 프레임), 뷰어 v0.9_0906, 보고서 `3_recent_report/2026-09-06_v1.0_platform` |
| v1.0.1 | 2026-09-06 | 테스트 유저 25건 반영: 서버 입력 검증·400, 코어 기본값, 필드 뷰 좌표·펜스, 입력 스케일·라벨, 사구, 폭투 정합·로그, 라인업 전원 스카우팅, 구속 난수, 초구 사전, 제구 σ 재조정, run_pitch 출력 경로. 페이지 web/game_v1.0.1_0906.html |
| v1.1.0 | 2026-09-06 | 시점 분리 검증: 에이전트별 난수 스트림 4개(SeedSequence.spawn), 타자 뷰(batter_view)에서 심판 성향·도루 위협 제거, 포수 연습 관측에 노이즈, 성질 테스트 7건(tests/test_information_boundary.py), ARCHITECTURE §7 정보 흐름 표 |
| v1.2.0 | 2026-09-06 | 야수 에이전트·판정(bbsim/agents/fielder.py, engine/fielding.py, docs/FIELDING.md), 카드 FIELD_SKILLS·훈련 축 5종, 승부 플랫폼 v1.2(투수 뒤·포수 시점 원근 카메라, 야수 이동, 야수 설정 표), 테스트 6건 |
| v1.3.0 | 2026-09-06 | 게이머 뷰: 타석 단위 세션 경기(engine/game.py, /api/game/new·step), web/play_v1.0_0906.html(중계 카메라·K-zone·해설·벤치 지시·등급만 보이는 로스터), 서버가 은닉 정보를 전송하지 않음(docs/PLAYER_VIEW.md) |
| v1.3.1 | 2026-09-06 | 서버 없는 게이머 HTML: tools/build_play_standalone.py → web/play_standalone_v1.0_0906.html(미리 계산한 타석 은행 + JS 주루) |
| v1.4.0 | 2026-09-06 | 게이머 단일 HTML 재생성 web/play_standalone_v1.1_0906.html. 야수 현실 모델: 기하 의존 타구 읽기(정면·낮은 라이너·머리 위·높은 뜬공), 가속 구간 스프린트, 등 뒤 포구·다이빙·강한 라이너, 바운드 위상·백핸드, 상황별 전환·송구 시간·거리/서두름 실책, 외야 컷오프. 타구 항력 0.39 |
| v1.4.1 | 2026-09-06 | 9이닝 경기 시뮬레이터 tools/simulate_games.py(양 팀·연장·투수 교체·야수), 100경기 vs MLB 2024 진단 보고 `3_recent_report/2026-09-06_v1.4_nine_innings`; 예제 기본 출력 경로를 examples/out으로 통일 |
| v1.5.0 | 2026-09-06 | 9이닝 밸런싱 1차 적용(배트 속도 33·야수 도달·펜스 직격·실책) 10/20 통과; 게이머 HTML 반응형 템플릿 + 모바일 빌드(`--mobile`, 표본 1개·궤적 다운샘플) web/play_mobile_v1.0_0906.html, 데스크톱 web/play_standalone_v1.2_0906.html |
| v1.5.1 | 2026-09-06 | PC 게이머판 재설계: 투구 단위 은행(tools/build_play_pc.py, 카운트·벤치 사인별 8,640구), 한 구/타석/이닝 진행, 다음 투구 즉시 반영 benchsign!, 인체 뷰(투수 릴리스 관절 키프레임·타자 스윙·포수 포구·심판 콜) web/play_pc_v1.0_0906.html. 모바일판 보류 |
| v1.5.2 | 2026-09-06 | 구버전 HTML 14개를 2_Archieve/web_versions/로 이동(web/에는 계열별 최신만), PC 게이머판 관리자 모드 빌드 `tools/build_play_pc.py --admin` → web/play_pc_admin_v1.0_0906.html(모든 내부 정보 표시) |
| v1.6.0 | 2026-09-06 | 인체 뷰·야구장 렌더러 재작성: 사람 형태(캡슐 사지·유니폼)로 투수 딜리버리·타자 회전 스윙·포수 포구·심판 콜을 상호작용 재생, 야구장 배경(관중석·전광판·펜스·잔디 무늬·규정 치수 내야), 센터필드 중계 카메라, 렌더 검증 도구 tools/render_probe.py(헤드리스 Firefox PNG) |
| v1.6.1 | 2026-09-06 | 블라인드 감사(5관점 57건) 반영: 접촉 시각·타구 절대 시간축, 투수 순방향 기구학(릴리스 body.py 일치)·IK 분절 고정, 포수 좌우·포구·블로킹, 번트/체크스윙, 투수 인셋, 홈플레이트 방향·베이스·마운드 법칙·홈 뒤 관중석·백스톱, 게이머 페이로드(swing_kind, axis 제거) | play_pc_v1.2_0906.html, play_pc_admin_v1.2_0906.html |
| v1.7.0 | 2026-09-06 | 주루·송구: 타자 주력 능력치(speed)와 스프린트 모델(engine/baserunning.py), 수비 판정이 타임라인 이벤트(run/move/field/throw/call)를 기록하고 뷰어가 그대로 재생(야수 달려가 포구·송구, 베이스 커버, 타자 주자 달리기, 세이프/아웃 배너, 하이 홈 카메라 자동 프레이밍) | play_pc_v1.3_0906.html, play_pc_admin_v1.3_0906.html |
| v1.8.0 | 2026-09-06 | 공수 양면 경기(초: 우리 타선, 말: 우리 선발이 수비)와 수비 벤치 사인(몸쪽 승부·바깥쪽 유인구·내야 전진·외야 후퇴), 점수판(이닝별 R/H/E), 타석 시작 카드(타자 등급·오늘 성적, 투수 투구수·평균 구속·체력 잔량), 공 클로즈업 실밥 뷰(회전축·rpm 실제), 송구 추적 카메라 | play_pc_v1.4_0906.html, play_pc_admin_v1.4_0906.html |
| v1.8.1 | 2026-09-06 | 공 클로즈업을 투구 궤적 뷰로 교체: 포수 뒤 상단 카메라에서 투수·타자·포수·심판과 함께 공이 실제 궤적으로 날아오고 지나온 길이 꼬리로 남음, 존 프레임, 실밥 확대 인셋(회전축 실제) | play_pc_v1.5_0906.html, play_pc_admin_v1.5_0906.html |
| v1.9.0 | 2026-09-06 | 장면 전환: 투구·타격 화면 → 타구가 나오면 수비 화면(큰 중계 캔버스+필드)로 자동 전환, 플레이가 끝나면 복귀 → 이닝 교체·경기 종료마다 점수·기록 화면(라인 스코어, 양 팀 타자 기록, 투수 기록)에서 클릭으로 진행. 보이는 장면의 캔버스만 그려 부하를 줄임 | play_pc_v1.6_0906.html, play_pc_admin_v1.6_0906.html |
| v1.10.0 | 2026-09-06 | 페어/파울 기하 판정(베이스 너머는 착지점, 앞은 굴러가 베이스 통과점·정지점), 땅볼 바운드·구름과 뜬공 낙구 바운드를 엔진 샘플로 재생, 송구 물리(팔 힘에 따른 포물선·원바운드 송구·중계 플레이 선택), 팀별 야수 능력치 분산, 2D 필드 파울선·파울 지역·판정 표시 | play_pc_v1.7_0906.html, play_pc_admin_v1.7_0906.html |
| v1.11.0 | 2026-09-06 | 구단 관리 페이지(club_v1.0_0906.html): 30경기 일정·다음 날/경기/일주일 진행(빠른 시뮬), 훈련 프로그램 11종(잠재력·나이·피로·코치·만족도 반영, 부상), 선수단(타순·로테이션·1군/2군·방출·FA 영입), 순위·기록, 만족도 5축, localStorage 저장 | web/club_v1.0_0906.html, tools/build_club.py |
| v2.0.0 | 2026-09-06 | 웹앱(PWA) 전환: web/app/에 셸(index.html·app.css·app.js·kv.js·sw.js·manifest), 렌더러 7모듈, 게임·구단 모듈, 데이터 분리(roster.json·club.json·투수×타자 조합별 은행 105파일, 타석마다 100 KB 수신), IndexedDB 저장, 가로/세로 레이아웃(폰은 3D 뷰 하나씩 선택), 구단 타순·선발이 경기에 연결, 단일 파일 미리보기 번들 | web/app/, web/app_preview_v2.0_0906.html, tools/build_app.py, tools/bundle_app.py, tools/app_smoke.py |

## 다음 단계 (docs/ARCHITECTURE.md §5)
- v0.2 야수 에이전트·주루·이닝 루프 (결과 확률표 제거)
- v0.3 FM식 선수 능력치 스키마 ↔ 에이전트 파라미터 매핑, 시즌 시뮬
- 보정 갭: 평균 발사각(21° vs 실제 12°)·2루타 과다 → 결과 모델 교체 시 해소 예정
