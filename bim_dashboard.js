/** v000
 * =========================================================================
 * ⬛ Dashboard Module (dashboard.js)
 * Description: Renders the 4-split view structural dashboard
 * =========================================================================
 */

function dashboard_click() {
    // 1. CSS 동적 로드 (아직 로드되지 않은 경우)
    loadDashboardStyles();

    // 2. 화면에 렌더링될 HTML 템플릿
    const dashboardHTML = `
        <div id="dashboard-content" style="padding: 20px; background-color: #f4f5fa; min-height: 100vh;">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold"><i class="fas fa-columns"></i> Frame Analysis Dashboard</h4>
                <div class="text-muted" id="current-date"><i class="far fa-calendar-alt"></i> Loading Date...</div>
            </div>

            <div class="row mb-3">
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-primary text-primary" style="background: #eef0ff;"><i class="fas fa-weight-hanging"></i></div>
                        <div><small class="text-muted">예상 강재 중량</small><div class="h5 mb-0 fw-bold" id="stat-weight">0.00 ton</div></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-success text-success" style="background: #e6fffa;"><i class="fas fa-bolt"></i></div>
                        <div><small class="text-muted">연결 볼트 수</small><div class="h5 mb-0 fw-bold" id="stat-bolts">0 EA</div></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-warning text-warning" style="background: #fff8e6;"><i class="fas fa-nodes-column"></i></div>
                        <div><small class="text-muted">총 노드(Node) 수</small><div class="h5 mb-0 fw-bold" id="stat-nodes">0 EA</div></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-danger text-danger" style="background: #fff5f5;"><i class="fas fa-won-sign"></i></div>
                        <div><small class="text-muted">물량 산출 상태</small><div class="h5 mb-0 fw-bold text-success">대기중</div></div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Front View (정면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-front"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card border-primary">
                        <div class="card-header d-flex justify-content-between bg-primary text-white"><span>3D Perspective</span><i class="fas fa-cube"></i></div>
                        <div class="view-port" id="vp-3d" style="background: radial-gradient(circle, #2c3e50 0%, #000 100%);"><span class="view-tag bg-warning text-dark">RENDERED</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Top View (평면)</div>
                        <div class="view-port" id="vp-top"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Side View (측면)</div>
                        <div class="view-port" id="vp-side"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 3. index1.html의 메인 컨텐츠 영역을 찾아 HTML 주입
    const targetContainer = document.getElementById('renderContainer') || document.getElementById('main-content-area') || document.body;
    
    if (targetContainer) {
        // 기존 내용을 지우고 새로운 대시보드로 교체
        targetContainer.innerHTML = dashboardHTML;
        
        // 날짜 자동 업데이트
        const dateEl = document.getElementById('current-date');
        if(dateEl) {
            const today = new Date();
            dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
        }

        console.log("Dashboard loaded successfully.");
        
    } else {
        console.error("Target container for Dashboard not found.");
    }
}

// 대시보드 전용 CSS를 동적으로 문서 Head에 추가하는 헬퍼 함수
function loadDashboardStyles() {
    if (document.getElementById('dashboard-styles')) return; // 이미 로드되었다면 스킵

    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.innerHTML = `
        /* Card Styling */
        .card { border: none; border-radius: 15px; box-shadow: 0 4px 20px 0 rgba(0,0,0,.05); margin-bottom: 1.8rem; background: #fff; }
        .card-header { background: transparent; border-bottom: 1px solid #f0f0f0; padding: 1.2rem; font-weight: 600; }
        
        /* Viewport Styling */
        .view-port { background: #1a1a1a; height: 380px; border-radius: 0 0 15px 15px; position: relative; overflow: hidden; }
        .view-tag { position: absolute; top: 15px; left: 15px; background: rgba(102, 110, 232, 0.8); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; z-index: 10; }
        
        /* Stats Badge Styling */
        .stats-card { padding: 1.5rem; display: flex; align-items: center; }
        .stats-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; margin-right: 15px; }
        
        /* Helpers */
        .bg-light-primary { background: #eef0ff; }
        .bg-light-success { background: #e6fffa; }
        .bg-light-warning { background: #fff8e6; }
        .bg-light-danger { background: #fff5f5; }
    `;
    document.head.appendChild(style);
}
