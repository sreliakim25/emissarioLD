const xlsx = require('xlsx');
const wb = xlsx.readFile('Planejamento Previsto Geral.xlsx');
const data = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });

const headerDates = data[1];
console.log('Tipo do primeiro valor de data (Col 6):', typeof headerDates[6]);
console.log('Valor:', headerDates[6]);

for (let i = 2; i < 5; i++) {
    const row = data[i];
    console.log(`Linha ${i}, Col 5 (Tipo):`, row[5]);
    console.log(`Linha ${i}, Col 6 (Valor):`, row[6], 'Tipo:', typeof row[6]);
}
