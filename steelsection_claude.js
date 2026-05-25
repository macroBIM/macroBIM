// steelsection_claude.js

var GITHUB_BASE = 'https://macrobim.github.io/design/';

var STEEL_CFG = {
  hsection: {
    url: GITHUB_BASE + 'hsection.csv',
    thead: '<tr>' +
      '<th rowspan="2">Designation<br>(H×B)</th>' +
      '<th rowspan="2">Unit Wt<br>(kg/m)</th>' +
      '<th colspan="5">Sectional Dimension (mm)</th>' +
      '<th rowspan="2">Area<br>(cm²)</th>' +
      '<th colspan="2">Moment of Inertia (cm⁴)</th>' +
      '<th colspan="2">Radius of Gyration (cm)</th>' +
      '<th colspan="2">Section Modulus (cm³)</th>' +
      '<th colspan="2">Plastic Modulus (cm³)</th>' +
      '<th rowspan="2">Cw</th>' +
      '<th rowspan="2">J</th>' +
      '</tr>' +
      '<tr><th>H</th><th>B</th><th>t1</th><th>t2</th><th>r</th>' +
      '<th>Ix</th><th>Iy</th><th>ix</th><th>iy</th>' +
      '<th>Sx</th><th>Sy</th><th>Zx</th><th>Zy</th></tr>'
  },
  channel: {
    url: GITHUB_BASE + 'channel.csv',
    thead: '<tr>' +
      '<th rowspan="2">Designation<br>(H×B)</th>' +
      '<th colspan="6">Sectional Dimension (mm)</th>' +
      '<th rowspan="2">Area<br>(cm²)</th>' +
      '<th rowspan="2">Unit Wt<br>(kg/m)</th>' +
      '<th colspan="2">C.G. (cm)</th>' +
      '<th colspan="2">Inertia (cm⁴)</th>' +
      '<th colspan="2">Gyration (cm)</th>' +
      '<th colspan="2">Modulus (cm³)</th>' +
      '</tr>' +
      '<tr><th>H</th><th>B</th><th>t1</th><th>t2</th><th>r1</th><th>r2</th>' +
      '<th>Cx</th><th>Cy</th><th>Ix</th><th>Iy</th><th>ix</th><th>iy</th><th>Zx</th><th>Zy</th></tr>'
  },
  equalangle: {
    url: GITHUB_BASE + 'equalangle.csv',
    thead: '<tr>' +
      '<th rowspan="2">Designation<br>(A×B)</th>' +
      '<th colspan="5">Dimension (mm)</th>' +
      '<th rowspan="2">Area<br>(cm²)</th>' +
      '<th rowspan="2">Unit Wt<br>(kg/m)</th>' +
      '<th rowspan="2">Cx,Cy<br>(cm)</th>' +
      '<th colspan="3">Inertia (cm⁴)</th>' +
      '<th colspan="3">Gyration (cm)</th>' +
      '<th rowspan="2">Zx,Zy<br>(cm³)</th>' +
      '</tr>' +
      '<tr><th>A</th><th>B</th><th>t</th><th>r1</th><th>r2</th>' +
      '<th>Ix,Iy</th><th>max Iu</th><th>min Iv</th>' +
      '<th>ix,iy</th><th>max iu</th><th>min iv</th></tr>'
  },
  unequalangle: {
    url: GITHUB_BASE + 'unequalangle.csv',
    thead: '<tr>' +
      '<th rowspan="2">Designation<br>(A×B)</th>' +
      '<th colspan="5">Dimension (mm)</th>' +
      '<th rowspan="2">Area<br>(cm²)</th>' +
      '<th rowspan="2">Unit Wt<br>(kg/m)</th>' +
      '<th colspan="2">C.G. (cm)</th>' +
      '<th colspan="4">Inertia (cm⁴)</th>' +
      '<th colspan="4">Gyration (cm)</th>' +
      '<th rowspan="2">Tan α</th>' +
      '<th colspan="2">Modulus (cm³)</th>' +
      '</tr>' +
      '<tr><th>A</th><th>B</th><th>t</th><th>r1</th><th>r2</th>' +
      '<th>Cx</th><th>Cy</th>' +
      '<th>Ix</th><th>Iy</th><th>max Iu</th><th>min Iv</th>' +
      '<th>ix</th><th>iy</th><th>max iu</th><th>min iv</th>' +
      '<th>Zx</th><th>Zy</th></tr>'
  },
  invertedangle: {
    url: GITHUB_BASE + 'invertedangle.csv',
    thead: '<tr>' +
      '<th rowspan="2">Designation<br>(A×B)</th>' +
      '<th colspan="6">Dimension (mm)</th>' +
      '<th rowspan="2">Area<br>(cm²)</th>' +
      '<th rowspan="2">Unit Wt<br>(kg/m)</th>' +
      '<th colspan="2">C.G. (cm)</th>' +
      '<th colspan="4">Inertia (cm⁴)</th>' +
      '<th colspan="4">Gyration (cm)</th>' +
      '<th rowspan="2">Tan α</th>' +
      '<th colspan="2">Modulus (cm³)</th>' +
      '</tr>' +
      '<tr><th>A</th><th>B</th><th>t1</th><th>t2</th><th>r1</th><th>r2</th>' +
      '<th>Cx</th><th>Cy</th>' +
      '<th>Ix</th><th>Iy</th><th>max Iu</th><th>min Iv</th>' +
      '<th>ix</th><th>iy</th><th>max iu</th><th>min iv</th>' +
      '<th>Zx</th><th>Zy</th></tr>'
  }
};

function selectSection(type) {
  document.querySelectorAll('.section-card').forEach(function(c) {
    c.classList.remove('selected');
  });
  var card = document.querySelector('.section-card[data-section="' + type + '"]');
  if (card) card.classList.add('selected');

  var cfg = STEEL_CFG[type];
  var thead = document.getElementById('steel-thead');
  var tbody = document.getElementById('steel-tbody');
  thead.innerHTML = cfg.thead;
  tbody.innerHTML =
    '<tr><td colspan="30" class="loading-row"><span class="spinner"></span> Loading ' + type + ' data...</td></tr>';

  fetch(cfg.url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function(csv) {
      var rows = csv.replace(/\r/g, '').trim().split('\n');
      var html = '';
      for (var i = 1; i < rows.length; i++) {
        if (!rows[i].trim()) continue;
        var cols = rows[i].split(',');
        var last = cols[cols.length - 1].trim();
        var hasKS = (last === 'O' || last === 'X');
        var len = hasKS ? cols.length - 1 : cols.length;
        html += '<tr>';
        for (var j = 0; j < len; j++) {
          html += '<td>' + cols[j].trim() + '</td>';
        }
        html += '</tr>';
      }
      tbody.innerHTML = html;
    })
    .catch(function(e) {
      tbody.innerHTML = '<tr><td colspan="30" class="error-msg">Failed to load data.</td></tr>';
      console.error(e);
    });
}
