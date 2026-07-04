/*
    excel_reader.js — ExcelJS 기반 엑셀 시트 리더 (GitHub 관리)
    · window.loadSheetData(file, sheetName)   : 지정 시트를 2D 배열로 로드 (대소문자 무관)
    · window.extractBlockFromData(data, kw)   : 2D 배열에서 키워드 블록만 추출
    HTML 에서 fetch → <script> 주입하여 사용 (전역 함수로 등록됨)
    필요 라이브러리: ExcelJS (exceljs.min.js) 가 먼저 로드되어 있어야 함
*/

// =========================================================
// [함수 1] 파일 + 시트명 → 전체 데이터를 2D 배열(0-index)로 반환
// =========================================================
window.loadSheetData = async function (file, sheetName) {
    if (typeof ExcelJS === 'undefined') {
        throw new Error('ExcelJS 라이브러리가 로드되지 않았습니다. (exceljs.min.js 확인)');
    }

    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(arrayBuffer);

    // 대소문자 구분 없이 시트 찾기
    let worksheet = null;
    const names = [];
    workbook.eachSheet((sheet) => {
        names.push(sheet.name);
        if (sheet.name.toLowerCase() === String(sheetName).toLowerCase()) {
            worksheet = sheet;
        }
    });

    if (!worksheet) {
        throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다. (존재하는 시트: ${names.join(', ')})`);
    }

    const fullData = [];
    const rowCount = worksheet.rowCount;
    const colCount = worksheet.columnCount;

    // 1행/1열부터 최대 행/열까지 전부 긁어 0-index 2D 배열로
    for (let r = 1; r <= rowCount; r++) {
        const row = worksheet.getRow(r);
        const rowData = [];
        for (let c = 1; c <= colCount; c++) {
            let val = row.getCell(c).value;

            // 수식/리치텍스트/날짜 등 객체 → 순수 텍스트/결과값 추출
            if (val !== null && typeof val === 'object') {
                if (val instanceof Date) {
                    val = val.toLocaleDateString();
                } else if (val.result !== undefined) {
                    val = val.result;
                } else if (val.richText !== undefined) {
                    val = val.richText.map(rt => rt.text).join('');
                } else if (val.text !== undefined) {
                    val = val.text;
                } else if (val.hyperlink !== undefined) {
                    val = val.text || val.hyperlink;
                } else {
                    val = '';
                }
            }
            rowData.push(val);
        }
        fullData.push(rowData);
    }

    return fullData;
};

// =========================================================
// [함수 2] 2D 배열에서 특정 키워드 블록만 추출
//   · 키워드 셀을 좌상단으로, 우측(빈칸 전까지)·하단(빈행 전까지) 블록을 잘라냄
// =========================================================
window.extractBlockFromData = function (fullData, keyword) {
    let startRowIdx = -1, startColIdx = -1;

    // 1) 키워드 위치 탐색
    for (let r = 0; r < fullData.length; r++) {
        for (let c = 0; c < fullData[r].length; c++) {
            if (fullData[r][c] === keyword) { startRowIdx = r; startColIdx = c; break; }
        }
        if (startRowIdx !== -1) break;
    }
    if (startRowIdx === -1) return null;

    // 2) 가로 끝(빈칸 전까지)
    let endColIdx = startColIdx;
    while (endColIdx < fullData[startRowIdx].length) {
        const v = fullData[startRowIdx][endColIdx];
        if (v === null || v === undefined || v === '') break;
        endColIdx++;
    }
    const colCount = endColIdx - startColIdx;

    // 3) 세로 탐색(빈행 전까지)
    const extractedData = [];
    let cur = startRowIdx;
    while (cur < fullData.length) {
        const rowData = [];
        let empty = true;
        for (let i = 0; i < colCount; i++) {
            const v = fullData[cur][startColIdx + i];
            rowData.push(v);
            if (v !== null && v !== undefined && v !== '') empty = false;
        }
        if (empty) break;
        extractedData.push(rowData);
        cur++;
    }

    return extractedData;
};
