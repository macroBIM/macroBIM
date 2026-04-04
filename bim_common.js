/*
  common.js v000
*/


// 스크립트 최상단
let Gvar = {
    dwg_scale: 1,  // 초기값
    dim_ext: 10,
    dim_off: 10,
	A1width : 841,
	A1height : 594
};

// 스크립트 최상단 혹은 적절한 위치에 변수 선언
let G_LastWireframe3D = null;
let babylonEngine = null;     // Babylon 엔진 인스턴스
let babylonScene = null;      // Babylon 씬 인스턴스

// 창 열고 닫기 함수
function toggleDimensionImage() {
    const win = document.getElementById('floating_img_win');
    if (win.style.display === 'none') {
        win.style.display = 'block';
    } else {
        win.style.display = 'none';
    }
}

// 드래그 로직 함수
function initDraggable(el, header) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    header.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // 마우스 시작 위치
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e = e || window.event;
        e.preventDefault();
        // 좌표 계산
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        // 요소 위치 변경
        el.style.top = (el.offsetTop - pos2) + "px";
        el.style.left = (el.offsetLeft - pos1) + "px";
        el.style.transform = "none"; // 드래그 시작 시 초기 중앙정렬 transform 제거
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// 마지막 인자로 sEventFunc(함수명 문자열)를 추가했습니다.
function createRowInput( label, sid , val1, sEventFunc) {
	
	// 만약 sEventFunc를 입력하지 않았을 때를 대비한 기본값 설정 (필요시)
	if (!sEventFunc) sEventFunc = ""; 

	let stext = `
	<div class='row mb-2 align-items-center'>
		<label class='col-8 col-form-label text-muted' style='font-size: 0.85rem;'>
			${label}
		</label>
		<div class='col-4'>
			<input type='number' id='${sid}' 
				class='form-control form-control-sm text-center' 
				value='${val1}' min='0' required 
				onchange='${sEventFunc}' 
				style='font-size: 0.85rem;'>
		</div>
	</div>`;
		
	return stext;
}

function createRowText( label, sid , val1, sEventFunc) {
	
	// 만약 sEventFunc를 입력하지 않았을 때를 대비한 기본값 설정 (필요시)
	if (!sEventFunc) sEventFunc = ""; 

	let stext = `
	<div class='row mb-2 align-items-center'>
		<label class='col-8 col-form-label text-muted' style='font-size: 0.85rem;'>
			${label}
		</label>
		<div class='col-4'>
			<input type='text' id='${sid}' 
				class='form-control form-control-sm text-center' 
				value='${val1}' min='0' required 
				onchange='${sEventFunc}' 
				style='font-size: 0.85rem;'>
		</div>
	</div>`;
		
	return stext;
}

function createRowInput2( label, sid1 , val1, sid2, val2, sEventFunc) {
	
	// 만약 sEventFunc를 입력하지 않았을 때를 대비한 기본값 설정 (필요시)
	if (!sEventFunc) sEventFunc = ""; 

	let stext = `
	<div class='row mb-2 align-items-center'>
		<label class='col-4 col-form-label text-muted' style='font-size: 0.85rem;'>
			${label}
		</label>
		<div class='col-4'>
			<input type='number' id='${sid1}' 
				class='form-control form-control-sm text-center' 
				value='${val1}' min='0' required 
				onchange='${sEventFunc}' 
				style='font-size: 0.85rem;'>
		</div>`;
		
	if( svar2 !== "" && svar2 !== undefined && svar2 !== null ){
		
		stext +=` 
		<div class='col-4'>
			<input type='number' id='${sid2}' 
				class='form-control form-control-sm text-center' 
				value='${val2}' min='0' required 
				onchange='${sEventFunc}'
				style='font-size: 0.85rem;'>
		</div>`;		
	
	}

	// [중요] 두 번째 변수가 있든 없든 row div는 닫아야 하므로 밖으로 뺐습니다.
	stext += `</div>`;
		
	return stext;
}

	// 2. 텍스트 입력창 (textarea)
	function createTextInput(id, label, stext, sEventFunc) {
		return `
		<div class='mb-3'>
			<label for='${id}' class='form-label mb-1 text-muted fw-bold' style='font-size: 0.85rem;'>
				${label}
			</label>
			
			<div class='w-100'>
				<textarea 
					class='form-control form-control-sm' 
					id='${id}' 
					rows='4' 
					/* 값 변경 시 실행 */
					onchange='${sEventFunc}'					
					style='
						resize: none;         /* 크기 조절 불가 */
						overflow-y: auto;    /* 스크롤 가능 */
						overflow-x: auto;    /* 스크롤 가능 */
						width: 100%;         /* 너비 100% */
						white-space: pre;
						/* --- 폰트 통일 핵심 설정 --- */
						font-family: inherit; /* 일반 텍스트와 같은 폰트 사용 */
						font-size: 0.85rem;    /* 글자 크기 통일 */
						padding: 8px;         /* 내부 여백 조절 */
					'
				>${stext}</textarea>
			</div>
		</div>`;
	}

	function createLabel3(label1, label2, label3) {
		return `
		<div class='row mb-2 align-items-center'>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label1}
			</label>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label2}
			</label>
			<label class='col-4 col-form-label text-muted fw-bold d-flex align-items-center justify-content-center text-center' style='font-size: 0.85rem;'>
				${label3}
			</label>
		</div>`;
	}

	function createLabel(label1) {
		return `
		<div class='row mb-2 align-items-center'>
			<label class='col-12 col-form-label text-muted fw-bold d-flex align-items-start justify-content-start text-left' style='font-size: 0.85rem;'>
				${label1}
			</label>
		</div>`;
	}
		
