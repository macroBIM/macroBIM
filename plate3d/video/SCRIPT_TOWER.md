# 타워크레인 영상 스크립트

`PLATE3D_promo.mp4`(56초)와는 다른 영상입니다. 앞의 것은 **"그림이 행에서
나왔다"**가 주장이었고, 이것은 **"그 행을 당신이 바꿀 수 있다"**입니다. 그래서
사이트 접속과 예제 다운로드 과정이 들어가고, 엑셀 화면과 3D 화면을 나란히
붙이는 컷이 중심입니다.

원본은 `plate3d/PLATE3D_TOWER.xlsx` — PARAM 탭의 파란 칸 네 개가 크레인 전체를
결정합니다.

## 제목 · 설명 · 태그

```
BIM TOWER CRANE 3D PARAMETRIC MODEL — Under Your Control | PLATE3D
```

검색 키워드를 앞에 몰아넣고 브랜드를 뒤로 뺐습니다. 조회수가 안 나오는 영상은
대개 제목에 검색할 단어가 없습니다.

설명문 첫 두 줄(더보기 전에 보이는 부분):

```
A 47.9 m tower crane, 575 members, built from one spreadsheet.
Change the panel count, the jib bays, the hook drop or the slew angle — the model follows.
```

태그: `BIM`, `tower crane`, `parametric model`, `3D`, `steel structure`,
`spreadsheet`, `Excel`, `structural engineering`, `PLATE3D`, `macroBIM`

## 자막 네 축

영상의 뼈대입니다. 나머지 자막은 전부 이 네 줄 아래로 들어갑니다.

```
1   질문   What if you could transform a Tower Crane with a Spreadsheet?
2   선언   TOWER CRANE.  UNDER YOUR CONTROL.
5   방법   Change one number.  See the model respond.
10  마무리 One spreadsheet.  Any crane.
11  서명   PLATE3D by macroBIM
```

1번과 10번이 **Spreadsheet** 라는 같은 단어로 열고 닫습니다.
5번에서 "숫자 하나 바꾸면 모델이 응답한다"고 이미 선언하므로, 6–9번 케이스
자막은 **어느 항목이 얼마로 변했는지만** 말합니다. 여기에 설명을 더 붙이면
5번의 힘이 죽습니다.

4번은 **소유**입니다 — 2번에서 통제권을 선언했으니, 예제를 받는 순간 크레인이
자기 것이 되고, 그래서 5번에서 바꿔볼 수 있게 됩니다. 여기에 부재 수나 강재
중량을 적지 않습니다. 기본 크레인의 물량은 두 컷 뒤에 745, 638, 808 로 변하니
영상 안에서 곧 틀린 말이 되고, 애초에 크레인의 스펙도 아닙니다.

## 컷 리스트 — 88초 · 1920×1080 · 30 fps · 무음

| # | 시간 | 화면 | 자막 |
|---|---|---|---|
| 1 | 0:00–0:05 | 완성된 크레인, 천천히 선회 | **What if you could transform a Tower Crane with a Spreadsheet?** |
| 2 | 0:05–0:09 | 검은 화면, 타이틀 카드 | **TOWER CRANE.**<br>**UNDER YOUR CONTROL.** |
| 3 | 0:09–0:15 | 브라우저 → 사이트 → 좌측 PLATE3D | *Runs in the browser. Nothing to install.* |
| 4 | 0:15–0:21 | Examples → Tower crane 다운로드 | *Download the example. Now you have a crane.* |
| 5 | 0:21–0:28 | 엑셀 PARAM 탭, 파란 칸 네 개에 링 | **Change one number.**<br>**See the model respond.** |
| 6 | 0:28–0:39 | ① 마스트 `Panels 15 → 25` | *Mast · 47.9 m → 71.9 m* |
| 7 | 0:39–0:50 | ② 지브 `Bays 15 → 22` | *Reach · 48.5 m → 69.5 m* |
| 8 | 0:49–1:03 | ③ 호이스트 — `Hook drop 26020 → 5000` 로 훅이 올라오고, 이어서 `Trolley R 30000 → 10000` 으로 안쪽으로 | *Hoist · the hook comes up, and comes in* |
| 9 | 1:03–1:16 | ④ 선회 `Jib angle 0 → 360` 연속 | *Slew · the mast stays put* |
| 10 | 1:16–1:23 | 네 개 다 적용한 크레인, 히어로 팬 | *One spreadsheet. Any crane.* |
| 11 | 1:23–1:28 | 로고 | **PLATE3D by macroBIM** |

타이틀 카드(2번)는 두 줄 모두 마침표로 끊습니다 — 그게 문구의 리듬입니다.

## 다섯 가지 경우

각 케이스는 **기본값에서 한 칸만** 바꿉니다. "숫자 하나 → 크레인이 변한다"가
영상의 주장이므로, 두 칸을 동시에 바꾸면 주장이 흐려집니다. 호이스트만 예외로 두
칸을 연달아 바꾸는데, 둘 다 HOIST 한 행에 나란히 있고 하나씩 순서대로 움직이므로
"한 칸씩"이라는 규칙은 지켜집니다.

| | 셀 | 값 | 결과 | 부재 |
|---|---|---|---|---|
| 기본 | — | — | 높이 47.9 m · 반경 48.5 m | 575 |
| ① 마스트 | `PARAM!D6` | 15 → **25** | 높이 **71.9 m** | 745 |
| ② 지브 | `PARAM!D12` | 15 → **22** | 반경 **69.5 m** | 638 |
| ③ 호이스트 | `PARAM!D19` | 26020 → **5000** | 훅 지상고 12.1 → **33.1 m** | 575 |
| ③b 트롤리 | `PARAM!C19` | 30000 → **10000** | 트롤리·훅이 마스트 쪽으로 | 575 |
| ④ 선회 | `PARAM!C25` | 0 → **360** | 방향만 · 강재 동일 | 575 |
| 합본 | 위 전부 | | 높이 71.9 m · 반경 69.5 m | 808 |

부재 수는 `140 + 17×마스트단수 + 9×지브단수 + 8×카운터단수 + 슬래브수` 입니다.
8 / 15 / 22단 세 점에서 실측(393 / 575 / 757)과 정확히 일치합니다.

## 촬영

**케이스 사이에 View 버튼을 누르지 마세요.** 첫 시트만 화면에 맞춰지고 그 뒤로는
시점이 유지됩니다. 누르면 다시 맞춰져서 **자라나는 느낌이 사라집니다.** ①②는
이게 컷의 전부입니다. `PLATE3D_promo.mp4` 촬영 때 배운 것과 같습니다.

**④ 선회는 예외입니다.** 한 장씩 로드하면 뚝뚝 끊기므로, `Jib angle` 을 6° 간격
60장으로 미리 만들어 연속 재생합니다.

**호이스트는 드롭을 늘리지 않고 줄입니다.** 26 m 에서 36 m 로 늘리면 로프만 길어질 뿐
화면에서 아무 일도 일어나지 않습니다. 5 m 로 줄이면 훅이 지브 바로 밑까지 올라와
지상고가 12.1 → 33.1 m 로 바뀌고, 그 다음 트롤리 반경을 30 → 10 m 로 당기면 훅이
마스트 쪽으로 크게 미끄러집니다. 두 칸 다 HOIST 한 행에 나란히 있어서 카드 하나로
보여집니다.

**엑셀과 실시간 연동이 아닙니다.** 저장한 뒤 Load Excel 을 다시 눌러야 합니다.
5–9번 컷에서 이 동작이 보이는 편이 오히려 정직합니다.

## 필요한 파일

```
video/TOWER_0_BASE.xlsx      기본값
video/TOWER_1_MAST.xlsx      Panels 25
video/TOWER_2_JIB.xlsx       Bays 22
video/TOWER_3_HOOK.xlsx      Hook drop 5000
video/TOWER_4_TROLLEY.xlsx   + Trolley R 10000
video/TOWER_5_ALL.xlsx       위 넷 + Jib angle
video/slew/TOWER_S00.xlsx …  6° 간격 60장
```

전부 `PLATE3D_TOWER.xlsx` 의 PARAM 칸만 바꾸고 수식을 다시 계산해 저장한
것입니다. `input` 탭은 손대지 않습니다 — 손댈 필요가 없다는 것이 영상의 주장
자체입니다.
