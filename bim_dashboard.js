/** v017
 * @file bim_dashboard.js
 * @description Frame 메뉴 클릭 시 사이드바와 대시보드 메인 화면을 동적으로 렌더링하는 스크립트
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
    // 🚨 [핵심] Steel Section 등 타 메뉴의 방해 공작 원천 차단 및 복구
    // ==========================================
    // 1. 사이드바 컨테이너 찾기
    let sideNav = sideDiv ? sideDiv.closest('nav') : document.querySelector('.sidebar') || document.querySelector('nav.bg-light');

    // 2. 다른 메뉴가 컨테이너를 아예 날려버렸다면 강제 재건축
    if (!sideNav) {
        const containerFluid = document.querySelector('.container-fluid.pt-5') || contentDiv.parentNode;
        sideNav = document.createElement('nav');
        containerFluid.insertBefore(sideNav, contentDiv);
    }

    // 3. 다른 메뉴가 뜯어버린 클래스명 완벽 복구 & 강제 숨김 무력화
    if (sideNav) {
        sideNav.className = 'col-md-2 d-md-block bg-light sidebar';
        sideNav.style.setProperty('display', 'block', 'important');
        sideNav.style.setProperty('visibility', 'visible', 'important');
    }

    // 4. 내부 wrap_side가 파괴되었다면 재생성
    if (!sideDiv && sideNav) {
        let stickyDiv = sideNav.querySelector('.sidebar-sticky');
        if (!stickyDiv) {
            sideNav.innerHTML = '<div class="sidebar-sticky mt-3"></div>';
            stickyDiv = sideNav.querySelector('.sidebar-sticky');
        }
        stickyDiv.innerHTML = '<ul class="nav flex-column" id="wrap_side"></ul>';
        sideDiv = document.getElementById('wrap_side');
    }

    // 5. wrap_side 클래스 & 표시 상태 강제 복구
    if (sideDiv) {
        sideDiv.className = 'nav flex-column';
        sideDiv.style.setProperty('display', 'block', 'important');
        sideDiv.style.setProperty('visibility', 'visible', 'important');
    }

    // 6. 메인 콘텐츠 폭도 원래대로 강제 복구
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
    // 1. 메인 화면 & 통합 CSS 주입
    // ==========================================
    contentDiv.innerHTML = `
        <style>
            /* 레이아웃 강제 변경 (Frame 메뉴 전용) */
            .sidebar { display: block !important; position: fixed !important; top: 56px !important; bottom: 0 !important; left: 0 !important; width: 260px !important; max-width: 260px !important; flex: 0 0 260px !important; background-color: #1e2b37 !important; padding: 0 !important; z-index: 1000; overflow-y: auto; }
            #wrap_main { margin-left: 260px !important; width: calc(100% - 260px) !important; max-width: calc(100% - 260px) !important; flex: 0 0 calc(100% - 260px) !important; padding-top: 20px; }
            #wrap_side { padding-top: 0px; }

            /* 대시보드 메인 카드 디자인 */
            #frame-dashboard-scope .card { border: none; border-radius: 15px; box-shadow: 0 4px 20px 0 rgba(0,0,0,.05); margin-bottom: 1.8rem; background: #fff; }
            
            /* 💡 수정 포인트: 헤더 폰트 굵기를 600에서 400으로 조절하고, 패딩을 1.2rem에서 0.6rem으로 절반으로 줄여 얇게 변경 */
            #frame-dashboard-scope .card-header { background: transparent; border-bottom: 1px solid #f0f0f0; padding: 0.6rem; font-weight: 400; }
            
            #frame-dashboard-scope .view-port { background: #1a1a1a; height: 380px; border-radius: 0 0 15px 15px; position: relative; }
            #frame-dashboard-scope .view-tag { position: absolute; top: 15px; left: 15px; background: rgba(102, 110, 232, 0.8); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; }
            #frame-dashboard-scope .stats-card { padding: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
            #frame-dashboard-scope .stats-icon { width: 60px; height: 60px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 12px; }
            #frame-dashboard-scope .bg-light-primary { background: #eef0ff; color: #666ee8 !important; }
            #frame-dashboard-scope .bg-light-success { background: #e6fffa; color: #38c172 !important; }
            #frame-dashboard-scope .bg-light-warning { background: #fff8e6; color: #f6993f !important; }
            #frame-dashboard-scope .bg-light-danger { background: #fff5f5; color: #e3342f !important; }

            /* 사이드바 전용 스타일 */
            .frame-side-header { padding: 25px 25px 10px; font-size: 1.3rem; font-weight: 700; color: #fff !important; letter-spacing: 1px; list-style: none; }
            .frame-side-menu-label { padding: 15px 25px 5px 25px; font-size: 0.75rem; text-transform: uppercase; color: #6b7d8d !important; font-weight: bold; list-style: none; }
            .frame-side-item { list-style: none; }
            .frame-side-link { padding: 12px 25px; display: flex; align-items: center; color: #bacddc !important; text-decoration: none !important; transition: 0.3s; border-left: 4px solid transparent; }
            .frame-side-link:hover, .frame-side-item.active .frame-side-link { color: #fff !important; background: rgba(255,255,255,0.05); border-left: 4px solid #666ee8 !important; }
            .frame-side-link i { margin-right: 15px; width: 20px; text-align: center; }
        </style>

        <div id="frame-dashboard-scope">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold">Frame Analysis Dashboard</h4>
                <div class="text-muted"><i class="fa fa-calendar"></i> 2026. 04. 10</div>
            </div>

            <div class="row mb-2">
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-primary"><i class="fa fa-shopping-bag"></i></div>
                        <small class="text-muted mb-1">Steel Weight</small>
                        <div class="h5 mb-0 fw-bold">14.52 ton</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-success"><i class="fa fa-bolt"></i></div>
                        <small class="text-muted mb-1">Bolt Count (M20)</small>
                        <div class="h5 mb-0 fw-bold">182 EA</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-warning"><i class="fa fa-share-alt"></i></div>
                        <small class="text-muted mb-1">Total Nodes</small>
                        <div class="h5 mb-0 fw-bold">24 EA</div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card stats-card">
                        <div class="stats-icon bg-light-danger"><i class="fa fa-krw"></i></div>
                        <small class="text-muted mb-1">Estimated Cost</small>
                        <div class="h5 mb-0 fw-bold">21.4M KRW</div>
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
                        <div class="card-header d-flex justify-content-between"><span>Front View</span><i class="fa fa-arrows-alt text-muted"></i></div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Back View</span><i class="fa fa-arrows-alt text-muted"></i></div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Top View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Bottom View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Left View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Right View</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 2. 사이드바 화면 HTML (영문화)
    // ==========================================
    if (sideDiv) {
        sideDiv.innerHTML = `
            <li class="frame-side-header">
                <i class="fa fa-compass"></i> MASTER BIM
            </li>
            
            <li class="frame-side-menu-label">Main Menu</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-columns"></i> Dashboard</a></li>
            
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
