const xlsx = require('xlsx');

function analyzeEdits() {
    const filename = 'Planejamento Previsto Geral H-H.xlsx';
    console.log(`Analisando edits em: ${filename}`);
    const wb = xlsx.readFile(filename);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    // Ver as primeiras 20 linhas para entender a estrutura e se há dados preenchidos
    console.log('--- Resumo das primeiras 20 linhas ---');
    for (let i = 0; i < Math.min(20, data.length); i++) {
        console.log(`Linha ${i}:`, data[i].slice(0, 10)); // Primeiras 10 colunas
    }

    // Verificar se há valores preenchidos nas colunas de horários (colunas 6 em diante)
    let filledCount = 0;
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        for (let j = 6; j < row.length; j++) {
            if (row[j] !== null && row[j] !== undefined && row[j] !== '') {
                filledCount++;
            }
        }
    }
    console.log(`Total de células de horário preenchidas: ${filledCount}`);
}

analyzeEdits();
