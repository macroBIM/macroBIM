/*
    L형 측구(L-Gutter) 작도를 위한 JS (KonvaViewer 적용) v000
*/
const odxf_lgutter  = dxf_generator();
const scvs_lgutter  = "lgutterplot";      // canvas name

function lgutter_click() {

    // 1. 사이드바(nav) 및 메인 콘텐츠(main) 레이아웃 조정
    const mainContent = document.getElementById('wrap_main');

    if (mainContent) {
        mainContent.classList.remove('col-md-9', 'col-lg-10');
        mainContent.classList.add('col-md-12', 'col-lg-12');
    }
    
    var omain = document.getElementById("wrap_main");   
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
    
    shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_lgutter(\"sUserText\"); fdraw_lgutter();');
    shtml += createLabel('INPUT One by One');
    
    // L형 측구 변수 입력
    shtml += createRowInput('Total Width (W)', 'dW', 1000, 'fdraw_lgutter()');
    shtml += createRowInput('Total Height (H)', 'dH', 1200, 'fdraw_lgutter()');
    shtml += createRowInput('Wall Thickness (tw)', 'dtw', 200, 'fdraw_lgutter()');
    shtml += createRowInput('Base Thickness (tf)', 'dtf', 200, 'fdraw_lgutter()');
    shtml += createRowInput('Gutter Length (L)', 'dseg_leng', 2000, 'fdraw_lgutter()');
    
    shtml += "                  </div>";
    shtml += "              </div>";

    // card-footer (DXF 다운로드 버튼)
    shtml += "              <div class='card-footer bg-white border-top flex-shrink-0 p-2 align-items-center justify-content-center text-center'>";
    shtml += "                  <button class='btn btn-dark w-75 py-2 mb-0 shadow-sm' onclick='odxf_lgutter.download(\"L_Gutter.dxf\")'>";
    shtml += "                      DXF DOWNLOAD";
    shtml += "                  </button>";
    shtml += "              </div>"; 
    shtml += "          </div>";
    shtml += "      </div>";
                
    // --- 오른쪽: 도면 뷰어 영역 ---
    shtml += "      <div class='col-lg-8 h-100'>";
    shtml += "          <div class='card shadow-sm h-100 d-flex flex-column' style='overflow: hidden;'>"; 
    
    // 헤더 정렬 및 슬림 REGEN 버튼 추가
    shtml += "              <div class='card-header bg-secondary flex-shrink-0 d-flex justify-content-between align-items-center'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan)</h6>";
    shtml += "                  <button class='btn btn-light' style='padding: 2px 8px; font-size: 12px; line-height: 1.5;' onclick='fdraw_lgutter()'>";
    shtml += "                      <i class='fa fa-refresh'></i> REGEN";
    shtml += "                  </button>";
    shtml += "              </div>";
    
    // 마우스 커서 속성(cursor: grab)
    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_lgutter + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";
 
    omain.innerHTML = shtml;

    // 초기 드로잉 실행
    fdraw_lgutter();
}

// 파라미터 가져오기
function getParams_lgutter() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        dW: getValue('dW'), 
        dH: getValue('dH'), 
        dtw: getValue('dtw'),
        dtf: getValue('dtf')
    };
    
    let dseg_leng = getValue('dseg_leng');
    let combText = [ ...Object.values(aparam) ].join(',');

    return { aparam, dseg_leng, combText };
}

// 파라미터 적용하기
function putParams_lgutter(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 2) return; 

    const values = lines[0].split(',');
    const dseg_leng = lines[1];

    const keys = ['dW', 'dH', 'dtw', 'dtf'];

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

    if (typeof fdraw_lgutter === 'function') fdraw_lgutter();
}

// Canvas에 도면을 그립니다.
function fdraw_lgutter() {

    /* Load data */     
    let auserdata = getParams_lgutter();
    let aparam = auserdata.aparam;
    let dleng = auserdata.dseg_leng;  
    
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) {
        ouserTextArea.value = auserdata.combText + "\n" + dleng;
    }   

    let { dW, dH, dtw, dtf } = aparam;

    // 검증 로직: 두께가 전체 폭/높이보다 클 수 없음
    if(dtw >= dW) dtw = dW / 2;
    if(dtf >= dH) dtf = dH / 2;

    /* KONVA CANVAS */      
    var ocvs = new KonvaViewer(scvs_lgutter);

    // 레이어
    var alayer = ['lgutter_solid', 'lgutter_hidden', 'lgutter_center'];
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red',  'solid', 1.5);

    /* DXF Preparation */       
    var ddim_ext = 20;
    var ddim_off = 20;
    
    odxf_lgutter.init();
    odxf_lgutter.layer("lgutter_solid", 4, "CONTINUOUS");
    odxf_lgutter.layer("lgutter_hidden", 4, "HIDDEN");
    odxf_lgutter.layer("lgutter_cent", 1, "CENTER");

    // 원점 세팅
    var dOx = 0, dOy = 0;
    var dOx_side = dW * 2 + ddim_off*4, dOy_side = 0;
    var dOx_top = 0, dOy_top = Math.max(dH, dleng) * 2;
    var dOx_bot = dW * 2 + ddim_off*4, dOy_bot = Math.max(dH, dleng) * 2;

    let dp1x, dp1y, dp2x, dp2y;
    let sview;

    /* ----------------------------------------------------
       1. FRONT VIEW (단면도)
    -----------------------------------------------------*/
    sview = 'front';
    
    // 점 정의
    let p0 = {x: 0, y: 0};
    let p1 = {x: dW, y: 0};
    let p2 = {x: dW, y: dtf};
    let p3 = {x: dtw, y: dtf};
    let p4 = {x: dtw, y: dH};
    let p5 = {x: 0, y: dH};

    // Konva 드로잉
    ocvs.addLine(sview, p0.x, p0.y, p1.x, p1.y, alayer[0]);
    ocvs.addLine(sview, p1.x, p1.y, p2.x, p2.y, alayer[0]);
    ocvs.addLine(sview, p2.x, p2.y, p3.x, p3.y, alayer[0]);
    ocvs.addLine(sview, p3.x, p3.y, p4.x, p4.y, alayer[0]);
    ocvs.addLine(sview, p4.x, p4.y, p5.x, p5.y, alayer[0]);
    ocvs.addLine(sview, p5.x, p5.y, p0.x, p0.y, alayer[0]);

    // DXF 드로잉
    odxf_lgutter.line(dOx + p0.x, dOy + p0.y, dOx + p1.x, dOy + p1.y, alayer[0]);
    odxf_lgutter.line(dOx + p1.x, dOy + p1.y, dOx + p2.x, dOy + p2.y, alayer[0]);
    odxf_lgutter.line(dOx + p2.x, dOy + p2.y, dOx + p3.x, dOy + p3.y, alayer[0]);
    odxf_lgutter.line(dOx + p3.x, dOy + p3.y, dOx + p4.x, dOy + p4.y, alayer[0]);
    odxf_lgutter.line(dOx + p4.x, dOy + p4.y, dOx + p5.x, dOy + p5.y, alayer[0]);
    odxf_lgutter.line(dOx + p5.x, dOy + p5.y, dOx + p0.x, dOy + p0.y, alayer[0]);

    // 치수선 (Front)
    ocvs.addDimLinear(sview, p0.x, p0.y, p1.x, p1.y, -ddim_off*2); // 전체 폭 (W)
    ocvs.addDimLinear(sview, p0.x, p5.y, p4.x, p4.y, ddim_off*2);  // 벽체 폭 (tw)
    ocvs.addDimLinear(sview, p4.x, p4.y, p2.x, p4.y, ddim_off*2);  // 내부 폭 (W - tw)
    
    ocvs.addDimLinear(sview, p0.x, p0.y, p5.x, p5.y, ddim_off*2);  // 전체 높이 (H)
    ocvs.addDimLinear(sview, p1.x, p1.y, p2.x, p2.y, -ddim_off*2); // 기초 두께 (tf)
    ocvs.addDimLinear(sview, p2.x, p2.y, p2.x, pH = p4.y, -ddim_off*2); // 내부 높이 (H - tf)

    /* ----------------------------------------------------
       2. TOP VIEW (평면도)
    -----------------------------------------------------*/
    sview = 'top';

    // 외곽 박스
    ocvs.addLine(sview, 0, 0, dleng, 0, alayer[0]);
    ocvs.addLine(sview, dleng, 0, dleng, dW, alayer[0]);
    ocvs.addLine(sview, dleng, dW, 0, dW, alayer[0]);
    ocvs.addLine(sview, 0, dW, 0, 0, alayer[0]);
    
    // 벽체 경계선 (위에서 봤을 때 보이는 실선)
    ocvs.addLine(sview, 0, dW - dtw, dleng, dW - dtw, alayer[0]);

    // DXF 드로잉
    odxf_lgutter.line(dOx_top + 0, dOy_top + 0, dOx_top + dleng, dOy_top + 0, alayer[0]);
    odxf_lgutter.line(dOx_top + dleng, dOy_top + 0, dOx_top + dleng, dOy_top + dW, alayer[0]);
    odxf_lgutter.line(dOx_top + dleng, dOy_top + dW, dOx_top + 0, dOy_top + dW, alayer[0]);
    odxf_lgutter.line(dOx_top + 0, dOy_top + dW, dOx_top + 0, dOy_top + 0, alayer[0]);
    odxf_lgutter.line(dOx_top + 0, dOy_top + dW - dtw, dOx_top + dleng, dOy_top + dW - dtw, alayer[0]);

    // 치수선 (Top)
    ocvs.addDimLinear(sview, 0, 0, dleng, 0, -ddim_off*2); // 길이 (L)
    ocvs.addDimLinear(sview, dleng, 0, dleng, dW, -ddim_off*2); // 전체 폭 (W)

    /* ----------------------------------------------------
       3. BOTTOM VIEW (저면도)
    -----------------------------------------------------*/
    sview = 'bottom';

    // 외곽 박스
    ocvs.addLine(sview, 0, 0, dleng, 0, alayer[0]);
    ocvs.addLine(sview, dleng, 0, dleng, dW, alayer[0]);
    ocvs.addLine(sview, dleng, dW, 0, dW, alayer[0]);
    ocvs.addLine(sview, 0, dW, 0, 0, alayer[0]);
    
    // 벽체 경계선 (바닥에서 봤을 땐 안보이므로 점선)
    ocvs.addLine(sview, 0, dW - dtw, dleng, dW - dtw, alayer[1]); // Hidden Line

    // DXF 드로잉
    odxf_lgutter.line(dOx_bot + 0, dOy_bot + 0, dOx_bot + dleng, dOy_bot + 0, alayer[0]);
    odxf_lgutter.line(dOx_bot + dleng, dOy_bot + 0, dOx_bot + dleng, dOy_bot + dW, alayer[0]);
    odxf_lgutter.line(dOx_bot + dleng, dOy_bot + dW, dOx_bot + 0, dOy_bot + dW, alayer[0]);
    odxf_lgutter.line(dOx_bot + 0, dOy_bot + dW, dOx_bot + 0, dOy_bot + 0, alayer[0]);
    odxf_lgutter.line(dOx_bot + 0, dOy_bot + dW - dtw, dOx_bot + dleng, dOy_bot + dW - dtw, alayer[1]); // Hidden

    // 치수선 (Bottom)
    ocvs.addDimLinear(sview, 0, 0, dleng, 0, -ddim_off*2); // 길이 (L)
    ocvs.addDimLinear(sview, dleng, 0, dleng, dW, -ddim_off*2); // 전체 폭 (W)

    /* ----------------------------------------------------
       4. SIDE VIEW (측면도 - 세로방향 절단면)
    -----------------------------------------------------*/
    sview = 'side';

    // 외곽 박스 (L x H)
    ocvs.addLine(sview, 0, 0, dleng, 0, alayer[0]);
    ocvs.addLine(sview, dleng, 0, dleng, dH, alayer[0]);
    ocvs.addLine(sview, dleng, dH, 0, dH, alayer[0]);
    ocvs.addLine(sview, 0, dH, 0, 0, alayer[0]);

    // 기초판(Base)의 두께선 (옆에서 보면 실선)
    ocvs.addLine(sview, 0, dtf, dleng, dtf, alayer[0]);

    // DXF 드로잉
    odxf_lgutter.line(dOx_side + 0, dOy_side + 0, dOx_side + dleng, dOy_side + 0, alayer[0]);
    odxf_lgutter.line(dOx_side + dleng, dOy_side + 0, dOx_side + dleng, dOy_side + dH, alayer[0]);
    odxf_lgutter.line(dOx_side + dleng, dOy_side + dH, dOx_side + 0, dOy_side + dH, alayer[0]);
    odxf_lgutter.line(dOx_side + 0, dOy_side + dH, dOx_side + 0, dOy_side + 0, alayer[0]);
    odxf_lgutter.line(dOx_side + 0, dOy_side + dtf, dOx_side + dleng, dOy_side + dtf, alayer[0]);

    // 치수선 (Side)
    ocvs.addDimLinear(sview, 0, 0, dleng, 0, -ddim_off*2); // 길이 (L)
    ocvs.addDimLinear(sview, dleng, 0, dleng, dH, -ddim_off*2); // 전체 높이 (H)
    ocvs.addDimLinear(sview, 0, 0, 0, dtf, ddim_off*2); // 기초 두께 (tf)

    // 렌더링
    ocvs.render();
}
