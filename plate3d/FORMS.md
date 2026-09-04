# 폼과 예제 — 폼은 자유롭게, 예제는 한 벌로

MacroPLATE3D 의 폼(Simple connector, 그리고 뒤따를 것들)과 Example 목록의
워크북은 **같은 모델을 두 가지 크기로 내놓는 일**이다. 이 문서는 그 둘을
어떻게 갈라 두기로 했는지, 그리고 왜 그렇게 정했는지 적는다. 대화에만 두면
다음에 또 처음부터 이야기하게 된다.

## 규칙

> **폼에서는 개수를 묶지 않는다. 예제 워크북만 한 벌 크기로 찍어 둔다.**

- **폼** — 접합 타입이 몇 개든, 거더가 몇 개든, 부재가 몇 줄이든 사용자가
  늘리고 줄인다. 폼은 HTML 이라 애초에 묶일 이유가 없었다.
- **Export .xlsx** — 사용자가 적은 **그 크기 그대로** 워크북을 만들어 준다.
- **Example 다운로드** — 대표값 한 벌(예: 접합 6타입)로 **미리 찍어 둔 파일**을
  올려 둔다. 처음 오는 사람이 열어 보는 것은 작고 완결된 한 장이어야 한다.

앞으로 만들 폼도 전부 이 방식이다.

## 왜 지금까지 묶여 있었나

Simple connector 의 접합 라이브러리는 **C1~C6 여섯 줄로 고정**이다. 폼이
못 해서가 아니라 **워크북이 그렇게 생겨서**다.

```js
column_model.js:341
const R = { title:1, sub:2, … nHead:46, nCols:47, cn0:48, nNote:54, nChk:55, … };
```

`cn0:48` 과 `nNote:54` 사이가 여섯 줄이다. **행 지도가 상수**라서 줄을 하나
늘리면 아래가 통째로 밀린다. 그래서 폼도 여섯 줄에 맞춰져 있었다.

그리고 Export 는 워크북을 **만들지 않고 고쳐 쓴다**:

```js
quick_simpleconn.js:33
/* Export patches the shipped workbook rather than building one. …
   Rebuilding all of that in a browser would be a second definition of the
   same layout, and the first one to be edited would be the one nobody noticed. */
```

**이 주석이 반대한 것은 「두 번째 정의」이지 「브라우저에서 만드는 것」이
아니다.** 브라우저용 시트 작성 코드를 따로 쓰면 `tools/make_column.js` 와
두 벌이 되고, 한쪽만 고치면 조용히 갈라진다. 그게 걱정이었다.

## 그래서 세 번째 길 — 한 정의, 두 호출자

이미 모델에는 쓰고 있는 방식이다.

```js
column_model.js:7
"It does no arithmetic of its own. column_model.js holds the defaults, the
 derivations and the rows the engine reads, and the generator that writes the
 .xlsx calls the same module - so the two cannot disagree about what a column is."
```

**모델은 이미 한 벌을 Node 와 브라우저가 나눠 쓴다.** 시트 작성기만 아직
그렇지 않다. 같은 수를 한 단계 위에 두면 된다.

```
                     ┌─ tools/make_*.js (Node)  →  예제 워크북, 대표값 한 벌
sheet writer (UMD) ──┤
                     └─ 폼의 Export (브라우저) →  사용자가 적은 크기 그대로
```

## 옮기는 데 드는 것 — 재봤다

`tools/make_column.js` 562줄 중 Node 에만 있는 것은 이것뿐이다.

| Node | 브라우저에서는 |
|---|---|
| `require('exceljs')` | 폼이 **이미 로드한다** (`exceljs.min.js`) |
| `fs.readFileSync` 로 CSV 2개 | 폼이 **이미 fetch 한다** (`catalogues()`) |
| `fs.writeFile` | Blob 내려받기 — **이미 하고 있다** |
| `require('../column_model.js')` | **이미 UMD 라 브라우저에서 돈다** |

**나머지는 순수 ExcelJS 호출이라 그대로 돈다.** 새로 쓰는 게 아니라 옮겨
담는 일이다.

## 진짜 바뀌는 것은 하나 — 행 지도

`R` 을 **상수에서 누적 오프셋으로** 바꾼다: `nNote = cn0 + conn.length` 처럼.

`R.` 을 읽는 곳이 `column_model.js` 50군데, `tools/make_column.js` 76군데지만
**전부 읽기**다. 지도를 만드는 방식만 바꾸면 읽는 쪽은 손댈 것이 없다.

같이 봐야 할 것이 하나 더 있다. **Import 도 고정 행에서 읽는다.** 행 수가
변하면 **시트에서 개수를 먼저 읽어 지도를 다시 세워야** 한다.

## 포맷 잠금은 막지 않는다 — 확인했다

```js
tools/lock_format.js:12
locked      sheet names and order, column order and headings, layer names,
            entity kinds, block banners, the file-name rule, every
            dimension-style constant, the keyword grammar
not locked  weights, member counts, part ids, row counts, timestamps
```

**`row counts` 는 애초에 잠겨 있지 않다.** 그리고 `FORMAT_LOCK.json` 이 무는
책은 `PLATE3D_BASIC.xlsx` 와 `PLATE3D_SPLICE.xlsx` 둘이고, 잠그는 것은 **출력
포맷**(BOQ·DXF)이지 입력 시트의 행 배치가 아니다. 손님과의 약속은 그대로
지켜진다.

## 판형교는 이게 선택이 아니다

**거더 개수가 변한다.** 5거더 교량과 9거더 교량은 행 수가 다르고, 가로보 칸
수도 따라 변한다. 판형교 워크북은 **애초에 고정 행 지도를 가질 수가 없다.**

그러니 이 일은 "나중에 편해지자" 가 아니라 **판형교를 하기 전에 끝내야 하는
일**이다.

## 순서

1. **시트 작성기를 UMD 로 분리** — 한 정의, 두 호출자
2. **행 지도를 상수 → 누적 오프셋** (`R`, 그리고 Import 쪽)
3. 판형교 폼 — 타입 개수도 거더 개수도 자유
4. 예제 워크북은 대표값 한 벌로 찍어 Example 목록에 넣는다

**1·2 는 Simple connector 에도 그대로 이득이다** — C1~C6 제한이 풀리고,
사용자가 내려받은 워크북이 자기 크기를 갖게 된다.

## 안 정한 것

1. **예제 워크북의 「한 벌」이 몇 개인가** — 접합 6타입은 지금 값이고, 판형교의
   주형·가로보 타입 개수는 아직 안 정했다. 폼이 자유로워지면 이건 **예제의
   보기 좋은 크기**를 고르는 문제이지 제약이 아니다.
2. **Import 가 개수를 어디서 읽나** — 머리글 행에 개수를 적을지, 블록의 끝을
   빈 줄로 볼지. 전자가 튼튼하고 후자가 사람이 고치기 쉽다.
