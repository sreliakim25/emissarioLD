const xlsx = require('xlsx');
const wb = xlsx.readFile('Planejamento Previsto Geral.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const trechos = new Set();
const atividades = new Set();

for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (row[0]) atividades.add(row[0]);
    if (row[1]) trechos.add(row[1]);
}

console.log('Trechos únicos:', Array.from(trechos));
console.log('Atividades únicas:', Array.from(atividades));
