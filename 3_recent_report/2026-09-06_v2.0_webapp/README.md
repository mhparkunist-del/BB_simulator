# v2.0 웹앱 전환 (2026-09-06)

방금 지시: 모듈 분리부터, 화면은 가로로 돌릴 수 있는 레이아웃, 웹앱으로 먼저 정리하고 나중에 앱 개발.

## 결론
- `web/app/`이 정적 웹앱(PWA)입니다. 렌더러 7모듈, 게임 모듈, 구단 모듈, 셸(라우터·저장·서비스 워커·매니페스트)로 나눴습니다. 투구 은행은 투수×타자 조합별 JSON 105개로 쪼개 타석마다 100 KB만 받습니다. 진행 상태는 IndexedDB에 저장됩니다.
- 화면은 폭에 따라 3뷰 나란히(PC) 또는 뷰 하나 선택(폰)이고, 가로 방향이면 뷰·조작 두 열, 세로면 한 열입니다. 구단의 타순·선발이 경기 화면에 그대로 들어갑니다.
- 점검: 로컬 서버 + 헤드리스 Firefox로 경기 흐름(로스터→플레이 볼→한 구)과 구단 흐름(9일 진행) 모두 오류 0.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/web/app/ | 배포용 웹앱(index.html, css, js, data, sw.js, manifest) |
| /home/mhpark/취미/2_BB_simulator/web/app_preview_v2.0_0906.html | 단일 파일 미리보기(은행 일부, 8.6 MB) |
| /home/mhpark/취미/2_BB_simulator/tools/build_app.py | 데이터·은행 생성 |
| /home/mhpark/취미/2_BB_simulator/tools/bundle_app.py | 단일 파일 번들 |
| /home/mhpark/취미/2_BB_simulator/tools/app_smoke.py | 서빙 점검 |
| /home/mhpark/취미/2_BB_simulator/docs/ARCHITECTURE.md | §9 웹앱 구조 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/smoke_app_game.png | 경기 화면(PC 폭: 중계·인체·궤적 3뷰) |
| renders/smoke_app_club.png | 구단 훈련 화면(9일 진행) |

## 배포 방법
`web/app/` 폴더를 GitHub Pages(저장소 설정 → Pages → 브랜치/폴더)나 아무 정적 호스팅에 올리면 됩니다. 폰 브라우저에서 열고 "홈 화면에 추가"하면 설치형으로 동작합니다.
