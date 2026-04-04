/*
	Channel 형강 작도를 위한 JS  v000 (KonvaViewer 적용)
*/
const odxf_channel 	= dxf_generator();
const scvs_channel  = "channelplot";		// canvas name

function channel_click() {

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
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_channel(\"sUserText\"); fdraw_channel();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
    shtml += createRowInput('Channel Height', 'dsech',  300, 'fdraw_channel()');
    shtml += createRowInput('Channel Width','db', 90, 'fdraw_channel()');
    shtml += createRowInput('Web Thickness','dtw', 12, 'fdraw_channel()');
    shtml += createRowInput('Flange Thickness','dtf', 16, 'fdraw_channel()');
    shtml += createRowInput('Radius on Web<br> (R = 0 if not necessary)','drw',  19, 'fdraw_channel()');
    shtml += createRowInput('Radius on Flange <br> (R = 0 if not necessary)','drf', 9.5, 'fdraw_channel()');
    shtml += createRowInput('Channel Length','dseg_leng', 500, 'fdraw_channel()');
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// card-footer (DXF 다운로드)
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_channel.download(\"Channel.dxf\")'>";
	shtml += "                      DXF DOWNLOAD";
	shtml += "                  </button>";
	shtml += "              </div>"; 
	shtml += "          </div>";
	
	shtml += "      </div>";
				
    // --- 오른쪽: 도면 뷰어 영역 ---
    shtml += "      <div class='col-lg-8 h-100'>";
    shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 
	// 헤더 정렬 유지
    shtml += "              <div class='card-header bg-secondary flex-shrink-0 d-flex justify-content-between align-items-center'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan)</h6>";
    
    // ⭐ 폰트 굵기(bold) 제거 및 패딩/글자 크기를 줄여서 헤더 높이 유지
    shtml += "                  <button class='btn btn-light' style='padding: 2px 8px; font-size: 12px; line-height: 1.5;' onclick='fdraw_channel()'>";
    shtml += "                      <i class='fa fa-refresh'></i> REGEN";
    shtml += "                  </button>";
    shtml += "              </div>";
	
    // ★ 마우스 커서 속성(cursor: grab) 추가
    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_channel + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";

    omain.innerHTML = shtml;

    // 초기 드로잉 실행
    fdraw_channel();
}

// 입력 필드에서 값을 읽어옵니다.
function getParams_channel() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        dh: getValue('dsech'), 
        db: getValue('db'), 
        dtw: getValue('dtw'),
        dtf: getValue('dtf'),
        drw: getValue('drw'), drf: getValue('drf')
    };
    
    let dseg_leng = getValue('dseg_leng');
    let combText = [ ...Object.values(aparam) ].join(',');

    return { aparam, dseg_leng, combText };
}

function putParams_channel(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 2) return; 

    const values = lines[0].split(',');
    const dseg_leng = lines[1];

    const keys = [ 'dsech', 'db', 'dtw', 'dtf', 'drw', 'drf' ];

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

    if (typeof fdraw_channel === 'function') {
        fdraw_channel();
    }
}


// Canvas에 도면을 그립니다.
function fdraw_channel() {

	/* Load data */		
	let auserdata = getParams_channel();
	let aparam = auserdata.aparam;
	let dleng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }	

	// data loading
	let { dh, db, dtw, dtf, drw, drf } = aparam;

	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;

	/* KONVA CANVAS : activate & draw */		
    // ★ PlotlyViewer 대신 KonvaViewer를 호출합니다!
	var ocvs = new KonvaViewer(scvs_channel);

	// 레이어
	var alayer = ['channel_solid', 'channel_hidden', 'channel_center'];
	
	ocvs.addLayer( alayer[0],  'cyan', 'solid', 1.5);
	ocvs.addLayer( alayer[1], 'cyan', 'hidden', 1.5);
	ocvs.addLayer( alayer[2], 'red', 'solid', 1.5);

	/* DXF Preparation */		
	odxf_channel.init();
	odxf_channel.layer( alayer[0], 4, "CONTINUOUS");
	odxf_channel.layer( alayer[1], 4, "HIDDEN");
	odxf_channel.layer( alayer[2], 1, "CENTER");


	let ptw   = {x:0, y:0};  // 상연 복부측
	let ptf  = {x:0, y:0};  // 상연 플랜지 끝단측
	let pbw   = {x:0, y:0};  // 하연 복부측
	let pbf  = {x:0, y:0};  // 하연 플랜지 끝단측

	let ptbf = {x:0, y:0};  // 하부 플랜지측 접점
	let ptbw = {x:0, y:0};  // 하부 복부측 접점
	let pttf = {x:0, y:0};  // 상부 플랜지측 접점
	let pttw = {x:0, y:0};  // 상부 복부측 접점

	let pit = {x:0, y:0};  // 플랜지 복부 상부 교차점
	let pib = {x:0, y:0};  // 플랜지 복부 하부 교차점

	let pwt = {x:0, y:0};  // 복부측 상단
	let pwb = {x:0, y:0};  // 복부측 하단

	let ptm = {x:0, y:0};  // 상부 플랜지 중앙
	let pbm = {x:0, y:0};  // 하부 플랜지 중앙

	let filtf = {ox:0, oy:0, r:0, angb:0, ange:0} 
	let filtw = {ox:0, oy:0, r:0, angb:0, ange:0} 
	let filbw = {ox:0, oy:0, r:0, angb:0, ange:0} 
	let filbf = {ox:0, oy:0, r:0, angb:0, ange:0} 

	var ddl, dtl;
	var dang1, dang2, dang, dangb, dange;

	dOx = 0	, dOy = 0;
	dOx_side = Math.max( dh, dleng ) * 3	, dOy_side = 0;
	dOx_top = 0									, dOy_top = Math.max( dh, dleng, db ) * 3.0;
	dOx_bot = Math.max( dh, dleng ) * 3	, dOy_bot = Math.max( dh, dleng, db ) * 3.0;

	/* 외곽선 */
	// vertical line
	pbw.x = dOx  	, pbw.y = dOy ;
	ptw.x = dOx 	, ptw.y = dOy + dh;

	// top flange
	ptf.x  = dOx + db; ptf.y = dOy + dh;

	// bottom flange
	pbf.x  = dOx + db; pbf.y = dOy;

	// 하부플랜지 중점
	pbm.x = dOx + dtw + ( db - dtw ) / 2;
	pbm.y = dOy + dtf;
	// 상부플랜지 중점
	ptm.x = dOx + dtw + ( db - dtw ) / 2;
	ptm.y = dOy + dh - dtf;        
		
	/* 하부 플랜지 필렛 */
	//  하부 DL 계산
	ddl = Math.sqrt( ( ( db - dtw ) / 2 - drf ) * (  ( db - dtw ) / 2 - drf ) + dtf * dtf ) ;
	//  하부 TL 계산
	dtl = Math.sqrt( ddl * ddl - drf * drf );

	//  각도 산정
	dang1 = Math.acos( dtf / ddl );
	dang2 = Math.acos( dtl / ddl );
	dang = Math.PI / 2 - dang1 - dang2;
	
	// 접점 산정
	ptbf.x   = pbm.x + dtl * Math.cos(dang);
	ptbf.y   = pbm.y - dtl * Math.sin(dang);

	pttf.x   = ptm.x + dtl * Math.cos(dang);
	pttf.y   = ptm.y + dtl * Math.sin(dang);

	if( drf > 0 ){
	  //  arc 작도
	  //  하부플랜지 필렛원점
	  filbf.ox = dOx + db - drf;
	  filbf.oy = dOy + 0;
	  filbf.r = drf;
	  filbf.angb = 0;
	  filbf.ange = Math.acos( ( ptbf.x - filbf.ox ) / drf ) * 180 / Math.PI ;

	  // 상부
	  filtf.ox = dOx + db - drf;
	  filtf.oy = dOy + dh;
	  filtf.r = drf;
	  filtf.ange = 0;
	  filtf.angb = Math.acos( ( pttf.x - filtf.ox ) / drf ) * 180 / Math.PI *-1 ;
	  
	} else {
	  
	  dang = 0;
	  
	  // 플랜지 끝단 산정
	  ptbf.x   = dOx + db;
	  ptbf.y   = dOy + dtf;

	  pttf.x   = dOx + db;
	  pttf.y   = dOy + dh - dtf;
				
	}

	/* 하부 복부 필렛 */
	//  1) 복부와 접점 계산
	var dx, dy, dtl2, ddl2;

	//  플랜지 중심으로부터 복부까지 대각선 거리
	dx = ( db - dtw ) / 2;
	ddl2 =  dx / Math.cos( dang );

	//  접선길이 TL2
	dtl2 = drw * Math.tan( ( Math.PI / 2 - dang ) / 2 );

	//  복부와 교점
	pwb.x = pbm.x - ( ddl2 ) * Math.cos( dang );
	pwb.y = pbm.y + ( ddl2 ) * Math.sin( dang );

	pib.x = pwb.x;
	pib.y = pwb.y;

	if( drw > 0){
	  //  복부측 하부 fillet arc
	  filbw.ox = dOx + dtw + drw;
	  filbw.oy = pwb.y + dtl2;
	  filbw.r = drw;
	  filbw.angb = 180;
	  filbw.ange = 180 + ( Math.PI / 2 - dang ) * 180 / Math.PI;
	}
	//  복부교점 및 하부접점 정확히 산정
	pwb.x = pwb.x ;
	pwb.y = pwb.y + dtl2;

	ptbw.x = pbm.x - ( ddl2 - dtl2 ) * Math.cos( dang );
	ptbw.y = pbm.y + ( ddl2 - dtl2 ) * Math.sin( dang );


	/* 상부 복부 필렛 */
	//  복부측 교점
	pwt.x = ptm.x - ddl2 * Math.cos( dang );
	pwt.y = ptm.y - ddl2 * Math.sin( dang );

	pit.x = pwt.x;
	pit.y = pwt.y;

	if( drw > 0){        
	  //  복부측 상부 fillet arc
	  filtw.ox = dOx + dtw + drw;
	  filtw.oy = pwt.y - dtl2;
	  filtw.r = drw;
	  filtw.ange = 180;
	  filtw.angb = 180 - ( Math.PI / 2 - dang ) * 180 / Math.PI;
	}

	//  복부교점 및 하부접점 정확히 산정
	pwt.x = pwt.x ;
	pwt.y = pwt.y - dtl2;

	pttw.x = ptm.x - ( ddl2 - dtl2 ) * Math.cos( dang );
	pttw.y = ptm.y - ( ddl2 - dtl2 ) * Math.sin( dang );        

	/* draw canvas */
	let ddim_ext = 20;	// 디멘젼 길이
	let ddim_off = 20;	// 구조물에서 이격
	
	let sview;
	// front
	sview = 'front';
		ocvs.addLine(sview, pbw.x, pbw.y, ptw.x, ptw.y, alayer[0] );  // verical
		ocvs.addLine(sview, ptw.x, ptw.y, ptf.x, ptf.y, alayer[0] );  // top hori
		ocvs.addLine(sview, pbw.x, pbw.y, pbf.x, pbf.y, alayer[0] );  // bottom hori
		ocvs.addLine(sview, pwb.x, pwb.y, pwt.x, pwt.y, alayer[0] );  // inner web vert
		ocvs.addLine(sview, ptbw.x, ptbw.y, ptbf.x, ptbf.y, alayer[0] );  // inner bot hori
		ocvs.addLine(sview, pttw.x, pttw.y, pttf.x, pttf.y, alayer[0] );  // inner top hori
		
		ocvs.addDimLinear(sview,  pbw.x,  pbw.y, ptw.x, ptw.y, ddim_ext * 6);

		ocvs.addDimLinear(sview,  pbw.x,  pbw.y, pbw.x, pib.y, ddim_ext * 3);
		ocvs.addDimLinear(sview,  pbw.x,  pib.y, pbw.x, pit.y, ddim_ext * 3);
		ocvs.addDimLinear(sview,  pbw.x,  pit.y, pbw.x, ptw.y, ddim_ext * 3);

		ocvs.addDimLinear(sview,  ptw.x,  ptw.y, ptf.x, ptf.y, ddim_ext * 6);
		ocvs.addDimLinear(sview,  ptw.x,  ptw.y, pit.x, ptf.y, ddim_ext * 3);
		ocvs.addDimLinear(sview,  pit.x,  ptw.y, ptf.x, ptf.y, ddim_ext * 3);
		
		ocvs.addDimLinear(sview,  ptm.x,  ptm.y, ptm.x, ptf.y, ddim_ext * -0.5);
		ocvs.addDimLinear(sview,  pbm.x,  pbw.y, pbm.x, pbm.y, ddim_ext * -0.5);
		
		odxf_channel.line( dOx + pbw.x, dOy + pbw.y, dOx + ptw.x, dOy + ptw.y, alayer[0] );
		odxf_channel.line( dOx + ptw.x, dOy + ptw.y, dOx + ptf.x, dOy + ptf.y, alayer[0] );  // top hori
		odxf_channel.line( dOx + pbw.x, dOy + pbw.y, dOx + pbf.x, dOy + pbf.y, alayer[0] );  // bottom hori
		odxf_channel.line( dOx + pwb.x, dOy + pwb.y, dOx + pwt.x, dOy + pwt.y, alayer[0] );  // inner web vert
		odxf_channel.line( dOx + ptbw.x, dOy + ptbw.y, dOx + ptbf.x, dOy + ptbf.y, alayer[0] );  // inner bot hori
		odxf_channel.line( dOx + pttw.x, dOy + pttw.y, dOx + pttf.x, dOy + pttf.y, alayer[0] );  // inner top hori

	  if( drf > 0 ){
		ocvs.addArc(sview, filbf.ox, filbf.oy, filbf.r, filbf.angb, filbf.ange, alayer[0]);
		ocvs.addArc(sview, filtf.ox, filtf.oy, filtf.r, filtf.angb, filtf.ange, alayer[0]);
		
		ocvs.addDimRadius(sview, filbf.ox, filbf.oy, filbf.r, 45);		
		
		odxf_channel.arc( dOx + filbf.ox, dOy + filbf.oy, filbf.r, filbf.angb, filbf.ange, alayer[0] );
		odxf_channel.arc( dOx + filtf.ox, dOy + filtf.oy, filtf.r, filtf.angb, filtf.ange, alayer[0] );
	  } else {
		// 플랜지 끝단 수직선
		ocvs.addLine(sview, pbf.x, pbf.y, ptbf.x, ptbf.y, alayer[0] );
		ocvs.addLine(sview, pttf.x, pttf.y, ptf.x, ptf.y, alayer[0] );
		
		odxf_channel.line( dOx + pbf.x, dOy + pbf.y, dOx + ptbf.x, dOy + ptbf.y, alayer[0] );  // inner top hori
		odxf_channel.line( dOx + pttf.x, dOy + pttf.y, dOx + ptf.x, dOy + ptf.y, alayer[0] );  // inner top hori
	  }
	  
	  if( drw > 0 ){
		ocvs.addArc(sview, filbw.ox, filbw.oy, filbw.r, filbw.angb, filbw.ange, alayer[0]);
		ocvs.addArc(sview, filtw.ox, filtw.oy, filtw.r, filtw.angb, filtw.ange, alayer[0]);

		ocvs.addDimRadius(sview, filbw.ox, filbw.oy, filbw.r, 225);		
		
		odxf_channel.arc( dOx + filbw.ox, dOy + filbw.oy, filbw.r, filbw.angb, filbw.ange, alayer[0] );
		odxf_channel.arc( dOx + filtw.ox, dOy + filtw.oy, filtw.r, filtw.angb, filtw.ange, alayer[0] );
	  }
	  
	// top
	sview = 'top';

		ocvs.addLine(sview, ptw.x, dOy - dleng / 2, ptf.x, dOy - dleng / 2, alayer[0] );  // hori
		ocvs.addLine(sview, ptw.x, dOy + dleng / 2, ptf.x, dOy + dleng / 2, alayer[0] );  // hori

		ocvs.addLine(sview, ptw.x, dOy - dleng / 2, ptw.x, dOy + dleng / 2, alayer[0] );  // verical
		ocvs.addLine(sview, ptf.x, dOy - dleng / 2, ptf.x, dOy + dleng / 2, alayer[0] );  // verical
		ocvs.addLine(sview, pwt.x, dOy - dleng / 2, pwt.x, dOy + dleng / 2, alayer[1] );  // verical

		ocvs.addDimLinear(sview,  ptw.x, dOy - dleng / 2, ptw.x, dOy + dleng / 2, ddim_ext * 6);
		
		ocvs.addDimLinear(sview,  ptw.x,  dOy + dleng / 2, ptf.x, dOy + dleng / 2, ddim_ext * 6);
		ocvs.addDimLinear(sview,  ptw.x,  dOy + dleng / 2, pit.x, dOy + dleng / 2, ddim_ext * 3);
		ocvs.addDimLinear(sview,  pit.x,  dOy + dleng / 2, ptf.x, dOy + dleng / 2, ddim_ext * 3);
		
		odxf_channel.line( dOx_top + ptw.x, dOy_top - dleng / 2, dOx_top + ptf.x, dOy_top - dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_top + ptw.x, dOy_top + dleng / 2, dOx_top + ptf.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		
		odxf_channel.line( dOx_top + ptw.x, dOy_top - dleng / 2, dOx_top + ptw.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_top + ptf.x, dOy_top - dleng / 2, dOx_top + ptf.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_top + pwt.x, dOy_top - dleng / 2, dOx_top + pwt.x, dOy_top + dleng / 2, alayer[1] );  // inner top hori		
	  
	// bottom
	sview = 'bottom';

	  ocvs.addLine(sview, pbw.x, dOy - dleng / 2, pbf.x, dOy - dleng / 2, alayer[0] );  // hori
	  ocvs.addLine(sview, pbw.x, dOy + dleng / 2, pbf.x, dOy + dleng / 2, alayer[0] );  // hori

	  ocvs.addLine(sview, pbw.x, dOy - dleng / 2, pbw.x, dOy + dleng / 2, alayer[0] );  // verical
	  ocvs.addLine(sview, pbf.x, dOy - dleng / 2, pbf.x, dOy + dleng / 2, alayer[0] );  // verical
	  ocvs.addLine(sview, pwb.x, dOy - dleng / 2, pwb.x, dOy + dleng / 2, alayer[1] );  // verical

		ocvs.addDimLinear(sview,  pbw.x, dOy - dleng / 2, pbw.x, dOy + dleng / 2, ddim_ext * 6);
		
		ocvs.addDimLinear(sview,  pbw.x,  dOy + dleng / 2, pbf.x, dOy + dleng / 2, ddim_ext * 6);
		ocvs.addDimLinear(sview,  pbw.x,  dOy + dleng / 2, pib.x, dOy + dleng / 2, ddim_ext * 3);
		ocvs.addDimLinear(sview,  pib.x,  dOy + dleng / 2, pbf.x, dOy + dleng / 2, ddim_ext * 3);
		
		odxf_channel.line( dOx_bot + pbw.x, dOy_top - dleng / 2, dOx_bot + pbf.x, dOy_top - dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_bot + pbw.x, dOy_top + dleng / 2, dOx_bot + pbf.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		
		odxf_channel.line( dOx_bot + pbw.x, dOy_top - dleng / 2, dOx_bot + pbw.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_bot + pbf.x, dOy_top - dleng / 2, dOx_bot + pbf.x, dOy_top + dleng / 2, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_bot + pwb.x, dOy_top - dleng / 2, dOx_bot + pwb.x, dOy_top + dleng / 2, alayer[1] );  // inner top hori
	  
	// side
	sview = 'side';
 
	  ocvs.addLine(sview, ptw.x - dleng / 2, ptw.y, ptw.x + dleng / 2, ptw.y , alayer[0] );  // hori
	  ocvs.addLine(sview, pbw.x - dleng / 2, pbw.y, pbw.x + dleng / 2, pbw.y , alayer[0] );  // hori
	  ocvs.addLine(sview, pbw.x - dleng / 2, pbw.y, ptw.x - dleng / 2, ptw.y , alayer[0] );  // vert
	  ocvs.addLine(sview, pbw.x + dleng / 2, pbw.y, ptw.x + dleng / 2, ptw.y , alayer[0] );  // vert
	  // 상부 교점
	  ocvs.addLine(sview, ptw.x - dleng / 2, pit.y, ptw.x + dleng / 2, pit.y , alayer[1] );  // vert
	  // 하부 교점
	  ocvs.addLine(sview, pbw.x - dleng / 2, pib.y, pbw.x + dleng / 2, pib.y , alayer[1] );  // vert
	  
		ocvs.addDimLinear(sview, dOx - dleng / 2, ptw.y, dOx + dleng / 2, ptw.y, ddim_ext * 3);

		ocvs.addDimLinear(sview, dOy - dleng / 2, pbw.y, dOy - dleng / 2, ptw.y, ddim_ext * 6);

		ocvs.addDimLinear(sview, dOy - dleng / 2, pbw.y, dOy - dleng / 2, pib.y, ddim_ext * 3);
		ocvs.addDimLinear(sview, dOy - dleng / 2, pib.y, dOy - dleng / 2, pit.y, ddim_ext * 3);
		ocvs.addDimLinear(sview, dOy - dleng / 2, pit.y, dOy - dleng / 2, ptw.y, ddim_ext * 3);

		odxf_channel.line( dOx_side - dleng / 2, dOy_side + ptw.y, dOx_side + dleng / 2, dOy_side + ptw.y, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_side - dleng / 2, dOy_side + pbw.y, dOx_side + dleng / 2, dOy_side + pbw.y, alayer[0] );  // inner top hori

		odxf_channel.line( dOx_side - dleng / 2, dOy_side + pit.y, dOx_side + dleng / 2, dOy_side + pit.y, alayer[1] );  // inner top hori
		odxf_channel.line( dOx_side - dleng / 2, dOy_side + pib.y, dOx_side + dleng / 2, dOy_side + pib.y, alayer[1] );  // inner top hori
		
		odxf_channel.line( dOx_side - dleng / 2, dOy_side + pbw.y, dOx_side - dleng / 2, dOy_side + ptw.y, alayer[0] );  // inner top hori
		odxf_channel.line( dOx_side + dleng / 2, dOy_side + pbw.y, dOx_side + dleng / 2, dOy_side + ptw.y, alayer[0] );  // inner top hori

	// regen
	ocvs.render();
}
