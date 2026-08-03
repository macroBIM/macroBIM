/*
		2 cell box 작도를 위한 JS  v000
*/
const odxf_box12cell 	= dxf_generator();
const scvs_box12cell  = "box12cellplot";		// canvas name

/*
	입력 변수 정의 : [key, 기본값, 라벨(생략시 key)]
	순서는 CSV 일괄입력(BATCH INPUT) 순서와 동일해야 함
*/
const adefs_box12cell = [
	// 전체
	['TH',      3000],
	['SLL',     2,    'SLL (%)'],
	['SLR',     -2,   'SLR (%)'],
	['SLB',     0,    'SLB (%)'],
	// 상부 폭 (좌/우)
	['WL',      6800],
	['WTL',     4500],
	['WCAL1',   1000],
	['WCAL2',   1000],
	['WR',      6800],
	['WTR',     4500],
	['WCAR1',   1000],
	['WCAR2',   1000],
	// 캔틸레버 두께 (좌/우)
	['TCAL',    250],
	['TCAL1',   600],
	['TCAL2',   350],
	['TCAR',    250],
	['TCAR1',   600],
	['TCAR2',   350],
	// 상부 슬래브 및 헌치
	['TTS',     280],
	['WTHUL1',  600],
	['WTHUL2',  600],
	['TTHL1',   800],
	['TTHL2',   480],
	['WTCHUL1', 500],
	['WTCHUL2', 500],
	['TTHCL1',  700],
	['TTHCL2',  450],
	['WTCHUR1', 500],
	['WTCHUR2', 500],
	['TTHCR1',  700],
	['TTHCR2',  450],
	['WTHUR1',  600],
	['WTHUR2',  600],
	['TTHR1',   800],
	['TTHR2',   480],
	// 복부 두께 (좌측 / 중앙 / 우측)
	['TWEBL',   450],
	['TWEBC',   350],
	['TWEBR',   450],
	// 하부
	['WBL',     3800],
	['WBR',     3800],
	['TBEL',    600],
	['TBER',    600],
	['TBS',     300],
	['WBHL1',   500],
	['WBHL2',   500],
	['TBHL1',   750],
	['TBHL2',   450],
	['WBHCL1',  400],
	['WBHCL2',  400],
	['TBHCL1',  650],
	['TBHCL2',  420],
	['WBHCR1',  400],
	['WBHCR2',  400],
	['TBHCR1',  650],
	['TBHCR2',  420],
	['WBHR1',   500],
	['WBHR2',   500],
	['TBHR1',   750],
	['TBHR2',   450],
	// 필렛
	['R_WTL',   300, 'R_WTL (0, if not necessary)'],
	['R_WTR',   300, 'R_WTR (0, if not necessary)'],
	['R_WTIL',  300, 'R_WTIL (0, if not necessary)'],
	['R_WTIR',  300, 'R_WTIR (0, if not necessary)'],
	['R_WBL',   300, 'R_WBL (0, if not necessary)'],
	['R_WBR',   300, 'R_WBR (0, if not necessary)']
];

/*
	1 cell 모드에서 해당사항이 없는 변수 (중앙복부/중앙헌치 관련)
*/
const acentervars_box12cell = [
	'WTCHUL1', 'WTCHUL2', 'TTHCL1', 'TTHCL2',
	'WTCHUR1', 'WTCHUR2', 'TTHCR1', 'TTHCR2',
	'TWEBC',
	'WBHCL1', 'WBHCL2', 'TBHCL1', 'TBHCL2',
	'WBHCR1', 'WBHCR2', 'TBHCR1', 'TBHCR2'
];

// Section Type 에 따라 입력칸 표시/숨김 (라벨 div 가 input 바로 앞에 있는 폼 구조 기준)
function toggleCenterVars_box12cell(ncell){
	const show = Number(ncell) !== 1;
	acentervars_box12cell.forEach( (skey) => {
		const inp = document.getElementById(skey + '_s');
		if (!inp) return;
		const lbl = inp.previousElementSibling;
		inp.style.display = show ? '' : 'none';
		if (lbl && lbl.classList && lbl.classList.contains('col-label')) lbl.style.display = show ? '' : 'none';
	});
}

function box12cell_click() {

    // 1. 사이드바(nav) 및 메인 콘텐츠(main) 레이아웃 조정
    const sidebarNav = document.querySelector('nav.sidebar');
    const mainContent = document.getElementById('wrap_main');

    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
    }

    var omain = document.getElementById("wrap_main");

    // HTML 생성
    var shtml = "";

	// 뷰포트 높이 계산 (더 넉넉한 하단 여백 확보)
    let dynamicHeight = "calc(100vh - 100px)";

	shtml += "<div class='container-fluid px-4' style='height: " + dynamicHeight + "; margin-top: 10px; margin-bottom: 20px;'>";
    shtml += "  <div class='row g-3 h-100'>";

    // --- 왼쪽: 입력 폼 영역 ---
    shtml += "      <div class='col-lg-4 h-100'>";

	shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>";

	shtml += "              <div class='card-header bg-secondary text-white flex-shrink-0 d-flex justify-content-between align-items-center'>";
	shtml += "                  <h6 class='mb-0'>DIMENSION (mm)</h6>";
	shtml += "                  <button class='btn btn-sm btn-outline-light' onclick='toggleDimensionImage()'>VIEW GUIDE</button>";
	shtml += "              </div>";

	shtml += "              <div class='card-body overflow-auto flex-grow-1' style='min-height: 0; padding-bottom: 0;'>";
	shtml += "                  <div class='pe-1'>";

	shtml += createInputText_box12cell('sUserText', 'BATCH INPUT (CSV)', "")

	shtml += createLabel('INPUT One by One')

	shtml += createInputLabel_box12cell('Variable', 'Begin Section', "End Section")

	adefs_box12cell.forEach( (adef) => {
		let skey   = adef[0];
		let dval   = adef[1];
		let slabel = (adef.length > 2) ? adef[2] : skey;
		shtml += createInputRow_box12cell( slabel, skey + '_s', dval, skey + '_e', dval);
	});

    shtml += createInputRow_box12cell('Seg Length', 'dseg_leng', 5000, '', );

    shtml += "                  </div>";
    shtml += "              </div>";
	shtml += "      	</div>";

	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_box12cell.download(\"Box12Cell.dxf\")'>";
	shtml += "                      DXF DOWNLOAD";
	shtml += "                  </button>";
	shtml += "              </div>";
	shtml += "          </div>";

	shtml += "      </div>";

    // --- 오른쪽: 도면 뷰어 영역 ---
    shtml += "      <div class='col-lg-8 h-100'>";
    shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>";
    shtml += "              <div class='card-header bg-secondary flex-shrink-0'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW</h6>";
    shtml += "              </div>";

    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_box12cell + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
    shtml += "              </div>";

    shtml += "          </div>";
    shtml += "      </div>";

    shtml += "  </div>";
    shtml += "</div>";

	// 2. 드래그 가능한 플로팅 이미지 창
	shtml += "<div id='floating_img_win' style='display:none; position: fixed; top: 100px; left: 50%; transform: translateX(-50%); width: 500px; background: white; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999; overflow: hidden;'>";

	shtml += "  <div id='floating_header' style='padding: 10px 15px; background: #343a40; color: white; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none;'>";
	shtml += "      <span style='font-size: 0.85rem; font-weight: bold;'>Dimension Guide</span>";
	shtml += "      <span style='cursor: pointer; font-size: 20px; line-height: 1;' onclick='toggleDimensionImage()'>&times;</span>";
	shtml += "  </div>";

	shtml += "  <div style='padding: 10px; text-align: center; background: #f8f9fa;'>";
	shtml += "      <img src='/images/box12cell_vars.png' style='max-width: 100%; height: auto; display: block; border: 1px solid #ddd;'>";
	shtml += "  </div>";

	shtml += "</div>";

    omain.innerHTML = shtml;

	// 드래그 기능 활성화 함수 호출
	initDraggable(document.getElementById("floating_img_win"), document.getElementById("floating_header"));	// see common.js

    // 초기 드로잉 실행
    fdraw_box12cell();

}


	// 1. 라벨 행
	function createInputLabel_box12cell(label1, label2, label3) {
		return `
		<div class='row mb-2 align-items-center'>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label1}
			</label>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label2}
			</label>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label3}
			</label>
		</div>`;
	}

	// 1. 숫자 입력창 (input)
	function createInputRow_box12cell( label, svar1 , val1, svar2, val2) {

		let stext = `
		<div class='row mb-2 align-items-center'>
			<label class='col-4 col-form-label text-muted' style='font-size: 0.85rem;'>
				${label}
			</label>
			<div class='col-4'>
				<input type='number' id='${svar1}'
					class='form-control form-control-sm text-center'
					value='${val1}' required
					onchange='fdraw_box12cell()'
					style='font-size: 0.85rem;'>
			</div>`;

		if( svar2 !== "" && svar2 !== undefined && svar2 !== null ){

			stext +=`
			<div class='col-4'>
				<input type='number' id='${svar2}'
					class='form-control form-control-sm text-center'
					value='${val2}' required
					onchange='fdraw_box12cell()'
					style='font-size: 0.85rem;'>
			</div>
		</div>`;

		}

		return stext;
	}

	// 2. 텍스트 입력창 (textarea)
	function createInputText_box12cell(id, label, val) {
		return `
		<div class='mb-3'>
			<label for='${id}' class='form-label mb-1 text-muted fw-bold' style='font-size: 0.85rem;'>
				${label}
			</label>

			<div class='w-100'>
				<textarea
					class='form-control form-control-sm'
					id='${id}'
					rows='4'
					onchange="putParams_box12cell('${id}'); fdraw_box12cell()"
					style='
						resize: none;         /* 크기 조절 불가 */
						overflow-y: auto;    /* 스크롤 가능 */
						overflow-x: auto;    /* 스크롤 가능 */
						width: 100%;         /* 너비 100% */
						white-space: pre;
						font-family: inherit; /* 일반 텍스트와 같은 폰트 사용 */
						font-size: 0.85rem;    /* 글자 크기 통일 */
						padding: 8px;         /* 내부 여백 조절 */
					'
				>${val}</textarea>
			</div>
		</div>`;
	}

	// 입력 필드에서 값을 읽어옵니다.
	function getParams_box12cell() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		// 1. aparam_b / aparam_e 객체 생성
		let aparam_b = {};
		let aparam_e = {};

		adefs_box12cell.forEach( (adef) => {
			let skey = adef[0];
			aparam_b[skey] = getValue(skey + '_s');
			aparam_e[skey] = getValue(skey + '_e');
		});

		let dseg_leng = getValue('dseg_leng');

		// 2. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		let combText_b = [
			...Object.values(aparam_b)
		].join(',');

		let combText_e = [
			...Object.values(aparam_e)
		].join(',');

		// 3. Section Type 라디오 (1 Cell / 2 Cell) — 라디오가 없으면 2셀
		let dncell = 2;
		const oncell = document.querySelector('input[name="box12cell_ncell"]:checked');
		if (oncell) dncell = Number(oncell.value) || 2;
		aparam_b.NCELL = dncell;
		aparam_e.NCELL = dncell;

		// 4. 결과 반환
		return { aparam_b, aparam_e, dseg_leng, combText_b, combText_e };
	}

	function putParams_box12cell(textareaId) {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		// 1. 엔터 키(줄바꿈)를 기준으로 첫 번째 줄(Begin)과 두 번째 줄(End) 분리
		const lines = textarea.value.split('\n');
		if (lines.length < 3) return; // 최소 세 줄이 있어야 함

		// 2. 각 줄을 쉼표(,)로 분리하여 배열 생성
		const values_b = lines[0].split(',');
		const values_e = lines[1].split(',');
		const dseg_leng = lines[2];

		// 3. 매칭될 key 리스트 (adefs_box12cell 순서와 동일)
		const keys = adefs_box12cell.map( (adef) => adef[0] );

		// 4. 각각의 input 태그에 값 할당 (_s 와 _e)
		keys.forEach((key, index) => {
			// 시작 단면 (_s) 값 넣기
			if (values_b[index] !== undefined) {
				const elS = document.getElementById(key + '_s');
				if (elS) elS.value = values_b[index].trim();
			}

			// 종료 단면 (_e) 값 넣기
			if (values_e[index] !== undefined) {
				const elE = document.getElementById(key + '_e');
				if (elE) elE.value = values_e[index].trim();
			}
		});

		if ( dseg_leng !== undefined) {
			const elE = document.getElementById( "dseg_leng" );
			if (elE) elE.value = dseg_leng;
		}

		// 5. 값이 변경된 후 도면 갱신
		if (typeof fdraw_box12cell === 'function') {
			fdraw_box12cell();
		}
	}

var _box12cell_drawData = null;

function fdraw_box12cell(){

	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;

	/*
		PLOTLY CANVAS : activate & draw
	*/

	var alayer = ['box12cell_solid', 'box12cell_hidden', 'box12cell_center'];

	// Split layout: 3D (left) + Tabbed 2D (right)
	var _container = document.getElementById(scvs_box12cell);
	_container.innerHTML = '';
	_container.style.display = 'flex';
	_container.style.gap = '2px';
	_container.style.backgroundColor = '#000';
	_container.style.height = '560px';

	var div3d = document.createElement('div');
	div3d.id = 'box12cell3d';
	div3d.style.cssText = 'width:50%;height:560px;background:#1a1a2e;';
	_container.appendChild(div3d);

	var divRight = document.createElement('div');
	divRight.style.cssText = 'width:50%;height:560px;';

	var tabBar = document.createElement('div');
	tabBar.style.cssText = 'display:flex;gap:2px;padding:4px;background:#1e293b;flex-wrap:wrap;height:34px;box-sizing:border-box;';
	var tabNames = ['Front','Back','Left','Center','Right','Top','Bottom'];
	tabNames.forEach(function(name, i) {
		var btn = document.createElement('button');
		btn.textContent = name;
		btn.id = 'box12cell_tab_' + name.toLowerCase();
		btn.style.cssText = 'padding:4px 10px;border:1px solid #475569;background:' + (i === 0 ? '#2563eb' : '#334155') + ';color:' + (i === 0 ? '#fff' : '#94a3b8') + ';cursor:pointer;border-radius:4px;font-size:11px;font-weight:600;';
		btn.onclick = function() { fdraw_box12cell_2d(name.toLowerCase()); };
		tabBar.appendChild(btn);
	});
	divRight.appendChild(tabBar);

	var viewport2d = document.createElement('div');
	viewport2d.id = 'box12cell_2dview';
	viewport2d.style.cssText = 'width:100%;height:526px;background:#000;';
	divRight.appendChild(viewport2d);
	_container.appendChild(divRight);

	// Dummy viewer (DXF-only pass, viewer calls become no-ops)
	var ocvs = { addLine: function(){}, addArc: function(){}, addLayer: function(){}, render: function(){} };

	/*
		DXF Preparation
	*/
	odxf_box12cell.init();
	odxf_box12cell.layer( alayer[0], 4, "CONTINUOUS");
	odxf_box12cell.layer( alayer[1], 4, "HIDDEN");
	odxf_box12cell.layer( alayer[2], 1, "CENTER");

	/*
		Load data
	*/
	let auserdata = getParams_box12cell();

	let aparam_b = auserdata.aparam_b;

	let aparam_e = auserdata.aparam_e;

	let dseg_leng = auserdata.dseg_leng;

	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText_b + "\n" + auserdata.combText_e  + "\n" + dseg_leng;
    }

	// Section Type 에 따라 중앙 관련 입력칸 표시/숨김
	if (typeof toggleCenterVars_box12cell === 'function') toggleCenterVars_box12cell(aparam_b.NCELL);

	// calculate box 2 cell
	let obox12cell_b = geo_box12cell( aparam_b );
	let obox12cell_e = geo_box12cell( aparam_e );

	// 변수 설명 가이드 SVG (box12cell_guide 컨테이너가 있는 페이지에서만)
	if (typeof draw_box12cell_guide === 'function' && document.getElementById('box12cell_guide')) {
		try { draw_box12cell_guide('box12cell_guide', aparam_b); }
		catch(e) { console.error('box12cell guide error:', e); }
	}

	// Store data for tab switching (before DXF pass so 2D/3D render even if DXF crashes)
	_box12cell_drawData = {
		obox12cell_b: obox12cell_b,
		obox12cell_e: obox12cell_e,
		aparam_b: aparam_b,
		aparam_e: aparam_e,
		dseg_leng: dseg_leng,
		alayer: alayer
	};

        function getPointByName(points, name) {
            const found = points.find(p => p.name === name);
            if (found) {
                // ⭐ 원본 객체의 참조를 끊고 복사본을 반환하여 원본 데이터 보호
                return { ...found[name] };
            }
            return {x: 0, y: 0};
        }
        // 1 cell 모드 등에서 존재하지 않는 점(중앙복부 관련) 라인을 건너뛰기 위한 헬퍼
        function hasPointByName(points, name) {
            return points.some(p => p.name === name);
        }

	// 전체 폭 (뷰 배치 간격 계산용)
	var dwidth_max = Math.max( aparam_b.WL + aparam_b.WR, aparam_e.WL + aparam_e.WR );

	try {

	/*
		정면도 (시작단면 → front view)
	*/
	let sview;
	let dOx_dxf;

	dOx_dxf = dwidth_max * -1.0;

	obox12cell_b.lines.forEach( (line) => {
	  ocvs.addLine('front', line.x1, line.y1, line.x2, line.y2, alayer[0] );
	  odxf_box12cell.line( line.x1 + dOx_dxf, line.y1, line.x2 + dOx_dxf, line.y2, alayer[0] );
	});
	obox12cell_b.arcs.forEach( (arc) => {
	  ocvs.addArc('front', arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	  odxf_box12cell.arc( arc.x + dOx_dxf, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	});

	/*
		배면도 (끝단면 → back view)
	*/
	dOx_dxf = dwidth_max * 1.0;

	obox12cell_e.lines.forEach( (line) => {
	  ocvs.addLine('back', line.x1, line.y1, line.x2, line.y2, alayer[0] );
	  odxf_box12cell.line( line.x1 + dOx_dxf, line.y1, line.x2 + dOx_dxf, line.y2, alayer[0] );
	});
	obox12cell_e.arcs.forEach( (arc) => {
	  ocvs.addArc('back', arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	  odxf_box12cell.arc( arc.x + dOx_dxf, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	});


	/*
			상부 평면도
	*/
        let p1, p2;

		dOx_top	= 0;
		dOy_top	= Math.max( aparam_b.TH, aparam_e.TH, dseg_leng) * 2.0;

        sview = 'top';

        // 실선 : 종방향 (중앙 및 좌우 단부)
        ["PTC", "PTL", "PTR"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.y = dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.y = dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
			odxf_box12cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );
		});

        // 실선 : 횡방향 (시작/끝 단부)
        p1 = getPointByName(obox12cell_b.points, "PTL");
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_b.points, "PTR");
        p2.y = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        p1 = getPointByName(obox12cell_e.points, "PTL");
        p1.y = dseg_leng / 2 * 1;
        p2 = getPointByName(obox12cell_e.points, "PTR");
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        // 히든 : 복부 관련 종방향
        ["PTCL1", "PTHL1", "PTHCL1", "PTHCR1", "PTHR1", "PTCR1"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.y = dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.y = dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
			odxf_box12cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );
		});


	/*
			하부 평면도
	*/

		dOx_bot	= Math.max( dwidth_max, dseg_leng ) * 4.0;
		dOy_bot	= Math.max( aparam_b.TH,  aparam_e.TH, dseg_leng ) * 2.0;

        sview = 'bottom';

        // 실선 : 종방향 (좌우 단부)
        ["PBL", "PBR"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.y = dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.y = dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
			odxf_box12cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );
		});

        // 실선 : 횡방향 (시작/끝 단부)
        p1 = getPointByName(obox12cell_b.points, "PBL");
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_b.points, "PBR");
        p2.y = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );

        p1 = getPointByName(obox12cell_e.points, "PBL");
        p1.y = dseg_leng / 2 * 1;
        p2 = getPointByName(obox12cell_e.points, "PBR");
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );

        // 히든 : 복부 관련 종방향
        ["PBHL1", "PBHCL1", "PBHCR1", "PBHR1"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.y = dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.y = dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
			odxf_box12cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[1] );
		});

	/*
			측면도 (center view) : 중앙복부 절단면
	*/

		dOx_side	= Math.max( dwidth_max, dseg_leng ) * 4.0;
		dOy_side	= 0.0;

        sview = 'center';

        //  중앙
        p1 = getPointByName(obox12cell_b.points, "PTC");
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PTC");
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox12cell_b.points, "PBC");
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PBC");
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox12cell_b.points, "PTC");
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_b.points, "PBC");
        p2.x = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox12cell_e.points, "PTC");
        p1.x = dseg_leng / 2 * 1;
        p2 = getPointByName(obox12cell_e.points, "PBC");
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        // 1 cell : 슬래브 내측선 (2셀에서는 해당 점이 없어 건너뜀)
        ["PTSC", "PBSC"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.x = dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.x = dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
			odxf_box12cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );
		});

        // 좌측 left view
        dOx = dseg_leng * -1.5;
		sview = 'left';

        p1 = getPointByName(obox12cell_b.points, "PTC");
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PTC");
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox12cell_b.points, "PBC");
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PBC");
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 시작 단부 연직선
        if( aparam_b.SLL * 1 >= 0 ){
          p1 = getPointByName(obox12cell_b.points, "PTC");
        } else {
          p1 = getPointByName(obox12cell_b.points, "PTL");
        }

        if( aparam_b.SLB * 1 >= 0 ){
          p2 = getPointByName(obox12cell_b.points, "PBL");
        } else {
          p2 = getPointByName(obox12cell_b.points, "PBC");
        }
		p1.x = dOx + dseg_leng / 2 * -1;
		p2.x = dOx + dseg_leng / 2 * -1;
		ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 끝 단부 연직선
        if( aparam_e.SLL * 1 >= 0 ){
          p1 = getPointByName(obox12cell_e.points, "PTC");
        } else {
          p1 = getPointByName(obox12cell_e.points, "PTL");
        }

        if( aparam_e.SLB * 1 >= 0 ){
          p2 = getPointByName(obox12cell_e.points, "PBL");
        } else {
          p2 = getPointByName(obox12cell_e.points, "PBC");
        }
        p1.x = dOx + dseg_leng / 2 * 1;
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 실선 : 외곽 실루엣 종방향
        ["PTL", "PTCL", "PTCL2", "PTCL1", "PBEL", "PBL"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.x = dOx + dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.x = dOx + dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
			odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
		});

        // 히든 : 좌측 셀 내부 종방향
        ["PTHL1", "PTHL3", "PTHCL1", "PBHL1", "PBHL3", "PBHCL1"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.x = dOx + dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.x = dOx + dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[1] );
			odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );
		});


        // 우측 right view
        dOx = dseg_leng * 1.5;
		sview = 'right';

        p1 = getPointByName(obox12cell_b.points, "PTC");
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PTC");
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox12cell_b.points, "PBC");
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox12cell_e.points, "PBC");
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 시작 단부 연직선
        if( aparam_b.SLR * 1 >= 0 ){
          p1 = getPointByName(obox12cell_b.points, "PTR");
        } else {
          p1 = getPointByName(obox12cell_b.points, "PTC");
        }

        if( aparam_b.SLB * 1 >= 0 ){
          p2 = getPointByName(obox12cell_b.points, "PBC");
        } else {
          p2 = getPointByName(obox12cell_b.points, "PBR");
        }
          p1.x = dOx + dseg_leng / 2 * -1;
          p2.x = dOx + dseg_leng / 2 * -1;
          ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 끝 단부 연직선
        if( aparam_e.SLR * 1 >= 0 ){
          p1 = getPointByName(obox12cell_e.points, "PTR");
        } else {
          p1 = getPointByName(obox12cell_e.points, "PTC");
        }

        if( aparam_e.SLB * 1 >= 0 ){
          p2 = getPointByName(obox12cell_e.points, "PBC");
        } else {
          p2 = getPointByName(obox12cell_e.points, "PBR");
        }
        p1.x = dOx + dseg_leng / 2 * 1;
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
		odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        // 실선 : 외곽 실루엣 종방향
        ["PTR", "PTCR", "PTCR2", "PTCR1", "PBER", "PBR"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.x = dOx + dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.x = dOx + dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[0] );
			odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
		});

        // 히든 : 우측 셀 내부 종방향
        ["PTHR1", "PTHR3", "PTHCR1", "PBHR1", "PBHR3", "PBHCR1"].forEach( (sname) => {
			if (!hasPointByName(obox12cell_b.points, sname) || !hasPointByName(obox12cell_e.points, sname)) return;
			p1 = getPointByName(obox12cell_b.points, sname);
			p1.x = dOx + dseg_leng / 2 * -1;
			p2 = getPointByName(obox12cell_e.points, sname);
			p2.x = dOx + dseg_leng / 2 * 1;
			ocvs.addLine(sview, p1.x - dOx, p1.y, p2.x - dOx, p2.y, alayer[1] );
			odxf_box12cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );
		});

	} catch(e) { console.error('box12cell DXF pass error:', e); }

	// Render 3D view (dynamically load Three.js if not available)
	function _render3d() {
		if (typeof render_box12cell_3d === 'function' && typeof THREE !== 'undefined') {
			var d = _box12cell_drawData;
			render_box12cell_3d('box12cell3d', d.obox12cell_b, d.obox12cell_e, d.dseg_leng);
			return;
		}
		var msg3d = document.getElementById('box12cell3d');
		if (msg3d) {
			msg3d.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#666;font-size:14px;">3D Loading...</div>';
		}
		var urls = [];
		if (typeof THREE === 'undefined') {
			urls.push('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
			urls.push('https://unpkg.com/three@0.128.0/examples/js/controls/OrbitControls.js');
		}
		if (typeof render_box12cell_3d !== 'function') {
			urls.push('https://macrobim.github.io/macroBIM/bim_box12cell_3d.js');
		}
		(function loadNext(i) {
			if (i >= urls.length) {
				if (typeof render_box12cell_3d === 'function') {
					var d = _box12cell_drawData;
					render_box12cell_3d('box12cell3d', d.obox12cell_b, d.obox12cell_e, d.dseg_leng);
				}
				return;
			}
			var s = document.createElement('script');
			s.src = urls[i];
			s.onload = function() { loadNext(i + 1); };
			s.onerror = function() { loadNext(i + 1); };
			document.head.appendChild(s);
		})(0);
	}
	try { _render3d(); } catch(e) { console.error('box12cell 3D render error:', e); }

	// Draw default 2D view (front)
	fdraw_box12cell_2d('front');
}

function fdraw_box12cell_2d(viewName) {
	if (!_box12cell_drawData) return;

	var data = _box12cell_drawData;
	var obox12cell_b = data.obox12cell_b;
	var obox12cell_e = data.obox12cell_e;
	var aparam_b = data.aparam_b;
	var aparam_e = data.aparam_e;
	var dseg_leng = data.dseg_leng;
	var alayer = data.alayer;

	// Update tab button styles
	['front','back','left','center','right','top','bottom'].forEach(function(name) {
		var btn = document.getElementById('box12cell_tab_' + name);
		if (!btn) return;
		if (name === viewName) {
			btn.style.background = '#2563eb';
			btn.style.color = '#fff';
			btn.style.borderColor = '#2563eb';
		} else {
			btn.style.background = '#334155';
			btn.style.color = '#94a3b8';
			btn.style.borderColor = '#475569';
		}
	});

	// Create single-view KonvaViewer
	var ocvs = new KonvaViewer('box12cell_2dview', {
		gridCols: 1,
		layout: [{ views: [viewName], span: 1 }]
	});

	ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
	ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
	ocvs.addLayer(alayer[2], 'red', 'solid', 1.5);

	function gp(points, name) {
		var found = points.find(function(p) { return p.name === name; });
		if (found) return { ...found[name] };
		return { x: 0, y: 0 };
	}

	var p1, p2;
	var half = dseg_leng / 2;

	// ── dimension setup (uniform across views) ──
	var _wmax = Math.max(aparam_b.WL + aparam_b.WR, aparam_e.WL + aparam_e.WR);
	var _ref = Math.max(aparam_b.TH, aparam_e.TH, _wmax, 100);
	var ddim_off = Math.max(50, _ref * 0.015);
	var ddim_ext = ddim_off;

	function _xsec_dims_b12c(geo, ap) {
		var PTL  = gp(geo.points, 'PTL');
		var PTC  = gp(geo.points, 'PTC');
		var PTR  = gp(geo.points, 'PTR');
		var PBL  = gp(geo.points, 'PBL');
		var PBC  = gp(geo.points, 'PBC');
		var PBR  = gp(geo.points, 'PBR');
		var PTCL1 = gp(geo.points, 'PTCL1');
		var PTCR1 = gp(geo.points, 'PTCR1');

		var ymax = Math.max(PTL.y, PTC.y, PTR.y);
		var ymin = Math.min(PBL.y, PBC.y, PBR.y);
		var xleft = Math.min(PTL.x, PBL.x);
		var xright = Math.max(PTR.x, PBR.x);

		// Total height (left side)
		ocvs.addDimLinear(viewName, xleft - ddim_off, ymin, xleft - ddim_off, ymax, ddim_ext * 6);

		// Top-edge width chain: WL / WR + web positions
		ocvs.addDimLinear(viewName, PTL.x, ymax + ddim_off, PTR.x, ymax + ddim_off, ddim_ext * 6);
		ocvs.addDimLinear(viewName, PTL.x,   ymax + ddim_off, PTCL1.x, ymax + ddim_off, ddim_ext * 3);
		ocvs.addDimLinear(viewName, PTCL1.x, ymax + ddim_off, PTC.x,   ymax + ddim_off, ddim_ext * 3);
		ocvs.addDimLinear(viewName, PTC.x,   ymax + ddim_off, PTCR1.x, ymax + ddim_off, ddim_ext * 3);
		ocvs.addDimLinear(viewName, PTCR1.x, ymax + ddim_off, PTR.x,   ymax + ddim_off, ddim_ext * 3);

		// Bottom-edge width : WBL / WBR
		ocvs.addDimLinear(viewName, PBL.x, ymin - ddim_off, PBR.x, ymin - ddim_off, ddim_ext * -6);
		ocvs.addDimLinear(viewName, PBL.x, ymin - ddim_off, PBC.x, ymin - ddim_off, ddim_ext * -3);
		ocvs.addDimLinear(viewName, PBC.x, ymin - ddim_off, PBR.x, ymin - ddim_off, ddim_ext * -3);
	}

	if (viewName === 'front') {
		obox12cell_b.lines.forEach(function(line) {
			ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]);
		});
		obox12cell_b.arcs.forEach(function(arc) {
			ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]);
		});
		_xsec_dims_b12c(obox12cell_b, aparam_b);

	} else if (viewName === 'back') {
		obox12cell_e.lines.forEach(function(line) {
			ocvs.addLine(viewName, line.x1, line.y1, line.x2, line.y2, alayer[0]);
		});
		obox12cell_e.arcs.forEach(function(arc) {
			ocvs.addArc(viewName, arc.x, arc.y, arc.r, arc.angb, arc.ange, alayer[0]);
		});
		_xsec_dims_b12c(obox12cell_e, aparam_e);

	} else if (viewName === 'top') {
		var pts_b = obox12cell_b.points;
		var pts_e = obox12cell_e.points;

		["PTC", "PTL", "PTR"].forEach(function(n) {
			p1 = gp(pts_b, n); p1.y = -half;
			p2 = gp(pts_e, n); p2.y = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);
		});

		p1 = gp(pts_b, "PTL"); p1.y = -half;
		p2 = gp(pts_b, "PTR"); p2.y = -half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_e, "PTL"); p1.y = half;
		p2 = gp(pts_e, "PTR"); p2.y = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// hidden lines
		var hiddenNames = ["PTCL1","PTHL1","PTHCL1","PTHCR1","PTHR1","PTCR1"];
		hiddenNames.forEach(function(n) {
			if (!pts_b.some(function(q){return q.name===n;}) || !pts_e.some(function(q){return q.name===n;})) return;
			p1 = gp(pts_b, n); p1.y = -half;
			p2 = gp(pts_e, n); p2.y = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[1]);
		});

		// === Top view dimensions ===
		var PTL_b = gp(pts_b, "PTL"), PTR_b = gp(pts_b, "PTR");
		var PTL_e = gp(pts_e, "PTL"), PTR_e = gp(pts_e, "PTR");
		ocvs.addDimLinear(viewName, Math.min(PTL_b.x, PTL_e.x) - ddim_off, -half,
		                            Math.min(PTL_b.x, PTL_e.x) - ddim_off,  half, ddim_ext * 6);
		ocvs.addDimLinear(viewName, PTL_b.x, -half - ddim_off, PTR_b.x, -half - ddim_off, ddim_ext * -6);
		ocvs.addDimLinear(viewName, PTL_e.x,  half + ddim_off, PTR_e.x,  half + ddim_off, ddim_ext * 6);

	} else if (viewName === 'bottom') {
		var pts_b = obox12cell_b.points;
		var pts_e = obox12cell_e.points;

		["PBL", "PBR"].forEach(function(n) {
			p1 = gp(pts_b, n); p1.y = -half;
			p2 = gp(pts_e, n); p2.y = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);
		});

		p1 = gp(pts_b, "PBL"); p1.y = -half;
		p2 = gp(pts_b, "PBR"); p2.y = -half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_e, "PBL"); p1.y = half;
		p2 = gp(pts_e, "PBR"); p2.y = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		var hiddenNames = ["PBHL1","PBHCL1","PBHCR1","PBHR1"];
		hiddenNames.forEach(function(n) {
			if (!pts_b.some(function(q){return q.name===n;}) || !pts_e.some(function(q){return q.name===n;})) return;
			p1 = gp(pts_b, n); p1.y = -half;
			p2 = gp(pts_e, n); p2.y = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[1]);
		});

		// === Bottom view dimensions ===
		var PBL_b = gp(pts_b, "PBL"), PBR_b = gp(pts_b, "PBR");
		var PBL_e = gp(pts_e, "PBL"), PBR_e = gp(pts_e, "PBR");
		ocvs.addDimLinear(viewName, Math.min(PBL_b.x, PBL_e.x) - ddim_off, -half,
		                            Math.min(PBL_b.x, PBL_e.x) - ddim_off,  half, ddim_ext * 6);
		ocvs.addDimLinear(viewName, PBL_b.x, -half - ddim_off, PBR_b.x, -half - ddim_off, ddim_ext * -6);
		ocvs.addDimLinear(viewName, PBL_e.x,  half + ddim_off, PBR_e.x,  half + ddim_off, ddim_ext * 6);

	} else if (viewName === 'center') {
		var pts_b = obox12cell_b.points;
		var pts_e = obox12cell_e.points;

		// solid outlines (중앙복부 절단면 : 전체가 콘크리트 단면)
		p1 = gp(pts_b, "PTC"); p1.x = -half;
		p2 = gp(pts_e, "PTC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_b, "PBC"); p1.x = -half;
		p2 = gp(pts_e, "PBC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_b, "PTC"); p1.x = -half;
		p2 = gp(pts_b, "PBC"); p2.x = -half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_e, "PTC"); p1.x = half;
		p2 = gp(pts_e, "PBC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// 1 cell : 슬래브 내측선 (2셀에서는 해당 점이 없어 건너뜀)
		["PTSC", "PBSC"].forEach(function(n) {
			if (!pts_b.some(function(q){return q.name===n;}) || !pts_e.some(function(q){return q.name===n;})) return;
			p1 = gp(pts_b, n); p1.x = -half;
			p2 = gp(pts_e, n); p2.x = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);
		});

		// === Center view dimensions ===
		var PTC_b = gp(pts_b, "PTC"), PBC_b = gp(pts_b, "PBC");
		var PTC_e = gp(pts_e, "PTC"), PBC_e = gp(pts_e, "PBC");
		ocvs.addDimLinear(viewName, -half, Math.max(PTC_b.y, PTC_e.y) + ddim_off,
		                             half, Math.max(PTC_b.y, PTC_e.y) + ddim_off, ddim_ext * 6);
		ocvs.addDimLinear(viewName, -half - ddim_off, PBC_b.y, -half - ddim_off, PTC_b.y, ddim_ext * 6);
		ocvs.addDimLinear(viewName,  half + ddim_off, PBC_e.y,  half + ddim_off, PTC_e.y, ddim_ext * 6);

	} else if (viewName === 'left') {
		var pts_b = obox12cell_b.points;
		var pts_e = obox12cell_e.points;

		// solid lines
		p1 = gp(pts_b, "PTC"); p1.x = -half;
		p2 = gp(pts_e, "PTC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_b, "PBC"); p1.x = -half;
		p2 = gp(pts_e, "PBC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// begin edge
		if (aparam_b.SLL * 1 >= 0) {
			p1 = gp(pts_b, "PTC");
		} else {
			p1 = gp(pts_b, "PTL");
		}
		if (aparam_b.SLB * 1 >= 0) {
			p2 = gp(pts_b, "PBL");
		} else {
			p2 = gp(pts_b, "PBC");
		}
		p1.x = -half; p2.x = -half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// end edge
		if (aparam_e.SLL * 1 >= 0) {
			p1 = gp(pts_e, "PTC");
		} else {
			p1 = gp(pts_e, "PTL");
		}
		if (aparam_e.SLB * 1 >= 0) {
			p2 = gp(pts_e, "PBL");
		} else {
			p2 = gp(pts_e, "PBC");
		}
		p1.x = half; p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		var solidNames = ["PTL","PTCL","PTCL2","PTCL1","PBEL","PBL"];
		solidNames.forEach(function(n) {
			p1 = gp(pts_b, n); p1.x = -half;
			p2 = gp(pts_e, n); p2.x = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);
		});

		var hiddenNames = ["PTHL1","PTHL3","PTHCL1","PBHL1","PBHL3","PBHCL1"];
		hiddenNames.forEach(function(n) {
			if (!pts_b.some(function(q){return q.name===n;}) || !pts_e.some(function(q){return q.name===n;})) return;
			p1 = gp(pts_b, n); p1.x = -half;
			p2 = gp(pts_e, n); p2.x = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[1]);
		});

		// === Left view dimensions ===
		var PTL_b = gp(pts_b, "PTL"), PBL_b = gp(pts_b, "PBL");
		var PTL_e = gp(pts_e, "PTL"), PBL_e = gp(pts_e, "PBL");
		ocvs.addDimLinear(viewName, -half, Math.max(PTL_b.y, PTL_e.y) + ddim_off,
		                             half, Math.max(PTL_b.y, PTL_e.y) + ddim_off, ddim_ext * 6);
		ocvs.addDimLinear(viewName, -half - ddim_off, PBL_b.y, -half - ddim_off, PTL_b.y, ddim_ext * 6);
		ocvs.addDimLinear(viewName,  half + ddim_off, PBL_e.y,  half + ddim_off, PTL_e.y, ddim_ext * 6);

	} else if (viewName === 'right') {
		var pts_b = obox12cell_b.points;
		var pts_e = obox12cell_e.points;

		p1 = gp(pts_b, "PTC"); p1.x = -half;
		p2 = gp(pts_e, "PTC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		p1 = gp(pts_b, "PBC"); p1.x = -half;
		p2 = gp(pts_e, "PBC"); p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// begin edge
		if (aparam_b.SLR * 1 >= 0) {
			p1 = gp(pts_b, "PTR");
		} else {
			p1 = gp(pts_b, "PTC");
		}
		if (aparam_b.SLB * 1 >= 0) {
			p2 = gp(pts_b, "PBC");
		} else {
			p2 = gp(pts_b, "PBR");
		}
		p1.x = -half; p2.x = -half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		// end edge
		if (aparam_e.SLR * 1 >= 0) {
			p1 = gp(pts_e, "PTR");
		} else {
			p1 = gp(pts_e, "PTC");
		}
		if (aparam_e.SLB * 1 >= 0) {
			p2 = gp(pts_e, "PBC");
		} else {
			p2 = gp(pts_e, "PBR");
		}
		p1.x = half; p2.x = half;
		ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);

		var solidNames = ["PTR","PTCR","PTCR2","PTCR1","PBER","PBR"];
		solidNames.forEach(function(n) {
			p1 = gp(pts_b, n); p1.x = -half;
			p2 = gp(pts_e, n); p2.x = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[0]);
		});

		var hiddenNames = ["PTHR1","PTHR3","PTHCR1","PBHR1","PBHR3","PBHCR1"];
		hiddenNames.forEach(function(n) {
			if (!pts_b.some(function(q){return q.name===n;}) || !pts_e.some(function(q){return q.name===n;})) return;
			p1 = gp(pts_b, n); p1.x = -half;
			p2 = gp(pts_e, n); p2.x = half;
			ocvs.addLine(viewName, p1.x, p1.y, p2.x, p2.y, alayer[1]);
		});

		// === Right view dimensions ===
		var PTR_b = gp(pts_b, "PTR"), PBR_b = gp(pts_b, "PBR");
		var PTR_e = gp(pts_e, "PTR"), PBR_e = gp(pts_e, "PBR");
		ocvs.addDimLinear(viewName, -half, Math.max(PTR_b.y, PTR_e.y) + ddim_off,
		                             half, Math.max(PTR_b.y, PTR_e.y) + ddim_off, ddim_ext * 6);
		ocvs.addDimLinear(viewName, -half - ddim_off, PBR_b.y, -half - ddim_off, PTR_b.y, ddim_ext * 6);
		ocvs.addDimLinear(viewName,  half + ddim_off, PBR_e.y,  half + ddim_off, PTR_e.y, ddim_ext * 6);
	}

	ocvs.render();
}


/*
	2 cell box 단면 좌표 계산  v000
	좌표계 : PTC = (0, 0) 기준, 좌측 -X / 우측 +X, 하부 -Y
	상부면 : y = x * SLL/100 (좌측),  y = x * SLR/100 (우측)
	하부면 : y = -TH + x * SLB/100
	중앙복부 : 연직, 두께 TWEBC (좌우면 x = ∓TWEBC/2)
	외측복부 : PTCL1~PBEL 외측선을 TWEBL, PTCR1~PBER 외측선을 TWEBR 만큼 수직 offset → 내측선
*/
function geo_box12cell( {
	// 전체
	TH, SLL, SLR, SLB,
	// 상부 폭 (좌/우)
	WL, WTL, WCAL1, WCAL2,
	WR, WTR, WCAR1, WCAR2,
	// 캔틸레버 두께 (좌/우)
	TCAL, TCAL1, TCAL2,
	TCAR, TCAR1, TCAR2,
	// 상부 슬래브 및 헌치
	TTS,
	WTHUL1,  WTHUL2,  TTHL1,  TTHL2,		// 좌측복부 상부헌치
	WTCHUL1, WTCHUL2, TTHCL1, TTHCL2,		// 중앙복부 좌측 상부헌치
	WTCHUR1, WTCHUR2, TTHCR1, TTHCR2,		// 중앙복부 우측 상부헌치
	WTHUR1,  WTHUR2,  TTHR1,  TTHR2,		// 우측복부 상부헌치
	// 복부 두께 (좌측 / 중앙 / 우측)
	TWEBL, TWEBC, TWEBR,
	// 하부
	WBL, WBR, TBEL, TBER, TBS,
	WBHL1,  WBHL2,  TBHL1,  TBHL2,			// 좌측복부 하부헌치
	WBHCL1, WBHCL2, TBHCL1, TBHCL2,			// 중앙복부 좌측 하부헌치
	WBHCR1, WBHCR2, TBHCR1, TBHCR2,			// 중앙복부 우측 하부헌치
	WBHR1,  WBHR2,  TBHR1,  TBHR2,			// 우측복부 하부헌치
	// 필렛 (0 = 미적용)
	R_WTL, R_WTR, R_WTIL, R_WTIR, R_WBL, R_WBR,
	// 셀 수 (1 = 중앙복부 없는 단일 셀, 생략/2 = 2셀)
	NCELL
} ){

	let dx, dy;
	let p1 = {x:0, y:0};
	let p2 = {x:0, y:0};
	let p3 = {x:0, y:0};
	let p4 = {x:0, y:0};

	let opts   = [];	// 치수선 출력을 위한 좌표
	let olines = [];	// 좌표 및 실선/히든
	let oarcs  = [];

	/*
		기준점
	*/
	// 1 cell 모드 : 중앙 복부/헌치를 생략하고 슬래브 내측선이 중앙점에서 꺾인다
	let bTwoCell = (NCELL === undefined || Number(NCELL) !== 1);

	let PTC = {x: 0, y: 0};
		opts.push({PTC, name:"PTC"});
	let PBC = {x: 0, y: -TH};
		opts.push({PBC, name:"PBC"});

	// 1 cell : 슬래브 내측 중앙점
	let PTSC = {x: 0, y: -TTS};
	let PBSC = {x: 0, y: -TH + TBS};
	if( !bTwoCell ){
		opts.push({PTSC, name:"PTSC"});
		opts.push({PBSC, name:"PBSC"});
	}

	/*
		좌측 캔틸레버
	*/
	let PTL = {x: -WL, y: -WL * SLL / 100 };
		opts.push({PTL, name:"PTL"});
	let PTCL = {x: PTL.x, y: PTL.y - TCAL };
		opts.push({PTCL, name:"PTCL"});

	dx = -(WTL + WCAL1 + WCAL2);
	let PTCL3 = {x: dx, y: dx * SLL / 100 - TCAL };
		opts.push({PTCL3, name:"PTCL3"});
	dx = -(WTL + WCAL1);
	let PTCL2 = {x: dx, y: dx * SLL / 100 - TCAL2 };
		opts.push({PTCL2, name:"PTCL2"});
	dx = -WTL;
	let PTCL1 = {x: dx, y: dx * SLL / 100 - TCAL1 };
		opts.push({PTCL1, name:"PTCL1"});

	/*
		우측 캔틸레버
	*/
	let PTR = {x: WR, y: WR * SLR / 100 };
		opts.push({PTR, name:"PTR"});
	let PTCR = {x: PTR.x, y: PTR.y - TCAR };
		opts.push({PTCR, name:"PTCR"});

	dx = WTR + WCAR1 + WCAR2;
	let PTCR3 = {x: dx, y: dx * SLR / 100 - TCAR };
		opts.push({PTCR3, name:"PTCR3"});
	dx = WTR + WCAR1;
	let PTCR2 = {x: dx, y: dx * SLR / 100 - TCAR2 };
		opts.push({PTCR2, name:"PTCR2"});
	dx = WTR;
	let PTCR1 = {x: dx, y: dx * SLR / 100 - TCAR1 };
		opts.push({PTCR1, name:"PTCR1"});

	/*
		좌측 하부
	*/
	let PBL = {x: -WBL, y: -TH - WBL * SLB / 100 };
		opts.push({PBL, name:"PBL"});
	let PBEL = {x: PBL.x, y: PBL.y + TBEL };
		opts.push({PBEL, name:"PBEL"});

	/*
		우측 하부
	*/
	let PBR = {x: WBR, y: -TH + WBR * SLB / 100 };
		opts.push({PBR, name:"PBR"});
	let PBER = {x: PBR.x, y: PBR.y + TBER };
		opts.push({PBER, name:"PBER"});

	/*
		외측 복부 내측선 계산
		(좌측 외측선 PTCL1-PBEL 을 TWEBL, 우측 외측선 PTCR1-PBER 을 TWEBR 만큼 offset)
	*/
	let lwebl, lwebr;

	if( PTCL1.x >= PBEL.x ){
		lwebl = geo_offset( PTCL1, PBEL, -TWEBL);
	}else{
		lwebl = geo_offset( PTCL1, PBEL, TWEBL);
	}
	if( PTCR1.x >= PBER.x ){
		lwebr = geo_offset( PBER, PTCR1, TWEBR);
	}else{
		lwebr = geo_offset( PBER, PTCR1, -TWEBR);
	}

	/*
		좌측 셀 - 상부 헌치 (좌측복부측)
		PTHL1 : 복부내측선과 (상부면 - TTHL1) 평행선의 교점
	*/
	p1.x = lwebl.x1;	p1.y = lwebl.y1;
	p2.x = lwebl.x2;	p2.y = lwebl.y2;
	p3.x = -WTL;		p3.y = -WTL * SLL / 100 - TTHL1;
	p4.x = 0;			p4.y = -TTHL1;
	let PTHL1 = geo_intersect( p1, p2, p3, p4 );
		opts.push({PTHL1, name:"PTHL1"});

	dx = PTHL1.x + WTHUL1;
	let PTHL2 = {x: dx, y: dx * SLL / 100 - TTHL2 };
		opts.push({PTHL2, name:"PTHL2"});
	dx = PTHL2.x + WTHUL2;
	let PTHL3 = {x: dx, y: dx * SLL / 100 - TTS };
		opts.push({PTHL3, name:"PTHL3"});

	/*
		좌측 셀 - 상부 헌치 (중앙복부측, 중앙복부 좌측면 x = -TWEBC/2)
	*/
	dx = -TWEBC / 2;
	let PTHCL1 = {x: dx, y: dx * SLL / 100 - TTHCL1 };
		if (bTwoCell) opts.push({PTHCL1, name:"PTHCL1"});
	dx = PTHCL1.x - WTCHUL1;
	let PTHCL2 = {x: dx, y: dx * SLL / 100 - TTHCL2 };
		if (bTwoCell) opts.push({PTHCL2, name:"PTHCL2"});
	dx = PTHCL2.x - WTCHUL2;
	let PTHCL3 = {x: dx, y: dx * SLL / 100 - TTS };
		if (bTwoCell) opts.push({PTHCL3, name:"PTHCL3"});

	/*
		우측 셀 - 상부 헌치 (중앙복부측, 중앙복부 우측면 x = +TWEBC/2)
	*/
	dx = TWEBC / 2;
	let PTHCR1 = {x: dx, y: dx * SLR / 100 - TTHCR1 };
		if (bTwoCell) opts.push({PTHCR1, name:"PTHCR1"});
	dx = PTHCR1.x + WTCHUR1;
	let PTHCR2 = {x: dx, y: dx * SLR / 100 - TTHCR2 };
		if (bTwoCell) opts.push({PTHCR2, name:"PTHCR2"});
	dx = PTHCR2.x + WTCHUR2;
	let PTHCR3 = {x: dx, y: dx * SLR / 100 - TTS };
		if (bTwoCell) opts.push({PTHCR3, name:"PTHCR3"});

	/*
		우측 셀 - 상부 헌치 (우측복부측)
	*/
	p1.x = lwebr.x1;	p1.y = lwebr.y1;
	p2.x = lwebr.x2;	p2.y = lwebr.y2;
	p3.x = 0;			p3.y = -TTHR1;
	p4.x = WTR;			p4.y = WTR * SLR / 100 - TTHR1;
	let PTHR1 = geo_intersect( p1, p2, p3, p4 );
		opts.push({PTHR1, name:"PTHR1"});

	dx = PTHR1.x - WTHUR1;
	let PTHR2 = {x: dx, y: dx * SLR / 100 - TTHR2 };
		opts.push({PTHR2, name:"PTHR2"});
	dx = PTHR2.x - WTHUR2;
	let PTHR3 = {x: dx, y: dx * SLR / 100 - TTS };
		opts.push({PTHR3, name:"PTHR3"});

	/*
		1 cell : 상부슬래브 하면은 중앙(PTSC)에서 꺾이지 않는 한 직선이어야 한다
		· 크라운(SLR <= SLL) : PTHL3-PTHR3 를 직선 연결 → 중앙 두께가 TTS 보다 커짐
		· 밸리(SLR > SLL)   : |슬로프|가 작은 쪽 상부면에 평행한 하면선(두께 TTS)으로 통일
		                      → 완만한 쪽·중앙 두께 = TTS, 가파른 쪽 두께는 커짐
	*/
	if( !bTwoCell ){
		if( SLR * 1 > SLL * 1 ){
			let dslf = (Math.abs(SLL) <= Math.abs(SLR)) ? SLL : SLR;
			PTHL3.y = PTHL3.x * dslf / 100 - TTS;
			PTHR3.y = PTHR3.x * dslf / 100 - TTS;
			PTSC.y  = -TTS;
		}else{
			PTSC.y = PTHL3.y + (PTHR3.y - PTHL3.y) * (0 - PTHL3.x) / ((PTHR3.x - PTHL3.x) || 1e-9);
		}
	}

	/*
		좌측 셀 - 하부 헌치 (좌측복부측)
		PBHL1 : 복부내측선과 (하부면 + TBHL1) 평행선의 교점
	*/
	p1.x = lwebl.x1;	p1.y = lwebl.y1;
	p2.x = lwebl.x2;	p2.y = lwebl.y2;
	p3.x = -WBL;		p3.y = -TH - WBL * SLB / 100 + TBHL1;
	p4.x = 0;			p4.y = -TH + TBHL1;
	let PBHL1 = geo_intersect( p1, p2, p3, p4 );
		opts.push({PBHL1, name:"PBHL1"});

	dx = PBHL1.x + WBHL1;
	let PBHL2 = {x: dx, y: -TH + dx * SLB / 100 + TBHL2 };
		opts.push({PBHL2, name:"PBHL2"});
	dx = PBHL2.x + WBHL2;
	let PBHL3 = {x: dx, y: -TH + dx * SLB / 100 + TBS };
		opts.push({PBHL3, name:"PBHL3"});

	/*
		좌측 셀 - 하부 헌치 (중앙복부측)
	*/
	dx = -TWEBC / 2;
	let PBHCL1 = {x: dx, y: -TH + dx * SLB / 100 + TBHCL1 };
		if (bTwoCell) opts.push({PBHCL1, name:"PBHCL1"});
	dx = PBHCL1.x - WBHCL1;
	let PBHCL2 = {x: dx, y: -TH + dx * SLB / 100 + TBHCL2 };
		if (bTwoCell) opts.push({PBHCL2, name:"PBHCL2"});
	dx = PBHCL2.x - WBHCL2;
	let PBHCL3 = {x: dx, y: -TH + dx * SLB / 100 + TBS };
		if (bTwoCell) opts.push({PBHCL3, name:"PBHCL3"});

	/*
		우측 셀 - 하부 헌치 (중앙복부측)
	*/
	dx = TWEBC / 2;
	let PBHCR1 = {x: dx, y: -TH + dx * SLB / 100 + TBHCR1 };
		if (bTwoCell) opts.push({PBHCR1, name:"PBHCR1"});
	dx = PBHCR1.x + WBHCR1;
	let PBHCR2 = {x: dx, y: -TH + dx * SLB / 100 + TBHCR2 };
		if (bTwoCell) opts.push({PBHCR2, name:"PBHCR2"});
	dx = PBHCR2.x + WBHCR2;
	let PBHCR3 = {x: dx, y: -TH + dx * SLB / 100 + TBS };
		if (bTwoCell) opts.push({PBHCR3, name:"PBHCR3"});

	/*
		우측 셀 - 하부 헌치 (우측복부측)
	*/
	p1.x = lwebr.x1;	p1.y = lwebr.y1;
	p2.x = lwebr.x2;	p2.y = lwebr.y2;
	p3.x = 0;			p3.y = -TH + TBHR1;
	p4.x = WBR;			p4.y = -TH + WBR * SLB / 100 + TBHR1;
	let PBHR1 = geo_intersect( p1, p2, p3, p4 );
		opts.push({PBHR1, name:"PBHR1"});

	dx = PBHR1.x - WBHR1;
	let PBHR2 = {x: dx, y: -TH + dx * SLB / 100 + TBHR2 };
		opts.push({PBHR2, name:"PBHR2"});
	dx = PBHR2.x - WBHR2;
	let PBHR3 = {x: dx, y: -TH + dx * SLB / 100 + TBS };
		opts.push({PBHR3, name:"PBHR3"});

	/*
		필렛 계산 (반경 0 이면 모서리점 그대로 사용)
	*/
	let PFWTLB,  PFWTLE,  PFWTRB,  PFWTRE;		// 외측복부 상단 (R_WTL, R_WTR)
	let PFWBLB,  PFWBLE,  PFWBRB,  PFWBRE;		// 외측복부 하단 (R_WBL, R_WBR)
	let PFWTILB, PFWTILE, PFWTIRB, PFWTIRE;		// 복부 내측 상단 (R_WTIL, R_WTIR)

	// 인접점이 겹치는 퇴화 형상(TBEL=0 등)에서는 필렛을 생략해 NaN 을 방지
	function fillet_safe(p1, p2, p3, r){
		if( r === 0 ) return null;
		if( geo_length(p1, p2) < 1e-9 || geo_length(p3, p2) < 1e-9 ) return null;
		return geo_fillet(p1, p2, p3, r);
	}

	let filwtl = fillet_safe( PTCL2, PTCL1, PBEL, R_WTL );
	if( filwtl ){
		oarcs.push({ x:filwtl.ox, y:filwtl.oy, r:filwtl.r, angb:filwtl.angb, ange:filwtl.ange });
		PFWTLB = {x: filwtl.xb, y: filwtl.yb };
		PFWTLE = {x: filwtl.xe, y: filwtl.ye };
	}else{
		PFWTLB = {x: PTCL1.x, y: PTCL1.y };
		PFWTLE = {x: PTCL1.x, y: PTCL1.y };
	}

	let filwtr = fillet_safe( PTCR2, PTCR1, PBER, R_WTR );
	if( filwtr ){
		oarcs.push({ x:filwtr.ox, y:filwtr.oy, r:filwtr.r, angb:filwtr.angb, ange:filwtr.ange });
		PFWTRB = {x: filwtr.xb, y: filwtr.yb };
		PFWTRE = {x: filwtr.xe, y: filwtr.ye };
	}else{
		PFWTRB = {x: PTCR1.x, y: PTCR1.y };
		PFWTRE = {x: PTCR1.x, y: PTCR1.y };
	}

	// TBEL=0 이면 PBEL==PBL 이므로 하부 모서리 필렛의 세 번째 점은 하부면(PBC) 방향으로 잡는다
	let filwbl = fillet_safe( PTCL1, PBEL, (TBEL > 0 ? PBL : PBC), R_WBL );
	if( filwbl ){
		oarcs.push({ x:filwbl.ox, y:filwbl.oy, r:filwbl.r, angb:filwbl.angb, ange:filwbl.ange });
		PFWBLB = {x: filwbl.xb, y: filwbl.yb };
		PFWBLE = {x: filwbl.xe, y: filwbl.ye };
	}else{
		PFWBLB = {x: PBEL.x, y: PBEL.y };
		PFWBLE = {x: PBEL.x, y: PBEL.y };
	}

	let filwbr = fillet_safe( PTCR1, PBER, (TBER > 0 ? PBR : PBC), R_WBR );
	if( filwbr ){
		oarcs.push({ x:filwbr.ox, y:filwbr.oy, r:filwbr.r, angb:filwbr.angb, ange:filwbr.ange });
		PFWBRB = {x: filwbr.xb, y: filwbr.yb };
		PFWBRE = {x: filwbr.xe, y: filwbr.ye };
	}else{
		PFWBRB = {x: PBER.x, y: PBER.y };
		PFWBRE = {x: PBER.x, y: PBER.y };
	}

	let filwtil = fillet_safe( PTHL2, PTHL1, PBHL1, R_WTIL );
	if( filwtil ){
		oarcs.push({ x:filwtil.ox, y:filwtil.oy, r:filwtil.r, angb:filwtil.angb, ange:filwtil.ange });
		PFWTILB = {x: filwtil.xb, y: filwtil.yb };
		PFWTILE = {x: filwtil.xe, y: filwtil.ye };
	}else{
		PFWTILB = {x: PTHL1.x, y: PTHL1.y };
		PFWTILE = {x: PTHL1.x, y: PTHL1.y };
	}

	let filwtir = fillet_safe( PTHR2, PTHR1, PBHR1, R_WTIR );
	if( filwtir ){
		oarcs.push({ x:filwtir.ox, y:filwtir.oy, r:filwtir.r, angb:filwtir.angb, ange:filwtir.ange });
		PFWTIRB = {x: filwtir.xb, y: filwtir.yb };
		PFWTIRE = {x: filwtir.xe, y: filwtir.ye };
	}else{
		PFWTIRB = {x: PTHR1.x, y: PTHR1.y };
		PFWTIRE = {x: PTHR1.x, y: PTHR1.y };
	}

	/*
		외곽선
	*/
	olines.push({ x1: PTL.x,    y1: PTL.y,    x2: PTC.x,    y2: PTC.y    });	// 상부면 좌
	olines.push({ x1: PTC.x,    y1: PTC.y,    x2: PTR.x,    y2: PTR.y    });	// 상부면 우
	olines.push({ x1: PTL.x,    y1: PTL.y,    x2: PTCL.x,   y2: PTCL.y   });	// 좌측 단부
	olines.push({ x1: PTCL.x,   y1: PTCL.y,   x2: PTCL3.x,  y2: PTCL3.y  });	// 좌측 캔틸레버 하면
	olines.push({ x1: PTCL3.x,  y1: PTCL3.y,  x2: PTCL2.x,  y2: PTCL2.y  });
	olines.push({ x1: PTCL2.x,  y1: PTCL2.y,  x2: PFWTLB.x, y2: PFWTLB.y });
	olines.push({ x1: PFWTLE.x, y1: PFWTLE.y, x2: PFWBLB.x, y2: PFWBLB.y });	// 좌측복부 외측면
	if( TBEL > 0 ){
		olines.push({ x1: PFWBLE.x, y1: PFWBLE.y, x2: PBL.x, y2: PBL.y });		// 좌측 하부 연직단
		olines.push({ x1: PBL.x, y1: PBL.y, x2: PBC.x, y2: PBC.y });			// 하부면 좌
	}else{
		olines.push({ x1: PFWBLE.x, y1: PFWBLE.y, x2: PBC.x, y2: PBC.y });		// 하부면 좌 (연직단 없음)
	}
	if( TBER > 0 ){
		olines.push({ x1: PBC.x, y1: PBC.y, x2: PBR.x, y2: PBR.y });			// 하부면 우
		olines.push({ x1: PBR.x, y1: PBR.y, x2: PFWBRE.x, y2: PFWBRE.y });		// 우측 하부 연직단
	}else{
		olines.push({ x1: PBC.x, y1: PBC.y, x2: PFWBRE.x, y2: PFWBRE.y });		// 하부면 우 (연직단 없음)
	}
	olines.push({ x1: PFWBRB.x, y1: PFWBRB.y, x2: PFWTRE.x, y2: PFWTRE.y });	// 우측복부 외측면
	olines.push({ x1: PFWTRB.x, y1: PFWTRB.y, x2: PTCR2.x,  y2: PTCR2.y  });	// 우측 캔틸레버 하면
	olines.push({ x1: PTCR2.x,  y1: PTCR2.y,  x2: PTCR3.x,  y2: PTCR3.y  });
	olines.push({ x1: PTCR3.x,  y1: PTCR3.y,  x2: PTCR.x,   y2: PTCR.y   });
	olines.push({ x1: PTCR.x,   y1: PTCR.y,   x2: PTR.x,    y2: PTR.y    });	// 우측 단부

	if( !bTwoCell ){
	/*
		단일 셀 내측선 (중앙 복부/헌치 없음)
	*/
	olines.push({ x1: PTSC.x,    y1: PTSC.y,    x2: PTHL3.x,   y2: PTHL3.y   });	// 상부슬래브 하면 좌
	olines.push({ x1: PTHL3.x,   y1: PTHL3.y,   x2: PTHL2.x,   y2: PTHL2.y   });
	olines.push({ x1: PTHL2.x,   y1: PTHL2.y,   x2: PFWTILB.x, y2: PFWTILB.y });
	olines.push({ x1: PFWTILE.x, y1: PFWTILE.y, x2: PBHL1.x,   y2: PBHL1.y   });	// 좌측복부 내측면
	olines.push({ x1: PBHL1.x,   y1: PBHL1.y,   x2: PBHL2.x,   y2: PBHL2.y   });
	olines.push({ x1: PBHL2.x,   y1: PBHL2.y,   x2: PBHL3.x,   y2: PBHL3.y   });
	olines.push({ x1: PBHL3.x,   y1: PBHL3.y,   x2: PBSC.x,    y2: PBSC.y    });	// 하부슬래브 상면 좌
	olines.push({ x1: PBSC.x,    y1: PBSC.y,    x2: PBHR3.x,   y2: PBHR3.y   });	// 하부슬래브 상면 우
	olines.push({ x1: PBHR3.x,   y1: PBHR3.y,   x2: PBHR2.x,   y2: PBHR2.y   });
	olines.push({ x1: PBHR2.x,   y1: PBHR2.y,   x2: PBHR1.x,   y2: PBHR1.y   });
	olines.push({ x1: PBHR1.x,   y1: PBHR1.y,   x2: PFWTIRE.x, y2: PFWTIRE.y });	// 우측복부 내측면
	olines.push({ x1: PFWTIRB.x, y1: PFWTIRB.y, x2: PTHR2.x,   y2: PTHR2.y   });
	olines.push({ x1: PTHR2.x,   y1: PTHR2.y,   x2: PTHR3.x,   y2: PTHR3.y   });
	olines.push({ x1: PTHR3.x,   y1: PTHR3.y,   x2: PTSC.x,    y2: PTSC.y    });	// 상부슬래브 하면 우

	}else{

	/*
		좌측 셀 내측선
	*/
	olines.push({ x1: PTHCL3.x,  y1: PTHCL3.y,  x2: PTHL3.x,   y2: PTHL3.y   });	// 상부슬래브 하면
	olines.push({ x1: PTHL3.x,   y1: PTHL3.y,   x2: PTHL2.x,   y2: PTHL2.y   });
	olines.push({ x1: PTHL2.x,   y1: PTHL2.y,   x2: PFWTILB.x, y2: PFWTILB.y });
	olines.push({ x1: PFWTILE.x, y1: PFWTILE.y, x2: PBHL1.x,   y2: PBHL1.y   });	// 좌측복부 내측면
	olines.push({ x1: PBHL1.x,   y1: PBHL1.y,   x2: PBHL2.x,   y2: PBHL2.y   });
	olines.push({ x1: PBHL2.x,   y1: PBHL2.y,   x2: PBHL3.x,   y2: PBHL3.y   });
	olines.push({ x1: PBHL3.x,   y1: PBHL3.y,   x2: PBHCL3.x,  y2: PBHCL3.y  });	// 하부슬래브 상면
	olines.push({ x1: PBHCL3.x,  y1: PBHCL3.y,  x2: PBHCL2.x,  y2: PBHCL2.y  });
	olines.push({ x1: PBHCL2.x,  y1: PBHCL2.y,  x2: PBHCL1.x,  y2: PBHCL1.y  });
	olines.push({ x1: PBHCL1.x,  y1: PBHCL1.y,  x2: PTHCL1.x,  y2: PTHCL1.y  });	// 중앙복부 좌측면
	olines.push({ x1: PTHCL1.x,  y1: PTHCL1.y,  x2: PTHCL2.x,  y2: PTHCL2.y  });
	olines.push({ x1: PTHCL2.x,  y1: PTHCL2.y,  x2: PTHCL3.x,  y2: PTHCL3.y  });

	/*
		우측 셀 내측선
	*/
	olines.push({ x1: PTHCR3.x,  y1: PTHCR3.y,  x2: PTHR3.x,   y2: PTHR3.y   });	// 상부슬래브 하면
	olines.push({ x1: PTHR3.x,   y1: PTHR3.y,   x2: PTHR2.x,   y2: PTHR2.y   });
	olines.push({ x1: PTHR2.x,   y1: PTHR2.y,   x2: PFWTIRB.x, y2: PFWTIRB.y });
	olines.push({ x1: PFWTIRE.x, y1: PFWTIRE.y, x2: PBHR1.x,   y2: PBHR1.y   });	// 우측복부 내측면
	olines.push({ x1: PBHR1.x,   y1: PBHR1.y,   x2: PBHR2.x,   y2: PBHR2.y   });
	olines.push({ x1: PBHR2.x,   y1: PBHR2.y,   x2: PBHR3.x,   y2: PBHR3.y   });
	olines.push({ x1: PBHR3.x,   y1: PBHR3.y,   x2: PBHCR3.x,  y2: PBHCR3.y  });	// 하부슬래브 상면
	olines.push({ x1: PBHCR3.x,  y1: PBHCR3.y,  x2: PBHCR2.x,  y2: PBHCR2.y  });
	olines.push({ x1: PBHCR2.x,  y1: PBHCR2.y,  x2: PBHCR1.x,  y2: PBHCR1.y  });
	olines.push({ x1: PBHCR1.x,  y1: PBHCR1.y,  x2: PTHCR1.x,  y2: PTHCR1.y  });	// 중앙복부 우측면
	olines.push({ x1: PTHCR1.x,  y1: PTHCR1.y,  x2: PTHCR2.x,  y2: PTHCR2.y  });
	olines.push({ x1: PTHCR2.x,  y1: PTHCR2.y,  x2: PTHCR3.x,  y2: PTHCR3.y  });

	}

	return {
		points: opts,
		lines: olines,
		arcs: oarcs
	};

}

/*
	변수 설명 가이드 — 공용 드로잉 코어(window.RWSVG, bim_draw_test_core.js) 사용
	· bim_pier_test.js 의 ELEVATION 과 동일한 룩 : 흰 그리드 배경, 잉크 외곽선,
	  파란 치수선("이름=값" 자동 표기), 줌(휠)/팬(드래그)
	· fdraw_box12cell() 에서 매 재작도마다 호출되어 현재 입력값이 즉시 반영됨
*/
function draw_box12cell_guide( sdivid, ap ){

	var odiv = document.getElementById(sdivid);
	if (!odiv) return;

	// 공용 코어가 아직 없으면 로드 후 재시도 (단독 사용 대비)
	if (typeof window.RWSVG === 'undefined') {
		if (!draw_box12cell_guide._loading) {
			draw_box12cell_guide._loading = true;
			var sc = document.createElement('script');
			sc.src = 'https://macrobim.github.io/macroBIM/bim_draw_test_core.js';
			sc.onload = function(){ draw_box12cell_guide(sdivid, ap); };
			document.head.appendChild(sc);
		}
		return;
	}

	var o = geo_box12cell(ap);
	var P = {};
	o.points.forEach(function(op){ P[op.name] = op[op.name]; });

	var xmin = Math.min(P.PTL.x, P.PBL.x), xmax = Math.max(P.PTR.x, P.PBR.x);
	var ytop = Math.max(P.PTL.y, P.PTC.y, P.PTR.y);
	var ybot = Math.min(P.PBL.y, P.PBC.y, P.PBR.y);
	var S = Math.max(xmax - xmin, ytop - ybot);

	var rec = new window.RWSVG.MockViewer();
	rec.addLayer('c', 'cyan', 'solid', 1);
	rec.addLayer('h', 'gray', 'hidden', 1);

	// ── 단면 외곽 (직선 + 실제 아크) ──
	o.lines.forEach(function(l){ rec.addLine(0, l.x1, l.y1, l.x2, l.y2, 'c'); });
	o.arcs.forEach(function(a){ rec.addArc(0, a.x, a.y, a.r, a.angb, a.ange, 'c'); });

	// ── 헬퍼 ──
	function ytopf(x){ return x * (x <= 0 ? ap.SLL : ap.SLR) / 100; }
	function ybotf(x){ return -ap.TH + x * ap.SLB / 100; }
	function dimH(x1, x2, yat, gut, label, lp){
		if (x2 < x1){ var t = x1; x1 = x2; x2 = t; }
		rec.addDimLinear(0, x1, yat, x2, yat, gut - yat, label, { lp: lp || 0 });
	}
	function dimV(x, ya, yb, gut, label, lp){
		rec.addDimLinear(0, x, Math.min(ya, yb), x, Math.max(ya, yb), x - gut, label, { lp: lp || 0 });
	}
	// 두께 치수 : 해당 점 x 에서 표면선~점 사이를 gap 0 으로 직접 표기 (라벨은 선에 나란히 회전)
	function thk(x, ya, yb, label){
		rec.addDimLinear(0, x, Math.min(ya, yb), x, Math.max(ya, yb), 0, label);
	}
	// 슬래브 하면 점의 두께가 TTS 와 같을 때만 'TTS' 라벨 (1 cell 하면 보정으로 커진 곳은 값만)
	function ttsLbl(pt){
		return (Math.abs((ytopf(pt.x) - pt.y) - ap.TTS) < 0.5) ? 'TTS' : '';
	}

	// ── 상부 치수행 (안쪽부터 헌치폭 → 캔틸레버/복부폭 → 전폭) ──
	var g1 = ytop + S*0.05, g2 = ytop + S*0.10, g3 = ytop + S*0.15;

	var two = !!P.PTHCL1;		// 1 cell 모드에서는 중앙복부 관련 점이 등록되지 않음

	dimH(P.PTHL1.x,  P.PTHL2.x,  ytop, g1, 'WTHUL1');
	dimH(P.PTHL2.x,  P.PTHL3.x,  ytop, g1, 'WTHUL2', 14);
	if (two){
		dimH(P.PTHCL3.x, P.PTHCL2.x, ytop, g1, 'WTCHUL2', 14);
		dimH(P.PTHCL2.x, P.PTHCL1.x, ytop, g1, 'WTCHUL1');
		dimH(P.PTHCR1.x, P.PTHCR2.x, ytop, g1, 'WTCHUR1', 28);
		dimH(P.PTHCR2.x, P.PTHCR3.x, ytop, g1, 'WTCHUR2', 14);
	}
	dimH(P.PTHR3.x,  P.PTHR2.x,  ytop, g1, 'WTHUR2', 14);
	dimH(P.PTHR2.x,  P.PTHR1.x,  ytop, g1, 'WTHUR1');

	dimH(P.PTCL3.x, P.PTCL2.x, ytop, g2, 'WCAL2', 14);
	dimH(P.PTCL2.x, P.PTCL1.x, ytop, g2, 'WCAL1');
	dimH(P.PTCL1.x, 0,         ytop, g2, 'WTL');
	dimH(0,         P.PTCR1.x, ytop, g2, 'WTR');
	dimH(P.PTCR1.x, P.PTCR2.x, ytop, g2, 'WCAR1');
	dimH(P.PTCR2.x, P.PTCR3.x, ytop, g2, 'WCAR2', 14);

	dimH(P.PTL.x, 0,       ytop, g3, 'WL');
	dimH(0,       P.PTR.x, ytop, g3, 'WR');

	// ── 하부 폭 ──
	var gb = ybot - S*0.05;
	dimH(P.PBL.x, 0,       ybot, gb, 'WBL');
	dimH(0,       P.PBR.x, ybot, gb, 'WBR');

	// ── 전체 높이 / 단부 두께 ──
	dimV(xmax,    0,        -ap.TH,   xmax + S*0.085, 'TH');
	dimV(P.PTL.x, P.PTL.y,  P.PTCL.y, xmin - S*0.04,  'TCAL');
	dimV(P.PTR.x, P.PTR.y,  P.PTCR.y, xmax + S*0.04,  'TCAR');
	dimV(P.PBL.x, P.PBEL.y, P.PBL.y,  P.PBL.x - S*0.035, 'TBEL');
	dimV(P.PBR.x, P.PBER.y, P.PBR.y,  P.PBR.x + S*0.035, 'TBER');

	// ── 상부 두께 (상부면 → 각 점) ──
	[
		[P.PTCL1, 'TCAL1'], [P.PTCL2, 'TCAL2'],
		[P.PTHL1, 'TTHL1'], [P.PTHL2, 'TTHL2'], [P.PTHL3, ttsLbl(P.PTHL3)],
		[P.PTHCL2, 'TTHCL2'], [P.PTHCL1, 'TTHCL1'], [P.PTHCL3, 'TTS'],
		[P.PTHCR2, 'TTHCR2'], [P.PTHCR1, 'TTHCR1'], [P.PTHCR3, 'TTS'],
		[P.PTHR1, 'TTHR1'], [P.PTHR2, 'TTHR2'], [P.PTHR3, ttsLbl(P.PTHR3)],
		[P.PTCR1, 'TCAR1'], [P.PTCR2, 'TCAR2']
	].forEach(function(d){ if (!d[0]) return; thk(d[0].x, ytopf(d[0].x), d[0].y, d[1]); });
	if (P.PTSC) thk(0, 0, P.PTSC.y, (Math.abs(-P.PTSC.y - ap.TTS) < 0.5) ? 'TTS' : '');	// 1 cell : 슬래브 중앙 두께 (TTS 초과시 값만)

	// ── 하부 두께 (하부면 → 각 점) ──
	[
		[P.PBHL1, 'TBHL1'], [P.PBHL2, 'TBHL2'], [P.PBHL3, 'TBS'],
		[P.PBHCL2, 'TBHCL2'], [P.PBHCL1, 'TBHCL1'], [P.PBHCL3, 'TBS'],
		[P.PBHCR2, 'TBHCR2'], [P.PBHCR1, 'TBHCR1'], [P.PBHCR3, 'TBS'],
		[P.PBHR1, 'TBHR1'], [P.PBHR2, 'TBHR2'], [P.PBHR3, 'TBS']
	].forEach(function(d){ if (!d[0]) return; thk(d[0].x, d[0].y, ybotf(d[0].x), d[1]); });
	if (P.PBSC) thk(0, P.PBSC.y, ybotf(0), 'TBS');	// 1 cell : 하부슬래브 중앙 두께

	// ── 복부 두께 : 경사복부는 내측선 중앙점에서 외측선으로의 수선 → 측정값이 정확히 TWEBL/TWEBR ──
	function webDim(O1, O2, I1, I2, label){
		var dx = O2.x - O1.x, dy = O2.y - O1.y, dl = Math.hypot(dx, dy) || 1;
		var nx = -dy / dl, ny = dx / dl;					// 외측선의 단위 법선
		var pm = { x: (I1.x + I2.x) / 2, y: (I1.y + I2.y) / 2 };	// 내측선 중앙점
		var dist = (pm.x - O1.x) * nx + (pm.y - O1.y) * ny;	// 수직 거리 = 복부 두께
		var q = { x: pm.x - nx * dist, y: pm.y - ny * dist };	// 외측선 위 수선의 발
		rec.addDimLinear(0, q.x, q.y, pm.x, pm.y, 0, label);
	}
	webDim(P.PTCL1, P.PBEL, P.PTHL1, P.PBHL1, 'TWEBL');
	webDim(P.PTCR1, P.PBER, P.PTHR1, P.PBHR1, 'TWEBR');
	if (two){
		var ymC = (P.PTHCL1.y + P.PBHCL1.y) / 2;
		rec.addDimLinear(0, -ap.TWEBC/2, ymC, ap.TWEBC/2, ymC, 0, 'TWEBC');
	}

	// ── 필렛 반경 (geo 의 arcs 순서 = R_WTL, R_WTR, R_WBL, R_WBR, R_WTIL, R_WTIR 중 0 이 아닌 것) ──
	var frad = [
		['R_WTL', ap.R_WTL], ['R_WTR', ap.R_WTR], ['R_WBL', ap.R_WBL],
		['R_WBR', ap.R_WBR], ['R_WTIL', ap.R_WTIL], ['R_WTIR', ap.R_WTIR]
	].filter(function(d){ return d[1] !== 0; });
	o.arcs.forEach(function(a, i){
		if (i >= frad.length) return;
		var a2 = a.ange; if (a2 <= a.angb) a2 += 360;
		// 라벨이 두께 치수와 겹치지 않도록 지시선을 연장.
		// geo_fillet 의 중심은 외측 필렛에서는 단면 바깥, 내측 필렛에서는 콘크리트 쪽이므로
		// 외측은 중심 너머(lt<0, 바깥 공간), 내측(R_WTIL/R_WTIR)은 아크 너머(lt>1, 셀 안쪽)로 보낸다
		var inner = (frad[i][0] === 'R_WTIL' || frad[i][0] === 'R_WTIR');
		rec.addDimRadius(0, a.x, a.y, a.r, (a.angb + a2) / 2, frad[i][0] + '=', { lt: inner ? 2.8 : -2.5 });
	});

	// ── 슬로프 표기 (파랑 텍스트) ──
	// 슬로프 표기 : 변수 텍스트 아래에 라벨 전체를 감싸는 길이의 화살표 선
	// (SLL/SLR 는 상부 치수 위트니스가 밀집한 곳을 피해 각 셀 중앙(슬래브 하면 아래)에 표기)
	function slopeNote(x, y, label){
		var L = (label.length + 1.5) * S * 0.008;		// 라벨 글자수 기준 화살표 길이
		rec.addText(0, x, y, label);
		rec.addArrowLine(0, x - L/2, y - S*0.016, x + L/2, y - S*0.016);
	}
	var xcl = (P.PTHL3.x + (two ? P.PTHCL3.x : 0)) / 2;		// 1 cell : 중앙점(0) 기준
	slopeNote(xcl, ytopf(xcl) - ap.TTS - S*0.022, 'SLL=' + ap.SLL + '%');
	var xcr = ((two ? P.PTHCR3.x : 0) + P.PTHR3.x) / 2;
	slopeNote(xcr, ytopf(xcr) - ap.TTS - S*0.022, 'SLR=' + ap.SLR + '%');
	slopeNote(0, ybot - S*0.085, 'SLB=' + ap.SLB + '%');

	// ── 렌더 + 줌/팬 ──
	var W = odiv.clientWidth || 900;
	var bw = (xmax - xmin) + S*0.30, bh = (ytop - ybot) + S*0.34;
	var Hpx = Math.max(320, Math.min(680, Math.round(W * bh / bw) + 20));
	odiv.style.position = 'relative';
	odiv.innerHTML = window.RWSVG.renderSVG(rec, W, Hpx) +
		'<button type="button" data-guide-regen title="Reset zoom/pan (더블클릭도 가능)" ' +
		'style="position:absolute;top:8px;right:8px;padding:3px 10px;font-size:10.5px;font-weight:700;letter-spacing:.06em;' +
		'color:#fff;background:#2563eb;border:1px solid #2563eb;border-radius:6px;cursor:pointer;">&#8635; REGEN</button>';
	var svg = odiv.querySelector('svg');
	if (svg) window.RWSVG.attachZoomPan(svg);
	var oregen = function(){ draw_box12cell_guide(sdivid, ap); };	// 재렌더 = 뷰 초기화
	var obtn = odiv.querySelector('[data-guide-regen]');
	if (obtn) obtn.onclick = oregen;
	if (svg) svg.addEventListener('dblclick', oregen);
}
