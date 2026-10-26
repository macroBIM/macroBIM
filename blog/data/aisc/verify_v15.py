"""Cross-check blog/data/aisc/*.csv against the official AISC Shapes Database v15.0 Excel.

The official v15.0 workbook ships inside the npm package `aisc` (npm pack aisc).
Usage: python3 verify_v15.py path/to/aisc-shapes-database-v15.0.xlsx
Prints, per family, how many shapes were compared and any value that differs by more than 0.6 %.
"""
import csv, os, sys
import openpyxl

HERE = os.path.dirname(os.path.abspath(__file__))
xlsx = sys.argv[1]
wb = openpyxl.load_workbook(xlsx, read_only=True)
rows = list(wb['Database v15.0'].iter_rows(values_only=True))
h = rows[0]
iT, iL = h.index('Type'), h.index('AISC_Manual_Label')

def key(s):
    return str(s).upper().replace('.', '_').replace('-', '_').replace('/', '_')

ref = {}
for r in rows[1:]:
    if r[iT]:
        ref.setdefault(r[iT], {})[key(r[iL])] = r

COLS = {'weight': 'W', 'area': 'A', 'd': 'd', 'bf': 'bf', 'tw': 'tw', 'tf': 'tf', 'Ix': 'Ix', 'Sx': 'Sx',
        'Zx': 'Zx', 'Iy': 'Iy', 'Sy': 'Sy', 'Zy': 'Zy', 'rx': 'rx', 'ry': 'ry', 'J': 'J', 'Cw': 'Cw',
        'Ht': 'Ht', 'B': 'B', 'tdes': 'tdes', 'tnom': 'tnom', 'OD': 'OD', 'ID': 'ID'}
for fam, files in [('W', ['W']), ('C', ['C']), ('MC', ['MC']), ('HSS', ['HSS', 'HSS_R']), ('PIPE', ['PIPE'])]:
    n = bad = 0
    for f in files:
        for row in csv.DictReader(open(os.path.join(HERE, f + '_shapes.csv'))):
            r = ref[fam].get(key(row['shape']))
            if r is None:
                continue
            n += 1
            for c, hc in COLS.items():
                if c in row and hc in h:
                    try:
                        a, b = float(row[c]), float(r[h.index(hc)])
                    except (TypeError, ValueError):
                        continue
                    if abs(a - b) > max(1e-6, 0.006 * abs(b)):
                        bad += 1
                        print('  MISMATCH', fam, row['shape'], c, a, b)
    print(f'{fam}: compared {n} shapes, {bad} mismatches')
