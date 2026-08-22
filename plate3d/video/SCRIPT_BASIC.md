# 기본 교육 영상 스크립트 — PLATE & CUT

## 1. 앞의 셋과 무엇이 다른가

| 영상 | 성격 | 보는 사람 |
|---|---|---|
| `PLATE3D_promo.mp4` | 홍보 | 처음 듣는 사람 |
| `PLATE3D_TOWER.mp4` | 홍보 | 관심은 생겼는데 안 써본 사람 |
| `PLATE3D_SPLICE.mp4` | 홍보 | 자기 일에 쓸지 저울질하는 사람 |
| **`PLATE3D_BASIC.mp4`** | **교육** | **쓰기로 하고 시트를 처음 여는 사람** |

홍보 영상은 **한 번** 봅니다. 교육 영상은 **다시 찾아옵니다** — "기준점이 뭐였더라" 하고.
그래서 만드는 방식이 세 군데 달라집니다.

| | 홍보 | 이 영상 |
|---|---|---|
| 자막 | 선언 (`MADE SIMPLE.`) | 설명 (`bc 는 두께 중앙입니다`) |
| 홀드 | 임팩트 기준 | **동작이 끝날 때까지** — 판이 다 돌 때까지, 구멍이 다 뚫릴 때까지 |
| 화면 | 모델이 주인공 | **시트가 주인공**, 모델은 결과 |
| 구조 | 끊김 없이 한 흐름 | **챕터** — 유튜브 목차로 되돌아올 수 있게 |

## 2. 교재

**`plate3d/PLATE3D_BASIC.xlsx`** — Example 목록 첫 줄, "every keyword once, in one real model".
새로 만들지 않습니다. 배우고 나서 열어볼 파일이 곧 영상에서 본 파일이어야 합니다.

이 한 장에 배울 것이 전부 들어 있습니다:

| 배울 것 | BASIC 의 어디 |
|---|---|
| 세 가지 SHAPE | `pl.base` RECT · `pl.stf` TRAP(WT=0 → 삼각형) · `pl.flg` CIRC |
| 9개 기준점 | `mc` `bl` `bc` 가 행마다 |
| 두께 +/− 면 | `mc-` `mc+` 가 MODULE 행에 |
| HOLE / CUT | `ho.m26` `ho.slot` `ho.pen`, CUT 10행 |
| CUT 반복 | `CUT pl.base -150 -150 ho.m26 300 0 1` |
| 판을 형상으로 | `CUT pl.cap -130 -130 pl.stf` — 삼각 스티프너 자국을 뚜껑에서 뺌 |
| PLANE 3종 | `XY` `XZ` `YZ` 가 다 나옴 |
| BASE | 모듈 4개마다 |
| ASSY | 아래쪽 |

## 3. 화면에 쓰는 그림은 앱 것을 그대로

기준점 9점, 두께 +/− 면, PLANE 은 **앱의 Guide 패널에 이미 그림이 있습니다.**
새로 그리지 않고 그걸 띄웁니다. 이유 둘:

- 영상에서 본 그림을 나중에 앱 안에서 **다시 찾을 수 있습니다.** 교육 영상이 할 일입니다.
- 새로 그리면 문법이 바뀔 때 그림과 엔진이 따로 놉니다.

`Guide` 버튼 → 해당 섹션으로 스크롤. 커서 움직임은 홍보 영상과 같은 방식입니다.

## 4. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `PLATE3D BASICS — Plates, Cuts and the Nine Reference Points \| macroBIM` |
| 설명 1행 | `How a plate is defined, where its origin is, and how a hole gets cut — the first hour with PLATE3D.` |
| 설명 2행 | `Everything here is one shipped example: Example ▸ Basic.` |
| 태그 | PLATE3D tutorial · BIM tutorial · steel detailing · spreadsheet BIM · parametric model · plate · bolt hole · BOQ · DXF · macroBIM |
| 규격 | 3:12 · 1920×1080 · 30 fps · 무음 |

## 5. 챕터

유튜브 설명문에 그대로 넣습니다. 각 구간 10초 이상이라 챕터로 인식됩니다.

```
0:00  What you will be able to write
0:16  PLATE — one row is one part
0:38  The nine reference points
1:00  Thickness, and the + / − face
1:20  HOLE and CUT
1:45  MODULE — standing a plate up
2:09  BASE — the module's datum
2:23  ASSY — placing the module
2:39  The take-off
2:52  The drawing, and scale
```


## 6. 컷 리스트 — 3:12

| # | 시작 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| **1** | 0:00 | 6s | 완성된 BASIC 모델이 `__reveal` 로 아래에서부터 쌓여 올라감 | **This is one spreadsheet.**<br>**By the end you will be able to write it.** |
| **2** | 0:06 | 4s | 타이틀 카드 | **PLATE & CUT**<br>**the first hour** |
| 3 | 0:10 | 6s | Example ▸ **Basic** 행 테두리 → DOWNLOAD | *The file this video uses.* |
| **4** | 0:16 | 7s | input 시트 PLATE 블록 6행, 열 제목에 링 | **One PLATE row is one part.** |
| 5 | 0:23 | 7s | RECT / TRAP / CIRC 세 판이 하나씩 떠오름 | *Three shapes. RECT, TRAP, CIRC.* |
| 6 | 0:30 | 8s | TRAP 파라미터 그림 · WT 를 WB→0 으로 줄이며 사각형이 삼각형이 됨 | *WT = WB is a rectangle. WT = 0 is a triangle.* |
| **7** | 0:38 | 7s | Guide 의 **9점 그림** | **Nine points. t/m/b × l/c/r.** |
| 8 | 0:45 | 7s | 사다리꼴 판 위에 9점 — ml/mr 이 **빗변 중점** | *On the real outline, not a bounding box.* |
| 9 | 0:52 | 8s | 같은 판을 `bc` → `mc` → `tl` 로 바꿔가며 배치 | *base.pt lands on the coordinate you type.* |
| **10** | 1:00 | 6s | 두께 그림 — 면 기준 ±THK/2 | **Thickness straddles that face.** |
| 11 | 1:06 | 7s | Guide 의 **bc / bc+ / bc−** 그림 | *bc+ puts the plus face on the line.* |
| **12** | 1:13 | 7s | `MODULE md.col pl.base mc- 0 0 0 XY` · 판이 z=0 위로 올라앉음 | **Type the drawing's dimension —**<br>**not the dimension plus half the thickness.** |
| **13** | 1:20 | 6s | HOLE 3행 · 재질도 두께도 없음 | **HOLE is a shape, not a part.** |
| 14 | 1:26 | 7s | `CUT pl.base -150 -150 ho.m26` — 구멍 하나 | *Which plate, where on it, which shape.* |
| 15 | 1:33 | 6s | 뒤에 `300 0 1` 이 붙으며 구멍이 둘로 | *dx dy repeat — one row is a row of holes.* |
| 16 | 1:39 | 6s | `CUT pl.cap -130 -130 pl.stf` — 스티프너 자국이 뚜껑에서 빠짐 | *A shape can be another plate.* |
| **17** | 1:45 | 7s | MODULE 블록 · PLATE 행과 나란히 | **PLATE defines. MODULE uses.** |
| 18 | 1:52 | 9s | PLANE 세 개: 판이 눕고(XY) · 서고(XZ) · 옆으로 선다(YZ) | *XY, XZ, YZ — which plane the plate lies in.* |
| 19 | 2:01 | 8s | 반복 8칸 · 같은 판이 격자로 늘어남 | *(repeat+1) × (repeat2+1) copies.* |
| **20** | 2:09 | 7s | `MODULE md.col BASE pl.base mc-` · 그 점에 마커 | **BASE is the module's datum. Required.** |
| 21 | 2:16 | 7s | 같은 모듈을 BASE 만 바꿔 두 번 배치 | *Read where it sits, and type that in ASSY.* |
| **22** | 2:23 | 7s | ASSY ADD 행 · 모듈이 글로벌 좌표에 | **ASSY places a module in the world.** |
| 23 | 2:30 | 9s | MIR / COPY / ROT — 하나가 넷이 되고, 줄이 되고, 원이 됨 | *MIR mirrors. COPY repeats. ROT swings it round an axis.* |
| **24** | 2:39 | 13s | File ▸ Save BOQ · SUMMARY 와 PART LIST 스크롤 | **Save BOQ.**<br>**Weights are still live formulas.** |
| **25** | 2:52 | 15s | File ▸ Save DXF · **네 블록 대화상자**에 링 → 도면 | **Four blocks, each at its own scale.**<br>**Scale belongs to the paper, not the model.** |
| **26** | 3:07 | 5s | 로고 | **PLATE3D by macroBIM** |

**자막은 3~5초, 컷 길이는 화면이 정한다.** 처음 잡았던 "두 줄이면 12초"는 자막 읽는
시간과 컷 길이를 같은 것으로 본 잘못이었다. 자막은 짧게 지나가고, 컷은 판이 도는
동안·구멍이 뚫리는 동안 이어진다.

## 7. 24·25번이 왜 제일 긴가 (13s · 15s)

앞의 23컷은 **문법**입니다. 마지막 둘은 **왜 이걸 배웠는지**입니다.
시트를 쓸 줄 알게 되면 그 다음 질문이 "그래서 뭐가 나오는데"이고, 답이 이 둘입니다.

**BOQ** — `File ▸ Save BOQ`

| 시트 | 내용 |
|---|---|
| SUMMARY | 분류별 종수·수량·중량·비중, 총계 |
| PART LIST | 부재마다 규격·면적·수량·단중 |
| MODULES | 모듈 블록 |
| ASSEMBLY | 조립 단위 |

무게가 **살아 있는 수식**입니다 — 치수 칸을 고치면 합계까지 따라옵니다.

**DXF 축척** — `File ▸ Save DXF` 가 묻는 네 블록

| 블록 | 그리는 것 | 기본 |
|---|---|---|
| ASSEMBLY | 배치된 전체의 6면도 | 1:50 |
| MODULE | 모듈마다 6면도 | 1:20 |
| PART / SECT | 부재 1종씩, 수량 표기 | 1:10 |
| VIEWS | 시트의 `VIEW` 행이 이름 붙인 도면 | 1:10 |

**여기서 가르칠 것은 축척이 왜 물어보는 항목인가**입니다. 무엇을·어디서 볼지는
시트가 정했지만, **몇 분의 일로 그릴지는 종이의 성질**이라 시트가 알 수 없습니다.
파일 이름에 그대로 박힙니다 — `..._A50-M20-P10.dxf`.

## 8. 촬영

| 규칙 | 이유 |
|---|---|
| **`__reveal(frac)` 로 쌓아 올린다** | 1번 컷. 케이스 워크북을 만들지 않고 완성 모델을 아래에서부터 등장시킨다 |
| **Guide 패널을 띄워 쓴다** | 9점·+/−면 그림은 앱 안에 이미 있다. 새로 그리면 문법이 바뀔 때 따로 논다 |
| **시트 행은 셀 카드로** | 스플라이스와 같은 방식. 설명하는 열에 링 |
| **자막 3~5초, 컷은 그보다 길게** | 자막은 읽히면 끝이고, 컷은 화면의 동작이 끝날 때까지 간다 |
| **챕터 경계에서 끊는다** | 유튜브 목차로 뛰어들어와도 문장 중간이 아니게 |
| `shots.json` 을 **컷마다 저장** | 타워에서 52분 촬영 후 크래시로 타임라인을 잃음 |

## 9. 남은 결정

| | |
|---|---|
| 2번 타이틀 문구 | `PLATE & CUT / the first hour` 로 두었는데, 시리즈로 갈 거면 `PLATE3D BASICS / 01 · PLATE & CUT` 이 낫다 |
| 3:12 이 짧은가 | 26컷을 다 넣고도 이 길이다. 더 필요하면 늘릴 곳은 18·19·23번(동작이 있는 컷)이지 자막이 아니다 |
| 한국어 자막 | 지금 자막은 영어. 유튜브 자막 트랙으로 한국어를 얹을지 |
