# Git 관리와 배포 (2026-09-06)

## 결론
- 저장소는 `/home/mhpark/취미/2_BB_simulator`에서 `main` 브랜치로 관리합니다. 빌드 산출물(web/*.html, examples/out, 아카이브 HTML)은 추적하지 않고, 배포용 웹앱 `web/app/`은 추적합니다.
- 원격은 GitHub입니다. 서버에서 GitHub에 올리려면 이 계정으로 인증된 자격이 한 번 필요합니다(아래 §2). 그 뒤로는 Claude가 커밋·푸시·태그를 맡습니다.
- 배포는 GitHub Pages입니다. main 브랜치 루트를 Pages 소스로 두면 앱 주소는 `https://<계정>.github.io/<저장소>/web/app/`입니다.

## 1. 무엇을 추적하나
| 추적 | 제외 |
|---|---|
| bbsim/(엔진), tools/, tests/, docs/, web/templates/, web/app/(셸·모듈·데이터 15 MB), 3_recent_report/, 2_Archieve/(md·png), README.md | web/*.html 빌드 페이지, examples/out/ 렌더·점검 PNG, 2_Archieve/web_versions/*.html, __pycache__, *.bak |

빌드 페이지는 `tools/build_play_pc.py`, `tools/build_club.py`, `tools/build_app.py`, `tools/bundle_app.py`로 다시 만들 수 있습니다.

## 2. 인증 (한 번만)
세 가지 중 하나를 고르면 됩니다.
1. GitHub CLI 기기 인증: 서버에서 `gh auth login --hostname github.com --git-protocol https --web`를 실행하면 8자리 코드가 나옵니다. 사용자가 브라우저에서 https://github.com/login/device 에 그 코드를 넣으면 끝입니다. Claude가 명령을 실행하고 코드를 보고드립니다.
2. 개인 접근 토큰(PAT): GitHub → Settings → Developer settings → Personal access tokens에서 `repo` 권한 토큰을 만들어 알려주시면 `gh auth login --with-token`으로 등록합니다. 토큰은 파일에 남기지 않고 gh의 자격 저장소에만 둡니다.
3. SSH 키: 서버의 `~/.ssh/id_gh_deploy.pub` 내용을 GitHub 계정 SSH keys(또는 저장소 Deploy keys, 쓰기 허용)에 등록하면 `git@github.com:` 주소로 푸시합니다.

## 3. 저장소 만들기와 첫 푸시
```
gh repo create BB_simulator --private --source=. --remote=origin --push      # gh 인증 뒤
# 또는 기존 저장소에
git remote add origin https://github.com/<계정>/BB_simulator.git && git push -u origin main
```

## 4. Pages 배포
- 저장소 Settings → Pages → Source: Deploy from a branch, Branch: main, Folder: / (root).
- 1~2분 뒤 `https://<계정>.github.io/BB_simulator/web/app/`에서 앱이 열립니다. 폰에서 열고 "홈 화면에 추가"하면 설치형(PWA)으로 동작하고, 은행은 받을 때마다 캐시되어 이후 오프라인에서도 재생됩니다.
- gh로도 켤 수 있습니다: `gh api -X POST repos/<계정>/BB_simulator/pages -f source[branch]=main -f source[path]=/`.

## 5. 운용 규칙
- 지시 단위로 커밋합니다. 메시지는 `v{버전}: 한 줄 요약`이고 COMMAND_LOG 행 번호를 덧붙입니다.
- 버전이 오르면 태그(`v2.0.0`)를 붙입니다.
- 빌드 페이지를 다시 만들었을 때는 `web/app/` 변경만 커밋되므로, 미리보기 단일 파일은 아티팩트로 따로 게시합니다.
