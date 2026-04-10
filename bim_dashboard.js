/** v001
 * =========================================================================
 * ⬛ Dashboard Module (dashboard.js)
 * Description: 7-Viewport Layout (1 Full 3D + 6 Orthogonal Views)
 * =========================================================================
 */

function dashboard_click() {
    // 1. CSS 동적 로드
    loadDashboardStyles();

    // 2. 대시보드 본문 HTML 템플릿 (7개 뷰포트 포함)
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

            <div class="row mb-2">
                <div class="col-12">
                    <div class="card border-primary">
                        <div class="card-header d-flex justify-content-between bg-primary text-white">
                            <span><i class="fas fa-cube me-2"></i>3D Perspective View</span>
                            <i class="fas fa-expand-alt"></i>
                        </div>
                        <div class="view-port" id="vp-3d" style="height: 500px; background: radial-gradient(circle, #2c3e50 0%, #000 100%);">
                            <span class="view-tag bg-warning text-dark">RENDERED</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Front View (정면도)</div>
                        <div class="view-port" id="vp-front"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Back View (배면도)</div>
                        <div class="view-port" id="vp-back"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Left View (좌측면도)</div>
                        <div class="view-port" id="vp-left"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Right View (우측면도)</div>
                        <div class="view-port" id="vp-right"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>

                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Top View (평면도)</div>
                        <div class="view-port" id="vp-top"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Bottom View (앙시도)</div>
                        <div class="view-port" id="vp-bottom"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // 3. 타겟 컨테이너 찾기 (메뉴가 날아가지 않도록 안전장치 강화)
    // HTML 파일에서 우측 본문 영역을 감싸는 div의 id를 우선적으로 찾습니다.
    let targetContainer = document.getElementById('content') || document.getElementById('renderContainer') || document.getElementById('main-content');
    
    // 만약 해당하는 컨테이너를 찾지 못했다면 경고를 띄웁니다.
    if (!targetContainer) {
        console.error("본문이 들어갈 컨테이너를 찾지 못했습니다. index.html의 오른쪽 영역 ID를 확인해주세요.");
        alert("화면 오류: 우측 본문 영역(content)을 찾을 수 없어 대시보드를 띄울 수 없습니다.");
        return; 
    }

    // 기존 내용(빈 화면 등)을 지우고 새로운 대시보드로 교체
    targetContainer.innerHTML = dashboardHTML;
    
    // 날짜 자동 업데이트
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        const today = new Date();
        dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
    }

    console.log("Dashboard with 7 viewports loaded successfully.");
}

// 대시보드 전용 CSS를 동적으로 문서 Head에 추가
function loadDashboardStyles() {
    if (document.getElementById('dashboard-styles')) return;

    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.innerHTML = `
        .card { border: none; border-radius: 12px; box-shadow: 0 4px 15px 0 rgba(0,0,0,.05); margin-bottom: 1.5rem; background: #fff; overflow: hidden; }
        .card-header { background: #fff; border-bottom: 1px solid #f0f0f0; padding: 1rem 1.2rem; font-weight: 600; font-size: 0.95rem; }
        .view-port { background: #151515; height: 320px; position: relative; overflow: hidden; }
        .view-tag { position: absolute; top: 10px; left: 10px; background: rgba(102, 110, 232, 0.8); color: white; padding: 3px 10px; border-radius: 15px; font-size: 0.65rem; font-weight: bold; z-index: 10; letter-spacing: 0.5px; }
        .stats-card { padding: 1.2rem; display: flex; align-items: center; border-radius: 12px; }
        .stats-icon { width: 45px; height: 45px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; margin-right: 12px; }
        .bg-light-primary { background: #eef0ff; }
        .bg-light-success { background: #e6fffa; }
        .bg-light-warning { background: #fff8e6; }
        .bg-light-danger { background: #fff5f5; }
    `;
    document.head.appendChild(style);
}
