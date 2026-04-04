/*
  KONVA VIEWER JS  v000 (Konva.js 치수선 Arrow 적용 및 4분할 동기화)
*/

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

        // 줌(Zoom) 비율에 맞춰 화살표 크기, 텍스트 크기, 보조선 갭을 스크린 픽셀에 맞게 역보정
        this.updateScaleUI = (layer, newScale) => {
            layer.find('.dimarrow').forEach(arrow => {
                arrow.pointerLength(8 / newScale); // 화살표 크기도 살짝 줄임
                arrow.pointerWidth(6 / newScale);
            });
            layer.find('.extline').forEach(line => {
                let unx = line.getAttr('unx'), uny = line.getAttr('uny');
                let tx = line.getAttr('tx'), ty = line.getAttr('ty');
                let tox = line.getAttr('tox'), toy = line.getAttr('toy');
                // 객체에서 2px 띄우고, 치수선 밖으로 4px 연장 (화면 픽셀 기준 보정)
                line.points([
                    tx + unx * (2 / newScale), ty + uny * (2 / newScale),
                    tox + unx * (4 / newScale), toy + uny * (4 / newScale)
                ]);
            });
            layer.find('.dimtext').forEach(text => {
                text.fontSize(12 / newScale); // ★ 글자 크기를 12 -> 9로 작게 수정
                text.offsetX(text.width() / 2);
                // ★ 버그 수정: textNode가 아니라 text 입니다! + 글자와 선 사이 간격 띄우기
                text.offsetY(text.height() + (4 / newScale)); 
            });
        };
        
        // 동기화 함수
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
                width: div.offsetWidth || 400,
                height: div.offsetHeight || 300,
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
                stage.position({
                    x: pointer.x - mousePointTo.x * newScale,
                    y: pointer.y - mousePointTo.y * newScale,
                });
                
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
                    this.stages[view].width(div.offsetWidth);
                    this.stages[view].height(div.offsetHeight);
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
        this.layers[view].add(new Konva.Line({
            points: [this._transformX(x1), this._transformY(y1), this._transformX(x2), this._transformY(y2)],
            stroke: st.stroke, strokeWidth: st.width, dash: st.dash, name: 'shape',
            strokeScaleEnabled: false
        }));
    }

    addCircle(view, x, y, r, layerName) {
        if(!this.layers[view]) return;
        let st = this._getStyle(layerName);
        this.layers[view].add(new Konva.Circle({
            x: this._transformX(x), y: this._transformY(y), radius: r,
            stroke: st.stroke, strokeWidth: st.width, dash: st.dash, name: 'shape',
            strokeScaleEnabled: false
        }));
    }

    addArc(view, x, y, r, angStart, angEnd, layerName) {
        if(!this.layers[view]) return;
        let st = this._getStyle(layerName);
        let tx = this._transformX(x);
        let ty = this._transformY(y);
        
        this.layers[view].add(new Konva.Shape({
            stroke: st.stroke, strokeWidth: st.width, dash: st.dash, name: 'shape',
            strokeScaleEnabled: false,
            sceneFunc: function(ctx, shape) {
                ctx.beginPath();
                ctx.arc(tx, ty, r, -angStart * Math.PI / 180, -angEnd * Math.PI / 180, true);
                ctx.strokeShape(shape);
            }
        }));
    }

    // ★ 업그레이드 된 선형 치수선
    addDimLinear(view, x1, y1, x2, y2, gap) {
        if(!this.layers[view]) return;
        let dx = x2 - x1; let dy = y2 - y1; let len = Math.sqrt(dx*dx + dy*dy); if(len === 0) return;
        let nx = -dy / len; let ny = dx / len;
        
        let tox1 = this._transformX(x1 + nx * gap); let toy1 = this._transformY(y1 + ny * gap);
        let tox2 = this._transformX(x2 + nx * gap); let toy2 = this._transformY(y2 + ny * gap);
        let tx1 = this._transformX(x1); let ty1 = this._transformY(y1);
        let tx2 = this._transformX(x2); let ty2 = this._transformY(y2);

        let scale = this.stages[view].scaleX() || 1;
        const group = new Konva.Group({ name: 'dim_group' });

        // 1. 양방향 화살표
        let arrow = new Konva.Arrow({
            points: [tox1, toy1, tox2, toy2],
            stroke: 'red', fill: 'red', strokeWidth: 1,
            pointerLength: 8 / scale, pointerWidth: 6 / scale, // 화살표 크기 축소
            pointerAtBeginning: true, strokeScaleEnabled: false,
            name: 'dimarrow'
        });
        group.add(arrow);

        // 2. 보조선
        let vdx1 = tox1 - tx1; let vdy1 = toy1 - ty1;
        let vlen = Math.sqrt(vdx1*vdx1 + vdy1*vdy1);
        if(vlen > 0) {
            let unx = vdx1/vlen; let uny = vdy1/vlen;
            let createExtLine = (tx, ty, tox, toy) => {
                let line = new Konva.Line({
                    points: [tx + unx * (2/scale), ty + uny * (2/scale), tox + unx * (4/scale), toy + uny * (4/scale)],
                    stroke: 'red', strokeWidth: 1, strokeScaleEnabled: false, name: 'extline'
                });
                line.setAttr('unx', unx); line.setAttr('uny', uny);
                line.setAttr('tx', tx); line.setAttr('ty', ty);
                line.setAttr('tox', tox); line.setAttr('toy', toy);
                return line;
            };
            group.add(createExtLine(tx1, ty1, tox1, toy1));
            group.add(createExtLine(tx2, ty2, tox2, toy2));
        }

        // 3. 치수 텍스트
        let tdx = tox2 - tox1; let tdy = toy2 - toy1;
        let angle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;

        let textNode = new Konva.Text({
            x: (tox1 + tox2)/2, y: (toy1 + toy2)/2, text: len.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial', // ★ 12 -> 9
            align: 'center', name: 'dimtext'
        });
        textNode.rotation(angle);
        textNode.offsetX(textNode.width()/2);
        // ★ 글자와 선 사이 간격 띄우기
        textNode.offsetY(textNode.height() + (4 / scale)); 
        group.add(textNode);

        this.layers[view].add(group);
    }

    // ★ 반지름 치수선 
    addDimRadius(view, x, y, r, angleDeg) {
        if(!this.layers[view]) return;
        let tx = this._transformX(x); let ty = this._transformY(y);
        let rad = angleDeg * Math.PI / 180;
        let tpx = this._transformX(x + r * Math.cos(rad));
        let tpy = this._transformY(y + r * Math.sin(rad));
        let scale = this.stages[view].scaleX() || 1;

        const group = new Konva.Group({ name: 'dim_group' });

        let arrow = new Konva.Arrow({
            points: [tx, ty, tpx, tpy],
            stroke: 'red', fill: 'red', strokeWidth: 1, dash: [4, 4],
            pointerLength: 8 / scale, pointerWidth: 6 / scale, // 화살표 크기 축소
            strokeScaleEnabled: false, name: 'dimarrow'
        });
        group.add(arrow);
        
        let tdx = tpx - tx; let tdy = tpy - ty;
        let textAngle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (textAngle > 90 || textAngle < -90) textAngle += 180;

        let textNode = new Konva.Text({
            x: (tx + tpx)/2, y: (ty + tpy)/2, text: 'R' + r.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial', // ★ 12 -> 9
            align: 'center', name: 'dimtext'
        });
        textNode.rotation(textAngle);
        textNode.offsetX(textNode.width()/2);
        // ★ 글자와 선 사이 간격 띄우기
        textNode.offsetY(textNode.height() + (4 / scale)); 
        group.add(textNode);

        this.layers[view].add(group);
    }

    render() {
        // setTimeout을 통해 DOM 최적화 후 사이즈 다시 잡기
        setTimeout(() => {
            let minScale = Infinity;
            let boxes = {};

            // 1. 모든 뷰를 포괄할 수 있는 최적의 동일 Scale 계산
            Object.keys(this.stages).forEach(view => {
                let div = document.getElementById(this.stages[view].container().id);
                if (div && div.offsetWidth > 0) {
                    this.stages[view].width(div.offsetWidth);
                    this.stages[view].height(div.offsetHeight);
                }
                let box = this.layers[view].getClientRect({ skipTransform: true });
                boxes[view] = box;
                if (box.width > 0 && box.height > 0) {
                    let padding = 40;
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

            // 3. 축 정렬 보정
            let fPos = this.stages['front'].position();
            this.stages['side'].y(fPos.y); 
            this.stages['top'].x(fPos.x); 
            this.stages['bottom'].x(fPos.x); 

            let tPos = this.stages['top'].position();
            this.stages['bottom'].y(tPos.y); 

            // 4. 스케일에 따른 텍스트/화살표 보정 후 렌더링
            Object.keys(this.stages).forEach(view => {
                this.updateScaleUI(this.layers[view], minScale);
                this.stages[view].batchDraw();
            });
        }, 50);
    }
}
// ==========================================
