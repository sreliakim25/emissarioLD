const ExcelJS = require('exceljs');

async function debug() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile('Planejamento Previsto Geral.xlsx');
  
  const sheet = workbook.getWorksheet('Plan (Rev.3)');
  if (!sheet) {
    console.log("Varias planilhas, nomes:");
    workbook.eachSheet((s) => console.log(s.name));
    return;
  }
  
  // Pegar das linhas 2 a 10 e colunas de A a M
  for (let r = 2; r <= 8; r++) {
    const row = sheet.getRow(r);
    let vals = [];
    for (let c = 1; c <= 15; c++) {
      let val = row.getCell(c).value;
      if (val && typeof val === 'object' && val.result !== undefined) {
        val = val.result; // se for formula
      }
      vals.push(val);
    }
    console.log(`L${r}:`, vals);
  }
}

debug();
