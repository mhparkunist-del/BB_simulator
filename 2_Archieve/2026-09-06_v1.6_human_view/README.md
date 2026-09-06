# v1.6 인체 뷰·야구장 렌더러 — 블라인드 감사와 수정 (2026-09-06)

방금 지시: 인체 뷰를 사람이 던지고 치고 받는 상호작용 화면으로, 배경은 진짜 야구장처럼. 끝나면 에이전트 감사를 돌리고 최종만 보고.

## 결론
- 감사(외부 5관점 블라인드) 판정은 "조건부 사용 가능"이었습니다. 상 등급 4건(접촉 시각, 타구 시간축, 분절 길이, 릴리스 자세)과 홈플레이트 방향을 포함해 44건을 v1.6.1에서 수정했습니다. 기각 4건, 부분 수용 9건입니다.
- 감사 보고서: `audit/01_blind_audit_final.md`. 렌더 증거: `renders/`.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/web/play_pc_v1.2_0906.html | 게이머 PC판(투구 은행 8,640구) |
| /home/mhpark/취미/2_BB_simulator/web/play_pc_admin_v1.2_0906.html | 관리자 PC판(모든 정보 표시) |
| /home/mhpark/취미/2_BB_simulator/web/templates/play_pc.template.html | 렌더 블록 정본 |
| /home/mhpark/취미/2_BB_simulator/tools/render_probe.py | 헤드리스 Firefox 렌더 검증(--pitch swing/take/inplay/bunt, --seed, --view cam, --cams) |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/01_body_inplay_seed3.png | 인플레이: t=0.40 접촉(공이 배트 위), 0.46 타구 출발, 0.90 팔로스루. 우상단 투수 인셋 |
| renders/02_body_swinging_strike.png | 헛스윙 8프레임: 투수 딜리버리(인셋) → 스윙 → 미트 포구 |
| renders/03_body_take_catch.png | 볼 관전: 포수가 외삽 포구점에서 받고 프레이밍 |
| renders/04_body_bunt.png | 번트: 스퀘어 → 배트 위 접촉 → 굴러감 |
| renders/05_broadcast_inplay.png | 센터필드 중계 카메라: 홈 뒤 관중석·백스톱 포함 |
| renders/06_camera_candidates.png | 인체 뷰 카메라 후보 4개 비교(3번 채택) |
