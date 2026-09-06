# v2.4 렌더링 부드럽게 · 게임 글꼴과 배경 (2026-09-06)

방금 지시: 경기 렌더링이 뚝딱인다, 더 부드럽게 하는 오픈소스 방법 조사·적용. 화면 구성요소가 딱딱하니 게임에서 자주 쓰는 글꼴과 배경 디자인으로.

## 결론
- 뚝딱임의 원인은 세 가지였습니다. 수비 장면에서 카메라가 매 프레임 움직여 관중 점 12,000개를 매 프레임 다시 그렸습니다. 타구 궤적은 직선 보간이었습니다. 카메라 목표점이 튀었습니다. 관중 스프라이트 타일, 이동 카메라 직접 도색, 3차 보간, 카메라 스무딩, 야수 가감속, 공 잔상을 적용했습니다. 수비 장면이 프레임당 6.0 ms에서 3.0 ms로 줄었습니다(헤드리스 소프트웨어 렌더 기준, 폰에서는 배율이 더 큽니다).
- 오픈소스 조사: 씬 그래프(PixiJS·Phaser·Konva)와 WebGL(three.js)은 전면 이식 비용이 큽니다. 스프라이트 배치와 레이어 캐시 기법만 가져왔습니다. 트윈 라이브러리는 넣지 않았습니다. 표는 docs/RENDER_SMOOTHNESS.md.
- 디자인: 글꼴은 Black Han Sans(숫자·로고), Jua(버튼·라벨), Gothic A1(본문)입니다. 배경은 경기장 조명 글로우와 사선 결입니다. 유리 패널, 둥근 입체 버튼, 빛나는 램프, 점수 버그 재설계, 경기 화면 비네트를 넣었습니다.
- 점검: perf·game·title·setup 모드 오류 0.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/docs/RENDER_SMOOTHNESS.md | 원인·조사표·측정·바뀐 코드 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/render/math.js | 3차 Hermite 보간, cameraFrom |
| /home/mhpark/취미/2_BB_simulator/web/app/js/render/park.js | 관중 스프라이트 타일, 이동 카메라 직접 도색 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/render/play.js | 카메라 스무딩, 야수 가감속, 공 잔상 |
| /home/mhpark/취미/2_BB_simulator/web/app/css/app.css | 글꼴·배경·패널·버튼 재설계 |
| /home/mhpark/취미/2_BB_simulator/web/app_preview_v2.4_0906.html | 단일 파일 미리보기 |
| https://mhparkunist-del.github.io/BB_simulator/web/app/ | 배포 앱 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/smoke_app_perf_1360x700.png | 프레임 비용 측정(상단 바) + 새 관중 타일 |
| renders/smoke_app_game_1360x700.png | 수비 장면, 공 잔상, 새 HUD |
| renders/smoke_app_title_1360x700.png | 타이틀 화면 |
| renders/smoke_app_setup_900x420.png | 경기 준비(폰 가로) |

## 한계
- 폰 실측은 하지 못했습니다. 남은 병목 후보는 인체 IK와 관중석 폴리곤입니다.
