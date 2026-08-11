# plate3d

플레이트 조각들의 치수를 입력받아 3D 조립 모델을 생성하는 모듈.

## 파일

- **`plate_builder.js`** — 뷰어 엔진 (DATA_SCHEMA.md 구현). 사용자 HTML에서는 링크만 걸면 됨
  - `plateBuilder.run({ title, PLATE, CUT, PLACE, colors })` 하나로 좌측 리스트+우측 3D 화면 자동 생성
  - PLANE/EDGE 배치, MIRROR, polybooljs 절단(구멍·노치·REF), 그룹·부재별 토글, 중량, STL
- `plate_builder.html` — 사용 예 (상대경로 `./plate_builder.js` — 저장소를 클론해서 열 때)
- `codepen_example.html` — **CodePen용 예제** (jsDelivr CDN 절대경로 — 전체를 HTML 패널에 붙여넣기)
- `plate_assembly.html` — 초기 버전 (좌표 하드코딩 방식, 참고용)

## 링크만으로 사용하기

```html
<script src="https://unpkg.com/three@0.147.0/build/three.min.js"></script>
<script src="https://unpkg.com/three@0.147.0/examples/js/controls/OrbitControls.js"></script>
<script src="https://unpkg.com/polybooljs@1.1.0/dist/polybool.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/macroBIM/macroBIM@<커밋해시>/plate3d/plate_builder.js"></script>
<script>
plateBuilder.run({ PLATE: [...], CUT: [...], PLACE: [...] });
</script>
```

- 저장소가 public이라 jsDelivr(`cdn.jsdelivr.net/gh/...`)로 바로 서빙됨. raw.githubusercontent.com 은 브라우저가 스크립트 실행을 차단하므로 사용 불가.
- 현재 브랜치명에 `/`가 있어 브랜치 URL은 안 되고 **@커밋해시**를 사용. main 병합 후에는 `@main/plate3d/plate_builder.js` 로 고정 가능 (단 jsDelivr가 브랜치 URL을 최대 12시간 캐시함 — 즉시 반영이 필요하면 커밋해시 사용).

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

X = 정면도 좌우, Y = 높이(+상방), Z = 깊이(+정면).
원점은 박스 평면 중심, Y=0 은 하판(T2)·측판(S1) 하단.
