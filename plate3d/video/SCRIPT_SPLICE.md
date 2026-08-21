# 스플라이스 영상 스크립트

## 1. 이 영상의 자리

| 영상 | 주장 | 파는 것 |
|---|---|---|
| `PLATE3D_promo.mp4` | 그림이 행에서 나왔다 | 가능성 |
| `PLATE3D_TOWER.mp4` | 그 행을 당신이 바꿀 수 있다 | 크기 |
| **`PLATE3D_SPLICE.mp4`** | **바뀐 건 모델만이 아니다 — 산출서와 도면도 같이 바뀐다** | **납품물** |

같은 시트 하나에서 모델·BOQ·DXF가 전부 나오고, 셀 하나를 고치면 셋이 같이 따라옵니다.
앞의 두 영상이 하지 않은 이야기입니다. 원본은 `plate3d/PLATE3D_SPLICE.xlsx`.

## 2. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `BOLTED SPLICE — BIM 3D MODEL, BOQ AND SHOP DRAWING FROM ONE SPREADSHEET \| PLATE3D` |
| 설명 1행 | `A bolted beam splice, detailed in a spreadsheet: H-300 to H-900 in one cell.` |
| 설명 2행 | `Change the section and the model, the take-off and the shop drawing all follow.` |
| 태그 | BIM · bolted splice · steel connection · shop drawing · DXF · BOQ · bill of quantities · parametric model · structural steel · Excel · PLATE3D · macroBIM |
| 규격 | 약 1:50 · 1920×1080 · 30 fps · 무음 |

## 3. 자막 뼈대

| 컷 | 역할 | 문구 |
|---|---|---|
| 1 | 질문 | What if one spreadsheet gave you the model, the take-off and the drawing? |
| 2 | 선언 | **미확정** — 아래 표 |
| 4 | 소유 | Download the example. Now you have a splice. |
| 5 | 통제 | Pick a section. The joint follows. |
| 12 | 마무리 | One spreadsheet. Model, take-off, drawing. |
| 13 | 서명 | PLATE3D by macroBIM |

1번과 12번이 **model / take-off / drawing** 세 단어로 열고 닫습니다.

### 2번 타이틀 카드 후보

| 안 | 문구 | 성격 |
|---|---|---|
| A | `ONE JOINT.` / `EVERY DELIVERABLE.` | 타워(`TOWER CRANE.` / `UNDER YOUR CONTROL.`)와 같은 리듬 |
| B | `ONE JOINT.` / `THREE DELIVERABLES.` | 셋이라는 걸 숫자로 박음 · 더 구체적, 덜 강함 |

## 4. 컷 리스트

| # | 시간 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 5s | H-900 접합부, 천천히 회전 · 볼트가 보이게 | **What if one spreadsheet gave you the model, the take-off and the drawing?** |
| 2 | 0:05 | 4s | 타이틀 카드 | **ONE JOINT.** / **EVERY DELIVERABLE.** |
| 3 | 0:09 | 6s | 커서 → 메뉴 오른쪽 끝 **Example** → 줌 → 클릭 | *Runs in the browser. Nothing to install.* |
| 4 | 0:15 | 7s | **Beam splice** 행 테두리 → DOWNLOAD → SAVED | **Download the example.** / **Now you have a splice.** |
| 5 | 0:22 | 7s | PARAM 시트, 파란 칸에 링 | **Pick a section.** / **The joint follows.** |
| 6 | 0:29 | 14s | ① 단면 · 셀 카드 → **File ▸ Load Excel** → 보가 세 배로 깊어짐 | *Section · 94 → 240 kg/m* |
| 7 | 0:43 | 11s | ② 웹 판 · 판이 깊어진 웹을 따라감 | *Plate · 220 → 760* |
| 8 | 0:54 | 11s | ③ 웹 볼트 · 빈 판이 채워짐 | *Bolts · 44 → 60* |
| 9 | 1:05 | 13s | **File ▸ Save BOQ** · SUMMARY / PART LIST 스크롤 | *The take-off comes with it.* |
| 10 | 1:18 | 16s | **File ▸ Save DXF** · 5장 · 피치 체인 클로즈업 | *So does the drawing.* |
| 11 | 1:34 | 7s | 접합부 히어로 팬 | — |
| 12 | 1:41 | 5s | 모델·BOQ·도면 세 장을 한 화면에 | **One spreadsheet. Model, take-off, drawing.** |
| 13 | 1:46 | 5s | 로고 | **PLATE3D by macroBIM** |

**6번부터 Load Excel 이 화면에 들어갑니다.** 타워에서 빠뜨렸다가 컷 하나를 다시 찍었습니다.
원인이 결과보다 먼저 나와야 하고, 한 번만 보여주면 7·8번은 바로 잘라도 읽힙니다.

## 5. 세 가지 변경 — 전부 실측

기본값에서 **한 칸씩만** 바꿉니다. 셀 카드는 타워와 같은 3단(원래값 → 커서 → 새 값).

| | 셀 | 값 | 파생되는 것 | 부재 | 판 강재 |
|---|---|---|---|---|---|
| 기본 | — | H-300×300, 길이 1800 | 순깊이 270 · 94 kg/m | 66 | 35.9 kg |
| ① 단면 | `PARAM!C6` | → **H-900x300x16x28 r18** | D6..I6 여섯 칸 자동 · 순깊이 **844** · **240 kg/m** | 66 | 35.9 kg |
| ② 판 | `PARAM!C16` | 220 → **760** | 판이 웹을 따라감 | 66 | **59.6 kg** |
| ③ 볼트 | `PARAM!F28` | Trans N 3 → **7** | 웹 피치 340 → **113.3** · 볼트 44 → **60** | **82** | 59.6 kg |

### 왜 이 순서인가

| 컷 | 이유 |
|---|---|
| ① | 규격 이름 하나를 치면 여섯 칸이 스스로 채워집니다. KS 58개 표(`SECT` 탭)와 `VLOOKUP` 여섯 개가 이미 걸려 있습니다. 사람이 치는 건 이름 하나 |
| ② | ①만 하면 웹 판(220)이 844 짜리 웹에 작게 붙은 채 남습니다. 판 치수가 단면에서 파생되지 **않는 것은 설계 의도** — 어떤 판을 쓸지는 사람이 정하고, 시트는 `clear web depth` 와 `member centre` 로 근거만 줍니다 |
| ③ | 판만 키우면 볼트 3개가 760 에 흩어져 피치 **340**. 판은 커졌는데 볼트가 빈 상태라 "덜 된" 느낌. 7개로 채우면 113 |

**플랜지 판은 안 건드립니다.** H-900×300 은 플랜지 폭이 300 이라 기존 280 판이 그대로 맞습니다.

## 6. 9·10번 — 이 영상의 이유 (둘 다 실제로 뽑아 확인)

| 컷 | 버튼 | 나오는 것 | 확인된 내용 |
|---|---|---|---|
| 9 | `File ▸ Save BOQ` | 워크북 4시트 | SUMMARY: PLATE 9종 22개 914.7 kg · BAR 2종 60개 13.1 kg · **TOTAL 82개 927.8 kg**<br>PART LIST: `PL.WB` 1800×844×16 → 190.0 kg · `PL.WP` 280×760×10 → 15.7 kg<br>MODULES · ASSEMBLY |
| 10 | `File ▸ Save DXF` | 도면 5장 (0.19 MB) | LINE 616 · CIRCLE 208 · SOLID 1392 · TEXT 64<br>레이어 `PL3D-OUTLINE` / `PL3D-HIDDEN` / `PL3D-DIM` / `PL3D-TITLE` 넷<br>블록·ARC 없음 → `tools/dxf2svg.js` 80줄로 그대로 렌더 |

두 컷 다 **"버튼을 눌렀더니 파일이 나왔다"** 를 보여주는 것이지, 파일을 흉내 낸 그림이 아닙니다.

## 7. 촬영 규칙

| 규칙 | 이유 |
|---|---|
| 케이스 사이에 **View 버튼 금지** | 시점이 고정돼야 접합부가 깊어지는 게 보임 |
| **H-900 기준으로 프레이밍**하고 H-300 을 그 카메라에 불러옴 | ①에서 보가 세 배로 깊어짐 · 타워의 `beat()` 와 같음 |
| 커서·줌·클릭은 타워와 동일 | 커서를 페이지 안에 넣고, 스크린샷 클립을 좁혀 확대하고, 앱의 진짜 핸들러 호출 |
| 엑셀 화면은 **셀 카드**로 대체 | 이 환경에 엑셀 없음 · PARAM 행을 그대로 떠서 카드로 만드는 편이 더 읽힘 |
| 10번은 **뷰 하나씩 프레이밍** | 5장이 900 × 7,235 한 장에 세로로 쌓여 있고 여백이 큼 |
| Load Excel 을 화면에 남김 | 엑셀과 실시간 연동이 아님 · 6번에서 보이는 편이 정직 |
| `shots.json` 을 **컷마다 저장** | 타워에서 52분 촬영 후 크래시로 타임라인을 잃음 |

## 8. 파일

| 파일 | 내용 | 부재 | 상태 |
|---|---|---|---|
| `SPLICE_0_BASE.xlsx` | H-300×300 · 웹판 220 · 웹볼트 3 | 66 | ✅ |
| `SPLICE_1_SECT.xlsx` | → H-900×300 | 66 | ✅ |
| `SPLICE_2_PLATE.xlsx` | → 웹판 760 | 66 | ✅ |
| `SPLICE_3_BOLT.xlsx` | → 웹 Trans N 7 | 82 | ✅ |

전부 `PLATE3D_SPLICE.xlsx` 의 PARAM 칸만 바꾸고 수식을 다시 계산해 저장한 것입니다.
`input` 탭은 손대지 않습니다 — 손댈 필요가 없다는 것이 영상의 주장 자체입니다.

| 도구 | 하는 일 |
|---|---|
| `tools/recalc_splice.js` | Excel 대신 재계산. 아무 값도 안 바꾸고 돌리면 원본 캐시 결과 **284개와 전부 일치**하는지 스스로 확인 |
| `tools/dxf2svg.js` | DXF 를 파일 그대로 읽어 SVG 로 |
| `../tools/mkpen.js` | 워크북 하나를 CodePen 붙여넣기용 HTML 로 |

**부재 길이는 1,800 입니다.** 원본 예제(900)보다 깁니다 — 900 깊은 단면에 한쪽 900 이면
깊이와 길이가 같아 토막처럼 보이기 때문입니다. 리포의 예제 워크북도 같은 길이로 맞춰야
영상의 "예제를 받아서 바꿨다"가 정직해집니다.

## 9. 남은 일

| 순서 | 할 일 |
|---|---|
| 1 | 셀 카드 — `tools/mkcellcards.js` 방식으로 SPLICE PARAM 행 (①②③ 각 3단) |
| 2 | `tools/shoot_splice.js` — 13컷 · Load Excel 처음부터 · 컷마다 `shots.json` 저장 |
| 3 | 인코딩 |
| — | 2번 타이틀 카드 문구 확정 (A / B) |
