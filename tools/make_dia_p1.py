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
row('# ================= REBAR — 다음 단계 =================')
row('#  면 철근망 : srebar code 1 (곧은 철근 열차 — 자리에서 태어나 양쪽으로 자라다 처음 만나는 피복선에서 멈춘다)')
row('#  개구부    : 개구부 면은 피복면(인력장)이다 — 철근망은 거기서 멈추므로 저절로 잘린다 · M1~M3 는 그 면에 앉는다')
row('end')

wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'input'
for r in R: ws.append(r)
wb.save('PSCBOX_DIAPHRAGM_P1.xlsx')
print('PSCBOX_DIAPHRAGM_P1.xlsx  ·  rows', len(R))
