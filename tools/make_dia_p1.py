#!/usr/bin/env python3
"""tools/make_dia_p1.py — PSCBOX_DIAPHRAGM_P1.xlsx 를 만든다.

검증 단면 셋째 : **주두부 격벽** (2D · 단면 평면의 철근만)
  엔진은 동결 상태다 (jfield.js · jlong.js = 012ae5c, tools/check_freeze.js).
  이 시트는 입력만 만든다.

출처
  8-244  주두부 배근도(2) (S=1:30, 2007.12) — 평창~정선 도로건설공사(3공구) · 북실대교 P1
  단면 · 개구부는 S15 (bench/fixture/s15.json · 8-018 · 8-020) 의 값을 그대로 쓴다.
  **8-244 벡터로 다시 쟀다** : 외곽 14 점 · 개구부 8 점 전부 도면 선에서 1.9 mm 안.

! 블라인드가 아니다 — S15 는 같은 도면 세트로 만들었다 (단면 · 개구부 · 상부 철근).
  이번에 새로 넣는 것은 면 철근망(⑫ ⑬ ⑭ · ⑩ ⑪ 의 세로 다리)과 개구부 보강(M1~M3)이다.

실행 :  python3 tools/make_dia_p1.py
"""

# ── 엑셀이 원본이다 (2026-10-18 사용자 결정) ─────────────────────────────
#  이 스크립트는 시트를 **처음 만들 때만** 썼다. 이제 원본은 엑셀이고, 사람이든
#  Claude 든 엑셀을 직접 고친다. 여기서 다시 만들면 엑셀에서 고친 것이 사라진다.
#  그래서 엑셀이 있으면 멈춘다. (출처 설명은 엑셀의 # 주석 행에 그대로 있다.)
import os as _os, sys as _sys
if _os.path.exists('PSCBOX_DIAPHRAGM_P1.xlsx'):
    _sys.exit('PSCBOX_DIAPHRAGM_P1.xlsx 이 이미 있다 — 엑셀이 원본이다(2026-10-18). 엑셀을 직접 고친다. 이 스크립트는 다시 쓰지 않는다.')
import openpyxl

R = []
def row(*v): R.append(list(v))

row('# PSCBOX DIAPHRAGM  --  P1 주두부 격벽 (8-244)   *** 2D TEST · 엔진 동결 012ae5c ***')
row('# page    : bim_pscbox_diaphragm_test.js  (셀이 콘크리트로 차 있고 가운데 개구부 하나)')
row('# section : 평창~정선 도로건설공사 (3공구) / 주두부 배근도(2) / 8-244 / S=1:30 / 2007.12')
row('#           단면 · 개구부는 S15 (8-018 일반 단면 제원도 · 8-020 주두부 구조 일반도 단면 A-A) 그대로')
row('#')
row('# 8-244 벡터로 다시 잰 것 (pdftocairo -svg · 청록 선 · 21.174 mm/pt — 1:30 의 반 크기로 인쇄된 도면)')
row('#   데크 12,400 (-3%) · 중심선 깊이 7,795 · 복부 외측 ±3,498 수직 · 하면 7,000 (-3%)')
row('#   캔틸레버 하면 헌치 1,789 + 950 · 개구부 팔각 1,201 x 1,518 · 모서리 접기 약 250')
row('#   S15 로 세운 단면의 꼭짓점 22 개(외곽 14 · 개구부 8) 가 도면 선에서 **최대 1.9 mm**')
row('#   (bench/engine.js 의 하네스가 개구부 형상 <select> 를 숫자로 읽어 OCT 가 HEX 로 서던 것을')
row('#    이번에 고쳤다 — 페이지는 원래 OCT 였다)')
row('#')
row('type', '1c')
row('seg', 18000, '', 'pier segment 9.000 + 9.000 (S15)')
row('dia', 2000, '', '격벽 두께(교축) — 폐합철근(3D)에만 쓰인다. 이 2D 시험에는 안 쓴다')
row('# cover : 8-244 에 피복 표기가 없다. 철근을 넣을 때 도면의 철근 중심 위치에서 다시 정한다 (S15 값 그대로 둔다)')
row('cover', 50, 40, 30)
row('#')
row('# ---- overall ----')
row('dim', 'TH', 7800, 'Y1  deck top to soffit at centreline (8-244 벡터 7,795)')
row('dim', 'SLL', -3, 'single -3% plane across the whole deck')
row('dim', 'SLR', -3)
row('dim', 'SLB', -3, 'bottom face runs parallel to the deck')
row('dim', 'TTS', 280)
row('dim', 'TBS', 800, 'Y2  bottom slab at centreline')
row('# ---- widths  (right side mirrors the left) ----')
row('dim', 'WL', 6200, '12,400 / 2')
row('dim', 'WTL', 3500, 'web outer face (8-244 벡터 ±3,498)')
row('dim', 'WBL', 3500, 'bottom slab half width, 7,000 / 2')
row('dim', 'WCAL1', 1750, '8-244 벡터 1,789 (경사 길이)')
row('dim', 'WCAL2', 950)
row('dim', 'TWEBL', 500, '격벽에서는 셀이 차 있어 단면에 안 나온다')
row('# ---- cantilever ----')
row('dim', 'TCAL', 280, 'tip')
row('dim', 'TCAL1', 600, 'root, at the web outer face')
row('dim', 'TCAL2', 280)
row('# ---- top slab haunch : one step, 600 at the web -> 280 over a 1,750 run (격벽에서는 차 있다) ----')
row('dim', 'TTHL1', 600)
row('dim', 'TTHL2', 280)
row('dim', 'WTHUL1', 1750)
row('dim', 'WTHUL2', 0)
row('# ---- bottom slab haunch (격벽에서는 차 있다) ----')
row('dim', 'TBHL1', 1050)
row('dim', 'TBHL2', 800)
row('dim', 'WBHUL1', 1750)
row('dim', 'WBHUL2', 0)
row('dim', 'TBEL', 1050)
row('# ---- fillets : square corners ----')
row('dim', 'R_WTL', 0); row('dim', 'R_WTIL', 0); row('dim', 'R_WBL', 0)
row('#')
row('# ---- diaphragm opening : octagon (S15 · 8-020 단면 A-A) ----')
row('# open | shape | B | H | Cttx | Ctty | Ctbx | Ctby | X | Y')
row('#   Y 는 하부슬래브 윗면(TBS 800)에서 잰다 : 개구부 아래끝이 하면에서 1,500 → 700')
row('#   8-244 벡터 : 1,201 x 1,518 · 중심선에 놓임 · 아래끝이 하면에서 약 1,490')
row('open', 'OCT', 1200, 1500, 250, 250, 250, 250, 0, 700)
row('#')
row('# ================= DUCT · 매입물 (8-244 벡터) =================')
row('# duct | id | shape | D | H | x | y | ref | clr        (문법은 bim_duct.js)')
row('#   8-244 에서 원을 전부 찾아 셋으로 갈랐다 :')
row('#     자홍 ⊕ Ø 111.7~111.8  46 개 — 상부슬래브의 종방향 강연선 덕트. 상면에서 깊이 160 · 310 (두 줄)')
row('#     적색 ○ Ø 101.6         8 개 — 상부슬래브 바로 밑 격벽 안. 상면에서 깊이 940. **용도는 도면에 없다**')
row('#                                    (슬리브 · 임시 강봉 등) — 철근이 피해야 할 매입물로 넣는다')
row('#     적색 ○ Ø 239          — 철근 번호 말풍선 (12) (M1) … 덕트가 아니다. 넣지 않는다')
row('#   깊이는 데크 -3% 면에서 잰다 (ref deck). 좌우 대칭 — 왼쪽 · 오른쪽 위치가 1 mm 안에서 같다.')
row('#   같은 다리의 S14 (주두부 옆 세그먼트) 는 이 두 줄에 한쪽 8 + 2 개다 — 주두부에 덕트가 훨씬 많다.')
row('#   단면 외형이 같아도 덕트 배치는 자리마다 다르다.')
row('#   ! 외경은 벡터로 잰 값(112 · 102). S14 는 픽셀로 재서 120 으로 넣었다(±10).')
row('#   clr 25 는 S14 와 같다 (도면에 순간격 표기 없음).')
D160 = [1255, 1405, 1555, 1755, 1905, 2055, 2345, 2625, 2915, 3585, 3885, 4185, 4335, 4485, 4685, 4835, 4985]
D310 = [2055, 2345, 2625, 3885, 4185, 4335]
EMB = [1100, 1540, 1900, 2290]
nd = 0
row('# --- 상단 열 : 상면에서 160 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, x in enumerate(D160):
        nd += 1; row('duct', 'A%s%d' % (sg, i + 1), 'circ', 112, '', s * x, 160, 'deck', 25)
row('# --- 하단 열 : 상면에서 310 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, x in enumerate(D310):
        nd += 1; row('duct', 'B%s%d' % (sg, i + 1), 'circ', 112, '', s * x, 310, 'deck', 25)
row('# --- 매입물 : 상면에서 940 (용도 미확인) ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, x in enumerate(EMB):
        nd += 1; row('duct', 'E%s%d' % (sg, i + 1), 'circ', 102, '', s * x, 940, 'deck', 25)
row('#')
row('# ================= REBAR — 다음 단계 =================')
row('#  면 철근망 : srebar code 1 (곧은 철근 열차 — 자리에서 태어나 양쪽으로 자라다 처음 만나는 피복선에서 멈춘다)')
row('#  개구부    : 개구부 면은 피복면(인력장)이다 — 철근망은 거기서 멈추므로 저절로 잘린다 · M1~M3 는 그 면에 앉는다')
row('end')

wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'input'
for r in R: ws.append(r)
wb.save('PSCBOX_DIAPHRAGM_P1.xlsx')
print('PSCBOX_DIAPHRAGM_P1.xlsx  ·  ducts', nd, ' ·  rows', len(R))
