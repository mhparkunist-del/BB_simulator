# 투구 궤적 실험실 (HTML 뷰어) v0.1_0905 — 2026-09-05

## 결론
bbsim 물리(항력+마그누스, RK4 1 ms)를 JS로 포팅한 인터랙티브 투구 궤적 뷰어를 게시했습니다. 마운드 거리·익스텐션·릴리스 위치·구속·회전(rpm, 축 기울기, 자이로)·목표를 조절하면 궤적과 지표가 즉시 재계산됩니다.

- 게시 링크: https://claude.ai/code/artifact/4f2bf4a9-dcac-4f27-8ab4-d239898a7d27
- 정본 파일: /home/mhpark/취미/2_BB_simulator/web/pitch_viewer_v0.1_0905.html
- 본 폴더 사본: /home/mhpark/취미/2_BB_simulator/3_recent_report/2026-09-05_v0.1_pitch_viewer/pitch_viewer_v0.1_0905.html

## 표시 내용
| 요소 | 내용 |
|---|---|
| 마운드 거리 | 러버→플레이트(기본 18.44 m) − 익스텐션 − 플레이트 앞 0.43 m = 실제 비행 거리, 옆면 뷰에 치수선 |
| 궤적 3뷰 | 옆면(y–z)·윗면(y–x)·포수 시점(x–z, 접근 시 공 확대), 8배 슬로모션 |
| 기준선 | 무회전(항력만) 점선, 진공 포물선 선택 |
| 지표 | 비행 거리, 릴리스→플레이트 구속·항력 감속, 비행 시간·타자 commit 마감, IVB/HB(in), 스트라이크/볼 |
| 프리셋 | FF·SI·CT·SL·CU·CH (우완 리그 중앙값), 좌완 전환 시 x 반전 |

## 파이썬 엔진과의 대응
물리 상수·C_L(S)·조준 솔버(중력 보정 + 4회 반복)는 `bbsim/physics/ball.py`, `pitch.py`와 동일합니다. 파이썬 쪽 검증값(포심 IVB +19 in, 커브 −24 in)이 뷰어에서도 같은 수치로 나옵니다.

## 이전 보고
v0.1.0 MVP 보고(타석 300회·충돌 스윕)는 /home/mhpark/취미/2_BB_simulator/2_Archieve/2026-09-05_v0.1_mvp 로 이동했습니다.
