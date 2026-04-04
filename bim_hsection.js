/*
		H 형강 작도를 위한 JS v000
*/
const odxf_hsec 	= dxf_generator();
const scvs_hsec  = "hsecplot";		// canvas name

function hsection_click() {
	
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
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_hsection(\"sUserText\"); fdraw_hsection();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
    shtml += createRowInput('H Beam Height', 'dsech',  300, 'fdraw_hsection()');			// see liftinglug.js
    shtml += createRowInput('Top Flange Width','dbt', 300, 'fdraw_hsection()');			// see liftinglug.js
    shtml += createRowInput('Bottom Flange Width','dbb', 300, 'fdraw_hsection()');			// see liftinglug.js
    shtml += createRowInput('Web Thickness','dtw', 10, 'fdraw_hsection()');
    shtml += createRowInput('Top Flange Thickness','dttf', 15, 'fdraw_hsection()');
    shtml += createRowInput('Bottom Flange Thickness','dtbf', 15, 'fdraw_hsection()');
	
    shtml += createRowInput('Radius on Web<br> (R = 0 if not necessary)','dradius',  19, 'fdraw_hsection()');
	
    shtml += createRowInput('Beam Length','dseg_leng', 500, 'fdraw_hsection()');
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// [고정] card-footer는 flex-shrink-0에 의해 절대 크기가 줄어들거나 스크롤 영역에 포함되지 않습니다.
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_hsec.download(\"Hsection.dxf\")'>";
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
    shtml += "                  <div id='" + scvs_hsec + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
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
    fdraw_hsection();
	
}

	// 입력 필드에서 값을 읽어옵니다.
	function getParams_hsection() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		// 1. aparam 객체 생성
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

		// 3. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		// b의 모든 값들 + e의 모든 값들을 하나의 배열로 합친 뒤 join 합니다.
		let combText = [
			...Object.values(aparam)
		].join(',');


		// 4. 결과 반환 (combinedText 추가)
		return { aparam, dseg_leng, combText };
	}

	function putParams_hsection(textareaId) {
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
			'dsech', 'dbt', 'dbb', 'dtw', 'dttf', 'dtbf', 'dradius'
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
		if (typeof fdraw_hsection === 'function') {
			fdraw_hsection();
		}
	}

// Canvas에 러그 도면을 그립니다.
function fdraw_hsection() {

	/*		
		Load data
	*/		
	let auserdata = getParams_hsection();

	let aparam = auserdata.aparam;
	       
	let dleng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        // 백틱(`)을 사용하면 코드 상에서 엔터를 치는 것만으로도 줄바꿈이 적용됩니다.
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }	

	// data loading
	let { dsech, dbt, dbb, dtw, dttf, dtbf, dradius } = aparam;

	/*		
			--- data check
	*/		

	/*		
			--- 좌표 계산 ---
	*/		


	/*		
		PLOTLY CANVAS : activate & draw
	*/		

	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;
	var dp1x, dp1y, dp2x, dp2y;
	var darcb, darce;
	var dwidth;

	var ocvs			= PlotlyViewer(scvs_hsec, true, "black");

	// 레이어
	ocvs.addLayer('hsec_solid',  'cyan', 'solid', 2);
	ocvs.addLayer('hsec_hidden', 'cyan', 'hidden', 1.5);
	ocvs.addLayer('hsec_center', 'red', 'solid', 2);

	var alayer = ['hsec_solid', 'hsec_hidden', 'hsec_center'];

	/*		
		DXF Preparation
	*/		

	var ddim_ext = 20;
	var ddim_off = 20;
	
	odxf_hsec.init();
	odxf_hsec.layer("hsec_cent", 1, "CENTER");
	odxf_hsec.layer("hsec_hidden", 4, "HIDDEN");
	odxf_hsec.layer("hsec_solid", 4, "CONTINUOUS");
	odxf_hsec.layer("hsec_dim", 1, "CONTINUOUS");


	//	set origin of each view
	dOx = 0									, dOy = 0;
	dOx_side = dleng * 2			, dOy_side = 0;
	dOx_top = 0						, dOy_top = dleng * 3.0;
	dOx_bot = dleng * 2				, dOy_bot = dleng * 3.0;

	/**
		front view
	**/
	//	front
	plotly_hbeam(ocvs, 0, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_hsec.hbeam(dOx, dOy + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, "hsec_solid");

		// 상부
		dp1x = dOx - dbt / 2 	  	, dp1y = dOy + dsech + ddim_off;
		dp2x = dOx + dbt / 2		, dp2y = dOy + dsech + ddim_off;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

			//odxf_hsec.dimalign(dp1x, dp1y, dp2x, dp2y, 15 , "hsec_dim");

		// web 복부
		dp1x = dOx - dtw / 2 	  	, dp1y = dOy + dsech / 2;
		dp2x = dOx + dtw / 2		, dp2y = dOy + dsech / 2;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 1);
		
		// vertical
		dp1x = dOx - dbt / 2 - ddim_off 	  	, dp1y = dOy ;
		dp2x = dOx - dbt / 2 - ddim_off		, dp2y = dOy + dsech;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);


		dp1x = dOx - dbt / 2 - ddim_off   	, dp1y = dOy ;
		dp2x = dOx - dbt / 2 - ddim_off		, dp2y = dOy + dtbf;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

		dp1x = dp2x		,	dp1y = dp2y;
		dp2x = dp1x		,	dp2y = dOy + dsech - dttf;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

		dp1x = dp2x		,	dp1y = dp2y;
		dp2x = dp1x		,	dp2y = dOy + dsech;
		ocvs.addDimLinear('front',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);
				
		dp1x = dOx - dtw / 2 - dradius	,	dp1y = dOy + dsech - dttf - dradius;		
		ocvs.addDimRadius('front', dp1x, dp1y, dradius, 45);		
	
		dp1x = dOx - dtw / 2 - dradius	,	dp1y = dOy + dtbf + dradius;		
		ocvs.addDimRadius('front', dp1x, dp1y, dradius, -45);		
		
		
	/**
		top view
	**/
	plotly_hbeam(ocvs, 1, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_hsec.hbeam_top(dOx_top, dOy_top - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

		// vertical
		dp1x = dOx - dbt / 2 - ddim_off 	, dp1y = dOy - dleng / 2;
		dp2x = dOx - dbt / 2 - ddim_off		, dp2y = dOy + dleng / 2;
		ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

		// horizontal
		dp1x = dOx - dbt / 2 	  	, dp1y = dOy + dleng / 2 + ddim_off;
		dp2x = dOx + dbt / 2		, dp2y = dOy + dleng / 2 + ddim_off;
		ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

		dp1x = dOx - dtw / 2 	  	, dp1y = dOy + dleng / 2 + ddim_off;
		dp2x = dOx + dtw / 2		, dp2y = dOy + dleng / 2 + ddim_off;
		ocvs.addDimLinear('top',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

	/**
		bottom view
	**/
	plotly_hbeam(ocvs, 2, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_hsec.hbeam_bot(dOx_bot, dOy_bot - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

		// vertical
		dp1x = dOx - dbb / 2 - ddim_off 	, dp1y = dOy - dleng / 2;
		dp2x = dOx - dbb / 2 - ddim_off		, dp2y = dOy + dleng / 2;
		ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

		// horizontal
		dp1x = dOx - dbb / 2 	  	, dp1y = dOy + dleng / 2 + ddim_off;
		dp2x = dOx + dbb / 2		, dp2y = dOy + dleng / 2 + ddim_off;
		ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

		dp1x = dOx - dtw / 2 	  	, dp1y = dOy + dleng / 2 + ddim_off;
		dp2x = dOx + dtw / 2		, dp2y = dOy + dleng / 2 + ddim_off;
		ocvs.addDimLinear('bottom',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

	/**
		side view
	**/
	plotly_hbeam(ocvs, 3, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_hsec.hbeam_side(dOx_side, dOy_side + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "hsec_solid", "hsec_hidden");

		// vertical
		dp1x = dOx - dleng / 2 - ddim_off 		, dp1y = dOy ;
		dp2x = dOx - dleng / 2 - ddim_off		, dp2y = dOy + dsech;
		ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

			dp1x = dOx - dleng / 2 - ddim_off 		, dp1y = dOy ;
			dp2x = dOx - dleng / 2 - ddim_off		, dp2y = dOy + dtbf;
			ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

			dp1x = dOx - dleng / 2 - ddim_off 		, dp1y = dOy + dsech - dttf;
			dp2x = dOx - dleng / 2 - ddim_off		, dp2y = dOy + dsech;
			ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 3);

		// horizontal
		dp1x = dOx - dleng / 2 	  	, dp1y = dOy + dsech + ddim_off;
		dp2x = dOx + dleng / 2		, dp2y = dOy + dsech + ddim_off;
		ocvs.addDimLinear('side',  dp1x,  dp1y, dp2x, dp2y, ddim_ext * 6);

	// draw
	ocvs.render();

	
}
