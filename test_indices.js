const xlsx = require('xlsx');
const path = require('path');

async function testIndices() {
  const filePath = path.join(__dirname, 'Planejamento Previsto.xlsx');
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const data = xlsx.utils.sheet_to_json(workbook.Sheets['Plan'], { header: 1 });
  
  const headerDates = data[1];
  console.log("Header Dates (Linha 1, Colunas 6-10):", headerDates.slice(6, 11));
  
  const row3 = data[2]; // Linha 3 (index 2)
  console.log("Linha de Dados (Index 2, Colunas 0-8):", row3.slice(0, 9));
  console.log("Tipo Plano (Id 6) na Linha 3:", row3[6]);
  
  const row4 = data[3]; // Linha 4 (index 3)
  console.log("Tipo Plano (Id 6) na Linha 4:", row4[6]);
}

testIndices();
