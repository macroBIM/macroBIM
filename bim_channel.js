/*
	Channel 형강 작도를 위한 JS  v000
*/
const odxf_channel 	= dxf_generator();
const scvs_channel  = "channelplot";		// canvas name


function channel_click() {

    // 1. 사이드바(nav) 및 메인 콘텐츠(main) 레이아웃 조정
    const sidebarNav = document.querySelector('nav.sidebar');
    const mainContent = document.getElementById('wrap_main');

//    if (sidebarNav) sidebarNav.classList.add('d-none');
//	
    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
//		
    }
    
    var omain = document.getElementById("wrap_main");	
    
    // HTML 생성
    var shtml = "";
	
	// [수정] 뷰포트 높이 계산 변경 (더 넉넉한 하단 여백 확보)
    let dynamicHeight = "calc(100vh - 100px)"; 

	shtml += "<div class='container-fluid px-4' style='height: " + dynamicHeight + "; margin-top: 10px; margin-bottom: 20px;'>";
    shtml += "  <div class='row g-3 h-100'>"; 
            
    // --- 왼쪽: 입력 폼 영역 ---
    shtml += "      <div class='col-lg-4 h-100'>"; 
	
	// 카드를 d-flex flex-column으로 설정하여 헤더-바디-푸터를 수직으로 정렬합니다.
	shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 

	// 1. 헤더에 버튼 추가 (기존 위치)
	shtml += "              <div class='card-header bg-secondary text-white flex-shrink-0 d-flex justify-content-between align-items-center'>";
	shtml += "                  <h6 class='mb-0'>DIMENSION (mm)</h6>"; 
//	shtml += "                  <button class='btn btn-sm btn-outline-light' onclick='toggleDimensionImage()'>VIEW GUIDE</button>";
	shtml += "              </div>";	

	// [핵심] flex-grow-1을 주어 남은 공간을 다 차지하게 하고, 이 영역에만 스크롤을 발생시킵니다.
	shtml += "              <div class='card-body overflow-auto flex-grow-1' style='min-height: 0; padding-bottom: 0;'>"; 
	shtml += "                  <div class='pe-1'>";
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_channel(\"sUserText\"); fdraw_channel();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
    shtml += createRowInput('Channel Height', 'dsech',  300, 'fdraw_channel()');			// see liftinglug.js
    shtml += createRowInput('Channel Width','db', 90, 'fdraw_channel()');			// see liftinglug.js
    shtml += createRowInput('Web Thickness','dtw', 12, 'fdraw_channel()');
    shtml += createRowInput('Flange Thickness','dtf', 16, 'fdraw_channel()');
	
    shtml += createRowInput('Radius on Web<br> (R = 0 if not necessary)','drw',  19, 'fdraw_channel()');
    shtml += createRowInput('Radius on Flange <br> (R = 0 if not necessary)','drf', 9.5, 'fdraw_channel()');
	
    shtml += createRowInput('Channel Length','dseg_leng', 500, 'fdraw_channel()');
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// [고정] card-footer는 flex-shrink-0에 의해 절대 크기가 줄어들거나 스크롤 영역에 포함되지 않습니다.
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_channel.download(\"Channel.dxf\")'>";
	shtml += "                      DXF DOWNLOAD";
	shtml += "                  </button>";
	shtml += "              </div>"; 
	shtml += "          </div>";
	
	shtml += "      </div>";
				
    // --- 오른쪽: 도면 뷰어 영역 (여백 제거 버전) ---
    shtml += "      <div class='col-lg-8 h-100'>";
    shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; // 라운드 코너 밖으로 도면이 나가지 않게 조절
    shtml += "              <div class='card-header bg-secondary flex-shrink-0'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW</h6>";
    shtml += "              </div>";
    
    // [수정] card-body가 flex-grow-1로서 남은 모든 하단 공간을 차지하게 함
    // 하단 푸터를 아예 삭제하여 도면이 카드 끝까지 내려오도록 설정
    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_channel + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";

	// 2. [추가] 드래그 가능한 플로팅 이미지 창
//	// z-index를 높게 설정하여 모든 요소 위에 뜨게 합니다.
//	shtml += "<div id='floating_img_win' style='display:none; position: fixed; top: 100px; left: 50%; transform: translateX(-50%); width: 500px; background: white; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999; overflow: hidden;'>";
//
//	// 드래그 핸들이 될 헤더
//	shtml += "  <div id='floating_header' style='padding: 10px 15px; background: #343a40; color: white; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none;'>";
//	shtml += "      <span style='font-size: 0.85rem; font-weight: bold;'>Dimension Guide</span>";
//	shtml += "      <span style='cursor: pointer; font-size: 20px; line-height: 1;' onclick='toggleDimensionImage()'>&times;</span>"; // X 버튼
//	shtml += "  </div>";
//
//	// 이미지 영역
//	shtml += "  <div style='padding: 10px; text-align: center; background: #f8f9fa;'>";
//	shtml += "      <img src='/images/box1cell_vars.png' style='max-width: 100%; height: auto; display: block; border: 1px solid #ddd;'>";
//	shtml += "  </div>";
//
//	shtml += "</div>";

 
    omain.innerHTML = shtml;

    // 초기 드로잉 실행
    fdraw_channel();
	
}

	// 입력 필드에서 값을 읽어옵니다.
	function getParams_channel() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		// 1. aparam 객체 생성
		let aparam = {
			dh: getValue('dsech'), 
			db: getValue('db'), 
			dtw: getValue('dtw'),
			dtf: getValue('dtf'),
			drw: getValue('drw'), drf: getValue('drf')
		};
		
		let dseg_leng = getValue('dseg_leng');

		// 3. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		// b의 모든 값들 + e의 모든 값들을 하나의 배열로 합친 뒤 join 합니다.
		let combText = [
			...Object.values(aparam)
		].join(',');


		// 4. 결과 반환 (combinedText 추가)
		return { aparam, dseg_leng, combText };
	}

	function putParams_channel(textareaId) {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		// 1. 엔터 키(줄바꿈)를 기준으로 첫 번째 줄(Begin)과 두 번째 줄(End) 분리
		const lines = textarea.value.split('\n');
		if (lines.length < 2) return; // 최소 세 줄이 있어야 함

		// 2. 각 줄을 쉼표(,)로 분리하여 배열 생성
		const values = lines[0].split(',');
		const dseg_leng = lines[1];

		// 3. 매칭될 ID 리스트 (getParams에서 정의한 순서와 동일해야 함)
		const keys = [
			'dsech', 'db', 'dtw', 'dtf', 'drw', 'drf'
		];

		// 4. 각각의 input 태그에 값 할당 (_s 와 _e)
		keys.forEach((key, index) => {
			// 단면값 넣기
			if (values[index] !== undefined) {
				const elS = document.getElementById( key );
				if (elS) elS.value = values[index].trim();
			}			
		});

		if ( dseg_leng !== undefined) {
			const elE = document.getElementById( "dseg_leng" );
			if (elE) elE.value = dseg_leng;
		}

		// 5. 값이 변경된 후 도면 갱신이 필요하다면 호출
		if (typeof fdraw_channel === 'function') {
			fdraw_channel();
		}
	}


// Canvas에 러그 도면을 그립니다.
function fdraw_channel() {

	/*		
		Load data
	*/		
	let auserdata = getParams_channel();

	let aparam = auserdata.aparam;
	       
	let dleng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        // 백틱(`)을 사용하면 코드 상에서 엔터를 치는 것만으로도 줄바꿈이 적용됩니다.
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }	

	// data loading
	let { dh, db, dtw, dtf, drw, drf } = aparam;

	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;

	/*		
			--- data check
	*/		

	/*		
			--- 좌표 계산 ---
	*/		


	/*		
		PLOTLY CANVAS : activate & draw
	*/		

	var ocvs	= PlotlyViewer(scvs_channel, true, "black");

	// 레이어
	var alayer = ['channel_solid', 'channel_hidden', 'channel_center'];
	
	ocvs.addLayer( alayer[0],  'cyan', 'solid', 1.5);
	ocvs.addLayer( alayer[1], 'cyan', 'hidden', 1.5);
	ocvs.addLayer( alayer[2], 'red', 'solid', 1.5);

	/*		
		DXF Preparation
	*/		
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

	let filtf = {ox:0, oy:0, r:0, angb:0, ange:0} //
	let filtw = {ox:0, oy:0, r:0, angb:0, ange:0} //
	let filbw = {ox:0, oy:0, r:0, angb:0, ange:0} //
	let filbf = {ox:0, oy:0, r:0, angb:0, ange:0} //

	var ddl, dtl;
	var dang1, dang2, dang, dangb, dange;

	dOx = 0	, dOy = 0;
	dOx_side = Math.max( dh, dleng ) * 3	, dOy_side = 0;
	dOx_top = 0									, dOy_top = Math.max( dh, dleng, db ) * 3.0;
	dOx_bot = Math.max( dh, dleng ) * 3	, dOy_bot = Math.max( dh, dleng, db ) * 3.0;

	/*
	  외곽선
	*/
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
		
	/*
	  하부 플랜지 필렛
	*/
	//  하부 DL 계산
	ddl = Math.sqrt( ( ( db - dtw ) / 2 - drf ) * (  ( db - dtw ) / 2 - drf ) + dtf * dtf ) ;
	//  하부 TL 계산
	dtl = Math.sqrt( ddl * ddl - drf * drf );

	//  각도 산정
	dang1 = Math.acos( dtf / ddl );
	dang2 = Math.acos( dtl / ddl );
	dang = Math.PI / 2 - dang1 - dang2;
	//alert( ddl + " " + dtl + "  " + dang1 * 180 / Math.PI )        
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

	/*
	  하부 복부 필렛
	*/
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


	/*
	  상부 복부 필렛
	*/
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

	/*
	  draw canvas
	*/
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
