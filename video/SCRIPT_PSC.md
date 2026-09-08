# PSC 영상 스크립트

## 1. 이 영상의 자리

지금까지 영상은 전부 PLATE3D 였습니다. **이건 그 바깥의 첫 영상이고, 한 편으로
끝납니다.** 시리즈가 아닙니다 — 뒤에 H Section·Channel 이 붙는 자리를 지금 열지
않습니다.

| 영상 | 주장 | 파는 것 |
|---|---|---|
| `PLATE3D_promo.mp4` | 그림이 행에서 나왔다 | 가능성 |
| `PLATE3D_TOWER.mp4` | 그 행을 당신이 바꿀 수 있다 | 크기 |
| `PLATE3D_SPLICE.mp4` | 손이 제일 많이 가는 연결부를, 이미 쓸 줄 아는 도구로 | 쉬움 |
| `PLATE3D_SIMPLECONN.mp4` | 이 접합부에 넣을 수 있는 것이 이게 전부다 | 문턱 |
| **`PSC.mp4`** | **치수를 치면 도면이 나온다. 단면 하나가 아니라 네 장이** | **속도** |

PLATE3D 영상들이 판 것은 **"시트가 형상이 된다"** 였습니다. 여기서 팔 것은 다릅니다.
PSC 는 3D 도 없고 산출서도 없습니다. 대신 **입력이 끝나는 순간 도면이 끝나** 있습니다.

그래서 이 영상의 마지막 컷은 DXF 입니다. 앞의 것은 전부 그 한 장을 위한 준비입니다.

**이 영상은 박스만 팝니다.** 철근은 나중 일이고, 여기서는 꺼내지 않습니다.

## 2. 카피

```
PSC BOX GIRDER SECTION

Type the dimensions.
The drawing is already done.

One cell or two. Begin and end,
and how far apart they sit.
Left tied to right, or not.

Then the DXF:
both sections, both slab plans.
```

**말하는 방식이 정해집니다.** SIMPLECONN 이 "쓸 줄 몰라도 된다" 였다면 이쪽은
**"칠 게 이것뿐이다"** 입니다. 가운데 문단이 **입력의 전부**이고, 마지막 문단이
**나오는 것의 전부**입니다. 둘 다 목록이고, 영상에서도 목록입니다.

## 3. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `PSC BOX GIRDER DRAWING \| macroBIM` |
| 설명 1행 | `Type the dimensions of a PSC box girder. The section drawing and both slab plans come out as DXF — in the browser, nothing to install.` |
| 설명 2행 | `One or two cells, a begin and an end section with the distance between them, left tied to right or free, and a batch block that fills every box at once.` |
| 태그 | PSC box girder · box girder · prestressed concrete · bridge section · tapered girder · variable depth · DXF · CAD drawing · parametric section · slab plan · concrete bridge · browser CAD · macroBIM |
| 규격 | 1:44 · 2560×1440 · 30 fps · 무음 · 432 스틸 · 자막 17장 |
| 썸네일 | `PSC_thumb.jpg` — `PSC BOX GIRDER` / `Section & slab plans, straight to DXF` |
| 공개 | **미정** |

### 설명란 전문

```
Type the dimensions of a PSC box girder. The section drawing and both slab plans come out as DXF — in the browser, nothing to install, nothing to download.

One or two cells, a begin and an end section with the distance between them, left tied to right or free — or one block of text that fills every box at once.

WHAT YOU TYPE
· 1 cell or 2 — one click, and the centre web appears with its own haunches
· 65 dimensions, twice — once for the begin section, once for the end
· Left tied to right, until you untie it — 29 pairs mirror, each with its own checkbox
· Cross slopes for the deck and the bottom slab, each side on its own
· Depth, cantilevers, webs, haunches, fillets — every one of them a box
· The distance between the two sections
· Any box takes arithmetic — 13600/2 is 6800

WHAT COMES OUT
· The guide, redrawn as you type, dimensioned
· The DXF — begin section, end section, top slab plan, bottom slab plan
· Webs and haunches on a hidden layer, so the plans read as plans
· A tapered girder needs nothing else: give the two ends and the length

BATCH INPUT
Four lines of comma-separated numbers — begin, end, section type, segment length.
Paste it and every box fills at once. Change one box and the block rewrites itself,
so a girder you already drew is four lines you can keep and paste back.

Try it: www.macroBIM.com — Drawings ▸ PSC

0:00 The section
0:09 Where to open it
0:14 Every dimension twice — begin and end
0:20 One cell or two
0:27 Left tied to right, until you untie it
0:34 The slopes, and the depth
0:49 A box takes arithmetic
0:54 A tapered girder — two sections and the distance
1:03 Batch input — four lines
1:21 Zoom in on any dimension
1:27 The DXF — both sections, both slab plans
```

**장 구분은 컷 그대로가 아니라 묶음입니다.** 15컷을 다 적으면 목록이 되지 설명이
안 됩니다. §5 의 「순서의 논리」를 그대로 열한 줄로 옮긴 것이고, 시간은 촬영
로그(`shots_psc.json`)에서 잰 것입니다.

**제목은 짧게 갑니다.** PLATE3D 영상들은 `이름 — 설명문 | PLATE3D` 였지만 여기서는
설명문을 붙이지 않습니다. 검색으로 찾아오는 말이 `PSC box girder drawing` 그대로이고,
설명은 바로 아래 두 줄이 합니다.

## 4. 자막 뼈대

| 컷 | 역할 | 문구 |
|---|---|---|
| 1 | 형상 | This section. |
| 2 | 선언 | PSC BOX GIRDER. / DIMENSIONS IN. DXF OUT. |
| 3 | 문턱 없음 | *Nothing to download. It is already open.* |
| 4 | 목록 | Every dimension twice. Begin and end. |
| 5 | 셀 | One cell or two. One click. |
| 6 | 대칭 | Type the left. The right follows — until you say no. |
| 7 | 편경사 | Each side has its own slope. |
| 7c | 형고 | Change the depth. The deck stays put. |
| 8 | 산술 | *A box takes arithmetic.* |
| 9 | 변단면 | A tapered girder — two sections and the distance. |
| 10 | 안내 | Begin, end, type, length. One line each. |
| 10b | 배치 | One paste. Every box. |
| 11 | 왕복 | *It writes itself back.* |
| 13 | 출력 | Both sections. Both slab plans. |
| 14 | 서명 | macroBIM |

**1번이 형상으로 열고 13번이 도면으로 닫습니다.** SIMPLECONN 과 같은 방향입니다 —
안내는 "이게 뭔지" 부터 보여야 따라옵니다. 다만 닫는 자리가 시트가 아니라 **DXF** 인
것이 다릅니다. 이 도구가 내놓는 것이 그것뿐이고, 그거면 됩니다.

## 5. 컷 리스트

| # | 시간 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 5s | **1 Cell 기본값 가이드**가 그려진 화면. 치수선까지 다 살아 있는 상태에서 천천히 줌인 | **This section.** |
| 2 | 0:05 | 4s | 타이틀 카드 | **PSC BOX GIRDER.**<br>**DIMENSIONS IN. DXF OUT.** |
| 3 | 0:09 | 7s | 사이드바 **Drawings 클릭**해 펼치고 그 아래 **PSC 클릭** → 화면이 뜸. 두 번 다 진짜 클릭이고 커서가 보임 | *Nothing to download.<br>It is already open.* |
| 4 | 0:16 | 6s | 표를 위에서 아래로 한 번 훑음. **36행 · Begin / End 두 열 · 입력칸 130개** | **Every dimension twice.**<br>**Begin and end.** |
| 5 | 0:22 | 10s | **1 Cell → 2 Cell** 라디오 클릭 → 표에 `2 Cell only` 그룹행이 나타나고 가이드에 중앙 복부가 생김 (**30선 → 40선**) → 다시 1 Cell 로 | **One cell or two.**<br>**One click.** |
| 6 | 0:32 | 12s | **WL** 6800 → **8000** 입력 → **WR 이 따라 8000** 으로 · 그다음 **⇄ 체크** → WR 만 **5000** 으로 고침 → 좌우가 다른 단면 | **Type the left.**<br>**The right follows —<br>until you say no.** |
| 7 | 0:44 | 10s | **SLL 2 → 6** → 좌측 데크가 기울어 끝이 **−136 → −408** 로 내려감 → 되돌림 · **SLR −2 → −6** → 이번엔 우측만 같은 만큼 → 되돌림 | **Each side<br>has its own slope.** |
| 7b | 0:54 | 6s | **SLB 0 → 3** → 하부 슬래브가 통째로 기욺 (좌 **−3114** · 우 **−2886**) → 되돌림 | *The bottom slab, too.* |
| 7c | 1:00 | 8s | **TH 3000 → 4200** → 박스가 깊어짐. **데크는 제자리**, 하부만 내려감 (−3000 → **−4200**) → 되돌림 | **Change the depth.**<br>**The deck stays put.** |
| 8 | 1:08 | 8s | 칸에 **`13600/2`** 를 치고 탭 → **6800** 이 되어 단면이 그대로 | *A box takes arithmetic.* |
| 9 | 1:16 | 14s | **End 열**을 고치고 이어서 **Segment Length** 를 침 — TH **2200**, WL·WR **6000**, WCAL2 **200**, WBL·WBR **3000**, 길이 **24000** · 가이드는 시작단면이라 그대로 · 표의 오른쪽 열과 길이 칸만 달라짐 | **A tapered girder —**<br>**two sections and the distance.** |
| 10 | 1:30 | 5s | 커서가 창 위의 **안내줄을 왼쪽에서 오른쪽으로 훑음** — `1st = BEGIN section / 2nd = END section / 3rd = section type / 4th = segment length` | **Begin, end, type, length.**<br>**One line each.** |
| 10b | 1:35 | 11s | **Batch Input** 창에 **4줄 CSV 를 붙여넣음** → **130칸이 한 번에** 바뀌고 Section Type·길이까지 따라오며 가이드가 다시 그려짐 | **One paste.**<br>**Every box.** |
| 11 | 1:46 | 8s | 반대 방향 — 칸 하나(**TTS 280 → 350**)를 고치자 **CSV 창의 그 자리 숫자가 따라 바뀜** | *It writes itself back.* |
| 12 | 1:54 | 8s | 가이드에서 **휠 줌 · 드래그 팬** 으로 헌치를 크게 보고 **REGEN** 으로 복귀 | *Zoom in on any dimension.* |
| 13 | 2:02 | 16s | **DXF 버튼** → 나온 파일을 열면 **네 장**. 위 두 장이 평면도, 아래 두 장이 단면. 상부 평면도의 **사다리꼴**(9번에서 준 테이퍼)과 **은선으로 깔린 복부·헌치**를 커서로 짚음 | **Both sections.**<br>**Both slab plans.** |
| 14 | 2:18 | 5s | 로고 | **macroBIM** |

**총 2:23.**

**7·7b·7c 는 한 덩어리입니다.** 셋 다 **한 칸을 고치면 형상이 그 자리에서 바뀌는 것**만
보여줍니다. 값을 바꾸고 **반드시 되돌립니다** — 되돌리지 않으면 9번의 테이퍼가 무엇
때문에 생긴 건지 흐려집니다.

### 순서의 논리

**단면 하나 → 좌우 → 양 끝 → 한 번에 → 나오는 것.**

| 묶음 | 컷 | 무엇을 답하나 |
|---|---|---|
| 형상 | 1–4 | 이게 뭐고, 어디서 여나 |
| **한 단면** | 5–8 | 셀이 몇 개인가 · 좌우를 어떻게 묶나 · **한 칸이 형상을 어떻게 바꾸나** · 칸에 뭘 칠 수 있나 |
| **두 단면** | 9 | 시작과 끝이 다를 수 있다 |
| **빠른 길** | 10–12 | 네 줄이 무엇인지 · 한 번에 넣는 법 · 되받는 법 |
| 나오는 것 | 13 | 도면 네 장 |

**9번이 13번의 전제입니다.** 평면도가 사다리꼴로 나오는 이유는 9번에서 끝단면을
다르게 줬기 때문입니다. 9번을 건너뛰면 13번의 평면도는 직사각형이고, 그러면
**"평면도가 두 단면에서 나온다"는 이 도구의 유일한 주장이 화면에 안 보입니다.**
그래서 9번은 길이를 줄이더라도 빼지 않습니다.

**10번이 10b 보다 먼저인 이유:** 배치입력은 낯선 기능이라 **네 줄이 뭔지 먼저
보여주고** 붙여넣어야 "이래서 편하구나" 가 됩니다. 순서를 뒤집으면 긴 숫자 뭉치가
지나간 것으로만 남습니다. 첫 판이 그랬습니다 — 붙여넣기만 있고 설명이 없었습니다.

**설명을 자막으로 새로 쓰지 않습니다.** 앱이 창 위에 이미 써 둔 안내줄을 커서로
훑습니다. 화면에 있는 문장을 읽게 하는 것이지, 영상이 따로 지어내는 것이 아닙니다.

**10b 가 11번보다 먼저인 이유:** 붙여넣기가 먼저 놀랍고, 되받아쓰기는 그 다음에야
"아 저게 왕복이구나" 로 읽힙니다. 순서를 뒤집으면 11번이 그냥 화면 갱신으로 보입니다.

**6번이 이 도구에서 제일 설명이 필요한 자리입니다.** 좌우가 묶여 있다가 체크 하나로
풀리는 동작은 한 컷 안에서 **묶임 → 풀림** 을 다 봐야 이해됩니다. 그래서 12초를 줍니다.

## 6. 실측값

전부 기본값에서 잰 값입니다. 화면에 뜨는 숫자와 같아야 합니다.

| 무엇 | 값 |
|---|---|
| 치수 개수 | **65** (`adefs_box12cell`) |
| 표 | **36행** · 입력칸 **130개** (65 × Begin/End) |
| 대칭 쌍 | **29** (`sym`) · 독립 쌍 **1** (`free` = SLL/SLR) · 단독 **5** · 그룹행 **1** (`2 Cell only`) |
| 1 Cell 단면 | **30선 · 6호** |
| 2 Cell 단면 | **40선 · 6호** |
| 1 Cell DXF | LINE **78** · ARC **12** · TEXT **4** |
| 2 Cell DXF | LINE **106** · ARC **12** · TEXT **4** |
| 배치 CSV 1줄 | **265자 · 65개** |
| 기본 단면 | TH 3000 · 전폭 13600 (WL 6800 + WR 6800) · 하부 7600 |
| 9번 끝단면 | TH **2200** · 전폭 **12000** (WL·WR 6000) · WCAL2 **200** · 하부 **6000** |
| 세그먼트 길이 | 입력값. 기본 **20000**, 9번에서 **24000** 으로 침 |

**끝단면 값은 형상이 성립하는 것으로 골라야 합니다.** 캔틸레버 사슬
`WTL + WCAL1 + WCAL2` 가 데크 반폭 `WL` 보다 넓으면 상부슬래브가 데크 밖으로
튀어나온 도면이 나옵니다. 첫 판이 그랬습니다 — WL 을 5200 으로 주면서 사슬
6500 을 그대로 뒀습니다.

| | 좌측 사슬 (데크끝 → 캔틸레버) | |
|---|---|---|
| 기본 WL 6800 | −6800 → −6500 → −5500 → −4500 | 정상 |
| 첫 판 WL 5200 | **−5200 → −6500** → −5500 → −4500 | 역전 |
| 지금 WL 6000 · WCAL2 200 | −6000 → −5700 → −5500 → −4500 | 정상 |

**7·7b·7c 에서 화면이 실제로 이렇게 움직입니다.** 기본값은 데크 양 끝 **−136**,
하부 **−3000**, 총높이 **3000** 입니다.

| 컷 | 바꾸는 값 | 움직이는 곳 | 안 움직이는 곳 |
|---|---|---|---|
| 7 | SLL **2 → 6** | 좌측 데크 끝 −136 → **−408** | 우측 −136 그대로 |
| 7 | SLR **−2 → −6** | 우측 데크 끝 −136 → **−408** | 좌측 −136 그대로 |
| 7b | SLB **0 → 3** | 하부 좌 −3000 → **−3114** · 우 −3000 → **−2886** (총높이 **3114**) | 데크 그대로 |
| 7c | TH **3000 → 4200** | 하부 −3000 → **−4200** (총높이 **4200**) | 데크 −136 그대로 |

**SLB 는 크라운이 아니라 한 방향 기울기입니다.** 좌가 내려가고 우가 올라갑니다 —
`PBL.y = −TH − WBL·SLB/100`, `PBR.y = −TH + WBR·SLB/100`. 화면에서 좌우가 반대로
움직이는 것이 이 값의 성격이므로, 한쪽만 잡고 찍으면 안 됩니다.

## 7. 나오는 파일 — 어떻게 그리나

`plate3d/video/README.md` 의 규칙이 그대로 적용됩니다. **DXF 는 파일 생긴 대로
그립니다.** `tools/dxf2svg.js` 로 그리고, 예쁘게 다시 조판하지 않습니다.

13번에서 화면에 나와야 하는 것:

```
                END SECTION
  TOP SLAB PLAN  |  BOTTOM SLAB PLAN
                BEGIN SECTION
```

| 뷰 | 레이어 |
|---|---|
| `END SECTION` | `psc` |
| `TOP SLAB PLAN` · `BOTTOM SLAB PLAN` | 윤곽 `psc` · 복부·헌치 `psc-hid` (은선) |
| `BEGIN SECTION` | `psc` |

평면도가 쓰는 y 의 양 끝이 곧 두 단면의 자리입니다 — 시작단면이 아래, 끝단면이
위. 단면과 평면도는 x 좌표가 같으므로 어긋내지 않습니다. 도면만 봐도 어느 단면이
평면도의 어느 끝인지 읽힙니다.

뷰 제목은 도면 안에 **TEXT 로 들어 있습니다.** 자막으로 덧붙이지 말고 파일에 있는
글자를 그대로 보여줍니다.

## 8. 촬영 규칙

- **값은 진짜로 친다.** 6·7·7b·7c·8·9·11번의 숫자는 실제로 타이핑하고, 화면이 다시
  그려지는 것을 그대로 담습니다.
- **바꾼 값은 되돌린다.** 7·7b·7c 는 되돌린 뒤 다음 컷으로 넘어갑니다.
- **클릭은 진짜 클릭.** 3·5·13번은 커서가 보이고, 눌린 뒤에 화면이 바뀝니다.
- **무음.** 자막만으로 읽힙니다.
- **철근은 안 나온다.** 박스만 파는 영상입니다.

## 9. 정해진 것

| 무엇 | 결정 |
|---|---|
| 제목 | **`PSC BOX GIRDER DRAWING \| macroBIM`** — 설명문 없이 |
| 파일 위치 | **`video/`** — PLATE3D 가 아니므로 `plate3d/video/` 아래로 넣지 않는다 |
| `► Tutorial` 버튼 | **안 만든다.** PSC 화면에서 영상으로 나가는 링크는 없다 |
| 시리즈 | **없다.** 한 편으로 끝난다 |
| 철근 | **안 다룬다.** 나중 일이다 |

## 10. 확정 대기

| 무엇 | 왜 물어보나 |
|---|---|
| **썸네일** | 제목이 정해졌으니 그에 맞춰 `PSC BOX GIRDER` / `SECTION & SLAB PLANS` 를 제안합니다 |
| **공개 주소** | 올린 뒤 3장 메타 표에 적습니다 |
| **길이** | 2:23 로 짰습니다. 더 짧게 가려면 **7b · 12번**이 먼저 빠집니다 (7 과 7c 는 형상이 바뀌는 것을 보여주는 자리라 남깁니다) |
