# plate3d 엑셀 데이터 입력체계 설계안 (v1)

플레이트 조립 모델을 엑셀로 데이터화하기 위한 시트 구조.
개념: **부재 정의(PLATE) → 빼기 형상(CUT) → 배치(ASSY)** 3시트.
(구버전 키 PLACE 도 ASSY 의 별칭으로 계속 인식됨)

- 판은 항상 **로컬 XY평면에서 정의** (P1=(0,0), 가로 x, 세로 y, 두께 z)
- 구멍·노치가 있는 판은 "가장 큰 외곽 판 + 잘라낼 부분 subtract" 조합으로 입력
- 배치는 두 방식: **PLANE**(평면+오프셋+각도) / **EDGE**(다른 판의 모서리에 붙이기)

---

## 0. 기본 규약

### 형상 원형: TRAP (사다리꼴) / CIRC (원형)
사다리꼴 파라미터 4개로 삼각형·사각형·사다리꼴을 모두 표현한다.

```
      OF      TW
      ├──┤├──────┤
      P4────────P3      ─┬─
     /            \      │ H
    /              \     │
   P1──────────────P2   ─┴─
   ├──────  B  ──────┤
```

| 파라미터 | 의미 | 비고 |
|---|---|---|
| B  | 밑변 길이 | |
| TW | 윗변 길이 | TW = B → 직사각형, TW = 0 → 삼각형 |
| H  | 높이 | |
| OF | 윗변 좌측단의 수평 오프셋 | 생략 시 (B−TW)/2 = 등변 사다리꼴 |
| THK | 두께 | |
| D | 직경 | SHAPE=CIRC 일 때만 |

### 점·변 이름 (자동 부여) — 9점 체계

접두사: **p = 점(point), e = 변(edge)** — 참조 시 접두사로 점/변이 구분된다 (예: `T2-1.pbl`, `T2-1.eb`).

```
   ptl ──── ptc ──── ptr      ← et (top)     et = {ptl, ptc, ptr}
    │                 │                        eb = {pbl, pbc, pbr}
   plm      pcc      prm      el (left)        el = {ptl, plm, pbl}
    │                 │       er (right)       er = {ptr, prm, pbr}
   pbl ──── pbc ──── pbr      ← eb (bot)       (꼭짓점은 이웃 변과 공유)
```

| 점 | 위치 |
|---|---|
| ptl, ptr, pbl, pbr | 실제 외곽선의 꼭짓점 (pbl = 로컬 원점 (0,0)) |
| ptc, pbc, plm, prm | 각 변의 중점 (실제 외곽선 위) |
| pcc | 도심 |

부속 규칙:
- **실제 외곽선 기준** (bbox 아님) — 오프셋 사다리꼴의 tl은 실제 꼭짓점 (OF, H), tc는 실제 윗변 중점. 판 밖 허공에 점이 생기지 않는다.
- **삼각형(TW=0)**: ptl = ptc = ptr 이 꼭짓점 한 점으로 겹침 (허용). 단 EDGE 방식으로 et 에 붙이는 입력은 에러 처리.
- **로컬 방향 고정**: top/left 등의 방향은 XY평면에 그린 정의 시점 기준. 참조 시에는 배치·회전·MIRROR 적용 후의 세계 좌표를 반환.
- **CUT 무관**: 점은 절단 전 외곽 기준으로 고정 — 노치로 잘려나가도 pbl 위치는 유지 (예측 가능, 절단 변경에 조립이 안 깨짐).
- **원형판(CIRC)**: pcc + 원주 4분원점 ptc/pbc/plm/prm (변·꼭짓점 없음).

---

## 1. PLATE 시트 — 부재 정의 (부품 라이브러리)

**블록 헤더 방식**: `#`로 시작하는 헤더 행이 아래 데이터 행들의 열 구성을 결정한다.
한 시트에 여러 블록을 섞어 쓸 수 있고, 헤더의 열 이름으로 형상이 자동 판별된다.

```
(사다리꼴)  # PLATE | ID | WT | WB | H | OFF_T | OFF_B | THK | MAT
(사각형)    # PLATE | ID | B | H | THK | MAT
(원형)      # PLATE | ID | D | THK | MAT
```

| 열 | 의미 | 비고 |
|---|---|---|
| WT | 윗변 폭 | WT = 0 → 삼각형 |
| WB | 밑변 폭 | |
| H | 높이 | |
| OFF_T | 윗변 좌측단 수평 오프셋 | 생략 = 0 |
| OFF_B | 밑변 좌측단 수평 오프셋 | 생략 = 0 |
| B | 사각형 폭 | 사각형 블록 전용 |
| D | 직경 | 원형 블록 전용 |
| THK | 두께 | 생략 = 10 |
| MAT | 재질 | 표시용 |

```
      OFF_T    WT
      ├───┤├──────┤
       ptl ────── ptr     ─┬─
       /            \      │ H
     pbl ────────── pbr   ─┴─
  ├──┤├───── WB ─────┤
  OFF_B
```

- 수량 열 없음 — ASSY 행 수로 자동 집계.
- 같은 외곽이라도 구멍이 다르면 다른 ID (제작 도면과 동일한 원칙).
- 구버전 단일 헤더(ID/SHAPE/B/TW/H/OF/D/THK/MAT)도 계속 인식됨.

## 2. CUT 시트 — 빼기 형상 (구멍·노치·절단)

**규칙: PLATE에는 절단 전의 가장 큰 판을 입력하고, 잘라낼 부분마다 CUT 1행.**
CUT 형상이 판 안쪽이면 구멍, 외곽선에 걸치면 노치/절단. 판 밖으로 나가도 되며 겹치는 부분만 빠진다. 여러 행이면 순서대로 계속 subtract.

| 열 | 의미 | 입력값 | 예 |
|---|---|---|---|
| PLATE | 대상 부재 | PLATE의 ID | T1 |
| TYPE | 빼기 형상 | CIRC / TRAP / REF | CIRC |
| D | 구멍 직경 | mm (CIRC) | 22 |
| B, TW, H, OF | 사다리꼴 치수 | mm (TRAP) | |
| REF | 형상 차용 | 다른 PLATE ID (TYPE=REF) | |
| U, V | 위치 (부재 로컬, P1 기준) | mm — CIRC는 중심, TRAP은 P1 | 90, 40 |
| ANG | 면내 회전 | 도(°) | 0 |
| NX, PX | 가로 배열: 개수, 피치 | 개, mm (생략 = 1) | 2, 220 |
| NY, PY | 세로 배열: 개수, 피치 | 개, mm | 2, 220 |

예:
| 케이스 | 입력 |
|---|---|
| 볼트구멍 4개 (2×2) | CIRC D22, U90 V40, NX2 PX220, NY2 PY220 |
| 좌하단 노치 50×110 | TRAP 50×50×110, U0 V0 (모서리에 걸침) |
| 우상단 빗면 80×60 | TRAP B80 TW0 H60, U=B V=H, ANG180 (삼각형을 모서리에 대고 빼기) |
| 다른 판 관통 슬롯 | TYPE=REF, REF=슬롯형상 PLATE ID |

## 3. ASSY 시트 — 배치 (조립)

한 행 = 인스턴스 하나. METHOD로 두 방식 중 선택.

### 공통 열
| 열 | 의미 | 입력값 |
|---|---|---|
| NO | 인스턴스 번호 (고유) | 예: S1-1 |
| PLATE | 부재 | PLATE의 ID |
| METHOD | 배치 방식 | PLANE / EDGE |
| MIRROR | 좌우 반전 | 빈칸 / X |
| GROUP | 병합(용접) 그룹 | 문자열 |

### 방법 1 — METHOD=PLANE : 평면 + 오프셋 + 각도
| 열 | 의미 | 입력값 |
|---|---|---|
| PLANE | 기준 평면 | FRONT(정면) / SIDE(측면) / PLAN(수평) |
| OFFSET | 평면에서 법선 방향 거리 | mm |
| U, V | 평면 안에서 P1 위치 | mm |
| ANG | 면내 회전 | 도(°) |

평면별 축 대응 (도면 뷰 그대로):
| PLANE | 로컬 x → | 로컬 y → | OFFSET(두께) 방향 |
|---|---|---|---|
| FRONT (정면도) | 월드 X (우) | 월드 Y (상) | 월드 Z (앞) |
| SIDE (측면도) | 월드 Z (깊이) | 월드 Y (상) | 월드 X (우) |
| PLAN (평면도) | 월드 X (우) | 월드 Z (안쪽) | 월드 Y (상) |

### 방법 2 — METHOD=EDGE : 다른 판의 모서리에 붙이기
| 열 | 의미 | 입력값 |
|---|---|---|
| TO | 붙일 대상 인스턴스 | 예: T2-1 (자기보다 위 행만) |
| MY_EDGE | 내 판의 변 | et / eb / el / er |
| TO_EDGE | 대상 판의 변 | et / eb / el / er |
| FOLD | 변을 힌지로 세우는 각도 | 180=같은 평면 이어붙임, 90=직각, 그 외=경사 |
| ALIGN | 변 방향 정렬 | S(시작)/C(중앙)/E(끝), 기본 S |
| SLIDE | 변 방향 추가 밀기 | mm |
| FLUSH | 두께 정합 | OUT(바깥면)/IN(안쪽면)/C(중심), 기본 C |

```
FOLD=180 (이어붙임)          FOLD=90 (직각 세움)
                                    ┌──┐
────────┬────────           ────────┤  │← 내 판
 대상판  │ 내 판              대상판  └──┘
```

### 배치 예 (서포트 브래킷)
| NO | PLATE | METHOD | 입력 | 뜻 |
|---|---|---|---|---|
| T2-1 | T2 | PLANE | PLAN, OFFSET 0, U −125, V −120 | 바닥 수평판 |
| S1-1 | S1 | EDGE | TO T2-1, eb→eb, FOLD 90, FLUSH OUT | 하판 앞변에 세운 전면 측판 |
| S1-2 | S1 | EDGE | TO T2-1, eb→et, FOLD 90, FLUSH OUT, MIRROR X | 후면 측판 |
| B1-1 | B1 | EDGE | TO T2-1, eb→er, FOLD 90, FLUSH OUT | 우측판 |
| T1-1 | T1 | PLANE | PLAN, OFFSET 280, U −175, V −150 | 수평 상판 |
| C2-1 | C2 | PLANE | SIDE, OFFSET −60, U −60, V 290 | 상판 위 기둥판 |

역할 분담: **기준 판(바닥·상판 등)은 PLANE으로 절대 배치, 붙는 판들은 EDGE로 체인 조립.**

---

## 4. 엑셀 입력 (단일 시트 · 키워드 방식)

한 시트에 키워드 행으로 순차 입력한다. `Load Excel` 버튼 또는 화면에 .xlsx 드래그&드롭.

**공통 규칙**
- 행 첫 글자가 `#` 또는 `!` 이면 주석 (무시)
- `END` 키워드가 나올 때까지가 유효한 입력
- 대소문자 구분 없음 — 내부에서 대문자로 변환해 처리
- 필요 CDN: `https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js`

| 키워드 | 값 (순서대로) | 설명 |
|---|---|---|
| PLATE | ID, WT, WB, H, OFF_T, OFF_B, THK, MAT | 사다리꼴 (값 7개 이상이면 사다리꼴로 판별) |
| PLATE | ID, B, H, THK, MAT | 사각형 |
| BAR | ID, Dia, Length | 원기둥 (볼트 등) |
| CUT | RECT, B, H, L.X, L.Y, L.ROT, dx, dy, repeat | 직전 PLATE/BAR 에 사각 구멍/노치 |
| CUT | CIRC, D, L.X, L.Y, L.ROT, dx, dy, repeat | 원형 구멍 |
| CUT | PLATE, ID, L.X, L.Y, L.ROT, dx, dy, repeat | 다른 PLATE 외곽 형상으로 빼기 |
| ASSY | ID, PLANE, Ref.Pt, L.X, L.Y, L.ROT, OFFSET | 배치 |
| END | | 입력 종료 |

- **CUT은 바로 위에서 정의한 PLATE/BAR에 적용** (정의 → 절단 → 다음 부재 순서로 작성)
- CUT 위치: CIRC는 중심, RECT/PLATE는 좌하단 기준. dx/dy/repeat = 배열 복제 (피치 벡터 × 개수)
- ASSY의 PLANE: XY(정면)/YZ(측면)/XZ(수평), Ref.Pt: tl~br·cc (p 접두사 있어도 인식)
  — 부재의 Ref.Pt 점이 평면 내 (L.X, L.Y)에 오도록 배치, L.ROT는 그 점 기준 면내 회전, OFFSET은 법선 방향 거리

## 5. 처리 파이프라인

```
엑셀(.xlsx: PLATE/CUT/ASSY 3시트)
  → ExcelJS 로 로드 (기존 excel_reader.js 의 loadSheetData 방식)
  → PLATE+CUT: 외곽 폴리곤 − 빼기 폴리곤 → THREE.Shape → Extrude
  → ASSY: PLANE 행은 직접 변환행렬, EDGE 행은 대상 변의 월드좌표에서 유도
           (위→아래 1-pass, EDGE의 TO는 앞선 행만 참조 → 순환 방지)
  → BOM/중량 자동 집계, STL 내보내기
```

- 뷰어 HTML에 .xlsx 드래그&드롭 → 즉시 재생성 ("엑셀 수정 → 다시 드롭" 업데이트 흐름)
- 향후 확장: POLY(꼭짓점 나열) 형상, 경사 부재용 2점 구속, 그룹 단위 복제/이동
