const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

async function exportToCSV() {
  const filePath = path.join(__dirname, 'Planejamento Previsto Geral.xlsx');
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets['Plan'];
  const csv = xlsx.utils.sheet_to_csv(sheet);
  fs.writeFileSync('excel_dump.csv', csv);
  console.log("Dump do Excel criado em excel_dump.csv");
}

exportToCSV();
