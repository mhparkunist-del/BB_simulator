# 인수인계 (다른 서버에서 이어받기)

- 저장소(공개): https://github.com/mhparkunist-del/BB_simulator
- 배포 앱(GitHub Pages, main 루트): https://mhparkunist-del.github.io/BB_simulator/web/app/
- 현재 버전: bbsim v2.6.1 (2026-09-07 릴리스, 태그 v2.6.1). 최신 커밋에는 플레이테스트 산출물(examples/out/playtest, 681파일)까지 들어 있습니다.

## 1. 받기
```
git clone https://github.com/mhparkunist-del/BB_simulator.git
cd BB_simulator
python3 -m pip install -r requirements.txt      # numpy, matplotlib
```
푸시하려면 그 서버에서 GitHub 인증이 필요합니다: `gh auth login` 뒤 `git config credential.helper '!gh auth git-credential'` (저장소 로컬 설정만, 전역 설정 변경 없음).

## 2. 실행
| 목적 | 명령 |
|---|---|
| 웹앱 로컬 실행 | `cd web && python3 -m http.server 8000` → http://localhost:8000/app/index.html |
| 물리 엔진 은행·데이터 재생성(약 5분) | `python3 tools/build_app.py` |
| KBO 실명 데이터 재생성 | `python3 tools/build_kbo.py --wiki <위키 원본> --reg <등록명단 원본>` (원본 JSON은 스크래치에 있어 저장소에 없음. web/app/data/kbo.json은 이미 들어 있으므로 보통 불필요) |
| 화면 점검(헤드리스 Firefox 필요) | `python3 tools/app_smoke.py --mode game --size 1360,700` (모드: flow·setup·break·game·lock·club·market·team·title·perf·fast·cut·cutinn·cutend) |
| 플레이테스트 시나리오 실행 | `python3 tools/playtest.py --script examples/playtest/example.js --size 900,420` (작성법: docs/PLAYTEST.md) |
| 단일 파일 미리보기 번들 | `python3 tools/bundle_app.py --version v2.7_MMDD` → web/app_preview_*.html |

## 3. 릴리스 순서 (docs/GIT_DEPLOY.md)
1. 코드 수정 → 점검(app_smoke.py) → 문서·COMMAND_LOG 행·README 이력표.
2. `bbsim/__init__.py` 버전 올림 → 커밋 "v{버전}: 요약 (COMMAND_LOG n)".
3. `python3 tools/release_app.py` (서비스 워커 캐시 이름·헤더 스탬프) → 커밋 "release stamp v{버전}" → `git tag v{버전}` → `git push origin main v{버전}`.
4. Pages 빌드 확인: `gh api repos/mhparkunist-del/BB_simulator/pages/builds/latest`. 안 돌면 `gh api -X POST repos/mhparkunist-del/BB_simulator/pages/builds`.
5. 라이브 확인: `curl -s https://mhparkunist-del.github.io/BB_simulator/web/app/sw.js | grep -o 'bbsim-app-v[0-9.]*-[0-9a-f]*'`.

## 4. 어디에 무엇이 있나
- `bbsim/` 파이썬 물리 엔진(투구·충돌·타구·수비·주루). `web/app/` 배포 웹앱(js/render 렌더러, js/game 경기, js/club 구단·이적, app.js 셸). `tools/` 빌드·점검·릴리스. `docs/` 설계·규칙(ARCHITECTURE, APP_FLOW, TRANSFER_MARKET, RENDER_SMOOTHNESS, PLAYTEST, GIT_DEPLOY, COMMAND_LOG). `3_recent_report/` 최신 보고 1건, `2_Archieve/` 이전 보고·이전 뷰어.
- 운용 규칙: 지시마다 `docs/COMMAND_LOG.md`에 한 행, 버전은 `v{N.M}_{MMDD}`와 README 이력표, 새 버전이 나오면 이전 미리보기·보고는 즉시 `2_Archieve/`로.

## 5. 남은 일 (플레이테스트 결과, 3_recent_report/2026-09-07_v2.6.1_playtest/README.md)
- 엔진: 2스트라이크 파울 연속 시 컨택 정밀도 하락·투수 배합 변경, 은행 생성 시 버킷 검증. 사인(번트·기다려·강공) 효과가 은행에서 드러나도록 조정.
- 관리 층을 물리 경기에 연결(훈련·피로·트레이드 결과가 실제 투구·타격에 반영), 두 엔진의 득점 척도 정합.
- 실명 스타 앵커 표(포지션·투타·나이·연봉 보정), 오프시즌(FA 등급 보상·재계약·2차 드래프트·외국인 총액).
- 폰 가로 선수단·이적 화면 재구성, 튜토리얼 버튼 하이라이트, 중계 뷰 공 가시성, 관중 반응·효과음.
