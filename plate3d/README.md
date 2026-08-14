# plate3d

플레이트 조각들의 치수를 입력받아 3D 조립 모델을 생성하는 모듈.

## 파일

- **`plate_builder.js`** — 뷰어 엔진 (DATA_SCHEMA.md 구현). HTML에는 링크만 걸면 됨
  - 로드되면 자동 실행: `window.PLATE_DATA` 가 있으면 그 데이터로, 없으면 **빈 기본 화면**(좌 리스트/우 3D)
  - `plateBuilder.run({...})` 직접 호출도 가능 (자동 실행은 생략됨)
  - PLATE(형상+CUT) → MODULE(판 조립 + BASE) → ASSY(글로벌 배치, 중첩 가능) 3단 구조
  - Ref.Pt 뒤 `+`/`−` 로 두께 기준면 지정, ROT.X/Y/Z 3축 회전
  - polybooljs 절단(구멍·노치·REF), 그룹·부재별 토글/투명도, 중량, STL·IFC 출력
  - **measure**: 3D 화면·모듈 미리보기·판 2D 도면에서 두 점을 클릭해 거리·ΔX/ΔY/ΔZ 측정
  - 미리보기 창 **regen** 버튼: 줌·팬·회전을 처음 열렸을 때의 화면으로 되돌림
  - 엑셀(.xlsx) 로딩: Load Excel 버튼/드래그&드롭, 진행률 바, 결과·경고 패널
  - 좌측 목록: PLATES(클릭 → 2D 도면 팝업) · MODULES(클릭 → 3D 미리보기) · ASSEMBLY(조립체·모듈)
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
예전 Y-up 기준으로 쓴 시트는 `COORD YUP` 행 한 줄로 그대로 읽힌다.
