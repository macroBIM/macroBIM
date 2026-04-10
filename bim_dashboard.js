/** v 005
 * =========================================================================
 * ⬛ Dashboard Module (bim_dashboard.js)
 * Description: 사용자 지정 MASTER BIM 사이드바 적용 + 7분할 뷰포트
 * =========================================================================
 */

console.log("bim_dashboard.js v005 loaded!");

function dashboard_click() {
    // 1. CSS 로드 (사이드바 및 메인 화면 스타일)
    loadDashboardStyles();

    // 2. 상단바 숨기기 (풀스크린 대시보드 레이아웃)
    const topNav = document.querySelector('nav.navbar.fixed-top');
    if(topNav) topNav.style.display = 'none';

    // 3. 레이아웃 여백 초기화
    const container = document.querySelector('.container-fluid');
    if(container) {
        container.classList.remove('pt-5');
        container.style.padding = '0';
        container.style.display = 'flex';
    }

    // 4. ⬛ 왼쪽 사이드바 렌더링 (요청하신 HTML 구조 100% 반영)
    const sidebar = document.querySelector('.sidebar');
    if(sidebar) {
        sidebar.className = ''; // 기존 부트스트랩 클래스 초기화
        sidebar.id = 'sidebar'; // CSS 스타일링을 위한 ID 부여
        
        // 제공해주신 HTML에 기존 클릭 이벤트(onclick)만 추가하여 기능 유지
        sidebar.innerHTML = `
            <div class="sidebar-header">
                <i class="fas fa-drafting-compass"></i> MASTER BIM
            </div>
            <div class="menu-label">Main Menu</div>
            <ul class="list-unstyled">
                <li><a href="#" onclick="setActiveMenu(this); dashboard_click();"><i class="fas fa-columns"></i> Dashboard</a></li>
                
                <div class="menu-label">Structural Design</div>
                <li><a href="#" onclick="setActiveMenu(this); steelsection_click();"><i class="fas fa-vector-square"></i> 단면 입력 (Sections)</a></li>
                <li class="active"><a href="#" onclick="setActiveMenu(this); dashboard_click();"><i class="fas fa-project-diagram"></i> 뼈대 구성 (Frame)</a></li>
                <li><a href="#" onclick="setActiveMenu(this); liftinglug_click();"><i class="fas fa-link"></i> 연결부 정의 (Nodes)</a></li>
                
                <div class="menu-label">Production</div>
                <li><a href="#" onclick="setActiveMenu(this); rebar_click();"><i class="fas fa-file-invoice"></i> 물량 리스트 (BOM)</a></li>
                <li><a href="#" onclick="setActiveMenu(this); boltsplice_click();"><i class="fas fa-print"></i> 도면 생성 (DWG)</a></li>
            </ul>
        `;
    }

    // 5. ⬛ 중앙 메인 컨텐츠 렌더링 (웰컴카드 + 4개 통계 + 7분할 뷰포트)
    const main = document.getElementById('wrap_main');
    if(main) {
        main.className = ''; 
        main.id = 'modern-main';

        const today = new Date();
        const dateStr = `${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;

        main.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold text-dark"><i class="fas fa-columns mr-2"></i> Frame Analysis Dashboard <span class="badge badge-primary ml-2" style="font-size:0.8rem;">v005</span></h4>
                <div class="text-muted"><i class="far fa-calendar-alt mr-1"></i> ${dateStr}</div>
            </div>

            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="modern-card stat-card p-4 d-flex align-items-center">
                        <div class="stat-icon bg-light-primary text-primary"><i class="fas fa-weight-hanging"></i></div>
                        <div>
                            <small class="text-muted fw-bold">총 강재 중량</small>
                            <h4 class="mb-0 fw-bold text-dark mt-1">14.52 ton</h4>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="modern-card stat-card p-4 d-flex align-items-center">
                        <div class="stat-icon bg-light-success text-success"><i class="fas fa-bolt"></i></div>
                        <div>
                            <small class="text-muted fw-bold">볼트 수량 (M20)</small>
                            <h4 class="mb-0 fw-bold text-dark mt-1">182 EA</h4>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="modern-card stat-card p-4 d-flex align-items-center">
                        <div class="stat-icon bg-light-warning text-warning"><i class="fas fa-nodes-column"></i></div>
                        <div>
                            <small class="text-muted fw-bold">총 노드 수</small>
                            <h4 class="mb-0 fw-bold text-dark mt-1">24 EA</h4>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="modern-card stat-card p-4 d-flex align-items-center">
                        <div class="stat-icon bg-light-danger text-danger"><i class="fas fa-won-sign"></i></div>
                        <div>
                            <small class="text-muted fw-bold">예상 단가</small>
                            <h4 class="mb-0 fw-bold text-dark mt-1">₩ 24,500K</h4>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row mb-4">
                <div class="col-12">
                    <div class="modern-card border-primary">
                        <div class="card-header border-bottom py-3 px-4 bg-primary text-white d-flex justify-content-between">
                            <h6 class="mb-0 fw-bold"><i class="fas fa-cube mr-2"></i> 3D Perspective Rendering</h6>
                            <i class="fas fa-expand-alt"></i>
                        </div>
                        <div class="view-port" id="vp-3d" style="height: 450px; background: radial-gradient(circle, #2a3342 0%, #0d1117 100%);">
                            <span class="badge badge-warning position-absolute mt-3 ml-3 p-2" style="font-size: 0.7rem; color: #000;">RENDERED SCENE</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="row">
                ${['Front View (정면도)', 'Back View (배면도)', 'Left View (좌측면도)', 'Right View (우측면도)', 'Top View (평면도)', 'Bottom View (앙시도)'].map((view, i) => `
                <div class="col-md-6 mb-4">
                    <div class="modern-card">
                        <div class="card-header border-bottom py-3 px-4 bg-white d-flex justify-content-between">
                            <h6 class="mb-0 fw-bold text-dark">${view}</h6>
                            <i class="fas fa-expand-alt text-muted"></i>
                        </div>
                        <div class="view-port" id="vp-2d-${i}" style="height: 280px; background-color: #1a1a1a;">
                            <span class="badge badge-info position-absolute mt-3 ml-3 p-2" style="font-size: 0.7rem; background-color: rgba(102, 110, 232, 0.8);">2D WIREFRAME</span>
                        </div>
                    </div>
                </div>
                `).join('')}
            </div>
        `;
    }
}

// 오리지널 스타일 (CSS) 주입
function loadDashboardStyles() {
    if (!document.getElementById('modernadmin-fonts')) {
        const linkFonts = document.createElement('link');
        linkFonts.id = 'modernadmin-fonts';
        linkFonts.rel = 'stylesheet';
        linkFonts.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700&family=Nunito:wght@400;600;700&display=swap';
        document.head.appendChild(linkFonts);
        
        const linkFA = document.createElement('link');
        linkFA.rel = 'stylesheet';
        linkFA.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
        document.head.appendChild(linkFA);
    }

    if (document.getElementById('dashboard-v005-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'dashboard-v005-styles';
    style.innerHTML = `
        body { background-color: #f4f5fa !important; font-family: 'Nunito', sans-serif !important; overflow-x: hidden; }
        
        /* ⬛ 제공해주신 사이드바 스타일 완벽 적용 */
        #sidebar { width: 260px; height: 100vh; background: #1e2b37; color: #fff; position: fixed; left: 0; top: 0; z-index: 9999; overflow-y: auto; box-shadow: 2px 0 10px rgba(0,0,0,0.1); }
        #sidebar .sidebar-header { padding: 25px; font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 1.4rem; letter-spacing: 1px; background: rgba(0,0,0,0.1); }
        #sidebar .menu-label { padding: 15px 25px 5px; font-size: 0.7rem; text-transform: uppercase; color: #6b7d8d; font-weight: bold; }
        #sidebar ul.list-unstyled { padding-left: 0; list-style: none; }
        #sidebar ul li a { padding: 12px 25px; display: block; color: #bacddc; text-decoration: none; transition: 0.3s; font-weight: 600; }
        #sidebar ul li a:hover, #sidebar ul li.active > a { color: #fff; background: rgba(255,255,255,0.05); border-left: 4px solid #666ee8; }
        #sidebar i { margin-right: 15px; width: 20px; text-align: center; font-size: 1.1rem; }

        /* ⬛ 메인 컨텐츠 영역 */
        #modern-main { margin-left: 260px; width: calc(100% - 260px); padding: 30px 40px; min-height: 100vh; }
        
        /* ⬛ 카드 & 뷰포트 디자인 */
        .modern-card { background: #fff; border-radius: 12px; box-shadow: 0 4px 20px 0 rgba(0,0,0,0.03); border: none; overflow: hidden; }
        .stat-icon { width: 55px; height: 55px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin-right: 18px; }
        .view-port { position: relative; width: 100%; overflow: hidden; border-radius: 0 0 12px 12px; }
        
        /* ⬛ 헬퍼 컬러 */
        .bg-light-primary { background: #eef0ff; } .text-primary { color: #666ee8 !important; }
        .bg-light-success { background: #e6fffa; } .text-success { color: #28d094 !important; }
        .bg-light-warning { background: #fff8e6; } .text-warning { color: #ff9149 !important; }
        .bg-light-danger { background: #fff5f5; } .text-danger { color: #ff4961 !important; }
        
        .fw-bold { font-weight: 700 !important; }
    `;
    document.head.appendChild(style);
}
