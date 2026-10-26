# AISC steel shape data (blog copy)

Used by the macroBIM Engineering blog posts on W shapes, channels, HSS and pipe.

| File | Shapes |
|---|---|
| W_shapes.csv | 289 W (wide flange) |
| C_shapes.csv · MC_shapes.csv | 32 C · 40 MC channels |
| HSS_shapes.csv · HSS_R_shapes.csv | 525 rectangular/square · 189 round HSS |
| PIPE_shapes.csv | 51 Std / XS / XXS pipe |

US customary units (in, in², in⁴, lb/ft).

## Provenance

- Taken from the Python package **steelpy 1.1.1** (`steelpy/shape files/`, Apache-2.0, see LICENSE-steelpy.txt).
- The values come from the **AISC Shapes Database**. This copy includes shapes added in v16.0 (e.g. W36×286–W36×387, W44×368, W44×408) that are not in v15.0.
- 2026-10-26 check: every shape that also exists in the official **AISC Shapes Database v15.0** workbook matches it exactly
  (W 283/283, C 32/32, MC 40/40, HSS 504, Pipe 51 — 0 values off by more than 0.6 %). Run `verify_v15.py` to repeat.

## Updating

Replace the CSVs with a newer source (ideally the official AISC workbook), rerun `verify_v15.py`, then rebuild the posts.
