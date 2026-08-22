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
| **CUT 의 원점 (양쪽)** | `CUT pl.cap -130 -130 pl.stf` — **cap 의 `mc`** 에서 재고, **stf 의 `bl`** 이 그 자리에 온다 |
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
| 규격 | 3:25 · 2560×1440 · 30 fps · **무음 · 영어 자막만** |

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
1:43  Standing the plates up
2:34  BASE — the module's datum
2:48  ASSY — placing the module
```



## 6. 컷 리스트 — 3:25

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
| **11** |  | 1:06 | 7s | HOLE 3행 · 재질도 두께도 없는데 **base.pt 칸은 있다** | **HOLE is a shape, not a part.**<br>**No steel — but it still has an origin.** |
| **12** |  | 1:13 | 7s | `CUT pl.base -150 -150 ho.m26` · 판 한가운데 `mc` 마커 → 거기서 −150,−150 화살표 → 구멍 | **L.X L.Y is measured from the plate's origin —**<br>**the nine-point you chose on the PLATE row.** |
| **13** |  | 1:20 | 7s | 뒤에 `0 50 2` 가 붙으며 구멍이 세로로 셋 | **dx dy repeat — the first axis.** |
| **14** |  | 1:27 | 9s | 다시 `100 0 1` · **격자 3 × 2**, 옆의 두 번째 CUT 행이 사라짐 | **dx2 dy2 repeat2 — the second.**<br>**Two rows just became one.** |
| **15** |  | 1:36 | 7s | `CUT pl.cap -130 -130 pl.stf` — 뚜껑의 `mc` 에서 잰 자리에 삼각형의 `bl` 이 와서 **모서리가 정확히 깎임** | **A shape can be another plate —**<br>**and it lands by its own base.pt.** |
| **16** | S | 1:43 | 5s | **섹션 카드** — 판들이 바닥에 흩어져 누워 있는 화면 위로 | **The parts exist.**<br>**Now stand them up.** |
| **17** |  | 1:48 | 7s | MODULE 블록 · PLATE 행과 나란히 | **PLATE defines. MODULE uses.** |
| 18 |  | 1:55 | 9s | PLANE 세 개: 판이 눕고(XY) · 서고(XZ) · 옆으로 선다(YZ) | *XY, XZ, YZ — which plane the plate lies in.* |
| **19** |  | 2:04 | 6s | 두께 그림 — 면 기준 ±THK/2 | **Thickness straddles that face.** |
| 20 |  | 2:10 | 7s | Guide 의 **bc / bc+ / bc−** 그림 | *bc+ puts the plus face on the line.* |
| **21** |  | 2:17 | 7s | `MODULE md.col pl.base mc- 0 0 0 XY` · 판이 z=0 위로 올라앉음 | **Type the drawing's dimension —**<br>**not the dimension plus half the thickness.** |
| **22** |  | 2:24 | 10s | 앵커볼트 **MODULE 4행이 1행으로** · **모델은 그대로** | **The same eight columns, in MODULE.**<br>**Four rows became one. The model did not move.** |
| **23** |  | 2:34 | 7s | `MODULE md.col BASE pl.base mc-` · 그 점에 마커 | **BASE is the module's datum. Required.** |
| 24 |  | 2:41 | 7s | 같은 모듈을 BASE 만 바꿔 두 번 배치 | *Read where it sits, and type that in ASSY.* |
| **25** |  | 2:48 | 6s | `ASSY as.bent md.col ADD 0 0 0` · 기둥 모듈이 원점에 | **ASSY places a module in the world.** |
| 26 |  | 2:54 | 6s | `MIR 1200 0 0 YZ` — 기둥이 x=1200 면 기준으로 **둘** | *MIR — mirrored about a plane you name.* |
| 27 |  | 3:00 | 6s | `COPY 0 3000 0 2` — 벤트가 3,000 씩 **셋** | *COPY — pushed along, repeat times.* |
| 28 |  | 3:06 | 6s | `ROT 0 0 25 Z 90 3` — 스티프너가 Z축 90°로 **넷** | *ROT — swung round an axis, repeat times.* |
| **29** |  | 3:12 | 8s | 1번과 같은 모델, 이번엔 완성된 채로 천천히 돈다 | **PLATE. CUT. MODULE. ASSY.**<br>**That is the whole model.** |
| **30** | T | 3:20 | 5s | 로고 | **PLATE3D by macroBIM** |

### 11-12·15번 — CUT 이 어디서부터 재는가

**CUT 한 행에 9점이 두 번 들어갑니다.** 7-9번에서 배운 것이 여기서 값을 합니다.

```
CUT   pl.cap   -130 -130   pl.stf
      └ 어디서 재나 ┘       └ 무엇이 그 자리에 오나 ┘
      대상 판의 base.pt       놓이는 형상의 자기 base.pt
      = pl.cap 의 mc          = pl.stf 의 bl
```

> `CUT의 L.X / L.Y 는 대상 판의 원점(= 그 판의 BASE.pt)에서 잰다.`
> `놓이는 형상은 자기 BASE.pt 가 그 자리에 오도록 배치된다.` — DATA_SCHEMA.md

**15번이 이 규칙의 완성된 증거이고, 워크북에 이미 있습니다.** `pl.cap` 은 260×260 에
`mc`, `pl.stf` 는 TRAP 에 `bl` 입니다. cap 의 중심에서 −130,−130 은 **cap 의 좌하단
모서리**이고, 삼각형이 자기 `bl` 로 거기 앉으니 모서리가 정확히 깎입니다. 숫자 두 개가
왜 하필 −130 인지가 화면에서 저절로 설명됩니다.

여기서 헷갈릴 자리를 미리 막습니다: 판을 `mc` 로 잡으면 CUT 숫자가 **판 중심 기준**이라
음수가 자연스럽고, `bl` 로 잡으면 전부 양수가 됩니다. 둘 중 뭐가 맞는 게 아니라
**PLATE 행에서 고른 대로**라는 것이 요점입니다.

#### 뺀 컷 하나 — 원점을 옮겨서 보여주기

한동안 컷이 하나 더 있었습니다. CUT 행은 그대로 두고 **판의 base.pt 만 고쳐서
구멍이 따라 움직이는 것**을 보여주는, 반대 방향의 증거였습니다. 만들어서 재 봤더니
찍을 수가 없었습니다.

| 시도 | 총중량 | 뜻 |
|---|---|---|
| BASIC | 1700.88 kg | 기준 |
| `pl.base` 원점 `mc` → `bl` | **1702.75 kg** | +1.87 — 구멍이 판 밖으로 나가 안 뚫린다 |
| `ho.slot` 원점 `mc` → `bl` | **1701.00 kg** | +0.12 — 슬롯이 판 모서리에서 잘린다 |

**무거워졌다는 건 강재가 덜 빠졌다는 뜻**이고, 그건 구멍이 뚫기를 멈췄다는 뜻입니다.
`pl.base` 는 400×400 에 `mc` 이고 구멍이 ±150 에 있는데, 9점 중 중앙 말고는 전부
200mm 씩 떨어져 있어서 **어느 점을 골라도 구멍이 판을 벗어납니다.** 화면에는
"옮겨간다"가 아니라 "사라진다"로 찍힙니다.

12번이 원점 마커와 치수선으로 규칙을 말하고, 15번이 워크북에 이미 있는 행으로
증명합니다. 같은 이야기를 세 번째로 하려던 것이었고, 정직하게 찍을 방법이 없어서
아예 찍지 않습니다. 검증 스크립트가 이 판단을 대신해 줬습니다.

### 10·16번 — 섹션 카드

갑자기 시작하지 않기 위한 두 장입니다. **질문으로 열고 다음 챕터가 답이 됩니다.**

```
10   Every plate has holes.        →  11-15 가 HOLE 과 CUT
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
구멍을 뚫는다       HOLE + CUT     9점에서 재기 · 격자 복사
세운다             MODULE         PLANE · 두께 면 · 격자 복사
어디에 놓을지       BASE           모듈의 기준점
놓는다             ASSY           ADD · MIR · COPY · ROT
```

**`base.pt` 가 두 번 나옵니다.** 2행에서 "판의 어디를 잡을지" 정하고, 3행에서 그 점이
**CUT 이 재기 시작하는 원점**이 됩니다. 9점을 CUT 앞에 가르치는 이유가 이것입니다.

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

`-50 -50` 이 **`pl.clt` 의 `mc` 에서 잰 값**이라는 것도 12번에서 이미 깔아 뒀으므로,
여기서는 반복 열만 설명하면 됩니다.

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
| **12·15번은 마커와 화살표가 주인공** | CUT 이 어디서부터 재는지는 3D 만 봐서는 안 보인다. 판 위에 원점 마커를 찍고 거기서 구멍까지 치수선을 그린다 |
| **자막은 영어만** | 화면 자막도, 유튜브 자막 트랙도. 한국어 트랙은 넣지 않는다 |
| `shots.json` 을 **컷마다 저장** | 타워에서 52분 촬영 후 크래시로 타임라인을 잃음 |

### 워크북 변형 — 네 개, 전부 검증됨

전부 BASIC 의 셀 몇 개만 고친 것이다. **`tools/make_basic_cases.js` 가 만들고, 만든
것을 진짜 엔진에 넣어 부재 수와 총중량으로 확인한다** — 같아야 할 것이 같지 않으면
그 컷이 거짓말이 되기 때문이다.

| 파일 | 컷 | 고치는 것 | 부재 | 총중량 |
|---|---|---|---|---|
| `B13A` | 13 전 | `CUT pl.clt` 의 반복 3칸 비우고 둘째 행 삭제 | 90 | 1702.13 kg (구멍 1개) |
| `B13B` | 13 후 | 반복 `0 50 2` 만 되살림 | 90 | 1701.63 kg (구멍 3개) |
| `B14` | 14 | 둘째 `CUT pl.clt` 행 삭제 + 첫 행에 `100 0 1` | 90 | **1700.88 kg — BASIC 과 동일** |
| `B22` | 22 | `bar.anch_1`…`_4` 네 행 → 한 행 + 반복 8열 | 90 | **1700.88 kg — BASIC 과 동일** |

`B14` 와 `B22` 가 소수점까지 BASIC 과 같다는 것이 그 두 컷의 자막(*"the model did not
move"*)을 보증한다.

**검증이 형식이 아니었다.** `B22` 를 처음 만들 때 반복 8칸을 `OFF_B` 바로 뒤(M열)에
넣었는데, 좌표형 MODULE 은 `OFF_B`·`OFF_E`·`Alpha` 로 이어져서 실제로는 **O열**부터다.
시트는 초록 체크와 함께 `Succeed` 를 띄우고 **1,872 부재**를 깔았다. 부재 수를 안 셌으면
그대로 촬영에 들어갔을 것이다.

## 9. 확정

| | |
|---|---|
| 길이 | **3:25 · 30컷** |
| 자막 | **영어만.** 한국어 트랙 없음 |
| 화질 | **2560×1440 · 30 fps · 무음** — 촬영 2배 배율, 무손실 PNG, CRF 16 |

화질을 1080p 에서 올린 이유는 §10 에 적는다.

## 10. 화질 — 왜 1440p 인가

앞의 세 편은 1920×1080 이었고 해상도 자체는 맞았다. 문제는 그 앞이었다.

```
1  캡처      JPEG 품질 92          ← 1차 손실
2  정규화    JPEG -q:v 2 로 재인코딩  ← 2차 손실. 이미 JPEG 인 걸 또 굽는다
3  최종      H.264 CRF 21          ← 3차 손실
4  유튜브    자체 재인코딩            ← 4차. 이건 못 막는다
```

우리 화면은 **가는 선과 작은 글자**다. 압축이 제일 먼저 무너뜨리는 내용이고,
1080p 업로드는 유튜브가 가장 인색한 비트레이트를 주는 등급이다.

| | 앞의 세 편 | 이 편 |
|---|---|---|
| 캡처 배율 | 1× | **2× (`deviceScaleFactor`)** — 확대가 아니라 브라우저가 2배로 그린다 |
| 스틸 | JPEG q92 → 재인코딩 | **PNG 무손실** — 1·2차 손실이 사라진다 |
| 최종 | 1080p CRF 21 | **1440p CRF 16** |

**1440p 인 이유는 유튜브의 코덱 문턱이다.** 1440p 이상 업로드에만 VP9 이 붙고,
1080p 로 보는 사람도 그 더 좋은 스트림을 받는다. 4K 도 가능하지만 이 환경의 WebGL 은
swiftshader 소프트웨어 렌더라 촬영 시간이 몇 배가 된다 — 1440p 가 이득의 대부분을
가져오면서 감당되는 지점이다.
