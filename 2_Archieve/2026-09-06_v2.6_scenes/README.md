# v2.6 경기 날 스킵 삭제 · 결과 바로보기 · 장면 연출 · 버튼 반응 (2026-09-06)

방금 지시: 하루 바로 스킵 기능을 없애고 경기 중 결과 바로보기를 넣기. 경기 시작 등판·이닝 교체 이동·종료 기쁨/슬픔 장면 추가. 버튼 누름 효과를 생동감 있게(GitHub 참고).

## 결론
- 일정 화면의 "다음 경기까지·일주일"을 없앴습니다. 경기 날은 넘길 수 없고 버튼이 "오늘 경기 시작"으로 바뀌어 경기 화면으로 보냅니다. 빠른 시뮬 자동 처리는 점검용 simDay에만 남겼습니다.
- 경기 화면의 "결과 바로보기"는 남은 경기를 애니메이션 없이 끝까지 진행해 결과 화면(점수·기록)을 보입니다. "정지"로 멈추면 그 자리부터 다시 지휘합니다. 3이닝 완주에 0.6초가 걸렸습니다(헤드리스 기준).
- 장면 연출: 플레이 볼 때 수비진이 뛰어나가고 선발이 마운드로 걸어 올라갑니다. 이닝이 바뀔 때 수비진이 교대합니다. 끝나면 이긴 쪽은 마운드에 모여 뛰며 팔을 들고, 진 쪽은 고개를 숙이고 더그아웃으로 갑니다. 화면을 누르면 건너뜁니다.
- 버튼: Hover.css의 push·pop과 Material ripple 방식을 참고했습니다. 눌림(96 %), 스프링 복귀(104 % 오버슈트), 터치점 물결, 터치 진동을 넣었습니다. 라이브러리 없이 CSS 한 블록과 위임 이벤트 두 개입니다.
- 점검: cut·cutinn·cutend·fast·flow 모드 오류 0.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/web/app/js/render/cutscene.js | 장면 연출 모듈(신규) |
| /home/mhpark/취미/2_BB_simulator/web/app/js/game/game.js | 결과 바로보기, 장면 연결 |
| /home/mhpark/취미/2_BB_simulator/web/app/js/club/club.js | 경기 날 스킵 차단, simDay |
| /home/mhpark/취미/2_BB_simulator/web/app/css/app.css | 버튼 눌림·스프링·물결 |
| /home/mhpark/취미/2_BB_simulator/docs/APP_FLOW.md | 경기 날 규칙, 장면 연출, §6 버튼 반응(참고 사례) |
| /home/mhpark/취미/2_BB_simulator/web/app_preview_v2.6_0906.html | 단일 파일 미리보기 |
| https://mhparkunist-del.github.io/BB_simulator/web/app/ | 배포 앱 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/smoke_app_cut_1360x700.png | 등판 장면(선발이 마운드로) |
| renders/smoke_app_cutinn_1360x700.png | 이닝 교체 장면 |
| renders/smoke_app_cutend_1360x700.png | 승리 장면(마운드 집결·팔 들기) |
| renders/smoke_app_fast_1360x700.png | 결과 바로보기 뒤 결과 화면 |
| renders/smoke_app_flow_900x420.png | 일정 화면 "오늘 경기 시작"(폰 가로) |

## 한계
- 장면은 인체 빌더를 재사용한 짧은 연출이며 관중 반응·효과음은 없습니다. 버튼 진동은 기기가 허용할 때만 울립니다.
