# v1.7 주루·송구 (2026-09-06)

방금 지시: 타격 이벤트가 나면 공을 잡는 야수가 뛰어가고 송구하는 모습, 타자가 베이스로 뛰는 모습을 달리기 능력치로 구현.

## 결론
- 타자 주력 능력치 `speed`를 추가하고 스프린트 모델(engine/baserunning.py)로 홈→1루 4.88/4.32/3.87 s(느림/보통/빠름)를 만듭니다. 땅볼 아웃·내야 안타·2루타·3루타 판정이 이 시간과 송구 시간의 경쟁으로 정해집니다.
- 수비 판정이 타임라인 이벤트(run·move·field·throw·call)를 기록하고, 인체 뷰·중계 카메라·2D 필드가 이벤트만 재생합니다. 야수가 공으로 달려가 포구하고 송구하며, 베이스 커버 야수가 받고, 타자 주자가 달리고, 세이프/아웃 배너가 뜹니다.
- 중계 카메라는 접촉 뒤 하이 홈 카메라로 컷해 공·주자·야수를 모두 담고, 수비 장면 확대 인셋을 함께 보여줍니다.
- 테스트 `tests/test_baserunning.py` 9건 통과(모델 범위, 이벤트와 판정의 일치).

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/bbsim/engine/baserunning.py | 스프린트 모델, 베이스 도착 시각, run 이벤트 |
| /home/mhpark/취미/2_BB_simulator/bbsim/engine/fielding.py | 이벤트 기록(move/field/throw/call, 커버 야수), 주자 시간 교체 |
| /home/mhpark/취미/2_BB_simulator/web/play_pc_v1.3_0906.html | 게이머 PC판 |
| /home/mhpark/취미/2_BB_simulator/web/play_pc_admin_v1.3_0906.html | 관리자 PC판 |
| /home/mhpark/취미/2_BB_simulator/tools/page_smoke.py | 빌드된 페이지 헤드리스 점검(오류 훅·플로우) |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/01_body_batter_to_runner.png | 인체 뷰: 접촉 → 배트 놓고 1루로 달림 |
| renders/02_broadcast_groundball_play.png | 중계: 땅볼 처리, 1루 커버, 주자 도착 |
| renders/03_broadcast_flyout_with_inset.png | 중계: 뜬공 포구·송구, 수비 확대 인셋 |
| renders/04_broadcast_play_seed3.png | 중계: 하이 홈 카메라 자동 프레이밍 |

## 남은 과제
- 기존 주자의 주력은 페이지 상수(8 m/s)입니다. 태그 플레이·도루·컷오프 릴레이는 미구현입니다.
