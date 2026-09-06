# v1.10 페어/파울 기하·지면 구름·송구 물리·중계 (2026-09-06)

방금 지시 두 가지입니다. 파울 바운더리를 확실히 하고 땅볼이 튀는 것을 볼 수 있게 할 것. 송구 능력치에 따라 포물선·바운드·구름을 구현하고 중계 플레이도 되게 할 것.

## 결론
- 페어/파울을 기하로 판정합니다. 베이스 거리(27.43 m) 너머는 착지점, 그 앞은 굴러가 베이스 거리를 지나는 점(또는 정지점)이 결정합니다. 판정점이 2D 필드에 파울/페어로 표시되고 파울선·파울 지역을 그렸습니다. 빗맞은 공(뒤·옆)은 확률 파울을 유지합니다.
- 땅볼과 낙구는 엔진이 지면 샘플(홉 높이·바운드·구름)을 기록하고 화면이 그대로 재생합니다. 이전에는 착지 뒤 포구까지 공이 보이지 않았습니다.
- 송구는 팔 힘의 구속에서 발사각을 계산해 직선·포물선으로 날아가고, 26°를 넘는 거리면 원바운드로 굴러 들어갑니다. 외야에서 42 m 이상이면 컷오프 중계와 직접 송구 중 빠른 쪽을 택합니다. 팀별 야수 능력치를 흩뿌려(표준편차 0.18) 원바운드·중계가 실제로 나옵니다.
- 테스트 `tests/test_throws_foul.py` 13건 통과, 기존 수비·주루 테스트 15건 통과.

## 산출물
| 파일 | 내용 |
|---|---|
| /home/mhpark/취미/2_BB_simulator/bbsim/engine/fielding.py | foul_boundary, ground 샘플, _throw_seg, throw_plan, _commit_plan |
| /home/mhpark/취미/2_BB_simulator/tools/serve_game.py | make_fielders(팀별 분산), 게이머 페이로드 ground·foul_point |
| /home/mhpark/취미/2_BB_simulator/web/play_pc_v1.7_0906.html | 게이머 PC판 |
| /home/mhpark/취미/2_BB_simulator/web/play_pc_admin_v1.7_0906.html | 관리자 PC판 |

## 렌더 증거
| 파일 | 내용 |
|---|---|
| renders/01_groundball_bounce.png | 땅볼: 착지 뒤 지면을 따라 야수에게 굴러가는 공(수비 인셋) |
| renders/02_single_roll_throw.png | 단타: 외야에서 구르는 공과 송구, 베이스 앞 카메라 |
