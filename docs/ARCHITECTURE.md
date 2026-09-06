# bbsim 아키텍처 (v0.1.0, 2026-09-05)

## 1. 층 구조와 의존 방향

```
bbsim/
├── data/      pitching_params.json — 그립·인체·회전 모델·프로필 단일 소스 (파이썬·뷰어 공용, tools/build_viewer.py가 주입)
├── physics/   공 비행(항력+마그누스+실밥 효과+회전 감쇠+환경, RK4), 인체 사슬(body.py), 배트-공 충돌, 투구 생성
├── agents/    투수 의도(pitcher.py)·포수 사인(catcher.py)·공통 채점(intent.py)·타자(batter.py, 릴리스 팁) + 정보 경계(base.py) + 눈(perception.py)
├── engine/    타석 오케스트레이션, 심판, 타구 비행, 결과 모델(placeholder)
├── viz/       matplotlib 렌더러 (엔진은 viz를 import하지 않음)
└── game/      게임 층: 선수 카드·자질, 훈련 카탈로그, 코칭 스태프 (v0.2.0, docs/COACHING.md)
```

의존 방향은 `game → (agents 파라미터) / viz → engine → agents → physics` 한 방향입니다. game은 선수 카드를 물리 파라미터로 환산할 뿐 physics를 직접 호출하지 않습니다. physics는 numpy만 씁니다.

## 2. 정보 경계 (요구사항 2의 구현)

| 에이전트 | 받는 것 | 받지 않는 것 |
|---|---|---|
| PitcherAgent | GameContext(카운트·주자·투구 수), 자기 몸·감·피로·기억, 흐린 스카우팅, CatcherSign | 타자 내부 상태, 심판 성향 |
| CatcherAgent | GameContext(주자·아웃·점수·심판·시프트), 투수 의도(PitchIntent), 정확한 스카우팅, 결과 누적 | 타자 내부 상태 |
| BatterAgent | GameContext, BallSighting 목록, 노이즈 릴리스 포인트(자기 기억과 비교) | 구종·회전·구속·Trajectory |

* `engine.PlateAppearance`만 ground truth(Trajectory)를 보유합니다.
* `agents/perception.observe()`가 유일한 접점이며 (t, 노이즈 위치)만 내보냅니다.
* 타자 결정(SwingDecision)은 의도만 담고, 신체 오차(ExecutionProfile)는 엔진이 샘플링합니다.
* 테스트 `tests/test_agents.py::test_batter_observation_carries_no_ground_truth`가 경계를 지킵니다.

## 3. 상품화 분리 (요구사항 3)

| 구분 | 경로 | 라이선스/배포 | 비고 |
|---|---|---|---|
| 코어 엔진 | `bbsim/` | 상품화 후보. pyproject.toml로 wheel 빌드 | numpy만 의존, viz는 optional extra |
| 예제·프로토타입 | `examples/` | 비배포 | 보고서 생성 스크립트 |
| 테스트 | `tests/` | 비배포 | pytest 또는 단독 실행 |
| 보고서 | `3_recent_report/`, `2_Archieve/` | 비배포 | 워크스페이스 규칙 8 |

교체 가능한 구성요소(플러그인 지점):
* `AeroModel.cd / .cl` — 공기역학 계수
* `BatSpec`, `CORModel` — 배트 물성
* `PitcherAgent / CatcherAgent / BatterAgent` 서브클래스 — 휴리스틱 → 학습 모델로 교체 가능
* `engine.outcome.resolve()` — v0.1 확률표. v0.2에서 야수 에이전트로 대체 예정

## 4. 버전 규칙

* 패키지: semver, `bbsim/__init__.py::__version__` = pyproject `version`. 물리 모델·에이전트 인터페이스 변경은 minor, 파라미터 튜닝은 patch.
* 보고서 폴더: `3_recent_report/YYYY-MM-DD_v{N.M}_<주제>/`, 데이터 CSV는 `D0N_<설명>.csv`.
* README 이력표에 버전마다 한 줄.

## 5. 향후 로드맵 (초안)

| 버전 | 내용 |
|---|---|
| 0.2 | 야수 에이전트·타구 처리, 주루, 이닝/경기 루프 |
| 0.3 | 선수 능력치 스키마(FM식) ↔ 에이전트 파라미터 매핑, 시즌 시뮬 |
| 0.4 | 학습형 타자/투수 에이전트(정책 네트워크), 리플레이 뷰어 |


## 6. v0.7/v1.0 추가 (2026-09-06)
- `physics/ball_fast.py`: 순수 스칼라 RK4(`integrate_fast`, dt 4 ms, 플레이트 오차 <0.1 mm). `Trajectory`는 배열 기반으로 바뀌었고 `states`는 필요할 때만 생성. 투구당 270 ms → 7 ms.
- `engine/inning.py`: `HalfInning` 3아웃 루프(주루 확률표, 병살·희생플라이·폭투 진루, 이벤트 로그). 야수 에이전트 전까지의 결과표는 `engine/outcome.py`.
- `tools/serve_game.py` + `web/game_v1.0_0906.html`: 로컬 HTTP API(`/api/simulate`)로 파이썬 엔진을 돌리고 페이지는 렌더만. 정보 경계·에이전트 로직은 전부 파이썬에 남습니다.
- `club/`: 구단 운영 층 프레임(규칙·계약·만족도·라인업·트레이드·시장·육성·은퇴·시즌 루프). 설계는 docs/TEAM_MANAGEMENT.md.
- 감사 01의 구조 항목 중 미처리: Protocol 계약(hasattr 제거), GameState·직렬화, 난수 스트림 분리, 파라미터 외부화(agents/balance JSON), pytest 통일, 뷰어 골든 대조. v1.1 후보.


## 7. 시점 분리 검증 (v1.1, 2026-09-06)
누가 무엇을 받는지(엔진 `engine/plate_appearance.py` 기준):

| 받는 쪽 | 받는 것 | 못 받는 것 |
|---|---|---|
| 투수 | 경기 상황(카운트·주자·아웃·이닝·점수), 자기 컨디션·감·피로, 스카우팅된 타자 성향(자기 정확도로 흐려짐), 포수 사인, 투구 결과 | 타자의 능력치·판단·예측점, 포수의 채점 근거 |
| 포수 | 투수 의도(사인 전), 경기 상황, 심판 성향(umpire_low_shift), 주자 도루 위협, 스카우팅된 타자 성향(자기 정확도), 관측된 타자 반응(스윙 여부·코스·결과·타구 품질), 연습에서 본 투수 궤적(관측 노이즈 σ 3 cm) | 타자의 능력치·예측점, 투구의 회전·그립 값 자체 |
| 타자 | 눈으로 본 공 위치 표본(각도 노이즈·60 fps·가시성 흐림), 릴리스 포인트(노이즈), 경기 상황 중 타자가 알 수 있는 것(`batter_view`: 카운트·주자·아웃·이닝·점수·양손·존), 자기 기억·스카우팅(같은 눈으로 본 비행) | 구종 코드·회전·그립·투수 의도·포수 사인, 심판 성향, 도루 위협 추정치 |

- 난수: `SeedSequence(seed).spawn(4)`로 물리/심판·투수·포수·타자 스트림을 분리. 한 에이전트가 난수를 더 뽑아도 다른 에이전트의 노이즈·결정이 바뀌지 않음(tests/test_information_boundary.py::test_agent_streams_are_independent).
- 성질 테스트 7건(tests/test_information_boundary.py): 같은 스카우팅이면 타자 은닉 능력치가 달라도 첫 투구 동일, 같은 관측이면 공의 은닉 상태가 달라도 타자 결정 동일, 타자 뷰에 심판·도루 정보 없음, 포수 사인은 스카우팅·상황만의 함수, 포수·투수의 의견 차이는 각자 능력치(pitcher_weight)에서 나옴, 투수 의도는 투수 자신의 감에만 반응.
- 남은 설계상 공유: 스카우팅 성향(`tendencies()`)이 아직 은닉 능력치의 결정 함수(감사 01 #6c, 시즌 누적 통계로 대체 예정). 포수가 `pitcher.spec_for`로 연습구를 받는 것은 불펜 관찰로 간주(노이즈 적용).


## 8. 야수 층 (v1.2, 2026-09-06)
- `agents/fielder.py`: `FielderProfile`(신체·기술·정신 15종) + `Fielder`(사전 위치, 낙구점 읽기, 도달 시간, 뜬공/땅볼 시도). 야수는 타구의 초기 비행만 봅니다(정보 경계).
- `engine/fielding.py`: `resolve_fielding(bb, fielders, park, rng)` → (PlayResult, FieldingPlay). `EngineConfig.fielders`가 None이면 종전 확률표(`outcome.resolve`).
- 카드: `FIELD_SKILLS` 9종, `derive_field_traits`, 훈련 축 5종(fielding). 뷰어: 투수 뒤·포수 시점 원근 카메라, 필드 뷰 야수 이동.

## 9. 웹앱 구조 (v2.0)
- `web/app/`이 배포 단위입니다. 정적 파일만 있어 GitHub Pages 같은 정적 호스팅에 그대로 올립니다. `index.html`은 셸(상단 내비 일정·훈련·선수단·기록·경기)입니다. `css/app.css`는 구단·경기 스타일과 가로/세로 규칙입니다. `js/kv.js`는 IndexedDB 저장(localStorage 대체), `js/app.js`는 데이터 로드 → 모듈 순서 로드 → 화면 전환 → 서비스 워커입니다. `sw.js`는 셸을 설치 때, 은행을 받을 때 캐시하고, `manifest.webmanifest`는 홈 화면 설치용입니다.
- 렌더러는 전역 스코프의 고전 스크립트 7개로 나눴습니다. `render/math.js`는 벡터·보간·카메라, `park.js`는 구장, `person.js`는 인체·IK, `pitcher.js`는 투구 기구학입니다. `figures.js`는 타자·포수·심판·야수 포즈, `play.js`는 주루·수비·송구 이벤트 재생과 카메라, `seam.js`는 궤적 뷰와 송구 카메라입니다. 로드 순서가 곧 의존 순서입니다. ES 모듈 변환은 TypeScript 이식 때 함께 합니다.
- 게임 로직 `game/game.js`는 PC판 페이지 스크립트를 옮긴 것으로, 은행을 타석 시작 때 `data/bank/<top|bot>_<투수>_<타자>.json`으로 받아 메모리에 캐시합니다. 구단 로직 `club/club.js`는 즉시실행함수로 감싸 전역 이름이 겹치지 않습니다.
- 데이터: `tools/build_app.py`가 세 가지를 만듭니다. `data/roster.json`(경기용 카드·릴리스 관절·야수 위치), `data/club.json`(구단·상대·일정·FA·훈련 카탈로그), 은행 105파일(총 15 MB, 파일당 100~170 KB)입니다. 구단의 타자 12명과 선발 5명은 엔진 프로필과 연결되어(engine_id) 구단 타순·로테이션이 경기 화면에 프리필됩니다. 불펜 8명과 벤치 1명은 빠른 시뮬 전용입니다.
- 화면: 폭 1100 px 이상이면 중계·인체·궤적 뷰를 나란히, 그 아래면 뷰 하나를 골라 보고 숨은 캔버스는 그리지 않습니다. 가로 방향이면 왼쪽 뷰·오른쪽 조작 두 열, 세로면 한 열입니다. 경기 화면에 들어가면 가로 잠금을 시도합니다(설치형 앱·전체 화면에서만 동작).
- 점검: `tools/app_smoke.py --mode game|club [--size 900,420]`이 로컬 서버로 앱을 띄우고 헤드리스 Firefox로 흐름을 돌립니다. 아티팩트용 단일 파일은 `tools/bundle_app.py`가 만들며 은행 일부(상대 선발 1 대 우리 타자 12, 상대 타자 9 대 우리 선발 5)만 담습니다.
- 한계: 훈련으로 바뀐 능력치는 은행(시즌 시작 시점에 미리 계산)에 반영되지 않습니다. 엔진을 TypeScript로 옮기면 실시간 시뮬로 바뀝니다.

## 10. 가로 한 화면 UI와 경기 HUD (v2.1)
- 페이지는 스크롤하지 않습니다. html/body는 overflow를 숨기고, 화면마다 뷰포트를 채우는 그리드(fit)를 둡니다. 긴 목록은 pageTable이 이전/다음 페이지로 나눕니다. 행 수는 컨테이너 높이에서 계산합니다. 선수 카드는 모달, 이닝 교체 화면은 점수·우리 타자·상대 타자·투수 4쪽입니다.
- 경기 화면은 스포츠 게임 HUD 관례를 따릅니다. 3D 뷰가 영역 전체를 채웁니다(object-fit contain). 그 위에 좌상단 점수 버그(이닝·점수·B/S/O·베이스·타자·구속), 상단 중앙 뷰 탭(중계·인체·궤적·기록), 우상단 K-zone 인셋을 띄웁니다. 좌하단은 필드 미니맵, 하단은 중계 한 줄(기록 버튼으로 전체 목록), 우하단은 사인 칩과 큰 진행 버튼(한 구·타석·이닝)입니다. 수비 장면은 뷰 전체와 미니맵, 이닝 교체는 가운데 패널입니다.
- 세로 방향(폭 900 px 이하)에서는 회전 안내 오버레이가 덮습니다. 매니페스트는 landscape이고, 경기 화면에서 첫 탭 때 전체화면과 가로 잠금을 시도합니다(설치형 앱·전체화면에서만 동작).
- 참고한 관례: GitHub에서 같은 형태의 오픈소스 야구 게임은 찾지 못했습니다. ZenGM(zengm-games/zengm)의 진행 버튼 흐름(하루·일주일·다음 경기)과 캔버스 게임의 HUD 오버레이 관례를 적용했습니다.
- 점검 도구 주의: app_smoke.py의 로드 대기 이미지는 레이아웃 밖(fixed, 1 px)에 둬야 합니다. 본문 flex에 들어가면 화면이 비어 보입니다.

## 11. 실명 선수단 데이터 (v2.3)
- 출처와 생성 규칙은 `docs/APP_FLOW.md` §3에 있습니다. `kbo.json`은 서비스 워커 셸 목록에 들어가고 앱 부팅 때 로스터·구단 데이터와 함께 읽습니다. 단일 파일 미리보기는 `kbo.json`도 인라인합니다.
- 계층: `kbo.json`은 사실 정보(이름·등번호·투타·생년·신체·1군 여부)만 담고 게임 수치는 담지 않습니다. 수치는 `club.js`가 이름 해시로 결정론적으로 만듭니다. 실제 기록 기반 보정은 뒤에 붙일 때 이 함수 하나만 바꾸면 됩니다.
- 물리 은행은 여전히 원형 12타자×5투수 기준입니다. 실명 선수는 원형 위 이름 덧씌우기이고, 구단별 은행은 엔진 TypeScript 이식 뒤에 만듭니다.

## 12. 렌더링 부드럽게·화면 디자인 (v2.4)
- 원인 분석·조사·측정은 `docs/RENDER_SMOOTHNESS.md`, 글꼴·배경 토큰은 `docs/APP_FLOW.md` §5에 있습니다. 렌더러 규칙: 카메라가 움직이면 배경을 직접 그리고, 멈추면 두 프레임 뒤에 캐시합니다. 카메라 파라미터는 항상 playCam을 거쳐 스무딩됩니다.

## 13. 예산·이적·협상 (v2.5)
- 규칙과 사례 조사는 `docs/TRANSFER_MARKET.md`에 있습니다. `js/club/market.js`는 `window.ClubInt` 다리로 구단 상태를 읽고 씁니다. 돈은 `S.budget`(잔액)과 `S.fin`(장부·제재 이력·상대 명단 변경·받은 제안·협상 상태)에 있습니다. 하루 진행(advanceDay)이 홈 경기 입장 수입, 주간 결산, 시즌 말 제재금을 호출합니다.

## 14. 장면 연출 (v2.6)
- `js/render/cutscene.js`가 등판·이닝 교체·종료 장면을 그립니다. 프레임 함수 `CUT.draw(kind, t, opts)`는 순수 함수이고 `CUT.play`가 requestAnimationFrame으로 돌립니다. 인체는 기존 `runPose`·`standPose`에 응원·낙담 자세 두 개를 더했고, 구장은 `drawBallpark`를 "cut" 캐시 키로 씁니다. `window.NOCUT`이 참이면 건너뜁니다(점검 모드).
