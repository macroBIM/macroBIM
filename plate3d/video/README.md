# 홍보영상용 시트

영상 촬영에만 쓰는 파일입니다. Example 메뉴에는 올라가지 않습니다.

| 파일 | I106 | 결과 |
|---|---|---|
| `PLATE3D_VIDEO_30M.xlsx` | 5 | 297 부재 · 20,018.017 kg · 30 m |
| `PLATE3D_VIDEO_54M.xlsx` | 9 | 497 부재 · 33,141.593 kg · 54 m |

`PLATE3D_PORTAL.xlsx`와 같은 창고인데, 함께 움직여야 하는 네 칸 중
세 칸을 첫 칸에 대한 **수식**으로 바꿔 놓았습니다.

```
I106  = 베이 수          ← 사람이 건드리는 유일한 칸
I109  =I106-1            도리·외피 복사 수
F112  =6000*(I106-1)     끝단 가새 위치
F115  =6000*I106         박공 기둥 위치
```

PLATE3D는 수식이 아니라 **엑셀이 저장해 둔 계산 결과**를 읽습니다
(`plate_builder_test.js` 의 `cellVal`). 그래서 `I106`에 9를 넣고 저장한 뒤
다시 불러오면 열 개 프레임짜리 54 m 창고가, 도리·가새·박공까지 제자리에
붙어서 나옵니다. 30M 파일은 원본 `PLATE3D_PORTAL.xlsx`와 부재 수·중량이
소수점까지 같습니다 — 수식으로 바꾼 것이 모델을 건드리지 않았다는 뜻입니다.

## 촬영

30M 을 먼저 불러온 뒤 **뷰 버튼을 누르지 말고** 54M 을 불러오세요.
첫 시트만 화면에 맞춰지고 그 뒤로는 시점이 유지되므로, 건물 앞쪽 끝은
제자리에 있고 뒤로만 뻗어나갑니다. 뷰 버튼을 누르면 다시 맞춰져서
늘어난 느낌이 사라집니다.

엑셀과 실시간 연동은 아닙니다. 저장한 뒤 Load Excel 을 다시 눌러야 합니다.

---

# 홍보영상

`PLATE3D_promo.mp4` — 56초 · 1920×1080 · 30 fps · 20 MB · 무음

화면에 나오는 것은 전부 실제 파일에서 나온 것입니다. 모델은 엔진이 배포된
시트로 빌드한 것이고, 스프레드시트 화면은 그 시트를 셀 단위로 다시 읽어
그린 것이며, 산출서는 앱이 실제로 내보낸 워크북입니다. 목업은 없습니다 —
"그림이 행에서 나왔다"가 영상의 주장 전부이기 때문입니다.

| 구간 | 시간 | 내용 |
|---|---|---|
| 1 | 0–3 | 타워크레인, 천천히 회전 |
| 2 | 3–6.5 | TOWER 시트 347행 스크롤 |
| 3 | 6.5–11 | SAMPLE 48개 부재가 쌓임 |
| 4 | 11–14 | 포탈 30 m + `I106` 셀 |
| 5 | 14–17 | 5 → 9 입력 |
| 6 | 17–25 | **같은 카메라로 30 m → 54 m** (297→497 부재) |
| 7 | 25–30 | 크레인이 바닥부터 조립 |
| 8 | 30–36 | 히어로 팬 · 575 부재 |
| 9 | 36–40 | 마스트 헤드 접사 |
| 10 | 40–46 | BOQ — SUMMARY / PART LIST, 총계 73,597.558 kg |
| 11 | 46–50 | 브라우저 창 전체 |
| 12–13 | 50–56 | 로고 · 사이트 |

## 다시 만들기

```
npm i playwright-core exceljs ffmpeg-static      # 브라우저는 Chromium
node tools/mkpages.js                            # 시트 페이지
node tools/mkcards.js && node tools/rendercards.js   # 자막·아웃트로 카드
node tools/shoot.js                              # 촬영 (약 12분)
node tools/assemble.js                           # 조립
```

`tools/shoot.js` 안의 경로 상수와, `mkcards.js`가 필요로 하는 `v_font.css`
(Inter woff2 를 data URI 로 넣은 것)를 먼저 준비해야 합니다.

프레임은 `page.screenshot`이 아니라 WebGL 캔버스에서 직접 읽습니다. 소프트웨어
래스터라이저에서 스크린샷은 프레임당 2.8초, 캔버스 읽기는 1.1초입니다. 앱
사이드바가 보여야 하는 두 컷만 전체 스크린샷을 쓰고, 그건 정지 화면입니다.

---

# 타워크레인 영상

`PLATE3D_TOWER.mp4` — 85초 · 1920×1080 · 30 fps · 16 MB · 무음

앞의 홍보영상과 주장이 다릅니다. `PLATE3D_promo.mp4` 는 **"그림이 행에서 나왔다"**
였고, 이것은 **"그 행을 당신이 바꿀 수 있다"** 입니다. 그래서 사이트 접속과 예제
다운로드가 들어가고, PARAM 칸 네 개를 하나씩 바꾸는 것이 영상의 중심입니다.

자막 다섯 줄이 뼈대이고, 1번과 10번이 **Spreadsheet** 라는 같은 단어로 열고 닫습니다.
자세한 컷 리스트는 `SCRIPT_TOWER.md`.

| 구간 | 시간 | 내용 |
|---|---|---|
| 1 | 0–5 | 크레인 선회 · *What if you could transform a Tower Crane with a Spreadsheet?* |
| 2 | 5–9 | 타이틀 카드 · **TOWER CRANE. UNDER YOUR CONTROL.** |
| 3 | 9–15 | 앱 화면 · *Runs in the browser* |
| 4 | 15–21 | Examples 패널 · *Download the example. Now you have a crane.* |
| 5 | 21–28 | PARAM 네 칸에 링 · *Change one number. See the model respond.* |
| 6 | 28–39 | 마스트 15 → 25 단 · 47.9 → 71.9 m |
| 7 | 39–50 | 지브 15 → 22 단 · 48.5 → 69.5 m |
| 8 | 50–60 | 훅 드롭 26020 → 36000 · 지상고 12.1 → 2.1 m |
| 9 | 60–73 | 선회 0 → 360° · 워크북 60장 연속 |
| 10 | 73–80 | 네 개 다 적용 · *One spreadsheet. Any crane.* |
| 11 | 80–85 | **PLATE3D by macroBIM** |

6–8번은 **큰 쪽으로 화면을 잡아 놓고 작은 쪽을 그 카메라에 불러들입니다.** 그냥 두면
엔진이 로드마다 다시 맞추기 때문에, 24 m 자란 크레인이 똑같아 보입니다 — 자라는 것이
컷의 전부인데 말이죠. 9번만 예외로 60장을 하나씩 로드합니다. 카메라를 돌리면 마스트도
같이 도는 것처럼 보여서, 지브만 돈다는 주장이 성립하지 않습니다.

## 다시 만들기

```
cd tools
ln -s <scratch>/node_modules node_modules     # playwright-core exceljs ffmpeg-static three polybooljs
cp <scratch>/v_font.css .                     # Inter woff2 를 data URI 로

node make_crane_files.js     # 워크북 65장 (기본 5 + 선회 60)
node mkparampage.js          # PARAM 탭을 페이지로
node mkcards_tower.js && node rendercards_tower.js   # 카드 11장
node shoot_tower.js          # 촬영 — 531 스틸, 약 1시간
node assemble_tower.js       # 조립
```

`slew/` 와 렌더된 카드·프레임은 리포지토리에 넣지 않습니다. 위 명령이 몇 초에서 한
시간 사이에 전부 다시 만들어 냅니다.
