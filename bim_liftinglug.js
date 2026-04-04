/*
  LIFTGING LUG를 위한 JS  v000 (Konva.js 치수선 Arrow 적용 및 4분할 동기화 & DXF 버그 수정)
*/

const odxf_lug 	= dxf_generator();
const scvs_lug  = "liftinglugplot";		// canvas name

function liftinglug_click() {
    const mainContent = document.getElementById('wrap_main');

    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
    }
    
    var omain = document.getElementById("wrap_main");	
    var shtml = "";
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
	
	shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_liftinglug(\"sUserText\"); fdraw_liftinglug();');
	shtml += createLabel('INPUT One by One');
	
    shtml += createRowInput('LUG Width', 'lugW', 120, 'fdraw_liftinglug()');
    shtml += createRowInput('LUG Height', 'lugH', 120, 'fdraw_liftinglug()');
    shtml += createRowInput('BASE Height', 'baseH', 30, 'fdraw_liftinglug()');
    shtml += createRowInput('LUG Radius', 'outerR', 40, 'fdraw_liftinglug()');
    shtml += createRowInput('INNER Hole Radius', 'innerR', 10, 'fdraw_liftinglug()');
    shtml += createRowInput('PADEYE Radius', 'padeyeR', 30, 'fdraw_liftinglug()');
    shtml += createRowInput('LUG Thickness', 'lugT', 20, 'fdraw_liftinglug()');
    shtml += createRowInput('PADEYE Thickness', 'padeyeT', 30, 'fdraw_liftinglug()');
	
    shtml += "                  </div>";
    shtml += "              </div>";
	shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
	shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_lug.download(\"LiftingLug.dxf\")'>";
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
    shtml += "                  <button class='btn btn-light' style='padding: 2px 8px; font-size: 12px; line-height: 1.5;' onclick='fdraw_liftinglug()'>";
    shtml += "                      <i class='fa fa-refresh'></i> REGEN";
    shtml += "                  </button>";
    shtml += "              </div>";
	
	shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_lug + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";
	
    omain.innerHTML = shtml;
    fdraw_liftinglug();
}

function getParams_liftinglug() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        lugW: getValue('lugW'), lugH: getValue('lugH'), baseH: getValue('baseH'), 
        outerR: getValue('outerR'), innerR: getValue('innerR'), padeyeR: getValue('padeyeR'),
        lugT: getValue('lugT'), padeyeT: getValue('padeyeT')
    };
    let combText = [ ...Object.values(aparam) ].join(',');
    return { aparam, combText };
}

function putParams_liftinglug(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    const values = lines[0].split(',');
    const keys = [ 'lugW', 'lugH', 'baseH', 'outerR', 'innerR', 'padeyeR', 'lugT', 'padeyeT' ];

    keys.forEach((key, index) => {
        if (values[index] !== undefined) {
            const elS = document.getElementById( key );
            if (elS) elS.value = values[index].trim();
        }			
    });
    if (typeof fdraw_liftinglug === 'function') fdraw_liftinglug();
}

function fdraw_liftinglug() {
    var dDimgap = 15;
    let auserdata = getParams_liftinglug();
    let aparam = auserdata.aparam;
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) { ouserTextArea.value = auserdata.combText ; }	

    let { innerR, padeyeR, outerR, lugW, lugH, baseH, lugT, padeyeT } = aparam;

    if (innerR <= 0 || padeyeR <= 0 || outerR <= 0 || lugW <= 0 || lugH <= 0 || baseH <= 0 || lugT <= 0 || padeyeT <= 0) return;

    if( lugW / 2 < outerR ){
        lugW = outerR * 2;			
        document.getElementById('lugW').min = lugW;
        document.getElementById('lugW').value = lugW;
    }
    document.getElementById('padeyeR').min = innerR;
    document.getElementById('padeyeR').max = outerR;
    if ( padeyeR < innerR || outerR < innerR || outerR < padeyeR ) return;

    const minRequiredHeight = outerR + padeyeR + baseH;
    document.getElementById('lugH').min = minRequiredHeight;
    if ( lugH < minRequiredHeight ) {						
        lugH = minRequiredHeight;
        return;
    }
    document.getElementById('padeyeT').min = lugT;

    /* --- 좌표 계산 --- */		
    var dRx = 0; var dRy = ( lugH - outerR ) ;
    var dTxl, dTyl, dTxr, dTyr, darcb, darce;
    var dPbaselx = -lugW / 2, dPbasely = 0;
    var dPbaserx =  lugW / 2, dPbasery = 0;
    var dPbase1lx = -lugW / 2, dPbase1ly = baseH;
    var dPbase1rx =  lugW / 2, dPbase1ry = baseH;

    if( lugW / 2 >= outerR ){
        const dx = lugW / 2; const ddiag = Math.sqrt( dx * dx + (dRy - baseH) * (dRy - baseH) );
        const dTL = Math.sqrt( ddiag * ddiag - outerR * outerR );
        const dang1 = Math.atan( Math.abs( dRy - baseH ) / dx );
        const dang2 = Math.atan( outerR / dTL ) ;
        const dang = dang1 + dang2;

        dTlx = -1 * lugW / 2 + dTL * Math.cos( dang ); dTly = (baseH + dTL * Math.sin( dang )) ;
        dTrx = dTlx * -1; dTry = dTly;
        darcb = Math.atan( ( Math.abs(dTly) - Math.abs( dRy ) ) / Math.abs( dTlx ) ) ; darce = (Math.PI - darcb) ;
    } else {
        const dx = lugW / 2; const ddiag = Math.sqrt( dx * dx + (dRy - baseH) * (dRy - baseH) );
        const dTL = Math.sqrt( ddiag * ddiag - outerR * outerR );
        const dang1 = Math.atan( Math.abs( dRy - baseH ) / dx );
        const dang2 = Math.atan( outerR / dTL ) ;
        const dang = Math.PI - ( dang1 + dang2 );

        dTlx = -lugW / 2 + dTL * Math.cos( dang  ); dTly = (baseH + dTL * Math.sin( dang )) ;
        dTrx = dTlx * -1; dTry = dTly;
        darcb = -1 * Math.atan( Math.abs( Math.abs(dTly) - Math.abs( dRy ) ) / Math.abs( dTlx) ) ; darce = (Math.PI - darcb) ;
    }
    darcb = darcb * 180 / Math.PI; darce = darce * 180 / Math.PI;

    /* --- KONVA 드로잉 적용 --- */		
    var ocvs = new KonvaViewer(scvs_lug);
    
    ocvs.addLayer('lug_outline', 'cyan', 'solid', 2);
    ocvs.addLayer('lug_hidden', 'cyan', 'hidden', 1.5);
    ocvs.addLayer('padeye_outline', '#00ff00', 'solid', 2);
    ocvs.addLayer('padeye_hidden', '#00ff00', 'hidden', 1.5);
    ocvs.addLayer('lug_center', 'red', 'solid', 2);

    //** front view **
    ocvs.addCircle('front', dRx, dRy, innerR, 'lug_outline');
    ocvs.addCircle('front', dRx, dRy, padeyeR, 'padeye_outline');
    ocvs.addLine('front', dTlx, dTly, dPbase1lx, dPbase1ly, 'lug_outline');
    ocvs.addLine('front', dPbase1lx, dPbase1ly, dPbaselx, dPbasely, 'lug_outline');
    ocvs.addLine('front', dPbaselx, dPbasely, dPbaserx, dPbasery, 'lug_outline');
    ocvs.addLine('front', dPbaserx, dPbasery, dPbase1rx, dPbase1ry, 'lug_outline');
    ocvs.addLine('front', dPbase1rx, dPbase1ry, dTrx, dTry, 'lug_outline');
    ocvs.addArc('front', dRx, dRy, outerR, darcb, darce, 'lug_outline');
    ocvs.addDimRadius('front', dRx, dRy, outerR, 120);		
    ocvs.addDimRadius('front', dRx, dRy, innerR, 0);		
    ocvs.addDimRadius('front', dRx, dRy, padeyeR, 45);		
    ocvs.addDimLinear('front', dPbaselx, dPbasely, dPbaselx, lugH, dDimgap);
    ocvs.addDimLinear('front', dPbaserx, dPbasery, dPbase1rx, dPbase1ry, -dDimgap);
    ocvs.addDimLinear('front', dPbase1rx, dPbase1ry, dPbase1rx, lugH, -dDimgap);
    ocvs.addDimLinear('front', dPbaselx, dPbasely, dPbaserx, dPbasery, -dDimgap);

    //** side view **
    ocvs.addLine('side', -lugT/2, lugH, lugT/2, lugH, 'lug_outline');
    ocvs.addLine('side', -lugT/2,      0,  lugT/2,     0, 'lug_outline');
    ocvs.addLine('side', -lugT/2,     0, -lugT/2, lugH, 'lug_outline');
    ocvs.addLine('side',   lugT/2,  0, lugT/2, lugH, 'lug_outline');
    ocvs.addLine('side', -lugT/2,  baseH,  lugT/2,  baseH, 'lug_outline');
    ocvs.addLine('side', -padeyeT/2, dRy + padeyeR, -lugT/2, dRy + padeyeR, 'padeye_outline');
    ocvs.addLine('side',  lugT/2, dRy + padeyeR, padeyeT/2, dRy + padeyeR, 'padeye_outline');
    ocvs.addLine('side', -padeyeT/2, dRy - padeyeR, -lugT/2, dRy - padeyeR, 'padeye_outline');
    ocvs.addLine('side',  lugT/2, dRy - padeyeR, padeyeT/2, dRy - padeyeR, 'padeye_outline');
    ocvs.addLine('side', -padeyeT/2,  dRy - padeyeR, -padeyeT/2, dRy + padeyeR, 'padeye_outline');
    ocvs.addLine('side',  padeyeT/2,  dRy - padeyeR,  padeyeT/2, dRy + padeyeR, 'padeye_outline');
    ocvs.addLine('side', -padeyeT/2, dRy + innerR, -lugT/2, dRy + innerR, 'padeye_hidden');
    ocvs.addLine('side', -lugT/2, dRy + innerR, lugT/2, dRy + innerR, 'lug_hidden');
    ocvs.addLine('side',  lugT/2, dRy + innerR, padeyeT/2, dRy + innerR, 'padeye_hidden');
    ocvs.addLine('side', -padeyeT/2, dRy - innerR, -lugT/2, dRy - innerR, 'padeye_hidden');
    ocvs.addLine('side', -lugT/2, dRy - innerR, lugT/2, dRy - innerR, 'lug_hidden');
    ocvs.addLine('side',  lugT/2, dRy - innerR, padeyeT/2, dRy - innerR, 'padeye_hidden');
    ocvs.addDimLinear('side', -padeyeT/2,  dPbasely, -padeyeT/2, lugH, dDimgap*2);
    ocvs.addDimLinear('side',  padeyeT/2,  dPbasery,  padeyeT/2, dPbase1ry, -dDimgap*2);
    ocvs.addDimLinear('side',  padeyeT/2, dPbase1ry, padeyeT/2, lugH, -dDimgap*2);
    ocvs.addDimLinear('side', -padeyeT/2,  dRy - padeyeR, -padeyeT/2, dRy + padeyeR, dDimgap);
    ocvs.addDimLinear('side',  padeyeT/2,  dRy - innerR, padeyeT/2, dRy + innerR, -dDimgap);

    //** top view **
    ocvs.addLine('top', -lugW/2, -lugT/2 , lugW/2, -lugT/2, 'lug_outline');
    ocvs.addLine('top', -lugW/2,  lugT/2 , lugW/2,  lugT/2, 'lug_outline');
    ocvs.addLine('top', -lugW/2, -lugT/2 , -lugW/2, lugT/2, 'lug_outline');
    ocvs.addLine('top',  lugW/2, -lugT/2 ,   lugW/2, lugT/2, 'lug_outline');
    ocvs.addLine('top', -innerR, -padeyeT / 2, -innerR,  padeyeT / 2, 'lug_hidden');		
    ocvs.addLine('top',  innerR, -padeyeT / 2,   innerR, padeyeT / 2, 'lug_hidden');
    ocvs.addLine('top', -padeyeR, -padeyeT / 2, -padeyeR, -lugT / 2, 'padeye_outline');
    ocvs.addLine('top', -padeyeR,  lugT / 2, -padeyeR,  padeyeT / 2, 'padeye_outline');
    ocvs.addLine('top',  padeyeR, -padeyeT / 2, padeyeR, -lugT / 2, 'padeye_outline');
    ocvs.addLine('top',  padeyeR,  lugT / 2, padeyeR,  padeyeT / 2, 'padeye_outline');
    ocvs.addLine('top', -padeyeR, padeyeT / 2,  padeyeR, padeyeT / 2, 'padeye_outline');
    ocvs.addLine('top', -padeyeR, -padeyeT / 2,  padeyeR, -padeyeT / 2, 'padeye_outline');
    ocvs.addDimLinear('top',  -lugW/2,  -padeyeT / 2,  lugW/2, -padeyeT / 2, -dDimgap*2);
    ocvs.addDimLinear('top',  -padeyeR,  -padeyeT / 2,  padeyeR, -padeyeT / 2, -dDimgap);
    ocvs.addDimLinear('top',  -innerR,  padeyeT / 2,  innerR, padeyeT / 2, dDimgap);
    ocvs.addDimLinear('top',  -lugW/2,   -padeyeT/ 2,  -lugW/2, padeyeT / 2, dDimgap);
    ocvs.addDimLinear('top',   lugW/2,   -lugT/ 2,   lugW/2, lugT / 2, -dDimgap);

    //** bottom view **
    ocvs.addLine('bottom', -lugW/2, -lugT/2 , lugW/2, -lugT/2, 'lug_outline');
    ocvs.addLine('bottom', -lugW/2,  lugT/2 , lugW/2,  lugT/2, 'lug_outline');
    ocvs.addLine('bottom', -lugW/2, -lugT/2 , -lugW/2, lugT/2, 'lug_outline');
    ocvs.addLine('bottom',  lugW/2, -lugT/2 ,   lugW/2, lugT/2, 'lug_outline');
    ocvs.addLine('bottom', -innerR, -padeyeT / 2, -innerR,  padeyeT / 2, 'lug_hidden');		
    ocvs.addLine('bottom',  innerR, -padeyeT / 2,   innerR, padeyeT / 2, 'lug_hidden');
    ocvs.addLine('bottom', -padeyeR, -padeyeT / 2, -padeyeR, -lugT / 2, 'padeye_outline');
    ocvs.addLine('bottom', -padeyeR,  lugT / 2, -padeyeR,  padeyeT / 2, 'padeye_outline');
    ocvs.addLine('bottom',  padeyeR, -padeyeT / 2, padeyeR, -lugT / 2, 'padeye_outline');
    ocvs.addLine('bottom',  padeyeR,  lugT / 2, padeyeR,  padeyeT / 2, 'padeye_outline');
    ocvs.addLine('bottom', -padeyeR, padeyeT / 2,  padeyeR, padeyeT / 2, 'padeye_outline');
    ocvs.addLine('bottom', -padeyeR, -padeyeT / 2,  padeyeR, -padeyeT / 2, 'padeye_outline');
    ocvs.addDimLinear('bottom',  -lugW/2,  -padeyeT / 2,  lugW/2, -padeyeT / 2, -dDimgap*2);
    ocvs.addDimLinear('bottom',  -padeyeR,  -padeyeT / 2,  padeyeR, -padeyeT / 2, -dDimgap);
    ocvs.addDimLinear('bottom',  -innerR,  padeyeT / 2,  innerR, padeyeT / 2, dDimgap);
    ocvs.addDimLinear('bottom',  -lugW/2,   -padeyeT/ 2,  -lugW/2, padeyeT / 2, dDimgap);
    ocvs.addDimLinear('bottom',   lugW/2,   -lugT/ 2,   lugW/2, lugT / 2, -dDimgap);
    
    ocvs.render();

    /* --- DXF Preparation --- */
    var dDim_ext = 20;
    odxf_lug.init();
    odxf_lug.layer("lug_cent", 1, "CENTER");
    odxf_lug.layer("lug_hidden", 4, "HIDDEN");
    odxf_lug.layer("lug_solid", 4, "CONTINUOUS");
    odxf_lug.layer("padeye", 3, "CONTINUOUS");
    
    var dOx = 0, dOy = 0;
    var dOx_side = lugW * 1.5, dOy_side = 0;
    var dOx_top = 0, dOy_top = lugH * 1.5;
    var dOx_bot = lugW * 1.5, dOy_bot = lugH * 1.5;
    var dp1x, dp1y, dp2x, dp2y;

    /** front view **/
    dp1x = dOx + dTlx, dp1y = dOy + dTly; dp2x = dOx + dPbase1lx, dp2y = dOy + dPbase1ly; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx + dPbase1lx, dp1y = dOy + dPbase1ly; dp2x = dOx + dPbaselx, dp2y = dOy + dPbasely; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx + dPbaselx, dp1y = dOy + dPbasely; dp2x = dOx + dPbaserx, dp2y = dOy + dPbasery; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx + dPbaserx, dp1y = dOy + dPbasery; dp2x = dOx + dPbase1rx, dp2y = dOy + dPbase1ry; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx + dPbase1rx, dp1y = dOy + dPbase1ry; dp2x = dOx + dTrx, dp2y = dOy + dTry; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx, dp1y = dOy + lugH - outerR; odxf_lug.arc(dp1x, dp1y, outerR, darcb, darce, "lug_solid");		
    dp1x = dOx, dp1y = dOy + lugH - outerR; odxf_lug.circle(dp1x, dp1y, innerR, "lug_solid");					
    dp1x = dOx, dp1y = dOy + lugH - outerR; odxf_lug.circle(dp1x, dp1y, padeyeR, "padeye");			
    dp1x = dOx, dp1y = dOy - dDim_ext; dp2x = dOx, dp2y = dOy + lugH + dDim_ext; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    dp1x = dOx - lugW/2 - dDim_ext, dp1y = dOy + lugH - outerR; dp2x = dOx + lugW/2 + dDim_ext, dp2y = dOy + lugH - outerR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			

    /** side view **/
    dp1x = dOx_side - lugT/2, dp1y = dOy_side + 0; dp2x = dOx_side + lugT/2, dp2y = dOy_side + 0; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_side + lugT/2, dp1y = dOy_side + 0; dp2x = dOx_side + lugT/2, dp2y = dOy_side + lugH; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_side + lugT/2, dp1y = dOy_side + lugH; dp2x = dOx_side - lugT/2, dp2y = dOy_side + lugH; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_side - lugT/2, dp1y = dOy_side + lugH; dp2x = dOx_side - lugT/2, dp2y = dOy_side + 0; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_side - lugT/2, dp1y = dOy_side + baseH; dp2x = dOx_side + lugT/2, dp2y = dOy_side + baseH; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_side - padeyeT/2, dp1y = dOy_side + lugH -outerR - padeyeR; dp2x = dOx_side - padeyeT/2, dp2y = dOy_side + lugH -outerR + padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side + padeyeT/2, dp1y = dOy_side + lugH -outerR - padeyeR; dp2x = dOx_side + padeyeT/2, dp2y = dOy_side + lugH -outerR + padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side - padeyeT/2, dp1y = dOy_side + lugH -outerR + padeyeR; dp2x = dOx_side - lugT/2, dp2y = dOy_side + lugH -outerR + padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side + padeyeT/2, dp1y = dOy_side + lugH -outerR + padeyeR; dp2x = dOx_side + lugT/2, dp2y = dOy_side + lugH -outerR + padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side - padeyeT/2, dp1y = dOy_side + lugH -outerR - padeyeR; dp2x = dOx_side - lugT/2, dp2y = dOy_side + lugH -outerR - padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side + padeyeT/2, dp1y = dOy_side + lugH -outerR - padeyeR; dp2x = dOx_side + lugT/2, dp2y = dOy_side + lugH -outerR - padeyeR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_side - padeyeT/2, dp1y = dOy_side + lugH -outerR - innerR; dp2x = dOx_side + padeyeT/2, dp2y = dOy_side + lugH -outerR - innerR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_side - padeyeT/2, dp1y = dOy_side + lugH -outerR + innerR; dp2x = dOx_side + padeyeT/2, dp2y = dOy_side + lugH -outerR + innerR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_side, dp1y = dOy_side - dDim_ext; dp2x = dOx_side, dp2y = dOy_side + lugH + dDim_ext; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    dp1x = dOx_side - padeyeT/2 - dDim_ext, dp1y = dOy_side + lugH - outerR; dp2x = dOx_side + padeyeT/2 + dDim_ext, dp2y = dOy_side + lugH - outerR; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			

    /** top view **/
    dp1x = dOx_top - lugW/2, dp1y = dOy_top -lugT/2; dp2x = dOx_top + lugW/2, dp2y = dOy_top -lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_top + lugW/2, dp1y = dOy_top -lugT/2; dp2x = dOx_top + lugW/2, dp2y = dOy_top +lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_top + lugW/2, dp1y = dOy_top +lugT/2; dp2x = dOx_top - lugW/2, dp2y = dOy_top +lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_top - lugW/2, dp1y = dOy_top +lugT/2; dp2x = dOx_top - lugW/2, dp2y = dOy_top -lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");	
    dp1x = dOx_top - padeyeR, dp1y = dOy_top - padeyeT/2; dp2x = dOx_top + padeyeR, dp2y = dOy_top - padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_top - padeyeR, dp1y = dOy_top + padeyeT/2; dp2x = dOx_top + padeyeR, dp2y = dOy_top + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_top - padeyeR, dp1y = dOy_top - padeyeT/2; dp2x = dOx_top - padeyeR, dp2y = dOy_top - lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_top - padeyeR, dp1y = dOy_top + padeyeT/2; dp2x = dOx_top - padeyeR, dp2y = dOy_top + lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_top + padeyeR, dp1y = dOy_top - padeyeT/2; dp2x = dOx_top + padeyeR, dp2y = dOy_top - lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    
    // ⭐ [DXF 버그 수정] dp2y 값이 dOy_top + padeyeT/2 로 잘못되어 있던 부분을 lugT/2 로 수정
    dp1x = dOx_top + padeyeR, dp1y = dOy_top + padeyeT/2; dp2x = dOx_top + padeyeR, dp2y = dOy_top + lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    
    dp1x = dOx_top - innerR, dp1y = dOy_top - padeyeT/2; dp2x = dOx_top - innerR, dp2y = dOy_top + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_top + innerR, dp1y = dOy_top - padeyeT/2; dp2x = dOx_top + innerR, dp2y = dOy_top + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_top, dp1y = dOy_top - padeyeT/2 - dDim_ext; dp2x = dOx_top, dp2y = dOy_top + padeyeT/2 + dDim_ext; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    dp1x = dOx_top - lugW/2 - dDim_ext, dp1y = dOy_top + 0; dp2x = dOx_top + lugW/2 + dDim_ext, dp2y = dOy_top + 0; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    
    /** bot view **/
    dp1x = dOx_bot - lugW/2, dp1y = dOy_bot -lugT/2; dp2x = dOx_bot + lugW/2, dp2y = dOy_bot -lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_bot + lugW/2, dp1y = dOy_bot -lugT/2; dp2x = dOx_bot + lugW/2, dp2y = dOy_bot +lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_bot + lugW/2, dp1y = dOy_bot +lugT/2; dp2x = dOx_bot - lugW/2, dp2y = dOy_bot +lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");			
    dp1x = dOx_bot - lugW/2, dp1y = dOy_bot +lugT/2; dp2x = dOx_bot - lugW/2, dp2y = dOy_bot -lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_solid");	
    dp1x = dOx_bot - padeyeR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot + padeyeR, dp2y = dOy_bot - padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_bot - padeyeR, dp1y = dOy_bot + padeyeT/2; dp2x = dOx_bot + padeyeR, dp2y = dOy_bot + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_bot - padeyeR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot - padeyeR, dp2y = dOy_bot - lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_bot - padeyeR, dp1y = dOy_bot + padeyeT/2; dp2x = dOx_bot - padeyeR, dp2y = dOy_bot + lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_bot + padeyeR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot + padeyeR, dp2y = dOy_bot - lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    
    // ⭐ [DXF 버그 수정] dp2y 값이 dOy_bot + padeyeT/2 로 잘못되어 있던 부분을 lugT/2 로 수정
    dp1x = dOx_bot + padeyeR, dp1y = dOy_bot + padeyeT/2; dp2x = dOx_bot + padeyeR, dp2y = dOy_bot + lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    
    dp1x = dOx_bot - innerR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot - innerR, dp2y = dOy_bot + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_bot + innerR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot + innerR, dp2y = dOy_bot + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_bot, dp1y = dOy_bot - padeyeT/2 - dDim_ext; dp2x = dOx_bot, dp2y = dOy_bot + padeyeT/2 + dDim_ext; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    dp1x = dOx_bot - lugW/2 - dDim_ext, dp1y = dOy_bot + 0; dp2x = dOx_bot + lugW/2 + dDim_ext, dp2y = dOy_bot + 0; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");				
}
