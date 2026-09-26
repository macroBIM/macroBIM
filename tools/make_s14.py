#!/usr/bin/env python3
"""tools/make_s14.py — PSCBOX_S14.xlsx 를 만든다.

S14 는 격벽이 아니라 **일반 박스 단면**이라 `bim_pscbox_test.js` 에서 읽는다.
그래서 격벽 전용 블록(dia / open)은 넣지 않는다.

출처
  8-018  일반 단면 제원도 (S=1:50, 2007.12)  — 단면 제원표의 S14
  8-243  주두부 배근도(1) (S=1:30)           — SECTION A-A 가 S14 다 (깊이 6,853 일치)
  덕트    강연선 배치 단면 그림

실행 :  python3 tools/make_s14.py
"""
import openpyxl

R = []
def row(*v): R.append(list(v))

row('# PSCBOX  --  S14 (segment next to the pier)   *** 2D TEST ***')
row('# page    : bim_pscbox_test.js  (S14 는 격벽이 아니다 — 일반 박스 단면)')
row('# section : 평창~정선 도로건설공사 (3공구) / 일반 단면 제원도 / 8-018 / S=1:50 / 2007.12')
row('# rebar   : 주두부 배근도(1) / 8-243 / S=1:30   -- SECTION A-A 가 S14 다 (깊이 6,853 일치)')
row('# duct    : 강연선 배치 단면 (TC1 TC2 + 3..21 / 4..20 / TS1 TS2)')
row('#')
row('# 8-018 단면 제원표 :  S14   Y1 = 6,853   Y2 = 743   Y3 = 6,110   AREA = 16.061 m2')
row('#   Y1 전체 높이(중심선) · Y2 바닥슬래브 두께 · Y3 = Y1 - Y2')
row('#   덕트 그림의 280 + 5,830 + 743 = 6,853 과 정확히 맞는다')
row('type', '1c')
row('seg', 4750, '', '8-018 : 12 @ 4,750 = 57,000')
row('# cover is not given on the drawings -- page defaults kept')
row('cover', 50, 40, 30)
row('# ---- overall  (S15 와 같은 형상. 높이와 바닥슬래브만 다르다) ----')
row('dim', 'TH', 6853, 'Y1')
row('dim', 'SLL', -3, 'single -3% plane across the whole deck')
row('dim', 'SLR', -3)
row('dim', 'SLB', -3)
row('dim', 'TTS', 280)
row('dim', 'TBS', 743, 'Y2')
row('# ---- widths  (right mirrors left) ----')
row('dim', 'WL', 6200, '12,400 / 2')
row('dim', 'WTL', 3500, 'web outer face')
row('dim', 'WBL', 3500, '7,000 / 2')
row('dim', 'WCAL1', 1750)
row('dim', 'WCAL2', 950)
row('dim', 'TWEBL', 500)
row('# ---- cantilever ----')
row('dim', 'TCAL', 280, 'tip')
row('dim', 'TCAL1', 600, 'root')
row('dim', 'TCAL2', 280)
row('# ---- top slab haunch : 600 at the web -> 280 over 1,750 ----')
row('dim', 'TTHL1', 600)
row('dim', 'TTHL2', 280)
row('dim', 'WTHUL1', 1750)
row('dim', 'WTHUL2', 0)
row('# ---- bottom slab haunch : rise 250 above TBS (8-018 : 250 at the cell corner) ----')
row('dim', 'TBHL1', 993, '743 + 250')
row('dim', 'TBHL2', 743)
row('dim', 'WBHUL1', 1750)
row('dim', 'WBHUL2', 0)
row('dim', 'TBEL', 993)
row('# ---- fillets : square corners on the drawings ----')
row('dim', 'R_WTL', 0); row('dim', 'R_WTIL', 0); row('dim', 'R_WBL', 0)
row('')
row('# ================= DUCT =================================================')
row('# duct | id | shape | D | H | x | y | ref | clr        (문법은 bim_duct.js)')
row('#   shape  circ = D 가 외경 · rect = D 폭, H 높이')
row('#   x      단면 좌표 (중심선 기준, 오른쪽 +)')
row('#   y      ref 에서 잰 깊이.  ref = deck(상면에서 아래·기본) / soffit / abs')
row('#          상면이 -3% 로 기울어 있으므로 같은 y 라도 x 에 따라 절대높이가 다르다')
row('#   clr    철근과의 최소 순간격. 비우면 내측 피복(30)')
row('#')
row('# ! x 는 도면 치수체인에서 정확히 복원했다 :')
row('#     1215+150+150+200+150+150+300+300+670+4+290+286+280+150+150+200+150+150+1255')
row('#     = 6,200  (선단에서 중심선까지, 정확히 떨어진다)')
row('# ! y(깊이)와 외경은 **덕트 그림을 픽셀로 잰 값**이다 (±10 mm).')
row('#     도면에 적힌 세로 치수 160 · 300 과는 맞는다. 원문 치수로 확인이 필요하다.')
row('# ! id 는 잠정이다 — 도면의 3..21 / 4..20 / TS1 TS2 배정은 확인이 필요하다.')

rowA = [1555, 1905, 2055, 2335, 4185, 4335, 4485, 4835]   # 깊이 160, 상단 열
rowB = [2335, 4335]                                        # 깊이 310
web  = [(2865, 245), (3515, 360), (3715, 425)]             # 복부 쪽 세로 무리
tc   = [(2766, 'TC1'), (3585, 'TC2')]                      # 큰 덕트

n = 0
row('# --- 상단 열 : 상면에서 160 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, x in enumerate(rowA):
        n += 1; row('duct', 'A%s%d' % (sg, i + 1), 'circ', 120, '', s * x, 160, 'deck', 25)
row('# --- 하단 열 : 상면에서 310 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, x in enumerate(rowB):
        n += 1; row('duct', 'B%s%d' % (sg, i + 1), 'circ', 120, '', s * x, 310, 'deck', 25)
row('# --- 복부 쪽 무리 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for i, (x, d) in enumerate(web):
        n += 1; row('duct', 'W%s%d' % (sg, i + 1), 'circ', 120, '', s * x, d, 'deck', 25)
row('# --- TC1 TC2 : 큰 덕트 ---')
for s, sg in ((-1, 'L'), (1, 'R')):
    for x, nm in tc:
        n += 1; row('duct', '%s%s' % (nm, sg), 'circ', 440, '', s * x, 300, 'deck', 25)

row('')
row('# ================= REBAR ================================================')
row('# 8-243 SECTION A-A (= S14). 먼저 S15 에서 도는 것과 같은 꼴만 넣었다.')
row('# trebar | id | code | dia | init x,y,rot | set | segs | angs | nors | end:start | end:end | radius | z')
row('#   code 1 = 직선(A) · 11 = ㄱ자(A->B). angs 의 a 는 A 다음 꺾임각')
row('#   꺾임각 88.282 / 91.718 = 데크 -3% 에 대해 다리가 연직 (90 -+ 1.718)')
row('#   다리 190 = 선단두께 280 - 2 x 피복 45  (8-244 에서 확인한 유도값)')
row('trebar', '1-1', 11, 13, '', 'b:E1', 'a:190,b:4800', 'a:88.282', '', '', '', '', 0,
    'deck top, left  : 190 + 4,500 + 300 lap = 4,990  (8-243 (1)-1 N=110)')
row('trebar', '1', 11, 13, '', 'a:E2', 'a:7810,b:190', 'a:91.718', '', '', '', '', 0,
    'deck top, right : 300 lap + 7,510 + 190 = 8,000  (8-243 (1) N=110)')
row('trebar', '2', 11, 13, '', 'b:E4', 'a:190,b:1400', 'a:88.282', '', '', '', '', 0,
    'right cantilever soffit at the tip = 1,590  (8-243 (2) N=110)')
row('# trebar | 2-1 | 11 | 13 | | b:E13 | a:190,b:1400 | a:-91.718 | | | | | 0 | off: the left wall runs the other way. Needs growing against the wall direction')
row('#')
row('# --- 아직 안 넣은 것 (8-243 에 있다. 배치면을 정해야 한다) ---')
row('#   (3)  H13 L=5,055 N=110      (4)  H13 L=5,035 N=110      (5) H13 L=4,000 N=110')
row('#   (6)-1~(6)-4  H22  A.v.r L=8,257  N=110   본체 6,763~7,710  + 다리 510 x 2')
row('#       -> (6,763+7,710)/2 + 1,020 = 8,257 로 정확히 맞는다. **길이가 출력인 사례**')
row('#   (7)(7a) L=4,000  (8)(8a) L=3,090  (9)(9a) L=1,890/1,960  (10) H19 L=6,000')
row('#   (11)(11-1)(12) H13  ㄷ자 500 x 150,  X = 206~480 / 212~486 (범위!)')
row('#   T2 H13 L=700 N=520 · T3 · D1 H16 · D2 H13 · D3 H16 · S2 H13')
row('end')

wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'input'
for r in R: ws.append(r)
wb.save('PSCBOX_S14.xlsx')
print('PSCBOX_S14.xlsx  ·  ducts %d  ·  rows %d' % (n, len(R)))
