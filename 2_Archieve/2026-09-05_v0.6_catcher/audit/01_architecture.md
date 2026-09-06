# bbsim v0.6.0 외부 블라인드 감사 — 구조·재사용성·안정성

- 감사 범위: `/home/mhpark/취미/2_BB_simulator/` 아래 `bbsim/`(physics·agents·engine·game·viz·data), `tests/`, `examples/`, `tools/`, `web/templates/`, `pyproject.toml`, `docs/{ARCHITECTURE,PHYSICS,INTENT,BATTER_JUDGMENT,CATCHER,COACHING,PLAYER_ATTRIBUTES}.md`
- 미열람: `docs/COMMAND_LOG.md`, `docs/DESIGN_SUMMARY.md`, `2_Archieve/`, `3_recent_report/`, `README.md` (블라인드 원칙)
- 환경: Python 3.9.25, numpy 2.0.2, setuptools 53 (wheel 빌드 불가 환경)
- 실행: 테스트 8파일 전부 실행, 별도 프로브 스크립트 `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/probe.py`
- 질문: 이 구조가 상용 야구 경영 게임의 코어(물리 엔진 + 독립 에이전트 + 게임 층)로 재사용·안정화 가능한가

---

## 1. 구조 요약 (중립)

| 층 | 파일 (줄수) | 역할 | 의존 |
|---|---|---|---|
| data | `pitching_params.json` (version 0.3.1) | 그립·인체 분절·회전 모델·피로·프로필·폼 프리셋·사슬 효율 계수 | 없음 |
| physics | `ball.py`(179) `pitch.py`(188) `body.py`(212) `collision.py`(162) `bat.py`(35) `constants.py`(38) | RK4 비행(항력·마그누스·SSW·회전 감쇠·환경), 조준 솔버, 인체 사슬 릴리스 포즈, 강체 충돌 | numpy, JSON(import 시 로드) |
| agents | `base.py`(236) `intent.py`(139) `pitcher.py`(219) `catcher.py`(325) `batter.py`(368) `batter_perception.py`(424) `perception.py`(44) | ABC 인터페이스·정보 경계 자료형, 투수 의도·포수 사인·타자 판단, 눈(관측 노이즈) | physics(constants, body, pitch) |
| engine | `plate_appearance.py`(260) `rules.py`(54) `outcome.py`(112) | 타석 오케스트레이션(사인 조정·투구·관측·스윙·충돌·타구), 심판, 결과 확률표(placeholder) | agents, physics |
| game | `player.py`(142) `training.py`(45) `coaching.py`(232) | 선수 카드·자질, 훈련 카탈로그, 코칭 스태프 주간 루프 | numpy만 (agents가 역으로 card 구조에 의존) |
| viz | `plots.py`(271) `palette.py`(23) | matplotlib 렌더 | physics; 엔진은 import하지 않음 |
| tools / web | `build_viewer.py`(35), `pitch_viewer.template.html`(74 KB) | JSON을 템플릿에 주입해 HTML 뷰어 생성; 뷰어는 physics·body 로직의 JS 수동 포팅 보유 | — |

- 총 5,637줄(테스트·예제 포함). 코어 패키지 약 3,300줄.
- 의존 방향은 문서(`ARCHITECTURE.md`) 기술과 대체로 일치합니다: `engine → agents → physics`, `viz → physics`, `game`은 독립. 예외는 `agents.pitcher.PitcherProfile.from_card` / `agents.batter.BatterProfile.from_card`가 `game.PlayerCard`의 필드 구조를 덕타이핑으로 요구한다는 점입니다.
- 정보 경계 설계: 엔진만 `Trajectory`를 보유하고, 타자는 `perception.observe()`가 만든 `(t, 노이즈 위치)` 목록과 노이즈 릴리스 포인트만 받습니다. 투수·포수는 `BatterTendencies`를 각자 정확도로 흐려 받습니다.
- 난수: `PlateAppearance`가 `np.random.default_rng(seed)` 하나를 만들어 엔진 노이즈·투수·포수·타자에 그대로 전달합니다. 전역 `np.random` 사용은 없습니다.
- 테스트: pytest 형식 함수 + 파일별 자체 러너(`__main__`), 8파일 49건. 물리 범위 검증, 에이전트 성향 비교, 코칭 루프 검증.
- 게임 루프(이닝·경기·주루), 야수, 직렬화, 이벤트 스키마는 아직 없습니다(`ARCHITECTURE.md` 로드맵 0.2~0.4에 예정으로 명시).

### 실측 수치 (프로브)

| 항목 | 값 |
|---|---|
| `throw_spec` 1회 (조준 4회 반복) | 176 ms (조준 1회면 44 ms) |
| 투구 1개 전체(에이전트 포함) | 270 ms |
| 300타석(1,188구) | 320 s |
| `PlateAppearance(new_game=True)` 생성자 | 1,300 ms (`catcher.learn_pitcher` 16회 투구) / `new_game=False` 0.25 ms |
| 프로파일 상위 | `integrate`가 전체 98 %; `acceleration` 164만 호출 중 `np.cross`(3-벡터) 40 s / 70 s, `np.linalg.norm` 8 s |
| RK4 dt 민감도(플레이트 위치 오차, 기준 0.25 ms) | 1 ms 0.003~0.009 mm, 4 ms 0.013~0.058 mm, 8 ms 0.055~0.156 mm |
| 타구 비행 dt 민감도(비거리, 기준 0.5 ms) | 2 ms 0.008 m, 8 ms 0.077 m |
| 조준 솔버 수렴(CU, 목표 (0.3, 0.55)) | 1회 481 mm → 2회 5.3 mm → 3회 0.03 mm → 4회 0.0002 mm |
| 동일 시드·새 에이전트 두 번 실행 | 전 투구 기록 동일 (결정적) |
| `PitchRecord` pickle 크기 | 110 KB / 투구 (Trajectory 433 상태 포함) |
| `PitcherMemory` JSON 직렬화 | `TypeError: ndarray` (불가) |

---

## 2. 지적 표

심각도: 상 = 상품 코어 채택을 막는 항목, 중 = 채택 전 수정 필요, 하 = 정리 항목. 근거가 없는 추정은 "(추측)"으로 표기했습니다.

| # | 심각도 | 지적 | 근거 (파일:함수/줄) | 수정안 |
|---|---|---|---|---|
| 1 | 상 | 투구당 270 ms, 300타석 5.3분. 경기당 약 300구·시즌 수천 경기를 돌리는 경영 게임 요구(투구당 수 ms 이하)에 약 2자릿수 이상 부족. 원인은 알고리즘이 아니라 3-벡터 연산에 numpy 객체 호출을 쓰는 오버헤드. | `physics/ball.py:integrate`(153~), `acceleration`(90~): 스텝당 `np.cross`·`np.linalg.norm`·배열 생성; 프로파일에서 `np.cross` 단독 40 s/70 s. `pitch.py:_aim_and_throw`(132~)가 매 투구마다 4회 완전 적분. 실측 dt 4 ms 오차 0.06 mm 이하. | (a) `acceleration`·RK4를 순수 파이썬 `math` 스칼라 3-벡터(또는 numba/C)로 재작성, (b) 투구 dt 1 ms → 4 ms(오차 표 근거), 타구 2 ms → 4 ms, (c) 조준은 직전 해(같은 spec·유사 목표)를 warm-start로 쓰고 2회 반복(5 mm) 후 종료 또는 사전 조준표(spec, target → 방향) 보간, (d) `_stop_past_plate`의 y ≤ −0.3을 접촉면 직후로 당겨 20스텝 절감. 목표: 투구당 5 ms 이하. |
| 2 | 상 | 에이전트 계약이 ABC와 다릅니다. 엔진이 실제로 호출하는 `spec_for`, `accepts`, `pitch_count`, `name`, `profile.contact_offset_y`는 `PitcherAgent`/`BatterAgent`에 선언되어 있지 않고 `hasattr`/`getattr`로 우회합니다. ABC의 추상 메서드 `PitcherAgent.decide`는 엔진 경로(`reconcile`)에서 호출되지 않습니다. 서드파티가 ABC를 구현하면 legacy `throw` 경로로 조용히 분기되어 인체 사슬·SSW·피로가 빠집니다. | `engine/plate_appearance.py:85,87`(rapport/accepts hasattr), `:116,125,126,128`(getattr name/pitch_count), `:117,150`(spec_for 유무로 분기), `:158`(profile.contact_offset_y getattr). `agents/base.py:170~190` ABC에 해당 메서드 없음. `pitcher.py:197 decide`는 `last_intent` 스테일 값을 재사용하는 legacy. | `typing.Protocol`로 엔진이 요구하는 계약을 명시(`PitchExecutor: spec_for, command_sigma, accepts, pitch_count`, `BatterAgent.contact_offset_y()`), legacy `throw` 경로와 `EngineConfig.repertoire`·`PitcherAgent.decide`를 제거하거나 별도 어댑터로 격리, `hasattr` 전부 삭제. 계약 준수 테스트(`isinstance(agent, Protocol)` + 가짜 에이전트로 엔진 완주). |
| 3 | 상 | 상태 소유권과 생명주기가 `PlateAppearance` 생성자에 숨어 있습니다. 생성자가 `begin_game`·`scout`·`learn_pitcher`(1.3 s)를 호출하고, `new_game=False`로 새 투수 객체를 넣으면 `feel`이 전부 0으로 남아 "오늘의 감" 기능이 무음으로 꺼집니다(실측). 테스트·예제가 타석마다 새 투수를 만들어 `pitch_count`·피로가 매 타석 리셋됩니다. `run(ctx)`는 호출자의 `GameContext`를 제자리 변조합니다(실측: `batter_hand`, `zone_top`, `pitcher_id` 덮어씀). | `engine/plate_appearance.py:105~118`(생성자 부작용), `:121~129`(ctx 변조). `agents/pitcher.py:93~102`(`__init__` feel=0, `begin_game`에서만 샘플). `tests/test_batter_full.py:25`, `test_catcher.py:19`, `examples/run_batter_card.py:49`(타석마다 `HeuristicPitcher(...)` 생성). | 게임 상태 객체(`GameState`: 이닝·아웃·주자·점수·투수별 투구 수·양 팀 라인업)를 신설하고 에이전트 생명주기(`begin_game`, `scout`, `learn_pitcher`)를 `Game` 객체가 소유. `PlateAppearance.run`은 `(state, agents, rng) → (state', events)`의 순수 함수로. `ctx`는 `dataclasses.replace`로 복사 후 채움. `_copy_ctx`(18개 위치 인자, `:256~260`)를 `dataclasses.replace`로 교체. |
| 4 | 상 | 게임 코어에 필요한 하부가 없습니다: 이닝/경기 루프, 주자 상태기계(폭투는 `wild_pitch` 플래그만 기록, 진루 없음), 야수, 결과 모델은 확률표 placeholder, 이벤트 스키마·직렬화·리플레이 로그 없음. `PitchRecord`는 궤적 433개 상태를 그대로 담아 투구당 110 KB, 에이전트 기억(`PitcherMemory`, `BatterBook`, `release_memory`)은 ndarray·`Dict[float, float]` 키라 JSON 불가(실측 `TypeError`). 저장/불러오기·네트워크 동기화·리플레이 어느 것도 현재 형태로 불가합니다. | `engine/outcome.py:83 resolve`("Placeholder"), `plate_appearance.py:66,179~180`(wild_pitch 기록만), `agents/batter_perception.py:96~109 PitcherMemory`(ndarray, `trust: Dict[float, float]`), `catcher.py:75 BatterBook`. `to_dict`/`from_dict`/`__getstate__` 어디에도 없음. | (a) 버전 필드를 가진 이벤트 스키마(`PitchEvent`, `PlayEvent`, `RunnerEvent`)와 `PitchRecord.summary()`(릴리스·플레이트 상태·20개 샘플만)를 정의, 전체 궤적은 옵션. (b) 에이전트 기억에 `to_dict/from_dict`(bin 키는 문자열/정수 인덱스로), 스키마 버전. (c) 이닝·주루 상태기계와 야수 모듈은 `outcome.resolve` 자리에 플러그인으로. (d) 리플레이 = 시드 + 이벤트 로그 + 에이전트 상태 스냅샷으로 재현 가능해야 함(#7과 연동). |
| 5 | 상 | 파라미터 파일이 패키지 데이터로 선언되지 않았고, import 시점에 파일을 열어 전역 가변 딕셔너리로 둡니다. wheel 배포 시 `pitching_params.json` 누락이 되면 `import bbsim.physics`가 실패합니다 (추측: 이 환경은 setuptools 53으로 빌드 검증 불가; pyproject에 `package-data`·`MANIFEST.in`·VCS 추적 어느 것도 없어 setuptools 기본 규칙상 누락됨). 또한 `PARAMS`·`GRIPS`·`BODY`가 모듈 전역이라 리그별·팀별 파라미터 세트나 테스트용 오버라이드가 불가하고, 어느 코드든 `PARAMS[...]`를 변조하면 전 프로세스가 오염됩니다. | `physics/body.py:27~30`(모듈 로드 시 `open`, `PARAMS`, `BODY`), `physics/pitch.py:31`(`GRIPS = PARAMS["grips"]` 별칭), `agents/pitcher.py:27`(`_FAT = PARAMS["fatigue"]`), `pyproject.toml`(package-data 없음). | `importlib.resources`로 로드 + `[tool.setuptools.package-data] bbsim = ["data/*.json"]`. `Params` 불변 객체(frozen dataclass 또는 `MappingProxyType`)를 `EngineConfig`에 주입하고 `body.release_pose(..., params=...)` 식으로 전달. JSON 스키마(필수 키·범위) 검증 함수와 테스트 추가. |
| 6 | 중 | 정보 경계에 네 군데 틈이 있습니다. (a) `HeuristicBatter.decide`가 commit 마감 이후 관측까지 2차 외삽에 씁니다: 엔진은 `late_window()`(0.08 s)까지 관측을 넘기고, 이 클래스는 `obs.t_deadline`으로 자르지 않습니다(실측: 마지막 관측 t=0.313 s > t_deadline 0.258 s). (b) `BatterObservation.context`가 `GameContext` 전체(`umpire_low_shift`, `runner_speed`, `fielder_shift`)를 담아 문서상 포수 전용인 심판 읽기가 타자에게 타입 수준에서 열려 있습니다(현재 타자 코드는 미사용). (c) `catcher.learn_pitcher(pitcher)`가 투수 객체를 통째로 받아 정확한 물리로 터널 표를 만들고, `batter.tendencies()`가 은닉 속성(`discipline`, `recognition`)의 결정적 함수라 `scouting_accuracy` 0.85면 은닉 속성이 거의 그대로 노출됩니다. (d) 경계 테스트는 필드 이름 집합만 검사합니다. | `agents/batter.py:139~140 late_window`, `:158~163 decide`(전 sightings 사용), `engine/plate_appearance.py:163~166`(t_seen = 0.08 s 전). `agents/base.py:117~123 BatterObservation`, `:47~48 GameContext`. `catcher.py:150~177 learn_pitcher`, `batter.py:147~154 tendencies`. `tests/test_agents.py:16~19`. | 엔진이 `decide`에는 `t_deadline`까지만, 늦은 보정은 별도 `late_sightings`로 전달(또는 `BatterObservation.commit_sightings/late_sightings` 분리). `BatterContext`(카운트·주자·아웃·이닝·점수·투수 손·zone) 타입을 따로 두고 심판·야수 정보는 `BatteryContext`에만. 터널 표는 "연습 관측"(노이즈 관측 기반 추정)으로, `tendencies()`는 표본 기반 통계(시즌 누적 결과)로 대체. 경계 테스트를 성질 테스트로: 같은 관측에 궤적 내부값(spin, 구종)을 바꿔도 결정이 불변임을 검증. |
| 7 | 중 | 난수 스트림 하나를 엔진 물리 노이즈·투수·포수·타자가 공유합니다. 에이전트 내부에서 난수 호출을 하나만 추가해도 이후 제구 오차·관측 노이즈가 전부 바뀌어 회귀 비교와 리플레이가 깨집니다. 시드는 타석 단위(`PlateAppearance(seed=)`)라 경기 단위 재현은 호출자가 시드 규칙을 관리해야 합니다. | `engine/plate_appearance.py:109`(`self.rng` 단일), `:147~166`(같은 rng를 `reconcile`·`spec_for`·`observe`·`decide`에 전달). `agents/pitcher.py:187`, `catcher.py:318`, `batter.py:203`(에이전트가 같은 rng 소비). | `np.random.SeedSequence(seed).spawn(k)`로 물리·투수·포수·타자·심판 스트림 분리. 시드는 `GameState`가 보유하고 타석 인덱스로 파생. 골든 리플레이 테스트(고정 시드 300구의 결과 해시)를 추가해 스트림 변경을 감지. |
| 8 | 중 | 밸런싱 상수가 코드에 박혀 있습니다. JSON에는 그립·인체·회전·피로·프로필만 있고, 존 스윙 확률·추격 폭·컨택 모드 문턱·타자북 가중·feel 갱신량·결과 확률표·심판 밴드 등 게임 밸런스를 좌우하는 수치는 전부 소스에 있습니다(부동소수 리터럴: `batter.py` 233, `batter_perception.py` 143, `player.py` 117, `pitcher.py` 108, `catcher.py` 96, `coaching.py` 93). 상품 밸런싱·A/B·모드별 난이도는 코드 수정 없이는 불가합니다. | `agents/batter.py:192~201,298~313,352~363`, `batter_perception.py:34~39,43~55`, `catcher.py:222,249~318`, `intent.py:56~127`, `engine/outcome.py:92~108`, `rules.py:41~53`, `game/player.py:92~120`, `coaching.py:166~209`. | `agents_params.json`(투수·포수·타자 계수), `balance.json`(결과 모델·심판·피로), `game_params.json`(훈련·코칭·나이 곡선)으로 외부화하고 #5의 `Params` 객체로 주입. 각 상수에 이름·단위·근거 필드. 우선 순위: 결과 확률표·존 스윙 확률·추격 폭·실행 σ 환산식. |
| 9 | 중 | 테스트 49건 중 동어반복·무력 조건이 섞여 있습니다: `test_sinker_has_more_arm_side_run_than_fastball_from_ssw`는 `not None`만 검사, `test_batter_observation_carries_no_ground_truth`는 필드명 집합, `test_plate_appearance_is_deterministic`은 outcome·투구 수만 비교(내부 `run` 미사용), `test_blocking_reduces_wild_pitches`는 `<=`(0 == 0 통과), `test_sequencing_...`의 헛스윙 조건은 `≥ 기준 − 0.02`로 사실상 무조건, `test_reaction_...`도 +0.03 슬랙. 통계 임계값(`> +0.1`, `< 25/100`, `> +10`)은 시드 고정이라 flaky는 아니지만 파라미터를 조금만 바꿔도 깨지는 회귀 고정핀 성격입니다. 자체 러너는 `AssertionError`만 잡아 예외는 러너 전체를 중단시킵니다(`test_body_intent.py`만 `Exception` 처리). 8파일 병렬 실행에 수 분. | `tests/test_body_intent.py:51~57`, `test_agents.py:16~28`, `test_catcher.py:38~43,66~70`, `test_batter_attributes.py:93~97`. 러너 `test_agents.py:57~68` 등. | pytest로 통일(`pyproject`에 `[tool.pytest.ini_options]`), 동어반복 3건은 실제 물리량 비교로 교체(싱커 vs 포심 x 이동량), 결정성 테스트는 전 기록 해시 비교, `<=`는 표본 수를 늘려 `<`로. 통계 테스트는 `@pytest.mark.slow`로 분리하고 빠른 단위 테스트(계약·직렬화·경계 성질)를 기본 실행으로. |
| 10 | 중 | 뷰어 동기화가 "JSON 주입 + JS 수동 포팅" 두 겹입니다. 파라미터는 주입되지만 `integrate`·`spinVector`·`releasePose`·`chainEff`·`spinModel` 로직은 JS로 다시 쓰여 있어 파이썬 변경 시 드리프트합니다. 실제로 JS `releasePose`의 `vmul` 식은 파이썬 `chain_efficiency`와 다릅니다(`min(lean, lean_opt)` 누락; 이후 `chainEff`가 덮어써서 현재는 무해). 빌드 스크립트 기본 버전이 `v0.5_0905`로 고정되어 있고(현 최신 산출물 v0.8.1), 산출물의 JSON 버전과 소스 JSON 일치를 검사하는 장치가 없습니다. `web/`의 v0.1~v0.4 HTML은 템플릿 이전 산출물이라 파라미터 버전 표기가 없습니다. | `web/templates/pitch_viewer.template.html:238~272`(JS 포트, 254행 `vmul`), `tools/build_viewer.py:17`(기본 버전), 산출물 grep: v0.5 → params 0.3.0, v0.6~v0.8.1 → 0.3.1, v0.1~v0.4 → 버전 없음. | 파이썬이 대표 입력(프로필 5종 × 그립 7종)의 릴리스 포즈·사슬 효율·플레이트 도달점을 골든 JSON으로 내보내고, 뷰어 로드 시(또는 node 테스트로) JS 결과와 대조하는 검증을 빌드에 포함. 버전은 `bbsim.__version__`에서 자동, 산출물 머리에 소스 JSON 해시 기록. 장기적으로는 물리 결과를 파이썬이 계산해 JSON으로 넘기고 JS는 렌더만 하는 구조로. |
| 11 | 중 | 구종 코드 집합이 네 곳에 따로 있습니다: `GRIPS`(JSON, SP 포함), `DEFAULT_REPERTOIRE`(SP 없음), `intent.FASTBALLS/BREAKING/OFFSPEED/DIRT_RISK`, `catcher.FAMILY/TUNNEL_PAIRS`. 구종 하나 추가 시 최소 4곳 수정이며, 누락되면 `DIRT_RISK[code]` `KeyError`(포수 사인, 3루 주자 시)로 런타임 실패합니다. 마찬가지로 `agents → game` 역방향 덕타이핑(`from_card`)이 `PlayerCard` 필드명 변경에 취약합니다. | `physics/pitch.py:45~52`, `agents/intent.py:20~23`, `catcher.py:42~43,284`(`DIRT_RISK[code]`), `pitcher.py:70~81 from_card`, `batter.py:64~73 from_card`. | 구종 메타(가족·원바운드 위험·터널 쌍)를 JSON `grips`에 통합하고 코드에서 파생. `from_card`는 `game` 쪽 어댑터(`game/mapping.py`)로 옮겨 의존 방향을 `game → agents`로 복원. |
| 12 | 중 | 수치 클램프 누락 1건과 경고성 2건. (a) 투구 수에 따른 구속 감소 `1 − 0.0004·extra`에 하한이 없어 3,000구에서 구속 −16 mph(실측; `fatigue_level`은 1.5로 클램프되지만 `traits`는 아님). 경기 루프가 생기면 연장전·시즌 누적에서 도달 가능합니다. (b) 동일 시각 관측이 들어오면 `np.polyfit`이 `RankWarning`만 내고 NaN을 흘릴 수 있습니다(실측 경고; 60 fps 샘플링에서는 발생 경로 없음 — 추측). (c) 조준 실패 시 `aim[2] += 0.3`을 4회까지만 시도하고 `plate=None`으로 정상 종료(양호). `_predict_naive`·`crossing`·`state_at`·`_blend`의 0-나눗셈은 조건 또는 `max(..., eps)`로 가드되어 있습니다. | `agents/pitcher.py:122~124 traits`, `batter.py:224~226,233`, `batter_perception.py:217~220,231,282`(polyfit), `physics/pitch.py:143~146`. | `traits`의 감쇠를 `max(0.85, ...)`로 클램프하고 피로 모델을 JSON 계수로. polyfit 전 `np.ptp(t) > eps` 검사 후 `SwingDecision(False, note=...)` 반환. `np.errstate`·`warnings.simplefilter("error", RankWarning)`을 테스트에서 켜 두기. |
| 13 | 하 | 문서-코드 드리프트: `PHYSICS.md` §5·§7 눈 σ 0.25° vs 코드 `eye_sigma_deg=0.05`; §4 σ_t 10 ms vs `ExecutionProfile.timing_sigma=0.008`; `ARCHITECTURE.md` 머리글 v0.1.0(패키지 0.6.0); `PHYSICS.md` §2 "3회 반복 → 오차 <2 cm" vs 코드 기본 4회·실측 0.0002 mm. JSON `version 0.3.1`과 패키지 `0.6.0`의 호환 관계표 없음. | `docs/PHYSICS.md:33,39,56`, `engine/plate_appearance.py:43`, `agents/base.py:128`, `docs/ARCHITECTURE.md:1`, `bbsim/data/pitching_params.json:2`. | 문서 표의 기본값을 코드에서 생성(작은 스크립트)하거나 테스트로 문서 수치와 코드 기본값 대조. JSON에 `min_package_version` 필드 추가. |
| 14 | 하 | `GameContext.fielder_shift == "bunt"`로 벤치 지시를 야수 배치 필드에 오버로딩. | `agents/batter.py:314~316`. | `GameContext.bench_call: str`("none" \| "bunt" \| "hit_and_run" ...) 별도 필드. |
| 15 | 하 | 죽은 코드·미사용: `umpire_low_shift = low_shift − high_shift * 0.0`; `pitcher.py`의 `json`, `os` import 미사용; `HeuristicPitcher.decide`(legacy, `last_intent` 스테일); `EngineConfig.repertoire`·`DEFAULT_REPERTOIRE`(테스트 전용 legacy 경로); `HeuristicBatter.late_window()`가 프로필과 무관하게 0.08 고정. | `engine/plate_appearance.py:129`, `agents/pitcher.py:13~14,197~208`, `batter.py:139~140`. | #2와 함께 정리. `late_window`는 `reaction` 능력치의 함수로. |
| 16 | 하 | `Trajectory`가 `BallState` 리스트이고 `pos`/`t` 프로퍼티가 호출마다 (N×3) 배열을 재생성합니다(`observe`가 관측마다 `state_at` → `self.t` 재생성, `crossing`이 `self.pos` 재생성). #1 재작성 시 함께 해결됩니다. | `physics/ball.py:113~123,125~135,137~146`, `agents/perception.py:28`. | 적분 결과를 `(t[N], pos[N,3], vel[N,3], spin[N,3])` 배열로 보관하고 `BallState`는 뷰로 생성. |
| 17 | 하 | 패키지 버전 정책은 문서화되어 있으나(semver, 인터페이스 변경 = minor) 공개 API 표면이 정의되어 있지 않습니다(`__all__`은 있으나 무엇이 안정 계약인지 없음). `bbsim/__init__.py`는 `__version__`만 노출. `python_requires >= 3.9`, numpy 2.x에서 동작 확인(양호). | `bbsim/__init__.py`, 각 `__init__.py`, `pyproject.toml`. | `bbsim.api` 모듈에 안정 계약(Protocol·이벤트·Params)만 재수출하고, 나머지는 내부(`_`)로. CHANGELOG와 deprecation 정책. |

### 긍정 요소 (재사용 근거)

- physics 층은 numpy만 의존하고 순수 함수 위주라 단위 검증이 쉽고 문헌 근거(Nathan 2008/2003, Matsuo 2001·2002·2006, Statcast 회귀)가 코드 주석·문서에 명시되어 있습니다. RK4 정확도 여유가 커서(1 ms에서 0.01 mm) 성능 재작성 시 dt를 4~8배 키울 공간이 있습니다.
- 정보 경계를 자료형(`BallSighting`, `BatterObservation`, `BatterTendencies`)으로 표현한 설계 자체는 상품 코어에 그대로 가져갈 만합니다.
- 조준 솔버·충돌 모델·인체 사슬은 이미 검증 범위 테스트가 있고, 결정성(동일 시드 전 기록 일치)이 실측으로 확인됩니다.
- 파라미터 단일 소스 JSON과 뷰어 주입이라는 방향은 옳습니다. 문제는 로직까지 포팅한 것과 검증 부재입니다.

---

## 3. 재사용성·안정성 종합 판정

**판정: 조건부 가능 — "물리 코어 + 에이전트 개념 검증"으로는 재사용 가치가 높으나, 현재 형태 그대로는 상품 코어가 아닙니다.**

- 재사용 가능한 부분: `physics/`(ball·collision·body·pitch)와 에이전트 정보 경계의 자료형·개념. 이 부분은 성능 재작성(#1)과 파라미터 주입(#5)만 거치면 코어로 편입할 수 있습니다.
- 안정성이 부족한 부분: 엔진-에이전트 계약(#2), 상태 소유권·생명주기(#3), 직렬화·이벤트(#4). 세 가지는 "API 동결" 이전 단계라, 지금 이 인터페이스 위에 게임 층을 쌓으면 이후 변경 비용이 게임 층 전체로 번집니다.
- 성능 격차: 투구당 270 ms는 경영 게임(시즌 시뮬, 다수 경기 동시 진행)의 요구와 두 자릿수 이상 차이가 납니다. 다만 프로파일이 단일 핫스팟(3-벡터 numpy 오버헤드)을 가리키므로 구조 변경 없이 해결 가능한 문제입니다.
- 밸런싱: 게임 상수가 코드에 있어(#8) 운영 단계에서 코드 배포 없이 조정할 수 없습니다.

채택 조건(순서대로 충족 시 상품 코어로 전환 가능하다고 판단합니다):
1. 투구당 5 ms 이하(#1) — 물리 재작성 후 골든 결과가 현재와 1 mm 이내 일치.
2. `Protocol` 기반 계약 고정과 legacy 경로 제거(#2), `hasattr` 0건.
3. `GameState`·이벤트 스키마·직렬화(#3, #4)와 시드 스트림 분리(#7)로 "시드 + 이벤트 로그 + 스냅샷 = 완전 재현"이 테스트로 보장.
4. 밸런스 상수 외부화와 패키지 데이터 포함(#5, #8).
5. 경계 틈 봉합(#6)과 테스트 정비(#9).

이 다섯 가지를 마치면 physics·agents·engine을 wheel로 배포하고 게임 층(경기 루프·야수·시즌)을 그 위에 얹는 구도가 성립합니다. 마치지 않은 채 게임 층을 먼저 얹으면 #2·#3·#4의 변경이 게임 층을 매번 깨뜨릴 것으로 예상합니다(추측).

---

## 4. 우선 수정 5건

| 순위 | 항목 | 대상 | 완료 기준 |
|---|---|---|---|
| 1 | 물리 핫스팟 재작성 (#1, #16) | `physics/ball.py` `acceleration`·`integrate`·`Trajectory`, `pitch.py` 조준 warm-start, dt 4 ms | 투구당 ≤ 5 ms, 300타석 ≤ 6 s, 골든 플레이트 좌표 1 mm 이내 |
| 2 | 엔진-에이전트 계약 명시 (#2, #11, #15) | `agents/base.py` Protocol 추가, `engine/plate_appearance.py` hasattr 제거·legacy 삭제, 구종 메타 JSON 통합 | `grep hasattr bbsim` 0건, 가짜 에이전트로 엔진 완주 테스트 통과 |
| 3 | 상태·재현성 기반 (#3, #4, #7) | `GameState` 신설, `PlateAppearance.run` 순수화, `SeedSequence.spawn`, 이벤트 스키마·`to_dict/from_dict`, 궤적 요약 기록 | 시드+로그+스냅샷으로 300구 재현 해시 일치, 투구당 기록 ≤ 5 KB |
| 4 | 파라미터 외부화·패키징 (#5, #8) | `Params` 주입 객체, `agents_params.json`/`balance.json`, `package-data`, `importlib.resources` | 격리 venv에서 wheel 설치 후 `python -c "import bbsim.engine"` 성공, 코드 내 밸런스 리터럴 절반 이하 |
| 5 | 경계 봉합·테스트 정비 (#6, #9, #10) | `decide`에 commit 이전 관측만, `BatterContext` 분리, 성질 테스트, pytest 통일, 뷰어 골든 대조 | 궤적 내부값 교란 시 결정 불변 테스트 통과, 동어반복 3건 교체, JS-파이썬 골든 대조 자동화 |

---

## 부록 A. 테스트 실행 결과

8파일을 병렬로 단독 실행(`python3 tests/test_*.py`)했습니다. 49건 전부 PASS, 실패 0.

| 파일 | 건수 | 결과 | 소요(병렬, 8프로세스 동시) |
|---|---|---|---|
| test_physics.py | 11 | 11 PASS | 3.3 s |
| test_coaching.py | 6 | 6 PASS | 0.4 s |
| test_batter_judgment.py | 7 | 7 PASS | 36 s |
| test_body_intent.py | 14 | 14 PASS | 147 s |
| test_batter_full.py | 8 | 8 PASS | 163 s |
| test_batter_attributes.py | 7 | 7 PASS | 466 s |
| test_catcher.py | 6 | 6 PASS | 498 s |
| test_agents.py | 4 | 4 PASS | 836 s |

- 순차 합계 약 35분(병렬 최장 14분). 시간의 대부분은 `PlateAppearance(new_game=True)`를 시드마다 새로 만들어 `learn_pitcher`(1.3 s)와 투구당 270 ms를 반복하는 데 쓰입니다(#1, #3). 물리 테스트와 코칭 테스트는 수 초 안에 끝나므로, 느린 통계 테스트를 분리하면(#9) 기본 실행을 1분 이내로 만들 수 있습니다.
- 통과했으나 검증력이 약한 건(#9): `test_sinker_has_more_arm_side_run_than_fastball_from_ssw`, `test_batter_observation_carries_no_ground_truth`, `test_plate_appearance_is_deterministic`, `test_blocking_reduces_wild_pitches`, `test_sequencing_catcher_uses_tunnels_and_hurts_the_batter`(헛스윙 조건), `test_reaction_enables_check_swings_and_adjustments`(헛스윙 조건).

## 부록 B. 프로브 산출 파일

- 프로브 스크립트: `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/probe.py`
- 테스트 로그: `/tmp/claude-1002/-home-mhpark/ef5b4abe-eb6a-462c-970f-4e50b05f2f55/scratchpad/audit_v06/testlogs/`
