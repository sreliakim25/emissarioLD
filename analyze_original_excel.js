const xlsx = require('xlsx');

function dumpExcel() {
    const workbook = xlsx.readFile('Planejamento Previsto Geral.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Header logic:
    // Row 0: Titles
    // Row 1: Subheaders (Dates)
    const headers = data[0];
    const dates = data[1];

    console.log('--- ESTRUTURA DO EXCEL ORIGINAL ---');
    console.log('Datas encontradas (primeiras 10 colunas úteis):');
    for (let i = 6; i < 16; i++) {
        console.log(`Coluna ${i}: ${dates[i]}`);
    }

    console.log('\nExemplo de Atividades:');
    for (let i = 2; i < 6; i++) {
        const row = data[i];
        if (row && row[0]) {
            console.log(`Atividade: ${row[0]}, Trecho: ${row[1]}, Tipo: ${row[5]}`);
        }
    }
}

dumpExcel();
