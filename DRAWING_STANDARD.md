# macroBIM 도면 작성 기준

**값의 원본은 [`drawing_standard.json`](drawing_standard.json) 하나다.** 상품마다 도면 엔진(비공개 PHP)이 따로 있어도
숫자는 여기서 가져간다 — 엔진 안에 숫자를 따로 적지 않는다. 값을 바꿀 때는 이 JSON 을 고치고, 각 엔진의
동기화 도구를 돌린다.

## 원칙

- **모든 크기는 종이 mm.** 도면은 «모델 공간 1:1(mm) + 축척만큼 키운 테두리» 로 그리므로, 모델 좌표의 길이 =
  종이 mm × 축척 분모. (1:150 도면에서 첫 치수선 10 mm = 모델 1,500 mm, 1:250 이면 2,500 mm. 단면도처럼 축척이 다른 뷰는 그 뷰의 축척을 곱한다.) DXF 의 `DIMSCALE` = 축척 분모.
- **치수는 CAD 의 치수 객체(DIMENSION)** — 끌면 값이 따라 바뀐다. 도면의 치수 글자는 **값만** (입력 변수 이름은 화면용).
- **축척은 표준 축척 중 A3 에 `fill`(80 %) 로 들어가는 것.** 단면도처럼 다른 축척의 뷰는 `DIMLFAC` 를 가진 치수 스타일을 따로.

## 값 (종이 mm)

| 무엇 | 키 | 값 |
|---|---|---|
| 도면 제목 / 부제 | `text.sheet_title` / `text.sheet_sub` | 8.0 / 3.5 |
| 뷰 제목 / 축척 글자 | `text.view_title` / `text.scale` | 5.0 / 2.5 |
| 치수 글자 | `text.dim` | 2.5 |
| NOTE 제목 / 본문 · 표제란 | `text.note_head` / `text.note` · `text.title_block` | 3.5 / 2.5 · 2.5 |
| 구조물 → 첫 치수선 | `dim.first` | 10.0 |
| 치수선 ↔ 치수선 | `dim.lane` | 7.0 |
| 보조선 틈 (구조물에서) / 넘김 (치수선 밖) | `dim.ext_gap` / `dim.ext_over` | 1.0 / 0.9 |
| 화살표 / 글자 띄움 | `dim.arrow` / `dim.text_gap` | 2.0 / 0.8 |
| A3 여백 (철 · 나머지) | `sheet.margin_binding` / `sheet.margin` | 20 / 10 |
| 뷰 사이 (좌우 / 위아래) | `sheet.view_gap_x` / `sheet.view_gap_y` | 20 / 14 |
| 뷰 제목 밑 ↔ 뷰(맨 바깥 치수 글자) | `sheet.view_title_clear` | 5.0 |
| 곡면 빗금 (원 · 반원 · 라운딩) | `hatch.curved_start_deg` ~ `curved_end_deg`, `curved_step_deg` 마다 | 실루엣에서 20° ~ 60°, 10° 마다 (한쪽 5줄: 0.94R · 0.87R · 0.77R · 0.64R · 0.50R). 외곽선 바로 옆(10°)은 비워 외곽이 두꺼워 보이지 않게, 가운데 절반(±0.5R)은 비움. 중심선은 긋지 않는다 |
| 단면 빗금 | `hatch.section_deg` | 45° |

글자 크기는 2026-11-15 스토어 옹벽 도면(미리보기 SVG 의 `data-mm`)에서 역산해 맞췄다. 치수선 간격은 역산값(첫 6.4 · 사이 5.4)이 A3 에서 좁아 보여
10 · 7 로 넓혔다(사용자 결정, 2026-11-15) — 스토어 도면도 이 값으로 옮긴다.

**치수선은 먼저 밀고, 뷰 크기는 그 뒤에 잰다.** 그래야 밀려난 치수선 · 글자가 제목이나 옆 뷰와 겹치지 않는다.

## 누가 쓰나

| 엔진 | 어디 | 상태 |
|---|---|---|
| PIER | 비공개 `macroPIER` `php/drawing_standard.php` ← `tools/sync_standard.js` 로 이 JSON 에서 생성 | **씀** |
| 스토어 옹벽 · 암거 | 비공개 `store` `api/wall.php` | **아직 숫자를 따로 적어 둠 — 이 JSON 으로 옮겨야 한다** |
