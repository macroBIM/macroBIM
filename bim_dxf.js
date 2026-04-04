/*
  dxf.j v0000
*/


    // ===============================================
    //  DXF 생성기 (Safe Version)
    // ===============================================
    function dxf_generator() {
		
        let layers = [];
        let entities = []; // 여기에 도형이 쌓입니다.

        function g(code, value) { return `${code}\n${value}\n`; }

        function _reset() {
            layers = [];
            entities = [];
            layers.push({ name: "0", color: 7, ltype: "CONTINUOUS" });
        }
        _reset();

        // ------------------------------------------------
        // [공개 메서드]
        // ------------------------------------------------
        
        function init() {
            _reset();
            //console.log("초기화 완료");
        }

        function layer(name, color, ltype) {
			//  1 : red
			//	2 : yellow
			//	3 : green
			//	4 : cyan
			//	5 : blue
			//	6 : magneta
			//	7 : white
			//	251	: 진한회색	251~254
			//	253 : 옅은회색
            layers.push({ name, color, ltype: ltype.toUpperCase() });
        }

        function line(x1, y1, x2, y2, layerName = "0") {
            let s = g(0, "LINE") + g(8, layerName) + g(10, x1) + g(20, y1) + g(11, x2) + g(21, y2);
            entities.push(s);
        }

        function circle(cx, cy, r, layerName = "0") {
            let s = g(0, "CIRCLE") + g(8, layerName) + g(10, cx) + g(20, cy) + g(40, r);
            entities.push(s);
        }

        function arc(cx, cy, r, startAngle, endAngle, layerName = "0") {
            let s = g(0, "ARC") + g(8, layerName) + g(10, cx) + g(20, cy) + g(40, r) + g(50, startAngle) + g(51, endAngle);
            entities.push(s);
        }
		
		function rect(cx, cy, db, dh, layerName = "0") {
			
			let x1 = cx - db / 2;
			let x2 = cx + db / 2;
			let y1 = cy - dh / 2;
			let y2 = cy + dh / 2;

			line(x1, y1, x2, y1, layerName); // 아래
			line(x2, y1, x2, y2, layerName); // 오른쪽
			line(x2, y2, x1, y2, layerName); // 위
			line(x1, y2, x1, y1, layerName); // 왼쪽
			
		}
		
		function hbeam(cx, cy, dsech, dbt, dbb, dttf, dtbf, dtw, dradius, layerName = "0", hiddenlayerName = "0") {
			// 1. 기본 수치 계산 (중심점 기준 상하좌우 경계)
			const halfH = dsech / 2;
			const halfTw = dtw / 2;
			
			// Y 좌표 (위에서 아래로)
			const yTop = cy + halfH;
			const yTopInner = yTop - dttf;
			const yBottomInner = cy - halfH + dtbf;
			const yBottom = cy - halfH;

			// X 좌표 (좌우 플랜지 폭)
			const xTopLeft = cx - dbt / 2;
			const xTopRight = cx + dbt / 2;
			const xBottomLeft = cx - dbb / 2;
			const xBottomRight = cx + dbb / 2;

			// 2. 필렛(Fillet) 처리 로직
			if (dradius <= 0) {
				// 필렛이 없을 경우 (직각형태)
				// 상부 플랜지
				line(xTopLeft, yTop, xTopRight, yTop, layerName);
				line(xTopRight, yTop, xTopRight, yTopInner, layerName);
				line(xTopRight, yTopInner, cx + halfTw, yTopInner, layerName);
				
				// 웨브 (오른쪽)
				line(cx + halfTw, yTopInner, cx + halfTw, yBottomInner, layerName);
				
				// 하부 플랜지
				line(cx + halfTw, yBottomInner, xBottomRight, yBottomInner, layerName);
				line(xBottomRight, yBottomInner, xBottomRight, yBottom, layerName);
				line(xBottomRight, yBottom, xBottomLeft, yBottom, layerName);
				line(xBottomLeft, yBottom, xBottomLeft, yBottomInner, layerName);
				line(xBottomLeft, yBottomInner, cx - halfTw, yBottomInner, layerName);
				
				// 웨브 (왼쪽)
				line(cx - halfTw, yBottomInner, cx - halfTw, yTopInner, layerName);
				
				// 다시 상부로 연결
				line(cx - halfTw, yTopInner, xTopLeft, yTopInner, layerName);
				line(xTopLeft, yTopInner, xTopLeft, yTop, layerName);
				
			} else {
				
				// 필렛이 있을 경우 (Arc 사용)
				const r = dradius;

				// 상부 바깥쪽 (직선)
				line(xTopLeft, yTop, xTopRight, yTop, layerName);
				line(xTopRight, yTop, xTopRight, yTopInner, layerName);
				line(xTopRight, yTopInner, cx + halfTw + r, yTopInner, layerName);

				// 상부 오른쪽 필렛 (90도 ~ 180도 구간)
				arc(cx + halfTw + r, yTopInner - r, r, 90, 180, layerName);
				
				// 웨브 오른쪽 직선
				line(cx + halfTw, yTopInner - r, cx + halfTw, yBottomInner + r, layerName);

				// 하부 오른쪽 필렛 (180도 ~ 270도 구간)
				arc(cx + halfTw + r, yBottomInner + r, r, 180, 270, layerName);

				// 하부 바깥쪽
				line(cx + halfTw + r, yBottomInner, xBottomRight, yBottomInner, layerName);
				line(xBottomRight, yBottomInner, xBottomRight, yBottom, layerName);
				line(xBottomRight, yBottom, xBottomLeft, yBottom, layerName);
				line(xBottomLeft, yBottom, xBottomLeft, yBottomInner, layerName);
				line(xBottomLeft, yBottomInner, cx - halfTw - r, yBottomInner, layerName);

				// 하부 왼쪽 필렛 (270도 ~ 360도 구간)
				arc(cx - halfTw - r, yBottomInner + r, r, 270, 360, layerName);

				// 웨브 왼쪽 직선
				line(cx - halfTw, yBottomInner + r, cx - halfTw, yTopInner - r, layerName);

				// 상부 왼쪽 필렛 (0도 ~ 90도 구간)
				arc(cx - halfTw - r, yTopInner - r, r, 0, 90, layerName);

				// 상부 왼쪽 마무리
				line(cx - halfTw - r, yTopInner, xTopLeft, yTopInner, layerName);
				line(xTopLeft, yTopInner, xTopLeft, yTop, layerName);
			}
			
		}		

		function hbeam_top(cx, cy, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, layerName = "0", hiddenlayerName = "0") {
			// 1. 기본 좌표 계산
			const halfWidth = dbt / 2;    // 상부 플랜지 폭의 절반
			const halfTw = dtw / 2;       // 복부 두께의 절반
			const halfLeng = dleng / 2;   // 전체 길이의 절반

			// X 좌표 (좌우)
			const xLeft = cx - halfWidth;
			const xRight = cx + halfWidth;
			const xWebLeft = cx - halfTw;
			const xWebRight = cx + halfTw;

			// Y 좌표 (상하)
			const yStart = cy - halfLeng;
			const yEnd = cy + halfLeng;

			// 2. 외곽선 그리기 (상부 플랜지 양 끝단 수직선)
			line(xLeft, yStart, xLeft, yEnd, layerName);   // 좌측 외곽선
			line(xRight, yStart, xRight, yEnd, layerName); // 우측 외곽선
			// 4. 상하단 마감 수평선 (Cap lines)
			// 좌측 끝에서 우측 끝까지 연결
			line(xLeft, yStart, xRight, yStart, layerName); // 하단 마감선
			line(xLeft, yEnd, xRight, yEnd, layerName);     // 상단 마감선

			// 3. 내부 복부선 그리기 (Web 수직선)
			// 참고: 실제 도면에서는 복부가 플랜지에 가려져 있으므로 
			// 점선(HIDDEN) 레이어를 사용하는 것이 일반적입니다.
			line(xWebLeft, yStart, xWebLeft, yEnd, hiddenlayerName);
			line(xWebRight, yStart, xWebRight, yEnd, hiddenlayerName);

		}

		function hbeam_bot(cx, cy, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, layerName = "0", hiddenlayerName = "0") {
			// 1. 기본 좌표 계산 (하부 플랜지 폭 dbb 기준)
			const halfWidth = dbb / 2;    // 하부 플랜지 폭의 절반
			const halfTw = dtw / 2;       // 복부 두께의 절반
			const halfLeng = dleng / 2;   // 전체 길이의 절반

			// X 좌표 (하부 플랜지 끝단 및 복부)
			const xLeft = cx - halfWidth;
			const xRight = cx + halfWidth;
			const xWebLeft = cx - halfTw;
			const xWebRight = cx + halfTw;

			// Y 좌표 (시작과 끝)
			const yStart = cy - halfLeng;
			const yEnd = cy + halfLeng;

			// 2. 외곽 수직선 (하부 플랜지 양 끝단)
			line(xLeft, yStart, xLeft, yEnd, layerName);
			line(xRight, yStart, xRight, yEnd, layerName);

			// 3. 내부 복부선 (Web)
			// 아래에서 볼 때도 복부는 플랜지에 가려져 있으므로 레이어 설정에 유의하세요.
			line(xWebLeft, yStart, xWebLeft, yEnd, hiddenlayerName);
			line(xWebRight, yStart, xWebRight, yEnd, hiddenlayerName);

			// 4. 상하단 마감 수평선 (Cap lines)
			// 하부 플랜지 폭(dbb)만큼 수평으로 연결
			line(xLeft, yStart, xRight, yStart, layerName); // 시작 부분 수평선
			line(xLeft, yEnd, xRight, yEnd, layerName);     // 끝 부분 수평선
		}

		function hbeam_side(cx, cy, dsech, dbt, dbb, dttf, dtbf, dtw, dleng, layerName = "0", hiddenlayerName = "0") {
			// 1. 기본 좌표 계산
			const halfH = dsech / 2;      // 전체 높이의 절반
			const halfLeng = dleng / 2;   // 전체 길이의 절반

			// X 좌표 (측면에서의 시작과 끝)
			const xStart = cx - halfLeng;
			const xEnd = cx + halfLeng;

			// Y 좌표 (위에서 아래로)
			const yTop = cy + halfH;             // 상부 플랜지 바깥쪽
			const yTopInner = yTop - dttf;       // 상부 플랜지 안쪽
			const yBottomInner = cy - halfH + dtbf; // 하부 플랜지 안쪽
			const yBottom = cy - halfH;          // 하부 플랜지 바깥쪽

			// 2. 외곽 수평선 (상/하부 플랜지 바깥선)
			line(xStart, yTop, xEnd, yTop, layerName);       // 최상단선
			line(xStart, yBottom, xEnd, yBottom, layerName); // 최하단선

			// 3. 플랜지 안쪽 수평선
			// 이 선들은 측면에서 봤을 때 보이는 실선입니다.
			line(xStart, yTopInner, xEnd, yTopInner, layerName);       // 상부 플랜지 두께선
			line(xStart, yBottomInner, xEnd, yBottomInner, layerName); // 하부 플랜지 두께선

			// 4. 좌우 마감 수직선 (Cap lines)
			// 좌측 끝단 수직선들
			line(xStart, yTop, xStart, yBottom, layerName);
			// 우측 끝단 수직선들
			line(xEnd, yTop, xEnd, yBottom, layerName);
		}

        function print() {
			let header = g(0, "SECTION") + g(2, "HEADER") + 
                 g(9, "$ACADVER") + g(1, "AC1009") + 
//                 g(9, "$DIMSCALE") + g(40, 1.0) +  // 치수 전체 척도 (필요시 조절)
//                 g(9, "$DIMASZ") + g(40, 2.5) +    // 화살표 크기
//                 g(9, "$DIMTXT") + g(40, 2.5) +    // 텍스트 크기
                 g(0, "ENDSEC");
				 
            let tables = g(0, "SECTION") + g(2, "TABLES");
            tables += g(0, "TABLE") + g(2, "LTYPE") + g(70, 4);
            tables += g(0, "LTYPE") + g(2, "CONTINUOUS") + g(70, 0) + g(3, "Solid") + g(72, 65) + g(73, 0) + g(40, 0.0);
            tables += g(0, "LTYPE") + g(2, "CENTER") + g(70, 0) + g(3, "Center") + g(72, 65) + g(73, 2) + g(40, 2.0) + g(49, 1.25) + g(49, -0.25);
            tables += g(0, "LTYPE") + g(2, "HIDDEN") + g(70, 0) + g(3, "Hidden") + g(72, 65) + g(73, 2) + g(40, 1.0) + g(49, 0.5) + g(49, -0.5);
            tables += g(0, "LTYPE") + g(2, "PHANTOM") + g(70, 0) + g(3, "Phantom") + g(72, 65) + g(73, 2) + g(40, 2.5) + g(49, 1.25) + g(49, -0.25);
            tables += g(0, "ENDTAB");

            tables += g(0, "TABLE") + g(2, "LAYER") + g(70, layers.length);
            for (let l of layers) {
                tables += g(0, "LAYER") + g(2, l.name) + g(70, 0) + g(62, l.color) + g(6, l.ltype);
            }
            tables += g(0, "ENDTAB") + g(0, "ENDSEC");

            let body = g(0, "SECTION") + g(2, "ENTITIES");
            for (let e of entities) body += e;
            body += g(0, "ENDSEC");

            return header + tables + body + g(0, "EOF");
        }

        // ★ [수정됨] 다운로드 함수
        function download( fileName ) {
            // 1. 내용물 검사 (Entities 배열 길이 체크)
            if (entities.length === 0) {
                alert("⚠️ 저장할 도면 요소가 없습니다.\n그리기 버튼을 먼저 눌러주세요.");
                return false; // 실패 반환
            }

            if (!fileName) fileName = "drawing.dxf";

            const content = print();
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            return true; // 성공 반환
        }

        return { 	init, layer, line, circle, arc, rect, hbeam, hbeam_top, hbeam_bot, hbeam_side, print,
					download };
    }


/*
    // ===============================================
    //  사용 코드
    // ===============================================
    const myDxf = FDxfGenerator();
    const logDiv = document.getElementById('log');

    function log(msg) {
        logDiv.innerHTML += "<div>" + msg + "</div>";
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function drawBox() {
        myDxf.init();
        myDxf.addLayer("BOX", 3, "CONTINUOUS");
        myDxf.line(0,0, 100,0, "BOX");
        myDxf.line(100,0, 100,50, "BOX");
        myDxf.line(100,50, 0,50, "BOX");
        myDxf.line(0,50, 0,0, "BOX");
        log("▶ 박스 그림 (데이터 생성됨)");
    }

    function clearAll() {
        myDxf.init();
        log("▶ 초기화됨 (데이터 없음)");
    }

    function tryDownload() {
        // 다운로드 성공 여부에 따라 로그 출력
        const result = myDxf.download('Valid_Drawing.dxf');
        
        if (result) {
            log("✅ 다운로드 성공!");
        } else {
            log("⛔ 다운로드 차단됨 (내용 없음)");
        }
    }
	
*/
