# 경기 렌더링을 부드럽게 (v2.4, 2026-09-06)

방금 지시: 경기할 때 화면이 뚝딱인다. 비슷한 경우에 더 부드럽게 렌더링하는 오픈소스 방법을 찾아 적용.

## 결론
- 원인은 세 가지였습니다. 첫째, 수비 장면에서 카메라가 매 프레임 움직이므로 구장 배경 캐시가 매번 빗나갔습니다. 그래서 관중 점 12,000개를 매 프레임 다시 투영해 그렸습니다(프레임당 6.0 ms, 폰에서는 수십 ms). 둘째, 타구와 땅볼 궤적을 샘플 18~24개 사이 직선으로 이어 꺾임이 보였습니다. 셋째, 카메라 목표점이 이벤트가 화면에 들어오고 나갈 때마다 튀고, 야수 이동이 등속으로 시작하고 멈췄습니다.
- 적용한 것: 관중을 스프라이트 타일 270장으로 바꿨습니다(프레임 6.0→3.0 ms). 카메라가 움직이는 동안은 오프스크린 캔버스를 만들지 않고 화면에 직접 그립니다. 궤적은 3차 Hermite 보간이고 바운드 모서리는 그대로 둡니다. 카메라 위치·방향·초점거리는 지수 스무딩(시간상수 0.16 s·0.28 s)이고 30 m 넘는 점프는 컷으로 처리합니다. 야수 이동에 가감속을 넣고 공 뒤에 잔상 6개를 그립니다.
- 조사한 오픈소스 가운데 씬 그래프 라이브러리(PixiJS·Phaser·Konva)와 WebGL(three.js)은 전면 이식 비용이 커서 기법만 가져왔습니다. 트윈 라이브러리(tween.js·anime.js·GSAP)는 지수 필터로 충분해 넣지 않았습니다.

## 1. 조사
| 항목 | 출처 | 판단 |
|---|---|---|
| requestAnimationFrame + 시간 기반 애니메이션 | [Code inComplete, Did I Stutter?](https://codeincomplete.com/articles/did-i-stutter/), [MDN Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) | 이미 적용돼 있었음(game.js animate). 원인이 아님 |
| 정적 레이어의 오프스크린 캔버스 캐시 | [web.dev canvas performance](https://web.dev/articles/canvas-performance), [Konva 성능 팁](https://konvajs.org/docs/performance/All_Performance_Tips.html) | 정지 카메라에서는 이미 적용. 이동 카메라에서는 캐시 생성이 비용이라 직접 그리기로 전환 |
| 스프라이트 배치(작은 그림을 여러 번 drawImage) | PixiJS·Phaser·Konva의 기본 기법 | 채택. 관중 12,000점을 48×48 타일 6종 × 270장으로 |
| 3차 스플라인 보간(Catmull-Rom/Hermite) | 표준 기법 | 채택. math.js interp. 모서리(바운드)는 한쪽 접선으로 유지 |
| 카메라 지수 스무딩·컷 판정 | 스포츠 게임 중계 카메라 관례 | 채택. play.js playCam |
| WebGL 3D(three.js) | [baseball-pitchfx-3d](https://github.com/nkreeger/baseball-pitchfx-3d), [Anu pitches](https://jpmorganchase.github.io/anu/examples/pitches.html) | 보류. 인체·구장 렌더러 전부 재작성이 필요. 엔진 TypeScript 이식 뒤 후보 |
| 트윈 라이브러리(tween.js·anime.js·GSAP) | GitHub | 미채택. UI 전환은 CSS transition, 카메라는 지수 필터로 충분 |

## 2. 측정 (tools/app_smoke.py --mode perf, 헤드리스 Firefox 소프트웨어 렌더, 1360×700)
| 장면 | 이전 | 이후 |
|---|---|---|
| 투구 장면(카메라 정지, 배경 캐시) | 1.7 ms/frame | 1.7 ms/frame |
| 수비 장면(카메라 이동) | 6.0 ms/frame | 3.0 ms/frame |

폰은 CPU가 느리고 DPR이 높아 이전 값이 30~60 ms였을 것으로 추정합니다(추측). 남은 비용은 관중석 폴리곤 180개와 그라운드입니다.

## 3. 바뀐 코드
- `web/app/js/render/math.js`: interp(3차 Hermite, 모서리 보존), cameraFrom(방향·초점거리로 카메라 생성).
- `web/app/js/render/park.js`: crowdSprites, 관중 타일, drawBallpark의 이동 카메라 직접 도색.
- `web/app/js/render/play.js`: playCam 스무딩(playCamRaw 분리), easeRun(야수 가감속), ballTrack·drawTracer(잔상).
- `web/app/index.html`: 투구 장면 캔버스 640×400 → 800×500(배경이 캐시되므로 비용이 낮음).
- `web/app/js/app.js`: 점검 모드 perf·title.

## 4. 남은 것
- 폰 실측(DPR 3, 저사양). 인체 IK가 병목이면 프레임당 사람 수를 줄이거나 WebGL로 넘깁니다.
- 수비 장면 캔버스 해상도는 640×400 유지. 올리면 폴리곤 채우기 비용이 비례해 늘어납니다.
