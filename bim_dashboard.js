/** v007
 * @file bim_dashboard.js
 * @description Frame 메뉴 클릭 시 사이드바와 대시보드 메인 화면을 동적으로 렌더링하는 스크립트
 */

function dashboard_click() {
    const contentDiv = document.getElementById('wrap_main');
    const sideDiv = document.getElementById('wrap_side');
    
    if (!contentDiv) return;

    // ==========================================
    // 1. 대시보드 메인 화면 (HTML + CSS)
    // ==========================================
    const dashboardStyles = `
        <style>
            .card {
                border: none;
                border-radius: 15px;
                box-shadow: 0 4px 20px 0 rgba(0,0,0,.05);
                margin-bottom: 1.8rem;
                background: #fff;
            }
            .card-header {
                background: transparent;
                border-bottom: 1px solid #f0f0f0;
                padding: 1.2rem;
                font-weight: 600;
            }
            .view-port {
                background: #1a1a1a;
                height: 380px;
                border-radius: 0 0 15px 15px;
                position: relative;
            }
            .view-tag {
                position: absolute;
                top: 15px;
                left: 15px;
                background: rgba(102, 110, 232, 0.8);
                color: white;
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 0.7rem;
                font-weight: bold;
            }
            .stats-card {
                padding: 1.5rem;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                text-align: center;
            }
            .stats-icon {
                width: 60px;
                height: 60px;
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.8rem;
                margin-bottom: 12px;
            }
            .bg-light-primary { background: #eef0ff; color: #666ee8 !important; }
            .bg-light-success { background: #e6fffa; color: #38c172 !important; }
            .bg-light-warning { background: #fff8e6; color: #f6993f !important; }
            .bg-light-danger { background: #fff5f5; color: #e3342f !important; }
        </style>
    `;

    const dashboardHTML = `
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h4 class="fw-bold">Frame Analysis Dashboard</h4>
            <div class="text-muted"><i class="fa fa-calendar"></i> 2026. 04. 10</div>
        </div>

        <div class="row mb-2">
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-primary"><i class="fa fa-shopping-bag"></i></div>
                    <small class="text-muted mb-1">강재 중량</small>
                    <div class="h5 mb-0 fw-bold">14.52 ton</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-success"><i class="fa fa-bolt"></i></div>
                    <small class="text-muted mb-1">볼트 수 (M20)</small>
                    <div class="h5 mb-0 fw-bold">182 EA</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-warning"><i class="fa fa-share-alt"></i></div>
                    <small class="text-muted mb-1">총 노드 수</small>
                    <div class="h5 mb-0 fw-bold">24 EA</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card stats-card">
                    <div class="stats-icon bg-light-danger"><i class="fa fa-krw"></i></div>
                    <small class="text-muted mb-1">예상 견적</small>
                    <div class="h5 mb-0 fw-bold">2,140 만원</div>
                </div>
            </div>
        </div>

        <div class="row">
            <div class="col-md-6">
                <div class="card border-primary">
                    <div class="card-header d-flex justify-content-between bg-primary text-white"><span>3D Perspective</span><i class="fa fa-cube"></i></div>
                    <div class="view-port" style="background: radial-gradient(circle, #2c3e50 0%, #000 100%);"><span class="view-tag bg-warning text-dark">RENDERED</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between"><span>Front View (정면)</span><i class="fa fa-arrows-alt text-muted"></i></div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between"><span>Front View (정면)</span><i class="fa fa-arrows-alt text-muted"></i></div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header d-flex justify-content-between"><span>Back View (정면)</span><i class="fa fa-arrows-alt text-muted"></i></div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
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
                    <div class="card-header">Bottom View (평면)</div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">Left View (측면)</div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">Right View (측면)</div>
                    <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                </div>
            </div>
        </div>
    `;

    contentDiv.innerHTML = dashboardStyles + dashboardHTML;

    // ==========================================
    // 2. 사이드바 화면 (FontAwesome 4.7 호환 클래스)
    // ==========================================
    if (sideDiv) {
        const sideStyles = `
            <style>
                .sidebar {
                    position: fixed !important;
                    top: 56px !important; 
                    bottom: 0 !important;
                    left: 0 !important;
                    width: 260px !important;
                    background-color: #1e2b37 !important;
                    padding: 0 !important;
                    z-index: 1000;
                    overflow-y: auto;
                }
                
                #wrap_main {
                    margin-left: 260px !important;
                    width: calc(100% - 260px) !important;
                    max-width: 100% !important;
                    padding-top: 20px;
                }

                #wrap_side {
                    padding-top: 0px;
                }

                .side-header {
                    padding: 25px 25px 10px;
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #fff;
                    letter-spacing: 1px;
                }

                .side-menu-label {
                    padding: 15px 25px 5px 25px;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    color: #6b7d8d;
                    font-weight: bold;
                }
                .side-item { list-style: none; }
                .side-link {
                    padding: 12px 25px;
                    display: flex;
                    align-items: center;
                    color: #bacddc;
                    text-decoration: none;
                    transition: 0.3s;
                    border-left: 4px solid transparent;
                }
                .side-link:hover, .side-item.active .side-link {
                    color: #fff;
                    background: rgba(255,255,255,0.05);
                    border-left: 4px solid #666ee8;
                }
                .side-link i { margin-right: 15px; width: 20px; text-align: center; }
            </style>
        `;

        const sideHTML = `
            <div class="side-header">
                <i class="fa fa-compass"></i> MASTER BIM
            </div>
            
            <li class="side-menu-label">Main Menu</li>
            <li class="side-item"><a href="#" class="side-link"><i class="fa fa-columns"></i> Dashboard</a></li>
            
            <li class="side-menu-label">Structural Design</li>
            <li class="side-item"><a href="#" class="side-link"><i class="fa fa-square-o"></i> 단면 입력 (Sections)</a></li>
            <li class="side-item active"><a href="#" class="side-link"><i class="fa fa-sitemap"></i> 뼈대 구성 (Frame)</a></li>
            <li class="side-item"><a href="#" class="side-link"><i class="fa fa-link"></i> 연결부 정의 (Nodes)</a></li>
            
            <li class="side-menu-label">Production</li>
            <li class="side-item"><a href="#" class="side-link"><i class="fa fa-file-text-o"></i> 물량 리스트 (BOM)</a></li>
            <li class="side-item"><a href="#" class="side-link"><i class="fa fa-print"></i> 도면 생성 (DWG)</a></li>
        `;

        sideDiv.innerHTML = sideStyles + sideHTML;
    }
}
