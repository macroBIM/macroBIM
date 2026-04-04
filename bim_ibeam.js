/*
		i Beam 작도를 위한 JS  v000 (KonvaViewer 적용)
*/
const odxf_ibeam 	= dxf_generator();
const scvs_ibeam  = "ibeamplot";		// canvas name

function ibeam_click() {
 
    // 1. 사이드바(nav) 및 메인 콘텐츠(main) 레이아웃 조정
    const mainContent = document.getElementById('wrap_main');

    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
    }
    
    var omain = document.getElementById("wrap_main");	
    
    // HTML 생성
    var shtml = "";
	
	// 뷰포트 높이 계산 변경 (더 넉넉한 하단 여백 확보)
    let dynamicHeight = "calc(100vh - 100px)"; 

	shtml += "<div class='container-fluid px-4' style='height: " + dynamicHeight + "; margin-top: 10px; margin-bottom: 20px;'>";
    shtml += "  <div class='row g-3 h-100'>"; 
            
    // --- 왼쪽: 입력 폼 영역 ---
    shtml += "      <div class='col-lg-4 h-100'>"; 
	
	// 카드를 d-flex flex-column으로 설정하여 헤더-바디-푸터를 수직으로 정렬합니다.
	shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 

	// 1. 헤더에 버튼 추가
	shtml += "              <div class='card-header bg-secondary text-white flex-shrink-0 d-flex justify-content-between align-items-center'>";
	shtml += "                  <h6 class='mb-0'>DIMENSION (mm)</h6>"; 
	shtml += "              </div>";	

	// flex-grow-1을 주어 남은 공간을 다 차지하게 하고, 이 영역에만 스크롤을 발생시킵니다.
	shtml += "              <div class='card-body overflow-auto flex-grow-1' style='min-height: 0; padding-bottom: 0;'>"; 
	shtml += "                  <div class='pe-1'>";
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_ibeam(\"sUserText\"); fdraw_ibeam();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
    shtml += createRowInput('I beam Height', 'dh',  1500, 'fdraw_ibeam()');
    shtml += createRowInput('I beam Top Width','dbt', 1235, 'fdraw_ibeam()');
    shtml += createRowInput('I beam Bottom Width','dbb', 985, 'fdraw_ibeam()');
    shtml += createRowInput('Top Flange Thickness','dttf', 85, 'fdraw_ibeam()');
    shtml += createRowInput('Top Hunch Thickness','dttf1', 45, 'fdraw_ibeam()');
    shtml += createRowInput('Bottom Flange Thickness','dtbf', 135, 'fdraw_ibeam()');
    shtml += createRowInput('Bottom Hunch Thickness','dtbf1', 140, 'fdraw_ibeam()');
    shtml += createRowInput('Web Thickness','dtw', 160, 'fdraw_ibeam()');
	
    shtml += createRowInput('Radius on Top Flange <br> (R = 0 if not necessary)','drtf', 50, 'fdraw_ibeam()');
    shtml += createRowInput('Radius on Web Top <br> (R = 0 if not necessary)','drwt',  200, 'fdraw_ibeam()');
    shtml += createRowInput('Radius on Web bottom <br> (R = 0 if not necessary)','drwb', 100, 'fdraw_ibeam()');
    shtml += createRowInput('Radius on Bottom Flange <br> (R = 0 if not necessary)','drbf',  50, 'fdraw_ibeam()');
    shtml += createRowInput('Chamfer on Bottom Flange <br> (C = 0 if not necessary)','dchb',  20, 'fdraw_ibeam()');
	
    shtml += createRowInput('I Beam Length','dseg_leng', 500, 'fdraw_ibeam()');
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// card-footer (DXF 다운로드 버튼)
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_ibeam.download(\"IBeam.dxf\")'>";
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
    shtml += "                  <div id='" + scvs_ibeam + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";
 
    omain.innerHTML = shtml;

    // 초기 드로잉 실행
    fdraw_ibeam();
}

// 입력 필드에서 값을 읽어옵니다.
function getParams_ibeam() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        dh: getValue('dh'), dbt: getValue('dbt'), dbb: getValue('dbb'),
        dttf: getValue('dttf'), dttf1: getValue('dttf1'), 
        dtbf: getValue('dtbf'), dtbf1: getValue('dtbf1'), 
        dtw: getValue('dtw'),
        drtf: getValue('drtf'), drwt: getValue('drwt'), drwb: getValue('drwb'), drbf: getValue('drbf'),
        dchb: getValue('dchb')
    };
    
    let dseg_leng = getValue('dseg_leng');
    let combText = [ ...Object.values(aparam) ].join(',');

    return { aparam, dseg_leng, combText };
}

function putParams_ibeam(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 2) return; 

    const values = lines[0].split(',');
    const dseg_leng = lines[1];

    const keys = [
        'dh', 'dbt', 'dbb', 'dttf', 'dttf1', 'dtbf', 'dtbf1',
        'dtw', 'drtf', 'drwt', 'drwb', 'drbf', 'dchb'
    ];

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

    // ★ 오타 수정: fdraw_box1cell -> fdraw_ibeam
    if (typeof fdraw_ibeam === 'function') {
        fdraw_ibeam();
    }
}

function fdraw_ibeam(){

	/* Load data */		
	let auserdata = getParams_ibeam();
	let aparam = auserdata.aparam;
	let dleng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }	

	// data loading
	let { dh, dbt, dbb, dttf, dttf1, dtbf, dtbf1, dtw, drtf, drwt, drwb, drbf, dchb } = aparam;

	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;
	
	/* KONVA CANVAS : activate & draw */		
    // ★ PlotlyViewer 대신 KonvaViewer 호출!
	var ocvs = new KonvaViewer(scvs_ibeam);

	// 레이어
	var alayer = ['ibeam_solid', 'ibeam_hidden', 'ibeam_center'];
	
	ocvs.addLayer( alayer[0], 'cyan', 'solid', 1.5);
	ocvs.addLayer( alayer[1], 'cyan', 'hidden', 1.5);
	ocvs.addLayer( alayer[2], 'red',  'solid', 1.5);

	/* DXF Preparation */		
	odxf_ibeam.init();
	odxf_ibeam.layer( alayer[0], 4, "CONTINUOUS");
	odxf_ibeam.layer( alayer[1], 4, "HIDDEN");
	odxf_ibeam.layer( alayer[2], 1, "CENTER");

	let ptc     = {x:0, y:dh};  // 상부 끝단 좌측
	let ptl     = {x:0, y:0};  // 상부 끝단 좌측
	let ptfl    = {x:0, y:0};  // 상부 끝단 플랜지 좌측
	let pwtl    = {x:0, y:0};  // 상부 복부 좌측
	let pwbl    = {x:0, y:0};  // 상부 복부 좌측
	let pbfl    = {x:0, y:0};  // 상부 끝단 플랜지 좌측
	let pbl     = {x:0, y:0};  // 상부 끝단 좌측
	let pbc     = {x:0, y:0};  // 상부 끝단 좌측

	let ptr     = {x:0, y:0};  
	let ptfr    = {x:0, y:0};  
	let pwtr    = {x:0, y:0};  
	let pwbr    = {x:0, y:0};  
	let pbfr    = {x:0, y:0};  
	let pbr     = {x:0, y:0};  
					
	ptl.x = dbt / 2 * -1;
	ptl.y = dh;

	ptfl.x = ptl.x;
	ptfl.y = ptl.y - dttf;

	pwtl.x = dtw / 2 * -1;
	pwtl.y = ptfl.y - dttf1;
	
	pbl.x = dbb / 2 * -1;
	pbl.y = 0;
	
	pbfl.x = pbl.x;
	pbfl.y = pbl.y + dtbf;

	pwbl.x = dtw / 2 * -1 ;
	pwbl.y = pbfl.y + dtbf1;

	ptr.x = ptl.x * -1;
	ptr.y = ptl.y;

	ptfr.x = ptfl.x * -1;
	ptfr.y = ptfl.y;

	pwtr.x = pwtl.x * -1;
	pwtr.y = pwtl.y;
	
	pbr.x = pbl.x * -1;
	pbr.y = pbl.y;
	
	pbfr.x = pbfl.x * -1;
	pbfr.y = pbfl.y;

	pwbr.x = pwbl.x * -1 ;
	pwbr.y = pwbl.y;
	
	// fillet / chamfer
	let fil_tl 	= geo_fillet( ptl, ptfl, pwtl, drtf);
	let fil_wtl = geo_fillet( ptfl, pwtl, pwbl, drwt);
	let fil_wbl = geo_fillet( pwtl, pwbl, pbfl, drwb);
	let fil_bl 	= geo_fillet( pwbl, pbfl, pbl, drbf);
	
	let chf_bl = geo_chamfer( pbfl, pbl, pbc, dchb);

	let fil_tr 	= geo_fillet( ptr, ptfr, pwtr, drtf);
	let fil_wtr = geo_fillet( ptfr, pwtr, pwbr, drwt);
	let fil_wbr = geo_fillet( pwtr, pwbr, pbfr, drwb);
	let fil_br	= geo_fillet( pwbr, pbfr, pbr, drbf);
	
	let chf_br = geo_chamfer( pbfr, pbr, pbc, dchb);


	/* draw canvas : front */
	let ddim_ext = 20;	// 디멘젼 길이
	let ddim_off = 20;	// 구조물에서 이격
	
	let sview ='front';

	dOx = 0	, dOy = 0;
	
	if( drtf == 0){
	  ocvs.addLine(sview, ptl.x, ptl.y, ptfl.x, ptfl.y, alayer[0] );  
		odxf_ibeam.line( dOx + ptl.x, dOy + ptl.y, dOx + ptfl.x, dOy + ptfl.y, alayer[0] );

	  ocvs.addLine(sview, ptr.x, ptr.y, ptfr.x, ptfr.y, alayer[0] );  
		odxf_ibeam.line( dOx + ptr.x, dOy + ptr.y, dOx + ptfr.x, dOy + ptfr.y, alayer[0] );
	} else {
	  ocvs.addLine(sview, ptl.x, ptl.y, fil_tl.xb, fil_tl.yb, alayer[0] ); 
	  ocvs.addArc(sview, fil_tl.ox, fil_tl.oy, fil_tl.r, fil_tl.angb, fil_tl.ange, alayer[0]);
		odxf_ibeam.line( dOx + ptl.x, dOy + ptl.y, dOx + fil_tl.xb, dOy + fil_tl.yb, alayer[0] );
		odxf_ibeam.arc( dOx + fil_tl.ox, dOy + fil_tl.oy, fil_tl.r, fil_tl.angb, fil_tl.ange, alayer[0] );
	  
	  ocvs.addLine(sview, ptr.x, ptr.y, fil_tr.xb, fil_tr.yb, alayer[0] ); 
	  ocvs.addArc(sview, fil_tr.ox, fil_tr.oy, fil_tr.r, fil_tr.angb, fil_tr.ange, alayer[0]);
		odxf_ibeam.line( dOx + ptr.x, dOy + ptr.y, dOx + fil_tr.xb, dOy + fil_tr.yb, alayer[0] );
		odxf_ibeam.arc( dOx + fil_tr.ox, dOy + fil_tr.oy, fil_tr.r, fil_tr.angb, fil_tr.ange, alayer[0] );
	}
	
	if( drwt == 0){
	  if( drtf == 0){
		ocvs.addLine(sview, ptfl.x, ptfl.y, pwtl.x, pwtl.y, alayer[0] );    
			odxf_ibeam.line( dOx + ptfl.x, dOy + ptfl.y, dOx + pwtl.x, dOy + pwtl.y, alayer[0] );
		
		ocvs.addLine(sview, ptfr.x, ptfr.y, pwtr.x, pwtr.y, alayer[0] );            
			odxf_ibeam.line( dOx + ptfr.x, dOy + ptfr.y, dOx + pwtr.x, dOy + pwtr.y, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_tl.xe, fil_tl.ye, pwtl.x, pwtl.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_tl.xe, dOy + fil_tl.ye, dOx + pwtl.x, dOy + pwtl.y, alayer[0] );
		
		ocvs.addLine(sview, fil_tr.xe, fil_tr.ye, pwtr.x, pwtr.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_tr.xe, dOy + fil_tr.ye, dOx + pwtr.x, dOy + pwtr.y, alayer[0] );
	  }
	} else {
	  if( drtf == 0){
		ocvs.addLine(sview, ptfl.x, ptfl.y, fil_wtl.xb, fil_wtl.yb, alayer[0] );            
			odxf_ibeam.line( dOx + ptfl.x, dOy + ptfl.y, dOx + fil_wtl.xb, dOy + fil_wtl.yb, alayer[0] );
		
		ocvs.addLine(sview, ptfr.x, ptfr.y, fil_wtr.xb, fil_wtr.yb, alayer[0] );            
			odxf_ibeam.line( dOx + ptfr.x, dOy + ptfr.y, dOx + fil_wtr.xb, dOy + fil_wtr.yb, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_tl.xe, fil_tl.ye, fil_wtl.xb, fil_wtl.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_tl.xe, dOy + fil_tl.ye, dOx + fil_wtl.xb, dOy + fil_wtl.yb, alayer[0] );
		
		ocvs.addLine(sview, fil_tr.xe, fil_tr.ye, fil_wtr.xb, fil_wtr.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_tr.xe, dOy + fil_tr.ye, dOx + fil_wtr.xb, dOy + fil_wtr.yb, alayer[0] );
	  }
	  ocvs.addArc(sview, fil_wtl.ox, fil_wtl.oy, fil_wtl.r, fil_wtl.angb, fil_wtl.ange, alayer[0]);        
		odxf_ibeam.arc( dOx + fil_wtl.ox, dOy + fil_wtl.oy, fil_wtl.r, fil_wtl.angb, fil_wtl.ange, alayer[0] );
	  ocvs.addArc(sview, fil_wtr.ox, fil_wtr.oy, fil_wtr.r, fil_wtr.angb, fil_wtr.ange, alayer[0]);        
		odxf_ibeam.arc( dOx + fil_wtr.ox, dOy + fil_wtr.oy, fil_wtr.r, fil_wtr.angb, fil_wtr.ange, alayer[0] );
	}
	
	if( drwb == 0){
	  if( drwt == 0){
		ocvs.addLine(sview, pwtl.x, pwtl.y, pwbl.x, pwbl.y, alayer[0] );  
			odxf_ibeam.line( dOx + pwtl.x, dOy + pwtl.y, dOx + pwbl.x, dOy + pwbl.y, alayer[0] );
		
		ocvs.addLine(sview, pwtr.x, pwtr.y, pwbr.x, pwbr.y, alayer[0] );  
			odxf_ibeam.line( dOx + pwtr.x, dOy + pwtr.y, dOx + pwbr.x, dOy + pwbr.y, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_wtl.xe, fil_wtl.ye, pwbl.x, pwbl.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wtl.xe, dOy + fil_wtl.ye, dOx + pwbl.x, dOy + pwbl.y, alayer[0] );
		
		ocvs.addLine(sview, fil_wtr.xe, fil_wtr.ye, pwbr.x, pwbr.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wtr.xe, dOy + fil_wtr.ye, dOx + pwbr.x, dOy + pwbr.y, alayer[0] );
	  }
	} else {
	  if( drwt == 0){
		ocvs.addLine(sview, pwtl.x, pwtl.y, fil_wbl.xb, fil_wbl.yb, alayer[0] );    
			odxf_ibeam.line( dOx + pwtl.x, dOy + pwtl.y, dOx + fil_wbl.xb, dOy + fil_wbl.yb, alayer[0] );
		
		ocvs.addLine(sview, pwtr.x, pwtr.y, fil_wbr.xb, fil_wbr.yb, alayer[0] );            
			odxf_ibeam.line( dOx + pwtr.x, dOy + pwtr.y, dOx + fil_wbr.xb, dOy + fil_wbr.yb, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_wtl.xe, fil_wtl.ye, fil_wbl.xb, fil_wbl.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wtl.xe, dOy + fil_wtl.ye, dOx + fil_wbl.xb, dOy + fil_wbl.yb, alayer[0] );
		
		ocvs.addLine(sview, fil_wtr.xe, fil_wtr.ye, fil_wbr.xb, fil_wbr.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wtr.xe, dOy + fil_wtr.ye, dOx + fil_wbr.xb, dOy + fil_wbr.yb, alayer[0] );
	  }
	  ocvs.addArc(sview, fil_wbl.ox, fil_wbl.oy, fil_wbl.r, fil_wbl.angb, fil_wbl.ange, alayer[0]);
		odxf_ibeam.arc( dOx + fil_wbl.ox, dOy + fil_wbl.oy, fil_wbl.r, fil_wbl.angb, fil_wbl.ange, alayer[0] );
	  ocvs.addArc(sview, fil_wbr.ox, fil_wbr.oy, fil_wbr.r, fil_wbr.angb, fil_wbr.ange, alayer[0]);
		odxf_ibeam.arc( dOx + fil_wbr.ox, dOy + fil_wbr.oy, fil_wbr.r, fil_wbr.angb, fil_wbr.ange, alayer[0] );
	}
	
	if( drbf == 0){
	  if( drwb == 0){
		ocvs.addLine(sview, pwbl.x, pwbl.y, pbfl.x, pbfl.y, alayer[0] );  
			odxf_ibeam.line( dOx + pwbl.x, dOy + pwbl.y, dOx + pbfl.x, dOy + pbfl.y, alayer[0] );
		
		ocvs.addLine(sview, pwbr.x, pwbr.y, pbfr.x, pbfr.y, alayer[0] );  
			odxf_ibeam.line( dOx + pwbr.x, dOy + pwbr.y, dOx + pbfr.x, dOy + pbfr.y, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_wbl.xe, fil_wbl.ye, pbfl.x, pbfl.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wbl.xe, dOy + fil_wbl.ye, dOx + pbfl.x, dOy + pbfl.y, alayer[0] );
		
		ocvs.addLine(sview, fil_wbr.xe, fil_wbr.ye, pbfr.x, pbfr.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wbr.xe, dOy + fil_wbr.ye, dOx + pbfr.x, dOy + pbfr.y, alayer[0] );
	  }
	} else {
	  if( drwb == 0){
		ocvs.addLine(sview, pwbl.x, pwbl.y, fil_bl.xb, fil_bl.yb, alayer[0] );  
			odxf_ibeam.line( dOx + pwbl.x, dOy + pwbl.y, dOx + fil_bl.xb, dOy + fil_bl.yb, alayer[0] );
		
		ocvs.addLine(sview, pwbr.x, pwbr.y, fil_br.xb, fil_br.yb, alayer[0] );  
			odxf_ibeam.line( dOx + pwbr.x, dOy + pwbr.y, dOx + fil_br.xb, dOy + fil_br.yb, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_wbl.xe, fil_wbl.ye, fil_bl.xb, fil_bl.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wbl.xe, dOy + fil_wbl.ye, dOx + fil_bl.xb, dOy + fil_bl.yb, alayer[0] );
		
		ocvs.addLine(sview, fil_wbr.xe, fil_wbr.ye, fil_br.xb, fil_br.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_wbr.xe, dOy + fil_wbr.ye, dOx + fil_br.xb, dOy + fil_br.yb, alayer[0] );
	  }
	  ocvs.addArc(sview, fil_bl.ox, fil_bl.oy, fil_bl.r, fil_bl.angb, fil_bl.ange, alayer[0]);
		odxf_ibeam.arc( dOx + fil_bl.ox, dOy + fil_bl.oy, fil_bl.r, fil_bl.angb, fil_bl.ange, alayer[0] );
	  ocvs.addArc(sview, fil_br.ox, fil_br.oy, fil_br.r, fil_br.angb, fil_br.ange, alayer[0]);
		odxf_ibeam.arc( dOx + fil_br.ox, dOy + fil_br.oy, fil_br.r, fil_br.angb, fil_br.ange, alayer[0] );
	}
	
	if( dchb == 0){
	  if( drbf == 0){
		ocvs.addLine(sview, pbfl.x, pbfl.y, pbl.x, pbl.y, alayer[0] ); 
			odxf_ibeam.line( dOx + pbfl.x, dOy + pbfl.y, dOx + pbl.x, dOy + pbl.y, alayer[0] );
		
		ocvs.addLine(sview, pbfr.x, pbfr.y, pbr.x, pbr.y, alayer[0] ); 
			odxf_ibeam.line( dOx + pbfr.x, dOy + pbfr.y, dOx + pbr.x, dOy + pbr.y, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_bl.xe, fil_bl.ye, pbl.x, pbl.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_bl.xe, dOy + fil_bl.ye, dOx + pbl.x, dOy + pbl.y, alayer[0] );
		
		ocvs.addLine(sview, fil_br.xe, fil_br.ye, pbr.x, pbr.y, alayer[0] );            
			odxf_ibeam.line( dOx + fil_br.xe, dOy + fil_br.ye, dOx + pbr.x, dOy + pbr.y, alayer[0] );
	  }
	} else {
	  if( drbf == 0){
		ocvs.addLine(sview, pbfl.x, pbfl.y, chf_bl.xb, chf_bl.yb, alayer[0] ); 
			odxf_ibeam.line( dOx + pbfl.x, dOy + pbfl.y, dOx + chf_bl.xb, dOy + chf_bl.yb, alayer[0] );
		
		ocvs.addLine(sview, pbfr.x, pbfr.y, chf_br.xb, chf_br.yb, alayer[0] ); 
			odxf_ibeam.line( dOx + pbfr.x, dOy + pbfr.y, dOx + chf_br.xb, dOy + chf_br.yb, alayer[0] );
	  }else{
		ocvs.addLine(sview, fil_bl.xe, fil_bl.ye, chf_bl.xb, chf_bl.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_bl.xe, dOy + fil_bl.ye, dOx + chf_bl.xb, dOy + chf_bl.yb, alayer[0] );
		
		ocvs.addLine(sview, fil_br.xe, fil_br.ye, chf_br.xb, chf_br.yb, alayer[0] );            
			odxf_ibeam.line( dOx + fil_br.xe, dOy + fil_br.ye, dOx + chf_br.xb, dOy + chf_br.yb, alayer[0] );
	  }
	  ocvs.addLine(sview, chf_bl.xb, chf_bl.yb, chf_bl.xe, chf_bl.ye, alayer[0] );  
			odxf_ibeam.line( dOx + chf_bl.xb, dOy + chf_bl.yb, dOx + chf_bl.xe, dOy + chf_bl.ye, alayer[0] );
	  ocvs.addLine(sview, chf_br.xb, chf_br.yb, chf_br.xe, chf_br.ye, alayer[0] );  
			odxf_ibeam.line( dOx + chf_br.xb, dOy + chf_br.yb, dOx + chf_br.xe, dOy + chf_br.ye, alayer[0] );
	}
	
	ocvs.addLine(sview, ptl.x, ptl.y, ptr.x, ptr.y, alayer[0] );  
		odxf_ibeam.line( dOx + ptl.x, dOy + ptl.y, dOx + ptr.x, dOy + ptr.y, alayer[0] );
	
	if( dchb == 0 ){
		ocvs.addLine(sview, pbl.x, pbl.y, pbr.x, pbr.y, alayer[0] );  
			odxf_ibeam.line( dOx + pbl.x, dOy + pbl.y, dOx + pbr.x, dOy + pbr.y, alayer[0] );
	} else {
		ocvs.addLine(sview, chf_bl.xe, chf_bl.ye, chf_br.xe, chf_br.ye, alayer[0] );  
			odxf_ibeam.line( dOx + chf_bl.xe, dOy + chf_bl.ye, dOx + chf_br.xe, dOy + chf_br.ye, alayer[0] );
	}

    // dim line	
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , pbl.y, Math.min(pbl.x, ptl.x)- ddim_off, ptl.y, ddim_ext * 6);
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , pbl.y, Math.min(pbl.x, ptl.x)- ddim_off, pbfl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , pbfl.y, Math.min(pbl.x, ptl.x)- ddim_off, pwbl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , pwbl.y, Math.min(pbl.x, ptl.x)- ddim_off, pwtl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , pwtl.y, Math.min(pbl.x, ptl.x)- ddim_off, ptfl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, Math.min(pbl.x, ptl.x) - ddim_off , ptfl.y, Math.min(pbl.x, ptl.x)- ddim_off, ptl.y, ddim_ext * 3);

    ocvs.addDimLinear(sview, ptl.x , ptl.y + ddim_off, ptr.x, ptr.y + ddim_off, ddim_ext * 6);
    ocvs.addDimLinear(sview, ptl.x , ptl.y + ddim_off, pwtl.x, ptl.y + ddim_off, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwtl.x , ptl.y + ddim_off, pwtr.x, ptr.y + ddim_off, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwtr.x , ptl.y + ddim_off, ptr.x, ptr.y + ddim_off, ddim_ext * 3);

    ocvs.addDimLinear(sview, pbl.x , pbl.y - ddim_off, pbr.x, pbr.y - ddim_off, ddim_ext * -6);
    ocvs.addDimLinear(sview, pbl.x , pbl.y - ddim_off, pwbl.x, pbl.y - ddim_off, ddim_ext * -3);
    ocvs.addDimLinear(sview, pwbl.x , pbl.y - ddim_off, pwbr.x, pbr.y - ddim_off, ddim_ext * -3);
    ocvs.addDimLinear(sview, pwbr.x , pbl.y - ddim_off, pbr.x, pbr.y - ddim_off, ddim_ext * -3);
    
    ocvs.addDimRadius(sview, fil_tr.ox, fil_tr.oy, fil_tr.r, -45);		
    ocvs.addDimRadius(sview, fil_wtr.ox, fil_wtr.oy, fil_wtr.r, 135);		
    ocvs.addDimRadius(sview, fil_wbr.ox, fil_wbr.oy, fil_wbr.r, 225);		
    ocvs.addDimRadius(sview, fil_br.ox, fil_br.oy, fil_br.r, 45);		

    if( ! dchb == 0 ){
        ocvs.addDimLinear(sview, chf_br.xb + ddim_off, chf_br.ye , chf_br.xb + ddim_off, chf_br.yb, ddim_ext * -6);
    }
	

	/* draw canvas : Top */
	dOx_top = 0									, dOy_top = dh * 3.0;

	sview ='top';		
	
	ocvs.addLine(sview, ptl.x, - dleng / 2, ptfl.x, + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_top + ptl.x, dOy_top - dleng / 2, dOx_top + ptfl.x, dOy_top + dleng / 2, alayer[0] );
	
	ocvs.addLine(sview, ptr.x, - dleng / 2, ptfr.x, + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_top + ptr.x, dOy_top - dleng / 2, dOx_top + ptfr.x, dOy_top + dleng / 2, alayer[0] );

	ocvs.addLine(sview, ptl.x, - dleng / 2, ptr.x,  - dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_top + ptl.x, dOy_top - dleng / 2, dOx_top + ptr.x, dOy_top - dleng / 2, alayer[0] );
	
	ocvs.addLine(sview, ptl.x, + dleng / 2, ptr.x,  + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_top + ptl.x, dOy_top + dleng / 2, dOx_top + ptr.x, dOy_top + dleng / 2, alayer[0] );

	ocvs.addLine(sview, pwtl.x, - dleng / 2, pwtl.x, + dleng / 2, alayer[1] );  
	ocvs.addLine(sview, pwtr.x, - dleng / 2, pwtr.x, + dleng / 2, alayer[1] );  
		odxf_ibeam.line( dOx_top + pwtl.x, dOy_top - dleng / 2, dOx_top + pwtl.x, dOy_top + dleng / 2, alayer[0] );
		odxf_ibeam.line( dOx_top + pwtr.x, dOy_top - dleng / 2, dOx_top + pwtr.x, dOy_top + dleng / 2, alayer[0] );


    // dim line	
    ocvs.addDimLinear(sview, ptl.x - ddim_off, - dleng / 2, ptl.x - ddim_off, dleng / 2, ddim_ext * 6);
    
    ocvs.addDimLinear(sview, ptl.x  , dleng / 2,  ptr.x, dleng / 2, ddim_ext * 6);
    ocvs.addDimLinear(sview, ptl.x  , dleng / 2, pwtl.x, dleng / 2, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwtl.x , dleng / 2, pwtr.x, dleng / 2, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwtr.x , dleng / 2,  ptr.x, dleng / 2, ddim_ext * 3);


	/* draw canvas : Bottom */
	dOx_bot = Math.max(dbt, dbb, dleng) * 3		, dOy_bot = dh * 3.0;

	sview ='bottom';		
	
	ocvs.addLine(sview, pbl.x, - dleng / 2, pbfl.x, + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_bot + pbl.x, dOy_bot - dleng / 2, dOx_bot + pbfl.x, dOy_bot + dleng / 2, alayer[0] );
	
	ocvs.addLine(sview, pbr.x, - dleng / 2, pbfr.x, + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_bot + pbr.x, dOy_bot - dleng / 2, dOx_bot + pbfr.x, dOy_bot + dleng / 2, alayer[0] );

	ocvs.addLine(sview, pbl.x, - dleng / 2, pbr.x,  - dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_bot + pbl.x, dOy_bot - dleng / 2, dOx_bot + pbr.x, dOy_bot - dleng / 2, alayer[0] );
	
	ocvs.addLine(sview, pbl.x, + dleng / 2, pbr.x,  + dleng / 2, alayer[0] );  
		odxf_ibeam.line( dOx_bot + pbl.x, dOy_bot + dleng / 2, dOx_bot + pbr.x, dOy_bot + dleng / 2, alayer[0] );
	
	// chamfer line
	if( ! dchb == 0 ){
		ocvs.addLine(sview, chf_bl.xe, - dleng / 2, chf_bl.xe, + dleng / 2, alayer[0] );  
		ocvs.addLine(sview, chf_br.xe, - dleng / 2, chf_br.xe, + dleng / 2, alayer[0] );   		
			odxf_ibeam.line( dOx_bot + chf_bl.xe, dOy_bot - dleng / 2, dOx_bot + chf_bl.xe, dOy_bot + dleng / 2, alayer[0] );
			odxf_ibeam.line( dOx_bot + chf_br.xe, dOy_bot - dleng / 2, dOx_bot + chf_br.xe, dOy_bot + dleng / 2, alayer[0] );
	}
	
	ocvs.addLine(sview, pwbl.x, - dleng / 2, pwbl.x, + dleng / 2, alayer[1] );  
	ocvs.addLine(sview, pwbr.x, - dleng / 2, pwbr.x, + dleng / 2, alayer[1] );  
		odxf_ibeam.line( dOx_bot + pwbl.x, dOy_bot - dleng / 2, dOx_bot + pwbl.x, dOy_bot + dleng / 2, alayer[0] );
		odxf_ibeam.line( dOx_bot + pwbr.x, dOy_bot - dleng / 2, dOx_bot + pwbr.x, dOy_bot + dleng / 2, alayer[0] );

    // dim line	
    ocvs.addDimLinear(sview, pbl.x - ddim_off, - dleng / 2, pbl.x - ddim_off, dleng / 2, ddim_ext * 6);

    ocvs.addDimLinear(sview,  pbl.x , dleng / 2,  pbr.x, dleng / 2, ddim_ext * 6);
    ocvs.addDimLinear(sview,  pbl.x , dleng / 2, pwbl.x, dleng / 2, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwbl.x , dleng / 2, pwbr.x, dleng / 2, ddim_ext * 3);
    ocvs.addDimLinear(sview, pwbr.x , dleng / 2,  pbr.x, dleng / 2, ddim_ext * 3);
    
	if( ! dchb == 0 ){
		ocvs.addDimLinear(sview, chf_br.xe , -dleng / 2, chf_br.xb, -dleng / 2, ddim_ext * -3);
	}


	/* draw canvas : Side */
	dOx_side = Math.max(dbt, dbb, dleng) * 3	, dOy_side = 0;

	sview ='side';		
	
	ocvs.addLine(sview, - dleng / 2, ptl.y, dleng / 2, ptr.y, alayer[0] );  
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + ptl.y, dOx_side + dleng / 2, dOy_side + ptr.y, alayer[0] );
	
	ocvs.addLine(sview, - dleng / 2, ptfl.y, dleng / 2, ptfr.y, alayer[0] );  
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + ptfl.y, dOx_side + dleng / 2, dOy_side + ptfr.y, alayer[0] );
	
	ocvs.addLine(sview, - dleng / 2, pwtl.y, dleng / 2, pwtr.y, alayer[0] );  
	ocvs.addLine(sview, - dleng / 2, pwbl.y, dleng / 2, pwbr.y, alayer[0] );  
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + pwtl.y, dOx_side + dleng / 2, dOy_side + pwtr.y, alayer[0] );
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + pwbl.y, dOx_side + dleng / 2, dOy_side + pwbr.y, alayer[0] );
	
	ocvs.addLine(sview, - dleng / 2, pbfl.y, dleng / 2, pbfr.y, alayer[0] );  
	ocvs.addLine(sview, - dleng / 2, pbl.y, dleng / 2, pbr.y, alayer[0] );  
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + pbfl.y, dOx_side + dleng / 2, dOy_side + pbfr.y, alayer[0] );
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + pbl.y, dOx_side + dleng / 2, dOy_side + pbr.y, alayer[0] );
	
	// chamfer line
	if( ! dchb == 0 ){
		ocvs.addLine(sview, - dleng / 2, chf_bl.yb, dleng / 2, chf_br.yb, alayer[0] );  
			odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + chf_bl.yb, dOx_side + dleng / 2, dOy_side + chf_br.yb, alayer[0] );
	}

	ocvs.addLine(sview, - dleng / 2, pbl.y, - dleng / 2, ptl.y, alayer[0] );  
	ocvs.addLine(sview,   dleng / 2, pbl.y,   dleng / 2, ptl.y, alayer[0] );  
		odxf_ibeam.line( dOx_side - dleng / 2, dOy_side + pbl.y, dOx_side - dleng / 2, dOy_side + ptl.y, alayer[0] );
		odxf_ibeam.line( dOx_side + dleng / 2, dOy_side + pbl.y, dOx_side + dleng / 2, dOy_side + ptl.y, alayer[0] );
	
    // dim line	
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off ,  pbl.y, -dleng / 2- ddim_off,  ptl.y, ddim_ext * 6);
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off ,  pbl.y, -dleng / 2- ddim_off, pbfl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off , pbfl.y, -dleng / 2- ddim_off, pwbl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off , pwbl.y, -dleng / 2- ddim_off, pwtl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off , pwtl.y, -dleng / 2- ddim_off, ptfl.y, ddim_ext * 3);
    ocvs.addDimLinear(sview, -dleng / 2 - ddim_off , ptfl.y, -dleng / 2- ddim_off,  ptl.y, ddim_ext * 3);

    if( ! dchb == 0 ){
        ocvs.addDimLinear(sview, dleng / 2 + ddim_off, chf_br.ye , dleng / 2 + ddim_off, chf_br.yb, ddim_ext * -6);
    }
    
    ocvs.addDimLinear(sview, -dleng / 2, ptl.y, dleng / 2, ptl.y, ddim_ext * 6);

	// 렌더링
	ocvs.render();
}
