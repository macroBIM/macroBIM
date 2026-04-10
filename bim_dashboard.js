/** v013
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
    const contentDiv = document.getElementById('wrap_main');
    const sideDiv = document.getElementById('wrap_side');
    
    if (!contentDiv) return;

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
    // (사이드바 스타일도 여기에 넣어서 HTML 규칙 위반을 방지하고 다른 메뉴 간섭을 막음)
    // ==========================================
    contentDiv.innerHTML = `
        <style>
            /* 레이아웃 강제 변경 (Frame 메뉴 전용) */
            .sidebar { position: fixed !important; top: 56px !important; bottom: 0 !important; left: 0 !important; width: 260px !important; max-width: 260px !important; flex: 0 0 260px !important; background-color: #1e2b37 !important; padding: 0 !important; z-index: 1000; overflow-y: auto; }
            #wrap_main { margin-left: 260px !important; width: calc(100% - 260px) !important; max-width: calc(100% - 260px) !important; flex: 0 0 calc(100% - 260px) !important; padding-top: 20px; }
            #wrap_side { padding-top: 0px; }

            /* 대시보드 메인 카드 디자인 */
            #frame-dashboard-scope .card { border: none; border-radius: 15px; box-shadow: 0 4px 20px 0 rgba(0,0,0,.05); margin-bottom: 1.8rem; background: #fff; }
            #frame-dashboard-scope .card-header { background: transparent; border-bottom: 1px solid #f0f0f0; padding: 1.2rem; font-weight: 600; }
            #frame-dashboard-scope .view-port { background: #1a1a1a; height: 380px; border-radius: 0 0 15px 15px; position: relative; }
            #frame-dashboard-scope .view-tag { position: absolute; top: 15px; left: 15px; background: rgba(102, 110, 232, 0.8); color: white; padding: 4px 12px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; }
            #frame-dashboard-scope .stats-card { padding: 1.5rem; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
            #frame-dashboard-scope .stats-icon { width: 60px; height: 60px; border-radius: 15px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin-bottom: 12px; }
            #frame-dashboard-scope .bg-light-primary { background: #eef0ff; color: #666ee8 !important; }
            #frame-dashboard-scope .bg-light-success { background: #e6fffa; color: #38c172 !important; }
            #frame-dashboard-scope .bg-light-warning { background: #fff8e6; color: #f6993f !important; }
            #frame-dashboard-scope .bg-light-danger { background: #fff5f5; color: #e3342f !important; }

            /* 사이드바 전용 스타일 (오염 방지를 위해 고유 클래스명 부여) */
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
                        <div class="card-header d-flex justify-content-between"><span>Back View (배면)</span><i class="fa fa-arrows-alt text-muted"></i></div>
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
                        <div class="card-header">Bottom View (저면)</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Left View (좌측면)</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header">Right View (우측면)</div>
                        <div class="view-port"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // ==========================================
    // 2. 사이드바 화면 HTML
    // (HTML 규칙 준수: ul 내부에는 오직 li 태그만 배치!)
    // ==========================================
    if (sideDiv) {
        sideDiv.innerHTML = `
            <li class="frame-side-header">
                <i class="fa fa-compass"></i> MASTER BIM
            </li>
            
            <li class="frame-side-menu-label">Main Menu</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-columns"></i> Dashboard</a></li>
            
            <li class="frame-side-menu-label">Structural Design</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-square-o"></i> 단면 입력 (Sections)</a></li>
            <li class="frame-side-item active"><a href="#" class="frame-side-link"><i class="fa fa-sitemap"></i> 뼈대 구성 (Frame)</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-link"></i> 연결부 정의 (Nodes)</a></li>
            
            <li class="frame-side-menu-label">Production</li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-file-text-o"></i> 물량 리스트 (BOM)</a></li>
            <li class="frame-side-item"><a href="#" class="frame-side-link"><i class="fa fa-print"></i> 도면 생성 (DWG)</a></li>
        `;
    }
}
