/** v 002
 * =========================================================================
 * ⬛ Dashboard Module (dashboard.js)
 * Description: Fits exactly into wrap_main and wrap_side of index.html
 * =========================================================================
 */

function dashboard_click() {
    // 1. CSS 동적 로드
    loadDashboardStyles();

    // 2. 우측 메인 컨텐츠 영역 (7-Viewport Grid) 렌더링
    const targetMain = document.getElementById('wrap_main');
    if (!targetMain) {
        console.error("본문이 들어갈 컨테이너(wrap_main)를 찾지 못했습니다.");
        return; 
    }

    const dashboardMainHTML = `
        <div style="padding: 10px 0; background-color: #f8f9fa; min-height: 100vh;">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="fw-bold text-dark">
                    <i class="fa fa-tachometer" aria-hidden="true"></i> Frame Analysis Dashboard
                    <span class="badge badge-secondary ml-2" style="font-size: 0.8rem;">v002</span>
                </h4>
                <div class="text-muted" id="current-date"><i class="fa fa-calendar" aria-hidden="true"></i> Loading Date...</div>
            </div>

            <div class="row mb-3">
                <div class="col-md-3">
                    <div class="card stats-card shadow-sm border-0">
                        <div class="card-body p-3 d-flex align-items-center">
                            <div class="stats-icon bg-primary text-white mr-3"><i class="fa fa-weight"></i></div>
                            <div><small class="text-muted d-block">예상 강재 중량</small><strong class="h5 mb-0" id="stat-weight">0.00 ton</strong></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card shadow-sm border-0">
                        <div class="card-body p-3 d-flex align-items-center">
                            <div class="stats-icon bg-success text-white mr-3"><i class="fa fa-cogs"></i></div>
                            <div><small class="text-muted d-block">연결 볼트 수</small><strong class="h5 mb-0" id="stat-bolts">0 EA</strong></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card shadow-sm border-0">
                        <div class="card-body p-3 d-flex align-items-center">
                            <div class="stats-icon bg-warning text-white mr-3"><i class="fa fa-share-alt"></i></div>
                            <div><small class="text-muted d-block">총 노드(Node) 수</small><strong class="h5 mb-0" id="stat-nodes">0 EA</strong></div>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card shadow-sm border-0">
                        <div class="card-body p-3 d-flex align-items-center">
                            <div class="stats-icon bg-danger text-white mr-3"><i class="fa fa-won"></i></div>
                            <div><small class="text-muted d-block">산출 상태</small><strong class="h5 mb-0 text-success">대기중</strong></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mb-3">
                <div class="col-12">
                    <div class="card border-primary shadow-sm">
                        <div class="card-header bg-primary text-white py-2 d-flex justify-content-between align-items-center">
                            <span class="font-weight-bold"><i class="fa fa-cube mr-2"></i>3D Perspective View</span>
                            <i class="fa fa-expand"></i>
                        </div>
                        <div class="view-port" id="vp-3d" style="height: 400px; background: radial-gradient(circle, #2c3e50 0%, #000 100%);">
                            <span class="view-tag badge badge-warning position-absolute mt-2 ml-2">RENDERED</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Front View (정면도)</div>
                        <div class="view-port bg-dark" id="vp-front" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Back View (배면도)</div>
                        <div class="view-port bg-dark" id="vp-back" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Left View (좌측면도)</div>
                        <div class="view-port bg-dark" id="vp-left" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Right View (우측면도)</div>
                        <div class="view-port bg-dark" id="vp-right" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Top View (평면도)</div>
                        <div class="view-port bg-dark" id="vp-top" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6 mb-3">
                    <div class="card shadow-sm border-0">
                        <div class="card-header bg-light py-2 font-weight-bold">Bottom View (앙시도)</div>
                        <div class="view-port bg-dark" id="vp-bottom" style="height: 250px;"><span class="view-tag badge badge-info position-absolute mt-2 ml-2">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    targetMain.innerHTML = dashboardMainHTML;

    // 3. 좌측 사이드바 영역 렌더링 (단면 입력 폼 등)
    const targetSide = document.getElementById('wrap_side');
    if (targetSide) {
        const sideHTML = `
            <h6 class="sidebar-heading d-flex justify-content-between align-items-center px-3 mt-4 mb-1 text-muted">
                <span>Frame Control</span>
            </h6>
            <div class="p-3">
                <div class="form-group">
                    <label for="materialSelect" class="font-weight-bold"><i class="fa fa-cubes mr-1"></i>Material</label>
                    <select class="form-control form-control-sm" id="materialSelect">
                        <option>SM355</option>
                        <option>SM490</option>
                        <option>SS275</option>
                    </select>
                </div>
                <hr>
                <button class="btn btn-primary btn-sm btn-block mt-3" onclick="alert('뷰 업데이트 예정')">
                    <i class="fa fa-refresh mr-1"></i> Update Views
                </button>
                <button class="btn btn-outline-success btn-sm btn-block mt-2">
                    <i class="fa fa-download mr-1"></i> Export Data
                </button>
            </div>
        `;
        targetSide.innerHTML = sideHTML;
    }

    // 날짜 업데이트
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        const today = new Date();
        dateEl.innerHTML = `<i class="fa fa-calendar" aria-hidden="true"></i> ${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
    }

    console.log("Dashboard v002 loaded exactly into wrap_main and wrap_side.");
}

function loadDashboardStyles() {
    if (document.getElementById('dashboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.innerHTML = `
        .stats-icon { width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .view-port { overflow: hidden; position: relative; border-radius: 0 0 4px 4px; }
    `;
    document.head.appendChild(style);
}
