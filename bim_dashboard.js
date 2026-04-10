/** v019
 * @file bim_dashboard.js
 * @description Frame 메뉴 클릭 시 올 화이트 EasyAdmin 스타일 대시보드를 렌더링하는 스크립트
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
        sideNav.className = 'col-md-2 d-md-block bg-light sidebar';
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
    // 1. 메인 화면 & 올 화이트 CSS 주입
    // ==========================================
    contentDiv.innerHTML = `
        <style>
            /* 메인 배경색 (아주 옅은 회색으로 흰색 카드들이 돋보이게 함) */
            #wrap_main { background-color: #f4f6f9 !important; min-height: 100vh; }
            
            /* 사이드바 화이트 테마 변경 */
            .sidebar { display: block !important; position: fixed !important; top: 56px !important; bottom: 0 !important; left: 0 !important; width: 260px !important; max-width: 260px !important; flex: 0 0 260px !important; background-color: #ffffff !important; padding: 0 !important; z-index: 1000; overflow-y: auto; box-shadow: 2px 0 10px rgba(0,0,0,0.05); border-right: 1px solid #edf1f5; }
            #wrap_main { margin-left: 260px !important; width: calc(100% - 260px) !important; max-width: calc(100% - 260px) !important; flex: 0 0 calc(100% - 260px) !important; padding-top: 25px; padding-bottom: 40px; }
            #wrap_side { padding-top: 0px; }

            /* 카드 디자인 */
            #frame-dashboard-scope .card { 
                border: none; 
                border-radius: 0.5rem; 
                box-shadow: 0 2px 12px rgba(0,0,0,0.04); 
                margin-bottom: 2rem; 
                background: #fff; 
                transition: all 0.3s ease;
            }
            #frame-dashboard-scope .card:hover { box-shadow: 0 4px 15px rgba(0,0,0,0.08); } 
            
            /* 카드 플랫 헤더 */
            #frame-dashboard-scope .card-header { 
                background: #fff; 
                border-bottom: 1px solid #edf1f5; 
                padding: 1rem 1.25rem; 
                font-weight: 600; 
                color: #495057;
                border-radius: 0.5rem 0.5rem 0 0;
                font-size: 0.95rem;
            }
            
            /* 💡 뷰포트 화이트 & 모던 도트 그리드 테마 */
            #frame-dashboard-scope .view-port { 
                background-color: #fcfcfc; 
                background-image: radial-gradient(#d1d5db 1px, transparent 1px);
                background-size: 20px 20px;
                height: 360px; 
                border-radius: 0 0 0.5rem 0.5rem; 
                position: relative; 
            }
            #frame-dashboard-scope .view-tag { position: absolute; top: 15px; left: 15px; background: rgba(52, 144, 220, 0.9); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.65rem; font-weight: bold; letter-spacing: 0.5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            
            /* 통계 카드 */
            #frame-dashboard-scope .stats-card { padding: 1.8rem 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
            #frame-dashboard-scope .stats-icon { width: 65px; height: 65px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 15px; }
            #frame-dashboard-scope .stats-card small { font-weight: 600; letter-spacing: 0.5px; margin-bottom: 5px; font-size: 0.8rem; }
            #frame-dashboard-scope .stats-card .h5 { font-size: 1.4rem; color: #333; }

            /* 색상 팔레트 */
            #frame-dashboard-scope .bg-light-primary { background: #e3f2fd; color: #3490dc !important; }
            #frame-dashboard-scope .bg-light-success { background: #e2f4ec; color: #38c172 !important; }
            #frame-dashboard-scope .bg-light-warning { background: #fef1e2; color: #f6993f !important; }
            #frame-dashboard-scope .bg-light-danger { background: #fbeae9; color: #e3342f !important; }

            /* 💡 사이드바 화이트 테마 폰트 컬러 조정 */
            .frame-side-header { padding: 25px 25px 15px; font-size: 1.4rem; font-weight: 800; color: #343a40 !important; letter-spacing: 1px; list-style: none; text-align: center; border-bottom: 1px solid #edf1f5; margin-bottom: 10px; }
            .frame-side-menu-label { padding: 20px 25px 10px 25px; font-size: 0.7rem; text-transform: uppercase; color: #adb5bd !important; font-weight: 700; list-style: none; letter-spacing: 1px; }
            .frame-side-item { list-style: none; }
            .frame-side-link { padding: 12px 25px; display: flex; align-items: center; color: #495057 !important; text-decoration: none !important; transition: 0.3s; border-left: 3px solid transparent; font-size: 0.95rem; font-weight: 500; }
            .frame-side-link:hover, .frame-side-item.active .frame-side-link { color: #3490dc !important; background: #f8f9fa; border-left: 3px solid #3490dc !important; }
            .frame-side-link i { margin-right: 15px; width: 20px; text-align: center; font-size: 1.1rem; color: #a1aab2; transition: 0.3s; }
            .frame-side-link:hover i, .frame-side-item.active .frame-side-link i { color: #3490dc; }
        </style>

        <div id="frame-dashboard-scope">
            <div class="d-flex justify-content-between align-items-center mb-4 pb-2">
                <h4 class="fw-bold m-0" style="color: #333;">Frame Analysis Dashboard</h4>
                <div class="text-muted bg-white px-3 py-2 rounded shadow-sm border" style="font-size: 0.9rem; border-color: #edf1f5 !important;"><i class="fa fa-calendar mr-2"></i> 2026. 04. 10</div>
            </div>

            <div class="row mb-3">
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-primary"><i class="fa fa-shopping-bag"></i></div>
                        <small class="text-muted">STEEL WEIGHT</small>
                        <div class="h5 mb-0 fw-bold">14.52 ton</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-success"><i class="fa fa-bolt"></i></div>
                        <small class="text-muted">BOLT COUNT (M20)</small>
                        <div class="h5 mb-0 fw-bold">182 EA</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-warning"><i class="fa fa-share-alt"></i></div>
                        <small class="text-muted">TOTAL NODES</small>
                        <div class="h5 mb-0 fw-bold">24 EA</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-danger"><i class="fa fa-krw"></i></div>
                        <small class="text-muted">ESTIMATED COST</small>
                        <div class="h5 mb-0 fw-bold">21.4M KRW</div>
                    </div>
                </div>
            </div>

            <div class="row">
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #3490dc;">
                        <div class="card-header d-flex justify-content-between"><span>3D Perspective</span><i class="fa fa-cube text-primary"></i></div>
                        <div class="view-port" style="background: radial-gradient(circle, #ffffff 0%, #e2e8f0 100%); background-image: none;"><span class="view-tag bg-warning text-dark">RENDERED</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header d-flex justify-content-between"><span>Front View</span><i class="fa fa-arrows-alt text-muted"></i></div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header d-flex justify-content-between"><span>Back View</span><i class="fa fa-arrows-alt text-muted"></i></div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header">Top View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header">Bottom View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header">Left View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card" style="border-top: 3px solid #6c757d;">
                        <div class="card-header">Right View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 2. 사이드바 화면 HTML (EasyAdmin 화이트 테마)
    // ==========================================
    if (sideDiv) {
        sideDiv.innerHTML = `
            <li class="frame-side-header">
                <i class="fa fa-compass text-primary mr-2"></i> MASTER BIM
            </li>
            
            <li class="frame-side-menu-label">Main Menu</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-tachometer"></i> Dashboard</a></li>
            
            <li class="frame-side-menu-label">Structural Design</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-square-o"></i> Sections</a></li>
            <li class="frame-side-item active"><a href="#" class="frame-side-link"><i class="fa fa-sitemap"></i> Frame</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-link"></i> Nodes</a></li>
            
            <li class="frame-side-menu-label">Production</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-file-text-o"></i> BOM</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-print"></i> DWG</a></li>
        `;
    }
}
