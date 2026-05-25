// rebartable_claude.js

var REBAR_URLS = {
  ks:   'https://macrobim.github.io/design/rebar_ks.csv',
  astm: 'https://macrobim.github.io/design/rebar_astm.csv',
  bs:   'https://macrobim.github.io/design/rebar_bs.csv'
};

var REBAR_HEADERS = [
  'Bar Size', 'Diameter (mm)', 'Area (mm²)', 'Weight (kg/m)',
  'Diameter (in)', 'Area (in²)', 'Weight (lb/ft)'
];

function loadRebarTables() {
  fetchRebarCSV(REBAR_URLS.ks,   'rebar-ks-head',   'rebar-ks-body');
  fetchRebarCSV(REBAR_URLS.astm, 'rebar-astm-head', 'rebar-astm-body');
  fetchRebarCSV(REBAR_URLS.bs,   'rebar-bs-head',   'rebar-bs-body');
}

function fetchRebarCSV(url, headId, bodyId) {
  fetch(url)
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    })
    .then(function(csv) {
      renderRebarTable(csv, headId, bodyId);
    })
    .catch(function() {
      document.getElementById(bodyId).innerHTML =
        '<tr><td colspan="7" class="error-msg">Failed to load data.</td></tr>';
    });
}

function renderRebarTable(csv, headId, bodyId) {
  var rows = csv.replace(/\r/g, '').trim().split('\n');
  if (rows.length < 2) return;

  var th = '<tr>';
  REBAR_HEADERS.forEach(function(h) { th += '<th>' + h + '</th>'; });
  th += '</tr>';
  document.getElementById(headId).innerHTML = th;

  var html = '';
  for (var i = 1; i < rows.length; i++) {
    if (!rows[i].trim()) continue;
    var cols = rows[i].split(',');
    html += '<tr>';
    for (var j = 0; j < cols.length; j++) {
      html += '<td>' + cols[j].trim() + '</td>';
    }
    html += '</tr>';
  }
  document.getElementById(bodyId).innerHTML = html;
}
