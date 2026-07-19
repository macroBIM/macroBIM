/*
    layout_body_test.js — <body> 내부 HTML 레이아웃 (테스트: Circle/Octagon/Track 추가)
    GitHub에서 관리, PHP에서 로드하여 innerHTML로 주입
*/
function initLayout(phpData) {
    var visits = phpData && phpData.visits ? Number(phpData.visits).toLocaleString() : '0';
    var totalVisits = phpData && phpData.totalVisits ? Number(phpData.totalVisits).toLocaleString() : '0';

    var html = ''
    /* ══ SIDEBAR ══ */
    + '<nav id="sidebar">'
    + '  <div class="sidebar-header"><div class="logo-info"><div class="name">macroBIM</div></div></div>'
    + '  <div class="nav-menu">'
    + '    <a class="nav-item active" href="#" id="dashboardMenu" data-page="dashboard"><i class="bi bi-grid-fill"></i> Dashboard</a>'
    + '    <a class="nav-item" href="#" id="tablesToggle"><i class="bi bi-table"></i> Tables <span class="arrow">&#8250;</span></a>'
    + '    <div class="nav-sub" id="tables-sub">'
    + '      <a href="#" data-page="rebar">Rebar Tables</a>'
    + '      <a href="#" data-page="steel">Steel Section Tables</a>'
    + '      <a href="#" data-page="bendradius">Rebar Bend Radius</a>'
    + '    </div>'
    + '    <a class="nav-item" href="#" id="codeToggle"><i class="bi bi-calculator"></i> Code <span class="arrow">&#8250;</span></a>'
    + '    <div class="nav-sub" id="code-sub">'
    + '      <a href="#" data-page="rebarleng">Rebar Anchorage / Splice</a>'
    + '    </div>'
    + '    <a class="nav-item" href="#" id="drawingsToggle"><i class="bi bi-card-image"></i> Drawings <span class="arrow">&#8250;</span></a>'
    + '    <div class="nav-sub" id="drawings-sub">'
    + '      <a href="#" data-page="draw-hsection">H Section</a>'
    + '      <a href="#" data-page="draw-channel">Channel</a>'
    + '      <a href="#" data-page="draw-splice">Splice</a>'
    + '      <a href="#" data-page="draw-liftinglug">Lifting Lug</a>'
    + '      <a href="#" data-page="draw-ibeam">I Beam</a>'
    + '      <a href="#" data-page="draw-box1cell">BOX1CELL</a>'
    + '      <a href="#" data-page="draw-rect">Rect</a>'
    + '      <a href="#" data-page="draw-circle">Circle</a>'
    + '      <a href="#" data-page="draw-octagon">Octagon</a>'
    + '      <a href="#" data-page="draw-track">Track</a>'
    + '    </div>'
    + '    <a class="nav-item" href="#" id="retainingToggle"><i class="bi bi-bricks"></i> Retaining Wall <span class="arrow">&#8250;</span></a>'
    + '    <div class="nav-sub" id="retaining-sub">'
    + '      <a href="#" data-page="draw-gravitywall">Gravity Wall</a>'
    + '      <a href="#" data-page="draw-invtwall">Inverted-T Wall</a>'
    + '      <a href="#" data-page="draw-lwall">L-shaped Wall</a>'
    + '    </div>'
    + '    <a class="nav-item" href="#" data-page="draw-pier"><i class="bi bi-building"></i> Pier</a>'
    + '  </div>'
    + '</nav>'

    /* ══ MAIN ══ */
    + '<div id="main">'
    + '  <div class="content-wrap">'

    /* ── DASHBOARD ── */
    + '    <div class="page-view active" id="page-dashboard">'
    + '      <h1 class="page-heading">Dashboard</h1>'
    + '      <div class="breadcrumb"><a href="#">Home</a> / <span>Dashboard</span></div>'
    + '      <div class="stat-grid">'
    + '        <div class="stat-card">'
    + '          <div>'
    + '            <div class="stat-value">' + visits + '</div>'
    + '            <div class="stat-label">Today Visits</div>'
    + '          </div>'
    + '          <div class="stat-icon blue"><i class="bi bi-person-check"></i></div>'
    + '        </div>'
    + '        <div class="stat-card">'
    + '          <div>'
    + '            <div class="stat-value">' + totalVisits + '</div>'
    + '            <div class="stat-label">Total Visits</div>'
    + '          </div>'
    + '          <div class="stat-icon green"><i class="bi bi-people"></i></div>'
    + '        </div>'
    + '      </div>'
    + '    </div>'

    /* ── REBAR TABLES ── */
    + '    <div class="page-view" id="page-rebar">'
    + '      <h1 class="page-heading">Rebar Specification Tables</h1>'
    + '      <div class="breadcrumb"><a href="#">Home</a> / <a href="#">Tables</a> / <span>Rebar Tables</span></div>'
    + '      <div class="table-card"><div class="table-card-header"><div class="table-card-title">1. KS D 3504 (Korean Standard)</div><div class="table-card-desc">Deformed bars for concrete reinforcement</div></div><table class="ea-table striped rebar"><thead id="rebar-ks-head"></thead><tbody id="rebar-ks-body"><tr><td colspan="7" class="loading-row"><span class="spinner"></span> Loading...</td></tr></tbody></table></div>'
    + '      <div class="table-card"><div class="table-card-header"><div class="table-card-title">2. ASTM A615M (US Standard)</div><div class="table-card-desc">Standard specification for deformed bars</div></div><table class="ea-table striped rebar"><thead id="rebar-astm-head"></thead><tbody id="rebar-astm-body"><tr><td colspan="7" class="loading-row"><span class="spinner"></span> Loading...</td></tr></tbody></table></div>'
    + '      <div class="table-card"><div class="table-card-header"><div class="table-card-title">3. BS 4449 (British Standard)</div><div class="table-card-desc">Steel for the reinforcement of concrete</div></div><table class="ea-table striped rebar"><thead id="rebar-bs-head"></thead><tbody id="rebar-bs-body"><tr><td colspan="7" class="loading-row"><span class="spinner"></span> Loading...</td></tr></tbody></table></div>'
    + '    </div>'

    /* ── STEEL SECTION TABLES ── */
    + '    <div class="page-view" id="page-steel">'
    + '      <h1 class="page-heading">Section Properties</h1>'
    + '      <div class="breadcrumb"><a href="#">Home</a> / <a href="#">Tables</a> / <span>Steel Section</span></div>'
    + '      <div class="section-selector-row">'
    + '        <div class="section-card selected" data-section="hsection" onclick="selectSection(\'hsection\')">'
    + '          <div class="section-card-img"><img src="https://macrobim.github.io/design/Hsection.jpg" alt="H-Section"></div>'
    + '          <div class="section-card-name">H-Section</div>'
    + '        </div>'
    + '        <div class="section-card" data-section="channel" onclick="selectSection(\'channel\')">'
    + '          <div class="section-card-img"><img src="https://macrobim.github.io/design/channel.png" alt="Channel"></div>'
    + '          <div class="section-card-name">Channel</div>'
    + '        </div>'
    + '        <div class="section-card" data-section="equalangle" onclick="selectSection(\'equalangle\')">'
    + '          <div class="section-card-img"><img src="https://macrobim.github.io/design/angle.png" alt="Equal Angle"></div>'
    + '          <div class="section-card-name">Equal Angle</div>'
    + '        </div>'
    + '        <div class="section-card" data-section="unequalangle" onclick="selectSection(\'unequalangle\')">'
    + '          <div class="section-card-img"><img src="https://macrobim.github.io/design/angle.png" alt="Unequal Angle"></div>'
    + '          <div class="section-card-name">Unequal Angle</div>'
    + '        </div>'
    + '        <div class="section-card" data-section="invertedangle" onclick="selectSection(\'invertedangle\')">'
    + '          <div class="section-card-img"><img src="https://macrobim.github.io/design/invertedangle.png" alt="Inverted Angle"></div>'
    + '          <div class="section-card-name">Inverted Angle</div>'
    + '        </div>'
    + '      </div>'
    + '      <div class="steel-table-wrap">'
    + '        <table class="steel-table">'
    + '          <thead id="steel-thead"></thead>'
    + '          <tbody id="steel-tbody"><tr><td colspan="20" class="loading-row"><span class="spinner"></span> Loading section data...</td></tr></tbody>'
    + '        </table>'
    + '      </div>'
    + '    </div>'

    /* ── TABLES : REBAR BEND RADIUS ── */
    + '    <div class="page-view" id="page-bendradius">'
    + '      <h1 class="page-heading">Rebar Bend Radius</h1>'
    + '      <div class="breadcrumb"><a href="#">Home</a> / <a href="#">Tables</a> / <span>Bend Radius</span></div>'
    + '      <div class="table-card">'
    + '        <div class="table-card-header"><div class="table-card-title">Main Bars (Standard Hooks)</div><div class="table-card-desc">Min. inside bend <b>diameter</b> ( parenthesis = radius )</div></div>'
    + '        <div style="overflow-x:auto;"><table class="ea-table striped rebar">'
    + '          <thead>'
    + '            <tr><th rowspan="2">Bar Size</th><th colspan="2">ACI-based</th><th colspan="2">Eurocode-based (LSD)</th></tr>'
    + '            <tr><th>KDS 14 20 50<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Concrete Structures (KR)</span></th><th>AASHTO LRFD<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Highway Bridge (US)</span></th><th>KDS 24 14 21<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Highway Bridge (KR)</span></th><th>EN 1992-1-1<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Eurocode 2 (EU)</span></th></tr>'
    + '          </thead>'
    + '          <tbody>'
    + '            <tr><td>D16 &amp; smaller<br><span style="color:#94a3b8;font-size:11px;">#5 / &le;16mm</span></td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td></tr>'
    + '            <tr><td>D19 ~ D25<br><span style="color:#94a3b8;font-size:11px;">#6~8 / 20~25mm</span></td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td></tr>'
    + '            <tr><td>D29 ~ D35<br><span style="color:#94a3b8;font-size:11px;">#9~11 / 28~32mm</span></td><td>8d<sub>b</sub> (4d<sub>b</sub>)</td><td>8d<sub>b</sub> (4d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td></tr>'
    + '            <tr><td>D38 &amp; larger<br><span style="color:#94a3b8;font-size:11px;">#14~ / 40mm~</span></td><td>10d<sub>b</sub> (5d<sub>b</sub>)</td><td>10d<sub>b</sub> (5d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td></tr>'
    + '          </tbody>'
    + '        </table></div>'
    + '      </div>'
    + '      <div class="table-card">'
    + '        <div class="table-card-header"><div class="table-card-title">Shear Reinforcement (Stirrups / Ties)</div><div class="table-card-desc">Min. inside bend <b>diameter</b> ( parenthesis = radius )</div></div>'
    + '        <div style="overflow-x:auto;"><table class="ea-table striped rebar">'
    + '          <thead>'
    + '            <tr><th rowspan="2">Bar Size</th><th colspan="2">ACI-based</th><th colspan="2">Eurocode-based (LSD)</th></tr>'
    + '            <tr><th>KDS 14 20 50<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Concrete Structures (KR)</span></th><th>AASHTO LRFD<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Highway Bridge (US)</span></th><th>KDS 24 14 21<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Highway Bridge (KR)</span></th><th>EN 1992-1-1<br><span style="color:#94a3b8;font-size:11px;font-weight:400;">Eurocode 2 (EU)</span></th></tr>'
    + '          </thead>'
    + '          <tbody>'
    + '            <tr><td>D16 &amp; smaller<br><span style="color:#94a3b8;font-size:11px;">#5 / &le;16mm</span></td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td><td>4d<sub>b</sub> (2d<sub>b</sub>)</td></tr>'
    + '            <tr><td>D19 ~ D25<br><span style="color:#94a3b8;font-size:11px;">#6~8 / 20~25mm</span></td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>6d<sub>b</sub> (3d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td><td>7d<sub>b</sub> (3.5d<sub>b</sub>)</td></tr>'
    + '          </tbody>'
    + '        </table></div>'
    + '      </div>'
    + '      <div style="font-size:12px;color:#64748b;line-height:1.7;padding:2px 4px;">'
    + '        &bull; Values are the minimum inside bend <b>diameter</b>; the value in parenthesis is the <b>radius</b> (diameter / 2).<br>'
    + '        &bull; ACI-based codes (KDS 14 20 50 &middot; AASHTO) vary by bar size; Eurocode-based codes (KDS 24 14 21 &middot; EN 1992-1-1) use &le;16 / &gt;16 mm diameter.<br>'
    + '        &bull; US (#) and EU (mm) designations are approximate references only.<br>'
    + '        &bull; Eurocode / bridge values are mandrel diameters to avoid bar damage (EN 1992 Table 8.1N); larger mandrels may be required when checking concrete bearing inside the bend.'
    + '      </div>'
    + '    </div>'

    /* ── CODE : REBAR ANCHORAGE / SPLICE ── */
    + '    <div class="page-view" id="page-rebarleng">'
    + '      <style>'
    + '        #mount-rebarleng .rl-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px 16px;padding:9px 0;border-bottom:1px solid #f1f5f9;}'
    + '        #mount-rebarleng .rl-row:last-child{border-bottom:none;}'
    + '        #mount-rebarleng .rl-lbl{font-size:12px;font-weight:600;color:#0f172a;min-width:190px;}'
    + '        #mount-rebarleng .rl-opts{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;}'
    + '        #mount-rebarleng .rl-opts label{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:500;color:#334155;cursor:pointer;margin:0;}'
    + '        #mount-rebarleng .rl-opts input[type=radio]{accent-color:#2563eb;width:15px;height:15px;cursor:pointer;margin:0;}'
    + '        #mount-rebarleng .rl-opts input[type=number],#mount-rebarleng .rl-opts input:not([type]){width:80px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:6px;font-size:12.5px;}'
    + '        #mount-rebarleng .rl-sec-title{font-size:12px;font-weight:700;color:#2563eb;margin:16px 0 6px;}'
    + '        #mount-rebarleng .rl-hint{color:#94a3b8;font-size:12px;}'
    + '        #mount-rebarleng .rl-readonly{display:flex;align-items:center;gap:8px;}'
    + '        #mount-rebarleng .fctk-val{font-weight:700;color:#2563eb;font-size:13.5px;}'
    + '      </style>'
    + '      <h1 class="page-heading">Rebar Anchorage / Splice Length</h1>'
    + '      <div class="breadcrumb"><a href="#">Home</a> / <a href="#">Code</a> / <span>Anchorage / Splice</span></div>'
    + '      <div id="mount-rebarleng"></div>'
    + '    </div>'

    /* ── DRAWING PAGES ── */
    + '    <div class="page-view" id="page-draw-hsection"><h1 class="page-heading">H Section Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>H Section</span></div><div id="mount-draw-hsection"></div></div>'
    + '    <div class="page-view" id="page-draw-channel"><h1 class="page-heading">Channel Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Channel</span></div><div id="mount-draw-channel"></div></div>'
    + '    <div class="page-view" id="page-draw-ibeam"><h1 class="page-heading">I Beam Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>I Beam</span></div><div id="mount-draw-ibeam"></div></div>'
    + '    <div class="page-view" id="page-draw-splice"><h1 class="page-heading">Bolt Splice Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Splice</span></div><div id="mount-draw-splice"></div></div>'
    + '    <div class="page-view" id="page-draw-liftinglug"><h1 class="page-heading">Lifting Lug Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Lifting Lug</span></div><div id="mount-draw-liftinglug"></div></div>'
    + '    <div class="page-view" id="page-draw-rect"><h1 class="page-heading">Rect Section Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Rect</span></div><div id="mount-draw-rect"></div></div>'
    + '    <div class="page-view" id="page-draw-box1cell"><h1 class="page-heading">BOX 1-Cell Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>BOX1CELL</span></div><div id="mount-draw-box1cell"></div></div>'
    + '    <div class="page-view" id="page-draw-circle"><h1 class="page-heading">Circle Section Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Circle</span></div><div id="mount-draw-circle"></div></div>'
    + '    <div class="page-view" id="page-draw-octagon"><h1 class="page-heading">Octagon Section Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Octagon</span></div><div id="mount-draw-octagon"></div></div>'
    + '    <div class="page-view" id="page-draw-track"><h1 class="page-heading">Track Section Drawing</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Drawings</a> / <span>Track</span></div><div id="mount-draw-track"></div></div>'
    + '    <div class="page-view" id="page-draw-gravitywall"><h1 class="page-heading">Gravity Wall Layout</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Retaining Wall</a> / <span>Gravity Wall</span></div><div id="mount-draw-gravitywall"></div></div>'
    + '    <div class="page-view" id="page-draw-invtwall"><h1 class="page-heading">Inverted-T Wall Layout</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Retaining Wall</a> / <span>Inverted-T Wall</span></div><div id="mount-draw-invtwall"></div></div>'
    + '    <div class="page-view" id="page-draw-lwall"><h1 class="page-heading">L-shaped Wall Layout</h1><div class="breadcrumb"><a href="#">Home</a> / <a href="#">Retaining Wall</a> / <span>L-shaped Wall</span></div><div id="mount-draw-lwall"></div></div>'
    + '    <div class="page-view" id="page-draw-pier"><h1 class="page-heading">Pier Input</h1><div class="breadcrumb"><a href="#">Home</a> / <span>Pier</span></div><div id="mount-draw-pier"></div></div>'

    + '  </div>'
    + '</div>';

    var root = document.getElementById('app-root');
    root.style.cssText = 'display:flex;flex:1;height:100%;min-height:0;gap:16px;overflow:hidden;';
    root.innerHTML = html;

    _createTemplates();
    _bindNavigation();
}

/* ══ TEMPLATES ══ */
function _createTemplates() {
    var root = document.getElementById('app-root');

    /* ── HSECTION ── */
    _addTemplate(root, 'tpl-draw-hsection',
        '<style>'
      + '.hs-root{--dim:#2563eb;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--ink:#182430;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;}'
      + '.hs-root *{box-sizing:border-box}'
      + '.hs-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}'
      + '@media(max-width:900px){.hs-grid{grid-template-columns:1fr}}'
      + '.hs-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
      + '.hs-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}'
      + '.hs-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}'
      + '.hs-inputs{padding:14px}'
      + '.hs-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}'
      + '.hs-inrow:last-child{border-bottom:0}'
      + '.hs-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px;margin:0}'
      + '.hs-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}'
      + '.hs-inrow .desc{color:var(--muted);font-size:12px}'
      + '.hs-inrow input{width:120px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px}'
      + '.hs-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}'
      + '.hs-unit{color:var(--muted);font-size:11px;margin-left:6px}'
      + '.hs-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer}'
      + '.hs-btn:hover{filter:brightness(1.1)}'
      + '.hs-vbtn{padding:5px 10px;border:1px solid #cbd5e1;background:#eef2f6;color:#475569;cursor:pointer;border-radius:6px;font-size:11px;font-weight:700}'
      + '.hs-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}'
      + '.hs-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}'
      + '.hs-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}'
      + '.hs-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}'
      + '.hs-plot #hsecplot{width:100%}'
      + '</style>'
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
      + '      <span id="hsec-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">'
      + '        <button type="button" class="hs-vbtn" data-hview="front" onclick="hsec_setview(\'front\')" style="background:#2563eb;color:#fff;border-color:#2563eb;">Front</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="back" onclick="hsec_setview(\'back\')">Back</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="left" onclick="hsec_setview(\'left\')">Left</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="center" onclick="hsec_setview(\'center\')">Center</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="right" onclick="hsec_setview(\'right\')">Right</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="top" onclick="hsec_setview(\'top\')">Top</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="bottom" onclick="hsec_setview(\'bottom\')">Bottom</button>'
      + '        <button type="button" class="hs-vbtn" data-hview="3d" onclick="hsec_setview(\'3d\')">3D</button>'
      + '        <button type="button" class="hs-btn" onclick="fdraw_hsection()"><i class="bi bi-arrow-repeat"></i> Regen</button>'
      + '      </span></div>'
      + '    <div class="hs-plot"><div id="hsecplot"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; live redraw on edit</span>'
      + '      <button type="button" class="hs-btn" onclick="odxf_hsec.download(\'Hsection.dxf\')">DXF out</button></div>'
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">line1: H,Bt,Bb,tw,tft,tfb,R &nbsp;/&nbsp; line2: L</span></div>'
      + '        <textarea class="hs-batch" id="sUserText" rows="2" spellcheck="false" onchange="putParams_hsection(\'sUserText\'); fdraw_hsection();">300,300,300,10,15,15,19\n500</textarea></div>'
      + '      <div class="hs-inrow"><label><span class="var">H</span><span class="desc">Section height</span></label><span><input type="number" id="dsech" value="300" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Bt</span><span class="desc">Top flange width</span></label><span><input type="number" id="dbt" value="300" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Bb</span><span class="desc">Bottom flange width</span></label><span><input type="number" id="dbb" value="300" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tw</span><span class="desc">Web thickness</span></label><span><input type="number" id="dtw" value="10" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tft</span><span class="desc">Top flange thickness</span></label><span><input type="number" id="dttf" value="15" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tbf</span><span class="desc">Bottom flange thickness</span></label><span><input type="number" id="dtbf" value="15" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">R</span><span class="desc">Fillet radius (0 = none)</span></label><span><input type="number" id="dradius" value="19" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">L</span><span class="desc">Beam length</span></label><span><input type="number" id="dseg_leng" value="500" onchange="fdraw_hsection()"><span class="hs-unit">mm</span></span></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>'
    );

    /* ── CHANNEL ── */
    _addTemplate(root, 'tpl-draw-channel',
        '<style>'
      + '.hs-root{--dim:#2563eb;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--ink:#182430;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;}'
      + '.hs-root *{box-sizing:border-box}'
      + '.hs-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}'
      + '@media(max-width:900px){.hs-grid{grid-template-columns:1fr}}'
      + '.hs-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
      + '.hs-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}'
      + '.hs-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}'
      + '.hs-inputs{padding:14px}'
      + '.hs-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}'
      + '.hs-inrow:last-child{border-bottom:0}'
      + '.hs-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px;margin:0}'
      + '.hs-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}'
      + '.hs-inrow .desc{color:var(--muted);font-size:12px}'
      + '.hs-inrow input{width:120px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px}'
      + '.hs-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}'
      + '.hs-unit{color:var(--muted);font-size:11px;margin-left:6px}'
      + '.hs-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer}'
      + '.hs-btn:hover{filter:brightness(1.1)}'
      + '.hs-vbtn{padding:5px 10px;border:1px solid #cbd5e1;background:#eef2f6;color:#475569;cursor:pointer;border-radius:6px;font-size:11px;font-weight:700}'
      + '.hs-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}'
      + '.hs-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}'
      + '.hs-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}'
      + '.hs-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}'
      + '.hs-plot #channelplot{width:100%}'
      + '</style>'
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
      + '      <span id="chan-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">'
      + '        <button type="button" class="hs-vbtn" data-cview="front" onclick="chan_setview(\'front\')" style="background:#2563eb;color:#fff;border-color:#2563eb;">Front</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="back" onclick="chan_setview(\'back\')">Back</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="left" onclick="chan_setview(\'left\')">Left</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="center" onclick="chan_setview(\'center\')">Center</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="right" onclick="chan_setview(\'right\')">Right</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="top" onclick="chan_setview(\'top\')">Top</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="bottom" onclick="chan_setview(\'bottom\')">Bottom</button>'
      + '        <button type="button" class="hs-vbtn" data-cview="3d" onclick="chan_setview(\'3d\')">3D</button>'
      + '        <button type="button" class="hs-btn" onclick="fdraw_channel()"><i class="bi bi-arrow-repeat"></i> Regen</button>'
      + '      </span></div>'
      + '    <div class="hs-plot"><div id="channelplot"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; live redraw on edit</span>'
      + '      <button type="button" class="hs-btn" onclick="odxf_channel.download(\'Channel.dxf\')">DXF out</button></div>'
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">line1: H,B,tw,tf,Rw,Rf &nbsp;/&nbsp; line2: L</span></div>'
      + '        <textarea class="hs-batch" id="sUserText" rows="2" spellcheck="false" onchange="putParams_channel(\'sUserText\'); fdraw_channel();">300,90,12,16,19,9.5\n500</textarea></div>'
      + '      <div class="hs-inrow"><label><span class="var">H</span><span class="desc">Section height</span></label><span><input type="number" id="dsech" value="300" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">B</span><span class="desc">Flange width</span></label><span><input type="number" id="db" value="90" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tw</span><span class="desc">Web thickness</span></label><span><input type="number" id="dtw" value="12" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tf</span><span class="desc">Flange thickness</span></label><span><input type="number" id="dtf" value="16" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Rw</span><span class="desc">Inner fillet radius (0 = none)</span></label><span><input type="number" id="drw" value="19" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Rf</span><span class="desc">Flange-tip fillet radius (0 = none)</span></label><span><input type="number" id="drf" value="9.5" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">L</span><span class="desc">Channel length</span></label><span><input type="number" id="dseg_leng" value="500" onchange="fdraw_channel()"><span class="hs-unit">mm</span></span></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>'
    );

    /* ── IBEAM ── */
    _addTemplate(root, 'tpl-draw-ibeam', _beTpl({
      name: 'ibeam', plot: 'ibeamplot', bar: 'ibeam-viewbar', dxf: 'IBeam.dxf', guide: 'https://macrobim.github.io/macroBIM/ibeam_vars.png',
      hint: 'line1: Begin (13) / line2: End (13) / line3: L', brows: 4,
      bdef: '1500,1235,985,85,45,135,140,160,50,200,100,50,20\n1500,1235,985,85,45,135,140,160,50,200,100,50,20\n500', len: 500,
      rows: [['h', 'Section height', 'dh', 1500, 1500], ['bt', 'Top flange width', 'dbt', 1235, 1235], ['bb', 'Bottom flange width', 'dbb', 985, 985],
        ['ttf', 'Top flange thick', 'dttf', 85, 85], ['ttf1', 'Top flange taper', 'dttf1', 45, 45], ['tbf', 'Bottom flange thick', 'dtbf', 135, 135], ['tbf1', 'Bottom flange taper', 'dtbf1', 140, 140],
        ['tw', 'Web thickness', 'dtw', 160, 160], ['rtf', 'Top fillet R', 'drtf', 50, 50], ['rwt', 'Upper web fillet R', 'drwt', 200, 200], ['rwb', 'Lower web fillet R', 'drwb', 100, 100],
        ['rbf', 'Bottom fillet R', 'drbf', 50, 50], ['chb', 'Chamfer', 'dchb', 20, 20]]
    }));

    /* ── SPLICE (hybrid: retaining-wall shell + Konva assembly drawing) ── */
    _addTemplate(root, 'tpl-draw-splice', _HSCSS()
      + '<style>'
      + '.hs-plot #spliceplot{width:100%;height:780px;border-radius:8px;overflow:hidden}'
      + '.hs-sub{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:12px 0 4px;padding-top:8px;border-top:1px dashed var(--hair)}'
      + '.hs-sub:first-child{border-top:0;padding-top:0}'
      + '.hs-sub .n{color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0}'
      + '.hs-inrow.txt input{width:150px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px}'
      + '</style>'
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout &mdash; Elevation / Plan / Section</span>'
      + '      <span style="display:flex;gap:6px;align-items:center;">'
      + '        <button type="button" class="hs-btn" onclick="odxf_boltsplice.download(\'BoltSplice.dxf\')">DXF out</button>'
      + '        <button type="button" class="hs-btn" onclick="fdraw_boltsplice()"><i class="bi bi-arrow-repeat"></i> Regen</button>'
      + '      </span></div>'
      + '    <div class="hs-plot" style="padding:10px"><div id="spliceplot" class="sp-canvas"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; live redraw on edit</span></div>'
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">line1: H-beam / line2: plates / line3: bolts</span></div>'
      + '        <textarea class="hs-batch" id="sUserText" rows="3" spellcheck="false" onchange="putParams_boltsplice(\'sUserText\'); fdraw_boltsplice();">300,300,300,10,15,15,18\n280,300,10,110,300,5,220,280,10,110,300,5,280,300,10\n5,12,8,30,10,80,10,5,12,10,60,10,0,10,5,12,8,30,10,80,10</textarea></div>'
      + '      <div class="hs-sub">1) H Beam</div>'
      + '      <div class="hs-inrow"><label><span class="var">H</span><span class="desc">Section height</span></label><span><input type="number" id="dsech" value="300" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Bt</span><span class="desc">Top flange width</span></label><span><input type="number" id="dbt" value="300" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Bb</span><span class="desc">Bottom flange width</span></label><span><input type="number" id="dbb" value="300" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tw</span><span class="desc">Web thickness</span></label><span><input type="number" id="dtw" value="10" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tft</span><span class="desc">Top flange thickness</span></label><span><input type="number" id="dttf" value="15" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">tbf</span><span class="desc">Bottom flange thickness</span></label><span><input type="number" id="dtbf" value="15" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">R</span><span class="desc">Fillet radius (0 = none)</span></label><span><input type="number" id="dradius" value="18" onchange="fdraw_boltsplice()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-sub">2) Splice Plate <span class="n">(Width, Length, Thick)</span></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">TP</span><span class="desc">Top plate</span></label><input type="text" id="splt" value="280,300,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">TPi</span><span class="desc">Top inner plate</span></label><input type="text" id="splti" value="110,300,5" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">WP</span><span class="desc">Web plate</span></label><input type="text" id="splw" value="220,280,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">BPi</span><span class="desc">Bottom inner plate</span></label><input type="text" id="splbi" value="110,300,5" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">BP</span><span class="desc">Bottom plate</span></label><input type="text" id="splb" value="280,300,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-sub">3) Bolt Layout <span class="n">(Dia, Long N, Trans N&nbsp;/&nbsp;Space: In, Out, In, Out)</span></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">TB</span><span class="desc">Top bolt</span></label><input type="text" id="slayt" value="5,12,8" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">TBs</span><span class="desc">Top spacing</span></label><input type="text" id="slaytsp" value="30,10,80,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">WB</span><span class="desc">Web bolt</span></label><input type="text" id="slayw" value="5,12,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">WBs</span><span class="desc">Web spacing (I,O,0,O)</span></label><input type="text" id="slaywsp" value="60,10,0,10" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">BB</span><span class="desc">Bottom bolt</span></label><input type="text" id="slayb" value="5,12,8" onchange="fdraw_boltsplice()"></div>'
      + '      <div class="hs-inrow txt"><label><span class="var">BBs</span><span class="desc">Bottom spacing</span></label><input type="text" id="slaybsp" value="30,10,80,10" onchange="fdraw_boltsplice()"></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>'
    );

    /* ── LIFTING LUG ── */
    _addTemplate(root, 'tpl-draw-liftinglug', _HSCSS()
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
      + '      <span id="lug-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">'
      + '        <button type="button" class="hs-vbtn" data-sview="front" onclick="lug_setview(\'front\')" style="background:#2563eb;color:#fff;border-color:#2563eb;">Front</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="back" onclick="lug_setview(\'back\')">Back</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="left" onclick="lug_setview(\'left\')">Left</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="center" onclick="lug_setview(\'center\')">Center</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="right" onclick="lug_setview(\'right\')">Right</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="top" onclick="lug_setview(\'top\')">Top</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="bottom" onclick="lug_setview(\'bottom\')">Bottom</button>'
      + '        <button type="button" class="hs-vbtn" data-sview="3d" onclick="lug_setview(\'3d\')">3D</button>'
      + '        <button type="button" class="hs-btn" onclick="fdraw_liftinglug()"><i class="bi bi-arrow-repeat"></i> Regen</button>'
      + '      </span></div>'
      + '    <div class="hs-plot"><div id="liftinglugplot"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; live redraw on edit</span>'
      + '      <button type="button" class="hs-btn" onclick="odxf_lug.download(\'LiftingLug.dxf\')">DXF out</button></div>'
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">lugW,lugH,baseH,outerR,innerR,padeyeR,lugT,padeyeT</span></div>'
      + '        <textarea class="hs-batch" id="sUserText" rows="2" spellcheck="false" onchange="putParams_liftinglug(\'sUserText\'); fdraw_liftinglug();">120,120,30,40,10,30,20,30</textarea></div>'
      + '      <div class="hs-inrow"><label><span class="var">lugW</span><span class="desc">Lug width</span></label><span><input type="number" id="lugW" value="120" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">lugH</span><span class="desc">Lug height</span></label><span><input type="number" id="lugH" value="120" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">baseH</span><span class="desc">Base straight height</span></label><span><input type="number" id="baseH" value="30" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">outerR</span><span class="desc">Outer arc radius</span></label><span><input type="number" id="outerR" value="40" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">innerR</span><span class="desc">Hole radius</span></label><span><input type="number" id="innerR" value="10" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">padeyeR</span><span class="desc">Padeye radius</span></label><span><input type="number" id="padeyeR" value="30" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">lugT</span><span class="desc">Lug plate thickness</span></label><span><input type="number" id="lugT" value="20" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">padeyeT</span><span class="desc">Padeye plate thickness</span></label><span><input type="number" id="padeyeT" value="30" onchange="fdraw_liftinglug()"><span class="hs-unit">mm</span></span></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>'
    );

    /* ── BOX1CELL ── */
    _addTemplate(root, 'tpl-draw-box1cell', _beTpl({
      name: 'box1cell', plot: 'box1cellplot', bar: 'box1cell-viewbar', dxf: 'Box1Cell.dxf', guide: 'https://macrobim.github.io/macroBIM/box1cell_vars.png',
      hint: 'line1: Begin (23) / line2: End (23) / line3: L', brows: 5,
      bdef: '6600,12000,6000,1500,1500,1500,300,300,600,600,300,300,840,500,200,200,100,300,200,400,-2,5,3\n8000,12000,6000,1500,1500,1500,300,300,600,600,300,300,840,500,200,200,100,300,200,400,-2,5,3\n5000', len: 5000,
      rows: [['h', 'Section height', 'dh', 6600, 8000], ['bt', 'Top slab width', 'dbt', 12000, 12000], ['bb', 'Bottom slab width', 'dbb', 6000, 6000],
        ['btsh', 'Top slab haunch', 'dbth', 1500, 1500], ['bcanh', 'Cantilever haunch', 'dbch', 1500, 1500], ['bcan', 'Cantilever', 'dbc', 1500, 1500],
        ['t1', 'Slab t1', 'dt1', 300, 300], ['t2', 'Slab t2', 'dt2', 300, 300], ['t3', 'Slab t3', 'dt3', 600, 600], ['t4', 'Slab t4', 'dt4', 600, 600], ['t5', 'Slab t5', 'dt5', 300, 300], ['t6', 'Slab t6', 'dt6', 300, 300],
        ['tb', 'Bottom slab thick', 'dtb', 840, 840], ['tw', 'Web thickness', 'dtw', 500, 500], ['bh', 'Bottom haunch', 'dbbh', 200, 200], ['vh1', 'Void haunch 1', 'dbh1', 200, 200], ['vh2', 'Void haunch 2', 'dbh2', 100, 100],
        ['rwt', 'Web-top fillet R', 'drwt', 300, 300], ['rwtin', 'Web-top inner R', 'drwtin', 200, 200], ['rb', 'Bottom fillet R', 'drb', 400, 400],
        ['sl_tl', 'Top-left slope %', 'dsltl', -2, -2], ['sl_tr', 'Top-right slope %', 'dsltr', 5, 5], ['sl_b', 'Bottom slope %', 'dslb', 3, 3]]
    }));

    /* ── TAPERED BEGIN/END SECTIONS (rect / circle / track / octagon) ──
       Retaining-wall style: left Layout card (header view buttons + SVG plot),
       right Dimension Input card with Front/Back columns. Rendering is provided
       by bim_section_test.js (window.makeSectionTest), loaded on demand. */
    var HSCSS = _HSCSS();

    function _sectDrawTpl(o) {
      var setview = o.name + '_setview', fdraw = 'fdraw_' + o.name, odxf = 'odxf_' + o.name, putp = 'putParams_' + o.name;
      function vb(v, label, active) { return '<button type="button" class="hs-vbtn" data-sview="' + v + '" onclick="' + setview + '(\'' + v + '\')"' + (active ? ' style="background:#2563eb;color:#fff;border-color:#2563eb;"' : '') + '>' + label + '</button>'; }
      var buttons = vb('front', 'Front', true) + vb('back', 'Back') + vb('left', 'Left') + vb('center', 'Center') + vb('right', 'Right') + vb('top', 'Top') + vb('bottom', 'Bottom') + vb('3d', '3D')
        + '<button type="button" class="hs-btn" onclick="' + fdraw + '()"><i class="bi bi-arrow-repeat"></i> Regen</button>';
      var rows = o.rows.map(function (r) {
        return '<div class="hs-inrow be"><label><span class="var">' + r[0] + '</span><span class="desc">' + r[1] + '</span></label>'
          + '<input type="number" id="' + r[2] + '_s" value="' + r[3] + '" onchange="' + fdraw + '()">'
          + '<input type="number" id="' + r[2] + '_e" value="' + r[4] + '" onchange="' + fdraw + '()"></div>';
      }).join('');
      return HSCSS
        + '<div class="hs-root"><div class="hs-grid">'
        + '  <div class="hs-card">'
        + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
        + '      <span id="' + o.bar + '" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' + buttons + '</span></div>'
        + '    <div class="hs-plot"><div id="' + o.plot + '"></div></div>'
        + '  </div>'
        + '  <div class="hs-card">'
        + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; Front / Back</span>'
        + '      <button type="button" class="hs-btn" onclick="' + odxf + '.download(\'' + o.dxf + '\')">DXF out</button></div>'
        + '    <div class="hs-inputs">'
        + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">' + o.hint + '</span></div>'
        + '        <textarea class="hs-batch" id="sUserText" rows="' + o.brows + '" spellcheck="false" onchange="' + putp + '(\'sUserText\'); ' + fdraw + '();">' + o.bdef + '</textarea></div>'
        + '      <div class="hs-behd"><span>Variable</span><span class="c">Front</span><span class="c">Back</span></div>'
        + rows
        + '      <div class="hs-inrow"><label><span class="var">L</span><span class="desc">Segment length</span></label><span><input type="number" id="dseg_leng" value="' + o.len + '" onchange="' + fdraw + '()"><span class="hs-unit">mm</span></span></div>'
        + '      <div class="hs-inrow"><label><span class="var">Hollow</span><span class="desc">Hollow section</span></label><span><input type="checkbox" id="' + o.hollow + '" checked onchange="' + fdraw + '()" style="width:16px;height:16px;accent-color:#2563eb;vertical-align:middle;"></span></div>'
        + '    </div>'
        + '  </div>'
        + '</div></div>';
    }

    /* ── Cross-section preview builds (bim_xsect_test.js, window.XSECT) ── */
    _addTemplate(root, 'tpl-draw-rect', _xsectTpl({ name: 'rect', rows: [
      ['H', 'Outer height', 800], ['B', 'Outer width', 600],
      ['twl', 'Wall thickness left', 120], ['twr', 'Wall thickness right', 120],
      ['tf1', 'Top flange thickness', 120], ['tf2', 'Bottom flange thickness', 120],
      ['ha', 'Inner haunch (horizontal)', 150], ['hb', 'Inner haunch (vertical)', 150] ] }));

    _addTemplate(root, 'tpl-draw-circle', _xsectTpl({ name: 'circle', rows: [
      ['D', 'Outer diameter', 800], ['tw', 'Wall thickness', 120] ] }));

    _addTemplate(root, 'tpl-draw-octagon', _xsectTpl({ name: 'octagon', rows: [
      ['H', 'Outer height', 800], ['B', 'Outer width', 1000],
      ['a', 'Chamfer width (horiz)', 200], ['b', 'Chamfer height (vert)', 200],
      ['t', 'Wall thickness', 120] ] }));

    _addTemplate(root, 'tpl-draw-track', _xsectTpl({ name: 'track', rows: [
      ['H', 'Outer height', 800], ['B', 'Outer width', 1400],
      ['R', 'Corner radius', 400], ['t', 'Wall thickness', 120] ] }));
}

/* Cross-section preview template (single hollow section on the shared draw core).
   o = { name, rows:[[var,desc,default],...], hollowDefault? } */
function _xsectTpl(o) {
    var fdraw = 'fdraw_' + o.name, plot = 'xs_' + o.name + '_plot';
    var rows = o.rows.map(function (r) {
      return '<div class="hs-inrow"><label><span class="var">' + r[0] + '</span><span class="desc">' + r[1] + '</span></label>'
        + '<span><input type="number" id="xs_' + o.name + '_' + r[0] + '" value="' + r[2] + '" onchange="' + fdraw + '()"><span class="hs-unit">mm</span></span></div>';
    }).join('');
    var bhint = o.rows.map(function (r) { return r[0]; }).join(',') + ',hollow';
    var bdef = o.rows.map(function (r) { return r[2]; }).join(',') + ',1';
    var setview = o.name + '_setview';
    function vb(v, label, active) { return '<button type="button" class="hs-vbtn" data-sview="' + v + '" onclick="' + setview + '(\'' + v + '\')"' + (active ? ' style="background:#2563eb;color:#fff;border-color:#2563eb;"' : '') + '>' + label + '</button>'; }
    var vbar = vb('front', 'Front', true) + vb('back', 'Back') + vb('left', 'Left') + vb('center', 'Center') + vb('right', 'Right') + vb('top', 'Top') + vb('bottom', 'Bottom') + vb('3d', '3D')
      + '<button type="button" class="hs-btn" onclick="' + fdraw + '()"><i class="bi bi-arrow-repeat"></i> Regen</button>';
    return _HSCSS()
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
      + '      <span id="' + o.name + '-viewbar" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' + vbar + '</span></div>'
      + '    <div class="hs-plot"><div id="' + plot + '"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input</span>'
      + '      <button type="button" class="hs-btn" onclick="if(window.XSECT)window.XSECT.dxf(\'' + o.name + '\')">DXF out</button></div>'
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">' + bhint + '</span></div>'
      + '        <textarea class="hs-batch" id="xs_' + o.name + '_batch" rows="1" spellcheck="false" onchange="if(window.XSECT)window.XSECT.applyBatch(\'' + o.name + '\');">' + bdef + '</textarea></div>'
      + rows
      + '      <div class="hs-inrow"><label><span class="var">L</span><span class="desc">Segment length</span></label><span><input type="number" id="xs_' + o.name + '_L" value="3000" onchange="' + fdraw + '()"><span class="hs-unit">mm</span></span></div>'
      + '      <div class="hs-inrow"><label><span class="var">Hollow</span><span class="desc">Hollow section</span></label><span><input type="checkbox" id="xs_' + o.name + '_hollow" ' + (o.hollowDefault === false ? '' : 'checked') + ' onchange="' + fdraw + '()" style="width:16px;height:16px;accent-color:#2563eb;vertical-align:middle;"></span></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>';
}

function _HSCSS() {
    return '<style>'
      + '.hs-root{--dim:#2563eb;--muted:#64748b;--line:#cbd5e1;--hair:#e2e8f0;--panel:#fff;--chip:#f1f5f9;--ink:#182430;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,\'Segoe UI\',Roboto,sans-serif;}'
      + '.hs-root *{box-sizing:border-box}'
      + '.hs-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start}'
      + '@media(max-width:900px){.hs-grid{grid-template-columns:1fr}}'
      + '.hs-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}'
      + '.hs-hd{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;padding:9px 14px;border-bottom:1px solid var(--hair);background:var(--chip)}'
      + '.hs-ttl{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;color:var(--muted)}'
      + '.hs-inputs{padding:14px}'
      + '.hs-inrow{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed var(--hair)}'
      + '.hs-inrow:last-child{border-bottom:0}'
      + '.hs-inrow label{font-size:13px;display:flex;align-items:baseline;gap:8px;margin:0}'
      + '.hs-inrow .var{font-weight:600;color:var(--dim);min-width:40px;display:inline-block;font-family:ui-monospace,Menlo,Consolas,monospace}'
      + '.hs-inrow .desc{color:var(--muted);font-size:12px}'
      + '.hs-inrow input{width:120px;text-align:right;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink);font-size:13px}'
      + '.hs-inrow input:focus{outline:2px solid var(--dim);outline-offset:1px;border-color:var(--dim)}'
      + '.hs-inrow.be{grid-template-columns:1fr 92px 92px}'
      + '.hs-inrow.be input{width:100%}'
      + '.hs-behd{display:grid;grid-template-columns:1fr 92px 92px;gap:8px;padding:2px 0 6px;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);border-bottom:1px dashed var(--hair);margin-bottom:4px}'
      + '.hs-behd .c{text-align:right}'
      + '.hs-unit{color:var(--muted);font-size:11px;margin-left:6px}'
      + '.hs-btn{font:inherit;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#fff;background:var(--dim);border:1px solid var(--dim);border-radius:6px;padding:5px 12px;cursor:pointer}'
      + '.hs-btn:hover{filter:brightness(1.1)}'
      + '.hs-vbtn{padding:5px 10px;border:1px solid #cbd5e1;background:#eef2f6;color:#475569;cursor:pointer;border-radius:6px;font-size:11px;font-weight:700}'
      + '.hs-batch-wrap{padding:0 0 10px;margin-bottom:8px;border-bottom:1px dashed var(--hair)}'
      + '.hs-batch-lbl{font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin-bottom:5px}'
      + '.hs-batch-hint{font-weight:400;text-transform:none;letter-spacing:0;color:var(--dim);font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px}'
      + '.hs-batch{width:100%;resize:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel);color:var(--ink)}'
      + '.hs-plot > div{width:100%}'
      + '</style>';
}

// Begin/End drawing template builder (retaining-wall style), used by ibeam & box1cell.
// o = { name, plot, bar, dxf, hint, brows, bdef, len, rows:[[var,desc,idBase,vFront,vBack],...], guide? }
function _beTpl(o) {
    var setview = o.name + '_setview', fdraw = 'fdraw_' + o.name, odxf = 'odxf_' + o.name, putp = 'putParams_' + o.name;
    function vb(v, label, active) { return '<button type="button" class="hs-vbtn" data-sview="' + v + '" onclick="' + setview + '(\'' + v + '\')"' + (active ? ' style="background:#2563eb;color:#fff;border-color:#2563eb;"' : '') + '>' + label + '</button>'; }
    var buttons = vb('front', 'Front', true) + vb('back', 'Back') + vb('left', 'Left') + vb('center', 'Center') + vb('right', 'Right') + vb('top', 'Top') + vb('bottom', 'Bottom') + vb('3d', '3D')
      + '<button type="button" class="hs-btn" onclick="' + fdraw + '()"><i class="bi bi-arrow-repeat"></i> Regen</button>';
    var rows = o.rows.map(function (r) {
      return '<div class="hs-inrow be"><label><span class="var">' + r[0] + '</span><span class="desc">' + r[1] + '</span></label>'
        + '<input type="number" id="' + r[2] + '_s" value="' + r[3] + '" onchange="' + fdraw + '()">'
        + '<input type="number" id="' + r[2] + '_e" value="' + r[4] + '" onchange="' + fdraw + '()"></div>';
    }).join('');
    return _HSCSS()
      + '<div class="hs-root"><div class="hs-grid">'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Layout</span>'
      + '      <span id="' + o.bar + '" style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">' + buttons + '</span></div>'
      + '    <div class="hs-plot"><div id="' + o.plot + '"></div></div>'
      + '  </div>'
      + '  <div class="hs-card">'
      + '    <div class="hs-hd"><span class="hs-ttl">Dimension Input &mdash; Front / Back</span>'
      + '      <span style="display:flex;gap:6px;align-items:center;">'
      + (o.guide ? '<button type="button" class="hs-vbtn" onclick="var g=document.getElementById(\'' + o.name + '_guide_img\');g.style.display=(g.style.display===\'none\'?\'block\':\'none\');"><i class="bi bi-image"></i> Guide</button>' : '')
      + '        <button type="button" class="hs-btn" onclick="' + odxf + '.download(\'' + o.dxf + '\')">DXF out</button></span></div>'
      + (o.guide ? '<div id="' + o.name + '_guide_img" style="display:none;padding:10px;background:#f8f9fa;border-bottom:1px solid var(--hair);text-align:center;"><img src="' + o.guide + '" style="max-width:100%;height:auto;border:1px solid #ddd;border-radius:6px;"></div>' : '')
      + '    <div class="hs-inputs">'
      + '      <div class="hs-batch-wrap"><div class="hs-batch-lbl">Batch Input (CSV) <span class="hs-batch-hint">' + o.hint + '</span></div>'
      + '        <textarea class="hs-batch" id="sUserText" rows="' + o.brows + '" spellcheck="false" onchange="' + putp + '(\'sUserText\'); ' + fdraw + '();">' + o.bdef + '</textarea></div>'
      + '      <div class="hs-behd"><span>Variable</span><span class="c">Front</span><span class="c">Back</span></div>'
      + rows
      + '      <div class="hs-inrow"><label><span class="var">L</span><span class="desc">Segment length</span></label><span><input type="number" id="dseg_leng" value="' + o.len + '" onchange="' + fdraw + '()"><span class="hs-unit">mm</span></span></div>'
      + '    </div>'
      + '  </div>'
      + '</div></div>';
}

function _addTemplate(root, id, html) {
    var tpl = document.createElement('template');
    tpl.id = id;
    tpl.innerHTML = html;
    root.appendChild(tpl);
}

/* ══ NAVIGATION ══ */
function _bindNavigation() {

    function showPage(pageId) {
        document.querySelectorAll('.page-view').forEach(function(p) { p.classList.remove('active'); });
        var t = document.getElementById('page-' + pageId);
        if (t) t.classList.add('active');
        document.querySelectorAll('.nav-sub a').forEach(function(s) { s.classList.remove('active'); });
        var sb = document.querySelector('.nav-sub a[data-page="' + pageId + '"]');
        if (sb) sb.classList.add('active');
        document.querySelectorAll('.nav-item[data-page]').forEach(function(s) { s.classList.remove('active'); });
        var topItem = document.querySelector('.nav-item[data-page="' + pageId + '"]');
        if (topItem) topItem.classList.add('active');

        if (pageId === 'rebar' && !window._rebarLoaded) { loadRebarTables(); window._rebarLoaded = true; }
        if (pageId === 'rebarleng' && !window._rebarLengLoaded) {
            if (typeof mod_rebar_leng !== 'undefined') { mod_rebar_leng.init('mount-rebarleng'); window._rebarLengLoaded = true; }
            else { document.getElementById('mount-rebarleng').innerHTML = '<p style="color:#b91c1c;padding:16px;">mod_rebar_leng.js / mod_rebar.js / mod_concrete.js 스크립트가 로드되지 않았습니다.</p>'; }
        }
        if (pageId === 'steel' && !window._steelLoaded) { selectSection('hsection'); window._steelLoaded = true; }
        if (pageId === 'draw-hsection') { mountDrawing('hsection'); ensureHsectionTest(function(){ if (typeof fdraw_hsection === 'function') fdraw_hsection(); }); }
        if (pageId === 'draw-channel') { mountDrawing('channel'); ensureChannelTest(function(){ if (typeof fdraw_channel === 'function') fdraw_channel(); }); }
        if (pageId === 'draw-ibeam') { mountDrawing('ibeam'); ensureIbeamTest(function(){ if (typeof fdraw_ibeam === 'function') fdraw_ibeam(); }); }
        if (pageId === 'draw-splice') { mountDrawing('splice'); if (typeof fdraw_boltsplice === 'function') fdraw_boltsplice(); }
        if (pageId === 'draw-liftinglug') { mountDrawing('liftinglug'); ensureLugTest(function(){ if (typeof fdraw_liftinglug === 'function') fdraw_liftinglug(); }); }
        if (pageId === 'draw-box1cell') { mountDrawing('box1cell'); ensureBox1cellTest(function(){ if (typeof fdraw_box1cell === 'function') fdraw_box1cell(); }); }
        if (pageId === 'draw-rect') { mountDrawing('rect'); ensureXsect('rect'); }
        if (pageId === 'draw-circle') { mountDrawing('circle'); ensureXsect('circle'); }
        if (pageId === 'draw-octagon') { mountDrawing('octagon'); ensureXsect('octagon'); }
        if (pageId === 'draw-track') { mountDrawing('track'); ensureXsect('track'); }
        if (pageId === 'draw-gravitywall') { mountDrawing('gravitywall'); ensureGravityWall(); }
        if (pageId === 'draw-invtwall') { mountDrawing('invtwall'); ensureInvtWall(); }
        if (pageId === 'draw-lwall') { mountDrawing('lwall'); ensureLWall(); }
        if (pageId === 'draw-pier') { mountDrawing('pier'); ensurePier(); }
    }
    window.showPage = showPage;

    // Pier input module (bim_pier_test.js) — single-page, single entry fdraw_pier. Load on demand.
    function ensurePier() {
        if (typeof fdraw_pier === 'function') { fdraw_pier('mount-draw-pier'); return; }
        if (window._pierLoading) return;
        window._pierLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_pier_test.js?v=67';
        sc.onload = function () { window._pierLoading = false; if (typeof fdraw_pier === 'function') fdraw_pier('mount-draw-pier'); };
        sc.onerror = function () { window._pierLoading = false; var m = document.getElementById('mount-draw-pier'); if (m) m.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_pier_test.js failed to load.</p>'; };
        document.head.appendChild(sc);
    }

    // Gravity wall module (bim_gravitywall.js) may not be in the page's script list — load on demand.
    function ensureGravityWall() {
        if (typeof fdraw_gravitywall === 'function') { fdraw_gravitywall('mount-draw-gravitywall'); return; }
        if (window._gwLoading) return;
        window._gwLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_gravitywall.js?v=10';
        sc.onload = function () { window._gwLoading = false; if (typeof fdraw_gravitywall === 'function') fdraw_gravitywall('mount-draw-gravitywall'); };
        sc.onerror = function () { window._gwLoading = false; var m = document.getElementById('mount-draw-gravitywall'); if (m) m.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_gravitywall.js failed to load.</p>'; };
        document.head.appendChild(sc);
    }

    // Inverted-T wall module (bim_invtwall.js) — load on demand.
    function ensureInvtWall() {
        if (typeof fdraw_invtwall === 'function') { fdraw_invtwall('mount-draw-invtwall'); return; }
        if (window._iwLoading) return;
        window._iwLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_invtwall_test.js?v=4';
        sc.onload = function () { window._iwLoading = false; if (typeof fdraw_invtwall === 'function') fdraw_invtwall('mount-draw-invtwall'); };
        sc.onerror = function () { window._iwLoading = false; var m = document.getElementById('mount-draw-invtwall'); if (m) m.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_invtwall.js failed to load.</p>'; };
        document.head.appendChild(sc);
    }

    // L-shaped wall module (bim_lwall.js) — load on demand.
    function ensureLWall() {
        if (typeof fdraw_lwall === 'function') { fdraw_lwall('mount-draw-lwall'); return; }
        if (window._lwLoading) return;
        window._lwLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_lwall.js?v=1';
        sc.onload = function () { window._lwLoading = false; if (typeof fdraw_lwall === 'function') fdraw_lwall('mount-draw-lwall'); };
        sc.onerror = function () { window._lwLoading = false; var m = document.getElementById('mount-draw-lwall'); if (m) m.innerHTML = '<p style="color:#b91c1c;padding:16px;">bim_lwall.js failed to load.</p>'; };
        document.head.appendChild(sc);
    }

    // H-section TEST build (bim_hsection_test.js) — overrides fdraw_hsection for the header-driven single view.
    function ensureHsectionTest(cb) {
        if (window._hsecTestLoaded) { if (cb) cb(); return; }
        if (window._hsecTestLoading) return;
        window._hsecTestLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_hsection_test.js?v=6';
        sc.onload = function () { window._hsecTestLoaded = true; window._hsecTestLoading = false; if (cb) cb(); };
        sc.onerror = function () { window._hsecTestLoading = false; if (typeof fdraw_hsection === 'function') fdraw_hsection(); };
        document.head.appendChild(sc);
    }

    // Channel TEST build (bim_channel_test.js) — overrides fdraw_channel for the header-driven single view.
    function ensureChannelTest(cb) {
        if (window._chanTestLoaded) { if (cb) cb(); return; }
        if (window._chanTestLoading) return;
        window._chanTestLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_channel_test.js?v=2';
        sc.onload = function () { window._chanTestLoaded = true; window._chanTestLoading = false; if (cb) cb(); };
        sc.onerror = function () { window._chanTestLoading = false; if (typeof fdraw_channel === 'function') fdraw_channel(); };
        document.head.appendChild(sc);
    }

    // Tapered Begin/End sections TEST build (bim_section_test.js) — installs
    // window.makeSectionTest, which overrides fdraw_<sec> for the header-driven views.
    function ensureSectionTest(name, cb) {
        function run() { if (typeof window.makeSectionTest === 'function') window.makeSectionTest(name); if (cb) cb(); }
        if (window.makeSectionTest) { run(); return; }
        window._sectCbs = window._sectCbs || [];
        window._sectCbs.push(run);
        if (window._sectLoading) return;
        window._sectLoading = true;
        var sc = document.createElement('script');
        sc.src = 'https://macrobim.github.io/macroBIM/bim_section_test.js?v=2';
        sc.onload = function () { window._sectLoading = false; var q = window._sectCbs; window._sectCbs = []; q.forEach(function (f) { f(); }); };
        sc.onerror = function () { window._sectLoading = false; window._sectCbs = []; if (typeof window['fdraw_' + name] === 'function') window['fdraw_' + name](); };
        document.head.appendChild(sc);
    }

    // Shared draw-test core (bim_draw_test_core.js — window.RWSVG) then a section
    // module (lifting lug / I-beam / box1cell). Loads the core once, then the module.
    // Uses a per-module load-completion flag (the production fdraw_* already exists,
    // so we must not gate on function existence — the test module OVERRIDES it).
    function ensureRWModule(moduleFile, flag, cb) {
        function afterCore() {
            if (window['_' + flag + 'Done']) { if (cb) cb(); return; }
            if (window['_' + flag + 'ing']) { (window['_' + flag + 'q'] = window['_' + flag + 'q'] || []).push(cb); return; }
            window['_' + flag + 'ing'] = true;
            window['_' + flag + 'q'] = cb ? [cb] : [];
            var sc = document.createElement('script');
            sc.src = 'https://macrobim.github.io/macroBIM/' + moduleFile;
            sc.onload = function () { window['_' + flag + 'Done'] = true; window['_' + flag + 'ing'] = false; var q = window['_' + flag + 'q'] || []; window['_' + flag + 'q'] = []; q.forEach(function (f) { if (f) f(); }); };
            sc.onerror = function () { window['_' + flag + 'ing'] = false; window['_' + flag + 'q'] = []; };
            document.head.appendChild(sc);
        }
        if (window.RWSVG) { afterCore(); return; }
        if (window._rwCoreLoading) { (window._rwCoreCbs = window._rwCoreCbs || []).push(afterCore); return; }
        window._rwCoreLoading = true;
        window._rwCoreCbs = [afterCore];
        var sc0 = document.createElement('script');
        sc0.src = 'https://macrobim.github.io/macroBIM/bim_draw_test_core.js?v=6';
        sc0.onload = function () { window._rwCoreLoading = false; var q = window._rwCoreCbs || []; window._rwCoreCbs = []; q.forEach(function (f) { f(); }); };
        sc0.onerror = function () { window._rwCoreLoading = false; window._rwCoreCbs = []; };
        document.head.appendChild(sc0);
    }
    function ensureLugTest(cb) { ensureRWModule('bim_liftinglug_test.js?v=1', 'lugTest', cb); }
    function ensureIbeamTest(cb) { ensureRWModule('bim_ibeam_test.js?v=2', 'ibeamTest', cb); }
    function ensureBox1cellTest(cb) { ensureRWModule('bim_box1cell_test.js?v=3', 'box1cellTest', cb); }
    // Cross-section preview builds (bim_xsect_test.js — window.XSECT) on the shared core.
    function ensureXsect(name) { ensureRWModule('bim_xsect_test.js?v=10', 'xsect', function () { if (window.XSECT) { window.XSECT.install(name); window.XSECT.mount(name); } }); }

    function mountDrawing(kind) {
        ['hsection','channel','ibeam','splice','liftinglug','box1cell','rect','circle','octagon','track','gravitywall','invtwall','lwall','pier'].forEach(function(k) {
            if (k !== kind) {
                var other = document.getElementById('mount-draw-' + k);
                if (other) other.innerHTML = '';
            }
        });
        var mount = document.getElementById('mount-draw-' + kind);
        if (mount && !mount.firstElementChild) {
            var tpl = document.getElementById('tpl-draw-' + kind);
            if (tpl) mount.appendChild(tpl.content.cloneNode(true));
        }
    }
    window.mountDrawing = mountDrawing;

    document.getElementById('tablesToggle').addEventListener('click', function(e) {
        e.preventDefault(); this.classList.toggle('open'); document.getElementById('tables-sub').classList.toggle('show');
    });
    document.getElementById('codeToggle').addEventListener('click', function(e) {
        e.preventDefault(); this.classList.toggle('open'); document.getElementById('code-sub').classList.toggle('show');
    });
    document.getElementById('drawingsToggle').addEventListener('click', function(e) {
        e.preventDefault(); this.classList.toggle('open'); document.getElementById('drawings-sub').classList.toggle('show');
    });
    document.getElementById('retainingToggle').addEventListener('click', function(e) {
        e.preventDefault(); this.classList.toggle('open'); document.getElementById('retaining-sub').classList.toggle('show');
    });
    document.querySelectorAll('.nav-item[data-page]').forEach(function(el) {
        el.addEventListener('click', function(e) { e.preventDefault(); showPage(this.getAttribute('data-page')); });
    });
    document.querySelectorAll('.nav-sub a[data-page]').forEach(function(el) {
        el.addEventListener('click', function(e) {
            e.preventDefault(); showPage(this.getAttribute('data-page'));
            var pt = this.closest('.nav-sub').previousElementSibling;
            if (pt) { pt.classList.add('open'); this.closest('.nav-sub').classList.add('show'); }
        });
    });
}
