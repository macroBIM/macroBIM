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
row('# 8-243 SECTION A-A (= S14).')
row('# trebar | id | code | dia | init x,y,rot | set | segs | angs | nors | end:start | end:end | radius | z')
row('#')
row('# 입력에서 뺀 것 — 엔진이 스스로 찾는다 :')
row('#   set    어느 벽에 붙을지. init 의 자세(rot)만 주면 방향 게이트가 벽을 고른다.')
row('#          set 은 벽을 고르는 것에 그치지 않고 철근을 그 벽으로 회전·이동시켜')
row('#          곧바로 SETTLED 로 만든다 — 사실상 답을 미리 넣어 주는 칸이었다.')
row('#   angs   꺾임각 88.282 / 91.718 / 둔각 V 의 사이각. 전부 벽이 정하는 값이다.')
row('#          조각이 제 벽에 안착한 뒤 두 직선의 교점으로 코너를 잇는다 — 각은 결과다.')
row('#')
row('# 방향 규칙 (rot 은 반시계가 + · bench/shape_rot.js 로 찍은 표) :')
row('#   code 11  rot   0 → a 위   · b 오른쪽      rot  90 → a 왼쪽 · b 위')
row('#            rot 180 → a 아래 · b 왼쪽        rot -90 → a 오른쪽 · b 아래')
row('#            a→b 는 언제나 시계방향 90 도. 거울상은 회전이 아니라 a·b 순서로 만든다.')
row('#   code 15  둔각 V. rot 0 → a 왼쪽 · b 오른쪽, 꺾임점이 아래, 두 법선 모두 아래.')
row('#   code  1  직선. init 는 중점. rot 180 이면 법선이 아래를 본다.')
row('#')
row('# 아직 남은 것 :')
row('#   segs   조각 길이. 콘크리트까지 자라는 것이 아직 안 된다 — 도면 값을 넣는다.')
row('#          190   = 선단두께 280 - 2 x 피복 45  (유도값. 자동화 대상)')
row('#          4,800 / 7,810 = 겹이음 위치가 정하는 값 (설계 판단)')
row('# --- 상부슬래브 상면 ---')
row('trebar', '1-1', 11, 13, '-6100,100,-90', '', 'a:4800,b:190', '', '', '', '', '', 0,
    'deck top, left  : 4,800 몸통 + 190 다리 = 4,990  (8-243 (1)-1 N=110)')
row('trebar', '1', 11, 13, '5000,-150,180', '', 'a:190,b:7810', '', '', '', '', '', 0,
    'deck top, right : 190 다리 + 7,810 몸통 = 8,000  (8-243 (1) N=110)')
row('# --- 캔틸레버 하단 (선단) ---')
row('trebar', '2', 11, 13, '6100,-400,90', '', 'a:1400,b:190', '', '', '', '', '', 0,
    'right cantilever soffit at the tip = 1,590  (8-243 (2) N=110)')
row('trebar', '2-1', 11, 13, '-6100,-60,0', '', 'a:190,b:1400', '', '', '', '', '', 0,
    'left  cantilever soffit at the tip = 1,590  (8-243 (2)-1 N=110)')
row('# --- 상부슬래브 하단 + 캔틸레버 하단 (둔각 V. 꺾임점은 복부 위 낮은 자리) ---')
row('#   도면은 이 셋을 한 줄로 그린다 : (4) 왼쪽 V | (5) 가운데 직선 | (3) 오른쪽 V')
row('#   (3)(4) 의 2,540 다리는 헌치를 지나 평평한 구간까지 넘어간다 — 겹이음이다.')
row('trebar', '3', 15, 13, '3250,-650,0', '', 'a:2540,b:2515', '', '', '', '', '', 0,
    'right : 2,540 헌치쪽 + 2,515 캔틸레버쪽 = 5,055  (8-243 (3) N=110)')
row('trebar', '4', 15, 13, '-3250,-460,0', '', 'a:2540,b:2515', '', '', '', '', '', 0,
    'left  : 2,540 캔틸레버쪽 + 2,515 헌치쪽 = 5,055  (8-243 (4) N=110)')
row('trebar', '5', 1, 13, '0,-250,180', '', 'a:4000', '', '', '', '', '', 0,
    'top slab soffit across the centreline = 4,000  (8-243 (5) N=110)')
row('# --- 복부철근 (ㄷ자. 몸통은 세로, 다리 둘은 콘크리트 안쪽으로) ---')
row('#   8-243 : (6)-1~(6)-4  H22  A.v.r L=8,257  N=110  본체 6,763~7,710 + 다리 510 x 2')
row('#   S14 에서는 본체가 TH 6,853 - 2 x 45 = 6,763 이다 — 범위의 아래끝과 정확히 같다.')
row('#   **길이를 입력하지 않는다.** 조각 길이는 기본값에 둔다 — 벽이 정하게 한다.')
row('#   ⑥-1 ⑥-4 는 코드 21(ㄷ) · ⑥-2 ⑥-3 은 코드 23(Z 크랭크) — 도면 상세가 그렇다.')
row('#   rot 은 다리가 콘크리트 안쪽을 보게 고른 것이다 (21 : 90 다리 왼쪽 · -90 오른쪽)')
row('trebar', '6-1', 21, 22, '3450,-3530,90', '', '', '', '', '', '', '', 0,
    'right web, outer face  (8-243 (6)-1 N=110)')
row('trebar', '6-4', 21, 22, '-3450,-3330,-90', '', '', '', '', '', '', '', 0,
    'left  web, outer face  (8-243 (6)-4 N=110)')
row('trebar', '6-2', 23, 22, '3450,-3530,-90', '', '', '', '', '', '', '', 0,
    'right web, inner face  (8-243 (6)-2 N=110)')
row('trebar', '6-3', '23-1', 22, '-3050,-3340,90', '', '', '', '', '', '', '', 0,
    'left  web, inner face  (8-243 (6)-3 N=110)')
row('#')
row('# --- 하부슬래브 (8-243 의 형상상세에서 읽었다) ---')
row('#   상면 : (8)-1 왼쪽 헌치 · (7) 가운데 · (8) 오른쪽 헌치   — 셋이 겹이음으로 이어진다')
row('#   하면 : (9)-1 왼쪽 · (9) 오른쪽                        — 겹이음 380 (H19 는 450)')
row('#   H16 을 넣는다. 도면의 (7a)(8a)(9a) 는 같은 자리의 H19 로 번갈아 배근된다.')
row('#   다리 380 · 300 과 몸통 길이는 겹이음이 정하는 값이라 도면 값을 그대로 넣는다.')
row('#   rot 은 bench/shape_rot.js 의 표대로 골랐다 (코드 11 : rot 0 → a 코너 위 · b 오른쪽).')
row('#   **안 적은 nors 는 기본값이다** — 뒤집어야 하는 것만 적는다.')
row('#   다리(a)는 기본값 그대로 복부 **외측**면을 본다. 뒤집을 것은 몸통 하나뿐이다 :')
row('#     ⑧-1 은 rot 0 이라 몸통이 b → nors b=-1 · ⑧ 은 rot 90 이라 몸통이 a → nors a=-1')
row('#   (한때 양쪽을 다 뒤집어 a=-1,b=-1 로 적었더니 다리가 복부 **내측**면으로 붙었다.)')
row('#   init 는 코드 11 의 기준점 = 코너다. 코너에서 콘크리트 안쪽으로 조금 넣어 둔다.')
row('#   ⑧-1 ⑧ ⑨-1 ⑨ 의 다리는 모두 복부 **외측**면 (E11 · E6 · E10 · E7).')
row('trebar', '7', 1, 16, '0,-6180,0', '', 'a:4000', '', '', '', '', '', 0,
    'bottom slab top, centre = 4,000  (8-243 (7) H16 N=55)')
row('trebar', '8-1', 11, 16, '-3450,-5750,0', '', 'a:380,b:2615', '', 'b=-1', '', '', '', 0,
    'bottom slab top, left  : 380 leg up the web outer face + 2,615  (8-243 (8)-1 H16 L=3,105 N=55)')
row('trebar', '8', 11, 16, '3450,-5900,90', '', 'a:2600,b:380', '', 'a=-1', '', '', '', 0,
    'bottom slab top, right : 2,600 + 380 leg up the web outer face  (8-243 (8) H16 L=3,090 N=55)')
row('trebar', '9-1', 11, 16, '-3450,-6700,0', '', 'a:300,b:1590', '', '', '', '', '', 0,
    'bottom slab soffit, left  : 300 leg + 1,590  (8-243 (9)-1 H16 L=1,890 N=55)')
row('trebar', '9', 11, 16, '3450,-6900,90', '', 'a:5320,b:300', '', '', '', '', '', 0,
    'bottom slab soffit, right : 5,320 + 300 leg  (8-243 (9) H16 L=6,000 N=55)')
row('#')
row('# --- 아직 안 넣은 것 (8-243 에 있다. 배치면을 정해야 한다) ---')
row('#   (10) H19 L=6,000')
row('#   (11)(11-1)(12) H13  ㄷ자 500 x 150,  X = 206~480 / 212~486 (범위!)')
row('#   T2 H13 L=700 N=520 · T3 · D1 H16 · D2 H13 · D3 H16 · S2 H13')
row('end')

wb = openpyxl.Workbook(); ws = wb.active; ws.title = 'input'
for r in R: ws.append(r)
wb.save('PSCBOX_S14.xlsx')
print('PSCBOX_S14.xlsx  ·  ducts %d  ·  rows %d' % (n, len(R)))
