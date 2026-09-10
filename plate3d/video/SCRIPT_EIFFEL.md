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

## 2. 컷 리스트 — 1:43 (실측)

| # | 시각 | 길이 | 화면 | 자막 |
|---|---|---|---|---|
| 1 | 0:00 | 4s | 검은 화면, 오프닝 카드 | **BY PLATE3D**<br>**EIFFEL TOWER**<br>*Watch it go up.* |
| **2** | **0:04** | **70s** | **원테이크.** 지면에서 교각 한 패널이 서고, 부재가 아래에서 위로 쌓인다. **카메라는 내내 돌면서 같이 올라간다.** 20 m 에서 아치, 57.6 에서 1층, 115.7 에서 네 다리가 하나, 276.1 에서 3층, 300.65 에서 멈춘다 | 0:04 *709 rows. 1,528 members.*<br>0:20 *the arches*<br>0:34 *the first platform*<br>0:50 *and the four become one*<br>1:08 **300.65 m** *in 1889* |
| 3 | 1:14 | 8s | 완성. 카메라만 계속 돈다 | — |
| 4 | 1:22 | **17s** | **macroBIM 사이트가 열리고, 왼쪽 메뉴에서 PLATE3D 를 고르고, PLATE3D 창에서 Example download 를 누르고, 에펠탑 줄에 불이 들어오고, 버튼이 `saved` 로 바뀐다** — 일곱 장면 | 1:22 **It is on macroBIM.** *PLATE3D &rarr; Example*<br>1:31 *download it and try it* |
| 5 | **1:39** | 4s | 로고 | **PLATE3D by macroBIM** |

자막은 일곱 줄입니다 — 탑에 다섯, 사이트에 둘. **말이 적을수록 화면이 큽니다.**

3 번에 자막이 없습니다 — 다 지은 다음에 할 말은 없습니다. 골든게이트에서
정한 규칙 그대로입니다.

## 3. 2 번 컷 — 카메라가 탑과 같이 자란다

이 영상의 유일한 기술적 판단입니다.

탑이 자라는데 카메라가 고정이면, 처음에는 화면 아래 구석에 뭔가 조금
있고 끝에는 화면 밖으로 나갑니다. 그래서 **카메라 값 셋이 지은 높이를
따라갑니다.**

| | 시작 (h = 0) | 끝 (h = 300.65 m) |
|---|---|---|
| target z | 12,000 | **145,000** |
| dist | 190,000 | **490,000** (`u^0.82`) |
| az | −40 | **+320** |
| el | 14 | 18 |

- **target z 는 지은 높이의 절반**을 따라갑니다. 자라는 끝이 언제나 화면
  위쪽 삼분의 일에 옵니다.
- **dist 는 지은 높이의 0.82 승**입니다. 선형으로 하면 다 지은 탑이
  반쯤 지은 탑보다 화면에서 작아집니다 — 첫 촬영에서 그렇게 나왔습니다.
  지수를 1 아래로 내리면 카메라가 뒤로 물러나는 속도가 탑이 자라는
  속도보다 느려져서, 탑이 화면을 채운 채로 커집니다.
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
node video/tools/make_eiffel_stages.js       # 31장, video/eiffel/EIF_01..31.xlsx
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

**생성기의 스위치**:

| 스위치 | 뜻 |
|---|---|
| `TOPZ=<높이 mm>` | 이 높이 위는 쓰지 않는다 |
| `STAGES=1` | 패널 상단 높이 31개를 찍고 끝낸다 |

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
| 대안 1 | `EIFFEL TOWER 3D BIM — 1,528 Members From One Excel Sheet \| PLATE3D` |
| 대안 2 | `EIFFEL TOWER 3D MODELING — One Pier, Turned Four Ways \| PLATE3D` |
| 규격 | **1:43** · 1920×1080 · 30 fps · **음악 있음** · **자막 영어** |
| 썸네일 | `PLATE3D_EIFFEL_thumb.jpg` — 1280×720. 풀블리드 ISO, 탑은 가로 3분의 2 지점, 글자는 왼쪽. `3D BIM MODELING` / `EIFFEL TOWER` / `by PLATE3D` (`node video/tools/mkthumb.js eiffel`) |
| 공개 | **미정** |

**제목이 썸네일과 겹치지 않습니다.** 썸네일이 이미 `3D BIM MODELING` /
`EIFFEL TOWER` 라고 말하므로 제목은 **그 다음 말**을 합니다 — 올라가는 걸
봐라. 골든게이트와 같은 꼴입니다: 대문자 이름 — 주장 | PLATE3D.

`Built From One Excel Sheet` 를 안 씁니다. 골든게이트가 그 자리에 쓴 말이고,
두 편이 같은 주장을 하면 두 번째 편은 첫 번째 편의 재방송으로 보입니다. 이
영상의 주장은 시트가 아니라 **원테이크로 올라가는 것**입니다.

검색어는 제목 앞쪽에 다 있습니다: **eiffel tower · 3D · BIM**.

### 설명란 전문

```
3D BIM Modelling the Eiffel Tower in PLATE3D — simple, and fast.

One camera, one take. The tower goes up from the ground the way it went up
in 1887, and the camera turns with it all the way to the top.

  the four piers     up from the ground
  the arches         in at 20 m
  the first floor    57.63 m
  the second floor   115.73 m - and the four legs become one shaft
  the third floor    276.13 m
  the top            300.65 m

Every frame is a real model built from a real sheet. Nothing is hidden by
hand - the tower is only ever as tall as it has been built.

709 rows in one spreadsheet tab. 1,528 members. No clashes.
Nine drawings come out as DXF at the press of a button.

THE FILE IS YOURS
The last twenty seconds are somebody taking it: PLATE3D -> Example ->
Eiffel Tower. Open it in Excel, change a number, load it again.

Runs in the browser. Nothing to install.
macrobim.github.io

0:00  It goes up
1:12  Finished
1:22  Get it at macroBIM

Music: Guitar House by josh pan (YouTube Audio Library)

#EiffelTower #BIM #3DModeling #StructuralEngineering #PLATE3D
```

**챕터가 셋이고 시각이 컷과 2초 어긋납니다.** 유투브는 챕터 셋 이상, 구간
10초 이상을 요구하는데 실제 컷은 0:00 / 0:04 / 1:14 / 1:22 / 1:39 이고
0:04 구간(4초)과 1:39 구간(4초)이 그 밑입니다. 그래서 앞뒤를 접고, 남은
경계 둘 중 **정확히 맞춰야 하는 쪽을 골랐습니다** — `1:22 Get it at macroBIM`
이 실제 컷입니다(사람들이 누르는 챕터가 그것입니다). `1:12 Finished` 가 2초
이르고, 눌러서 도착하면 마지막 부재 몇 개가 붙는 중입니다. 늦게 도착해서
다 지어진 걸 보는 것보다 낫습니다.

**층고 넷은 공표값입니다**(57.63 / 115.73 / 276.13 / 300.65). 그 외에 제가
정한 수치 — 교각 폭, 패널 개수, 단면 치수 — 는 설명란에 쓰지 않습니다.
§8 을 보십시오. 4,773 t 도 안 씁니다. 이 모델의 값이지 실물의 값이 아닙니다.

**음악 크레딧은 넣어 두었습니다.** 유투브 오디오 보관함 곡 중 일부만
설명란 표시를 요구하는데 이 곡이 어느 쪽인지 저는 확인할 수 없습니다
(§6-1). **필요 없는 곡이면 한 줄 지우면 되고, 필요한 곡인데 빠져 있으면
문제가 됩니다** — 그래서 넣는 쪽이 기본값입니다.

### 태그

```
eiffel tower, eiffel tower 3d model, eiffel tower bim, tour eiffel,
lattice tower, steel tower, tower 3d model, tower erection, construction
sequence, BIM, 3D modeling, structural engineering, steel structure,
steel detailing, spreadsheet, excel, parametric model, DXF, shop drawings,
wrought iron, 1889, PLATE3D, macroBIM
```

## 6-1. 음악 — `Guitar House` / josh pan

`tools/score.js` 가 붙입니다. **그림은 다시 인코딩하지 않습니다** — 스트림
복사이므로 몇 초 걸리고 화질이 한 세대 내려가지 않습니다. 무음 마스터는
`PLATE3D_EIFFEL_mute.mp4` 로 옆에 남습니다.

```
node video/tools/score.js PLATE3D_EIFFEL.mp4 <track.mp3>
```

곡을 먼저 재 보고 붙였습니다. 132.0 초 · 320 kb/s · 44.1 kHz 스테레오,
피크 −9.9 dB, 트랜지언트 비 0.499(타악 우세), 최강 주기 0.50 초 = **120 BPM**.
초당 라우드니스 봉투:

```
#@%##%%##@%##%%#%@%%#@%#%@%##@%%#@######%@##%###%@##%###%@##%###%@###@#%%@###@%%==:==-.==-.==-.=%@#%#@#%%@#%#@%@%@#%#@#%%@#%%@%@.
```

읽으면 이렇습니다.

- **0 초부터 만렙입니다.** 조용한 인트로가 없습니다. 그래서 페이드 인
  2.5 초가 장식이 아니라 필수입니다 — 안 넣으면 오프닝 카드에 소리가
  따귀처럼 들어옵니다.
- **78–95 초가 브레이크다운**입니다(위 봉투의 `==-.` 구간). 103.4 초
  그림에 얹으면 **탑이 완성되고 macroBIM 화면으로 넘어가는 자리**에
  정확히 옵니다. 우연이지만 편집으로 만들 수 있는 자리가 아닙니다.
- **131 초에서 곡이 뚝 끊깁니다.** 그림보다 28.6 초 길므로 잘라서 씁니다
  — 루프가 아닙니다. 페이드 아웃 4 초가 그 절단을 대신합니다.
- 120 BPM 하우스입니다. 카메라가 70 초에 360° 를 도니까 초당 5°,
  한 마디(2 초)에 10° 입니다. 회전과 박자가 맞물리진 않지만
  **서로 싸우지도 않습니다** — 둘 다 등속입니다.

레벨은 **−15 LUFS** 로 맞춥니다. 유튜브가 −14 근처로 정규화하므로
−8 로 마스터된 곡은 플랫폼이 알아서 내립니다. 여기서 미리 내려 두면
파일이 말하는 소리가 아니라 **보는 사람이 듣는 소리**를 듣게 됩니다.

| | 값 |
|---|---|
| 무음 마스터 | 25.0 MB (crf 25) |
| 음악 포함 | **27.6 MB** · AAC 192 kb/s 48 kHz |

crf 를 24 에서 25 로 올렸습니다. 화질 판단이 아니라 **30 MB 안에 음악이
들어갈 자리를 만든 것**입니다 — 24 는 무음 28.6 MB, 음악 붙이면 31.2 MB 로
넘어갑니다. 격자와 검정 배경에서 24 와 25 의 차이는 안 보입니다.

**저작자 표시는 확인이 필요합니다.** 유튜브 오디오 보관함 곡 중 일부는
설명란에 크레딧을 요구합니다. 보관함에서 이 곡 옆에 그 표시가 있었으면
설명란에 한 줄 넣어야 합니다:

```
Music: Guitar House by josh pan (YouTube Audio Library)
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

**받는 장면은 진짜입니다.** 엔진의 fetch 를 디스크의 워크북으로 연결해
두었으므로 버튼이 `saved` 가 되는 것은 실제로 받아졌기 때문입니다. 그게
아니면 찍을 이유가 없습니다. 그러려면 Example 목록에 있어야 해서 두 엔진의
`SAMPLES` 에 항목을 넣었습니다.

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
- 자막 일곱 줄, 3 번 컷 무자막
- 끝은 **받는 장면**이다 — 문구 카드가 아니라 왼쪽 메뉴, PLATE3D 창,
  Example 목록, 그리고 `saved` 로 바뀌는 버튼. 주소를 화면에 쓰지 않는다:
  메뉴가 보이면 어디를 눌러야 하는지가 곧 설명이다
- **음악은 붙인다** — 그림과 따로, `score.js` 로 (§6-1)
- **PARAM 앞장은 안 붙인다**
- 도장은 위로 갈수록 밝다

남은 것:

- 공개 여부
- 오디오 보관함이 이 곡에 크레딧을 요구하는지 (§6-1)
- ~~2 번 컷 70초가 맞는 길이인지~~ — 찍었습니다. 31장을 초당 12스틸로
  보간해서 840 프레임, 장당 2.26초입니다. 부재가 붙는 순간이 보이면서
  카메라가 끊기지 않는 지점입니다

## 10. 파일 — 전부 있습니다

`만들 것` 이 비었습니다. 아래 순서대로 돌리면 처음부터 다시 나옵니다.

```
plate3d/tools/make_eiffel.js           생성기. TOPZ= 로 잘라 짓고, STAGES=1 로
                                       패널 상단 높이 31개를 뱉는다. 도장 값도 머리에
plate3d/PLATE3D_EIFFEL.xlsx            출하되는 워크북 709행

video/tools/make_eiffel_stages.js      EIF_01..31.xlsx 를 video/eiffel/ 에
video/tools/mkcards_eiffel.js          카드 (full 2 · over 5)
video/tools/rendercards_eiffel.js      카드 → PNG
video/tools/shoot_eiffel.js            촬영. ONLY= 로 컷 하나만
video/tools/assemble_eiffel.js         조립. CRF= 로 크기 조절 (기본 25)
video/tools/score.js                   음악. 그림은 스트림 복사, 곡만 다시 씀
video/tools/video_page.html            촬영 하네스 — __aim / __grab / __reveal
video/tools/site_page.html             macroBIM 화면용 껍데기 (layout_body.js 를 감쌈)
video/tools/mkthumb.js                 썸네일. `eiffel` 항목 — bleed + side
```

새로 판단한 것은 두 개였습니다: **카메라가 높이를 따라가는 식**(§3), 그리고
**받는 장면을 진짜로 찍는 것**(§7).
