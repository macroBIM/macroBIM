/*
  LIFTGING LUG를 위한 JS  v000 (Konva.js 치수선(Arrow & Text) 및 4분할 동기화 적용)
*/

const odxf_lug 	= dxf_generator();
const scvs_lug  = "liftinglugplot";		// canvas name

// ==========================================
// Konva.js Viewer Wrapper (4분할 독립 Viewports & 정밀 동기화)
// ==========================================
class KonvaViewer {
    constructor(containerId) {
        let container = document.getElementById(containerId);
        container.innerHTML = ""; 
        
        // CSS Grid를 활용하여 4분할 레이아웃 생성
        container.style.display = 'grid';
        container.style.gridTemplateColumns = '1fr 1fr';
        container.style.gridTemplateRows = '1fr 1fr';
        container.style.gap = '2px';
        container.style.backgroundColor = '#444';

        this.stages = {};
        this.layers = {};
        this.styles = {};

        const views = ['front', 'side', 'top', 'bottom'];

        // 확대/축소 시 굵기, 화살표 크기, 텍스트 크기를 일정하게 유지하는 헬퍼 함수
        this.updateScaleUI = (layer, newScale) => {
            layer.find('.shape').forEach(shape => {
                shape.strokeWidth(shape.getAttr('baseStrokeWidth') / newScale);
            });
            layer.find('.dimarrow').forEach(arrow => {
                arrow.strokeWidth(arrow.getAttr('baseStrokeWidth') / newScale);
                arrow.pointerLength(arrow.getAttr('basePointerLength') / newScale);
                arrow.pointerWidth(arrow.getAttr('basePointerWidth') / newScale);
            });
            layer.find('.extline').forEach(line => {
                let unx = line.getAttr('unx'), uny = line.getAttr('uny');
                let tx = line.getAttr('tx'), ty = line.getAttr('ty');
                let tox = line.getAttr('tox'), toy = line.getAttr('toy');
                // 객체에서 2px 띄우고, 치수선 밖으로 5px 연장 (화면 픽셀 기준)
                line.points([
                    tx + unx * (2 / newScale), ty + uny * (2 / newScale),
                    tox + unx * (5 / newScale), toy + uny * (5 / newScale)
                ]);
                line.strokeWidth(line.getAttr('baseStrokeWidth') / newScale);
            });
            layer.find('.dimtext').forEach(text => {
                text.fontSize(text.getAttr('baseFontSize') / newScale);
                text.offsetX(text.width() / 2);
                text.offsetY(text.height() * 0.8);
            });
        };
        
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

                let syncX = ['front', 'top', 'bottom'].includes(sourceView) && ['front', 'top', 'bottom'].includes(view);
                let syncY = (['front', 'side'].includes(sourceView) && ['front', 'side'].includes(view)) ||
                            (['top', 'bottom'].includes(sourceView) && ['top', 'bottom'].includes(view));

                if (syncX) targetX = srcPos.x;
                else {
                    let cw = target.width() / 2;
                    let logicalX = (cw - targetX) / oldScale;
                    targetX = cw - logicalX * srcScale;
                }

                if (syncY) targetY = srcPos.y;
                else {
                    let ch = target.height() / 2;
                    let logicalY = (ch - targetY) / oldScale;
                    targetY = ch - logicalY * srcScale;
                }

                target.scale({ x: srcScale, y: srcScale });
                target.position({ x: targetX, y: targetY });

                this.updateScaleUI(this.layers[view], srcScale);
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

            stage.on('dragmove', () => { syncStages(view); });

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
                
                this.updateScaleUI(layer, newScale);
                stage.batchDraw();
                syncStages(view); 
            });
        });

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

    // ★ 업그레이드 된 선형 치수 기입 (Arrow + 텍스트 회전 + 보조선)
    addDimLinear(view, x1, y1, x2, y2, gap) {
        if(!this.layers[view]) return;
        let dx = x2 - x1; let dy = y2 - y1; let len = Math.sqrt(dx*dx + dy*dy); if(len === 0) return;
        let nx = -dy / len; let ny = dx / len;
        
        let tox1 = this._transformX(x1 + nx * gap); let toy1 = this._transformY(y1 + ny * gap);
        let tox2 = this._transformX(x2 + nx * gap); let toy2 = this._transformY(y2 + ny * gap);
        let tx1 = this._transformX(x1); let ty1 = this._transformY(y1);
        let tx2 = this._transformX(x2); let ty2 = this._transformY(y2);

        let scale = this.stages[view].scaleX() || 1;
        let st = {stroke: 'red', width: 1};

        // 1. 치수선 (양방향 화살표)
        let arrow = new Konva.Arrow({
            points: [tox1, toy1, tox2, toy2],
            stroke: 'red', fill: 'red',
            strokeWidth: st.width / scale,
            pointerLength: 10 / scale, pointerWidth: 8 / scale,
            pointerAtBeginning: true, pointerAtEnding: true,
            name: 'dimarrow'
        });
        arrow.setAttr('baseStrokeWidth', st.width);
        arrow.setAttr('basePointerLength', 10);
        arrow.setAttr('basePointerWidth', 8);
        this.layers[view].add(arrow);

        // 2. 치수 보조선 생성
        let vdx1 = tox1 - tx1; let vdy1 = toy1 - ty1;
        let vlen = Math.sqrt(vdx1*vdx1 + vdy1*vdy1);
        
        if(vlen > 0) {
            let unx = vdx1/vlen; let uny = vdy1/vlen;
            let createExtLine = (tx, ty, tox, toy) => {
                let line = new Konva.Line({
                    points: [tx + unx * (2/scale), ty + uny * (2/scale), tox + unx * (5/scale), toy + uny * (5/scale)],
                    stroke: 'red', strokeWidth: 1/scale, name: 'extline'
                });
                line.setAttr('baseStrokeWidth', 1);
                line.setAttr('unx', unx); line.setAttr('uny', uny);
                line.setAttr('tx', tx); line.setAttr('ty', ty);
                line.setAttr('tox', tox); line.setAttr('toy', toy);
                return line;
            };
            this.layers[view].add(createExtLine(tx1, ty1, tox1, toy1));
            this.layers[view].add(createExtLine(tx2, ty2, tox2, toy2));
        }

        // 3. 치수 텍스트 생성 (회전 및 중앙 보정)
        let tdx = tox2 - tox1; let tdy = toy2 - toy1;
        let angle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;

        let textNode = new Konva.Text({
            x: (tox1 + tox2)/2, y: (toy1 + toy2)/2, text: len.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial',
            align: 'center', name: 'dimtext'
        });
        textNode.setAttr('baseFontSize', 12);
        textNode.rotation(angle);
        textNode.offsetX(textNode.width()/2);
        textNode.offsetY(textNode.height() * 0.8);
        this.layers[view].add(textNode);
    }

    // ★ 업그레이드 된 반지름 치수 기입 (Arrow + 빨간 텍스트)
    addDimRadius(view, x, y, r, angleDeg) {
        if(!this.layers[view]) return;
        let tx = this._transformX(x); let ty = this._transformY(y);
        let rad = angleDeg * Math.PI / 180;
        let tpx = this._transformX(x + r * Math.cos(rad));
        let tpy = this._transformY(y + r * Math.sin(rad));
        let scale = this.stages[view].scaleX() || 1;

        let arrow = new Konva.Arrow({
            points: [tx, ty, tpx, tpy],
            stroke: 'red', fill: 'red',
            strokeWidth: 1 / scale, dash: [4, 4],
            pointerLength: 10 / scale, pointerWidth: 8 / scale,
            pointerAtEnding: true, name: 'dimarrow'
        });
        arrow.setAttr('baseStrokeWidth', 1);
        arrow.setAttr('basePointerLength', 10);
        arrow.setAttr('basePointerWidth', 8);
        this.layers[view].add(arrow);
        
        let tdx = tpx - tx; let tdy = tpy - ty;
        let textAngle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (textAngle > 90 || textAngle < -90) textAngle += 180;

        let textNode = new Konva.Text({
            x: (tx + tpx)/2, y: (ty + tpy)/2, text: 'R' + r.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial',
            align: 'center', name: 'dimtext'
        });
        textNode.setAttr('baseFontSize', 12);
        textNode.rotation(textAngle);
        textNode.offsetX(textNode.width()/2);
        textNode.offsetY(textNode.height() * 0.8);
        this.layers[view].add(textNode);
    }

    render() {
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

        Object.keys(this.stages).forEach(view => {
            let stage = this.stages[view];
            let box = boxes[view];
            stage.scale({x: minScale, y: minScale});
            stage.position({
                x: stage.width() / 2 - (box.x + box.width / 2) * minScale,
                y: stage.height() / 2 - (box.y + box.height / 2) * minScale
            });
        });

        let fPos = this.stages['front'].position();
        this.stages['side'].y(fPos.y); 
        this.stages['top'].x(fPos.x); 
        this.stages['bottom'].x(fPos.x); 

        let tPos = this.stages['top'].position();
        this.stages['bottom'].y(tPos.y); 

        Object.keys(this.stages).forEach(view => {
            this.updateScaleUI(this.layers[view], minScale);
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
    shtml += "                  <h6 class='mb-0 text-white'>DRAWING VIEW (Synchronized Zoom/Pan & Dimension)</h6>";
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
