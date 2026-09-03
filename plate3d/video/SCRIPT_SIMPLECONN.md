# Simple connector 영상 스크립트

## 1. 이 영상의 자리

| 영상 | 주장 | 파는 것 |
|---|---|---|
| `PLATE3D_promo.mp4` | 그림이 행에서 나왔다 | 가능성 |
| `PLATE3D_TOWER.mp4` | 그 행을 당신이 바꿀 수 있다 | 크기 |
| `PLATE3D_SPLICE.mp4` | 손이 제일 많이 가는 볼트 연결부를, 이미 쓸 줄 아는 도구로 | 쉬움 |
| **`PLATE3D_SIMPLECONN.mp4`** | **이 접합부에 넣을 수 있는 것이 이게 전부다** | **문턱** |

앞의 셋과 **만드는 방식부터 다릅니다.** 셋은 전부 "한 칸 바꿨더니 이렇게 되더라"
였습니다. 값이 변하는 것을 보여주는 영상이고, 시청자는 감탄은 하지만 **자기가
무엇을 할 수 있는지는 모른 채** 끝납니다.

이건 **안내**입니다. 형상을 먼저 보여주고, 그 형상이 어느 칸에서 나왔는지를
입력칸 순서대로 짚습니다. 다 보고 나면 **이 폼으로 무엇을 만들 수 있는지 목록이
머리에 남습니다.** 그게 이 영상이 파는 것입니다.

그리고 마지막에 뒤집습니다 — **`Export .xlsx`.** 시트는 사라진 게 아니라 폼이
대신 써 주고 있었고, 다 끝나면 그게 당신 것이 됩니다. 앞의 세 영상이 가르친
문법 그대로입니다. **문턱만 없앴지 길을 닫은 게 아닙니다.**

원본은 `plate3d/PLATE3D_COLUMN.xlsx`, 폼은 `plate3d/quick_simpleconn.js`.

## 2. 카피

```
COLUMN-BEAM JOINT BIM

Fill in the boxes.
The joint stands up in your browser.

Column in three pieces, H section or square tube,
up to four beams, the connection each one uses,
stiffeners and the copes they call for.

Then export the workbook.
The spreadsheet was there all along.
```

**말하는 방식이 정해집니다.** 스플라이스가 "이미 쓸 줄 아는 것으로" 였다면 이쪽은
**"쓸 줄 몰라도 된다"** 이고, 가운데 문단이 **할 수 있는 일의 목록**입니다.
카피에서 이미 목록인 것이 영상에서도 목록입니다.

## 3. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `STEEL COLUMN-BEAM JOINT BIM — Fill In a Form, See It in 3D \| PLATE3D` |
| 설명 1행 | `Fill in a form. The column-beam joint stands up in 3D BIM in your browser — nothing to install, nothing to download.` |
| 설명 2행 | `Column in three pieces, H or tube, up to four beams, the connections and the stiffeners — with the drawings and the take-off.` |
| 태그 | BIM · steel connection · column beam joint · splice · stiffener · coping · end plate · fin plate · shop drawing · DXF · BOQ · parametric model · structural steel · browser BIM · PLATE3D · macroBIM |
| 규격 | 약 2:40 · 1920×1080 · 30 fps · 무음 |

앞 영상들보다 **깁니다.** 안내라서 그렇습니다 — 여섯 블록을 하나씩 짚는 데
1분으로는 안 됩니다. 대신 **컷마다 하나씩만** 말합니다.

## 4. 자막 뼈대

| 컷 | 역할 | 문구 |
|---|---|---|
| 1 | 형상 | This joint. |
| 2 | 선언 | COLUMN-BEAM JOINTS. / NO SPREADSHEET. |
| 3 | 문턱 없음 | *Nothing to download. It is already open.* |
| 4 | 목록 | Everything it takes is in six blocks. |
| 5 | 기둥 | Three pieces. Put 0 in one and it goes. |
| 6 | 형강 | Name the section. Five boxes fill themselves. |
| 7 | 각관 | Or a tube. The detail follows. |
| 10 | 보 | Four directions. |
| 11 | 조인트 | Declare a connection. Name it against a beam. |
| 12 | 스티프너 | Where they meet, the flange comes off. |
| 15 | 반전 | The spreadsheet was there all along. |
| 16 | 서명 | PLATE3D by macroBIM |

1번이 **형상**으로 열고 15번이 **시트**로 닫습니다. 앞 영상들이 시트로 열어 형상으로
닫은 것과 반대입니다 — 안내는 "이게 뭔지" 부터 보여야 따라옵니다.

## 5. 컷 리스트

| # | 시간 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 6s | **완성된 접합부, 천천히 회전.** 이음·스티프너·네 방향 보·코핑된 플랜지가 한 바퀴에 다 보이게 | **This joint.** |
| 2 | 0:06 | 4s | 타이틀 카드 | **COLUMN-BEAM JOINTS.**<br>**NO SPREADSHEET.** |
| 3 | 0:10 | 6s | 사이드바 → **MacroPLATE3D** 펼침 → **Simple connector** → 폼이 뜸 | *Nothing to download. It is already open.* |
| 4 | 0:16 | 6s | 폼 전체를 위에서 아래로 한 번 훑음 · 여섯 장 제목만 밝게 | **Everything it takes**<br>**is in six blocks.** |
| 5 | 0:22 | 12s | **1장 Length** — upper 700 / middle 1400 / lower 700 에 링 · upper → **0** → 위 조각과 그 이음이 사라짐 → 되돌림 | **Three pieces.**<br>**Put 0 in one and it goes.** |
| 6 | 0:34 | 14s | **1장 Type = H** · Section 드롭다운 열림 → 이름 하나 고름 → **h·b·tw·tf·r·kg/m 여섯 칸이 스스로 채워짐** · Alpha 로 기둥을 90° 돌림 | **Name the section.**<br>**Five boxes fill themselves.** |
| 7 | 0:48 | 14s | **Type = R** · 같은 자리에 각관 목록 · 채워지는 칸이 달라짐(`tw/t` 하나, 필렛 대신 모서리 R) · **2장이 통째로 흐려지고**(각관은 스티프너를 못 받음) **3장이 엔드플레이트로 바뀜** | **Or a tube.**<br>**The detail follows.** |
| 8 | 1:02 | 10s | 다시 **H** 로 · **3장 COLUMN SPLICE PLATES** — 커버플레이트 3종 + 엔드플레이트, `over` 는 각관 줄에만 | *Cover plates on an H. An end plate on a tube.* |
| 9 | 1:12 | 8s | **4장 BOLTS** — dia · hole · grade, 그리고 **그립마다 따로 나오는 길이** | *One bolt row. Every grip gets its own length.* |
| 10 | 1:20 | 12s | **6장 BEAMS** — X+ X− Y+ Y− 네 줄 · **Y− Length 0 → 900** → 네 번째 보가 생김 | **Four directions.** |
| 11 | 1:32 | 16s | **5장 CONNECTION** 에서 `C1 end plate` · `C3 fin plate` 선언 → **6장 각 보의 Detail 칸 드롭다운**에 그 이름이 뜸 → Y+ 를 C1 로 바꿈 → 핀플레이트가 엔드플레이트로 | **Declare a connection.**<br>**Name it against a beam.** |
| 12 | 1:48 | 16s | **2장 COLUMN STIFFENER** — 레벨 8줄 · offset · width · depth · thick 짚기 → **thick 12 → 0** → 스티프너가 사라지고 **잘렸던 보 플랜지가 돌아옴** → 되돌리면 다시 잘림 | **Where they meet,**<br>**the flange comes off.** |
| 13 | 2:04 | 10s | 2장 **clearance 20 → 0** · 코핑 자국이 판에 딱 붙음 · 중량이 501.079 → **502.298** | *You set the room it leaves.* |
| 14 | 2:14 | 14s | **Save DXF** → 도면 · **Save BOQ** → 산출서 | *The drawings and the take-off come with it.* |
| 15 | 2:28 | 10s | **Export .xlsx** → 워크북 · PARAM 탭을 지나 **`input` 탭의 행들**이 흘러감 | **The spreadsheet**<br>**was there all along.** |
| 16 | 2:38 | 5s | 로고 | **PLATE3D by macroBIM** |

**총 2:43.**

### 순서의 논리

**기둥 → 보 → 둘을 잇는 것 → 기둥 속.** 조립 순서가 아니라 **읽는 순서**입니다.

| 묶음 | 컷 | 무엇을 답하나 |
|---|---|---|
| 형상 | 1–4 | 이게 뭐고, 어디서 여나 |
| **기둥** | 5–9 | 몇 조각인가 · 무슨 단면인가 · 이음을 어떻게 하나 |
| **보** | 10 | 몇 개까지, 어느 방향으로 |
| **접합** | 11 | 보를 기둥에 어떻게 붙이나 |
| **기둥 속** | 12–13 | 스티프너, 그리고 그것 때문에 잘리는 것 |
| 나오는 것 | 14–15 | 도면 · 산출서 · 그리고 시트 |

**12번이 마지막인 이유:** 코핑은 **보와 스티프너가 둘 다 있어야** 말이 됩니다.
보를 모르는 사람에게 "여기가 잘린다"고 해도 무엇이 무엇을 자르는지 안 보입니다.
10번에서 보를 세우고 11번에서 붙인 다음이라야, 12번에서 **스티프너를 끄면
플랜지가 돌아오는 것**이 인과로 읽힙니다.

**11번이 이 폼에서 제일 설명이 필요한 자리입니다.** 접합 상세를 **먼저 선언하고**
(5장) **보마다 이름으로 고르는**(6장) 두 단계인데, 두 장이 떨어져 있어서 화면만
봐서는 이어지지 않습니다. 그래서 **한 컷 안에서 5장 → 6장으로 커서를 옮깁니다.**

## 6. 실측값

기본값(H-300×300×10×15 r18 · 보 3개 · 스티프너 2단)에서 **한 칸씩만** 바꿉니다.
셀 카드는 앞 영상들과 같은 3단(원래값 → 커서 → 새 값). **모든 단계에서 겹침 0.**

| 컷 | 칸 | 값 | 부재 | 중량 | 코핑 행 |
|---|---|---|---|---|---|
| — | 기본 | — | 129 | 468.460 kg | 4 |
| 5 | 1장 upper Length | 700 → **0** | **81** | 393.050 kg | 4 |
| 7 | 1장 Type | H → **R-300×300×12 r30** | **47** | 560.000 kg | **0** |
| 10 | 6장 `Y−` Length | 0 → **900** | **134** | 501.079 kg | 4 |
| 12 | 2장 `thick` | 12 → **0** | 130 | 495.956 kg | **0** |
| 13 | 2장 `clearance` | 20 → **0** | 134 | **502.298 kg** | 4 |

10·12·13번은 **Y− 보를 세운 상태**가 기준입니다(134 부재). 12·13번이 10번 뒤에
오는 컷이므로 영상 순서와 같습니다.

**13번이 여유가 하는 일의 증거입니다.** 눈으로는 잘 안 보이지만 20 → 0 으로 줄이면
**1.219 kg** 이 더 남습니다 — 숫자가 실제로 강재를 움직인다는 것.

**12번은 코핑 행이 4 → 0 이 되는 것이 핵심입니다.** 스티프너를 끄면 폼이 내보내는
`NOTCH sc.bmc BY pl.stf1 20` 네 줄이 같이 사라집니다. 엔진이 몰래 자르는 게 아니라
**폼이 행을 써서** 자르는 것이고, 그래서 15번에서 `input` 탭을 열면 그 행이 실제로
거기 있습니다. **12번과 15번이 짝입니다.**

## 7. 14·15번 — 나오는 것

| 컷 | 버튼 | 규칙 |
|---|---|---|
| 14 | `File ▸ Save DXF` · `File ▸ Save BOQ` | 앞 영상과 같음 — **파일 생긴 대로 그린다**(`tools/dxf2svg.js`, `tools/xlsxpreview.js`). 다시 조판하지 않는다 |
| 15 | 폼의 **`Export .xlsx`** | 배포된 `PLATE3D_COLUMN.xlsx` 를 **패치해서** 내보냅니다. 드롭다운·정의된 이름·조건부 서식·카탈로그 탭이 그대로 있는 진짜 워크북 |

15번은 **`input` 탭까지 가야 합니다.** PARAM 탭만 보여주면 "폼이 폼을 내보냈다"로
읽힙니다. `input` 탭의 `SECT` · `PLATE` · `NOTCH` 행이 지나가야 **앞 세 영상과 같은
문법**이라는 것이 보입니다.

## 8. 촬영 규칙

| 규칙 | 이유 |
|---|---|
| **Section 이름을 바꾸는 컷(6번)은 같은 계열 안에서만** | H-300 → H-400 으로 건너뛰면 내측 플랜지판이 기둥 필렛을 파고들어 **겹침 16** 이 뜹니다 — 아래 「먼저 고칠 것」. 고치기 전에는 6번에서 **목록을 열어 보여주기만** 하고 고르지는 않습니다 |
| 변경 사이에 **View 버튼 금지** | 시점이 고정돼야 보가 생기고 플랜지가 잘리는 것이 보임 |
| **각관 기준으로 프레이밍**하고 H-300 을 그 카메라에 불러옴 | 7번에서 접합부가 통째로 바뀌는 것이 한 화면에 들어옴 |
| 폼은 **진짜 입력**으로 친다 | 값을 코드로 넣지 않고 칸에 타이핑 → `change` → 다시 그림. 폼이 실제로 도는 것이 이 영상의 주장 |
| 5·12번은 **껐다 되돌린다** | 사라지는 것만 보여주면 "없앨 수 있다"로 끝남. 돌아오는 것까지 보여야 **칸이 지배한다**로 읽힘 |
| 11번은 **한 컷 안에서 두 장을 오간다** | 선언(5장)과 지목(6장)이 떨어져 있어서, 컷을 나누면 이어지지 않음 |
| `shots.json` 을 **컷마다 저장** | 앞 영상들과 같음 |

## 9. 먼저 고칠 것

**단면을 바꾸면 스플라이스 내측 플랜지판이 기둥 필렛과 겹칩니다.**

```
겹침 16 = SC.C2 × PL.FI ×4 외      물린 크기 10 × 3.5 × 165
```

| | H-300×300×10×15 r18 | H-400×400×13×21 r22 |
|---|---|---|
| 필렛이 웹에서 뻗는 높이 `tw/2 + r` | 23 | **28.5** |
| 내측판 안쪽 모서리 `fiY − fiW/2` | 25 | **25** |
| | 2 여유 | **3.5 파고듦** |

내측판 자리는 볼트 줄에서 나옵니다(`fiY = fIT/2 + pFT/2 = 80`). 볼트 배치는 단면이
바뀌어도 그대로라 판도 25 에 서 있고, 필렛만 자라서 판을 밀고 들어옵니다.
**H-300 에서 안 걸린 것은 규칙이 아니라 2 mm 운입니다.**

스티프너 때와 같은 집안 문제입니다 — 웹·플랜지 구석에 오는 판은 `tw/2 + r` 을
비켜야 하는데 그것을 보는 데가 없습니다. 3장 `plates fit` 검사는 **판이 너무
넓은지**만 봅니다.

고치면 **6번이 제 몫을 합니다** — 목록을 열어 보여주는 데서 그치지 않고 이름
하나를 골라 여섯 칸이 채워지는 것까지. 안내 영상에서 제일 보여주고 싶은 컷입니다.

## 10. 파일

| | |
|---|---|
| 모델 | `plate3d/PLATE3D_COLUMN.xlsx` (Example 목록의 **Simple connector**) |
| 폼 | `plate3d/quick_simpleconn.js` · 모델은 `plate3d/column_model.js` |
| 화면 | 운영 사이트 **MacroPLATE3D → Simple connector** |
| 도구 | 앞 영상들과 동일 — `tools/mkpages.js` · `mkcards.js` · `rendercards.js` · `shoot.js` · `assemble.js` |
