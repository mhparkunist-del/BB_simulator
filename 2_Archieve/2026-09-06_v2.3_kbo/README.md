# v2.3 KBO 실명 구단 (2026-09-06)

방금 지시: 실제 구단과 선수명(KBO 기준, 선수 풀은 많게), 선발 고를 때 투수 체력 표시, 이닝 교체 때 다음 타순 3명(KBO 중계식).

## 결론
- 10구단 944명 실명 선수단이 들어갔습니다. 출처는 위키백과 구단 명단 틀(전 선수 이름·등번호·묶음)과 KBO 공식 등록명단(1군 투타·생년월일·신체)입니다. 등록명단에 없는 선수는 2군이고 투타·나이는 추정(est)입니다. 능력치는 실제 기록이 아니라 이름 해시 시드 추정값이며 부임 이벤트에서 밝힙니다.
- 구단 선택 화면이 10구단 카드이고, 고른 구단의 1군에서 포지션별 선발 9명(9번 DH)과 선발 투수 5명이 자동으로 짜입니다. 상대는 나머지 9구단이고 경기 화면에는 상대 구단의 실제 1군 타자가 나옵니다.
- 경기 준비 투수 카드에 체력 바와 컨디션, 점수 버그에 대기 타자 2명, 이닝 교체 화면에 다음 타순 3명(타순·이름·좌우·포지션)이 표시됩니다.
- 점검: 서빙 점검 5종(flow·setup·break·game·club) 오류 0. KIA 99명/1군 24명, 타순 9명 실명, 로테이션 5, 상대 9구단. 두산 타순은 포지션 8개가 모두 채워집니다.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/web/app/data/kbo.json | 10구단 944명(146 KB) |
| /home/mhpark/취미/2_BB_simulator/tools/build_kbo.py | 두 출처 병합 생성기 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/club/club.js | buildKboClub·kboPlayer·lineupForGame 이름 표 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/game/game.js | applyNames, 선발 카드 체력, 대기 타자, 다음 타순 3명 |
| /home/mhpark/취미/2_BB_simulator/web/app_preview_v2.3_0906.html | 단일 파일 미리보기 |
| /home/mhpark/취미/2_BB_simulator/docs/APP_FLOW.md | §3 실명 선수단 규격 |
| https://mhparkunist-del.github.io/BB_simulator/web/app/ | 배포 앱 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/smoke_app_flow_1360x700.png | KIA 타이거즈 새 시즌 시작, 부임 이벤트 |
| renders/smoke_app_setup_900x420.png | 경기 준비: 선발 5명 체력 바, 타자 12명 실명·등번호·포지션 |
| renders/smoke_app_break_900x420.png | 이닝 교체: 다음 타순 3명 |
| renders/smoke_app_game_1360x700.png | 경기 화면 실명 오버레이 |
| renders/smoke_app_club_1360x700.png | 두산 선수단(포지션 8개 충족) |

## 한계
- 능력치·등급은 추정값입니다(실제 기록 미반영). 물리 은행은 원형 12타자×5투수라 실명 선수는 원형에 이름을 덧씌운 것입니다.
- 구단명·선수명은 취미용이며 배포·판매 때는 권리 확인이 필요합니다.
