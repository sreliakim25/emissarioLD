const xlsx = require('xlsx');
const wb = xlsx.readFile('Planejamento Previsto Geral.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

for (let i = 0; i < 5; i++) {
    console.log(`--- Linha ${i} ---`);
    console.log(data[i].slice(0, 15)); // Ver os primeiros 15 itens de cada linha
}
