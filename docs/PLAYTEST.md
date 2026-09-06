# 플레이테스트 하네스 (tools/playtest.py)

테스터(사람 또는 에이전트)가 JS 시나리오로 앱을 조작하고 결과(캡처·보고 JSON·로그)를 받는 도구입니다.

## 실행
```
python3 tools/playtest.py --script examples/playtest/example.js --size 1360,700     # PC 폭
python3 tools/playtest.py --script my_scenario.js --name trade_abuse --size 900,420   # 폰 가로
```
결과: `examples/out/playtest/<name>.png`(최종 화면), `<name>.json`(PT.done에 넘긴 보고 + 오류 목록 + 로그), `<name>.log`, `<name>_<label>.png`(PT.shot 캔버스 캡처). 시나리오가 `PT.done()`을 부를 때까지 화면 캡처를 기다립니다(최대 140초).

## 시나리오 작성 규칙
- 파일은 페이지 안에서 그대로 실행되는 JS입니다. `(async()=>{ ... await PT.done({...}) })()` 꼴로 씁니다. 반드시 마지막에 `PT.done(보고객체)`를 부릅니다.
- 앱 로드가 끝난 뒤 실행되므로 `APP`, `ClubUI`, `GameUI`, `ClubMarket`, `ClubInt`, `CUT`가 모두 준비돼 있습니다. 타이틀 화면에서 시작합니다.
- 장면 연출은 기본으로 꺼져 있습니다(`window.NOCUT = true`). 보려면 `window.NOCUT = false`.
- DOM 조작은 실제 사용자처럼 버튼을 누르는 방식(`PT.click("#btnNew")`)을 우선하고, 상태 확인은 API로 합니다.

## PT 도우미
| 함수 | 내용 |
|---|---|
| `PT.say(text)` | 화면 위 상태 줄(캡처에 남음) |
| `PT.note(text)` | 로그 한 줄(보고 JSON의 log와 .log 파일) |
| `await PT.wait(ms)` | 대기 |
| `await PT.until(() => cond, maxMs)` | 조건이 참이 될 때까지(기본 8초) |
| `PT.click(selector 또는 element)` | 클릭(없으면 note에 기록, false) |
| `PT.visible(selector)` | 화면에 보이는지 |
| `PT.text(selector)` | textContent |
| `await PT.shot(label, [canvasSelector])` | 보이는 캔버스(경기 뷰)를 PNG로 저장 |
| `await PT.done(obj)` | 보고 종료. obj에 자유 형식(예: `{fun: 6, bugs: [...], notes: [...]}`), errs(JS 오류)와 log가 자동으로 붙음 |

## 앱 API (자주 쓰는 것)
- 화면: `APP.show("title"|"team"|"schedule"|"training"|"roster"|"stats"|"market"|"game")`, `APP.teamList()`(10구단), `APP.theme(색, 강조색)`, `APP.locked`(경기 중 잠금), 저장 `APP.kv.get/set`.
- 흐름 버튼: `#btnNew`(새로 시작) → `#teamCards .tc`(구단 카드) → `#teamStart`(부임하기) → 이벤트 모달 `#eventOk` → 튜토리얼 `#tutNext`/`#tutSkip`. 저장 `#saveBtn`, 타이틀 `#titleBtn`, 불러오기 `#btnLoad`.
- 구단: `ClubUI.state()`(S: players, lineup, rotation, sched, opps, budget, fin, day, W/L…), `ClubUI.fresh(APP.teamList()[i])`, `ClubUI.advanceDay()`(경기 날은 거부), `ClubUI.simDay()`(점검용 강제 진행, 경기 자동 처리), `ClubUI.render()`, `ClubUI.recordExternalGame(res)`. 일정 화면 버튼 `#nextDay`("다음 날"/"오늘 경기 시작"). 훈련 방침 `.pol[data-pol]`. 선수단: `.swap`(타순 교체), `.rot`(로테이션 셀렉트), `[data-act=down|up|release][data-pid]`, `.posSel`, `.pr`(선수 행 → 카드 모달 `#cardModal`).
- 이적: `ClubMarket.startNego(faId)` → 모달 `#negoModal`, 입력 `#negoSalary`, `#negoYears`, 버튼 `#negoOffer`/`#negoMeet`/`#negoClose`; `ClubMarket.offer(salary, years)`; `ClubMarket.proposeTrade(code, theirIds, ourIds, cash)`; `ClubMarket.oppRoster(code)`; `ClubMarket.tradeValue(p)`; `ClubMarket.fin()`(장부·받은 제안 offers); `ClubMarket.answerOffer(id, accept)`; 화면 `#tradeClub`, 체크박스 `#tradeTheirs input`, `#tradeOurs input`, `#tradeCash`, `#tradeGo`, `#tradeMsg`, `[data-off]`.
- 경기: 준비 화면 `#autoOrder`(자동 타순), 카드 `[data-p]`(선발)·`[data-b]`(타자), `#innings`, `#start`(플레이 볼, async). 진행 `#playPitch`(한 구), `#playPA`(타석), `#playInning`(이닝), `#playFast`(결과 바로보기), `#stop`, 배속 `#spd`. 사인 `.call[data-call]`(공격: 자유/번트/기다려/강공), `.dcall[data-dcall]`(수비). 뷰 탭 `.viewsel [data-view]`(cam/body/seam/feed). 이닝 교체 화면 `#sceneBreak`, 페이지 `#breakPrev/#breakNext`, `#resume`(다음 이닝 진행/정비로 돌아가기). 상태 `GameUI.state()`(G: inning, half, outs, score.us/them 배열, runners, box, over), `GameUI.fast()`, `GameUI.pickPitch()`(한 구 데이터), `GameUI.drawAll(p, t)`.
- 장면: `CUT.play("intro"|"inning"|"ending", opts)`, `CUT.draw(kind, t, opts)`.

## 보고 형식 권장
```
PT.done({ persona: "…", fun: 1~10, funWhy: "…", bugs: [{where, what, repro, severity}], confusions: ["…"], likes: ["…"], suggestions: ["…"], stats: {...} })
```

## 주의 (헤드리스 캡처)
- `firefox --headless --screenshot`에서는 `requestAnimationFrame`이 발화하지 않습니다. 한 구 버튼·장면 연출처럼 애니메이션을 기다리는 경로는 시나리오 맨 위에서 폴리필하세요: `window.requestAnimationFrame = cb => setTimeout(() => cb(performance.now()), 16)`.
- 결과 바로보기(`GameUI.fast()`)는 애니메이션이 없어 폴리필 없이도 끝까지 돕니다.
