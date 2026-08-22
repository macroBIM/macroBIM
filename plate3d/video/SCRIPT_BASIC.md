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
| 유튜브 제목 | `How to Model Plates and Holes in a Spreadsheet \| PLATE3D Basics 01` |
| 화면 타이틀 | `HOW TO USE` / `PLATE & CUT` |
| 설명 1행 | `How a plate is defined, where its origin is, how a hole gets cut, and how the parts come together.` |
| 설명 2행 | `Everything here is one shipped example: Example ▸ Basic.` |
| 태그 | PLATE3D tutorial · BIM tutorial · steel detailing · spreadsheet BIM · parametric model · plate · bolt hole · 3D modelling · macroBIM |
| 규격 | 3:23 · 1920×1080 · 30 fps · 무음 |

### 제목이 둘인 이유

**유튜브 제목은 검색되라고, 화면 카드는 읽히라고** 있습니다. 같은 문구를 두 군데 쓰면
둘 다 나빠집니다 — 검색어를 다 넣은 제목은 화면에서 길고, 화면에 좋은 두 단어는
검색되지 않습니다.

| | 문구 | 노리는 것 |
|---|---|---|
| 유튜브 | `How to Model Plates and Holes in a Spreadsheet \| PLATE3D Basics 01` | `how to` + 검색어. 66자라 검색결과에서 안 잘림 |
| 화면 | `HOW TO USE` / `PLATE & CUT` | 4초에 읽히는 두 줄 |

`use` 가 들어가야 합니다. 영어에서 **plate 와 cut 은 그 자체가 동사**입니다 — plate 는
"판을 대다", cut 은 "자르다". 그래서 `how to plate & cut` 은 소프트웨어 사용법이 아니라
**제작 공정** 설명처럼 읽힙니다. `use` 를 넣으면 둘이 시트의 **키워드**라는 게 분명해집니다.

`Basics 01` 이 붙었으니 다음 편이 예약됩니다. 이 편에서 다루지 않은 것들이 그대로 목차입니다:

| 편 | 다룰 것 |
|---|---|
| **01 · PLATE & CUT** | **이 영상 — 판을 만들고, 구멍을 뚫고, 모듈과 조립체에 넣는 데까지** |
| 02 · BOQ & DXF | 산출서와 도면, 그리고 축척을 왜 물어보는가 |
| 03 · BAR & SECT | 봉·형강, 좌표 배치, `OFF_B` / `OFF_E` / `Alpha` |
| 04 · PARAM | 앞시트로 모델 전체를 몰기 (타워·스플라이스가 쓴 방식) |

**이 편은 모델이 서는 데서 끊습니다.** 시트를 읽고 모양이 서기까지가 한 덩어리이고,
거기서 뭘 뽑아내는지는 다른 이야기입니다. 한 영상에 둘 다 넣으면 배우는 사람이
어디까지가 "만들기"이고 어디부터가 "뽑기"인지 헷갈립니다.

## 5. 챕터

유튜브 설명문에 그대로 넣습니다. 각 구간 10초 이상이라 챕터로 인식됩니다.

```
0:00  What you will be able to write
0:16  PLATE — one row is one part
0:38  The nine reference points
1:00  Where do the holes come from?
1:41  Standing the plates up
2:32  BASE — the module's datum
2:46  ASSY — placing the module
```



## 6. 컷 리스트 — 3:23

`S` = 섹션 카드 · `T` = 타이틀/로고

| # | | 시작 | 길이 | 화면 | 자막 |
|---|---|---|---|---|---|
| **1** |  | 0:00 | 6s | 완성된 BASIC 모델이 `__reveal` 로 아래에서부터 쌓여 올라감 | **This is one spreadsheet.**<br>**By the end you will be able to write it.** |
| **2** | T | 0:06 | 4s | 타이틀 카드 | **HOW TO USE**<br>**PLATE & CUT** |
| 3 |  | 0:10 | 6s | Example ▸ **Basic** 행 테두리 → DOWNLOAD | *The file this video uses.* |
| **4** |  | 0:16 | 7s | input 시트 PLATE 블록 6행, 열 제목에 링 | **One PLATE row is one part.** |
| 5 |  | 0:23 | 7s | RECT / TRAP / CIRC 세 판이 하나씩 떠오름 | *Three shapes. RECT, TRAP, CIRC.* |
| 6 |  | 0:30 | 8s | TRAP 파라미터 · WT 를 WB→0 으로 줄이면 사각형이 삼각형 | *WT = WB is a rectangle. WT = 0 is a triangle.* |
| **7** |  | 0:38 | 7s | Guide 의 **9점 그림** | **Nine points. t/m/b × l/c/r.** |
| 8 |  | 0:45 | 7s | 사다리꼴 판 위에 9점 — ml/mr 이 **빗변 중점** | *On the real outline, not a bounding box.* |
| 9 |  | 0:52 | 8s | 같은 판을 `bc` → `mc` → `tl` 로 바꿔가며 배치 | *base.pt lands on the coordinate you type.* |
| **10** | S | 1:00 | 6s | **섹션 카드** — 판 하나가 화면에 남아 있고 그 위로 | **Every plate has holes.**<br>**Where do they come from?** |
| **11** |  | 1:06 | 6s | HOLE 3행 · 재질도 두께도 없음 | **HOLE is a shape, not a part.** |
| 12 |  | 1:12 | 7s | `CUT pl.clt -50 -50 ho.m26` — 구멍 하나 | *Which plate, where on it, which shape.* |
| **13** |  | 1:19 | 7s | 뒤에 `0 50 2` 가 붙으며 구멍이 세로로 셋 | **dx dy repeat — the first axis.** |
| **14** |  | 1:26 | 9s | 다시 `100 0 1` · **격자 3 × 2**, 옆의 두 번째 CUT 행이 사라짐 | **dx2 dy2 repeat2 — the second.**<br>**Two rows just became one.** |
| 15 |  | 1:35 | 6s | `CUT pl.cap -130 -130 pl.stf` — 스티프너 자국이 뚜껑에서 빠짐 | *A shape can be another plate.* |
| **16** | S | 1:41 | 5s | **섹션 카드** — 판들이 바닥에 흩어져 누워 있는 화면 위로 | **The parts exist.**<br>**Now stand them up.** |
| **17** |  | 1:46 | 7s | MODULE 블록 · PLATE 행과 나란히 | **PLATE defines. MODULE uses.** |
| 18 |  | 1:53 | 9s | PLANE 세 개: 판이 눕고(XY) · 서고(XZ) · 옆으로 선다(YZ) | *XY, XZ, YZ — which plane the plate lies in.* |
| **19** |  | 2:02 | 6s | 두께 그림 — 면 기준 ±THK/2 | **Thickness straddles that face.** |
| 20 |  | 2:08 | 7s | Guide 의 **bc / bc+ / bc−** 그림 | *bc+ puts the plus face on the line.* |
| **21** |  | 2:15 | 7s | `MODULE md.col pl.base mc- 0 0 0 XY` · 판이 z=0 위로 올라앉음 | **Type the drawing's dimension —**<br>**not the dimension plus half the thickness.** |
| **22** |  | 2:22 | 10s | 앵커볼트 **MODULE 4행이 1행으로** · **모델은 그대로** | **The same eight columns, in MODULE.**<br>**Four rows became one. The model did not move.** |
| **23** |  | 2:32 | 7s | `MODULE md.col BASE pl.base mc-` · 그 점에 마커 | **BASE is the module's datum. Required.** |
| 24 |  | 2:39 | 7s | 같은 모듈을 BASE 만 바꿔 두 번 배치 | *Read where it sits, and type that in ASSY.* |
| **25** |  | 2:46 | 6s | `ASSY as.bent md.col ADD 0 0 0` · 기둥 모듈이 원점에 | **ASSY places a module in the world.** |
| 26 |  | 2:52 | 6s | `MIR 1200 0 0 YZ` — 기둥이 x=1200 면 기준으로 **둘** | *MIR — mirrored about a plane you name.* |
| 27 |  | 2:58 | 6s | `COPY 0 3000 0 2` — 벤트가 3,000 씩 **셋** | *COPY — pushed along, repeat times.* |
| 28 |  | 3:04 | 6s | `ROT 0 0 25 Z 90 3` — 스티프너가 Z축 90°로 **넷** | *ROT — swung round an axis, repeat times.* |
| **29** |  | 3:10 | 8s | 1번과 같은 모델, 이번엔 완성된 채로 천천히 돈다 | **PLATE. CUT. MODULE. ASSY.**<br>**That is the whole model.** |
| **30** | T | 3:18 | 5s | 로고 | **PLATE3D by macroBIM** |

### 10·16번 — 섹션 카드

갑자기 시작하지 않기 위한 두 장입니다. **질문으로 열고 다음 챕터가 답이 됩니다.**

```
10   Every plate has holes.        →  11-15 이 HOLE 과 CUT
     Where do they come from?

16   The parts exist.              →  17-22 가 MODULE
     Now stand them up.
```

타이틀 카드(2번)와 같은 판이되 글자를 작게 씁니다 — 영상의 제목이 아니라 **장의 제목**입니다.
유튜브 챕터 경계도 이 두 장에 맞춰 놓았으므로, 목차로 뛰어들어와도 질문부터 보게 됩니다.

### 순서를 바꾼 이유 — 두께 ±면이 19-21번으로 내려간 것

`bc+` / `bc−` 는 **MODULE 행의 `Ref.Pt` 칸**입니다. 처음 판에서는 MODULE 을 소개하기
전에 이 셋을 넣어 뒀는데, 그러면 아직 본 적 없는 행을 예로 들어 설명하게 됩니다.
지금은 MODULE 을 먼저 세우고(17-18) 그 다음에 그 행의 칸으로 다룹니다.

배우는 순서가 이렇게 정리됩니다:

```
판을 그린다        PLATE          모양 세 가지
어디를 잡을지       base.pt        9점
구멍을 뚫는다       HOLE + CUT     격자 복사
세운다             MODULE         PLANE · 두께 면 · 격자 복사
어디에 놓을지       BASE           모듈의 기준점
놓는다             ASSY           ADD · MIR · COPY · ROT
```

**자막은 3~5초, 컷 길이는 화면이 정한다.**

### 25-28번 — 네 명령을 하나씩

한 컷에 셋을 몰아넣으면 3초씩이라 **결과가 안 읽힙니다.** 명령마다 컷을 줍니다.
넷이 다 교재 안에 있어서 워크북 변형도 필요 없습니다 — BASIC 의 ASSY 블록 그대로입니다:

| 컷 | BASIC 의 행 | 화면에서 일어나는 일 |
|---|---|---|
| 25 ADD | `as.bent md.col ADD 0 0 0` | 기둥 모듈이 원점에 선다 |
| 26 MIR | `as.bent md.col MIR 1200 0 0 YZ` | 기둥이 둘이 된다 |
| 27 COPY | `as.bent as.bent COPY 0 3000 0 2` | 벤트 전체가 셋이 된다 |
| 28 ROT | `as.stf as.stf ROT 0 0 25 Z 90 3` | 삼각 스티프너가 기둥을 돌아 넷이 된다 |

27·28번이 **`as.bent`·`as.stf` 자기 자신을 참조**한다는 점도 화면에 남습니다 —
조립체는 만들어 놓고 다시 재료로 쓸 수 있습니다.

### 13·14·22번 — 격자 복사

같은 여덟 칸이 **CUT 과 MODULE 에 똑같이** 붙는다. 한 번 배우면 두 군데 쓴다는 것이 요점.

```
dx  dy  [dz]  repeat        dx2  dy2  [dz2]  repeat2      →  (repeat+1) × (repeat2+1)
```

| | BASIC 이 지금 쓰는 방식 | 한 행으로 |
|---|---|---|
| CUT (14번) | `CUT pl.clt -50 -50 ho.m26 0 50 2`<br>`CUT pl.clt 50 -50 ho.m26 0 50 2` | `CUT pl.clt -50 -50 ho.m26 0 50 2 100 0 1` |
| MODULE (22번) | `bar.anch_1` … `bar.anch_4` 네 행 | 한 행 + `300 0 0 1` `0 300 0 1` |

**요점은 모델이 안 변한다는 것.** 화면에서 볼 것은 3D 가 아니라 시트다 — 행이 줄고
구멍·볼트는 그 자리에 그대로 있다.

## 7. 02편으로 넘긴 것 — BOQ 와 도면

이 편에서 뺐지만 조사는 끝나 있으므로 02편 스크립트의 출발점으로 남겨 둡니다.

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

가르칠 것은 **축척을 왜 물어보는가**입니다. 무엇을·어디서 볼지는 시트가 정했지만,
도면마다 크기가 달라서 **몇 분의 일로 그릴지는 종이의 성질**이고 시트가 알 수 없습니다.
그래서 내보낼 때 한 번 묻고, 고른 값을 파일 이름에 그대로 박습니다 — `..._A50-M20-P10.dxf`.

## 8. 촬영

| 규칙 | 이유 |
|---|---|
| **`__reveal(frac)` 로 쌓아 올린다** | 1번 컷. 케이스 워크북을 만들지 않고 완성 모델을 아래에서부터 등장시킨다 |
| **Guide 패널을 띄워 쓴다** | 9점·+/−면 그림은 앱 안에 이미 있다. 새로 그리면 문법이 바뀔 때 따로 논다 |
| **시트 행은 셀 카드로** | 스플라이스와 같은 방식. 설명하는 열에 링 |
| **자막 3~5초, 컷은 그보다 길게** | 자막은 읽히면 끝이고, 컷은 화면의 동작이 끝날 때까지 간다 |
| **챕터 경계에서 끊는다** | 유튜브 목차로 뛰어들어와도 문장 중간이 아니게 |
| **1번과 29번은 같은 모델** | 쌓아 올리며 열고, 완성된 채로 닫는다 — 그 사이가 이 영상이 가르친 것 |
| **13·14·22번은 워크북 변형이 필요하다** | 구멍 1개 → 한 줄 → 격자, 앵커 4행 → 1행. 전부 BASIC 의 CUT/MODULE 행만 고친 것이고 모델은 같아야 한다 — 같지 않으면 그 컷이 거짓말이 된다 |
| `shots.json` 을 **컷마다 저장** | 타워에서 52분 촬영 후 크래시로 타임라인을 잃음 |

## 9. 남은 결정

| | |
|---|---|
| 3:23 이 짧은가 | 30컷이 다 들어간 길이다. 더 필요하면 늘릴 곳은 18·22번(동작이 있는 컷)이지 자막이 아니다 |
| 한국어 자막 | 지금 자막은 영어. 유튜브 자막 트랙으로 한국어를 얹을지 |
