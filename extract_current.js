const xlsx = require('xlsx');

function extractCurrentStructure() {
    const filename = 'Planejamento Previsto Geral H-H.xlsx';
    console.log(`Extraindo estrutura de: ${filename}`);
    const wb = xlsx.readFile(filename);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

    const combinacoes = new Set();
    // Pular cabeçalho
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (row && row[2]) { // Atividade na coluna 2
            const atividade = row[2].toString().trim();
            const trecho = (row[1] || '-').toString().trim();
            if (atividade !== 'Sinalização de Interdições') {
                combinacoes.add(JSON.stringify({ atividade, trecho }));
            }
        }
    }

    console.log('--- COMBINAÇÕES ENCONTRADAS ---');
    console.log(JSON.stringify(Array.from(combinacoes).map(c => JSON.parse(c)), null, 2));
}

extractCurrentStructure();
