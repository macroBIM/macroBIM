# 에펠탑 영상 스크립트

## 1. 한 문장

**ISO 로 잡고, 밑에서부터 부재를 올리면서, 카메라가 같이 돌며 따라 올라가
꼭대기에서 멈춘다. 그리고 받아서 해 보라고 한다.**

원테이크입니다. 컷이 다섯 개고, 그중 하나가 영상의 8할입니다.

첫 판은 18컷에 2분 25초짜리였습니다 — 콜드 오픈에 숫자를 띄우고, 적는 것
셋을 접사로 보여주고, ASSY 한 줄을 화면에 올리고, 도면 아홉 장을 넘기고,
시트를 훑었습니다. **전부 맞는 말이지만 영상이 아니라 발표였습니다.**
탑이 서는 것 자체가 볼 만한데 그 앞에 설명을 여섯 개 세워 둔 꼴이었습니다.

버립니다. 남는 것은 **탑이 서는 것** 하나입니다.

## 2. 컷 리스트 — 약 1:32

| # | 시각 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 4s | 검은 화면, 오프닝 카드 | **BY PLATE3D**<br>**EIFFEL TOWER** |
| **2** | **0:04** | **70s** | **원테이크.** 지면에서 교각 한 패널이 서고, 부재가 아래에서 위로 쌓인다. **카메라는 내내 돌면서 같이 올라간다.** 20 m 에서 아치, 57.6 에서 1층, 115.7 에서 네 다리가 하나, 276.1 에서 3층, 300.65 에서 멈춘다 | 0:04 **1,528 members.**<br>0:20 *the arches*<br>0:34 *the first platform*<br>0:50 *and the four become one*<br>1:06 *300.65 m — 1889* |
| 3 | 1:14 | 8s | 완성. 카메라만 계속 돈다 | — |
| 4 | 1:22 | 6s | 권유 카드 | **DOWNLOAD IT AND TRY IT**<br>*macrobim.github.io*<br>*PLATE3D → Example → Eiffel Tower* |
| 5 | 1:28 | 4s | 로고 | **PLATE3D by macroBIM** |

자막은 다섯 줄뿐입니다. **말이 적을수록 화면이 큽니다.**

3 번에 자막이 없습니다 — 다 지은 다음에 할 말은 없습니다. 골든게이트에서
정한 규칙 그대로입니다.

## 3. 2 번 컷 — 카메라가 탑과 같이 자란다

이 영상의 유일한 기술적 판단입니다.

탑이 자라는데 카메라가 고정이면, 처음에는 화면 아래 구석에 뭔가 조금
있고 끝에는 화면 밖으로 나갑니다. 그래서 **카메라 값 셋이 지은 높이를
따라갑니다.**

| | 시작 (h = 0) | 끝 (h = 300.65 m) |
|---|---|---|
| target z | 12,000 | 150,000 |
| dist | 190,000 | 620,000 |
| az | −40 | **+320** |
| el | 14 | 18 |

- **target z 는 지은 높이의 절반**을 따라갑니다. 자라는 끝이 언제나 화면
  위쪽 삼분의 일에 옵니다.
- **dist 는 지은 높이에 비례**합니다. 탑이 화면을 채운 채로 커집니다.
- **az 는 70초에 360°** 를 돕니다. 초당 5도쯤이라 도는 것이 보이되
  어지럽지 않습니다.
- **el 은 거의 안 움직입니다.** 낮게 두어야 300 m 가 300 m 로 보입니다.
  높이면 위에서 내려다보게 되고 탑이 납작해집니다.

**한 바퀴를 정확히 도는 것이 중요합니다.** 시작과 끝이 같은 면이면
"완성됐다"가 화면으로 읽힙니다. 3 번 컷은 그 회전을 8초 더 이어서
관성을 끊지 않습니다.

## 4. 가설 시퀀스 — 높이 하나로 자란다

**탑은 아래에서 위로 올라갑니다.** 골든게이트는 트러스가 주탑에서 경간
중앙으로 자라서 `STAGE` 가 두 축이었는데, 에펠은 **높이 하나**입니다.
지금까지 지은 높이 아래는 있고, 그 위는 없습니다.

```
node video/tools/make_eiffel_stages.js       # 약 60장
```

| 구간 | 높이 | 장수 |
|---|---|---|
| 교각 | 0 → 115.7 m | 16 (패널마다) |
| 아치 | 20 m 를 지날 때 붙는다 | — |
| 1층 | 57.6 m 를 지날 때 덮인다 | — |
| 2층 | 115.7 m | 1 |
| 샤프트 | 115.7 → 276.1 m | 12 |
| 3층 · 정상부 | 276.1 → 300.65 m | 3 |

**그리고 이건 연출이 아니라 사실입니다.** 1887년 1월에 터를 파고 1889년
3월에 깃발을 올렸고, 그 사이 탑은 언제나 지금 서 있는 높이까지만 서
있었습니다. 각 프레임은 **엔진이 진짜 시트에서 지은 진짜 모델**이지,
부재를 숨겼다 보였다 한 것이 아닙니다.

**생성기에 붙일 스위치**(아직 없음):

| 스위치 | 뜻 |
|---|---|
| `TOPZ=<높이 mm>` | 이 높이 위는 쓰지 않는다 |

`TOPZ` 를 비우면 **출하되는 워크북과 행 내용이 완전히 같아야** 합니다.
골든게이트에서 414행을 대조해 확인한 것과 같은 조건입니다 — 영상 때문에
손님이 받는 파일이 달라지면 안 됩니다.

## 5. 도장

위로 갈수록 밝습니다. 실제 에펠탑이 같은 갈색 세 톤으로 아래가 제일 짙게
칠해져 있는 것과 같은 원리이고, 검은 뷰포트에서는 명도만 올려 씁니다.
값은 `tools/make_eiffel.js` 머리에 있습니다.

```
md.leg=#e0862e  md.arc=#efa04a  md.pl1=#ffe3bc
md.pl2=#ffe3bc  md.pl3=#ffe9cc  md.shf=#ffcb8c  md.top=#fffaf0
```

탑 자신의 갈색을 그대로 쓰면 2층 위가 배경에 묻힙니다. 네 벌을 걸어 보고
골랐습니다.

## 6. 메타

| 항목 | 내용 |
|---|---|
| 제목 | `EIFFEL TOWER 3D BIM — Watch It Go Up \| PLATE3D` |
| 대안 1 | `EIFFEL TOWER 3D BIM — Built From One Excel Sheet \| PLATE3D` |
| 규격 | 약 1:32 · 1920×1080 · 30 fps · 무음 · **자막 영어** |
| 썸네일 | `PLATE3D_EIFFEL_thumb.jpg` — 풀블리드 ISO, `3D BIM MODELING` / `EIFFEL TOWER` / `by PLATE3D` |
| 공개 | **미정** |

### 설명란

```
3D BIM Modelling the Eiffel Tower in PLATE3D.

One camera, one take. The tower goes up the way it went up in 1887 —
from the ground, one panel at a time — and the camera turns with it.

Every frame is a real model built from a real sheet. Nothing is hidden
by hand: the tower is only ever as tall as it has been built.

709 rows in one spreadsheet tab. 1,528 members. No clashes.
Nine drawings come out as DXF at the press of a button.

DOWNLOAD IT AND TRY IT
macrobim.github.io — PLATE3D → Example → Eiffel Tower.
Open it in Excel, change a number, load it again.

Runs in the browser. Nothing to install.

0:00  Eiffel Tower
0:04  It goes up
1:14  Finished
1:22  Download it

#EiffelTower #BIM #3DModeling #StructuralEngineering #PLATE3D
```

## 7. 실측값

전부 현재 `plate3d/PLATE3D_EIFFEL.xlsx` 와 두 엔진에서 잰 값입니다.

| | 값 |
|---|---|
| 행 | 709 |
| 부재 | 1,528 |
| 중량 | 4,773,238.8 kg |
| 겹침 | **0** (테스트·운영 엔진 동일) |
| 모듈 7 · 조립체 5 | `md.leg` `md.arc` `md.pl1~3` `md.shf` `md.top` |
| 도면 | 9 · 131,681 엔티티 · Save DXF 11.1 초 |

## 8. 이 영상이 하지 않는 것

**"숫자 하나를 바꾼다"를 하지 않습니다.** PARAM 앞장을 안 붙이기로
했습니다. 옆선을 정하는 상수는 `tools/make_eiffel.js` 안에 있지 시트의
칸이 아니므로, 화면에서 값을 바꾸는 것처럼 찍으면 영상이 딱 한 가지에
대해 거짓말을 하게 됩니다.

**옆선이 지수함수라는 이야기를 화면에서 하지 않습니다.** 첫 판의
하이라이트였는데 뺐습니다 — 설명이 필요한 이야기이고, 이 영상은 설명하는
영상이 아닙니다. 설명란에는 남깁니다.

**중량을 실물과 비교하지 않습니다.** 4,773 t 은 이 모델의 값입니다. 실물의
연철 7,300 t 에는 계단, 승강기 틀, 장식 격자, 2차 브레이싱이 다 들어 있고
이 시트에는 없습니다.

**공표값과 제가 정한 값을 섞어 부르지 않습니다.** 층고(57.63 / 115.73 /
276.13)와 기저부 125 m, 전고 300.65 m 는 공표값입니다. 교각 폭 26 m,
2층에서의 13.5 / 8 m, 아치 스프링잉 20 m · 크라운 43 m 는 **제가 역산하거나
정한 값**입니다. 영상은 이 숫자들을 화면에 올리지 않으므로 문제가 되지
않지만, 설명란에 "에펠의 도면대로" 같은 문장을 쓰면 안 됩니다.

**안테나와 승강기는 모델에 없습니다.** 1889년 정상까지입니다.

## 9. 정해진 것 / 남은 것

정해진 것:

- 원테이크 · ISO · 밑에서 위로 · 카메라가 같이 돌며 올라간다
- 자막 다섯 줄, 3 번 컷 무자막
- 끝은 **다운로드해서 해 보라** 한 장
- **PARAM 앞장은 안 붙인다**
- 도장은 위로 갈수록 밝다

남은 것:

- 썸네일 문구 · 공개 여부
- 2 번 컷 70초가 맞는 길이인지 — 60장이면 장당 1.17초다. 찍어 보고
  느리면 장수를 줄이는 것이 아니라 **보간 프레임을 줄인다**(같은 파일을
  덜 오래 문다)

## 10. 필요한 파일

있는 것:

```
plate3d/PLATE3D_EIFFEL.xlsx            모델 709행
plate3d/tools/make_eiffel.js           생성기 (도장 값도 머리에)
plate3d/video/tools/video_page.html    촬영 하네스 — __aim / __grab
plate3d/video/tools/mkthumb.js         썸네일 (bleed 판)
```

만들 것:

```
plate3d/tools/make_eiffel.js           TOPZ 스위치 추가
video/tools/make_eiffel_stages.js      약 60장
video/tools/mkcards_eiffel.js          카드 5장
video/tools/shoot_eiffel.js            촬영 — 컷 5개, 카메라가 높이를 따라감
video/tools/assemble_eiffel.js         조립
```

골든게이트에서 만든 것을 거의 그대로 씁니다. 새로 판단할 것은 **카메라가
높이를 따라가는 식** 하나입니다(§3).
