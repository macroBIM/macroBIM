/** v000
 * @file bim_dashboard.js
 * @description Frame 메뉴 클릭 시 Structural Design Automation Pro 대시보드를 동적으로 렌더링하는 스크립트
 */

/**
 * Frame 대시보드 화면을 콘텐츠 영역에 동적으로 렌더링하는 함수
 */
function dashboard_click() {
    const contentDiv = document.getElementById('content');
    
    // content 영역이 존재하지 않을 경우 에러 방지
    if (!contentDiv) {
        console.error("id가 'content'인 DOM 요소를 찾을 수 없습니다.");
        return;
    }

    // 대시보드 HTML 구조 정의 (ES6 Template Literals 사용)
    const dashboardHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h4 class="fw-bold">Frame Analysis Dashboard</h4>
            <div class="text-muted"><i class="far fa-calendar-alt"></i> 2026. 04. 10</div>
        </div>

        <div class="row mb-2">
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-primary text-primary" style="background: #eef0ff;"><i class="fas fa-weight-hanging"></i></div>
                    <div><small class="text-muted">강재 중량</small><div class="h5 mb-0 fw-bold">14.52 ton</div></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-success text-success" style="background: #e6fffa;"><i class="fas fa-bolt"></i></div>
                    <div><small class="text-muted">볼트 수 (M20)</small><div class="h5 mb-0 fw-bold">182 EA</div></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-warning text-warning" style="background: #fff8e6;"><i class="fas fa-nodes-column"></i></div>
                    <div><small class="text-muted">총 노드 수</small><div class="h5 mb-0 fw-bold">24 EA</div></div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-danger text-danger" style="background: #fff5f5;"><i class="fas fa-won-sign"></i></div>
                    <div><small class="text-muted">예상 견적</small><div class="h5 mb-0 fw-bold">2,140 만원</div></div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between"><span>Front View (정면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card border-primary">
                    <div class="card-header d-flex justify-content-between bg-primary text-white"><span>3D Perspective</span><i class="fas fa-cube"></i></div>
                    <div class="view-port" style="background: radial-gradient(circle, #2c3e50 0%, #000 100%);"><span class="view-tag bg-warning text-dark">RENDERED</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">Top View (평면)</div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">Side View (측면)</div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
        </div>
    `;

    // DOM 업데이트
    contentDiv.innerHTML = dashboardHTML;
}
