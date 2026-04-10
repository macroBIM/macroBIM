/** v021
 * @file bim_dashboard.js
 * @description Frame 메뉴 클릭 시 '진짜' EasyAdmin 스타일의 사이드바와 대시보드를 렌더링하는 스크립트
 */

// ==========================================
// 다른 메뉴 이동 시 사이드바 찌꺼기 자동 초기화
// ==========================================
if (!window.sidebarCleanupRegistered) {
    document.addEventListener('click', function(event) {
        const clickedMenu = event.target.closest('.nav-link');
        
        if (clickedMenu && clickedMenu.id !== 'dashboard' && clickedMenu.closest('#navbarsExampleDefault')) {
            const sideDiv = document.getElementById('wrap_side');
            if (sideDiv) sideDiv.innerHTML = '';
        }
    });
    window.sidebarCleanupRegistered = true;
}

function dashboard_click() {
    let contentDiv = document.getElementById('wrap_main');
    let sideDiv = document.getElementById('wrap_side');
    
    if (!contentDiv) return;

    // ==========================================
    // 🚨 [핵심] 타 메뉴 방해 공작 원천 차단 및 복구
    // ==========================================
    let sideNav = sideDiv ? sideDiv.closest('nav') : document.querySelector('.sidebar') || document.querySelector('nav.bg-light');

    if (!sideNav) {
        const containerFluid = document.querySelector('.container-fluid.pt-5') || contentDiv.parentNode;
        sideNav = document.createElement('nav');
        containerFluid.insertBefore(sideNav, contentDiv);
    }

    if (sideNav) {
        sideNav.className = 'col-md-2 d-md-block sidebar'; 
        sideNav.style.setProperty('display', 'block', 'important');
        sideNav.style.setProperty('visibility', 'visible', 'important');
    }

    if (!sideDiv && sideNav) {
        let stickyDiv = sideNav.querySelector('.sidebar-sticky');
        if (!stickyDiv) {
            sideNav.innerHTML = '<div class="sidebar-sticky mt-3"></div>';
            stickyDiv = sideNav.querySelector('.sidebar-sticky');
        }
        stickyDiv.innerHTML = '<ul class="nav flex-column" id="wrap_side"></ul>';
        sideDiv = document.getElementById('wrap_side');
    }

    if (sideDiv) {
        sideDiv.className = 'nav flex-column';
        sideDiv.style.setProperty('display', 'block', 'important');
        sideDiv.style.setProperty('visibility', 'visible', 'important');
    }

    if (contentDiv) {
        contentDiv.className = 'col-md-9 ml-sm-auto col-lg-10 px-4 h-100';
    }

    // ==========================================
    // 0. 아이콘 강제 로드
    // ==========================================
    if (!document.getElementById('fa-v4-fixed')) {
        const fontAwesome = document.createElement('link');
        fontAwesome.id = 'fa-v4-fixed';
        fontAwesome.rel = 'stylesheet';
        fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css';
        document.head.appendChild(fontAwesome);
    }

    // ==========================================
    // 1. 메인 화면 & 찐 EasyAdmin 스타일 CSS 주입
    // ==========================================
    contentDiv.innerHTML = `
        <style>
            /* 메인 배경색 */
            #wrap_main { background-color: #f4f6f9 !important; min-height: 100vh; padding-top: 30px !important; padding-bottom: 40px !important; }
            
            /* 사이드바 화이트 테마 */
            .sidebar { display: block !important; position: fixed !important; top: 56px !important; bottom: 0 !important; left: 0 !important; width: 260px !important; max-width: 260px !important; flex: 0 0 260px !important; background-color: #ffffff !important; padding: 0 !important; z-index: 1000; overflow-y: auto; box-shadow: 0 0 15px rgba(0,0,0,0.05); border-right: 1px solid #e9ecef; }
            #wrap_main { margin-left: 260px !important; width: calc(100% - 260px) !important; max-width: calc(100% - 260px) !important; flex: 0 0 calc(100% - 260px) !important; }
            #wrap_side { padding-top: 0px; }

            #frame-dashboard-scope .card { border: 1px solid rgba(0,0,0,0.05); border-radius: 0.4rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02); margin-bottom: 1.5rem; background: #fff; }
            #frame-dashboard-scope .card-header { background: #fff; border-bottom: none; padding: 1.2rem 1.25rem 0.5rem; font-weight: 600; color: #212529; border-radius: 0.4rem 0.4rem 0 0; font-size: 1rem; }
            
            #frame-dashboard-scope .view-port { background-color: #f8f9fa; background-image: radial-gradient(#dee2e6 1px, transparent 1px); background-size: 20px 20px; height: 320px; border-radius: 0 0 0.4rem 0.4rem; position: relative; border-top: 1px solid #f1f3f5; }
            #frame-dashboard-scope .view-tag { position: absolute; top: 15px; left: 15px; background: rgba(0, 123, 255, 0.85); color: white; padding: 3px 10px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.5px; }
            
            #frame-dashboard-scope .stats-card { padding: 1.5rem; display: flex; flex-direction: row; align-items: center; justify-content: space-between; text-align: left; }
            #frame-dashboard-scope .stats-info { display: flex; flex-direction: column; }
            #frame-dashboard-scope .stats-card small { font-weight: 500; color: #6c757d; margin-bottom: 0.2rem; font-size: 0.85rem; }
            #frame-dashboard-scope .stats-card .h4 { font-size: 1.5rem; font-weight: 700; color: #212529; margin-bottom: 0; }
            #frame-dashboard-scope .stats-icon { width: 48px; height: 48px; border-radius: 0.4rem; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }

            #frame-dashboard-scope .bg-light-primary { background: #e0f3ff; color: #007bff; }
            #frame-dashboard-scope .bg-light-success { background: #d4f5e3; color: #28a745; }
            #frame-dashboard-scope .bg-light-warning { background: #fff0d4; color: #fd7e14; }
            #frame-dashboard-scope .bg-light-danger { background: #fde1e1; color: #dc3545; }

            /* 사이드바 스타일 */
            .frame-side-header { padding: 20px 25px; font-size: 1.2rem; font-weight: 700; color: #212529 !important; letter-spacing: 0px; list-style: none; text-align: left; display: flex; align-items: center; }
            .frame-side-header i { font-size: 1.5rem; color: #007bff; margin-right: 10px; }
            .frame-side-header span { font-size: 0.8rem; font-weight: 400; color: #6c757d; display: block; margin-top: -3px;}

            .frame-side-menu-label { padding: 15px 25px 5px 25px; font-size: 0.7rem; text-transform: uppercase; color: #adb5bd !important; font-weight: 600; list-style: none; letter-spacing: 0.5px; }
            .frame-side-item { list-style: none; margin: 2px 10px; }
            .frame-side-link { padding: 10px 15px; display: flex; align-items: center; color: #495057 !important; text-decoration: none !important; transition: 0.2s; border-radius: 0.4rem; font-size: 0.9rem; font-weight: 500; cursor: pointer; }
            
            .frame-side-link:hover { color: #007bff !important; background: #f8f9fa; }
            .frame-side-item.active .frame-side-link { color: #007bff !important; background: #e0f3ff; font-weight: 600; }
            
            .frame-side-link i { margin-right: 12px; width: 20px; text-align: center; font-size: 1.1rem; color: #adb5bd; transition: 0.2s; }
            .frame-side-link:hover i, .frame-side-item.active .frame-side-link i { color: #007bff; }

            /* 💡 서브메뉴 (Accordion) 전용 스타일 */
            .menu-collapse-toggle .toggle-arrow { transition: transform 0.3s ease; margin-left: auto; margin-right: 0 !important; font-size: 0.9rem; }
            .menu-collapse-toggle[aria-expanded="true"] .toggle-arrow { transform: rotate(180deg); }
            
            .frame-side-submenu { list-style: none; padding: 0; margin: 0; }
            .frame-sub-link { padding: 8px 15px 8px 45px; display: block; color: #6c757d !important; text-decoration: none !important; font-size: 0.85rem; position: relative; transition: 0.2s; border-radius: 0.4rem; margin: 2px 10px; }
            .frame-sub-link:hover { color: #007bff !important; background: #f8f9fa; }
            
            /* EasyAdmin 특유의 서브메뉴 도트(•) 아이콘 */
            .frame-sub-link::before { content: '•'; position: absolute; left: 25px; top: 50%; transform: translateY(-50%); font-size: 1.2rem; color: #dee2e6; transition: 0.2s; }
            .frame-sub-link:hover::before { color: #007bff; }
        </style>

        <div id="frame-dashboard-scope">
            <div class="mb-4">
                <h3 class="fw-bold mb-1" style="color: #212529; font-size: 1.75rem;">Frame Analysis Dashboard</h3>
                <p class="text-muted" style="font-size: 0.9rem;">Here's what's happening with your structure today.</p>
            </div>

            <div class="row mb-3">
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-info">
                            <small>Total Steel Weight</small>
                            <div class="h4">14.52 ton</div>
                        </div>
                        <div class="stats-icon bg-light-primary"><i class="fa fa-cubes"></i></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-info">
                            <small>Bolt Count (M20)</small>
                            <div class="h4">182 EA</div>
                        </div>
                        <div class="stats-icon bg-light-success"><i class="fa fa-wrench"></i></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-info">
                            <small>Total Nodes</small>
                            <div class="h4">24 EA</div>
                        </div>
                        <div class="stats-icon bg-light-warning"><i class="fa fa-share-alt"></i></div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-info">
                            <small>Estimated Cost</small>
                            <div class="h4">21.4M KRW</div>
                        </div>
                        <div class="stats-icon bg-light-danger"><i class="fa fa-krw"></i></div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>3D Perspective</span>
                            <span style="font-size: 0.75rem; color: #28a745; background: #d4f5e3; padding: 2px 8px; border-radius: 4px; font-weight: 600;">RENDERED</span>
                        </div>
                        <div class="view-port" style="background-image: none; background: #212529;"></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>Front View</span>
                            <i class="fa fa-expand text-muted" style="cursor: pointer;"></i>
                        </div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <span>Back View</span>
                            <i class="fa fa-expand text-muted" style="cursor: pointer;"></i>
                        </div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Top View</div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Bottom View</div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Left View</div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Right View</div>
                        <div class="view-port"><span class="view-tag" style="background: rgba(108, 117, 125, 0.8);">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 2. 사이드바 화면 HTML (EasyAdmin 서브메뉴 적용)
    // ==========================================
    if (sideDiv) {
        sideDiv.innerHTML = `
            <li class="frame-side-header">
                <i class="fa fa-cube"></i>
                <div>
                    MASTER BIM
                    <span>ADMIN PANEL</span>
                </div>
            </li>
            
            <hr style="margin: 0 15px 10px 15px; border-top: 1px solid #e9ecef;">
            
            <li class="frame-side-menu-label">Main Menu</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-th-large"></i> Dashboard</a></li>
            
            <li class="frame-side-menu-label">Structural Design</li>
            
            <li class="frame-side-item">
                <a href="#sectionsCollapse" data-bs-toggle="collapse" aria-expanded="false" class="frame-side-link menu-collapse-toggle">
                    <i class="fa fa-square-o"></i> 
                    <span style="flex-grow: 1;">Sections</span>
                    <i class="fa fa-angle-down toggle-arrow"></i>
                </a>
                <div class="collapse" id="sectionsCollapse">
                    <ul class="frame-side-submenu pb-2">
                        <li><a href="#" class="frame-sub-link" onclick="">H Section</a></li>
                        <li><a href="#" class="frame-sub-link" onclick="">I beam</a></li>
                        <li><a href="#" class="frame-sub-link" onclick="">C Channel</a></li>
                    </ul>
                </div>
            </li>

            <li class="frame-side-item active"><a href="#" class="frame-side-link"><i class="fa fa-sitemap"></i> Frame</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-link"></i> Nodes</a></li>
            
            <li class="frame-side-menu-label">Production</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-file-text-o"></i> BOM</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-print"></i> DWG</a></li>
        `;
    }
}
