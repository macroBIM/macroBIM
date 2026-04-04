/*
    L형 측구(L-Gutter) 작도를 위한 통합 JS (KonvaViewer 적용)
*/
const odxf_lgutter  = dxf_generator();
const scvs_lgutter  = "lgutterplot";

function lgutter_click() {
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
    
    shtml += createTextInput('sUserText', 'BATCH INPUT (CSV)','', 'putParams_lgutter(\"sUserText\"); fdraw_lgutter();');
    shtml += createLabel('INPUT One by One');
    
    // 9개의 마스터 변수 + 길이(L) 입력
    shtml += createRowInput('Total Width (B)', 'dB', 1000, 'fdraw_lgutter()');
    shtml += createRowInput('Total Height (H)', 'dH', 500, 'fdraw_lgutter()');
    shtml += createRowInput('Base Front Thick (tf1)', 'dtf1', 200, 'fdraw_lgutter()');
    shtml += createRowInput('Base Back Thick (tf2)', 'dtf2', 240, 'fdraw_lgutter()');
    shtml += createRowInput('Wall Top Width (tw1)', 'dtw1', 150, 'fdraw_lgutter()');
    shtml += createRowInput('Wall Bottom Width (tw2)', 'dtw2', 200, 'fdraw_lgutter()');
    shtml += createRowInput('Wall Vert. Lip (hw)', 'dhw', 100, 'fdraw_lgutter()');
    shtml += createRowInput('Corner Haunch (hc)', 'dhc', 0, 'fdraw_lgutter()');
    shtml += createRowInput('Top Chamfer (cr)', 'dcr', 20, 'fdraw_lgutter()');
    
    shtml += createRowInput('Gutter Length (L)', 'dseg_leng', 2000, 'fdraw_lgutter()');
    
    shtml += "                  </div>";
    shtml += "              </div>";

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
    shtml += "              <div class='card-header bg-secondary flex-shrink-0 d-flex justify-content-between align-items-center'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan)</h6>";
    shtml += "                  <button class='btn btn-light' style='padding: 2px 8px; font-size: 12px; line-height: 1.5;' onclick='fdraw_lgutter()'>";
    shtml += "                      <i class='fa fa-refresh'></i> REGEN";
    shtml += "                  </button>";
    shtml += "              </div>";
    shtml += "              <div class='card-body p-0 flex-grow-1' style='min-height: 0; position: relative;'>";
    shtml += "                  <div id='" + scvs_lgutter + "' style='position: absolute; top:0; left:0; width:100%; height:100%; background-color:#000; cursor: grab;'></div>";
    shtml += "              </div>";
    shtml += "          </div>";
    shtml += "      </div>";
            
    shtml += "  </div>"; 
    shtml += "</div>";
 
    omain.innerHTML = shtml;
    fdraw_lgutter();
}

function getParams_lgutter() {
    const getValue = (id) => {
        const el = document.getElementById(id);
        return el ? Number(el.value) : 0;
    };

    let aparam = {
        dB: getValue('dB'), dH: getValue('dH'), dtf1: getValue('dtf1'), dtf2: getValue('dtf2'),
        dtw1: getValue('dtw1'), dtw2: getValue('dtw2'), dhw: getValue('dhw'), dhc: getValue('dhc'), dcr: getValue('dcr')
    };
    
    let dseg_leng = getValue('dseg_leng');
    let combText = [ ...Object.values(aparam) ].join(',');

    return { aparam, dseg_leng, combText };
}

function putParams_lgutter(textareaId) {
    const textarea = document.getElementById(textareaId);
    if (!textarea) return;

    const lines = textarea.value.split('\n');
    if (lines.length < 2) return; 

    const values = lines[0].split(',');
    const dseg_leng = lines[1];

    const keys = ['dB', 'dH', 'dtf1', 'dtf2', 'dtw1', 'dtw2', 'dhw', 'dhc', 'dcr'];

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

// 스마트 다각형 꼭짓점 생성 알고리즘 (Front View 용)
function getLGutterPoints(B, H, tf1, tf2, tw1, tw2, hw, hc, cr) {
    let pts = [];
    pts.push({x: 0, y: 0});
    pts.push({x: B, y: 0});
    pts.push({x: B, y: H});

    // 상부 모따기 (Chamfer)
    if (cr > 0) {
        pts.push({x: B - tw1 + cr, y: H});
        pts.push({x: B - tw1, y: H - cr});
    } else {
        pts.push({x: B - tw1, y: H});
    }

    // 하부 헌치(hc)와 수직부(hw) 간섭 처리
    if (hw > hc) {
        pts.push({x: B - tw2, y: tf2 + hw});
        if (hc > 0) {
            pts.push({x: B - tw2, y: tf2 + hc});
            let baseY = tf1 + (tf2 - tf1) * (B - tw2 - hc) / (B - tw2);
            pts.push({x: B - tw2 - hc, y: baseY});
        } else {
            pts.push({x: B - tw2, y: tf2});
        }
    } else {
        if (hc > 0) {
            pts.push({x: B - tw2, y: tf2 + hc});
            let baseY = tf1 + (tf2 - tf1) * (B - tw2 - hc) / (B - tw2);
            pts.push({x: B - tw2 - hc, y: baseY});
        } else {
            pts.push({x: B - tw2, y: tf2});
        }
    }
    
    pts.push({x: 0, y: tf1});
    return pts;
}


function fdraw_lgutter() {
    let auserdata = getParams_lgutter();
    let aparam = auserdata.aparam;
    let dleng = auserdata.dseg_leng;  
    
    let ouserTextArea = document.getElementById('sUserText');
    if (ouserTextArea) ouserTextArea.value = auserdata.combText + "\n" + dleng;

    let { dB, dH, dtf1, dtf2, dtw1, dtw2, dhw, dhc, dcr } = aparam;

    var ocvs = new KonvaViewer(scvs_lgutter);
    var alayer = ['lgutter_solid', 'lgutter_hidden', 'lgutter_center'];
    ocvs.addLayer(alayer[0], 'cyan', 'solid', 1.5);
    ocvs.addLayer(alayer[1], 'cyan', 'hidden', 1.5);
    ocvs.addLayer(alayer[2], 'red',  'solid', 1.5);

    var ddim_off = 20;
    
    odxf_lgutter.init();
    odxf_lgutter.layer("lgutter_solid", 4, "CONTINUOUS");
    odxf_lgutter.layer("lgutter_hidden", 4, "HIDDEN");

    var dOx = 0, dOy = 0;
    var dOx_side = dB * 2 + ddim_off*4, dOy_side = 0;
    var dOx_top = 0, dOy_top = Math.max(dH, dleng) * 2;
    var dOx_bot = dB * 2 + ddim_off*4, dOy_bot = Math.max(dH, dleng) * 2;

    let sview;

    /* 1. FRONT VIEW (단면도) */
    sview = 'front';
    let pts = getLGutterPoints(dB, dH, dtf1, dtf2, dtw1, dtw2, dhw, dhc, dcr);

    // 폴리곤 점들을 순회하며 라인 그리기 (Konva & DXF 동시 작도)
    for (let i = 0; i < pts.length; i++) {
        let pA = pts[i];
        let pB = pts[(i + 1) % pts.length];
        ocvs.addLine(sview, pA.x, pA.y, pB.x, pB.y, alayer[0]);
        odxf_lgutter.line(dOx + pA.x, dOy + pA.y, dOx + pB.x, dOy + pB.y, alayer[0]);
    }

    // 치수선 (Front)
    ocvs.addDimLinear(sview, 0, 0, dB, 0, -ddim_off*3); 
    ocvs.addDimLinear(sview, dB, dH, dB, 0, ddim_off*3); 
    ocvs.addDimLinear(sview, dB - dtw1, dH, dB, dH, ddim_off*2);
    ocvs.addDimLinear(sview, 0, 0, 0, dtf1, -ddim_off*2);

    /* 2. TOP VIEW (평면도) */
    sview = 'top';
    ocvs.addLine(sview, 0, 0, dB, 0, alayer[0]);
    ocvs.addLine(sview, dB, 0, dB, dleng, alayer[0]);
    ocvs.addLine(sview, dB, dleng, 0, dleng, alayer[0]);
    ocvs.addLine(sview, 0, dleng, 0, 0, alayer[0]);
    
    // 내부 엣지선들
    ocvs.addLine(sview, dB - dtw1, 0, dB - dtw1, dleng, alayer[0]);
    if (dcr > 0) ocvs.addLine(sview, dB - dtw1 + dcr, 0, dB - dtw1 + dcr, dleng, alayer[0]);
    ocvs.addLine(sview, dB - dtw2, 0, dB - dtw2, dleng, alayer[0]);
    if (dhc > 0) ocvs.addLine(sview, dB - dtw2 - dhc, 0, dB - dtw2 - dhc, dleng, alayer[0]);

    odxf_lgutter.line(dOx_top, dOy_top, dOx_top + dB, dOy_top, alayer[0]);
    odxf_lgutter.line(dOx_top + dB, dOy_top, dOx_top + dB, dOy_top + dleng, alayer[0]);
    odxf_lgutter.line(dOx_top + dB, dOy_top + dleng, dOx_top, dOy_top + dleng, alayer[0]);
    odxf_lgutter.line(dOx_top, dOy_top + dleng, dOx_top, dOy_top, alayer[0]);
    odxf_lgutter.line(dOx_top + dB - dtw1, dOy_top, dOx_top + dB - dtw1, dOy_top + dleng, alayer[0]);
    ocvs.addDimLinear(sview, 0, 0, dB, 0, -ddim_off*2); 
    ocvs.addDimLinear(sview, dB, 0, dB, dleng, -ddim_off*2); 

    /* 3. BOTTOM VIEW (저면도) */
    sview = 'bottom';
    ocvs.addLine(sview, 0, 0, dB, 0, alayer[0]);
    ocvs.addLine(sview, dB, 0, dB, dleng, alayer[0]);
    ocvs.addLine(sview, dB, dleng, 0, dleng, alayer[0]);
    ocvs.addLine(sview, 0, dleng, 0, 0, alayer[0]);
    
    // 보이지 않는 점선(Hidden) 처리
    ocvs.addLine(sview, dB - dtw2, 0, dB - dtw2, dleng, alayer[1]); 

    odxf_lgutter.line(dOx_bot, dOy_bot, dOx_bot + dB, dOy_bot, alayer[0]);
    odxf_lgutter.line(dOx_bot + dB, dOy_bot, dOx_bot + dB, dOy_bot + dleng, alayer[0]);
    odxf_lgutter.line(dOx_bot + dB, dOy_bot + dleng, dOx_bot, dOy_bot + dleng, alayer[0]);
    odxf_lgutter.line(dOx_bot, dOy_bot + dleng, dOx_bot, dOy_bot, alayer[0]);
    odxf_lgutter.line(dOx_bot + dB - dtw2, dOy_bot, dOx_bot + dB - dtw2, dOy_bot + dleng, alayer[1]);

    ocvs.addDimLinear(sview, 0, 0, dB, 0, -ddim_off*2);
    ocvs.addDimLinear(sview, dB, 0, dB, dleng, -ddim_off*2);

    /* 4. SIDE VIEW (측면도) */
    sview = 'side';
    ocvs.addLine(sview, 0, 0, dleng, 0, alayer[0]);
    ocvs.addLine(sview, dleng, 0, dleng, dH, alayer[0]);
    ocvs.addLine(sview, dleng, dH, 0, dH, alayer[0]);
    ocvs.addLine(sview, 0, dH, 0, 0, alayer[0]);

    // 측면에서 보이는 수평선들
    ocvs.addLine(sview, 0, dtf1, dleng, dtf1, alayer[0]);
    if(dtf1 !== dtf2) ocvs.addLine(sview, 0, dtf2, dleng, dtf2, alayer[0]);
    if(dhw > 0) ocvs.addLine(sview, 0, dtf2 + dhw, dleng, dtf2 + dhw, alayer[0]);
    if(dcr > 0) ocvs.addLine(sview, 0, dH - dcr, dleng, dH - dcr, alayer[0]);

    odxf_lgutter.line(dOx_side, dOy_side, dOx_side + dleng, dOy_side, alayer[0]);
    odxf_lgutter.line(dOx_side + dleng, dOy_side, dOx_side + dleng, dOy_side + dH, alayer[0]);
    odxf_lgutter.line(dOx_side + dleng, dOy_side + dH, dOx_side, dOy_side + dH, alayer[0]);
    odxf_lgutter.line(dOx_side, dOy_side + dH, dOx_side, dOy_side, alayer[0]);
    odxf_lgutter.line(dOx_side, dOy_side + dtf1, dOx_side + dleng, dOy_side + dtf1, alayer[0]);

    ocvs.addDimLinear(sview, 0, 0, dleng, 0, -ddim_off*2); 
    ocvs.addDimLinear(sview, dleng, 0, dleng, dH, -ddim_off*2); 

    ocvs.render();
}
