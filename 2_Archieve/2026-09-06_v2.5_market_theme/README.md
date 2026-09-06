# v2.5 구단 예산·이적 시장·협상 · KBO 구단 테마색 (2026-09-06)

방금 지시: 구단 예산과 이적 시장/협상 시스템을 실제 사례를 확인해 넣기. 색도 KBO 테마색으로 수정.

## 결론
- KBO 제도를 그대로 틀로 썼습니다. 샐러리캡은 137.4억(상위 40인, 초과분 30 %·연속 50 % 제재금)이고 하한은 60.65억입니다. 트레이드 마감은 20경기입니다. FA 계약은 계약금 + 연봉 × 연수이고, FA 영입 선수는 1년간 트레이드할 수 없습니다. 수입은 객단가 1.46만 원 × 관중(인기·성적·주말), 광고·상품, 모기업 지원이고 지출은 연봉·운영·계약금·정산·제재금입니다.
- 이적은 KBO답게 트레이드(선수 ⇄ 선수 + 현금, 상대 9구단 실제 1군)·영입 협상(FA·방출 선수)·방출로 나눴습니다. 트레이드 판정은 ZenGM식 가치 비교에 현금·선수 역제안과 AI 제안을 붙였습니다. 협상은 OOTP식 요구·인내 라운드에 풋볼 매니저식 조건(성적·출전 기회)을 얹었습니다.
- 10구단 상위 40인 보수는 101~134억으로 실제 분포 안에 있습니다. 점검: 협상 성사, 트레이드 거절→역제안→수락, 주간 결산, 장부, 받은 제안 모두 동작(오류 0).
- 색: 화면 전체가 선택한 구단의 주색·강조색을 따릅니다(배경·패널·버튼·점수 버그·로고·램프). 타이틀은 KBO 리그 남색·빨강입니다.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/docs/TRANSFER_MARKET.md | 사례 조사표(제도·재정·OOTP·FM·ZenGM)와 게임 규칙 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/club/market.js | 예산·트레이드·협상 모듈(신규) |
| /home/mhpark/취미/2_BB_simulator/web/app/js/club/club.js | 연봉 규모·결산 훅·구단 색·다리(ClubInt) |
| /home/mhpark/취미/2_BB_simulator/web/app/js/app.js | APP.theme, 구단 선택 미리보기, 점검 모드 market·team |
| /home/mhpark/취미/2_BB_simulator/web/app/data/kbo.json | 구단 주색·강조색(color·color2) |
| /home/mhpark/취미/2_BB_simulator/web/app_preview_v2.5_0906.html | 단일 파일 미리보기 |
| https://mhparkunist-del.github.io/BB_simulator/web/app/ | 배포 앱 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/smoke_app_market_1360x700.png | 예산·트레이드·협상 화면(SSG 테마) |
| renders/smoke_app_team_1360x700.png | 구단 선택 미리보기(한화 테마) |
| renders/smoke_app_game_1360x700.png | 경기 화면(삼성 테마) |
| renders/smoke_app_club_900x420.png | 선수단(두산 테마, 폰 가로) |
| renders/smoke_app_title_1360x700.png | 타이틀(KBO 리그 색) |

## 한계
- 시즌 종료 뒤 FA 등급 보상·재계약·2차 드래프트·외국인 총액 상한은 다음 단계입니다. 상대 구단 명단은 이름 해시 추정 능력치입니다.
