# PLATE3D

플레이트 조각들의 치수를 입력받아 3D 조립 모델을 생성하는 모듈.
(리포지토리 경로는 `plate3d/`, 화면 표시 이름은 **PLATE3D**)

## 파일

- **`plate_builder.js`** — 뷰어 엔진 (DATA_SCHEMA.md 구현). HTML에는 링크만 걸면 됨
  - 로드되면 자동 실행: `window.PLATE_DATA` 가 있으면 그 데이터로, 없으면 **빈 기본 화면**(좌 리스트/우 3D)
  - `plateBuilder.run({...})` 직접 호출도 가능 (자동 실행은 생략됨)
  - PLATE(부재) + HOLE(빼기 형상) → CUT → MODULE(판 조립 + BASE) → ASSY(글로벌 배치, 중첩 가능)
  - PLATE/HOLE 행은 `TRAP` / `RECT` / `CIRC` 를 고정 칸에 적고, `BASE.pt` 로 그 형상의 원점을 고름
  - 9점 이름은 **tl tc tr / ml mc mr / bl bc br** (예전 `pbl`·`cc` 표기도 계속 인식)
  - BAR(환봉)는 MODULE/ASSY에 판과 똑같이 배치. Ref.Pt는 비워둠 — **시점부 원형 중심**이 기준
  - **SECT(형강 H/C/L)** — 값은 중간 공백 없이 순차 입력, 타입별 목록:
    `H: h bb bt tw tf1 tf2 r1 r2` · `C: h b tw tf rw rf` · `L: a b t1 t2 r1 r2`
    필렛을 실제 원호로 작도(면적 오차 0.06%), r=0이면 각진 모서리. 배치는 BAR와 동일
  - 2D 도면의 지시선: 원형 구멍은 **Ø지름**, 형강 필렛은 **R반지름**.
    필렛은 값이 다른 것만 하나씩 표기(H형강 루트 4개에 R16을 네 번 쓰지 않음)
  - Ref.Pt 뒤 `+`/`−` 로 두께 기준면 지정, ROT.X/Y/Z 3축 회전
  - polybooljs 절단(구멍·노치·REF), 그룹·부재별 토글/투명도, 중량, STL·IFC 출력
  - **ortho** 체크박스: 원근투영 ↔ **정사투영**(평행투영) 전환 (**기본 off = 원근**).
    켜면 거리에 따른 축소가 없어져 Front/Side/Top이 그대로 2D 입면·평면이 됨.
    전환해도 보던 화면(방향·배율)은 유지되고, 측정·스냅도 그대로 동작.
    **메인 3D 화면과 모듈 미리보기 창에 각각** 있고 서로 독립적으로 켜고 끔
  - **clash** 체크박스: 부재끼리 **겹친 부피만 빨간 솔리드**로 표시 (메인 뷰·모듈 미리보기 각각).
    맞댐 이음처럼 면끼리 닿는 정상 조립은 넘어가고, **0.5 mm 넘게 파고든 경우만** 잡음.
    압출 축이 나란한 판끼리는 단면을 polybool로 교차시켜 정확히 계산하고,
    비스듬히 만나는 쌍은 방향 있는 경계상자(OBB)로 근사 — 깊게 파인 노치가 비스듬히 걸치면
    실제로는 안 닿는데 잡힐 수 있음. 겹친 부분이 부재에 묻혀도 보이도록 깊이검사 없이 위에 그림
  - **shadow** 체크박스: 그림자 on/off (**기본 off**). 켜면 부재끼리 그림자를 주고받음
  - 닫힌 솔리드는 앞면만 렌더, pixelRatio는 2로 제한
  - 치수·라벨류(measure 마커·거리값, id 라벨, local axes, BASE 마커)는 **화면 픽셀 기준**으로
    크기가 고정 — 모델이 크든 작든, 얼마나 확대하든 항상 같은 크기로 보임
  - **measure**: 3D 화면·모듈 미리보기·판 2D 도면에서 두 점을 클릭해 거리·ΔX/ΔY/ΔZ 측정.
    결과는 창 하단 줄에 남고(커서가 나가도 유지), 스냅 대상은 **좌표계 원점(0,0,0)** + 9점 + 구멍 중심 +
    **절단된 외곽선의 모든 꼭짓점**(노치 모서리·구멍 가장자리).
    2D 도면에서는 원점이 BASE.pt와 같은 자리라 마커 이름이 `origin/bc` 처럼 함께 표시됨.
    단 **BAR(환봉)는 양 끝단 원의 중심 2점만** 스냅 — 원은 48각형으로 작도되는데 그 테두리 점들은
    측정에 쓸모가 없고 주변 점을 가리기 때문. SECT(형강)는 모서리가 의미가 있어 그대로 유지
  - 미리보기 창 **regen** 버튼: 줌·팬·회전을 처음 열렸을 때의 화면으로 되돌림
  - 미리보기 창은 16:9를 유지한 채 **창 크기에 맞춰 자동 축소** — 스크롤 없이 항상 전체가 보이고, 창 크기를 바꾸면 보던 화면(카메라·줌)을 유지한 채 다시 맞춰짐
  - 엑셀(.xlsx) 로딩: Load Excel 버튼/드래그&드롭, 진행률 바, 결과·경고 패널
  - 화면 구성: **상단 메뉴바**(Load Excel · Save STL/IFC · 뷰포트 ISO/Front/Side/Top · 체크박스 8종) +
    좌측 목록판(폭 380px) + **16:9 고정 3D 창**. 창 크기가 좁으면 메뉴바가 두 줄로 접힘
  - 화면 스타일은 macroBIM 사이트(PSCBOX 페이지)와 통일 — Inter 서체, 흰 카드 + `#cbd5e1` 테두리,
    파랑 `#2563eb` 강조. 3D·2D 캔버스만 어두운 색으로 남김(그래픽 영역)
  - 좌측 목록: PLATES(클릭 → 2D 도면 팝업) · **BARS**(ID·직경·길이·재질 표) · **SECTIONS**(클릭 → 단면 도면) · MODULES(클릭 → 3D 미리보기) · ASSEMBLY(조립체·모듈)
  - 모듈 미리보기 왼쪽 패널: 구성 판별 hide/show · 색상 · 투명도 · local axes
- **`data_bracket.js`** — 서포트 브래킷 예제 데이터 (`window.PLATE_DATA` 정의) — 데이터 파일의 표본
- `codepen_empty.html` — **CodePen용 · 빈 시작** (링크 4줄: 라이브러리 3 + 엔진)
- `codepen_example.html` — **CodePen용 · 브래킷 예제** (링크 5줄: + 데이터 파일)
- `plate_builder.html` — 로컬용 (상대경로 버전, 저장소 클론 후 열기)
- `plate_assembly.html` — 초기 버전 (좌표 하드코딩 방식, 참고용)

## 링크만으로 사용하기

```html
<script src="https://unpkg.com/three@0.147.0/build/three.min.js"></script>
<script src="https://unpkg.com/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://unpkg.com/polybooljs@1.1.0/dist/polybool.min.js"></script>
<!-- 엑셀 읽기(선택): Load Excel / 드래그&드롭 기능을 쓰려면 필요 -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js"></script>
<!-- 데이터 파일(선택): window.PLATE_DATA 를 정의. 없으면 빈 기본 화면 -->
<script src="https://cdn.jsdelivr.net/gh/macroBIM/macroBIM@main/plate3d/data_bracket.js"></script>
<script src="https://cdn.jsdelivr.net/gh/macroBIM/macroBIM@main/plate3d/plate_builder.js"></script>
```

inline 스크립트 불필요 — 엔진이 로드되면 `window.PLATE_DATA` 를 자동 인식해 그린다.
데이터 파일은 엔진 줄보다 **위에** 넣을 것.

- 저장소가 public이라 jsDelivr(`cdn.jsdelivr.net/gh/...`)로 바로 서빙됨. raw.githubusercontent.com 은 브라우저가 스크립트 실행을 차단하므로 사용 불가.
- `@main` 링크는 고정 — 파일을 수정해 main에 푸시하면 같은 링크가 자동으로 최신 버전을 서빙. 단 jsDelivr가 최대 12시간 캐시하므로, 즉시 반영하려면 브라우저에서 `https://purge.jsdelivr.net/gh/macroBIM/macroBIM@main/plate3d/plate_builder.js` 를 한 번 열어 캐시를 비우면 됨.

## 부재표 (도면 판독값, 전판 10T, 단위 mm)

| 부재 | 치수 | 수량 | 비고 | 배치 |
|---|---|---|---|---|
| PL C1 | 100×300 | 2 | 기둥 (C2 사이 삽입) | 확정 |
| PL C2 | 120×300 | 2 | 기둥 (외측) → 120×120 박스기둥 | 확정 |
| PL T1 | 350×300 | 1 | 상판, 레벨볼트 구멍 4-Ø22 (90/220/40 × 40/220/40) | 확정 |
| PL T2 | 260×240 | 1 | 하판, 구멍 4-Ø24 (30/200/30 × 30/180/30) | 확정 |
| PL S1 | 290×280 | 2 | 측판(전·후), 좌하단 노치 50×110 | 확정(노치 방향 가정) |
| PL B1 | 240×280 | 1 | 우측판, Ø30 구멍 (하단 125, 폭 중앙) | 확정(우측 배치) |
| PL F1 | 240×170 | 1 | 러그, Ø30 구멍 (모서리에서 30) | **위치 추정** |
| PL F2 | 60×240 | 1 | 좌하단 브래킷 선반판 | **위치 추정** |
| PL F3 | 240×100 | 1 | 좌하단 브래킷 수직 립 | **위치 추정** |
| STIFFENER | 240×220 | 1 | 내부 수평 다이어프램으로 가정 | **위치 추정** |
| STIFFENER | 290×220 | 1 | 전면 S1 내면 보강판으로 가정 | **위치 추정** |
| LEVELING BOLT | D20 F10.8 L=135 | 4 | T1 구멍 관통 | 확정 |

## 좌표계

**Z-up 우수좌표계** — X = 동, Y = 북, **Z = 높이(+상방)**. IFC·AutoCAD·Revit·Tekla 와 동일하며
화면·STL·IFC 가 모두 같은 좌표를 쓴다.
PLANE: `XY` = 수평(두께 +Z) · `XZ` = 정면(두께 −Y) · `YZ` = 측면(두께 +X).
바닥 그리드는 **z = 0 평면 위**에 놓이며 중앙 십자 교차점이 곧 원점 (0,0,0) — 눈금 교차점을 그대로
좌표로 읽으면 된다. (그림자 바닥면만 모델 아래에 별도로 깔린다)
그리드 간격은 **모델 크기에서 1/2/5 단위로 골라** 칸 수가 대략 20~32개로 유지된다 (10·20·25·50·100·200·500 …).
간격이 항상 딱 떨어지는 값이라 교차점 좌표를 바로 읽을 수 있다.
예전 Y-up 기준으로 쓴 시트는 `COORD YUP` 행 한 줄로 그대로 읽힌다.
