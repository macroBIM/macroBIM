# 골든게이트교 영상 스크립트

## 1. 이 영상의 자리

| 영상 | 주장 | 파는 것 |
|---|---|---|
| `PLATE3D_promo.mp4` | 그림이 행에서 나왔다 | 가능성 |
| `PLATE3D_TOWER.mp4` | 그 행을 당신이 바꿀 수 있다 | 크기 |
| `PLATE3D_SPLICE.mp4` | 손이 제일 많이 가는 연결부를, 이미 쓸 줄 아는 도구로 | 쉬움 |
| `PLATE3D_SIMPLECONN.mp4` | 이 접합부에 넣을 수 있는 것이 이게 전부다 | 문턱 |
| `PSC.mp4` | 치수를 치면 도면이 나온다 | 속도 |
| **`PLATE3D_GGB.mp4`** | **이 도구가 어디까지 가는지 — 2.3 km 짜리 실물이 414행이다** | **신뢰** |

앞의 다섯 편은 전부 **도구를 설명**했습니다. 이건 다릅니다. 설명하지 않고
**아는 것을 하나 보여줍니다.** 시청자가 이미 아는 다리를 열고, 그것이 시트
한 장이라는 것만 말합니다.

파는 것이 "신뢰"인 이유는, 앞 영상들이 못 넘는 벽이 하나 있기 때문입니다 —
브래킷·크레인·이음부는 **작아서 되는 것 아니냐**는 의심입니다. 세계에서 제일
유명한 현수교가 같은 문법으로 서면 그 의심이 사라집니다.

**시리즈의 1편입니다.** PSC 가 "시리즈 아님"을 못박은 것과 반대로, 이건 뒤에
다른 다리가 붙는 자리를 엽니다. 다만 **이 영상 안에서는 예고하지 않습니다** —
2편이 실제로 만들어지기 전까지 약속하지 않습니다(§9).

## 2. 카피

```
THE GOLDEN GATE BRIDGE

1,280 m between the towers.
227 m of tower above the water.
Suspenders every 50 ft.

414 rows.

The published figures went in.
Nothing was drawn to taste.
```

**말하는 방식**: 앞 영상들이 "할 수 있다"였다면 이건 **"이미 되어 있다"**입니다.
권유가 없고 명령형이 없습니다. 숫자를 나열하고 마지막에 행 수를 놓는 것이
문구의 전부입니다 — 대비가 논거이므로 설명을 얹으면 약해집니다.

`Nothing was drawn to taste` 가 이 영상의 정직성 선언입니다. 공표 제원이
입력이었고, 형상은 거기서 계산돼 나왔다는 뜻입니다.

## 3. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `GOLDEN GATE BRIDGE 3D MODEL — A Suspension Bridge from One Spreadsheet \| PLATE3D` |
| 설명 1행 | `The Golden Gate Bridge at full size — 1,280 m main span, 227 m towers, 2,219 members — built from a 414-row spreadsheet in the browser.` |
| 설명 2행 | `The published figures are the input: 4200 ft between the towers, 746 ft of tower, suspenders every 50 ft, a 36-3/8 in cable. Nine drawings come out as DXF.` |
| 태그 | golden gate bridge · suspension bridge · bridge model · 3D model · BIM · structural engineering · steel structure · spreadsheet · Excel · parametric model · DXF · main cable · stiffening truss · PLATE3D · macroBIM |
| 규격 | 1:44 · 1920×1080 · 30 fps · 무음 (단축안 1:22 — §5) |
| 썸네일 | `PLATE3D_GGB_thumb.jpg` — `GOLDEN GATE BRIDGE` / `2,219 members. 414 rows.` |
| 공개 | **미정** |

### 설명란 전문

```
The Golden Gate Bridge, at full size, out of a spreadsheet — 1,280.16 m between
the towers, 227.4 m of tower above the water, 2,219 members, 414 rows.

The published figures are the input and nothing is drawn to taste: 4200 ft of
main span, 1125 ft of side span, 746 ft of tower above the water, 500 ft above
the roadway, 220 ft of clearance under it, a 25 ft stiffening truss, suspenders
every 50 ft, a 36-3/8 in main cable.

WHAT IS IN THE SHEET
· Five modules — tower, main cable, hanger ropes, stiffening truss, floor system
· Five assemblies, one per part, so the list reads the way the bridge is talked about
· One module is ONE PLANE of the bridge; two ASSY rows put it on both sides
· 130 straight bars are the cable — every node off the parabola z = ZCL + a·x²
· One row with a repeat is 82 truss bays

WHAT COMES OUT
· 2,219 members · 81,624 t · no clashes
· Nine DXF drawings, at the scale each row asks for
· A general arrangement of the whole bridge — 2,311 m on one sheet

Runs in the browser. The workbook is on the Example menu.
macrobim.github.io
```

챕터는 컷 그대로가 아니라 묶음입니다:

```
0:00  The bridge
0:10  The sheet
0:17  Five parts
0:35  One plane, both sides
0:55  One row, many bays
1:06  The drawings
1:28  What it weighs
```

## 4. 자막 뼈대

```
1   선언   The Golden Gate Bridge.
2   대비   1,280 METRES OF MAIN SPAN.  414 ROWS.
4   구조   Five parts.  Five assemblies.
7   핵심   One plane of the bridge.  Written once.
11  마무리 The published figures went in.  Nothing was drawn to taste.
12  서명   PLATE3D by macroBIM
```

2번과 11번이 이 영상의 두 기둥입니다 — **규모**와 **정직성**. 나머지 자막은
전부 이 둘 아래로 들어가고, 설명을 더 붙이지 않습니다.

TOWER 의 `Change one number` 같은 **방법 자막이 없습니다.** 이 영상은 바꾸는
영상이 아닙니다(§8).

## 5. 컷 리스트 — 1:44 · 1920×1080 · 30 fps · 무음

| # | 시간 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 6s | 완성된 다리, 측면에서 아주 천천히 팬. International Orange | **The Golden Gate Bridge.** |
| 2 | 0:06 | 4s | 검은 화면, 타이틀 카드 | **1,280 METRES OF MAIN SPAN.**<br>**414 ROWS.** |
| 3 | 0:10 | 7s | `input` 탭을 위에서 아래로 훑음. 왼쪽 메모 열이 같이 지나감 — `36-3/8 in main cable`, `25 ft between the outside faces`, `one deck bay, 50 ft x 90 ft` | *The figures are in the sheet.* |
| 4 | 0:17 | 4s | ASSEMBLY 목록에서 **다섯 개를 전부 끄면** 화면이 빈다 | **Five parts.**<br>**Five assemblies.** |
| 5 | 0:21 | 14s | 하나씩 다시 켬 — `as.twr` 주탑 둘이 서고, `as.mcb` 케이블이 걸리고, `as.hgr` 행어가 내려오고, `as.trs` 트러스가 이어지고, `as.dk` 바닥판이 덮인다. 체크박스는 **진짜 핸들러** | *tower · cable · ropes · truss · deck* |
| 6 | 0:35 | 5s | MODULES 에서 `md.twr` 클릭 → 미리보기. **26 부재** | *One tower. 26 members.* |
| 7 | 0:40 | 7s | 창을 닫고 ASSY 블록으로. `md.twr` 을 **두 번** 놓는 두 줄에 링 | **One plane of the bridge.**<br>**Written once.** |
| 8 | 0:47 | 8s | `md.mcb` 미리보기 → 새들 부근으로 줌. 곡선이 **직선 마디**로 갈라져 보이는 지점까지 | *The curve is 130 straight bars.* |
| 9 | 0:55 | 6s | 시트로 돌아가 트러스 현재(`sc.chd`) 한 줄에 링. 끝 칸 `rep 81` 을 짚음 → 화면의 82경간 | **One row.**<br>**Eighty-two bays.** |
| 10 | 1:01 | 5s | ASSEMBLY 목록의 색 스와치 → 팔레트 → 주황. 다리 전체가 물듦 | *The colour is a click.* |
| 11 | 1:06 | 6s | `File ▸ Save DXF` → 파일이 떨어짐 | **Nine drawings.** |
| 12 | 1:12 | 8s | DXF 를 연 화면. 아홉 장이 세로로 쌓인 시트를 위에서 아래로 | *tower · cable · ropes · truss · deck* |
| 13 | 1:20 | 8s | 맨 위 **일반도**로 줌 — 전장 치수 `2311505` 가 프레임에 들어옴 | **Two kilometres.**<br>**One sheet.** |
| 14 | 1:28 | 6s | 앱으로 돌아와 부재 수·중량 줄 | *2,219 members · 81,624 t · no clashes* |
| 15 | 1:34 | 5s | 히어로 — 주탑 아래에서 케이블을 올려다보는 각 | **The published figures went in.**<br>**Nothing was drawn to taste.** |
| 16 | 1:39 | 5s | 로고 | **PLATE3D by macroBIM** |

합계 1:44. 1:22 로 줄이려면 10·14 를 빼고 12 를 5s 로 줄입니다 — **5 번은 줄이지
않습니다.** 이 영상에서 사람이 기억할 컷은 그 하나입니다.

### 순서의 논리

**4–5 번이 이 영상의 중심입니다.** 다른 컷은 전부 그 앞뒤입니다.

빈 화면에서 다리가 다섯 번에 걸쳐 서는 것은 **모델의 구조가 곧 다리의 구조**라는
주장이고, 그것이 ASSY 를 다섯으로 나눈 이유입니다. 설명 자막을 붙이지 않고
부품 이름만 흘리는 까닭도 같습니다 — 화면이 이미 말하고 있습니다.

6–7 번은 그 다음 질문에 답합니다: *다섯 개면 좌우는?* 주탑 하나를 열어 26 부재를
보이고, 그것을 **두 번 놓는 두 줄**을 짚습니다. 한 면만 적었다는 사실이 여기서
처음 나오고, 8 번에서 케이블로 한 번 더 확인됩니다.

11–13 번이 끝입니다. PSC 가 DXF 로 끝난 것과 같은 이유로, 여기서도 마지막에
남는 것은 **종이에 나온 것**입니다.

## 6. 실측값

전부 현재 `plate3d/PLATE3D_GGB.xlsx` 와 운영 엔진에서 실측한 값입니다.

| | 값 |
|---|---|
| 행 | 414 |
| 부재 | 2,219 |
| 중량 | 81,623,561 kg (81,624 t) |
| 겹침 | 0 |
| 모듈 | 5 · 조립체 5 |
| 도면 | 9 · 73,509 라인 · 6.77 MB |
| Save DXF | 6.3 초 (운영 엔진) |

한 줄이 만드는 최대 개수 — 9 번 컷이 짚는 값입니다. 시트에서 실측했습니다.

| 행 | 부재 | `rep` | 개수 |
|---|---|---|---|
| `md.dk` 세로보 | `sc.sg` | 83 | 84 (×3줄) |
| `md.trs` 수직재 | `sc.vpt` | 82 | 83 |
| `md.dk` 가로보 | `sc.fb` | 82 | 83 |
| **`md.trs` 현재** | **`sc.chd`** | **81** | **82** |
| `md.dk` 바닥판 | `pl.dkm` | 81 | 82 |

9 번이 **현재**를 짚는 것은 화면에서 트러스가 보이기 때문입니다. 세로보 줄이
숫자는 더 크지만(84) 바닥판 아래라 컷이 성립하지 않습니다.

모듈별 부재 (한 면 기준, ASSY 가 양쪽에 놓음):

| 모듈 | 부재 | 배치 |
|---|---|---|
| `md.twr` 주탑 | 26 | ×2 (주탑 두 기) |
| `md.mcb` 주케이블 | 130 | ×2 |
| `md.hgr` 행어 | 127 | ×2 |
| `md.trs` 보강트러스 | 507 | ×2 |
| `md.dk` 바닥틀·바닥판 | 639 | ×1 |

치수 (공표 제원 → 모델):

| | 공표 | 모델 |
|---|---|---|
| 주경간 | 4,200 ft | 1,280,160 mm |
| 측경간 | 1,125 ft | 342,900 mm |
| 주탑 (수면 위) | 746 ft | 227,400 mm |
| 노면 위 주탑 | 500 ft | 152,694 mm (501 ft) |
| 형하고 | 220 ft | 67,056 mm |
| 보강트러스 | 25 ft | 7,620 mm (외측) |
| 행어 간격 | 50 ft | 15,240 mm (주경간 정확히 84경간) |
| 주케이블 | 36⅜ in | Ø920 mm |
| 새그 | — | 144,860 mm (475 ft) |

**세 높이가 서로 맞습니다.** 746 − 500 = 246 ft 가 노면이고, 형하고 220 ft 에
트러스 25 ft 를 얹으면 245 ft 입니다 — 1 ft 안에서 일치합니다. 맞춰 넣은 것이
아니라 맞아떨어진 것이고, 그래서 3 번 컷에서 메모 열을 보여줄 값이 있습니다.

## 7. 촬영 규칙

**4–5 번 사이에 View 버튼을 누르지 마세요.** 조립체를 껐다 켜는 동안 시점이
유지돼야 다리가 **제자리에서** 섭니다. 누르면 매번 다시 맞춰져서 화면이
튀고, 서는 느낌이 사라집니다. TOWER 영상에서 배운 것과 같습니다.

**5 번은 한 번에 하나씩, 사이에 1.5 초씩 둡니다.** 다섯을 빠르게 켜면 그냥
로딩처럼 보입니다. 부품이 각각 무엇인지 읽을 시간이 있어야 컷이 성립합니다.

**8 번의 줌은 합성이 아니라 미리보기의 실제 휠 줌입니다.** 케이블이 직선
마디로 갈라져 보이는 배율까지 들어가야 자막이 참이 됩니다 — 안 갈라지면
자막을 빼는 편이 낫습니다.

**11–13 번의 DXF 는 앱이 실제로 내보낸 파일을 `tools/dxf2svg.js` 로 그립니다.**
다시 조판하지 않습니다 — `video/README.md` 의 첫 규칙입니다.

**10 번 색은 시트가 아니라 클릭입니다.** 자막이 `The colour is a click` 인 이유가
그것이고, 시트에서 색을 정하는 것처럼 보이게 찍으면 안 됩니다(§8).

## 8. 이 영상이 하지 않는 것

**"숫자 하나를 바꾼다"를 하지 않습니다.** TOWER 의 주장이고, 이 워크북은 아직
그걸 뒷받침하지 못합니다 — GGB 에는 PARAM 앞장이 없고, 주경간·새그·행어 간격은
`tools/make_ggb.js` 안의 상수라 **시트에서 고칠 수 있는 칸이 아닙니다.** 시트를
고치는 것처럼 찍으면 영상이 딱 한 가지에 대해 거짓말을 하게 됩니다.

하려면 워크북에 PARAM 탭을 먼저 붙여야 합니다 — TOWER 가 한 것과 같은 방식으로
`MAIN` `SAG` `PM` `TOPZ` 를 셀로 빼고 `input` 탭이 그것을 참조하게. **2편의
재료로 적어 둡니다.**

**중량을 실물과 비교하지 않습니다.** 81,624 t 은 이 모델의 값이고 실교량의
공표 물량이 아닙니다. 주케이블을 Ø920 중실봉으로 잡았으므로 실제 27,572 가닥의
강재 단면보다 약 20% 큽니다(공표 직경은 감은 바깥 지름). 화면에 숫자는 내되
"실제 다리가 이만큼"이라고 말하지 않습니다.

**앵커리지·교대·측면 브레이싱은 모델에 없습니다.** 화면에 안 나오므로 언급도
하지 않습니다. 다만 케이블이 앵커리지로 들어가는 백스테이는 있습니다.

## 9. 정해진 것 / 확정 대기

정해진 것:

- 다섯 컷 구조(4–5 번)가 영상의 중심이고 줄이지 않는다
- 마지막에 남는 것은 DXF 다
- 시리즈 예고를 **하지 않는다** — 2편이 만들어지기 전까지 약속하지 않는다
- 색은 International Orange, 그러나 "클릭"이라고 말한다

확정 대기:

- 길이 1:22 냐 1:44 냐 (10·14 번을 빼느냐)
- 15 번 히어로 각도 — 주탑 아래에서 올려다보는 각이 실제로 나오는지 확인 필요
- 썸네일 문구
- 공개 여부·시점

## 10. 필요한 파일

```
plate3d/PLATE3D_GGB.xlsx        모델 (이미 있음, Example 메뉴에 있음)
plate3d/video/tools/…           mkcards_ggb.js · rendercards_ggb.js
                                shoot_ggb_video.js · assemble_ggb.js
```

TOWER·SPLICE 와 달리 **워크북을 여러 장 만들 필요가 없습니다.** 이 영상은 값을
바꾸지 않으므로 파일은 하나이고, 변하는 것은 조립체 표시 여부와 카메라뿐입니다.
촬영 도구도 그만큼 짧아집니다.

`tools/shot_ggb.js` 가 이미 조립체 색과 뷰를 명령줄에서 잡을 수 있으므로
(`COLOURS=` · `ENGINE=`), 촬영 스크립트는 그 위에 카메라 경로와 체크박스
토글만 얹으면 됩니다.
