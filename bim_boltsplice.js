/*
		boltsplice 위한 JS  v000
*/
const odxf_boltsplice 	= dxf_generator();
const scvs_boltsplice  = "spliceplot";		// canvas name

function boltsplice_click() {

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
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_boltsplice(\"sUserText\"); fdraw_boltsplice();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
	shtml += createLabel('1) H Beam') 	
    shtml += createRowInput('Height', 'dsech',  300, 'fdraw_boltsplice()');			// see liftinglug.js
    shtml += createRowInput('Top Flange Width','dbt', 300, 'fdraw_boltsplice()');			// see liftinglug.js
    shtml += createRowInput('Bottom Flange Width','dbb', 300, 'fdraw_boltsplice()');			// see liftinglug.js
    shtml += createRowInput('Web Thickness','dtw', 10, 'fdraw_boltsplice()');
    shtml += createRowInput('Top Flange Thickness','dttf', 15, 'fdraw_boltsplice()');
    shtml += createRowInput('Bottom Flange Thickness','dtbf', 15, 'fdraw_boltsplice()');	
    shtml += createRowInput('Fillet Radius (R = 0 if not necessary)','dradius',  18, 'fdraw_boltsplice()');

	shtml += createLabel('2) Splice Plate (Width, Length, Thick)') 	
    shtml += createRowText('Top Plate','splt',"280,300,10",'fdraw_boltsplice()');	
    shtml += createRowText('Top Inner plate','splti',"110,300,5",'fdraw_boltsplice()');	
    shtml += createRowText('Web plate','splw',"220,280,10",'fdraw_boltsplice()');	
    shtml += createRowText('Bottom Inner plate','splbi',"110,300,5",'fdraw_boltsplice()');	
    shtml += createRowText('Bottom Plate','splb',"280,300,10",'fdraw_boltsplice()');	
	
	shtml += createLabel('3) Bolt Layout on Top Plate') 	
    shtml += createRowText('Dia, Long N, Trans N','slayt',"5,12,8",'fdraw_boltsplice()');	
    shtml += createRowText('Space in Long & Trans (In, Out, In, Out)','slaytsp',"30,10,80,10",'fdraw_boltsplice()');	
	
	shtml += createLabel('4) Bolt Layout on Web Plate') 	
    shtml += createRowText('Dia, Long N, Trans N','slayw',"5,12,10",'fdraw_boltsplice()');	
    shtml += createRowText('Space in Long & Trans (In, Out, 0, Out)','slaywsp',"60,10,0,10",'fdraw_boltsplice()');	
	
	shtml += createLabel('5) Bolt Layout on Bottom Plate') 	
    shtml += createRowText('Dia, Long N, Trans N','slayb',"5,12,8",'fdraw_boltsplice()');	
    shtml += createRowText('Space in Long & Trans (In, Out, In, Out)','slaybsp',"30,10,80,10",'fdraw_boltsplice()');	
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// [고정] card-footer는 flex-shrink-0에 의해 절대 크기가 줄어들거나 스크롤 영역에 포함되지 않습니다.
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_boltsplice.download(\"BoltSplice.dxf\")'>";
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
    shtml += "                  <div id='" + scvs_boltsplice + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
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
    fdraw_boltsplice();
	
}
 
	// 입력 필드에서 값을 읽어옵니다.
	function getParams_boltsplice() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		const getText = (id) => {
			const el = document.getElementById(id);
			return el ? el.value : "";
		};

		// 1. aparam 객체 생성
		let aparam1 = {
			dsech: getValue('dsech'), dbt: getValue('dbt'), dbb: getValue('dbb'),
			dtw: getValue('dtw'), dttf: getValue('dttf'), dtbf: getValue('dtbf'), dradius: getValue('dradius')
		};

		let aparam2 = {
			splt: getText('splt'), splti: getText('splti'), splw: getText('splw'), splbi: getText('splbi'), splb: getText('splb')
		};

		let aparam3 = {
			slayt: getText('slayt'),slaytsp: getText('slaytsp'),
			slayw: getText('slayw'),slaywsp: getText('slaywsp'),
			slayb: getText('slayb'),slaybsp: getText('slaybsp')
		};
		
		// 3. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		// b의 모든 값들 + e의 모든 값들을 하나의 배열로 합친 뒤 join 합니다.
		let combText1 = [
			...Object.values(aparam1)
		].join(',');

		let combText2 = [
			...Object.values(aparam2)
		].join(',');

		let combText3 = [
			...Object.values(aparam3)
		].join(',');

		// 4. 결과 반환 (combinedText 추가)
		return { aparam1, aparam2, aparam3, combText1, combText2, combText3 };
	}

	function putParams_boltsplice(textareaId) {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		// 1. 엔터 키(줄바꿈)를 기준으로 첫 번째 줄(Begin)과 두 번째 줄(End) 분리
		const lines = textarea.value.split('\n');
		if (lines.length < 2) return; // 최소 두 줄이 있어야 함

		// 2. 각 줄 분리 및 공백 제거
		const v1 = lines[0].split(',').map(s => s.trim());
		const v2 = lines[1].split(',').map(s => s.trim());
		const v3 = lines[2].split(',').map(s => s.trim());

		// --- (1) H Beam 영역 (keys 매칭) ---
		const keys = ['dsech','dbt','dbb','dtw','dttf','dtbf','dradius'];
		keys.forEach((key, index) => {
			const el = document.getElementById(key);
			if (el && v1[index] !== undefined) el.value = v1[index];
		});

		// --- (2) Splice Plate 영역 (3개씩 묶음 처리) ---
		// 배열에서 특정 범위를 잘라내서 다시 쉼표로 합치는 방식이 안전합니다.
		const setPlateValue = (id, startIdx, count) => {
			const el = document.getElementById(id);
			if (el) {
				const segment = v2.slice(startIdx, startIdx + count);
				if (segment.length > 0) el.value = segment.join(',');
			}
		};

		setPlateValue('splt',  0, 3);
		setPlateValue('splti', 3, 3);
		setPlateValue('splw',  6, 3);
		setPlateValue('splbi', 9, 3);
		setPlateValue('splb',  12, 15); // 마지막은 넉넉하게

		// --- (3) Bolt Layout 영역 ---
		// Layout Text (3개), Space (4개) 순서대로 배치된 경우
		const setBoltValue = (id, startIdx, count) => {
			const el = document.getElementById(id);
			if (el) {
				const segment = v3.slice(startIdx, startIdx + count);
				if (segment.length > 0) el.value = segment.join(',');
			}
		};

		setBoltValue('slayt',   0, 3);
		setBoltValue('slaytsp', 3, 4);
		setBoltValue('slayw',   7, 3);
		setBoltValue('slaywsp', 10, 4);
		setBoltValue('slayb',   14, 3);
		setBoltValue('slaybsp', 17, 4);
		

//		if ( dseg_leng !== undefined) {
//			const elE = document.getElementById( "dseg_leng" );
//			if (elE) elE.value = dseg_leng;
//		}

		// 5. 값이 변경된 후 도면 갱신이 필요하다면 호출
		if (typeof fdraw_boltsplice === 'function') {
			fdraw_boltsplice();
		}
	}




// Canvas에 러그 도면을 그립니다.
function fdraw_boltsplice() {

	var dDimgap = 20;
	var dDim_ext = 20;	// for dxf

	var dtmp;

	/*		
		Load data
	*/		
	let auserdata = getParams_boltsplice();

	//let aparam1 = auserdata.aparam1;
	//let aparam2 = auserdata.aparam2;
	//let aparam3 = auserdata.aparam3;

	// 전개 연산자로 모든 파라미터를 하나로 합침
	let allParams = { 
        ...auserdata.aparam1, 
        ...auserdata.aparam2, 
        ...auserdata.aparam3 
    };
	
	let ouserTextArea = document.getElementById('sUserText');

    if (ouserTextArea) {
        // 백틱(`)을 사용하면 코드 상에서 엔터를 치는 것만으로도 줄바꿈이 적용됩니다.
        ouserTextArea.value = auserdata.combText1 + "\n" + auserdata.combText2 + "\n" + auserdata.combText3;
    }	

	// data loading
	let { dsech, dbt, dbb, dtw, dttf, dtbf, dradius, splt, splti, splw, splbi, splb, slayt, slaytsp, slayw, slaywsp, slayb, slaybsp } = allParams;
	
	var aplt 	= splt.split(",");
	var aplti 	= splti.split(",");
	var aplw 	= splw.split(",");
	var aplbi 	= splbi.split(",");
	var aplb 	= splb.split(",");
	
	var alayt 	= slayt.split(",");
	var alaytsp = slaytsp.split(",");
	var alayw 	= slayw.split(",");
	var alaywsp	= slaywsp.split(",");
	var alayb 	= slayb.split(",");
	var alaybsp	= slaybsp.split(",");

	/*		
			--- data check
	*/		

	var dleng, dsegleng, dthick, dwidth, dgap;


	/*		
		DXF Preparation
	*/			
	odxf_boltsplice.init();
	odxf_boltsplice.layer("splice_cent", 	1, "CENTER");
	odxf_boltsplice.layer("splice_hidden", 	4, "HIDDEN");
	odxf_boltsplice.layer("splice_outline", 4, "CONTINUOUS");
	odxf_boltsplice.layer("main_outline", 	254, "CONTINUOUS");
	odxf_boltsplice.layer("main_hidden", 	254, "HIDDEN");

	/*		
		PLOTLY CANVAS : activate & draw
	*/		

	var dOx, dOx_side, dOx_top, dOx_bot, dOxt;
	var dOy, dOy_side, dOy_top, dOy_bot, dOyt;
	var dp1x, dp1y, dp2x, dp2y;
	var darcb, darce;

	var dboltx, dbolty, dbolts, dbolts1, ibolt_t, ibolt_l, ddia;
	var dgap_lo, dgap_li, dgap_to, dgap_ti;
	var dbolt_ls, dbolt_ts, ibolt_l, ibolt_t;

	var sview, slayer;

	var ocvs	= PlotlyViewer(scvs_boltsplice, true, "black");

	// 레이어
	ocvs.addLayer('main_outline', 'grey', 'solid', 1);
	ocvs.addLayer('main_hidden', 'grey', 'hidden', 1);
	ocvs.addLayer('splice_outline', 'cyan', 'solid', 1.5);
	ocvs.addLayer('splice_hidden', 'cyan', 'hidden', 1.5);
	ocvs.addLayer('splice_center',   'red', 'solid', 1.5);
	
	var alayer = ['main_outline', 'main_hidden', 'splice_center'];

	//	가장 긴 길이
	dleng = Math.max( aplt[1] * 1.0, aplti[1] * 1.0, aplw[1] * 1.0, aplbi[1] * 1.0, aplb[1] * 1.0) * 2.0;
	dsegleng = dleng;

	//	set origin of each view
	dOx = 0									, dOy = 0;
	dOx_side = Math.max( dbt, dbb ) * 6		, dOy_side = 0;
	dOx_top = 0								, dOy_top = dleng * 3;
	dOx_bot = Math.max( dbt, dbb ) * 6		, dOy_bot = dleng * 3;


	/*
		H beam : 가운데 절단면 표시를 위해서 구조물 2번 작도
	*/
	//	front
	plotly_hbeam(ocvs, 0, alayer, dOx, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_boltsplice.hbeam(dOx, dOy + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, "main_solid");
	
	//	top
	dwidth	= aplt[0] * 1;
	plotly_hbeam(ocvs, 1, alayer, dOx - dbt, dOy - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );
	plotly_hbeam(ocvs, 1, alayer, dOx + dbt, dOy - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

	plotly_hbeam(ocvs, 1, alayer, dOx - dbt, dOy + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );
	plotly_hbeam(ocvs, 1, alayer, dOx + dbt, dOy + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_boltsplice.hbeam_top(dOx_top - dbt, dOy_top - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
		odxf_boltsplice.hbeam_top(dOx_top - dbt, dOy_top + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");

		odxf_boltsplice.hbeam_top(dOx_top + dbt, dOy_top - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
		odxf_boltsplice.hbeam_top(dOx_top + dbt, dOy_top + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
	
	//	bottom
	dwidth	= aplb[0] * 1;
	plotly_hbeam(ocvs, 2, alayer, dOx - dbb, dOy - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );
	plotly_hbeam(ocvs, 2, alayer, dOx + dbb, dOy - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

	plotly_hbeam(ocvs, 2, alayer, dOx - dbb, dOy + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );
	plotly_hbeam(ocvs, 2, alayer, dOx + dbb, dOy + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_boltsplice.hbeam_bot(dOx_bot - dbb, dOy_bot - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
		odxf_boltsplice.hbeam_bot(dOx_bot - dbb, dOy_bot + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");

		odxf_boltsplice.hbeam_bot(dOx_bot + dbb, dOy_bot - dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
		odxf_boltsplice.hbeam_bot(dOx_bot + dbb, dOy_bot + dleng / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
	
	//	side
	plotly_hbeam(ocvs, 3, alayer, dOx - dleng / 2, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );
	plotly_hbeam(ocvs, 3, alayer, dOx + dleng / 2, dOy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, dleng );

		// dxf
		odxf_boltsplice.hbeam_side(dOx_side - dleng / 2, dOy_side + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");
		odxf_boltsplice.hbeam_side(dOx_side + dleng / 2, dOy_side + dsech / 2, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, "main_solid", "main_hidden");

	/*
		plate front
	*/
	sview 	= "front";
	slayer 	= "splice_outline";

	//	top 
	dwidth	= aplt[0] * 1;
	dthick	= aplt[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy + dsech + dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);
	
		// dxf
		dOxt 	= dOx + 0;
		dOyt 	= dOy + dsech + dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);
	
	//	top inner left
	dwidth	= aplti[0] * 1;
	dthick	= aplti[2] * 1;
	dgap	= alaytsp[2] / 2 ;// alayt[5] / 2;
	dOxt 	= dOx - dgap + alaytsp[3] * 1 - dwidth / 2;
	dOyt 	= dOy + dsech - dttf - dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		dOyt 	= dOy + dsech - dttf - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

	//	top inner right
	dwidth	= aplti[0] * 1;
	dthick	= aplti[2] * 1;
	dgap	= alaytsp[2] / 2 ;//alayt[5] / 2;
	dOxt 	= dOx + dgap - alaytsp[3] * 1 + dwidth / 2;
	dOyt 	= dOy + dsech - dttf - dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		dOyt 	= dOy + dsech - dttf - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

	//	bot
	dwidth	= aplb[0] * 1;
	dthick	= aplb[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy - dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		dOyt 	= dOy - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

	//	bot inner left
	dwidth	= aplbi[0] * 1;
	dthick	= aplbi[2] * 1;
	dgap	= alaybsp[2] / 2 ;//alayb[5] / 2;
	dOxt 	= dOx - dgap + alaybsp[3] * 1 - dwidth / 2;
	dOyt 	= dOy + dtbf + dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		//dOyt 	= dOy - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

	//	bot inner right
	dwidth	= aplbi[0] * 1;
	dthick	= aplbi[2] * 1;
	dgap	= alaybsp[2] / 2 ;//alayb[5] / 2;
	dOxt 	= dOx + dgap - alaybsp[3] * 1 + dwidth / 2;
	dOyt 	= dOy + dtbf + dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		//dOyt 	= dOy - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);
	
	//	web plate
	dthick	= aplw[0] * 1;
	dwidth	= aplw[2] * 1;
	//dgap	= alayb[5] / 2;
	dOxt 	= dOx - dtw / 2 - dwidth / 2;
	dOyt 	= dOy + dtbf + ( dsech - dttf - dtbf ) / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		//dOyt 	= dOy - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

	dthick	= aplw[0] * 1;
	dwidth	= aplw[2] * 1;
	//dgap	= alayb[5] / 2;
	dOxt 	= dOx + dtw / 2 + dwidth / 2;
	dOyt 	= dOy + dtbf + ( dsech - dttf - dtbf ) / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dthick);

		// dxf
		//dOxt 	= dOx + 0;
		//dOyt 	= dOy - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dthick, slayer);

		// dimension
		dp1x = Math.max( dbt / 2, dbb / 2) * -1;
		dp1y = 0;
		dp2x = dp1x;
		dp2y = dp1y + dsech;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 6);

		dp1x = Math.max( dbt / 2, dbb / 2) * -1;
		dp1y = 0;
		dp2x = dp1x;
		dp2y = dp1y + dtbf;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);

		dp1x = Math.max( dbt / 2, dbb / 2) * -1;
		dp1y = dsech - dttf;
		dp2x = dp1x;
		dp2y = dp1y + dttf;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);
	
		// top flange
		dp1x = -dbt / 2;
		dp1y = dsech ;
		dp2x = dp1x + dbt;
		dp2y = dp1y ;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 6);		
		
		// bottom flange
		dp1x = -dbb / 2;
		dp1y = 0 ;
		dp2x = dp1x + dbb;
		dp2y = dp1y ;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -6);		


	/*
		plate top
	*/
	sview 	= "top";
	slayer 	= "splice_outline";
		// 상면
	dwidth	= aplt[0] * 1;
	dleng	= aplt[1] * 1;
	dOxt 	= dOx - dbt;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_top - dbt;
		dOyt 	= dOy_top ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);

		//	하면
	dwidth	= aplti[0] * 1;
	dleng	= aplti[1] * 1;
	dgap_ti = alaytsp[2] * 1; //alayt[5] * 1;
	dgap_to = alaytsp[3] * 1//alayt[6] * 1;
	
	dOxt 	= dOx + dbt - dwidth / 2 - dgap_ti / 2 + dgap_to;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_top + dbt - dwidth / 2 - dgap_ti / 2 + dgap_to;
		dOyt 	= dOy_top ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);

//	dwidth	= aplti[0] * 1;
//	dleng	= aplti[1] * 1;
	dOxt 	= dOx + dbt + dwidth / 2 + dgap_ti / 2 - dgap_to;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_top + dbt + dwidth / 2 + dgap_ti / 2 - dgap_to;
		dOyt 	= dOy_top ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);

	/*
		plate bot
	*/
	sview 	= "bottom";
	slayer 	= "splice_outline";
	
		// 하면
	dwidth	= aplb[0] * 1;
	dleng	= aplb[1] * 1;
	dOxt 	= dOx - dbb;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_bot - dbb;
		dOyt 	= dOy_bot ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);

	
		//	상면
	dwidth	= aplbi[0] * 1;
	dleng	= aplbi[1] * 1;
	dgap_ti = alaybsp[2] * 1; //alayb[5] * 1;
	dgap_to = alaybsp[3] * 1; //alayb[6] * 1;
	
	dOxt 	= dOx + dbb - dwidth / 2 - dgap_ti / 2 + dgap_to;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_bot + dbb - dwidth / 2 - dgap_ti / 2 + dgap_to;
		dOyt 	= dOy_bot ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);

	dwidth	= aplbi[0] * 1;
	dleng	= aplbi[1] * 1;
	dOxt 	= dOx + dbb + dwidth / 2 + dgap_ti / 2 - dgap_to;
	dOyt 	= dOy + 0;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dwidth, dleng);

		// dxf
		dOxt 	= dOx_bot + dbb + dwidth / 2 + dgap_ti / 2 - dgap_to;
		dOyt 	= dOy_bot ;
		odxf_boltsplice.rect(dOxt, dOyt, dwidth, dleng, slayer);


	/*
		plate side
	*/
	sview 	= "side";
	slayer 	= "splice_outline";
	
	//	top
	dleng	= aplt[1] * 1;
	dthick	= aplt[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy + dsech + dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dleng, dthick);

		// dxf
		dOxt 	= dOx_side ;
		dOyt 	= dOy_side + dsech + dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dleng, dthick, slayer);

	//	top inner
	dleng	= aplti[1] * 1;
	dthick	= aplti[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy + dsech - dttf - dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dleng, dthick);

		// dxf
		dOxt 	= dOx_side ;
		dOyt 	= dOy_side + dsech - dttf - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dleng, dthick, slayer);

	//	web
	dleng	= aplw[1] * 1;
	dwidth	= aplw[0] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy + dtbf + ( dsech - dttf - dtbf ) / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dleng, dwidth);

		// dxf
		dOxt 	= dOx_side ;
		dOyt 	= dOy_side + dtbf + ( dsech - dttf - dtbf ) / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dleng, dwidth, slayer);

	//	bot inner
	dleng	= aplbi[1] * 1;
	dthick	= aplbi[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy + dtbf + dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dleng, dthick);

		// dxf
		dOxt 	= dOx_side ;
		dOyt 	= dOy_side + dtbf + dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dleng, dthick, slayer);

	//	bot 
	dleng	= aplb[1] * 1;
	dthick	= aplb[2] * 1;
	dOxt 	= dOx + 0;
	dOyt 	= dOy - dthick / 2;
	plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dleng, dthick);
		
		// dxf
		dOxt 	= dOx_side ;
		dOyt 	= dOy_side - dthick / 2;
		odxf_boltsplice.rect(dOxt, dOyt, dleng, dthick, slayer);

		// dimension
		dp1x = -dsegleng;
		dp1y = 0;
		dp2x = dp1x;
		dp2y = dp1y + dsech;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 6);

		dp1x = -dsegleng;
		dp1y = 0;
		dp2x = dp1x;
		dp2y = dp1y + dtbf;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);

		dp1x = -dsegleng;
		dp1y = dsech - dttf;
		dp2x = dp1x;
		dp2y = dp1y + dttf;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);


	/*		
		--- bolt 계산 ---
	*/			
	/* 
		front : 상부 plate 볼트 , 좌측 상부폭만 계산하여 ctc 산정 및 배치
	*/

	sview		= "front";
	slayer		= "splice_hidden";
	
		//	top
	dwidth 		= aplt[0] * 1;
	dgap_ti 	= alaytsp[2] * 1; //alayt[5] * 1;
	dgap_to 	= alaytsp[3] * 1; //alayt[6] * 1;
	ddia 		= alayt[0] * 1;
	ibolt_t		= alayt[2] / 2;
	
	dbolt_ts	= ( dwidth / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_t - 1 );
	
	dthick		= aplt[2] * 1 + aplti[2] * 1 + dttf;	

	for( var i = 1; i <= ibolt_t; i++){

		dOxt	= dOx - dgap_ti / 2 - dbolt_ts * ( i - 1); 
		dOyt	= dOy + dsech + aplt[2] * 1 - dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);

			// dxf
			//dOxt 	= dOx + 0;
			//dOyt 	= dOy + dsech - dttf - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);

		dOxt	= dOx + dgap_ti / 2 + dbolt_ts * ( i - 1); 
		dOyt	= dOy + dsech + aplt[2] * 1 - dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);

			// dxf
			//dOxt 	= dOx + 0;
			//dOyt 	= dOy + dsech - dttf - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);
	
	}

		// dimension
		dp1x = dOx - aplt[0] / 2;
		dp1y = dsech + aplt[2] * 1;
		dp2x = dp1x + aplt[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);

			dp1x = dOx - aplt[0] / 2;
			dp1y = dsech + aplt[2] * 1;
			dp2x = dp1x + dgap_to;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dsech + aplt[2] * 1;
			dp2x = dp1x + ( dwidth - dgap_ti - dgap_to * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dsech + aplt[2] * 1;
			dp2x = dp1x + dgap_ti;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dsech + aplt[2] * 1;
			dp2x = dp1x + ( dwidth - dgap_ti - dgap_to * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dsech + aplt[2] * 1;
			dp2x = dp1x + dgap_to;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);
			
			// vertical
			dp1x = dOx + dbt / 2;
			dp1y = dsech;
			dp2x = dp1x ;
			dp2y = dp1y + aplt[2] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dOx + dbt / 2;
			dp1y = dsech - dttf - aplti[2] * 1;
			dp2x = dp1x ;
			dp2y = dp1y + aplti[2] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);
			

		//	bottom
	dwidth 		= aplb[0] * 1;
	dgap_ti 	= alaybsp[2] * 1; //alayb[5] * 1;
	dgap_to 	= alaybsp[3] * 1; //alayb[6] * 1;
	ddia 		= alayb[0] * 1;
	ibolt_t		= alayb[2] / 2;
	
	dbolt_ts	= ( dwidth / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_t - 1 );
	
	dthick		= aplb[2] * 1 + aplbi[2] * 1 + dtbf;

	for( var i = 1; i <= ibolt_t; i++){

		dOxt	= dOx - dgap_ti / 2 - dbolt_ts * ( i - 1); 
		dOyt	= dOy - aplb[2] * 1 + dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);

			// dxf
			//dOxt 	= dOx + 0;
			//dOyt 	= dOy + dsech - dttf - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);

		dOxt	= dOx + dgap_ti / 2 + dbolt_ts * ( i - 1); 
		dOyt	= dOy - aplb[2] * 1 + dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);

			// dxf
			//dOxt 	= dOx + 0;
			//dOyt 	= dOy + dsech - dttf - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);
	
	}

		// dimension
		dp1x = dOx - aplb[0] / 2;
		dp1y = -aplb[2] * 1;
		dp2x = dp1x + aplb[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

			dp1x = dOx - aplb[0] / 2;
			dp1y = - aplb[2] * 1;
			dp2x = dp1x + dgap_to;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dp2x;
			dp1y = - aplb[2] * 1;
			dp2x = dp1x + ( dwidth - dgap_ti - dgap_to * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dp2x;
			dp1y = -aplb[2] * 1;
			dp2x = dp1x + dgap_ti;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dp2x;
			dp1y = -aplb[2] * 1;
			dp2x = dp1x + ( dwidth - dgap_ti - dgap_to * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dp2x;
			dp1y = -aplb[2] * 1;
			dp2x = dp1x + dgap_to;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			// vertical
			dp1x = dOx + dbb / 2;
			dp1y = 0 - + aplb[2] * 1;
			dp2x = dp1x ;
			dp2y = dp1y + aplb[2] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

			dp1x = dOx + dbb / 2;
			dp1y = 0 + dtbf;
			dp2x = dp1x ;
			dp2y = dp1y + aplbi[2] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		//	web
	dwidth 		= aplw[0] * 1;
	dgap_ti 	= alaywsp[2] * 1; //alayw[5] * 1;
	dgap_to 	= alaywsp[3] * 1; //alayw[6] * 1;
	ddia 		= alayw[0] * 1;
	ibolt_t		= alayw[2] ;
	
	dbolt_ts	= ( dwidth - dgap_to * 2 - dgap_ti ) / ( ibolt_t - 1 );
	
	dthick		= aplw[2] * 2 + dtw;

	for( var i = 1; i <= ibolt_t; i++){

		dOxt	= dOx + 0; 
		dOyt	= dOy + dtbf + ( dsech - dttf - dtbf ) / 2 - dwidth / 2 + dgap_to + dbolt_ts * ( i - 1 );
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, dthick, ddia );

			// dxf
			//dOxt 	= dOx + 0;
			//dOyt 	= dOy + dsech - dttf - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, dthick, ddia, slayer);
	
	}


	/* 
		top bolt : 상부 plate 볼트 
	*/
	
	sview		= "top";
	slayer		= "splice_outline";

	dwidth 		= aplt[0] * 1;
	dleng 		= aplt[1] * 1;
	dgap_li 	= alaytsp[0] * 1;//alayt[3] * 1;
	dgap_lo 	= alaytsp[1] * 1;//alayt[4] * 1;
	dgap_ti 	= alaytsp[2] * 1;//alayt[5] * 1;
	dgap_to 	= alaytsp[3] * 1;//alayt[6] * 1;
	ddia 		= alayt[0] * 1;
	ibolt_t		= alayt[2] / 2;
	ibolt_l		= alayt[1] / 2;
	
	dbolt_ts	= ( dwidth / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_t - 1 );
	dbolt_ls	= ( dleng / 2  - dgap_lo - dgap_li / 2 ) / ( ibolt_l - 1 );
	
	dthick		= aplt[2] * 1 + aplti[2] * 1 + dttf;	

	for( var i = 1; i <= ibolt_l; i++){
		
		for( var j = 1; j <= ibolt_t; j++){
			
			// 상면
			dOxt	= dOx - dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top - dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top - dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top - dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top - dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)


			// 하면
			dOxt	= dOx + dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top + dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx + dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top + dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx + dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top + dbt - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx + dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_top + dbt + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_top + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)
		
		}

	}
	
	
		// dimension
		dp1x = dOx - dbt - dbt / 2;
		dp1y = -dsegleng;
		dp2x = dp1x + dbt;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dOx - dbt - aplt[0] / 2;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplt[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		// bolt
		dp1x = dOx - dbt - aplt[0] / 2;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + ( aplt[0] * 1 - dgap_ti - dgap_to * 2 ) / 2;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_ti;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + ( aplt[0] * 1 - dgap_ti - dgap_to * 2 ) / 2;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);
		
			//	vertical
			dp1x = dOx - dbb - dbb / 2;
			dp1y = -aplt[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + aplt[1] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);


			dp1x = dOx - dbt - dbt / 2;
			dp1y = -aplt[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + dgap_lo;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + ( aplt[1] * 1 - dgap_li - dgap_lo * 2 ) / 2;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + dgap_li;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + ( aplt[1] * 1 - dgap_li - dgap_lo * 2 ) / 2;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + dgap_lo;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

		// dimension
		dp1x = dOx + dbt - dbt / 2;
		dp1y = -dsegleng;
		dp2x = dp1x + dbt;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = (dOx + dbt) - dgap_ti / 2 - aplti[0] * 1 + dgap_to;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplti[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		dp1x = (dOx + dbt) + dgap_ti / 2 - dgap_to;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplti[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		dp1x = (dOx + dbt) - dgap_ti / 2 + dgap_to;
		dp1y = -dleng / 2;
		dp2x = (dOx + dbt) + dgap_ti / 2 - dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);


			//	vertical
			dp1x = dOx + dbt + dbt / 2;
			dp1y = -aplti[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + aplti[1] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);	

	/* 
		bot bolt : 하부 plate 볼트 
	*/
	sview		= "bottom";
	slayer		= "splice_outline";

	dwidth 		= aplb[0] * 1;
	dleng 		= aplb[1] * 1;
	dgap_li 	= alaybsp[0] * 1; //alayb[3] * 1;
	dgap_lo 	= alaybsp[1] * 1; //alayb[4] * 1;
	dgap_ti 	= alaybsp[2] * 1; //alayb[5] * 1;
	dgap_to 	= alaybsp[3] * 1; //alayb[6] * 1;
	ddia 		= alayb[0] * 1;
	ibolt_t		= alayb[2] / 2;
	ibolt_l		= alayb[1] / 2;
	
	dbolt_ts	= ( dwidth / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_t - 1 );
	dbolt_ls	= ( dleng / 2  - dgap_lo - dgap_li / 2 ) / ( ibolt_l - 1 );
	
	dthick		= aplt[2] * 1 + aplti[2] * 1 + dttf;	

	for( var i = 1; i <= ibolt_l; i++){
		
		for( var j = 1; j <= ibolt_t; j++){

			// 상면
			dOxt	= dOx - dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot - dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot - dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot - dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx - dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot - dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			// 하면
			dOxt	= dOx + dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot + dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx + dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot + dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot - dgap_li / 2 - dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)


			dOxt	= dOx + dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot + dbb - dgap_ti / 2 - dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOx + dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
			dOyt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_bot + dbb + dgap_ti / 2 + dbolt_ts * ( j - 1); 
				dOyt 	= dOy_bot + dgap_li / 2 + dbolt_ls * ( i - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)
		
		}

	}

		// dimension
		dp1x = dOx - dbb - dbb / 2;
		dp1y = -dsegleng;
		dp2x = dp1x + dbb;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dOx - dbb - aplb[0] / 2;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplb[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		// bolt
		dp1x = dOx - dbb - aplb[0] / 2;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + ( aplb[0] * 1 - dgap_ti - dgap_to * 2 ) / 2;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_ti;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + ( aplb[0] * 1 - dgap_ti - dgap_to * 2 ) / 2;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = dp2x;
		dp1y = -dleng / 2;
		dp2x = dp1x + dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);
		
			//	vertical
			dp1x = dOx - dbb - dbb / 2;
			dp1y = -aplb[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + aplb[1] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);


			dp1x = dOx - dbb - dbb / 2;
			dp1y = -aplb[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + dgap_lo;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + ( aplb[1] * 1 - dgap_li - dgap_lo * 2 ) / 2;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + dgap_li;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + ( aplb[1] * 1 - dgap_li - dgap_lo * 2 ) / 2;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp1x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + dgap_lo;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

		// dimension
		dp1x = dOx + dbb - dbb / 2;
		dp1y = -dsegleng;
		dp2x = dp1x + dbb;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -2);

		dp1x = (dOx + dbb) - dgap_ti / 2 - aplbi[0] * 1 + dgap_to;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplbi[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		dp1x = (dOx + dbb) + dgap_ti / 2 - dgap_to;
		dp1y = -dleng / 2;
		dp2x = dp1x + aplbi[0] * 1;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

		dp1x = (dOx + dbb) - dgap_ti / 2 + dgap_to;
		dp1y = -dleng / 2;
		dp2x = (dOx + dbb) + dgap_ti / 2 - dgap_to;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);


			//	vertical
			dp1x = dOx + dbb + dbb / 2;
			dp1y = -aplbi[1] / 2;
			dp2x = dp1x;
			dp2y = dp1y + aplbi[1] * 1;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * -4);

	

	/* 
		side : 상부 plate 볼트 , 좌측 상부폭만 계산하여 ctc 산정 및 배치
	*/

	sview		= "side";
	slayer		= "splice_hidden";
	
		//	top
	dleng 		= aplt[1] * 1;
	dgap_li 	= alaytsp[0] * 1; //alayt[3] * 1;
	dgap_lo 	= alaytsp[1] * 1; //alayt[4] * 1;
	ddia 		= alayt[0] * 1;
	ibolt_l		= alayt[1] / 2;
	
	dbolt_ls	= ( dleng / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_l - 1 );
	
	dthick		= aplt[2] * 1 + dttf + aplti[2] * 1;	

	for( var i = 1; i <= ibolt_l; i++){

		dOxt	= dOx - dgap_li / 2 - dbolt_ls * ( i - 1); 
		dOyt	= dOy + dsech + aplt[2] * 1 - dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);
			// dxf
			dOxt 	= dOx_side - dgap_li / 2 - dbolt_ls * ( i - 1); 
			dOyt 	= dOy_side + dsech + aplt[2] * 1 - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);

		dOxt	= dOx + dgap_li / 2 + dbolt_ls * ( i - 1); 
		dOyt	= dOy + dsech + aplt[2] * 1 - dthick / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);
			// dxf
			dOxt 	= dOx_side + dgap_li / 2 + dbolt_ls * ( i - 1); 
			dOyt 	= dOy_side + dsech + aplt[2] * 1 - dthick / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);
	
	}

		//	bottom
	dleng 		= aplb[1] * 1;
	dgap_li 	= alaybsp[0] * 1; //alayb[3] * 1;
	dgap_lo 	= alaybsp[1] * 1; //alayb[4] * 1;
	ddia 		= alayb[0] * 1;
	ibolt_l		= alayb[1] / 2;
	
	dbolt_ls	= ( dleng / 2 - dgap_to - dgap_ti / 2 ) / ( ibolt_l - 1 );
	
	dthick		= aplb[2] * 1 + dtbf + aplbi[2] * 1;	

	for( var i = 1; i <= ibolt_l; i++){

		dOxt	= dOx - dgap_li / 2 - dbolt_ls * ( i - 1); 
		dOyt	= dOy + dtbf / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);
			// dxf
			dOxt 	= dOx_side - dgap_li / 2 - dbolt_ls * ( i - 1); 
			dOyt 	= dOy_side + dtbf / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);

		dOxt	= dOx + dgap_li / 2 + dbolt_ls * ( i - 1); 
		dOyt	= dOy + dtbf / 2;
		plotly_rect(ocvs, sview, slayer, dOxt, dOyt, ddia, dthick);
			// dxf
			dOxt 	= dOx_side + dgap_li / 2 + dbolt_ls * ( i - 1); 
			dOyt 	= dOy_side + dtbf / 2;
			odxf_boltsplice.rect(dOxt, dOyt, ddia, dthick, slayer);
	
	}

		// web
	
	sview		= "side";
	slayer		= "splice_outline";

	dwidth 		= aplw[0] * 1;
	dleng 		= aplw[1] * 1;
	dgap_li 	= alaywsp[0] * 1; //alayw[3] * 1;
	dgap_lo 	= alaywsp[1] * 1; //alayw[4] * 1;
	dgap_ti 	= alaywsp[2] * 1; //alayw[5] * 1;
	dgap_to 	= alaywsp[3] * 1; //alayw[6] * 1;
	ddia 		= alayw[0] * 1;
	ibolt_l		= alayw[1] / 2;
	ibolt_t		= alayw[2] ;
	
	dbolt_ts	= ( dwidth - dgap_to * 2 - dgap_ti ) / ( ibolt_t - 1 );
	dbolt_ls	= ( dleng / 2  - dgap_lo - dgap_li / 2 ) / ( ibolt_l - 1 );
	
	dthick		= aplt[2] * 1 + aplti[2] * 1 + dttf;	

	for( var i = 1; i <= ibolt_l; i++){
		
		for( var j = 1; j <= ibolt_t; j++){  // 폭 (높이) 방향

			dOxt	= dOy - dgap_li / 2 - dbolt_ls * ( i - 1); 
			dOyt	= dOx + dtbf + ( dsech - dttf - dtbf ) / 2 - ( dwidth / 2 - dgap_to ) + dbolt_ts * ( j - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_side - dgap_li / 2 - dbolt_ls * ( i - 1); 
				dOyt 	= dOy_side + dtbf + ( dsech - dttf - dtbf ) / 2 - ( dwidth / 2 - dgap_to ) + dbolt_ts * ( j - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)

			dOxt	= dOy + dgap_li / 2 + dbolt_ls * ( i - 1); 
			dOyt	= dOx + dtbf + ( dsech - dttf - dtbf ) / 2 - ( dwidth / 2 - dgap_to ) + dbolt_ts * ( j - 1); 
			ocvs.addCircle(sview, dOxt, dOyt, ddia / 2, slayer);		
				// dxf
				dOxt 	= dOx_side + dgap_li / 2 + dbolt_ls * ( i - 1); 
				dOyt 	= dOy_side + dtbf + ( dsech - dttf - dtbf ) / 2 - ( dwidth / 2 - dgap_to ) + dbolt_ts * ( j - 1); 
				odxf_boltsplice.circle(dOxt, dOyt, ddia / 2, slayer)
		
		}

	}

		//	horizontal
		dp1x = dOx - dleng / 2;
		dp1y = dOy + dsech + aplt[2] * 1.5;
		dp2x = dp1x + dleng;
		dp2y = dp1y;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);

			dp1x = dOx - dleng / 2;
			dp1y = dOy + dsech + aplt[2] * 1.5;
			dp2x = dp1x + dgap_lo;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x + ( dleng - dgap_li - dgap_lo * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x + dgap_li;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x + ( dleng - dgap_li - dgap_lo * 2 ) / 2;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x + dgap_lo;
			dp2y = dp1y;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

		//	vertical
		dp1x = dOx - dleng * 1.0;
		dp1y = dOy + dtbf + ( dsech - dttf - dtbf ) / 2 - dwidth / 2;
		dp2x = dp1x;
		dp2y = dp1y + dwidth;
		ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 4);

			dp1x = dOx - dleng * 1.0;
			dp1y = dOy + dtbf + ( dsech - dttf - dtbf ) / 2 - dwidth / 2;
			dp2x = dp1x;
			dp2y = dp1y + dgap_to;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + ( dwidth - dgap_to * 2 );
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);

			dp1x = dp2x;
			dp1y = dp2y;
			dp2x = dp1x;
			dp2y = dp1y + dgap_to;
			ocvs.addDimLinear(sview, dp1x, dp1y, dp2x, dp2y, dDimgap * 2);




	/**
		draw
	**/
	ocvs.render();

	
}
