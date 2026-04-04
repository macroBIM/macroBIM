/*
  LIFTGING LUG를 위한 JS  v000
*/


const odxf_lug 	= dxf_generator();
const scvs_lug  = "liftinglugplot";		// canvas name


//const lug_dxf_shift;	// 옆으로 그림을 배치할 수평 간격

function liftinglug_click() {
 
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
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_liftinglug(\"sUserText\"); fdraw_liftinglug();') 	;
	
	shtml += createLabel('INPUT One by One') 	
	
    shtml += createRowInput('LUG Width', 'lugW', 120, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('LUG Height', 'lugH', 120, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('BASE Height', 'baseH', 30, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('LUG Radius', 'outerR', 40, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('INNER Hole Radius', 'innerR', 10, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('PADEYE Radius', 'padeyeR', 30, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('LUG Thickness', 'lugT', 20, 'fdraw_liftinglug()');			// see liftinglug.js
    shtml += createRowInput('PADEYE Thickness', 'padeyeT', 30, 'fdraw_liftinglug()');			// see liftinglug.js
	
    shtml += "                  </div>";
    shtml += "              </div>";

	// [고정] card-footer는 flex-shrink-0에 의해 절대 크기가 줄어들거나 스크롤 영역에 포함되지 않습니다.
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_lug.download(\"LiftingLug.dxf\")'>";
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
    shtml += "                  <div id='" + scvs_lug + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000;'></div>";
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

//	// 드래그 기능 활성화 함수 호출
//	initDraggable(document.getElementById("floating_img_win"), document.getElementById("floating_header"));	// see common.js
    
    // 초기 드로잉 실행
    fdraw_liftinglug();
	
}


	// 입력 필드에서 값을 읽어옵니다.
	function getParams_liftinglug() {
		// 값을 가져오는 헬퍼 함수
		const getValue = (id) => {
			const el = document.getElementById(id);
			return el ? Number(el.value) : 0;
		};

		// 1. aparam 객체 생성
		let aparam = {
			lugW: getValue('lugW'),
			lugH: getValue('lugH'), 
			baseH: getValue('baseH'), 
			outerR: getValue('outerR'),
			innerR: getValue('innerR'), 
			padeyeR: getValue('padeyeR'),
			lugT: getValue('lugT'),
			padeyeT: getValue('padeyeT')
		};
		
		// 3. b와 e의 모든 value만 뽑아서 쉼표로 연결된 텍스트 생성
		// b의 모든 값들 + e의 모든 값들을 하나의 배열로 합친 뒤 join 합니다.
		let combText = [
			...Object.values(aparam)
		].join(',');


		// 4. 결과 반환 (combinedText 추가)
		return { aparam, combText };
	}

	function putParams_liftinglug(textareaId) {
		const textarea = document.getElementById(textareaId);
		if (!textarea) return;

		// 1. 엔터 키(줄바꿈)를 기준으로 첫 번째 줄(Begin)과 두 번째 줄(End) 분리
		const lines = textarea.value.split('\n');
		//if (lines.length < 2) return; // 최소 두 줄이 있어야 함

		// 2. 각 줄을 쉼표(,)로 분리하여 배열 생성
		const values = lines[0].split(',');
		//const dseg_leng = lines[1];

		// 3. 매칭될 ID 리스트 (getParams에서 정의한 순서와 동일해야 함)
		const keys = [
			'lugW', 'lugH', 'baseH', 'outerR', 'innerR', 'padeyeR', 'lugT', 'padeyeT'
		];

		// 4. 각각의 input 태그에 값 할당 (_s 와 _e)
		keys.forEach((key, index) => {
			// 단면값 넣기
			if (values[index] !== undefined) {
				const elS = document.getElementById( key );
				if (elS) elS.value = values[index].trim();
			}			
		});


		// 5. 값이 변경된 후 도면 갱신이 필요하다면 호출
		if (typeof fdraw_liftinglug === 'function') {
			fdraw_liftinglug();
		}
	}


    // Canvas에 러그 도면을 그립니다.
    function fdraw_liftinglug() {

		var dDimgap = 15;

		/*		
			Load data
		*/		
		let auserdata = getParams_liftinglug();

		let aparam = auserdata.aparam;
				
		let ouserTextArea = document.getElementById('sUserText');

		if (ouserTextArea) {
			ouserTextArea.value = auserdata.combText ;
		}	

		// data loading
        let { innerR, padeyeR, outerR, lugW, lugH, baseH, lugT, padeyeT } = aparam;



	/*		
			--- data check
	*/		

        // 입력 값 검증 _ 음수 방지
		if (innerR <= 0 || padeyeR <= 0 || outerR <= 0 || lugW <= 0 || lugH <= 0 || baseH <= 0 || lugT <= 0 || padeyeT <= 0) {
            return;
        }

		// lug 폭이 lug radius 보다 작으면 안됨
		if( lugW / 2 < outerR ){

			lugW = outerR * 2;			
			document.getElementById('lugW').min = lugW;
			document.getElementById('lugW').value = lugW;
			
		}

        // 입력 값 검증 _ padeye 반지름은 hole보다 커야하고, outerR은 padeye와 hole 보다 커야함
		document.getElementById('padeyeR').min = innerR;
		document.getElementById('padeyeR').max = outerR;
		
        if ( padeyeR < innerR || outerR < innerR || outerR < padeyeR ) {
            return;
        }

        // 입력 값 검증 _ 높이 제한 : lugH 는 outerR + baseh 보다 커야함
		const minRequiredHeight = outerR + padeyeR + baseH;
		
		document.getElementById('lugH').min = minRequiredHeight;
		
        if ( lugH < minRequiredHeight ) {						
			lugH = minRequiredHeight;
            return;
        }
		
        // 입력 값 검증 _ 두께 제한 : padeye thick 는 lug thick보다 작지 않다.
		document.getElementById('padeyeT').min = lugT;


	/*		
			--- 좌표 계산 ---
	*/		

		var dRx = 0;
        var dRy = ( lugH - outerR ) ;

		var dTxl, dTyl, dTxr, dTyr, darcb, darce;

		// base 계산
		
		var dPbaselx = -lugW / 2;
		var dPbasely = 0;

		var dPbaserx =  lugW / 2;
		var dPbasery = 0;

		var dPbase1lx = -lugW / 2;
		var dPbase1ly = baseH;

		var dPbase1rx =  lugW / 2;
		var dPbase1ry = baseH;

		//		원의 접점 계산 : 하부폭이 outerR 보다 클 경우
		if( lugW / 2 >= outerR ){
			
			const dx 	= lugW / 2;
			const ddiag = Math.sqrt( dx * dx + (dRy - baseH) * (dRy - baseH) );
			const dTL 	= Math.sqrt( ddiag * ddiag - outerR * outerR );

			//		각도 1, 2 계산
			const dang1 = Math.atan( Math.abs( dRy - baseH ) / dx );
			const dang2 = Math.atan( outerR / dTL ) ;
			const dang 	= dang1 + dang2;

			dTlx	= -1 * lugW / 2 + dTL * Math.cos( dang );
			dTly	= (baseH + dTL * Math.sin( dang )) ;
			
			dTrx	= dTlx * -1;
			dTry	= dTly;

			// 		호 각도 계산
			darcb	= Math.atan( ( Math.abs(dTly) - Math.abs( dRy ) ) / Math.abs( dTlx ) ) ;
			darce	= (Math.PI - darcb) ;

		}else{
			
			const dx 	= lugW / 2;
			const ddiag = Math.sqrt( dx * dx + (dRy - baseH) * (dRy - baseH) );
			const dTL 	= Math.sqrt( ddiag * ddiag - outerR * outerR );
			
			//		각도 1, 2 계산
			const dang1 = Math.atan( Math.abs( dRy - baseH ) / dx );
			const dang2 = Math.atan( outerR / dTL ) ;
			const dang 	= Math.PI - ( dang1 + dang2 );

			dTlx	= -lugW / 2 + dTL * Math.cos( dang  );
			dTly	= (baseH + dTL * Math.sin( dang )) ;

			dTrx	= dTlx * -1;
			dTry	= dTly;

			// 		호 각도 계산
			darcb	= -1 * Math.atan( Math.abs( Math.abs(dTly) - Math.abs( dRy ) ) / Math.abs( dTlx) ) ;
			darce	= (Math.PI - darcb) ;
			
		}

		darcb = darcb * 180 / Math.PI;
		darce = darce * 180 / Math.PI;

	/*		
		PLOTLY CANVAS : activate & draw
	*/		
		var ocvs	= PlotlyViewer(scvs_lug, true, "black");
		
        // 레이어
        ocvs.addLayer('lug_outline', 'cyan', 'solid', 2);
        ocvs.addLayer('lug_hidden', 'cyan', 'hidden', 1.5);
        ocvs.addLayer('padeye_outline', 'green', 'solid', 2);
        ocvs.addLayer('padeye_hidden', 'green', 'hidden', 1.5);
        ocvs.addLayer('lug_center', 'red', 'solid', 2);

		//**
		// front view
		//**

		// add inner hole / padeye
        ocvs.addCircle('front', dRx, dRy, innerR, 'lug_outline');
        ocvs.addCircle('front', dRx, dRy, padeyeR, 'padeye_outline');
        
		// out line
        ocvs.addLine('front', dTlx, dTly, dPbase1lx, dPbase1ly, 'lug_outline');
        ocvs.addLine('front', dPbase1lx, dPbase1ly, dPbaselx, dPbasely, 'lug_outline');
        ocvs.addLine('front', dPbaselx, dPbasely, dPbaserx, dPbasery, 'lug_outline');
        ocvs.addLine('front', dPbaserx, dPbasery, dPbase1rx, dPbase1ry, 'lug_outline');
        ocvs.addLine('front', dPbase1rx, dPbase1ry, dTrx, dTry, 'lug_outline');

        ocvs.addArc('front', dRx, dRy, outerR, darcb, darce, 'lug_outline');

		//	dimensions
			ocvs.addDimRadius('front', dRx, dRy, outerR, 120);		
			ocvs.addDimRadius('front', dRx, dRy, innerR, 0);		
			ocvs.addDimRadius('front', dRx, dRy, padeyeR, 45);		

			ocvs.addDimLinear('front', dPbaselx, dPbasely, dPbaselx, lugH, dDimgap);
			ocvs.addDimLinear('front', dPbaserx, dPbasery, dPbase1rx, dPbase1ry, -dDimgap);
			ocvs.addDimLinear('front', dPbase1rx, dPbase1ry, dPbase1rx, lugH, -dDimgap);

			ocvs.addDimLinear('front', dPbaselx, dPbasely, dPbaserx, dPbasery, -dDimgap);

		//**
		// side view
		//**
        ocvs.addLine('side', -lugT/2, lugH, lugT/2, lugH, 'lug_outline');
        ocvs.addLine('side', -lugT/2, 	   0,  lugT/2,     0, 'lug_outline');
        ocvs.addLine('side', -lugT/2,     0, -lugT/2, lugH, 'lug_outline');
        ocvs.addLine('side',   lugT/2, 	0, lugT/2, lugH, 'lug_outline');
		
        ocvs.addLine('side', -lugT/2, 	baseH,  lugT/2,  baseH, 'lug_outline');
		
		//	padeye
        ocvs.addLine('side', -padeyeT/2, dRy + padeyeR, -lugT/2, dRy + padeyeR, 'padeye_outline');
        //ocvs.addLine('side', -lugT/2, dRy + padeyeR, lugT/2, dRy + padeyeR, 'padeye_hidden');
        ocvs.addLine('side',  lugT/2, dRy + padeyeR, padeyeT/2, dRy + padeyeR, 'padeye_outline');
		
        ocvs.addLine('side', -padeyeT/2, dRy - padeyeR, -lugT/2, dRy - padeyeR, 'padeye_outline');
        //ocvs.addLine('side', -lugT/2, dRy - padeyeR, lugT/2, dRy - padeyeR, 'padeye_hidden');
        ocvs.addLine('side',  lugT/2, dRy - padeyeR, padeyeT/2, dRy - padeyeR, 'padeye_outline');
		
		//	padeye 수직 외곽
        ocvs.addLine('side', -padeyeT/2,  dRy - padeyeR, -padeyeT/2, dRy + padeyeR, 'padeye_outline');
        ocvs.addLine('side',  padeyeT/2,  dRy - padeyeR,  padeyeT/2, dRy + padeyeR, 'padeye_outline');

		//	Inner Hole
        ocvs.addLine('side', -padeyeT/2, dRy + innerR, -lugT/2, dRy + innerR, 'padeye_hidden');
        ocvs.addLine('side', -lugT/2, dRy + innerR, lugT/2, dRy + innerR, 'lug_hidden');
        ocvs.addLine('side',  lugT/2, dRy + innerR, padeyeT/2, dRy + innerR, 'padeye_hidden');
		
        ocvs.addLine('side', -padeyeT/2, dRy - innerR, -lugT/2, dRy - innerR, 'padeye_hidden');
        ocvs.addLine('side', -lugT/2, dRy - innerR, lugT/2, dRy - innerR, 'lug_hidden');
        ocvs.addLine('side',  lugT/2, dRy - innerR, padeyeT/2, dRy - innerR, 'padeye_hidden');

			ocvs.addDimLinear('side', -padeyeT/2,  dPbasely, -padeyeT/2, lugH, dDimgap*2);
			ocvs.addDimLinear('side',  padeyeT/2,  dPbasery,  padeyeT/2, dPbase1ry, -dDimgap*2);
			ocvs.addDimLinear('side',  padeyeT/2, dPbase1ry, padeyeT/2, lugH, -dDimgap*2);
			
			//padeye 
			ocvs.addDimLinear('side', -padeyeT/2,  dRy - padeyeR, -padeyeT/2, dRy + padeyeR, dDimgap);
			//inner hole
			ocvs.addDimLinear('side',  padeyeT/2,  dRy - innerR, padeyeT/2, dRy + innerR, -dDimgap);


		//**
		// top view
		//**
        ocvs.addLine('top', -lugW/2, -lugT/2 , lugW/2, -lugT/2, 'lug_outline');
        ocvs.addLine('top', -lugW/2,  lugT/2 , lugW/2,  lugT/2, 'lug_outline');
        ocvs.addLine('top', -lugW/2, -lugT/2 , -lugW/2, lugT/2, 'lug_outline');
        ocvs.addLine('top',  lugW/2, -lugT/2 ,   lugW/2, lugT/2, 'lug_outline');
		
		//		inner hole
        ocvs.addLine('top', -innerR, -padeyeT / 2, -innerR,  padeyeT / 2, 'lug_hidden');		
        ocvs.addLine('top',  innerR, -padeyeT / 2,   innerR, padeyeT / 2, 'lug_hidden');
		
		//		padeye
        ocvs.addLine('top', -padeyeR, -padeyeT / 2, -padeyeR, -lugT / 2, 'padeye_outline');
        //ocvs.addLine('top', -padeyeR, -lugT / 2, -padeyeR,  lugT / 2, 'padeye_hidden');
        ocvs.addLine('top', -padeyeR,  lugT / 2, -padeyeR,  padeyeT / 2, 'padeye_outline');
		
        ocvs.addLine('top',  padeyeR, -padeyeT / 2, padeyeR, -lugT / 2, 'padeye_outline');
        //ocvs.addLine('top',  padeyeR, -lugT / 2, padeyeR,  lugT / 2, 'padeye_hidden');
        ocvs.addLine('top',  padeyeR,  lugT / 2, padeyeR,  padeyeT / 2, 'padeye_outline');
		
		//		외곽선
        ocvs.addLine('top', -padeyeR, padeyeT / 2,  padeyeR, padeyeT / 2, 'padeye_outline');
        ocvs.addLine('top', -padeyeR, -padeyeT / 2,  padeyeR, -padeyeT / 2, 'padeye_outline');

			// 하면 수평
			ocvs.addDimLinear('top',  -lugW/2,  -padeyeT / 2,  lugW/2, -padeyeT / 2, -dDimgap*2);
			// padeye
			ocvs.addDimLinear('top',  -padeyeR,  -padeyeT / 2,  padeyeR, -padeyeT / 2, -dDimgap);
			// inner hole
			ocvs.addDimLinear('top',  -innerR,  padeyeT / 2,  innerR, padeyeT / 2, dDimgap);
			// thickness left
			ocvs.addDimLinear('top',  -lugW/2,   -padeyeT/ 2,  -lugW/2, padeyeT / 2, dDimgap);
			// thickness right
			ocvs.addDimLinear('top',   lugW/2,   -lugT/ 2,   lugW/2, lugT / 2, -dDimgap);


		//**
		// bottom view
		//**
        ocvs.addLine('bottom', -lugW/2, -lugT/2 , lugW/2, -lugT/2, 'lug_outline');
        ocvs.addLine('bottom', -lugW/2,  lugT/2 , lugW/2,  lugT/2, 'lug_outline');
        ocvs.addLine('bottom', -lugW/2, -lugT/2 , -lugW/2, lugT/2, 'lug_outline');
        ocvs.addLine('bottom',  lugW/2, -lugT/2 ,   lugW/2, lugT/2, 'lug_outline');

		//		inner hole
        ocvs.addLine('bottom', -innerR, -padeyeT / 2, -innerR,  padeyeT / 2, 'lug_hidden');		
        ocvs.addLine('bottom',  innerR, -padeyeT / 2,   innerR, padeyeT / 2, 'lug_hidden');
						   
		//		padeye 
        ocvs.addLine('bottom', -padeyeR, -padeyeT / 2, -padeyeR, -lugT / 2, 'padeye_outline');
        //ocvs.addLine('bottom', -padeyeR, -lugT / 2, -padeyeR,  lugT / 2, 'padeye_hidden');
        ocvs.addLine('bottom', -padeyeR,  lugT / 2, -padeyeR,  padeyeT / 2, 'padeye_outline');
						   
        ocvs.addLine('bottom',  padeyeR, -padeyeT / 2, padeyeR, -lugT / 2, 'padeye_outline');
        //ocvs.addLine('bottom',  padeyeR, -lugT / 2, padeyeR,  lugT / 2, 'padeye_hidden');
        ocvs.addLine('bottom',  padeyeR,  lugT / 2, padeyeR,  padeyeT / 2, 'padeye_outline');
		

		//		외곽선
        ocvs.addLine('bottom', -padeyeR, padeyeT / 2,  padeyeR, padeyeT / 2, 'padeye_outline');
        ocvs.addLine('bottom', -padeyeR, -padeyeT / 2,  padeyeR, -padeyeT / 2, 'padeye_outline');

			// 하면 수평
			ocvs.addDimLinear('bottom',  -lugW/2,  -padeyeT / 2,  lugW/2, -padeyeT / 2, -dDimgap*2);
			// padeye
			ocvs.addDimLinear('bottom',  -padeyeR,  -padeyeT / 2,  padeyeR, -padeyeT / 2, -dDimgap);
			// inner hole
			ocvs.addDimLinear('bottom',  -innerR,  padeyeT / 2,  innerR, padeyeT / 2, dDimgap);
			// thickness left
			ocvs.addDimLinear('bottom',  -lugW/2,   -padeyeT/ 2,  -lugW/2, padeyeT / 2, dDimgap);
			// thickness right
			ocvs.addDimLinear('bottom',   lugW/2,   -lugT/ 2,   lugW/2, lugT / 2, -dDimgap);

		
		// draw
		ocvs.render();

	/*		
		DXF Preparation
	*/		

	var dDim_ext = 20;
	
	odxf_lug.init();
	odxf_lug.layer("lug_cent", 1, "CENTER");
	odxf_lug.layer("lug_hidden", 4, "HIDDEN");
	odxf_lug.layer("lug_solid", 4, "CONTINUOUS");
	odxf_lug.layer("padeye", 3, "CONTINUOUS");
	
	var dOx, dOx_side, dOx_top, dOx_bot;
	var dOy, dOy_side, dOy_top, dOy_bot;
	var dp1x, dp1y, dp2x, dp2y, dradius;
	
	//	set origin of each view
	dOx = 0						, dOy = 0;
	dOx_side = lugW * 1.5	, dOy_side = 0;
	dOx_top = 0				, dOy_top = lugH *1.5;
	dOx_bot = lugW * 1.5	, dOy_bot = lugH *1.5;

	/**
		front view
	**/
		// 1. 좌측 하단 코너 (dlug_left, dlug_bottom)에서 시작하여 위로 직선
		dp1x = dOx + dTlx			, dp1y = dOy + dTly;
		dp2x = dOx + dPbase1lx	, dp2y = dOy + dPbase1ly;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx + dPbase1lx	, dp1y = dOy + dPbase1ly;
		dp2x = dOx + dPbaselx		, dp2y = dOy + dPbasely;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx + dPbaselx		, dp1y = dOy + dPbasely;
		dp2x = dOx + dPbaserx		, dp2y = dOy + dPbasery;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		dp1x = dOx + dPbaserx		, dp1y = dOy + dPbasery;
		dp2x = dOx + dPbase1rx	, dp2y = dOy + dPbase1ry;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx + dPbase1rx	, dp1y = dOy + dPbase1ry;
		dp2x = dOx + dTrx			, dp2y = dOy + dTry;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		dp1x = dOx 			, dp1y = dOy + lugH - outerR;
		odxf_lug.arc(dp1x, dp1y, outerR, darcb, darce, "lug_solid");		
		
		// inner Hole
		dp1x = dOx 			, dp1y = dOy + lugH - outerR;
		odxf_lug.circle(dp1x, dp1y, innerR, "lug_solid");					
		
		// padeye hole
		dp1x = dOx 			, dp1y = dOy + lugH - outerR;
		odxf_lug.circle(dp1x, dp1y, padeyeR, "padeye");			

			// 중심선
			dp1x = dOx 			, dp1y = dOy - dDim_ext
			dp2x = dOx 			, dp2y = dOy + lugH + dDim_ext;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
			
			dp1x = dOx - lugW/2 - dDim_ext	, dp1y = dOy + lugH - outerR;
			dp2x = dOx + lugW/2 + dDim_ext	, dp2y = dOy + lugH - outerR;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			

	/**
		side view
	**/
		// 외곽선
		dp1x = dOx_side - lugT/2			, dp1y = dOy_side + 0;
		dp2x = dOx_side + lugT/2 			, dp2y = dOy_side + 0;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_side + lugT/2			, dp1y = dOy_side + 0;
		dp2x = dOx_side + lugT/2 			, dp2y = dOy_side + lugH;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
	
		dp1x = dOx_side + lugT/2 			, dp1y = dOy_side + lugH;
		dp2x = dOx_side - lugT/2 			, dp2y = dOy_side + lugH;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_side - lugT/2 			, dp1y = dOy_side + lugH;
		dp2x = dOx_side - lugT/2 			, dp2y = dOy_side + 0;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		// 하부 base
		dp1x = dOx_side - lugT/2			, dp1y = dOy_side + baseH;
		dp2x = dOx_side + lugT/2 			, dp2y = dOy_side + baseH;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		// padeye left vertical
		dp1x = dOx_side - padeyeT/2			, dp1y = dOy_side + lugH -outerR - padeyeR;
		dp2x = dOx_side - padeyeT/2			, dp2y = dOy_side + lugH -outerR + padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		// padeye left vertical
		dp1x = dOx_side + padeyeT/2		, dp1y = dOy_side + lugH -outerR - padeyeR;
		dp2x = dOx_side + padeyeT/2		, dp2y = dOy_side + lugH -outerR + padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
		
		// padeye hori
		dp1x = dOx_side - padeyeT/2		, dp1y = dOy_side + lugH -outerR + padeyeR;
		dp2x = dOx_side - lugT/2			, dp2y = dOy_side + lugH -outerR + padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_side + padeyeT/2	, dp1y = dOy_side + lugH -outerR + padeyeR;
		dp2x = dOx_side + lugT/2			, dp2y = dOy_side + lugH -outerR + padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_side - padeyeT/2		, dp1y = dOy_side + lugH -outerR - padeyeR;
		dp2x = dOx_side - lugT/2			, dp2y = dOy_side + lugH -outerR - padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_side + padeyeT/2	, dp1y = dOy_side + lugH -outerR - padeyeR;
		dp2x = dOx_side + lugT/2			, dp2y = dOy_side + lugH -outerR - padeyeR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
		
		// inner hole
		dp1x = dOx_side - padeyeT/2				, dp1y = dOy_side + lugH -outerR - innerR;
		dp2x = dOx_side + padeyeT/2			, dp2y = dOy_side + lugH -outerR - innerR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			

		dp1x = dOx_side - padeyeT/2				, dp1y = dOy_side + lugH -outerR + innerR;
		dp2x = dOx_side + padeyeT/2			, dp2y = dOy_side + lugH -outerR + innerR;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
		
			// 중심선
			dp1x = dOx_side 			, dp1y = dOy_side - dDim_ext
			dp2x = dOx_side 			, dp2y = dOy_side + lugH + dDim_ext;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
			
			dp1x = dOx_side - padeyeT/2 - dDim_ext	, dp1y = dOy_side + lugH - outerR;
			dp2x = dOx_side + padeyeT/2 + dDim_ext	, dp2y = dOy_side + lugH - outerR;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			

	/**
		top view
	**/
		// 외곽선
		dp1x = dOx_top - lugW/2			, dp1y = dOy_top -lugT/2;
		dp2x = dOx_top + lugW/2 			, dp2y = dOy_top -lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		dp1x = dOx_top + lugW/2			, dp1y = dOy_top -lugT/2;
		dp2x = dOx_top + lugW/2 			, dp2y = dOy_top +lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_top + lugW/2			, dp1y = dOy_top +lugT/2;
		dp2x = dOx_top - lugW/2 			, dp2y = dOy_top +lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_top - lugW/2			, dp1y = dOy_top +lugT/2;
		dp2x = dOx_top - lugW/2 			, dp2y = dOy_top -lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");	

		// padeye
		dp1x = dOx_top - padeyeR		, dp1y = dOy_top - padeyeT/2;
		dp2x = dOx_top + padeyeR		, dp2y = dOy_top - padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_top - padeyeR		, dp1y = dOy_top + padeyeT/2;
		dp2x = dOx_top + padeyeR		, dp2y = dOy_top + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		// padeye vert
		dp1x = dOx_top - padeyeR		, dp1y = dOy_top - padeyeT/2;
		dp2x = dOx_top - padeyeR		, dp2y = dOy_top - lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_top - padeyeR		, dp1y = dOy_top + padeyeT/2;
		dp2x = dOx_top - padeyeR		, dp2y = dOy_top + lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_top + padeyeR		, dp1y = dOy_top - padeyeT/2;
		dp2x = dOx_top + padeyeR		, dp2y = dOy_top - lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_top + padeyeR		, dp1y = dOy_top + padeyeT/2;
		dp2x = dOx_top + padeyeR		, dp2y = dOy_top + lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		// inner vert
		dp1x = dOx_top - innerR		, dp1y = dOy_top - padeyeT/2;
		dp2x = dOx_top - innerR		, dp2y = dOy_top + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			

		dp1x = dOx_top + innerR		, dp1y = dOy_top - padeyeT/2;
		dp2x = dOx_top + innerR		, dp2y = dOy_top + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			

			// 중심선
			dp1x = dOx_top 			, dp1y = dOy_top - padeyeT/2 - dDim_ext
			dp2x = dOx_top 			, dp2y = dOy_top + padeyeT/2 + dDim_ext;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
			
			dp1x = dOx_top - lugW/2 - dDim_ext	, dp1y = dOy_top + 0;
			dp2x = dOx_top + lugW/2 + dDim_ext	, dp2y = dOy_top + 0;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
		
	/**
		bot view
	**/
		// 외곽선
		dp1x = dOx_bot - lugW/2			, dp1y = dOy_bot -lugT/2;
		dp2x = dOx_bot + lugW/2 			, dp2y = dOy_bot -lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
		
		dp1x = dOx_bot + lugW/2			, dp1y = dOy_bot -lugT/2;
		dp2x = dOx_bot + lugW/2 			, dp2y = dOy_bot +lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_bot + lugW/2			, dp1y = dOy_bot +lugT/2;
		dp2x = dOx_bot - lugW/2 			, dp2y = dOy_bot +lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			

		dp1x = dOx_bot - lugW/2			, dp1y = dOy_bot +lugT/2;
		dp2x = dOx_bot - lugW/2 			, dp2y = dOy_bot -lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");	

		// padeye
		dp1x = dOx_bot - padeyeR		, dp1y = dOy_bot - padeyeT/2;
		dp2x = dOx_bot + padeyeR		, dp2y = dOy_bot - padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_bot - padeyeR		, dp1y = dOy_bot + padeyeT/2;
		dp2x = dOx_bot + padeyeR		, dp2y = dOy_bot + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		// padeye vert
		dp1x = dOx_bot - padeyeR		, dp1y = dOy_bot - padeyeT/2;
		dp2x = dOx_bot - padeyeR		, dp2y = dOy_bot - lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_bot - padeyeR		, dp1y = dOy_bot + padeyeT/2;
		dp2x = dOx_bot - padeyeR		, dp2y = dOy_bot + lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_bot + padeyeR		, dp1y = dOy_bot - padeyeT/2;
		dp2x = dOx_bot + padeyeR		, dp2y = dOy_bot - lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		dp1x = dOx_bot + padeyeR		, dp1y = dOy_bot + padeyeT/2;
		dp2x = dOx_bot + padeyeR		, dp2y = dOy_bot + lugT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			

		// inner vert
		dp1x = dOx_bot - innerR		, dp1y = dOy_bot - padeyeT/2;
		dp2x = dOx_bot - innerR		, dp2y = dOy_bot + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			

		dp1x = dOx_bot + innerR		, dp1y = dOy_bot - padeyeT/2;
		dp2x = dOx_bot + innerR		, dp2y = dOy_bot + padeyeT/2;
		odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			

			// 중심선
			dp1x = dOx_bot 			, dp1y = dOy_bot - padeyeT/2 - dDim_ext
			dp2x = dOx_bot 			, dp2y = dOy_bot + padeyeT/2 + dDim_ext;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
			
			dp1x = dOx_bot - lugW/2 - dDim_ext	, dp1y = dOy_bot + 0;
			dp2x = dOx_bot + lugW/2 + dDim_ext	, dp2y = dOy_bot + 0;
			odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");				


    }
