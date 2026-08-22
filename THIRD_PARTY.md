# Third-party components

macroBIM's own code is proprietary — see `LICENSE`. The components listed here
are not, and their notices are reproduced below because that is the one thing
their licences require in return for letting proprietary work use them.

**Every component is MIT.** MIT permits use, modification and distribution in
closed commercial work; the sole condition is that the copyright notice and the
permission notice travel with any copy. That is what this file is for.

Nothing GPL, LGPL, AGPL or otherwise copyleft is used anywhere in this
repository. No component here imposes any obligation on macroBIM's own source.

## Loaded from a CDN — used, not redistributed

The browser fetches these directly from unpkg and cdnjs. macroBIM does not host
or ship copies of them, so no file of ours contains their code. They are listed
anyway: the dependency is real even when the bytes are someone else's to serve,
and if a build ever bundles them this list is where the obligation is already
written down.

| Component | Version | Licence | Home |
|---|---|---|---|
| three.js | 0.147.0 | MIT | https://github.com/mrdoob/three.js |
| three.js `OrbitControls` | 0.147.0 | MIT | (same repository, `examples/js/controls`) |
| polybooljs | 1.1.0 | MIT | https://github.com/velipso/polybooljs |
| ExcelJS | 4.3.0 | MIT | https://github.com/exceljs/exceljs |

## Embedded in our source — redistributed

| Component | What | Where | Licence |
|---|---|---|---|
| Bootstrap Icons | two SVG glyphs, `question-circle` and `download`, inlined as path data | `plate3d/plate_builder.js` (`ICON_HELP`, `ICON_DL`) | MIT |

The viewer runs inside its own document, where the icon font the macroBIM pages
load is absent, and a pair of paths costs less than a font file either way.

**This is the one that carries a real obligation**, because these bytes ship
inside a file we distribute. Its notice is reproduced in full below, and it must
survive minification — a build that strips comments has to keep the licence
banner. See `plate3d/tools/build_engine.js`.

## Notices

### three.js — Copyright © 2010-2026 three.js authors
### polybooljs — Copyright © 2016 Sean Connelly (@velipso)
### ExcelJS — Copyright © 2014 Guyon Roche
### Bootstrap Icons — Copyright © 2019-2026 The Bootstrap Authors

All four are distributed under the MIT licence, whose terms are identical in
each case:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Adding a component

Add the row **before** the code, not after. A dependency that ships without its
notice is the one licence breach that is trivial to commit and awkward to
explain, and it costs one table row to avoid.

If a component is anything other than MIT, BSD or Apache-2.0, stop and check
first — a copyleft licence on redistributed code would reach macroBIM's own
source, which is the one outcome this file exists to prevent.
