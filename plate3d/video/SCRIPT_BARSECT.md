# 교육 영상 03 스크립트 — BAR & SECT

## 1. 01편과 무엇이 다른가

01편은 **판**을 다뤘습니다. 판은 **그리는 것**입니다 — 외곽선을 주면 두께가 붙습니다.
이 편은 **봉과 형강**입니다. 이건 **그리는 게 아니라 규격표에서 골라 늘이는 것**입니다.

| | PLATE | BAR / SECT |
|---|---|---|
| 무엇을 주나 | **모양** — 외곽선 + 두께 | **단면 치수** — 직접 적는다 |
| 길이는 | 모양 안에 있음 | **어디에 놓느냐가 정함** |
| 배치 | 평면에 눕힘 (PLANE) | **두 점 사이에 늘임** (좌표) |
| 기준점 | 9점 중 하나 | 단면의 BASE.pt, 축선을 탐 |

**개념부터, 정확하게.**

| | 무엇인가 | 무엇을 적나 |
|---|---|---|
| **PLATE** | 판 — **모양이 곧 부재** | 외곽선 + 두께 |
| **BAR** | **원형 막대기.** 그게 전부다 | **지름 하나** + 길이 |
| **SECT** | **형강** — H · C · L 세 골격 | **단면 치수를 직접** + 길이 |

판은 그리면 그게 부재입니다. 봉과 형강은 **단면과 길이가 따로**입니다:

```
    단면                          길이
    치수를 적어서 정의한다          어디에 놓느냐가 정한다
    H  200 200 200 8 12 12 16      2,400  ← 두 점 사이 거리
    Ø  24                          또는 SECT / BAR 행에 적은 값
```

### 규격표는 앱 안에 없습니다

이게 핵심입니다. `SECT` 는 규격명을 **고르는** 게 아니라 **치수를 적는** 것입니다.
`H` 는 "H형강"이라는 **골격**을 뜻하고, 실제 모양은 뒤에 적는 일곱 값이 정합니다.

그래서:

- **규격품** H-200×200×8×12 → `H 200 200 200 8 12 12 16`
- **사용자 정의 단면** — 웨브 1,200 짜리 조립 거더 → `H 1200 400 400 12 25 25 0`

**둘의 입력 방식이 같습니다.** 규격표에 없는 단면도 그냥 적으면 됩니다. 상·하 플랜지의
**폭과 두께를 따로** 받는 것도 그래서입니다 — 비대칭 조립 거더가 실무에 흔합니다.

> 규격표를 쓰고 싶으면 **자기 시트 안에** 표를 두고 `VLOOKUP` 으로 끌어옵니다.
> 스플라이스 예제가 그렇게 합니다 — 앞장에서 규격명 하나 고르면 일곱 칸이 채워집니다.
> 앱은 숫자만 받으므로 그 표는 **쓰는 사람 것**이고, 회사 표준이든 KS 든 자유입니다. (04편 소재)

앱도 왼쪽 목록을 **PLATES · BARS · SECTIONS 세 표로 나눠** 둡니다. 만들어지는 방식이
다르기 때문입니다. **SECTIONS 표를 클릭하면 단면 도면이 열리고 치수를 잴 수 있습니다** —
판에는 없는 것입니다.

그리고 배치는 **두 가지가 다 됩니다.** 이 편이 01편과 갈리는 지점입니다.

## 2. 교재 — 또 `PLATE3D_BASIC.xlsx`

01편과 **같은 파일**입니다. 새 예제를 만들지 않습니다. 이 한 장에 BAR·SECT 로 가르칠 것이
전부 들어 있고, 몇 군데는 시트 자신이 주석으로 설명까지 해 둡니다.

| 배울 것 | BASIC 의 어디 |
|---|---|
| BAR 한 줄 | `BAR bar.anch SS400 24 6000` |
| **길이는 참고값** | 15행 주석이 그렇게 적혀 있음 — *"6000 = stock length. Reference only: md.col cuts it"* |
| SECT 세 타입 | `sc.col` **H**(값 7) · `sc.brc` **L**(값 6) · `sc.str` **C**(값 6) |
| H 는 상·하가 따로 | `200 200 200 8 12 12 16` — bb·bt 와 tf1·tf2 가 각각 |
| **평면 배치도 된다** | `sc.col` 은 `0 0 25 XY`, `sc.bm` 은 `0 0 3037 YZ` — 형강인데 평면 문법 |
| **두 문법이 한 모듈에** | `md.col` 37~40행 PLANE · 42~45행 좌표 |
| 좌표 배치 | `md.bay` 59~61행 — *"coordinate grammar: stretched point to point"* |
| OFF 양수 | 브레이스 `170 170`, 스트럿 `110 110` |
| **OFF 음수** | 앵커볼트 `-50` — 베이스판을 뚫고 들어감 |
| **Alpha** | `sc.str` 의 `90` — 채널이 돌아 앉음 |
| L 은 등변도 네 값 | `65 65 6 6` |

| ASSY 명령 | `as.bent` 의 ADD · MIR · COPY, `as.stf` 의 ROT |

없는 것은 **좌표 형식의 2축 반복** 하나뿐이고, 그건 01편에서 만든 `B22` 를 그대로 씁니다.

**낱장 BAR·SECT 를 MODULE 없이 ASSY 에 바로 넣는 것**도 됩니다 — 확인했습니다:

```
ASSY  as.t  bar.t  ADD   0 0 0
ASSY  as.t  sc.t   ADD   600 0 0
ASSY  as.t  as.t   COPY  0 800 0 2
  → plates 1 · bars 1 · sections 1 · modules 0 · assy 1 → placed 6
```

`modules 0` 인데 6부재가 섭니다. 부재 하나짜리 모듈을 만들 필요가 없습니다.

## 3. 메타

| 항목 | 내용 |
|---|---|
| 유튜브 제목 | `How to Model Bars and Rolled Sections in a Spreadsheet \| PLATE3D Basics 03` |
| 화면 타이틀 | `HOW TO USE` / `BAR & SECT` |
| 설명 1행 | `A profile from the catalogue, stretched between two work points, and trimmed back to the steel.` |
| 설명 2행 | `Everything here is one shipped example: Example ▸ Basic.` |
| 규격 | 4:02 · 2560×1440 · 30 fps · **무음 · 영어 자막만** |
| 썸네일 | `01 BASICS` 자리에 `03 BASICS`, 문구 `HOW TO USE` / `BAR & SECT` |

## 4. 챕터

```
0:00  A plate, a bar, a section
0:24  BAR — a round bar
0:38  SECT — H, C and L, dimensioned by you
1:26  Two ways to place it
2:05  Work points, and the steel
2:51  Repeating, and placing
```

## 5. 컷 리스트 — 4:02

`S` = 섹션 카드 · `T` = 타이틀/로고

| # | | 시작 | 길이 | 화면 | 자막 |
|---|---|---|---|---|---|
| 1 |  | 0:00 | 6s | BASIC 벤트가 쌓여 올라감 — 마지막에 **판을 흐리고 형강만** 남김 | **Not every part is a plate.**<br>**Some are a profile with a length.** |
| **2** | T | 0:06 | 4s | 타이틀 카드 | **HOW TO USE**<br>**BAR & SECT** |
| 3 |  | 0:10 | 6s | 왼쪽 목록 — **PLATES(6) · BARS(1) · SECTIONS(4)** 세 표 | **The app keeps them in three tables.**<br>**They are made differently.** |
| **4** |  | 0:16 | 8s | PLATE · BAR · SECT 세 행을 나란히 | **A plate is a shape.**<br>**A bar is round. A section is a profile you dimension.** |
| 5 |  | 0:24 | 7s | 시트 BAR 행 + 왼쪽 **BARS** 표 | **BAR is a round bar. Nothing else.**<br>**Material, diameter, length.** |
| 6 |  | 0:31 | 7s | `preview BAR.ANCH` — 원형 단면 | *A round bar. There is no shape to draw.* |
| **7** |  | 0:38 | 8s | 시트 SECT 4행, TYPE 열에 링 | **SECT is a section — H, C or L.**<br>**That is the skeleton. The numbers after it are the shape.** |
| **8** |  | 0:46 | 8s | **SECTIONS** 표 클릭 → 단면 도면 열림 · measure | **There is no section table in here.**<br>**You type the dimensions — and it draws them.** |
| **9** |  | 0:54 | 9s | `preview SC.COL` (H) · 값 7개에 링 | **H takes seven.**<br>**Top and bottom flange are separate — width and thickness.** |
| **10** |  | 1:03 | 8s | `preview SC.STR`(C) → `SC.BRC`(L) | *C and L take six each — and the six mean different things.* |
| 11 |  | 1:11 | 6s | `sc.brc` 의 `r` 자리 · 각진 모서리 | *Leave r blank and that corner comes out square.* |
| **12** |  | 1:17 | 9s | 같은 `H` 행에 **웨브 1,200 조립 거더** 치수 · 규격품 옆에 나란히 | **Standard or custom, it is the same row.**<br>**Nothing in here is looking anything up.** |
| **13** | S | 1:26 | 5s | **섹션 카드** — 브레이스가 남은 채 | **A profile needs a length.**<br>**Where does it come from?** |
| **14** |  | 1:31 | 9s | `md.col` 의 **두 블록이 나란히** — 37~40행과 42~45행, 8번째 칸에만 링 | **One keyword, two grammars.**<br>**The eighth column decides.** |
| **15** |  | 1:40 | 9s | **평면 방식** — `sc.col … 0 0 25 XY` · 기둥이 서고 길이는 SECT 행에서 | **A plane name: stand it here, run it the plane’s way.**<br>**XY is +Z. XZ is −Y. YZ is +X.** |
| **16** |  | 1:49 | 9s | **좌표 방식** — `sc.brc 0 -150 0 → 2400 -150 3000` · 브레이스가 늘어남 | **Two points instead.**<br>**Stretch it from here, to there.** |
| 17 |  | 1:58 | 7s | SECTIONS 표 길이 칸의 **`ref`** 표시 | **Then the Length in the SECT row is only a reference.**<br>**The app says so.** |
| **18** | S | 2:05 | 5s | **섹션 카드** — 브레이스 끝단 위로 | **The two points are work lines.**<br>**The steel is not.** |
| **19** |  | 2:10 | 9s | 브레이스 끝 **확대** · 절점과 강재 끝 사이 170 | **Type the node. Then trim the steel.** |
| **20** |  | 2:19 | 9s | `OFF_B 0` ↔ `170` — 강재가 절점에서 물러남 | **Positive pulls back from the node.** |
| **21** |  | 2:28 | 9s | 앵커볼트 `-50` · 베이스판을 **뚫고 들어감** | **Negative runs past it —**<br>**into a gusset, into a base plate.** |
| 22 |  | 2:37 | 7s | 실제 길이 = 두 점 거리 − 양단 OFF | *Real length is the distance, less both ends.* |
| 23 |  | 2:44 | 7s | `sc.str` 의 `Alpha 90` ↔ `0` · 카메라 고정 | **Alpha turns it about its own axis.**<br>**The two points do not move.** |
| **24** | S | 2:51 | 5s | **섹션 카드** — 앵커 한 개가 남은 채 | **One row is one member.**<br>**How do you get a hundred?** |
| **25** |  | 2:56 | 9s | 좌표 형식 뒤 **반복 8칸** — 앵커 4행이 1행으로 | **dx dy dz repeat, twice over.**<br>**On both grammars.** |
| **26** |  | 3:05 | 8s | `ASSY as.bent md.col ADD 0 0 0` | **ASSY places what a MODULE built.** |
| 27 |  | 3:13 | 7s | `MIR 1200 0 0 YZ` — 기둥이 둘 | *MIR — mirrored about a plane you name.* |
| 28 |  | 3:20 | 7s | `COPY 0 3000 0 2` — 벤트가 셋 | *COPY — pushed along, repeat times.* |
| 29 |  | 3:27 | 7s | `ROT 0 0 25 Z 90 3` — 스티프너가 넷 | *ROT — swung round an axis, repeat times.* |
| **30** |  | 3:34 | 8s | **MODULE 없이** BAR·SECT 를 ASSY 에 바로 — `modules 0` | **A bar can skip the module**<br>**and go straight into the assembly.** |
| 31 |  | 3:42 | 7s | SECT 에 CUT → **길이 전체가 잘림** | **A CUT on a section cuts all of it.**<br>**Not a hole — a saw.** |
| **32** |  | 3:49 | 8s | 완성 벤트가 천천히 돔 | **PLATE. BAR. SECT.**<br>**One sheet.** |
| **33** | T | 3:57 | 5s | 로고 | **PLATE3D by macroBIM** |

### 1번 — 판을 흐리는 이유

01편은 완성 모델을 그냥 쌓아 올렸습니다. 이 편은 **같은 모델에서 형강만 남깁니다.**
판을 배운 사람이 이 편을 열면 "저건 이미 안다" 가 되고, 남은 것이 이 편의 주제가 됩니다.
`togglePvMember` 로 판을 끄거나, 투명도를 내립니다.

### 14~16번 — 이 편에서 제일 중요한 컷

**같은 `MODULE` 키워드가 두 가지로 읽힙니다.** BASIC 의 `md.col` 하나에 둘이 같이 있습니다:

```
MODULE  md.col  pl.base    mc-   0    0    0     XY                  ← 평면 문법
MODULE  md.col  bar.anch_1       -150 -150 25   -150 -150 -250  -50  ← 좌표 문법
                                                └ 8번째 칸이 숫자 ┘
```

> `PLANE 자리(8번째 칸)가 평면 이름이면 각도 방식, 숫자면 좌표 방식이다.`
> `LX2/LY2/LZ2 세 칸 중 하나라도 숫자면 좌표 방식으로 읽는다` — DATA_SCHEMA.md

**한 화면에 두 블록을 나란히** 놓고 8번째 칸에만 링을 겁니다. 이게 안 잡히면
뒤의 OFF·Alpha 가 전부 공중에 뜹니다.

### 18~22번 — 절점과 강재

이 편에서 **실무자가 값을 치르고 가져가는 부분**입니다. 절점은 작업선의 교점이고,
강재는 거기서 물러나 있거나 파고들어 있습니다. 시트에는 **절점을 적고**, OFF 로 강재를 맞춥니다.

```
             OFF_B = +170                      OFF_B = −50
   ●━━━━━━┅┅┅┅━━━━━━●              ●┅┅┅┅━━━━━━━━━━━━●
   절점    강재                      절점  강재가 절점을 지나 더 나감
   (클리어런스)                      (베이스판 매입)
```

BASIC 에 양수·음수가 **둘 다** 있습니다 — 브레이스 `170`, 앵커 `−50`. 만들 필요가 없습니다.

**21번이 특히 셉니다.** 앵커볼트가 베이스판 속으로 들어가 있는 걸 잘라서 보여주면
"음수는 파고든다" 가 한 번에 들어옵니다.

### 31번 — 경고 컷

> `SECT에 CUT을 걸면 길이 전체가 잘린다 — 판의 구멍과 의미가 다르니 주의.`

판에 익숙해진 사람이 **반드시 한 번은 밟는 지뢰**입니다. 판에서 CUT 은 구멍이지만
형강에서는 톱질입니다. 짧게, 그러나 분명히 넣습니다.

## 6. 워크북 변형 — 세 개

01편과 같은 방식으로 `tools/make_barsect_cases.js` 가 만들고 **엔진에 넣어 검증**합니다.

| 파일 | 컷 | 고치는 것 | 확인 |
|---|---|---|---|
| `C20` | 20 | `sc.brc_1` 의 `OFF_B`·`OFF_E` 를 `170` → `0` | 부재 수 같고 **중량 늘어남** (강재가 길어짐) |
| `C23` | 23 | `sc.str` 의 `Alpha` 를 `90` → `0` | 부재 수·**중량 동일** (돌기만 함) |
| `C31` | 31 | `sc.str` 에 `CUT` 행 추가 | **중량 줄어듦** — 길이 전체가 잘린 증거 |
| `C12` | 12 | `sc.col` 을 `H 1200 400 400 12 25 25 0` 조립 거더로 | **부재 수 같고 중량 크게 늘어남** — 규격표 없이도 서는 증거 |
| `B22` | 25 | 01편 것 재사용 | 이미 검증됨 |

**`C23` 의 중량이 소수점까지 같아야 합니다.** Alpha 는 부재를 돌릴 뿐 옮기지도 자르지도
않으므로, 달라지면 그 컷의 자막이 거짓이 됩니다.

## 7. 04편으로 넘기는 것

- `COORD YUP` — 예전 Y-up 시트 읽기
- `VIEW` 키워드와 도면 목록 (02편 소재)
- 부재 ID 를 수식으로 비워 행을 끄는 방법 (`=IF(조건,"bo.M22","")`) — PARAM 편에서

## 8. 촬영

| 규칙 | 이유 |
|---|---|
| **끝단은 확대해서 본다** | OFF 170 은 3,900 길이 부재에서 4%다. 전체를 잡으면 안 보인다 |
| **단면은 앱의 SECTIONS 표에서 연다** | 단면 도면은 앱이 그린다. 새로 그리면 필렛이 엔진과 따로 논다 |
| **두 문법은 한 화면에** | 나란히 놓지 않으면 "8번째 칸" 이 무슨 말인지 안 잡힌다 |
| **Alpha 는 같은 자리에서만 돈다** | 카메라를 고정하고 부재만 바꾼다. 카메라가 움직이면 뭐가 돌았는지 모른다 |
| **자막 3~5초, 컷은 화면이 정한다** | 01편과 같음 |
| `shots.json` 을 **컷마다 저장** | 01편과 같음 |

## 9. 확정 대기

| | |
|---|---|
| 길이 | **4:02 · 33컷** |
| 순서 | 개념 → BAR → SECT → **두 배치 방식** → OFF · Alpha → **반복 · ASSY 명령** → 경고 |
| 31번(CUT 경고) | 넣을지 뺄지 |
