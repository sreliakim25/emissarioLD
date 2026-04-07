const xlsx = require('xlsx');
const wb = xlsx.readFile('Planejamento Previsto Geral.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

console.log('--- CABEÇALHO ---');
console.log(data[0]); // Header names
console.log(data[1]); // Dates

console.log('--- LINHAS ---');
for (let i = 2; i < Math.min(10, data.length); i++) {
    console.log(`Linha ${i}:`, data[i]);
}
