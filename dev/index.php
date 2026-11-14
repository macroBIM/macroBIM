<?php
/**
 * /dev/ — macroBIM 개발 미리보기
 *
 * design 서브모듈의 dev 브랜치 파일을 불러온다.
 * 운영(index_box1cell.php)과 분리된 진입점.
 */

// ── 방문 수 (DB가 있으면 읽고, 없으면 0) ──
$visits = 0;
$totalVisits = 0;

$cfgPath = dirname($_SERVER['DOCUMENT_ROOT']) . '/config/db_config.php';
if (!is_file($cfgPath)) { $cfgPath = __DIR__ . '/../../config/db_config.php'; }
if (is_file($cfgPath)) {
    $db = require $cfgPath;
    $conn = @new mysqli($db['host'], $db['user'], $db['pass'], $db['name']);
    if (!$conn->connect_error) {
        $conn->set_charset("utf8");
        $today = date('Y-m-d');
        $r = $conn->query("SELECT visit_count FROM visit_log WHERE visit_date='$today'");
        if ($r && $row = $r->fetch_assoc()) { $visits = $row['visit_count']; }
        $r2 = $conn->query("SELECT SUM(visit_count) AS t FROM visit_log");
        if ($r2 && $row2 = $r2->fetch_assoc()) { $totalVisits = $row2['t']; }
        $conn->close();
    }
}
?>
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>macroBIM — Dev</title>

<!-- 공용 아이콘 -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">

<!-- design 서브모듈의 dev 스타일 -->
<link rel="stylesheet" href="../design/layout_style.css">

<!-- Pretendard (한국어) + Inter -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
</head>
<body>
<div id="app-root"></div>

<!-- design 서브모듈의 dev 레이아웃 -->
<script src="../design/layout_body_test.js"></script>
<script>
initLayout({
    visits: <?php echo json_encode($visits); ?>,
    totalVisits: <?php echo json_encode($totalVisits); ?>
});
</script>

<!-- 공용 모듈 -->
<script src="../design/mod_qna.js"></script>
</body>
</html>
