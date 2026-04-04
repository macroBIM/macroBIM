/*
		1 cell box 작도를 위한 JS  v000
*/
const odxf_box1cell 	= dxf_generator();
const scvs_box1cell  = "box1cellplot";		// canvas name

function box1cell_click() {
 

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
	shtml += "                  <button class='btn btn-sm btn-outline-light' onclick='toggleDimensionImage()'>VIEW GUIDE</button>";
	shtml += "              </div>";	

	// [핵심] flex-grow-1을 주어 남은 공간을 다 차지하게 하고, 이 영역에만 스크롤을 발생시킵니다.
	shtml += "              <div class='card-body overflow-auto flex-grow-1' style='min-height: 0; padding-bottom: 0;'>"; 
	shtml += "                  <div class='pe-1'>";
	
	shtml += createInputText_box1cell('sUserText', 'BATCH INPUT (CSV)', "") 	

	shtml += createLabel('INPUT One by One') 		
	
	shtml += createInputLabel_box1cell('Variable', 'Begin Section', "End Section") 	
    shtml += createInputRow_box1cell('h', 'dh_s', 6600, 'dh_e', 8000);
    shtml += createInputRow_box1cell('bt', 'dbt_s', 12000, 'dbt_e', 12000);
    shtml += createInputRow_box1cell('bb', 'dbb_s', 6000, 'dbb_e', 6000);
    shtml += createInputRow_box1cell('btsh', 'dbth_s', 1500, 'dbth_e', 1500);	// b1
    shtml += createInputRow_box1cell('bcanh', 'dbch_s', 1500, 'dbch_e', 1500);	// b2
    shtml += createInputRow_box1cell('bcan', 'dbc_s', 1500, 'dbc_e', 1500);	// b3
	
    shtml += createInputRow_box1cell('t1', 'dt1_s', 300, 'dt1_e', 300);	
    shtml += createInputRow_box1cell('t2', 'dt2_s', 300, 'dt2_e', 300);	
    shtml += createInputRow_box1cell('t3', 'dt3_s', 600, 'dt3_e', 600);	
    shtml += createInputRow_box1cell('t4', 'dt4_s', 600, 'dt4_e', 600);	
    shtml += createInputRow_box1cell('t5', 'dt5_s', 300, 'dt5_e', 300);	
    shtml += createInputRow_box1cell('t6', 'dt6_s', 300, 'dt6_e', 300);	
    shtml += createInputRow_box1cell('tb', 'dtb_s', 840, 'dtb_e', 840);	
    shtml += createInputRow_box1cell('tw', 'dtw_s', 500, 'dtw_e', 500);	
	
    shtml += createInputRow_box1cell('bh', 'dbbh_s', 200, 'dbbh_e', 200);	
    shtml += createInputRow_box1cell('vh1', 'dbh1_s', 200, 'dbh1_e', 200);	
    shtml += createInputRow_box1cell('vh2', 'dbh2_s', 100, 'dbh2_e', 100);	
	
    shtml += createInputRow_box1cell('rwt (0, if not necessary)', 'drwt_s', 300, 'drwt_e', 300);	
    shtml += createInputRow_box1cell('rwtin (0, if not necessary)', 'drwtin_s', 200, 'drwtin_e', 200);	
    shtml += createInputRow_box1cell('rb (0, if not necessary)', 'drb_s', 400, 'drb_e', 400);	
	
    shtml += createInputRow_box1cell('sl_tl (%)', 'dsltl_s', -2, 'dsltl_e', -2);	
    shtml += createInputRow_box1cell('sl_tr (%)', 'dsltr_s', 5, 'dsltr_e', 5);	
    shtml += createInputRow_box1cell('sl_b (%)', 'dslb_s', 3, 'dslb_e', 3);	

    shtml += createInputRow_box1cell('Seg Length', 'dseg_leng', 5000, '', );	
	
    shtml += "                  </div>";
    shtml += "              </div>";
	shtml += "      	</div>";

	// [고정] card-footer는 flex-shrink-0에 의해 절대 크기가 줄어들거나 스크롤 영역에 포함되지 않습니다.
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_box1cell.download(\"Box1Cell.dxf\")'>";
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
    shtml += "                  <div id='" + scvs_box1cell + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";

	// 2. [추가] 드래그 가능한 플로팅 이미지 창
	// z-index를 높게 설정하여 모든 요소 위에 뜨게 합니다.
	shtml += "<div id='floating_img_win' style='display:none; position: fixed; top: 100px; left: 50%; transform: translateX(-50%); width: 500px; background: white; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); z-index: 9999; overflow: hidden;'>";

	// 드래그 핸들이 될 헤더
	shtml += "  <div id='floating_header' style='padding: 10px 15px; background: #343a40; color: white; cursor: move; display: flex; justify-content: space-between; align-items: center; user-select: none;'>";
	shtml += "      <span style='font-size: 0.85rem; font-weight: bold;'>Dimension Guide</span>";
	shtml += "      <span style='cursor: pointer; font-size: 20px; line-height: 1;' onclick='toggleDimensionImage()'>&times;</span>"; // X 버튼
	shtml += "  </div>";

	// 이미지 영역
	shtml += "  <div style='padding: 10px; text-align: center; background: #f8f9fa;'>";
	shtml += "      <img src='/images/box1cell_vars.png' style='max-width: 100%; height: auto; display: block; border: 1px solid #ddd;'>";
	shtml += "  </div>";

	shtml += "</div>";
	
    omain.innerHTML = shtml;

	// 드래그 기능 활성화 함수 호출
	initDraggable(document.getElementById("floating_img_win"), document.getElementById("floating_header"));	// see common.js

    // 초기 드로잉 실행
    fdraw_box1cell();
	
}


	// 1. 숫자 입력창 (input)
	function createInputLabel_box1cell(label1, label2, label3) {
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
	function createInputRow_box1cell( label, svar1 , val1, svar2, val2) {
		
		let stext = `
		<div class='row mb-2 align-items-center'>
			<label class='col-4 col-form-label text-muted' style='font-size: 0.85rem;'>
				${label}
			</label>
			<div class='col-4'>
				<input type='number' id='${svar1}' 
					class='form-control form-control-sm text-center' 
					value='${val1}' min='0' required 
					onchange='fdraw_box1cell()'
					style='font-size: 0.85rem;'>
			</div>`;
			
		if( svar2 !== "" && svar2 !== undefined && svar2 !== null ){
			
			stext +=` 
			<div class='col-4'>
				<input type='number' id='${svar2}' 
					class='form-control form-control-sm text-center' 
					value='${val2}' min='0' required 
					onchange='fdraw_box1cell()'
					style='font-size: 0.85rem;'>
			</div>		
		</div>`;		
		
		}
			
		return stext;
	}

	// 2. 텍스트 입력창 (textarea)
	function createInputText_box1cell(id, label, val) {
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
					/* 값 변경 시 fdraw_box1cell() 실행 */
					onchange="putParams_box1cell('${id}'); fdraw_box1cell()"
					style='
						resize: none;         /* 크기 조절 불가 */
						overflow-y: auto;    /* 스크롤 가능 */
						overflow-x: auto;    /* 스크롤 가능 */
						width: 100%;         /* 너비 100% */
						white-space: pre;
						/* --- 폰트 통일 핵심 설정 --- */
						font-family: inherit; /* 일반 텍스트와 같은 폰트 사용 */
						font-size: 0.85rem;    /* 글자 크기 통일 */
						padding: 8px;         /* 내부 여백 조절 */
					'
				>${val}</textarea>
			</div>
		</div>`;
	}

	// 입력 필드에서 값을 읽어옵니다.
	function getParams_box1cell() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		// 1. aparam_b 객체 생성
		let aparam_b = {
			dh: getValue('dh_s'), dbt: getValue('dbt_s'), dbb: getValue('dbb_s'),
			dbth: getValue('dbth_s'), dbch: getValue('dbch_s'), dbc: getValue('dbc_s'),
			dt1: getValue('dt1_s'), dt2: getValue('dt2_s'), dt3: getValue('dt3_s'),
			dt4: getValue('dt4_s'), dt5: getValue('dt5_s'), dt6: getValue('dt6_s'),
			dtb: getValue('dtb_s'), dtw: getValue('dtw_s'),
			dbbh: getValue('dbbh_s'), dbh1: getValue('dbh1_s'), dbh2: getValue('dbh2_s'),
			drwt: getValue('drwt_s'), drwtin: getValue('drwtin_s'), drb: getValue('drb_s'),
			dsltl: getValue('dsltl_s'), dsltr: getValue('dsltr_s'), dslb: getValue('dslb_s')
		};

		// 2. aparam_e 객체 생성
		let aparam_e = {
			dh: getValue('dh_e'), dbt: getValue('dbt_e'), dbb: getValue('dbb_e'),
			dbth: getValue('dbth_e'), dbch: getValue('dbch_e'), dbc: getValue('dbc_e'),
			dt1: getValue('dt1_e'), dt2: getValue('dt2_e'), dt3: getValue('dt3_e'),
			dt4: getValue('dt4_e'), dt5: getValue('dt5_e'), dt6: getValue('dt6_e'),
			dtb: getValue('dtb_e'), dtw: getValue('dtw_e'),
			dbbh: getValue('dbbh_e'), dbh1: getValue('dbh1_e'), dbh2: getValue('dbh2_e'),
			drwt: getValue('drwt_e'), drwtin: getValue('drwtin_e'), drb: getValue('drb_e'),
			dsltl: getValue('dsltl_e'), dsltr: getValue('dsltr_e'), dslb: getValue('dslb_e')
		};

		let dseg_leng = getValue('dseg_leng');

		// 3. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		// b의 모든 값들 + e의 모든 값들을 하나의 배열로 합친 뒤 join 합니다.
		let combText_b = [
			...Object.values(aparam_b)
		].join(',');

		let combText_e = [
			...Object.values(aparam_e)
		].join(',');

		// 4. 결과 반환 (combinedText 추가)
		return { aparam_b, aparam_e, dseg_leng, combText_b, combText_e };
	}

	function putParams_box1cell(textareaId) {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		// 1. 엔터 키(줄바꿈)를 기준으로 첫 번째 줄(Begin)과 두 번째 줄(End) 분리
		const lines = textarea.value.split('\n');
		if (lines.length < 3) return; // 최소 세 줄이 있어야 함

		// 2. 각 줄을 쉼표(,)로 분리하여 배열 생성
		const values_b = lines[0].split(',');
		const values_e = lines[1].split(',');
		const dseg_leng = lines[2];

		// 3. 매칭될 ID 리스트 (getParams에서 정의한 순서와 동일해야 함)
		const keys = [
			'dh', 'dbt', 'dbb', 'dbth', 'dbch', 'dbc', 
			'dt1', 'dt2', 'dt3', 'dt4', 'dt5', 'dt6', 
			'dtb', 'dtw', 'dbbh', 'dbh1', 'dbh2', 
			'drwt', 'drwtin', 'drb', 'dsltl', 'dsltr', 'dslb'
		];

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

		// 5. 값이 변경된 후 도면 갱신이 필요하다면 호출
		if (typeof fdraw_box1cell === 'function') {
			fdraw_box1cell();
		}
	}

function fdraw_box1cell(){

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

	var ocvs	= PlotlyViewer(scvs_box1cell, true, "black");

	// 레이어
	var alayer = ['box1cell_solid', 'box1cell_hidden', 'box1cell_center'];
	
	ocvs.addLayer( alayer[0], 'cyan', 'solid', 1.5);
	ocvs.addLayer( alayer[1], 'cyan', 'hidden', 1.5);
	ocvs.addLayer( alayer[2], 'red',  'solid', 1.5);

	/*		
		DXF Preparation
	*/		
	odxf_box1cell.init();
	odxf_box1cell.layer( alayer[0], 4, "CONTINUOUS");
	odxf_box1cell.layer( alayer[1], 4, "HIDDEN");
	odxf_box1cell.layer( alayer[2], 1, "CENTER");

	/*		
		Load data
	*/		
	let auserdata = getParams_box1cell();

	let aparam_b = auserdata.aparam_b;

	let aparam_e = auserdata.aparam_e;
	       
	let dseg_leng = auserdata.dseg_leng;  
	
	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        // 백틱(`)을 사용하면 코드 상에서 엔터를 치는 것만으로도 줄바꿈이 적용됩니다.
        ouserTextArea.value = auserdata.combText_b + "\n" + auserdata.combText_e  + "\n" + dseg_leng;
    }	

	// calculate box 1 cell
	let obox1cell_b = geo_box1cell( aparam_b );
	let obox1cell_e = geo_box1cell( aparam_e );

        function getPointByName(points, name) {
            const found = points.find(p => p.name === name);
            if (found) {
                // 현재 데이터 구조가 { pwtlin: {x,y}, name: "pwtlin" } 식이므로 
                // name을 제외한 실제 좌표 객체만 추출하여 반환합니다.
                //return found[name]; 
                // ⭐ 원본 객체의 참조를 끊고 복사본을 반환하여 원본 데이터 보호
                return { ...found[name] };
            }
            return null;
        }        	


	/*
		정면도
	*/
	let sview = 'front';

	// 시작단면
	dOx = Math.max( aparam_b.dbt, aparam_e.dbt ) * -1.0;
	
	obox1cell_b.lines.forEach( (line) => {
	  ocvs.addLine(sview, line.x1 + dOx, line.y1, line.x2 + dOx, line.y2, alayer[0] );
	  odxf_box1cell.line( line.x1 + dOx, line.y1, line.x2 + dOx, line.y2, alayer[0] );
	});
	obox1cell_b.arcs.forEach( (arc) => {
	  ocvs.addArc(sview, arc.x + dOx, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	  odxf_box1cell.arc( arc.x + dOx, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	});

	// 끝단면
	dOx = Math.max( aparam_b.dbt, aparam_e.dbt ) * 1.0;
	
	obox1cell_e.lines.forEach( (line) => {
	  ocvs.addLine(sview, line.x1 + dOx, line.y1, line.x2+ dOx, line.y2, alayer[0] );
	  odxf_box1cell.line( line.x1 + dOx, line.y1, line.x2 + dOx, line.y2, alayer[0] );
	});
	obox1cell_e.arcs.forEach( (arc) => {
	  ocvs.addArc(sview, arc.x+ dOx, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	  odxf_box1cell.arc( arc.x + dOx, arc.y, arc.r, arc.angb, arc.ange, alayer[0] );
	});


	/*
			상부 평면도
	*/
        let p1, p2;

		dOx_top	= 0;
		dOy_top	= Math.max( aparam_b.dh, aparam_e.dh, dseg_leng) * 2.0;
		
        sview = 'top';
        
        p1 = getPointByName(obox1cell_b.points, "ptc");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptc");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptl");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_b.points, "ptr");        
        p2.y = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );

        p1 = getPointByName(obox1cell_e.points, "ptl");      
        p1.y = dseg_leng / 2 * 1;
        p2 = getPointByName(obox1cell_e.points, "ptr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[0] );
        
        p1 = getPointByName(obox1cell_b.points, "pwtl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtl");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwtr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwtlin");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtlin");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwtrin");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtrin");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "ptsl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptsl");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );
        
        p1 = getPointByName(obox1cell_b.points, "ptsr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptsr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pcml");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcml");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pcmr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcmr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_top, p1.y + dOy_top, p2.x + dOx_top, p2.y + dOy_top, alayer[1] );
       
        
	/*
			하부 평면도
	*/
		
		dOx_bot	= Math.max( aparam_b.dbt, aparam_e.dbt, dseg_leng ) * 4.0;
		dOy_bot	= Math.max( aparam_b.dh,  aparam_e.dh, dseg_leng ) * 2.0;
		
        sview = 'bottom';
        
        p1 = getPointByName(obox1cell_b.points, "pbl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbl");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );
       
        p1 = getPointByName(obox1cell_b.points, "pbr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_b.points, "pbr");        
        p2.y = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );

        p1 = getPointByName(obox1cell_e.points, "pbl");      
        p1.y = dseg_leng / 2 * 1;
        p2 = getPointByName(obox1cell_e.points, "pbr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[0] );        

        p1 = getPointByName(obox1cell_b.points, "pwblin");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwblin");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwbrin");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwbrin");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbsl");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbsl");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbsr");      
        p1.y = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbsr");        
        p2.y = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );      
		odxf_box1cell.line( p1.x + dOx_bot, p1.y + dOy_bot, p2.x + dOx_bot, p2.y + dOy_bot, alayer[1] );
		
	/*
			측면도
	*/
		
		dOx_side	= Math.max( aparam_b.dbt, aparam_e.dbt, dseg_leng ) * 4.0;
		dOy_side	= 0.0;
		
        sview = 'side';
		
        //  중앙
        p1 = getPointByName(obox1cell_b.points, "ptc");      
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptc");        
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbc");      
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbc");        
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptc");      
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_b.points, "pbc");        
        p2.x = dseg_leng / 2 * -1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_e.points, "ptc");      
        p1.x = dseg_leng / 2 * 1;
        p2 = getPointByName(obox1cell_e.points, "pbc");        
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );
        
        p1 = getPointByName(obox1cell_b.points, "ptsc");      
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptsc");        
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );
        
        p1 = getPointByName(obox1cell_b.points, "pbsc");      
        p1.x = dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbsc");        
        p2.x = dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side, p1.y + dOy_side, p2.x + dOx_side, p2.y + dOy_side, alayer[0] );

        // 좌측 left view
        dOx = dseg_leng * -1.5;
		
        p1 = getPointByName(obox1cell_b.points, "ptc");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptc");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbc");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbc");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
        
        if( aparam_b.dsltl >= 0 ){
          p1 = getPointByName(obox1cell_b.points, "ptc");      
        } else {
          p1 = getPointByName(obox1cell_b.points, "ptl");
        }
        
        if( aparam_b.dslb * 1 >= 0 ){      
          p2 = getPointByName(obox1cell_b.points, "pbl");        
        } else {
          p2 = getPointByName(obox1cell_b.points, "pbc");
        }
		p1.x = dOx + dseg_leng / 2 * -1;
		p2.x = dOx + dseg_leng / 2 * -1;
		ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );   
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
        
        if( aparam_e.dsltl * 1 >= 0 ){
          p1 = getPointByName(obox1cell_e.points, "ptc");      
        } else {
          p1 = getPointByName(obox1cell_e.points, "ptl");
        }
        
        if( aparam_e.dslb * 1 >= 0 ){          
          p2 = getPointByName(obox1cell_e.points, "pbl");        
        } else {
          p2 = getPointByName(obox1cell_e.points, "pbc");
        }
        p1.x = dOx + dseg_leng / 2 * 1;
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
        
        p1 = getPointByName(obox1cell_b.points, "ptl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pcl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pcml");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcml");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pwtl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptsl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptsl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );
        
        p1 = getPointByName(obox1cell_b.points, "pwtlin");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtlin");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwblin");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwblin");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbhl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbhl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbsl");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbsl");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );
        

        // 우측
        dOx = dseg_leng * 1.5;
        p1 = getPointByName(obox1cell_b.points, "ptc");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptc");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbc");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbc");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
        
        if( aparam_b.dsltr >= 0 ){
          p1 = getPointByName(obox1cell_b.points, "ptr");      
        } else {
          p1 = getPointByName(obox1cell_b.points, "ptc");
        }
        
        if( aparam_b.dslb * 1 >= 0 ){      
          p2 = getPointByName(obox1cell_b.points, "pbc");        
        } else {
          p2 = getPointByName(obox1cell_b.points, "pbr");
        }
          p1.x = dOx + dseg_leng / 2 * -1;
          p2.x = dOx + dseg_leng / 2 * -1;
          ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );   
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );
        
        if( aparam_e.dsltr * 1 >= 0 ){
          p1 = getPointByName(obox1cell_e.points, "ptr");      
        } else {
          p1 = getPointByName(obox1cell_e.points, "ptc");
        }
        
        if( aparam_e.dslb * 1 >= 0 ){          
          p2 = getPointByName(obox1cell_e.points, "pbc");        
        } else {
          p2 = getPointByName(obox1cell_e.points, "pbr");
        }
        p1.x = dOx + dseg_leng / 2 * 1;
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );        
        
        p1 = getPointByName(obox1cell_b.points, "ptr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pcr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pcmr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pcmr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pwtr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "pbr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0] );  
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[0] );

        p1 = getPointByName(obox1cell_b.points, "ptsr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "ptsr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );
        
        p1 = getPointByName(obox1cell_b.points, "pwtrin");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwtrin");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pwbrin");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pwbrin");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbhr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbhr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );     
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );

        p1 = getPointByName(obox1cell_b.points, "pbsr");      
        p1.x = dOx + dseg_leng / 2 * -1;
        p2 = getPointByName(obox1cell_e.points, "pbsr");        
        p2.x = dOx + dseg_leng / 2 * 1;
        ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[1] );       
		odxf_box1cell.line( p1.x + dOx_side + dOx, p1.y + dOy_side, p2.x + dOx_side + dOx, p2.y + dOy_side, alayer[1] );


	// Rendering
	ocvs.render();		
}


function geo_box1cell( {dbt, dbb, dh, dbth, dbch, dbc, dt1, dt2, dt3, dt4, dt5, dt6, dtb, dtw, dbbh, dbh1, dbh2, drwt, drwtin, drb, dsltl, dsltr, dslb } ){

  let dx, dy; 
  let p1 = {x:0, y:0};
  let p2 = {x:0, y:0};
  let p3 = {x:0, y:0};
  let p4 = {x:0, y:0};
  
  let opts = [];   // 치수선 출력을 위한 좌표
  let olines  = [];   // 좌표 및 실선/히든
  let oarcs   = [];
  
  //lines.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y });
  //arcs.push({
  //    x: pbr.x - drb,
  //   y: pbr.y + drb,
  //    r: drb,
  //    angb: 270,
  //    ange: 360
  // });
  
  let ptc = {x:0, y:0};  //
    opts.push({ptc, name:"ptc"});
  let pbc = {x:0, y:-dh};  //
    opts.push({pbc, name:"pbc"});
  let ptsc = {x:0, y: -dt1};  //
    opts.push({ptsc, name:"ptsc"});
  let pbsc = {x:0, y:-dh + dtb};  //
    opts.push({pbsc, name:"pbsc"});

  dy = dbt / 2 * -1 * dsltl / 100;
  let ptl = {x: dbt / 2 * -1, y: dy };  //
    opts.push({ptl, name:"ptl"});  
  let pcl = {x: dbt / 2 * -1, y: dy - dt6 };  //
    opts.push({pcl, name:"pcl"});
  
  dy = dbt / 2 *  1 * dsltr / 100;
  let ptr = {x: dbt / 2 *  1, y: dy };  //
    opts.push({ptr, name:"ptr"});  
  let pcr = {x: dbt / 2 *  1, y: dy - dt6 };  //
    opts.push({pcr, name:"pcr"});

  // bottom
  dy = dbb / 2 * -1 * dslb / 100;
  let pbl = {x: dbb / 2 * -1, y: dh * -1 + dy };  //
    opts.push({pbl, name:"pbl"});  
  dy = dbb / 2 *  1 * dslb / 100;
  let pbr = {x: dbb / 2 *  1, y: dh * -1 + dy };  //
    opts.push({pbr, name:"pbr"});
  
  // cantilever
  dx  = dbt / 2 * -1 + dbc;
  dy  = dx * dsltl / 100 - dt5 ;
  let pcml = {x: dx, y: dy };  //
    opts.push({pcml, name:"pcml"});
  dx  = dbt / 2 * 1 - dbc;
  dy  = dx * dsltr / 100 - dt5 ;
  let pcmr = {x: dx, y: dy };  //
    opts.push({pcmr, name:"pcmr"});
  
  dx  = dbt / 2 * -1 + dbc + dbch;
  dy  = dx * dsltl / 100 - dt4 ;
  let pwtl = {x: dx, y: dy };  //
    opts.push({pwtl, name:"pwtl"});
  
  dx  = dbt / 2 * 1 - dbc - dbch;
  dy  = dx * dsltr / 100 - dt4 ;
  let pwtr = {x: dx, y: dy };  //
    opts.push({pwtr, name:"pwtr"});
  
  // web line 계산 
  let lwebl, lwebr;
  
  if( pwtl.x >= pbl.x ){	  
	lwebl = geo_offset( pwtl, pbl, -dtw);
  }else{
	lwebl = geo_offset( pwtl, pbl, dtw);
  }
  if( pwtr.x >= pbr.x ){	  
	lwebr = geo_offset( pbr, pwtr, dtw);
  }else{
	lwebr = geo_offset( pbr, pwtr, -dtw);
  }
    
  // slope line
  let ltsl  = geo_offset( ptl, ptc, -dt3);
  let ltsr  = geo_offset( ptc, ptr, -dt3);
  
  p1.x = lwebl.x1;
  p1.y = lwebl.y1;
  p2.x = lwebl.x2;
  p2.y = lwebl.y2;
  p3.x = ltsl.x1;
  p3.y = ltsl.y1;
  p4.x = ltsl.x2;
  p4.y = ltsl.y2;
   
  let pwtlin = geo_intersect( p1, p2, p3, p4 );
    opts.push({pwtlin, name:"pwtlin"});
  
  dx = pwtlin.x + dbth;
  dy = dx * dsltl / 100 - dt2;
  let ptsl = {x: dx ,y:dy};
    opts.push({ptsl, name:"ptsl"});

  p1.x = lwebr.x1;
  p1.y = lwebr.y1;
  p2.x = lwebr.x2;
  p2.y = lwebr.y2;
  p3.x = ltsr.x1;
  p3.y = ltsr.y1;
  p4.x = ltsr.x2;
  p4.y = ltsr.y2;
   
  let pwtrin = geo_intersect( p1, p2, p3, p4 );
    opts.push({pwtrin, name:"pwtrin"});

  dx = pwtrin.x - dbth;
  dy = dx * dsltr / 100 - dt2;
  let ptsr = {x: dx ,y:dy};
    opts.push({ptsr, name:"ptsr"});
  
  // 하부 슬래브
  p1.x  = pbl.x;
  p1.y  = pbl.y + dtb + dbh1 + dbh2;
  p2.x  = pbr.x;
  p2.y  = pbr.y + dtb + dbh1 + dbh2;
  p3.x = lwebl.x1;
  p3.y = lwebl.y1;
  p4.x = lwebl.x2;
  p4.y = lwebl.y2;
  let pwblin = geo_intersect( p1, p2, p3, p4 );  
    opts.push({pwblin, name:"pwblin"});
  
  dx = pwblin.x + dbbh;
  dy = -dh + dslb / 100 * dx + dtb + dbh2;
  let pbhl  = {x: dx, y: dy};
    opts.push({pbhl, name:"pbhl"});  
  dy = -dh + dslb / 100 * dx + dtb;
  let pbsl  = {x: dx, y: dy};
    opts.push({pbsl, name:"pbsl"});
  
  p1.x  = pbl.x;
  p1.y  = pbl.y + dtb + dbh1 + dbh2;
  p2.x  = pbr.x;
  p2.y  = pbr.y + dtb + dbh1 + dbh2;
  p3.x = lwebr.x1;
  p3.y = lwebr.y1;
  p4.x = lwebr.x2;
  p4.y = lwebr.y2;
  let pwbrin = geo_intersect( p1, p2, p3, p4 );  
    opts.push({pwbrin, name:"pwbrin"});
  
  dx = pwbrin.x - dbbh;
  dy = -dh + dslb / 100 * dx + dtb + dbh2;
  let pbhr  = {x: dx, y: dy};
    opts.push({pbhr, name:"pbhr"});  
  dy = -dh + dslb / 100 * dx + dtb;
  let pbsr  = {x: dx, y: dy};
    opts.push({pbsr, name:"pbsr"});
  
	// fillet 계산
	// 1. 함수 상단에 변수를 먼저 선언합니다.
	let pfilwtlb, pfilwtle, pfilwtrb, pfilwtre;
	let pfilwtlinb, pfilwtline, pfilwtrinb, pfilwtrine;
	let pfilwblb, pfilwble, pfilwbrb, pfilwbre;
  
	if( drwt !== 0){
		let filwtl = geo_fillet(pcml, pwtl, pbl, drwt);
		oarcs.push({ x:filwtl.ox, y: filwtl.oy, r:filwtl.r, angb: filwtl.angb, ange : filwtl.ange });
		let filwtr = geo_fillet(pcmr, pwtr, pbr, drwt);
		oarcs.push({ x:filwtr.ox, y: filwtr.oy, r:filwtr.r, angb: filwtr.angb, ange : filwtr.ange });
		// 아크 종점 좌표
		pfilwtlb = {x: filwtl.xb, y: filwtl.yb };
		pfilwtle = {x: filwtl.xe, y: filwtl.ye };
		pfilwtrb = {x: filwtr.xb, y: filwtr.yb };
		pfilwtre = {x: filwtr.xe, y: filwtr.ye };
	}else{
		pfilwtlb = {x: pwtl.x, y: pwtl.y };
		pfilwtle = {x: pwtl.x, y: pwtl.y };   
		pfilwtrb = {x: pwtr.x, y: pwtr.y };
		pfilwtre = {x: pwtr.x, y: pwtr.y };   
	}
  
	if( drwtin !== 0){
		let filwtlin = geo_fillet(ptsl, pwtlin, pwblin, drwtin);    
		oarcs.push({ x:filwtlin.ox, y: filwtlin.oy, r:filwtlin.r, angb: filwtlin.angb, ange : filwtlin.ange });
		let filwtrin = geo_fillet(ptsr, pwtrin, pwbrin, drwtin);    
		oarcs.push({ x:filwtrin.ox, y: filwtrin.oy, r:filwtrin.r, angb: filwtrin.angb, ange : filwtrin.ange });
		// 아크 종점 좌표
		pfilwtlinb = {x: filwtlin.xb, y: filwtlin.yb };
		pfilwtline = {x: filwtlin.xe, y: filwtlin.ye };
		pfilwtrinb = {x: filwtrin.xb, y: filwtrin.yb };
		pfilwtrine = {x: filwtrin.xe, y: filwtrin.ye };
	}else{
		pfilwtlinb = {x: pwtlin.x, y: pwtlin.y };
		pfilwtline = {x: pwtlin.x, y: pwtlin.y };   
		pfilwtrinb = {x: pwtrin.x, y: pwtrin.y };
		pfilwtrine = {x: pwtrin.x, y: pwtrin.y };   
	}

	if( drb !== 0){
		let filwbl = geo_fillet(pwtl, pbl, pbr, drb);    
		oarcs.push({ x:filwbl.ox, y: filwbl.oy, r:filwbl.r, angb: filwbl.angb, ange : filwbl.ange });
		let filwbr = geo_fillet(pwtr, pbr, pbl, drb);    
		oarcs.push({ x:filwbr.ox, y: filwbr.oy, r:filwbr.r, angb: filwbr.angb, ange : filwbr.ange });
		// 아크 종점 좌표
		pfilwblb = {x: filwbl.xb, y: filwbl.yb };
		pfilwble = {x: filwbl.xe, y: filwbl.ye };
		pfilwbrb = {x: filwbr.xb, y: filwbr.yb };
		pfilwbre = {x: filwbr.xe, y: filwbr.ye };
	}else{
		pfilwblb = {x: pbl.x, y: pbl.y };
		pfilwble = {x: pbl.x, y: pbl.y };   
		pfilwbrb = {x: pbr.x, y: pbr.y };
		pfilwbre = {x: pbr.x, y: pbr.y };   
	}

	// 외측
	olines.push({ x1: ptl.x, y1: ptl.y, x2: ptc.x, y2: ptc.y });
	olines.push({ x1: ptc.x, y1: ptc.y, x2: ptr.x, y2: ptr.y });
	olines.push({ x1: ptl.x, y1: ptl.y, x2: pcl.x, y2: pcl.y });
	olines.push({ x1: pcl.x, y1: pcl.y, x2: pcml.x, y2: pcml.y });
	olines.push({ x1: pcml.x, y1: pcml.y, x2: pfilwtlb.x, y2: pfilwtlb.y });
	olines.push({ x1: pfilwtle.x, y1: pfilwtle.y, x2: pfilwblb.x, y2: pfilwblb.y });
	olines.push({ x1: pfilwble.x, y1: pfilwble.y, x2: pfilwbre.x, y2: pfilwbre.y });
	olines.push({ x1: pfilwbrb.x, y1: pfilwbrb.y, x2: pfilwtre.x, y2: pfilwtre.y });
	olines.push({ x1: pfilwtrb.x, y1: pfilwtrb.y, x2: pcmr.x, y2: pcmr.y });
	olines.push({ x1: pcmr.x, y1: pcmr.y, x2: pcr.x, y2: pcr.y });
	olines.push({ x1: pcr.x, y1: pcr.y, x2: ptr.x, y2: ptr.y });

	// 내측
	olines.push({ x1: ptsc.x, y1: ptsc.y, x2: ptsl.x, y2: ptsl.y });
	olines.push({ x1: ptsl.x, y1: ptsl.y, x2: pfilwtlinb.x, y2: pfilwtlinb.y });
	olines.push({ x1: pfilwtline.x, y1: pfilwtline.y, x2: pwblin.x, y2: pwblin.y });
	olines.push({ x1: pwblin.x, y1: pwblin.y, x2: pbhl.x, y2: pbhl.y });
	olines.push({ x1: pbhl.x, y1: pbhl.y, x2: pbsl.x, y2: pbsl.y });
	olines.push({ x1: pbsl.x, y1: pbsl.y, x2: pbsr.x, y2: pbsr.y });
	olines.push({ x1: pbsr.x, y1: pbsr.y, x2: pbhr.x, y2: pbhr.y });
	olines.push({ x1: pbhr.x, y1: pbhr.y, x2: pwbrin.x, y2: pwbrin.y });
	olines.push({ x1: pwbrin.x, y1: pwbrin.y, x2: pfilwtrine.x, y2: pfilwtrine.y });
	olines.push({ x1: pfilwtrinb.x, y1: pfilwtrinb.y, x2: ptsr.x, y2: ptsr.y });
	olines.push({ x1: ptsr.x, y1: ptsr.y, x2: ptsc.x, y2: ptsc.y });
  
	return {
		points: opts,
		lines: olines,
		arcs: oarcs
	};  
	  
// 1. 함수 호출 (매개변수에 실제 수치 입력)
//const geometry = geo_1cellbox(1000, 800, 600, 50, 50, 100, ...); 
// 2. 데이터 분리
//const myLines = geometry.lines; // [{x1, y1, x2, y2}, ...]
//const myArcs = geometry.arcs;   // [{x, y, r, angb, ange}, ...]  
// 모든 선의 좌표를 출력하거나 특정 연산을 수행할 때
//geometry.lines.forEach((line, index) => {
//    console.log(`Line ${index}:`, line.x1, line.y1, "to", line.x2, line.y2);
//});
// 모든 호(Arc)의 중심점 확인
//geometry.arcs.forEach((arc) => {
//    console.log(`중심: (${arc.x}, ${arc.y}), 반지름: ${arc.r}`);
//});  
  
}
