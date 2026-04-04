/*
  LIFTGING LUG를 위한 JS  v000 (Konva.js 4분할 완벽 동기화 버전)
*/

const odxf_lug 	= dxf_generator();
const scvs_lug  = "liftinglugplot";		// canvas name

// ==========================================
// Konva.js Viewer Wrapper (4분할 독립 Viewports & 동기화)
// ==========================================
class KonvaViewer {
    constructor(containerId) {
        let container = document.getElementById(containerId);
        container.innerHTML = ""; // 기존 내용 초기화
        
        // CSS Grid를 활용하여 4분할 레이아웃 생성
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr 1fr';
        container.style.gap = '2px';
        container.style.backgroundColor = '#444'; // 구분선 역할 색상

        this.stages = {};
        this.layers = {};
        this.styles = {};

        const views = ['front', 'side', 'top', 'bottom'];
        
        // 동기화 함수 (Pan & Zoom 상태를 다른 Viewport에 전파)
        const syncStages = (sourceView) => {
            const src = this.stages[sourceView];
            const srcPos = src.position();
            const srcScale = src.scaleX();

            views.forEach(view => {
                if (view === sourceView) return;
                
                const target = this.stages[view];
                const oldScale = target.scaleX();
                
                let targetX = target.x();
                let targetY = target.y();

                // X축 동기화 그룹 (Front, Top, Bottom)
                let syncX = ['front', 'top', 'bottom'].includes(sourceView) && ['front', 'top', 'bottom'].includes(view);
                // Y축 동기화 그룹 (Front, Side)
                let syncY = ['front', 'side'].includes(sourceView) && ['front', 'side'].includes(view);

                if (syncX) {
                    targetX = srcPos.x;
                } else {
                    // 비동기화 축은 해당 화면의 '정중앙'을 기준으로 Zoom in/out 되도록 보정
                    let cw = target.width() / 2;
                    let logicalX = (cw - targetX) / oldScale;
                    targetX = cw - logicalX * srcScale;
                }

                if (syncY) {
                    targetY = srcPos.y;
                } else {
                    let ch = target.height() / 2;
                    let logicalY = (ch - targetY) / oldScale;
                    targetY = ch - logicalY * srcScale;
                }

                target.scale({ x: srcScale, y: srcScale });
                target.position({ x: targetX, y: targetY });

                // 스케일 변경에 따른 선 굵기/텍스트 크기 역보정
                this.layers[view].find('.shape').forEach(shape => {
                    shape.strokeWidth(shape.getAttr('baseStrokeWidth') / srcScale);
                });
                this.layers[view].find('.dimtext').forEach(text => {
                    text.fontSize(text.getAttr('baseFontSize') / srcScale);
                    text.offsetX(text.width() / 2);
                    text.offsetY(text.height() / 2);
                });

                target.batchDraw();
            });
        };

        // 4개의 뷰 생성
        views.forEach(view => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '100%';
            wrapper.style.height = '100%';
            wrapper.style.backgroundColor = '#000';
            wrapper.style.overflow = 'hidden';
            container.appendChild(wrapper);

            const label = document.createElement('div');
            label.innerText = view.toUpperCase() + ' VIEW';
            label.style.position = 'absolute';
            label.style.top = '10px';
            label.style.left = '10px';
            label.style.color = '#888';
            label.style.fontSize = '12px';
            label.style.fontWeight = 'bold';
            label.style.pointerEvents = 'none';
            label.style.zIndex = '10';
            wrapper.appendChild(label);

            const div = document.createElement('div');
            div.id = `${containerId}_${view}`;
            div.style.width = '100%';
            div.style.height = '100%';
            wrapper.appendChild(div);

            const stage = new Konva.Stage({
                container: div.id,
                width: div.clientWidth,
                height: div.clientHeight,
                draggable: true
            });
            const layer = new Konva.Layer();
            stage.add(layer);

            this.stages[view] = stage;
            this.layers[view] = layer;

            // 드래그(Pan) 이벤트 연동
            stage.on('dragmove', () => {
                syncStages(view);
            });

            // 휠(Zoom) 이벤트 연동
            const scaleBy = 1.1;
            stage.on('wheel', (e) => {
                e.evt.preventDefault();
                let oldScale = stage.scaleX();
                let pointer = stage.getPointerPosition();

                let mousePointTo = {
                    x: (pointer.x - stage.x()) / oldScale,
                    y: (pointer.y - stage.y()) / oldScale,
                };

                let direction = e.evt.deltaY > 0 ? -1 : 1;
                let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

                stage.scale({ x: newScale, y: newScale });

                let newPos = {
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                };
                stage.position(newPos);
                
                layer.find('.shape').forEach(shape => {
                    shape.strokeWidth(shape.getAttr('baseStrokeWidth') / newScale);
                });
                layer.find('.dimtext').forEach(text => {
                    text.fontSize(text.getAttr('baseFontSize') / newScale);
                    text.offsetX(text.width() / 2);
                    text.offsetY(text.height() / 2);
                });
                
                stage.batchDraw();
                syncStages(view); // 줌 변경사항 타 화면으로 전파
            });
        });

        // 반응형 리사이즈 처리
        window.addEventListener('resize', () => {
            if(!document.getElementById(containerId)) return;
            views.forEach(view => {
                const div = document.getElementById(`${containerId}_${view}`);
                if(div && this.stages[view]) {
                    this.stages[view].width(div.clientWidth);
                    this.stages[view].height(div.clientHeight);
                    this.stages[view].batchDraw();
                }
            });
        });
    }

    addLayer(name, color, type, width) {
        let dash = type === 'hidden' ? [5, 5] : [];
        this.styles[name] = { stroke: color, dash: dash, width: width };
    }

    _getStyle(name) { return this.styles[name] || { stroke: 'white', dash: [], width: 1 }; }
    _transformX(x) { return x; }
    _transformY(y) { return -y; } 

    addLine(view, x1, y1, x2, y2, layerName) {
        if(!this.layers[view]) return;
        let st = this._getStyle(layerName);
        let scale = this.stages[view].scaleX();
        let line = new Konva.Line({
            points: [this._transformX(x1), this._transformY(y1), this._transformX(x2), this._transformY(y2)],
            stroke: st.stroke, strokeWidth: st.width / scale, dash: st.dash, name: 'shape'
        });
        line.setAttr('baseStrokeWidth', st.width);
        this.layers[view].add(line);
    }

    addCircle(view, x, y, r, layerName) {
        if(!this.layers[view]) return;
        let st = this._getStyle(layerName);
        let scale = this.stages[view].scaleX();
        let circ = new Konva.Circle({
            x: this._transformX(x), y: this._transformY(y), radius: r,
            stroke: st.stroke, strokeWidth: st.width / scale, dash: st.dash, name: 'shape'
        });
        circ.setAttr('baseStrokeWidth', st.width);
        this.layers[view].add(circ);
    }

    addArc(view, x, y, r, angStart, angEnd, layerName) {
        if(!this.layers[view]) return;
        let st = this._getStyle(layerName);
        let tx = this._transformX(x);
        let ty = this._transformY(y);
        let scale = this.stages[view].scaleX();
        
        let arc = new Konva.Shape({
            stroke: st.stroke, strokeWidth: st.width / scale, dash: st.dash, name: 'shape',
            sceneFunc: function(ctx, shape) {
                ctx.beginPath();
                ctx.arc(tx, ty, r, -angStart * Math.PI / 180, -angEnd * Math.PI / 180, true);
                ctx.strokeShape(shape);
            }
        });
        arc.setAttr('baseStrokeWidth', st.width);
        this.layers[view].add(arc);
    }

    addDimLinear(view, x1, y1, x2, y2, gap) {
        if(!this.layers[view]) return;
        let dx = x2 - x1; let dy = y2 - y1; let len = Math.sqrt(dx*dx + dy*dy); if(len === 0) return;
        let nx = -dy / len; let ny = dx / len;
        
        let tox1 = this._transformX(x1 + nx * gap); let toy1 = this._transformY(y1 + ny * gap);
        let tox2 = this._transformX(x2 + nx * gap); let toy2 = this._transformY(y2 + ny * gap);
        let tx1 = this._transformX(x1); let ty1 = this._transformY(y1);
        let tx2 = this._transformX(x2); let ty2 = this._transformY(y2);

        let st = {stroke: 'gray', width: 1};
        let scale = this.stages[view].scaleX();
        
        this.layers[view].add(new Konva.Line({ points: [tx1, ty1, tox1, toy1], stroke: st.stroke, strokeWidth: st.width/scale, name:'shape' }).setAttr('baseStrokeWidth', st.width));
        this.layers[view].add(new Konva.Line({ points: [tx2, ty2, tox2, toy2], stroke: st.stroke, strokeWidth: st.width/scale, name:'shape' }).setAttr('baseStrokeWidth', st.width));
        this.layers[view].add(new Konva.Line({ points: [tox1, toy1, tox2, toy2], stroke: '#ccc', strokeWidth: st.width/scale, name:'shape' }).setAttr('baseStrokeWidth', st.width));

        let textNode = new Konva.Text({
            x: (tox1 + tox2)/2, y: (toy1 + toy2)/2, text: len.toFixed(1),
            fontSize: 12 / scale, fill: 'yellow', align: 'center', name: 'dimtext'
        });
        textNode.setAttr('baseFontSize', 12);
        textNode.offsetX(textNode.width()/2); textNode.offsetY(textNode.height()/2);
        this.layers[view].add(textNode);
    }

    addDimRadius(view, x, y, r, angleDeg) {
        if(!this.layers[view]) return;
        let tx = this._transformX(x); let ty = this._transformY(y);
        let rad = angleDeg * Math.PI / 180;
        let tpx = this._transformX(x + r * Math.cos(rad));
        let tpy = this._transformY(y + r * Math.sin(rad));
        let scale = this.stages[view].scaleX();
        let st = {stroke: 'gray', width: 1};

        this.layers[view].add(new Konva.Line({ points: [tx, ty, tpx, tpy], stroke: st.stroke, strokeWidth: st.width/scale, dash:[4,4], name:'shape' }).setAttr('baseStrokeWidth', st.width));
        
        let textNode = new Konva.Text({
            x: (tx + tpx)/2, y: (ty + tpy)/2, text: 'R' + r.toFixed(1),
            fontSize: 12 / scale, fill: 'yellow', align: 'center', name: 'dimtext'
        });
        textNode.setAttr('baseFontSize', 12);
        textNode.offsetX(textNode.width()/2); textNode.offsetY(textNode.height()/2);
        this.layers[view].add(textNode);
    }

    render() {
        // 1. 모든 뷰를 포괄할 수 있는 최적의 동일 Scale 계산
        let minScale = Infinity;
        let boxes = {};
        Object.keys(this.stages).forEach(view => {
            let box = this.layers[view].getClientRect({ skipTransform: true });
            boxes[view] = box;
            if (box.width > 0 && box.height > 0) {
                let padding = 30;
                let scaleX = this.stages[view].width() / (box.width + padding * 2);
                let scaleY = this.stages[view].height() / (box.height + padding * 2);
                minScale = Math.min(minScale, scaleX, scaleY);
            }
        });
        if (minScale === Infinity) minScale = 1;

        // 2. 전체 공통 스케일 적용 및 개별 센터링
        Object.keys(this.stages).forEach(view => {
            let stage = this.stages[view];
            let box = boxes[view];
            stage.scale({x: minScale, y: minScale});
            stage.position({
                x: stage.width() / 2 - (box.x + box.width / 2) * minScale,
                y: stage.height() / 2 - (box.y + box.height / 2) * minScale
            });
        });

        // 3. 축 정렬 보정 (Front를 기준으로 강제 동기화)
        let fPos = this.stages['front'].position();
        this.stages['top'].x(fPos.x);
        this.stages['bottom'].x(fPos.x);
        this.stages['side'].y(fPos.y);

        // 4. 스케일에 따른 선 굵기/텍스트 보정 후 렌더링
        Object.keys(this.stages).forEach(view => {
            let layer = this.layers[view];
            layer.find('.shape').forEach(shape => { shape.strokeWidth(shape.getAttr('baseStrokeWidth') / minScale); });
            layer.find('.dimtext').forEach(text => { 
                text.fontSize(text.getAttr('baseFontSize') / minScale);
                text.offsetX(text.width()/2); text.offsetY(text.height()/2);
            });
            this.stages[view].batchDraw();
        });
    }
}
// ==========================================


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
    shtml += "              <div class='card-header bg-secondary flex-shrink-0'>";
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan)</h6>";
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

    /* --- DXF Preparation (원본과 완전히 동일) --- */
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
    var dp1x, dp1y, dp2x, dp2y, dradius;

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
    dp1x = dOx_top + padeyeR, dp1y = dOy_top + padeyeT/2; dp2x = dOx_top + padeyeR, dp2y = dOy_top + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
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
    dp1x = dOx_bot + padeyeR, dp1y = dOy_bot + padeyeT/2; dp2x = dOx_bot + padeyeR, dp2y = dOy_bot + lugT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "padeye");			
    dp1x = dOx_bot - innerR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot - innerR, dp2y = dOy_bot + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_bot + innerR, dp1y = dOy_bot - padeyeT/2; dp2x = dOx_bot + innerR, dp2y = dOy_bot + padeyeT/2; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_hidden");			
    dp1x = dOx_bot, dp1y = dOy_bot - padeyeT/2 - dDim_ext; dp2x = dOx_bot, dp2y = dOy_bot + padeyeT/2 + dDim_ext; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");			
    dp1x = dOx_bot - lugW/2 - dDim_ext, dp1y = dOy_bot + 0; dp2x = dOx_bot + lugW/2 + dDim_ext, dp2y = dOy_bot + 0; odxf_lug.line(dp1x, dp1y, dp2x, dp2y, "lug_cent");				
}
