# PLATE3D 엑셀 데이터 입력체계 설계안 (v1)

플레이트 조립 모델을 엑셀로 데이터화하기 위한 시트 구조.
개념: **부재 정의(PLATE) → 빼기 형상(HOLE) → 절단(CUT) → 조립(MODULE) → 배치(ASSY)**.
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

점 이름은 **t/m/b (top/middle/bottom) × l/c/r (left/centre/right)** 조합. 변은 `e` 접두사.

```
   tl ───── tc ───── tr      ← et (top)     et = {tl, tc, tr}
    │                │                        eb = {bl, bc, br}
   ml       mc       mr      el (left)        el = {tl, ml, bl}
    │                │       er (right)       er = {tr, mr, br}
   bl ───── bc ───── br      ← eb (bot)       (꼭짓점은 이웃 변과 공유)
```

| 점 | 위치 |
|---|---|
| tl, tr, bl, br | 실제 외곽선의 꼭짓점 |
| tc, bc, ml, mr | 각 변의 중점 (실제 외곽선 위) — 사다리꼴이면 ml/mr은 **빗변의 중점** |
| mc | 도심 |

**판의 로컬 원점 = PLATE/HOLE 행에서 고른 BASE.pt** 이고, 그 점이 (0,0)이 된다.
비워두면 판은 **bc**(하단 중앙), 원형(CIRC)과 HOLE은 **mc**(중심)가 기본.
두께는 이 면을 기준으로 좌우 절반씩(−THK/2 ~ +THK/2) 붙는다.

부속 규칙:
- **실제 외곽선 기준** (bbox 아님) — 오프셋 사다리꼴의 tl은 실제 꼭짓점 (OF, H), tc는 실제 윗변 중점. 판 밖 허공에 점이 생기지 않는다.
- **삼각형(TW=0)**: tl = tc = tr 이 꼭짓점 한 점으로 겹침 (허용). 단 EDGE 방식으로 et 에 붙이는 입력은 에러 처리.
- **로컬 방향 고정**: top/left 등의 방향은 XY평면에 그린 정의 시점 기준. 참조 시에는 배치·회전·MIRROR 적용 후의 세계 좌표를 반환.
- **CUT 무관**: 점은 절단 전 외곽 기준으로 고정 — 노치로 잘려나가도 bl 위치는 유지 (예측 가능, 절단 변경에 조립이 안 깨짐).
- **원형판(CIRC)**: 점은 **5개뿐** — mc + 원주 4분원점 tc / ml / mr / bc (변·꼭짓점 없음). 모서리 이름(tl 등)을 쓰면 tc/bc로 대체된다.
- **예전 표기 호환**: `pbl` `pcc` `plm` `prm` 처럼 p를 붙인 이름과 `lm` `cc` `rm` 도 계속 인식된다 (각각 bl, mc, ml, mr).

---

## 1. PLATE 시트 — 부재 정의 (부품 라이브러리)

**블록 헤더 방식**: `#`로 시작하는 헤더 행이 아래 데이터 행들의 열 구성을 결정한다.
한 시트에 여러 블록을 섞어 쓸 수 있고, 헤더의 열 이름으로 형상이 자동 판별된다.

```
(사다리꼴)  # PLATE | ID | MAT | THK | TRAP | BASE.pt | WB | WT | H | OFF_T
(사각형)    # PLATE | ID | MAT | THK | RECT | BASE.pt | B | H
(원형)      # PLATE | ID | MAT | THK | CIRC | BASE.pt | D
(빼기형상)  # HOLE  | ID | TRAP | BASE.pt | WB | WT | H | OFF_T
            # HOLE  | ID | RECT | BASE.pt | B | H
            # HOLE  | ID | CIRC | BASE.pt | D
```
(도형 키워드 없는 예전 열 구성 `ID | WT | WB | H | OFF_T | OFF_B | THK | MAT` 도 계속 읽는다)

| 열 | 의미 | 비고 |
|---|---|---|
| WT | 윗변 폭 | WT = 0 → 삼각형 |
| WB | 밑변 폭 | |
| H | 높이 | |
| OFF_T | 윗변 좌측단 수평 오프셋 | 생략 = 0 |
| OFF_B | 밑변 좌측단 수평 오프셋 | 생략 = 0 |
| B | 사각형 폭 | 사각형 블록 전용 |
| D | 직경 | 원형 블록 전용 |
| THK | 두께 | 생략 = 10. **HOLE에는 없음** |
| MAT | 재질 | 표시용. **HOLE에는 없음** |
| BASE.pt | 이 형상의 원점이 될 점 | 9점 중 하나. 생략 = PLATE는 bc, CIRC·HOLE은 mc |

```
      OFF_T    WT
      ├───┤├──────┤
        tl ─────── tr     ─┬─
       /            \      │ H
      bl ─────────── br   ─┴─
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
| OFFSET | 평면에서 법선 방향 거리 | mm (판의 **두께 중앙면** 위치) |
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
| PLATE | ID, MAT, THK, **TRAP**, BASE.pt, WB, WT, H, OFF_T | 사다리꼴 부재 |
| PLATE | ID, MAT, THK, **RECT**, BASE.pt, B, H | 사각 부재 |
| PLATE | ID, MAT, THK, **CIRC**, BASE.pt, D | 원형 부재 (봉·원판) |
| HOLE | ID, **TRAP**, BASE.pt, WB, WT, H, OFF_T | 재사용할 빼기 형상 |
| HOLE | ID, **RECT**, BASE.pt, B, H | 〃 |
| HOLE | ID, **CIRC**, BASE.pt, D | 〃 |
| BAR | ID, Dia, Length | 원기둥 (`PLATE … CIRC` 와 동일, 옛 표기) |
| CUT | 판ID, L.X, L.Y, **형상ID**, dx, dy, repeat | 형상ID(HOLE 또는 다른 PLATE)를 그 판에서 빼기 |
| **MODULE** | ID, PLATE.ID, Ref.Pt, L.X, L.Y, L.Z, PLANE, ROT.X, ROT.Y, ROT.Z | 모듈에 판 1장 배치. 판의 Ref.Pt가 **모듈 로컬 (L.X, L.Y, L.Z)** 에 오고, PLANE은 그 판이 놓일 평면, ROT.X/Y/Z는 그 점을 중심으로 한 회전(도). 행마다 모듈 ID 반복 — 같은 ID 행들이 한 모듈로 누적. PART도 별칭 인식 |
| **MODULE** | ID, **BASE**, 판인스턴스, 점이름 | 모듈 기준점 = 구성 판의 9점 중 하나(`bc+`처럼 면 지정 가능). **누락 시 경고** + 로컬 원점 사용 |
| **COORD** | ZUP (기본) / YUP | 이 시트를 어느 좌표계로 읽을지. `YUP` 이면 예전 Y-up 기준으로 조립한 뒤 한 번만 세워 배치 — MODULE/ASSY 행보다 **위**에 둘 것 |
| **ASSY** | ID, ref MOD/ASSY, **ADD**, G.X, G.Y, G.Z, ROT.X, ROT.Y, ROT.Z | **생성할 조립체 ID** 와 **참조할 MODULE / 다른 ASSY / 낱장 PLATE**. 참조 대상의 기준점이 **글로벌 (G.X, G.Y, G.Z)** 에 오고, ROT.X/Y/Z로 3축 회전 |
| **ASSY** | ID, ref MOD/ASSY, **MIR**, G.X, G.Y, G.Z, PLANE | 참조 대상을 **있는 자리에서** (G.X, G.Y, G.Z)를 지나는 XY/YZ/XZ 평면 기준으로 반사. 결과가 하나뿐이므로 **ID 그대로** |
| **ASSY** | ID, ref MOD/ASSY, **COPY**, d.X, d.Y, d.Z, repeat | 참조 대상을 **있는 자리에서** (dX,dY,dZ)씩 밀어 **repeat개 추가 복사**. 생성 ID = **`ID.001`, `ID.002` …** (생성 순서대로 점 + 3자리) |
| **ASSY** | ID, ref MOD/ASSY, **ROT**, C.X, C.Y, C.Z, AXIS, Angle, repeat | **회전 복사** — (C.X, C.Y, C.Z)를 지나는 월드 **X/Y/Z 축** 둘레로 Angle°씩 돌려가며 **repeat개 추가 복사**. 생성 ID = **`ID.001`, `ID.002` …** (생성 순서대로 점 + 3자리) |
| END | | 입력 종료 |

- **PLATE와 HOLE은 입력 칸이 같아 보여도 서로 다른 것**
  - PLATE = 실물. 질량·색상·IFC·STL이 전부 이 행에서 나온다.
  - HOLE = 빼기용 2D 형상. **두께도 재질도 받지 않는다** — 그래서 구조적으로 실물이 될 수 없고,
    실수로 MODULE에 배치해도 엔진이 걸러낸다. (깊이가 필요해지는 날이 오면 그 값은 HOLE이 아니라
    CUT 행에 붙는다. 같은 Ø22가 어떤 판에서는 관통, 다른 판에서는 부분일 수 있으므로 깊이는
    *형상*이 아니라 *적용*의 성질이다.)
- **도형 키워드(TRAP/RECT/CIRC)는 고정 칸**에 온다. 그래서 뒤따르는 값 개수가 달라도(TRAP 4개,
  RECT 2개, CIRC 1개) 앞쪽 칸이 밀리지 않는다. 예전처럼 값 패턴으로 형상을 추측하지 않으므로
  MAT 칸에 `400` 같은 숫자를 써도 오인되지 않는다.
- **BASE.pt = 그 형상의 원점**. 9점 중 하나를 고르면 그 점이 (0,0)이 된다.
  비우면 PLATE는 `bc`, CIRC와 HOLE은 `mc`.
- **CUT의 L.X / L.Y 는 대상 판의 원점(= 그 판의 BASE.pt)에서 잰다.** 놓이는 형상은
  **자기 BASE.pt** 가 그 자리에 오도록 배치된다.
  예: `HOLE h.M22 CIRC mc 22` + `CUT pl.T1 -110 90 h.M22` = 판 원점에서 왼쪽 110, 위 90에 Ø22 구멍 중심
- **대상 판은 CUT 행보다 먼저** 정의돼 있어야 한다. 형상(HOLE/PLATE)은 시트 어디에 있어도 된다.
- **ID는 PLATE와 HOLE이 같은 공간을 쓴다** — CUT의 형상ID가 둘 다 가리킬 수 있기 때문. 중복되면 경고.
- 예전 CUT 순서도 계속 읽는다:
  `CUT [판ID] [기준점] L.X L.Y dx dy repeat RECT B H | CIRC D | PLATE ID` (형상을 **중심** 기준 배치)
  `CUT [판ID] [기준점] RECT B H L.X L.Y L.ROT dx dy repeat` (형상을 **좌하단** 기준 배치)
- 예전 PLATE 행(도형 키워드 없음)도 계속 읽는다: `PLATE ID WT WB H OFF_TOP [OFF_B] THK MAT`, `PLATE ID B H THK MAT`
- **dx / dy / repeat = 배열 복제**: repeat는 **추가 복제 개수**(원본 제외 — 0/빈칸이면 1개, 1이면 총 2개), dx·dy는 복제 간격 벡터.
  예: `CUT pl.T1 -110 90 h.M22 0 220 1` = Ø22 구멍이 (−110, 90)과 (−110, 310)에 2개
- PLANE: **XY(수평)/XZ(정면)/YZ(측면)** — Z-up 기준. Ref.Pt: tl·tc·tr·ml·mc·mr·bl·bc·br (예전 p 접두사 표기도 인식)
- **MODULE 행 읽는 법**: 「이 판(PLATE.ID)의 이 점(Ref.Pt)을 모듈 좌표 (L.X, L.Y, L.Z)에 놓고, PLANE 평면에 눕히고, 필요하면 그 점을 중심으로 ROT.X/Y/Z만큼 돌려라」
- **ASSY의 기준점**: 참조 대상이 MODULE이면 그 모듈의 **BASE 점**, 낱장 PLATE면 **bc**(평면은 XY 기준, 필요시 ROT으로 회전), 다른 ASSY면 그 조립체의 **자기 원점**
- **좌표 기준**
  | 명령 | 좌표 칸 | 의미 |
  |---|---|---|
  | ADD | G.X/G.Y/G.Z | **절대** — 참조 대상의 기준점이 이 좌표에 온다 |
  | MIR | G.X/G.Y/G.Z | **절대** — 대칭 평면이 지나는 점 |
  | ROT | C.X/C.Y/C.Z | **절대** — 회전축이 지나는 점 |
  | COPY | d.X/d.Y/d.Z | **상대** — 참조 대상이 놓인 자리에서의 이동량 |

  MIR·ROT·COPY는 모두 참조 대상을 **이미 놓인 자리에서** 반사·회전·이동시킨다.
  repeat는 CUT과 같이 **추가 복사 개수**(원본 제외)이고, ROT의 각도는 누적된다(30°, 60°, 90° …).
- **생성 ID는 ID 칸에 쓴 이름 그대로** 쓰고, 여러 개가 만들어지는 COPY·ROT만 뒤에 `001`, `002` …를
  붙인다(점 뒤에 3자리). 같은 ID를 쓴 행이 또 나오면 번호가 이어진다(`…CP.001, CP.002` 다음 행이 `…CP.003`).
- MIR 결과물도 정상적인 우수좌표계로 만들어진다 — 반사는 판 외형(프로필)에 접어 넣으므로
  STL 면 방향과 IFC 배치가 깨지지 않는다.
- 명령 칸(ADD/MIR/COPY)을 생략하면 ADD로 읽으므로 예전 시트도 그대로 동작한다.
- ASSY는 **중첩 가능** — 먼저 정의한 ASSY를 참조해서 더 큰 조립체를 만들 수 있음 (같은 ID를 여러 번 쓰면 `-2`, `-3` 접미사가 붙어 복수 배치)
- 회전 순서는 X → Y → Z (모듈/글로벌 축 기준)
- **좌표계는 Z-up 우수좌표계** — X 동, Y 북, **Z 위(높이)**. IFC·AutoCAD·Revit·Tekla 와 동일.
  화면·STL·IFC 모두 같은 좌표를 쓴다(변환 없음).

  | PLANE | 판의 로컬 x → | 판의 로컬 y → | 두께(+면) 방향 | 도면 |
  |---|---|---|---|---|
  | `XY` | X | Y | **+Z (위)** | 평면도 |
  | `XZ` | X | **Z (높이)** | −Y | 정면도 |
  | `YZ` | Y | **Z (높이)** | +X | 측면도 |

- **색상 규칙**: PLATE 목록 = 판별 색(모듈 미리보기에서 보임) · MODULE 목록 = 모듈 대표색(조립 화면에서 보임).
  조립(ASSY) 화면에서는 **모듈에 속한 판은 전부 그 모듈의 대표색**으로 칠해지고 판별 색은 무시된다.
  낱장으로 배치한 판은 자기 판 색을 그대로 쓴다.
- **왼쪽 MODULES 목록은 모듈 이름까지만** — 모듈을 클릭하면 열리는 미리보기 창 왼쪽 패널에
  구성 판 목록이 나오고, 판마다 **hide/show 체크 · 색상 · 투명도 · local axes** 를 조작한다.
  숨긴 판은 미리보기의 STL/IFC 출력에서도 빠진다.
- **ASSEMBLY 목록의 모듈 행**: hide/show 체크 · 모듈 대표색 선택 · 투명도 슬라이더
- **local axes 체크**: 미리보기 판 목록의 이름 옆 체크박스(또는 3D 화면의 `local axes`)를 켜면, 그 판의
  **Ref.Pt 위치**에 로컬 좌표축이 그려지고 기준점이 노란 원 + 점 이름(`bc`, `bc+` 등)으로 표시된다.
  두께 방향은 `+Z`(파랑) / `−Z`(회색) 화살표와 라벨로 양쪽 다 표시되어 어느 면이 +인지 바로 보인다.
- **id 체크박스**: 3D 화면과 모듈 미리보기 상단에 있음. 켜면 각 판 위에 이름표가 붙는다 —
  메인 화면은 배치 인스턴스 ID(`AS.A/PL.T1`), 미리보기는 모듈 안의 판 이름(`PL.T1`).
- **`+ / − surface` 체크박스**: 메인 화면의 `+ / − face` 와 같은 기능을 미리보기 헤더에도 추가.
- `id` · `+/− surface` · `measure` 는 **두 창이 각각 독립**으로 동작한다
  (`surface only` 만 두 창이 같은 상태를 공유).
- **plate 2D 창에서도 measure** 가 된다 — 9점·구멍 중심에 스냅되고, 두 점을 클릭하면
  거리와 ΔX·ΔY가 도면 위에 그려진다. 오른쪽 클릭으로 초기화, 드래그는 그대로 팬.
- **원형 구멍은 지름이 자동 표기**된다 — 원에 화살표가 닿는 지시선 + `Ø22`.
- **regen 버튼**: plate 2D 창·module 3D 창 헤더에 있음. 줌·팬·회전한 화면을 처음 열렸을 때의
  시점으로 되돌린다.
- **measure 체크박스**: 3D 화면 상단과 모듈 미리보기 헤더에 있음. 켜면 스냅 가능한 점(판 모서리·
  구멍 중심) 부근에 커서를 가져가면 노란 빈 원으로 표시되며 그 점에 붙는다. 두 점을 클릭하면
  ΔX·ΔY·ΔZ와 직선거리가 표시되고, **오른쪽 클릭으로 선택 초기화**(세 번째 왼쪽 클릭도 새 측정).
  측정 중에도 드래그 회전·오른쪽 드래그 팬은 그대로 동작한다.
- **왼쪽 ASSEMBLY 목록은 ASSY와 MODULE 까지만** 표시한다 (판 단위는 MODULE 목록과 미리보기에서 확인).
- **`COORD YUP`** 행을 MODULE/ASSY 보다 위에 한 줄 넣으면, 예전 Y-up 기준으로 작성한 시트를
  그대로 읽는다 (예전 좌표계로 조립한 뒤 한 번만 세워서 배치). 기본값은 `COORD ZUP`.
- 예전 열 순서(`PLANE Ref.Pt L.X L.Y L.ROT OFFSET`, `ASSY 대상ID PLANE …`)도 계속 읽음 — 세 번째 칸이 평면 이름인지로 자동 판별
- **Ref.Pt 뒤에 `+` / `−` 를 붙이면 두께 방향 기준면이 바뀜** (MODULE·POS·BASE·ASSY 모두 동일)

  | 표기 | 기준 | OFFSET이 가리키는 곳 |
  |---|---|---|
  | `bc` (기본) | 두께 중앙 | 판의 중립면 |
  | `bc+` | +면 (로컬 +Z 쪽 면) | 그 면이 OFFSET 위치에 옴 → 판은 OFFSET−THK ~ OFFSET |
  | `bc-` | −면 (로컬 −Z 쪽 면) | 그 면이 OFFSET 위치에 옴 → 판은 OFFSET ~ OFFSET+THK |

  즉 도면에 적힌 **면 치수를 그대로 입력**하면 되고, `±THK/2` 를 손으로 더할 필요가 없다.
  ± 방향(어느 쪽이 +면인지)은 좌측 MODULE 목록의 **local axes 체크박스**나 상단 **+ / − face** 버튼으로 확인.
  예: 두께 20 판을 `XZ bc+ 0 0 0 500` → 판 윗면(+면)이 Y=500, 판은 Y 480~500 차지
- **MODULE 조립 시 ASSY의 Ref.Pt**: 빈칸/`o` = BASE 점 (기본) · 9점 이름(`bc` 등) = 모듈 바운딩박스 점(Z는 중앙, `bc+`/`bc-`면 박스 앞/뒤면) · `판인스턴스.점`(예: `pl.C2_1.tc`, `pl.C2_1.tc+`) = 특정 판의 점 직접 지정
- ID에 `_숫자` 접미사를 붙이면 같은 MODULE/PLATE의 인스턴스로 인식 (예: `md.COL_1`, `md.COL_2` → 모듈 md.COL 2개 배치)
- ID 접두사 관례: `pl.` 판 · `br.` 볼트/봉 · `md.` 모듈
- 모듈 예 (한 행 = 판 1장, 모듈 ID 반복):
```
#MODULE  ID        PLATE.ID  Ref.Pt  L.X  L.Y  L.Z  PLANE  ROT.X ROT.Y ROT.Z
MODULE   md.tower  pl.T1     bc+     140    0    0  XZ
MODULE   md.tower  pl.C1_1   bc        0    0    0  XY
MODULE   md.tower  pl.C1_2   bc        0    0  120  XY
MODULE   md.tower  pl.C2_1   bc      -60    0   60  YZ
MODULE   md.tower  pl.C2_2   bc       60    0   60  YZ
MODULE   md.tower  BASE  pl.T1  bc-           ← 기준점 = T1 판 bc의 − 면

#ASSY   ID        ref MOD/ASSY  G.X  G.Y  G.Z  ROT.X ROT.Y ROT.Z
ASSY    as.comb   md.tower        0    0    0                    ← 모듈 통째로 배치
ASSY    as.comb2  md.tower      800    0    0     0    45     0  ← 같은 모듈, Y축 45° 회전
ASSY    as.big    as.comb         0    0  900                    ← 조립체를 다시 조립
ASSY    as.plate  pl.T1        -700    0    0                    ← 낱장 판도 배치 가능
```
(블록 방식 — `MODULE ID` 한 줄 후 `POS`/`BASE` 행 나열 — 도 계속 인식됨)

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
