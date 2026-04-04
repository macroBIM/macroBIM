/*
		H 형강 작도를 위한 JS v000 (KonvaViewer 적용)
*/
const odxf_hsec 	= dxf_generator();
const scvs_hsec  = "hsecplot";		// canvas name

function hsection_click() {
	
    // 1. 사이드바(nav) 및 메인 콘텐츠(main) 레이아웃 조정
    const mainContent = document.getElementById('wrap_main');

    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
    }
    
    var omain = document.getElementById("wrap_main");	
    
    // HTML 생성
    var shtml = "";
	
	// 뷰포트 높이 계산 (하단 여백 확보)
    let dynamicHeight = "calc(100vh - 100px)"; 

	shtml += "<div class='container-fluid px-4' style='height: " + dynamicHeight + "; margin-top: 10px; margin-bottom: 20px;'>";
    shtml += "  <div class='row g-3 h-100'>"; 
            
    // --- 왼쪽: 입력 폼 영역 ---
    shtml += "      <div class='col-lg-4 h-100'>"; 
	shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 
	shtml += "              <div class='card-header bg-secondary text-white flex-shrink-0 d-flex justify-content-between align-items-center'>";
	shtml += "                  <h6 class='mb-0'>DIMENSION (mm)</h6>"; 
	shtml += "              </div>";	
	shtml += "              <div class='card-body overflow-auto flex-grow-1' style='min-height: 0; padding-bottom: 0;'>"; 
	shtml += "                  <div class='pe-1'>";
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_hsection(\"sUserText\"); fdraw_hsection();');
	shtml += createLabel('INPUT One by One');
	
    shtml += createRowInput('H Beam Height', 'dsech',  300, 'fdraw_hsection()');
    shtml += createRowInput('Top Flange Width','dbt', 300, 'fdraw_hsection()');
    shtml += createRowInput('Bottom Flange Width','dbb', 300, 'fdraw_hsection()');
    shtml += createRowInput('Web Thickness','dtw', 10, 'fdraw_hsection()');
    shtml += createRowInput('Top Flange Thickness','dttf', 15, 'fdraw_hsection()');
    shtml += createRowInput('Bottom Flange Thickness','dtbf', 15, 'fdraw_hsection()');
    shtml += createRowInput('Radius on Web<br> (R = 0 if not necessary)','dradius',  19, 'fdraw_hsection()');
    shtml += createRowInput('Beam Length','dseg_leng', 500, 'fdraw_hsection()');
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// card-footer (DXF 다운로드 버튼)
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_hsec.download(\"Hsection.dxf\")'>";
	shtml += "                      DXF DOWNLOAD";
	shtml += "                  </button>";
	shtml += "              </div>"; 
	shtml += "          </div>";
	shtml += "      </div>";
				
    // --- 오른쪽: 도면 뷰어 영역 ---
    shtml += "      <div class='col-lg-8 h-100'>";
    shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 
    shtml += "              <div class='card-header bg-secondary flex-shrink-0'>";
    // ★ 타이틀 변경
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan)</h6>";
    shtml += "              </div>";
    
    // ★ 마우스 커서 속성(cursor: grab) 추가
    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_hsec + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";
 
    omain.innerHTML = shtml;

    // 초기 드로잉 실행
    fdraw_hsection();
}

function getParams_hsection() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        dsech: getValue('dsech'), 
        dbt: getValue('dbt'), 
        dbb: getValue('dbb'), 
        dtw: getValue('dtw'),
        dttf: getValue('dttf'),
        dtbf: getValue('dtbf'),
        dradius: getValue('dradius')
    };
    
    let dseg_leng = getValue('dseg_leng');
    let combText = [ ...Object.values(aparam) ].join(',');

    return { aparam, dseg_leng, combText };
}

function putParams_hsection(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 2) return; 

    const values = lines[0].split(',');
    const dseg_leng = lines[1];

    const keys = [ 'dsech', 'dbt', 'dbb', 'dtw', 'dttf', 'dtbf', 'dradius' ];

    keys.forEach((key, index) => {
        if (values[index] !== undefined) {
            const elS = document.getElementById( key );
            if (elS) elS.value = values[index].trim();
        }			
    });

    if ( dseg_leng !== undefined) {
        const elE = document.getElementById( "dseg_leng" );
        if (elE) elE.value = dseg_leng;
    }

    if (typeof fdraw_hsection === 'function') fdraw_hsection();
}

// Canvas에 도면을 그립니다.
function fdraw_hsection() {

	/* Load data */		
	let auserdata = getParams_hsection();
	let aparam = auserdata.aparam;
	let dleng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }	

	// data loading
	let { dsech, dbt, dbb, dtw, dttf, dtbf, dradius } = aparam;

	/* KONVA CANVAS : activate & draw */		
	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;
	var dp1x, dp1y, dp2x, dp2y;

    // ★ PlotlyViewer를 KonvaViewer로 변경!
	var ocvs = new KonvaViewer(scvs_hsec);

	// 레이어
	ocvs.addLayer('hsec_solid',  'cyan', 'solid', 2);
	ocvs.addLayer('hsec_hidden', 'cyan', 'hidden', 1.5);
	ocvs.addLayer('hsec_center', 'red', 'solid', 2);

	var alayer = ['hsec_solid', 'hsec_hidden', 'hsec_center'];

	/* DXF Preparation */		
	var ddim_ext = 20;
	var ddim_off = 20;
	
	odxf_hsec.init();
	odxf_hsec.layer("hsec_cent", 1, "CENTER");
	odxf_hsec.layer("hsec_hidden", 4, "HIDDEN");
	odxf_hsec.layer("hsec_solid", 4, "CONTINUOUS");
	odxf_hsec.layer("hsec_dim", 1, "CONTINUOUS");

	// set origin of each view
	dOx = 0, dOy = 0;
	dOx_side = dleng * 2, dOy_side = 0;
	dOx_top = 0, dOy_top = dleng * 3.0;
	dOx_bot = dleng * 2, dOy_bot = dleng * 3.0;

	/** front view **/
	plotly_hbeam(ocvs, 0, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

    // dxf
    odxf_hsec.hbeam(dOx, dOy + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, "hsec_solid");

    // 상부
    dp1x = dOx - dbt / 2, dp1y = dOy + dsech + ddim_off;
    dp2x = dOx + dbt / 2, dp2y = dOy + dsech + ddim_off;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    // web 복부
    dp1x = dOx - dtw / 2, dp1y = dOy + dsech / 2;
    dp2x = dOx + dtw / 2, dp2y = dOy + dsech / 2;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 1);
    
    // vertical
    dp1x = dOx - dbt / 2 - ddim_off, dp1y = dOy ;
    dp2x = dOx - dbt / 2 - ddim_off, dp2y = dOy + dsech;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    dp1x = dOx - dbt / 2 - ddim_off, dp1y = dOy ;
    dp2x = dOx - dbt / 2 - ddim_off, dp2y = dOy + dtbf;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

    dp1x = dp2x, dp1y = dp2y;
    dp2x = dp1x, dp2y = dOy + dsech - dttf;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

    dp1x = dp2x, dp1y = dp2y;
    dp2x = dp1x, dp2y = dOy + dsech;
    ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);
            
    dp1x = dOx - dtw / 2 - dradius, dp1y = dOy + dsech - dttf - dradius;		
    ocvs.addDimRadius('front', dp1x, dp1y, dradius, 45);		

    dp1x = dOx - dtw / 2 - dradius, dp1y = dOy + dtbf + dradius;		
    ocvs.addDimRadius('front', dp1x, dp1y, dradius, -45);		
		
		
	/** top view **/
	plotly_hbeam(ocvs, 1, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

    // dxf
    odxf_hsec.hbeam_top(dOx_top, dOy_top - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

    // vertical
    dp1x = dOx - dbt / 2 - ddim_off, dp1y = dOy - dleng / 2;
    dp2x = dOx - dbt / 2 - ddim_off, dp2y = dOy + dleng / 2;
    ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    // horizontal
    dp1x = dOx - dbt / 2, dp1y = dOy + dleng / 2 + ddim_off;
    dp2x = dOx + dbt / 2, dp2y = dOy + dleng / 2 + ddim_off;
    ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    dp1x = dOx - dtw / 2, dp1y = dOy + dleng / 2 + ddim_off;
    dp2x = dOx + dtw / 2, dp2y = dOy + dleng / 2 + ddim_off;
    ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

	/** bottom view **/
	plotly_hbeam(ocvs, 2, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

    // dxf
    odxf_hsec.hbeam_bot(dOx_bot, dOy_bot - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

    // vertical
    dp1x = dOx - dbb / 2 - ddim_off, dp1y = dOy - dleng / 2;
    dp2x = dOx - dbb / 2 - ddim_off, dp2y = dOy + dleng / 2;
    ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    // horizontal
    dp1x = dOx - dbb / 2, dp1y = dOy + dleng / 2 + ddim_off;
    dp2x = dOx + dbb / 2, dp2y = dOy + dleng / 2 + ddim_off;
    ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    dp1x = dOx - dtw / 2, dp1y = dOy + dleng / 2 + ddim_off;
    dp2x = dOx + dtw / 2, dp2y = dOy + dleng / 2 + ddim_off;
    ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

	/** side view **/
	plotly_hbeam(ocvs, 3, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

    // dxf
    odxf_hsec.hbeam_side(dOx_side, dOy_side + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

    // vertical
    dp1x = dOx - dleng / 2 - ddim_off, dp1y = dOy ;
    dp2x = dOx - dleng / 2 - ddim_off, dp2y = dOy + dsech;
    ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

    dp1x = dOx - dleng / 2 - ddim_off, dp1y = dOy ;
    dp2x = dOx - dleng / 2 - ddim_off, dp2y = dOy + dtbf;
    ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

    dp1x = dOx - dleng / 2 - ddim_off, dp1y = dOy + dsech - dttf;
    dp2x = dOx - dleng / 2 - ddim_off, dp2y = dOy + dsech;
    ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

    // horizontal
    dp1x = dOx - dleng / 2, dp1y = dOy + dsech + ddim_off;
    dp2x = dOx + dleng / 2, dp2y = dOy + dsech + ddim_off;
    ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

	// draw
	ocvs.render();
}
