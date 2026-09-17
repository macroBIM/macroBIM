# 인천대교 모델링 강의편 — 대본

`PLATE3D_INCHEON_HOWTO.mp4` — 약 9분 30초 · 1920×1080 · 30 fps

**한국어 내레이션 + 영어 자막.** 짧은 편(`PLATE3D_INCHEON.mp4`, 101초)이
일반 관객용 발견이라면, 이 편은 **전환**입니다 — 끝까지 보는 사람이 적은 것이
정상이고, 그 사람들이 파일을 받습니다.

## 숫자 규칙

> **숫자가 「성과」면 말하고, 「일의 양」이면 말하지 않는다.**

| 말한다 | 말하지 않는다 |
|---|---|
| 800 m · 케이블 208가닥 · 도면 8장 | 513행 · 453행 · 566부재 |

같은 숫자라도 앞엣것은 자랑이고 뒤엣것은 숙제입니다. 첫 문장에 숙제를 박으면
아무도 안 봅니다.

## TTS 로 받는 법

**문장마다 파일 하나씩**, `n01.mp3` … 순서대로. 한 덩어리로 받지 마세요.

1. 파일마다 길이를 정확히 잽니다
2. **쉬는 간격을 TTS 가 아니라 이쪽이 정합니다** — TTS 의 문장 사이 호흡은
   대개 영상에는 짧습니다
3. 한 문장만 다시 뽑아도 나머지가 안 흔들립니다

받은 뒤에 각 파일 길이를 재서 타임라인을 확정하고, **거기에 맞춰 그림을
렌더합니다.** 목소리를 늘이거나 줄여 맞추면 바로 들립니다 — 맞추는 쪽은
언제나 그림입니다.

숫자와 단위는 **읽히는 대로** 적어 두었습니다("1,480 m" 가 아니라
"천사백팔십 미터"). 서비스에 따라 다르니 한 번 들어 보고 고치세요.

---

## 0. 인트로 — 0:40

| # | 한국어 (읽는 말) | English (자막) | 화면 |
|---|---|---|---|
| n01 | 인천대교. 우리나라를 대표하는 다리죠. | The Incheon Bridge — Korea's landmark crossing. | 완성된 다리, 천천히 회전 |
| n02 | 이걸 엑셀로 만들 수 있습니다. | You can build it in Excel. | **컷** — 엑셀 시트 |
| n03 | 플레이트쓰리디 하나면 됩니다. 어렵지 않습니다. | All it takes is PLATE3D. It is not hard. | 앱 화면 |
| n04 | 지금부터 같이 만들어 보겠습니다. | Let's make it, step by step. | 빈 시트 |

**n02 의 컷이 이 영상에서 제일 중요한 한 프레임입니다.** 다리에서 엑셀로
넘어가는 그 대비가 어떤 대사보다 셉니다.

## 1. 받기 — 0:40

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n05 | 먼저 macroBIM 사이트로 갑니다. 설치할 건 없습니다. 브라우저에서 바로 돌아갑니다. | Start at macroBIM. Nothing to install — it runs in the browser. | 사이트 → PLATE3D |
| n06 | 왼쪽 메뉴에서 PLATE3D, 오른쪽 위 Example 을 누릅니다. | PLATE3D on the left, then Example, top right. | 메뉴 → Example 창 |
| n07 | 맨 위 Template 을 받으세요. 모든 키워드가 주석으로 들어 있는 빈 시트입니다. | Take the Template at the top — a blank sheet with every keyword in it, commented out. | Template 행 → DOWNLOAD → SAVED |
| n08 | 이 파일은 아무것도 만들지 않습니다. 그게 이 파일의 쓸모입니다. | It builds nothing. That is what it is for. | 엑셀에서 열린 템플릿 |

## 2. 계획 — 1:20

**「계획을 세우자」가 아니라 「플레이트쓰리디가 뭘 할 줄 아는지 보고, 그러니
이렇게 하자」입니다.** 계획하면서 도구를 가르칩니다.

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n09 | 치기 전에, 이 도구가 뭘 할 줄 아는지부터 봅니다. | Before typing, look at what the tool can do. | 템플릿 헤더들이 차례로 |
| n10 | 단면은 타이핑으로 만듭니다. 카탈로그가 없습니다. 치수를 직접 적습니다. | Sections are typed. There is no catalogue — you write the dimensions. | `# SECT` 헤더 |
| n11 | 굵기가 변하는 부재도 됩니다. 단면 둘을 부르면 그 사이를 세워 줍니다. | A member can change section: name two, and it flows between them. | `# TAPER` 헤더 |
| n12 | 부재는 두 점 사이에 세웁니다. 시작점과 끝점만 있으면 됩니다. | A member goes between two points. Start and end, that is all. | `# MODULE` 헤더 |
| n13 | 그리고 대칭으로 뒤집을 수 있습니다. | And it can be mirrored. | `# ASSY` 헤더 |
| n14 | 그러면 인천대교는 이렇게 나누면 되겠습니다. | So the bridge splits like this. | 4분할 다이어그램 |
| n15 | 상판, 주탑, 케이블, 교각. 넷입니다. | Deck, pylon, cables, piers. Four. | 각각 색으로 |
| n16 | 주탑 다리는 올라가면서 가늘어집니다. 변단면으로 만들면 되겠네요. | The pylon legs taper as they rise — so, a tapered member. | 주탑 확대 |
| n17 | 케이블은 직선입니다. 시작점과 끝점만 있으면 한 줄이면 됩니다. | A cable is a straight line. Two points, one row. | 케이블 한 가닥 |
| n18 | 그리고 다리는 좌우가 똑같습니다. 반쪽만 쓰고 뒤집으면 됩니다. | And the bridge is symmetric — write half, mirror it. | 반쪽 → 전체 |
| n19 | 하나만 더 정하고 갑니다. 안 만들 것도 정해야 합니다. | One more decision: what NOT to model. | 상판 단면 |
| n20 | 이 모델은 겉면만 만듭니다. 안쪽 보강재는 넣지 않습니다. 그래서 앱이 보여주는 무게는 참고만 하세요. | This model is the outer surface only — no internal stiffeners. So take the weight it reports as a guide, not a quantity. | 결과 패널의 무게 |

**n19–n20 을 빼지 마세요.** 안 짚으면 파일 받은 사람이 그 무게 숫자를 믿습니다.

## 3. 상판 한 마디 — 1:10

첫 결과가 빨리 나와야 합니다. **세 줄로 부재 하나를 세웁니다.**

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n21 | 상판부터 하겠습니다. 인천대교 상판은 속이 빈 박스입니다. | The deck first. It is a hollow box. | 상판 단면 사진/도면 |
| n22 | 단면 한 줄을 씁니다. 타입은 R, 사각 강관입니다. | One section row. Type R — a rectangular tube. | `SECT sc.gb SM490 15000 R mc 1371 17600 30 0` |
| n23 | 높이 천삼백칠십일, 폭 만칠천육백, 두께 삼십. 그게 전부입니다. | 1,371 deep, 17,600 wide, 30 thick. That is the whole section. | 셀 하나씩 강조 |
| n24 | 이제 어디에 놓을지 한 줄. 시작점과 끝점입니다. | Now where it goes — one row, start point and end point. | `MODULE md.dck sc.gb … -740000 0 76268.5 → -660000 0 76268.5` |
| n25 | 그리고 세상에 올리는 한 줄. | And one row to put it in the world. | `ASSY as.dck md.dck ADD …` |
| n26 | Load Excel 을 누릅니다. | Press Load Excel. | 버튼 → 3D |
| n27 | 세 줄로 부재 하나가 섰습니다. 나머지는 전부 이걸 반복하는 겁니다. | Three rows, one member. Everything else is this, repeated. | 상판 한 마디가 화면에 |

**n27 이 이 영상의 약속입니다.** 여기서 "아, 되겠는데" 가 나와야 나머지 7분을
봅니다.

## 4. 주탑 — 1:20

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n28 | 주탑입니다. 해수면에서 이백삼십팔 미터. | The pylon — 238 metres above the sea. | 주탑 전체 |
| n29 | 그런데 다리가 올라가면서 가늘어집니다. 아래는 굵고 위는 얇습니다. | But the legs taper as they rise: thick at the bottom, thin at the top. | 아래·위 단면 비교 |
| n30 | 이럴 때 단면 둘을 씁니다. 시작 단면 하나, 끝 단면 하나. | So write two sections — one for each end. | `sc.la` 10000 / `sc.lb` 8000 |
| n31 | 그리고 그 둘을 이어 주는 한 줄. | And one row to flow between them. | `TAPER tp.lg1 sc.la sc.lb mc mc mc 55382.8` |
| n32 | 이제 이건 새 부재입니다. 다른 부재처럼 이름으로 부르면 됩니다. | That is a new member now, called by name like any other. | MODULE 에서 `tp.lg1` |
| n33 | 계단처럼 끊기지 않고 흐릅니다. | It flows instead of stepping. | 주탑 다리 확대, 회전 |

## 5. 케이블 — 1:30

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n34 | 이제 케이블입니다. 이 다리의 주인공이죠. | Now the cables — the thing that makes this bridge. | 부채 전체 |
| n35 | 케이블은 강선을 묶어 관에 넣은 겁니다. 그러니 단면은 파이프입니다. | A stay is strand inside a sheath, so the section is a pipe. | `SECT sc.ca SM570 250000 P mc 200 14` |
| n36 | 그리고 케이블은 직선입니다. 휘지 않습니다. | And a stay is straight. It does not sag. | 케이블 한 가닥 |
| n37 | 그래서 한 줄이면 한 가닥입니다. 주탑의 정착점에서, 상판의 정착점까지. | So one row is one cable — from the pylon anchorage to the deck anchorage. | `MODULE md.stay sc.cb … -396360 -700 189800 → -377500 -16000 76954` |
| n38 | 한 줄 쓰고, 끌어서 복사하면 됩니다. 엑셀이니까요. | Write one, then drag to copy. It is a spreadsheet. | 셀 드래그, 행이 늘어남 |
| n39 | 그렇게 부채 하나가 만들어집니다. | And a fan comes out. | 부채가 채워짐 |
| n40 | 인천대교는 케이블이 이백여덟 가닥입니다. | The Incheon Bridge has 208 of them. | 부채 전체, 회전 |
| n41 | 그리고 이 파일은 이미 예제에 들어 있습니다. 직접 다 치실 필요 없습니다. 받아서 열어 보세요. | And this file is already in the Example list. You do not have to type it — just take it. | Example 창의 Incheon Bridge 행 |

**n41 이 이 영상의 다운로드 유도입니다.** 문법을 다 가르친 뒤, 출력물 보여
주기 전. 여기가 "이걸 다 쳐야 하나" 싶은 지점이라 **안도**가 됩니다.

## 6. 대칭 — 0:50

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n42 | 지금까지 만든 건 다리의 왼쪽 반입니다. | What we have is the left half. | 반쪽만 있는 다리 |
| n43 | 오른쪽은 똑같습니다. 그러니 다시 칠 필요가 없습니다. | The right half is the same, so it does not get typed again. | 한 줄 강조 |
| n44 | 한 줄이면 됩니다. 중앙을 기준으로 뒤집습니다. | One row. Mirror about mid-span. | `ASSY as.stay as.stay MIR 0 0 0 YZ` |
| n45 | 그리고 이렇게 쓰면 좌우가 다르게 틀릴 수가 없습니다. | And written this way, the two halves cannot disagree. | 전체 다리 완성 |

**n45 가 이 절의 요점입니다** — 편해서 쓰는 게 아니라 **틀릴 수 없어서** 씁니다.

## 7. 도면과 물량 — 1:30

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n46 | 모델이 됐으면, 이제 받을 것을 받습니다. | The model is done. Now take what it gives you. | 완성된 다리 |
| n47 | 어떤 그림이 필요한지 시트에 적습니다. 한 줄이 도면 한 장입니다. | Say which drawings you want, in the sheet. One row, one drawing. | `VIEW ALL FRONT … 2000 INCHEON BRIDGE - GENERAL ARRANGEMENT` |
| n48 | 일반도, 평면도, 주탑 입면, 주탑 단면. 축척도 그 줄에 같이 적습니다. | General arrangement, plan, pylon elevation, pylon section — the scale goes on the row too. | VIEW 여덟 줄 |
| n49 | 그리고 Save DXF. | Then Save DXF. | 버튼 → DXF |
| n50 | 도면 여덟 장이 한 파일로 나옵니다. 캐드에서 바로 열립니다. | Eight drawings, one file, straight into CAD. | 도면 여덟 장 |
| n51 | 물량표도 버튼 하나입니다. Save BOQ. | The take-off is one button too. Save BOQ. | 버튼 → 워크북 |
| n52 | 부재별로 규격과 수량과 길이가 정리돼서 나옵니다. | Every member, by size, count and length. | BOQ 워크북 스크롤 |
| n53 | 모델 하나로 그림과 수량이 같이 나옵니다. 따로 세지 않아도 됩니다. | One model, and both the drawings and the quantities come out of it. | 도면 + 물량표 나란히 |

**이 절이 전문가한테는 결정타입니다.** 짧은 편은 "엑셀로 다리를 그렸다"로
끝나지만, 그건 신기한 것이지 쓸 물건이 아닙니다. **물량표와 도면이 나온다는
것이 장난감과 업무 도구를 가르는 선입니다.**

## 8. 마무리 — 0:40

| # | 한국어 | English | 화면 |
|---|---|---|---|
| n54 | 정리하면, 단면을 쓰고, 어디에 놓을지 쓰고, 대칭으로 뒤집습니다. | So: write the section, write where it goes, mirror it. | 세 줄 요약 |
| n55 | 그게 전부입니다. 나머지는 이걸 반복하는 겁니다. | That is all of it. The rest is that, repeated. | 완성된 다리 |
| n56 | 인천대교 파일은 예제에 있습니다. 받아서 숫자 하나 바꿔 보세요. | The Incheon file is in the Example list. Take it, change a number. | 사이트 |
| n57 | 브라우저에서 바로 돌아갑니다. macroBIM 입니다. | It runs in the browser. macroBIM. | 로고 |

---

## 꼭 넣어야 하는 한 문장

앞 영상의 **가설 애니메이션은 이 워크북에 없습니다.** 66장의 단계 워크북은
별도 스크립트가 만든 것이고 배포하지 않습니다. 받는 것은 **완성된 다리**입니다.

n41 이나 n56 옆에 한 문장으로 붙이세요:

> *"앞 영상에서 다리가 지어지는 장면은, 같은 시트를 단계마다 다시 쓴 것입니다."*
> *"In the last film, the bridge went up by writing this same sheet once per stage."*

얼버무리면 파일을 받아 본 사람이 바로 압니다.

## 만들 때 순서

1. 대본을 TTS 에 넘겨 **문장마다 파일 하나씩** (`n01`…`n57`)
2. 파일 길이를 재서 **타임라인 확정**
3. 그 타임라인에 맞춰 **그림 생성** — 목소리가 먼저, 그림이 나중
4. 음악은 목소리 밑으로 눌러서(ducking) 얹기

3·4번은 **새 도구가 필요합니다** — 내레이션 길이에 맞춰 그림을 뽑는 촬영기와
`score.js` 의 ducking. 코드는 별도 창에서.
