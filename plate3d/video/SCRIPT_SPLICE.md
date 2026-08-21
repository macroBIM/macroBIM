# 스플라이스 영상 스크립트

세 번째 영상이고, 앞의 둘과 주장이 다릅니다.

| 영상 | 주장 |
|---|---|
| `PLATE3D_promo.mp4` | 그림이 행에서 나왔다 |
| `PLATE3D_TOWER.mp4` | 그 행을 당신이 바꿀 수 있다 |
| **`PLATE3D_SPLICE.mp4`** | **바뀐 건 모델만이 아니다 — 산출서와 도면도 같이 바뀐다** |

타워는 **크기**를 팔았습니다. 스플라이스는 **납품물**을 팝니다. 같은 시트 하나에서
모델·BOQ·DXF가 전부 나오고, 셀 하나를 고치면 셋이 같이 따라옵니다. 그게 앞의 두
영상이 하지 않은 이야기입니다.

원본은 `plate3d/PLATE3D_SPLICE.xlsx` — 106행 → 66부재 · 208 kg.

## 제목 · 설명 · 태그

```
BOLTED SPLICE — BIM 3D MODEL, BOQ AND SHOP DRAWING FROM ONE SPREADSHEET | PLATE3D
```

설명문 첫 두 줄:

```
A bolted beam splice: 66 members, 44 bolts, detailed in a spreadsheet.
Change the section and the model, the take-off and the shop drawing all follow.
```

태그: `BIM`, `bolted splice`, `steel connection`, `shop drawing`, `DXF`, `BOQ`,
`bill of quantities`, `parametric model`, `structural steel`, `Excel`, `PLATE3D`,
`macroBIM`

## 자막 다섯 줄이 뼈대

```
1   질문   What if one spreadsheet gave you the model, the take-off and the drawing?
2   선언   ONE JOINT.  EVERY DELIVERABLE.
4   소유   Download the example.  Now you have a splice.
5   통제   Pick a section.  The joint follows.
12  마무리 One spreadsheet.  Model, take-off, drawing.
13  서명   PLATE3D by macroBIM
```

1번과 12번이 **model / take-off / drawing** 세 단어로 열고 닫습니다. 타워 영상이
*Spreadsheet* 로 수미상관을 만든 것과 같은 방식입니다.

## 컷 리스트 — 100초 · 1920×1080 · 30 fps · 무음

| # | 시간 | 화면 | 자막 |
|---|---|---|---|
| **1** | 0:00–0:05 | 스플라이스 접합부, 천천히 회전 · 볼트가 보이게 | **What if one spreadsheet gave you the model, the take-off and the drawing?** |
| **2** | 0:05–0:09 | 타이틀 카드 | **ONE JOINT.**<br>**EVERY DELIVERABLE.** |
| 3 | 0:09–0:15 | 커서가 메뉴 오른쪽 끝 **Example** 로 → 줌 → 클릭 | *Runs in the browser. Nothing to install.* |
| **4** | 0:15–0:22 | 리스트에서 **Beam splice** 행 테두리 → DOWNLOAD 클릭 → SAVED | **Download the example.**<br>**Now you have a splice.** |
| **5** | 0:22–0:29 | PARAM 시트, 파란 칸에 링 | **Pick a section.**<br>**The joint follows.** |
| 6 | 0:29–0:42 | ① **단면** `H-300×300 → H-400×400` — 드롭다운에서 고르면 H·B·t1·t2·r·kg/m 여섯 칸이 스스로 채워짐 | *Section · 94 → 172 kg/m* |
| 7 | 0:42–0:52 | ② **볼트 배치** `Long N 4 → 6` — 피치가 다시 계산되고 볼트 수가 44 → 60 | *Bolts · 44 → 60* |
| 8 | 0:52–1:00 | ③ **간격** `Joint gap 20 → 40` | *Gap · 20 → 40* |
| **9** | 1:00–1:12 | **File → Save BOQ** · 나온 워크북의 SUMMARY / PART LIST 스크롤 | *The take-off comes with it.* |
| **10** | 1:12–1:26 | **File → Save DXF** · 5장의 도면 · 치수와 피치 체인 클로즈업 | *So does the drawing.* |
| 11 | 1:26–1:33 | 접합부 히어로 팬 | — |
| **12** | 1:33–1:38 | 모델·BOQ·도면 세 장을 한 화면에 | **One spreadsheet. Model, take-off, drawing.** |
| **13** | 1:38–1:43 | 로고 | **PLATE3D by macroBIM** |

## 세 가지 변경

기본값에서 **한 칸씩만** 바꿉니다. 셀 카드는 타워와 같은 3단(원래값 → 커서 → 새 값)이고,
오른쪽 회색 칸이 같이 움직이는 게 요점입니다.

| | 셀 | 값 | 같이 변하는 것 |
|---|---|---|---|
| ① 단면 | `PARAM!C6` | H-300×300 → **H-400×400** | D..I 여섯 칸(H·B·t1·t2·r·kg/m)이 드롭다운 하나로 채워짐 · clear web depth · member centre |
| ② 판 | `PARAM!C14` | 상부 판 폭 280 → **380** | plate steel, kg |
| ③ 볼트 | `PARAM!C27` `C29` | Long N 4 → **6** | flange pitch · 볼트 총수 |

**①이 이 영상의 핵심입니다.** 드롭다운에서 규격을 고르면 여섯 칸이 스스로 채워집니다 —
KS 58개 규격 표가 시트 안에 들어 있고, 그걸 참조하는 수식이 이미 걸려 있기 때문입니다.
사람이 치는 건 이름 하나입니다.

**단면·판·볼트는 각각 독립 입력입니다.** 판 치수가 단면에서 파생되지 않는 것은 설계
의도입니다 — 400 플랜지에 280 판을 쓰는 것도 유효한 설계이고, 어떤 판을 쓸지는 사람이
정합니다. 시트는 `clear web depth` 와 `member centre` 를 계산해 두어 그 판단의 근거를
줍니다. 그래서 영상에서도 ① 단면 → ② 판 → ③ 볼트를 **각각 독립된 컷**으로 보여주는
편이 맞습니다. 셋이 서로 묶여 있지 않다는 것이 이 도구의 성격이니까요.

## 9번 BOQ · 10번 DXF — 이 영상의 이유

앞의 두 영상에 없던 부분입니다.

**BOQ** (`File ▸ Save BOQ`) 는 앱이 실제로 내보내는 워크북입니다. SUMMARY 와 PART LIST
두 시트가 나오고, 부재별 규격·수량·중량과 총계가 들어 있습니다. 화면에 나오는 표는
그 파일을 그대로 읽어 그립니다.

**DXF** (`File ▸ Save DXF`) 는 `input` 시트의 **VIEW** 행이 지시한 도면입니다. 스플라이스
워크북에는 VIEW 행이 5개 있어서, 도면이 5장 나옵니다 — 치수선, 피치 체인(`4@75=300`),
숨은선 컨텍스트까지 들어간 상태로요. 10번 컷의 클로즈업은 그 피치 체인입니다.

두 컷 다 **"버튼을 눌렀더니 파일이 나왔다"** 를 보여주는 것이지, 파일을 흉내 낸 그림이
아닙니다.

## 촬영

**케이스 사이에 View 버튼 금지.** 시점이 고정돼야 접합부가 커지는 게 보입니다.

**커서·줌·클릭**은 타워 영상과 같은 방식입니다 — 커서를 페이지 안에 넣고, 스크린샷
클립을 좁혀 확대하고, 앱의 진짜 핸들러를 부릅니다.

**①의 드롭다운**은 셀 카드로 처리합니다. 엑셀의 실제 드롭다운 UI를 찍으려면 엑셀이
필요한데 이 환경에 없습니다. 카드에 규격 이름이 바뀌고 여섯 칸이 채워지는 것으로 충분히
읽힙니다.

## 필요한 파일

```
video/SPLICE_0_BASE.xlsx     기본값
video/SPLICE_1_SECT.xlsx     H-400x400
video/SPLICE_2_PLATE.xlsx    +상부 판 380
video/SPLICE_3_BOLT.xlsx     Long N 6
video/SPLICE_4_GAP.xlsx      gap 40
video/SPLICE_5_ALL.xlsx      전부
```

타워와 같은 방식으로 만듭니다 — PARAM 칸만 바꾸고 수식을 다시 계산해서 저장.
`input` 탭은 손대지 않습니다.

**아직 확인 안 된 것:** ①에서 H-400×400 으로 바꿨을 때 66부재가 그대로 서는지,
볼트가 판 밖으로 나가지 않는지. 파일 만들면서 실제로 로드해 확인하고, 안 맞으면
값을 조정하겠습니다. 위 표의 `172 kg/m` 는 KS 표에서 읽은 값이고, `60` 볼트는
`6×4×2 + 4×3 = 60` 산술입니다.
