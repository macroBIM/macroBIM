/*
  KONVA VIEWER JS  v001 (config 기반 N-분할 레이아웃 + 동기화)
*/

// ==========================================
// Konva.js Viewer Wrapper (설정 가능한 N-분할 Viewports & 동기화)
// ==========================================
class KonvaViewer {
    constructor(containerId, config) {
        let container = document.getElementById(containerId);
        container.innerHTML = "";

        container.style.display = 'grid';
        container.style.gap = '2px';
        container.style.backgroundColor = '#444';

        this.stages = {};
        this.layers = {};
        this.styles = {};

        let views, layoutRows, syncXGroups, syncYGroups, syncScaleGroups;

        if (config && config.layout) {
            let gridCols = config.gridCols || 6;
            container.style.gridTemplateColumns = `repeat(${gridCols}, 1fr)`;
            layoutRows = config.layout;
            views = [];
            layoutRows.forEach(r => r.views.forEach(v => views.push(v)));
            syncXGroups = config.syncX || [];
            syncYGroups = config.syncY || [];
            syncScaleGroups = config.syncScale || [views];
        } else {
            container.style.gridTemplateColumns = '1fr 1fr';
            container.style.gridTemplateRows = '1fr 1fr';
            views = ['front', 'side', 'top', 'bottom'];
            layoutRows = [
                { views: ['front', 'side'], span: 1 },
                { views: ['top', 'bottom'], span: 1 }
            ];
            syncXGroups = [['front', 'top', 'bottom']];
            syncYGroups = [['front', 'side'], ['top', 'bottom']];
            syncScaleGroups = [views];
        }

        this.syncXGroups = syncXGroups;
        this.syncYGroups = syncYGroups;
        this.syncScaleGroups = syncScaleGroups;

        this.updateScaleUI = (layer, newScale) => {
            layer.find('.dimarrow').forEach(arrow => {
                arrow.pointerLength(8 / newScale);
                arrow.pointerWidth(6 / newScale);
            });
            layer.find('.extline').forEach(line => {
                let unx = line.getAttr('unx'), uny = line.getAttr('uny');
                let tx = line.getAttr('tx'), ty = line.getAttr('ty');
                let tox = line.getAttr('tox'), toy = line.getAttr('toy');
                line.points([
                    tx + unx * (2 / newScale), ty + uny * (2 / newScale),
                    tox + unx * (4 / newScale), toy + uny * (4 / newScale)
                ]);
            });
            layer.find('.dimtext').forEach(text => {
                text.fontSize(12 / newScale);
                text.offsetX(text.width() / 2);
                text.offsetY(text.height() + (4 / newScale));
            });
        };

        const syncStages = (sourceView) => {
            const src = this.stages[sourceView];
            const srcPos = src.position();
            const srcScale = src.scaleX();
            const srcScaleGroup = syncScaleGroups.find(g => g.includes(sourceView));

            views.forEach(view => {
                if (view === sourceView) return;

                const target = this.stages[view];
                const oldScale = target.scaleX();
                let targetX = target.x();
                let targetY = target.y();

                let syncX = syncXGroups.some(g => g.includes(sourceView) && g.includes(view));
                let syncY = syncYGroups.some(g => g.includes(sourceView) && g.includes(view));
                let sameScale = srcScaleGroup && srcScaleGroup.includes(view);
                let newScale = sameScale ? srcScale : oldScale;

                if (syncX) {
                    if (sameScale) {
                        targetX = srcPos.x;
                    } else {
                        let srcLogX = (src.width() / 2 - srcPos.x) / srcScale;
                        targetX = target.width() / 2 - srcLogX * newScale;
                    }
                } else {
                    let cw = target.width() / 2;
                    let logicalX = (cw - targetX) / oldScale;
                    targetX = cw - logicalX * newScale;
                }

                if (syncY) {
                    if (sameScale) {
                        targetY = srcPos.y;
                    } else {
                        let srcLogY = (src.height() / 2 - srcPos.y) / srcScale;
                        targetY = target.height() / 2 - srcLogY * newScale;
                    }
                } else {
                    let ch = target.height() / 2;
                    let logicalY = (ch - targetY) / oldScale;
                    targetY = ch - logicalY * newScale;
                }

                target.scale({ x: newScale, y: newScale });
                target.position({ x: targetX, y: targetY });

                this.updateScaleUI(this.layers[view], newScale);
                target.batchDraw();
            });
        };

        layoutRows.forEach(row => {
            row.views.forEach(view => {
                const wrapper = document.createElement('div');
                wrapper.style.position = 'relative';
                wrapper.style.width = '100%';
                wrapper.style.backgroundColor = '#000';
                wrapper.style.overflow = 'hidden';
                if (row.span) {
                    wrapper.style.gridColumn = `span ${row.span}`;
                }
                if (config && config.square) {
                    wrapper.style.aspectRatio = '1';
                } else {
                    wrapper.style.height = '100%';
                }
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

        let arrow = new Konva.Arrow({
            points: [tox1, toy1, tox2, toy2],
            stroke: 'red', fill: 'red', strokeWidth: 1,
            pointerLength: 8 / scale, pointerWidth: 6 / scale,
            pointerAtBeginning: true, strokeScaleEnabled: false,
            name: 'dimarrow'
        });
        group.add(arrow);

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

        let tdx = tox2 - tox1; let tdy = toy2 - toy1;
        let angle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (angle > 90 || angle < -90) angle += 180;

        let textNode = new Konva.Text({
            x: (tox1 + tox2)/2, y: (toy1 + toy2)/2, text: len.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial',
            align: 'center', name: 'dimtext'
        });
        textNode.rotation(angle);
        textNode.offsetX(textNode.width()/2);
        textNode.offsetY(textNode.height() + (4 / scale));
        group.add(textNode);

        this.layers[view].add(group);
    }

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
            pointerLength: 8 / scale, pointerWidth: 6 / scale,
            strokeScaleEnabled: false, name: 'dimarrow'
        });
        group.add(arrow);

        let tdx = tpx - tx; let tdy = tpy - ty;
        let textAngle = Math.atan2(tdy, tdx) * 180 / Math.PI;
        if (textAngle > 90 || textAngle < -90) textAngle += 180;

        let textNode = new Konva.Text({
            x: (tx + tpx)/2, y: (ty + tpy)/2, text: 'R' + r.toFixed(1),
            fontSize: 12 / scale, fill: 'red', fontFamily: 'Arial',
            align: 'center', name: 'dimtext'
        });
        textNode.rotation(textAngle);
        textNode.offsetX(textNode.width()/2);
        textNode.offsetY(textNode.height() + (4 / scale));
        group.add(textNode);

        this.layers[view].add(group);
    }

    render() {
        setTimeout(() => {
            let boxes = {};
            let scales = {};
            const views = Object.keys(this.stages);

            views.forEach(view => {
                let div = document.getElementById(this.stages[view].container().id);
                if (div && div.offsetWidth > 0) {
                    this.stages[view].width(div.offsetWidth);
                    this.stages[view].height(div.offsetHeight);
                }
                let box = this.layers[view].getClientRect({ skipTransform: true });
                boxes[view] = box;
            });

            this.syncScaleGroups.forEach(group => {
                let groupMinScale = Infinity;
                group.forEach(view => {
                    if (!this.stages[view]) return;
                    let box = boxes[view];
                    if (box.width > 0 && box.height > 0) {
                        let padding = 40;
                        let scaleX = this.stages[view].width() / (box.width + padding * 2);
                        let scaleY = this.stages[view].height() / (box.height + padding * 2);
                        groupMinScale = Math.min(groupMinScale, scaleX, scaleY);
                    }
                });
                if (groupMinScale === Infinity) groupMinScale = 1;
                group.forEach(view => { scales[view] = groupMinScale; });
            });

            views.forEach(view => {
                let stage = this.stages[view];
                let box = boxes[view];
                let s = scales[view] || 1;
                stage.scale({ x: s, y: s });
                stage.position({
                    x: stage.width() / 2 - (box.x + box.width / 2) * s,
                    y: stage.height() / 2 - (box.y + box.height / 2) * s
                });
            });

            this.syncXGroups.forEach(group => {
                let ref = group.find(v => this.stages[v]);
                if (ref) {
                    let refScale = scales[ref] || 1;
                    let refLogX = (this.stages[ref].width() / 2 - this.stages[ref].x()) / refScale;
                    group.forEach(v => {
                        if (v !== ref && this.stages[v]) {
                            let vScale = scales[v] || 1;
                            this.stages[v].x(this.stages[v].width() / 2 - refLogX * vScale);
                        }
                    });
                }
            });
            this.syncYGroups.forEach(group => {
                let ref = group.find(v => this.stages[v]);
                if (ref) {
                    let refScale = scales[ref] || 1;
                    let refLogY = (this.stages[ref].height() / 2 - this.stages[ref].y()) / refScale;
                    group.forEach(v => {
                        if (v !== ref && this.stages[v]) {
                            let vScale = scales[v] || 1;
                            this.stages[v].y(this.stages[v].height() / 2 - refLogY * vScale);
                        }
                    });
                }
            });

            views.forEach(view => {
                this.updateScaleUI(this.layers[view], scales[view] || 1);
                this.stages[view].batchDraw();
            });
        }, 50);
    }
}
// ==========================================
