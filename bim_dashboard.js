/** v 004
 * =========================================================================
 * ⬛ Dashboard Module (bim_dashboard.js)
 * Description: ModernAdmin 오리지널 디자인 100% 적용 + 7-Viewport Grid
 * =========================================================================
 */

console.log("bim_dashboard.js v004 loaded!"); 

function dashboard_click() {
    // 1. 요청하신 오리지널 ModernAdmin 스타일 및 폰트/아이콘 로드
    loadDashboardStyles();

    const targetMain = document.getElementById('wrap_main');
    if (!targetMain) {
        console.error("오류: wrap_main 컨테이너를 찾을 수 없습니다.");
        return; 
    }

    // 2. 우측 메인 컨텐츠 영역 렌더링 (원본 디자인 코드 100% 반영 + 7분할 레이아웃)
    const dashboardMainHTML = `
        <div style="padding: 30px; background-color: var(--content-bg); min-height: 100vh; overflow-y: auto; font-family: 'Quicksand', sans-serif;">
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h4 class="fw-bold" style="color: #404e67;">Frame Analysis Dashboard <span class="badge bg-secondary fs-6 align-middle ms-2" style="font-size:0.8rem;">v004</span></h4>
                <div class="text-muted" id="current-date"><i class="far fa-calendar-alt"></i> Loading Date...</div>
            </div>

            <div class="row mb-4">
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

            <div class="row mb-2">
                <div class="col-12">
                    <div class="card border-primary">
                        <div class="card-header d-flex justify-content-between bg-primary text-white" style="border-radius: 15px 15px 0 0;">
                            <span>3D Perspective</span><i class="fas fa-cube"></i>
                        </div>
                        <div class="view-port" id="vp-3d" style="height: 450px; background: radial-gradient(circle, #2c3e50 0%, #000 100%); border-radius: 0 0 15px 15px;">
                            <span class="view-tag bg-warning text-dark">RENDERED</span>
                        </div>
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
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Back View (배면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-back"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Left View (좌측면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-left"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Right View (우측면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-right"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Top View (평면)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-top"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between"><span>Bottom View (앙시도)</span><i class="fas fa-expand-alt text-muted"></i></div>
                        <div class="view-port" id="vp-bottom"><span class="view-tag">2D WIREFRAME</span></div>
                    </div>
                </div>
            </div>
        </div>
    `;
    targetMain.innerHTML = dashboardMainHTML;

    // 3. 좌측 사이드바 렌더링 (디자인 통일성 유지)
    const targetSide = document.getElementById('wrap_side');
    if (targetSide) {
        const sideHTML = `
            <li class="nav-item px-3 mt-4" style="font-family: 'Quicksand', sans-serif;">
                <h6 class="sidebar-heading d-flex justify-content-between align-items-center mb-3 text-muted" style="font-family: 'Montserrat', sans-serif; font-weight: 700; font-size: 0.8rem; text-transform: uppercase;">
                    <span>Frame Control</span>
                </h6>
                <div class="form-group mb-3">
                    <label for="materialSelect" style="font-size: 0.85rem; font-weight: 600;"><i class="fas fa-cubes mr-1"></i> Material</label>
                    <select class="form-control form-control-sm" id="materialSelect" style="border-radius: 8px;">
                        <option>SM355</option>
                        <option>SM490</option>
                        <option>SS275</option>
                    </select>
                </div>
                <hr>
                <button class="btn btn-primary btn-sm btn-block mt-3" onclick="alert('도면 렌더링 준비 완료!')" style="background-color: var(--primary-color); border: none; border-radius: 8px; font-weight: 600; padding: 10px;">
                    <i class="fas fa-sync-alt mr-1"></i> Update Views
                </button>
            </li>
        `;
        targetSide.innerHTML = sideHTML;
    }

    // 날짜 세팅
    const dateEl = document.getElementById('current-date');
    if(dateEl) {
        const today = new Date();
        dateEl.innerHTML = `<i class="far fa-calendar-alt"></i> ${today.getFullYear()}. ${String(today.getMonth()+1).padStart(2, '0')}. ${String(today.getDate()).padStart(2, '0')}`;
    }
}

function loadDashboardStyles() {
    // 1. 예쁜 아이콘과 폰트를 불러옵니다 (기존 index.html에 없거나 버전이 낮을 수 있으므로 강제 추가)
    if (!document.getElementById('modernadmin-fonts')) {
        const linkFonts = document.createElement('link');
        linkFonts.id = 'modernadmin-fonts';
        linkFonts.rel = 'stylesheet';
        linkFonts.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600&family=Quicksand:wght@500;700&display=swap';
        document.head.appendChild(linkFonts);
        
        const linkFA = document.createElement('link');
        linkFA.rel = 'stylesheet';
        linkFA.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(linkFA);
    }

    if (document.getElementById('dashboard-styles')) return;
    
    // 2. 올려주신 오리지널 CSS 그대로 적용 (!important를 써서 기존 투박한 스타일을 완전히 덮어씁니다)
    const style = document.createElement('style');
    style.id = 'dashboard-styles';
    style.innerHTML = `
        :root {
            --content-bg: #f4f5fa;
            --primary-color: #666ee8;
            --card-shadow: 0 4px 20px 0 rgba(0,0,0,.05);
        }
        
        .card {
            border: none !important;
            border-radius: 15px !important;
            box-shadow: var(--card-shadow) !important;
            margin-bottom: 1.8rem !important;
            background: #fff !important;
        }
        .card-header {
            background: transparent !important;
            border-bottom: 1px solid #f0f0f0 !important;
            padding: 1.2rem !important;
            font-weight: 600 !important;
        }
        .view-port {
            background: #1a1a1a !important; /* 도면 느낌의 어두운 배경 */
            height: 380px !important;
            border-radius: 0 0 15px 15px !important;
            position: relative !important;
        }
        .view-tag {
            position: absolute !important;
            top: 15px !important;
            left: 15px !important;
            background: rgba(102, 110, 232, 0.8) !important;
            color: white !important;
            padding: 4px 12px !important;
            border-radius: 20px !important;
            font-size: 0.7rem !important;
            font-weight: bold !important;
        }
        .stats-card {
            padding: 1.5rem !important;
            display: flex !important;
            align-items: center !important;
            flex-direction: row !important;
        }
        .stats-icon {
            width: 50px !important;
            height: 50px !important;
            border-radius: 12px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 1.5rem !important;
            margin-right: 15px !important;
        }
    `;
    document.head.appendChild(style);
}
