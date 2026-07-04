/*
    excel_app.js — SB MACRO 엑셀 추출기 UI 로직 (GitHub 관리)
    · excel_reader.js 의 window.loadSheetData / window.extractBlockFromData 사용
    · HTML 의 요소 id: inputSheetName, uploadExcel, btnLoadSheet, loadStatus,
                      inputKeyword, btnExtract, result
    · DOM 준비 후 버튼 이벤트를 연결 (head 에서 로드해도 안전)
*/
(function () {
    var globalSheetData = null;   // 로딩된 시트 데이터 (두 핸들러가 공유)

    function ready(fn) {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
        else fn();
    }

    ready(function () {
        var loadBtn = document.getElementById('btnLoadSheet');
        var extractBtn = document.getElementById('btnExtract');

        // ── [엑셀시트 불러오기] : 시트명 칸의 값에 해당하는 시트를 읽음 ──
        if (loadBtn) loadBtn.addEventListener('click', async function () {
            var file = document.getElementById('uploadExcel').files[0];
            var sheetName = document.getElementById('inputSheetName').value.trim();
            var statusDiv = document.getElementById('loadStatus');

            if (typeof window.loadSheetData !== 'function') {
                alert('엑셀 리더(excel_reader.js) 로딩 실패 — 인터넷 연결/URL 을 확인하세요.'); return;
            }
            if (!file) { alert('먼저 .xlsx 파일을 선택해주세요.'); return; }
            if (!sheetName) { alert('시트명을 입력해주세요.'); return; }

            statusDiv.style.color = 'blue';
            statusDiv.innerText = "'" + sheetName + "' 시트를 메모리에 로딩하는 중...";
            globalSheetData = null;
            loadBtn.disabled = true;

            try {
                globalSheetData = await window.loadSheetData(file, sheetName);
                statusDiv.style.color = 'green';
                statusDiv.innerText = "성공! '" + sheetName + "' 시트 로딩 완료 (" + globalSheetData.length + "행). 이제 키워드를 추출하세요.";
            } catch (error) {
                statusDiv.style.color = 'red';
                statusDiv.innerText = '오류 발생: ' + error.message;
            } finally {
                loadBtn.disabled = false;
            }
        });

        // ── [키워드 블록 추출] ──
        if (extractBtn) extractBtn.addEventListener('click', function () {
            if (!globalSheetData) { alert('먼저 [엑셀시트 불러오기] 로 데이터를 로딩해주세요.'); return; }

            var keyword = document.getElementById('inputKeyword').value.trim();
            var resultDiv = document.getElementById('result');
            if (!keyword) { alert('검색 키워드를 입력해주세요.'); return; }

            var blockData = window.extractBlockFromData(globalSheetData, keyword);
            if (blockData === null) {
                resultDiv.innerHTML = "<p style='color:red; font-weight:bold;'>메모리에서 '" + keyword + "' 키워드를 찾지 못했습니다.</p>";
                return;
            }

            var html = '<h3>추출 결과 (' + keyword + ')</h3><table>';
            blockData.forEach(function (row, idx) {
                html += '<tr>';
                row.forEach(function (cell) { html += idx === 0 ? '<th>' + (cell || '') + '</th>' : '<td>' + (cell || '') + '</td>'; });
                html += '</tr>';
            });
            html += '</table>';
            resultDiv.innerHTML = html;
        });
    });
})();
