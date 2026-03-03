const ExcelJS = require('exceljs');
const EXCEL_PATH = 'C:/Users/Ygor/Desktop/Projetos/Relatório Operacional/RELATÓRIO OPERACIONAL.xlsx';

async function check() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  for (const sheetName of ['BASE DE DADOS', 'LUCAS']) {
    const ws = wb.getWorksheet(sheetName);
    let badRows = 0;
    ws.eachRow((row, n) => {
      if (n === 1) return;
      const prod = row.getCell(1).value;
      const date = row.getCell(3).value;
      if (prod && (!date || !(date instanceof Date))) {
        badRows++;
        if (badRows <= 3) {
          console.log(`[${sheetName}] Row ${n} | prod: "${prod}" | date: ${JSON.stringify(date)} (${typeof date})`);
        }
      }
    });
    if (badRows) console.log(`[${sheetName}] Total bad-date rows with product: ${badRows}`);
    else console.log(`[${sheetName}] All date rows OK`);
  }
}
check().catch(console.error);
