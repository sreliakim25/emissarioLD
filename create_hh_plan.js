const ExcelJS = require('exceljs');
const xlsx = require('xlsx');

const SOURCE_FILE = 'Planejamento Previsto Geral H-H.xlsx';
const NEW_FILE = 'Planejamento Previsto Geral H-H.xlsx'; // Sobrescrevendo com os novos dados

async function updateHHPlan() {
    console.log(`Analisando estrutura atual de: ${SOURCE_FILE}...`);
    const wb = xlsx.readFile(SOURCE_FILE);
    const sheetOrig = wb.Sheets[wb.SheetNames[0]];
    const dataOrig = xlsx.utils.sheet_to_json(sheetOrig, { header: 1 });

    // 1. Extrair combinações únicas de Atividade e Trecho (ignorando a sinalização diária para não duplicar)
    const combinacoes = new Set();
    for (let i = 1; i < dataOrig.length; i++) {
        const row = dataOrig[i];
        if (row && row[2] && row[2] !== 'Sinalização de Interdições') {
            const atividade = row[2].toString().trim();
            const trecho = (row[1] || '-').toString().trim();
            combinacoes.add(JSON.stringify({ atividade, trecho }));
        }
    }

    const uniqueCombinations = Array.from(combinacoes).map(c => JSON.parse(c));
    console.log(`Encontradas ${uniqueCombinations.length} atividades base para o cronograma.`);

    // 2. Configuração do novo workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Planejamento_H_H', {
        properties: { tabColor: { argb: 'FF8B1A1A' } }
    });

    sheet.columns = [
        { header: 'DATA', key: 'data', width: 14 },
        { header: 'TRECHO', key: 'trecho', width: 10 },
        { header: 'ATIVIDADE', key: 'atividade', width: 45 },
        { header: 'RECURSO', key: 'recurso', width: 15 },
        { header: 'TIPO', key: 'tipo', width: 15 },
        ...Array.from({ length: 16 }, (_, i) => {
            const h = (i + 6).toString().padStart(2, '0') + ':00';
            return { header: h, key: `h${i+6}`, width: 8 };
        })
    ];

    // Estilo Cabeçalho
    const headRow = sheet.getRow(1);
    headRow.height = 35;
    headRow.eachCell((cell) => {
        cell.font = { name: 'Playfair Display', bold: true, color: { argb: 'FFF0EAD8' }, size: 12 };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1A1A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = { bottom: { style: 'thick', color: { argb: 'FFE8A020' } } };
    });

    // 3. Gerar Calendário: 30 dias a partir de 07/04/2026 (Hoje na timeline do usuário)
    const startDate = new Date(2026, 3, 7); // Abril é mês 3
    const daysToGenerate = 30;

    console.log(`Gerando novo cronograma de 30 dias a partir de 07/04/2026...`);

    let totalRows = 0;
    for (let d = 0; d < daysToGenerate; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + d);
        const dateStr = currentDate.toLocaleDateString('pt-BR');

        // Adicionar Sinalização de Interdições
        const signalingBase = { data: dateStr, trecho: '-', atividade: 'Sinalização de Interdições', recurso: 'Pessoal' };
        sheet.addRow({ ...signalingBase, tipo: 'Planejado' });
        sheet.addRow({ ...signalingBase, tipo: 'Realizado' });
        totalRows += 2;

        // Adicionar Atividades do usuário
        uniqueCombinations.forEach(comb => {
            const baseRow = { data: dateStr, trecho: comb.trecho, atividade: comb.atividade, recurso: 'Pessoal' };
            
            // Dados fictícios para Planejado (2 a 12 pessoas)
            const pData = { ...baseRow, tipo: 'Planejado' };
            const rData = { ...baseRow, tipo: 'Realizado' };
            
            for(let h=6; h<=21; h++) {
              pData[`h${h}`] = Math.floor(Math.random() * 8) + 2; 
              // rData deixa vazio para o usuário preencher
            }

            sheet.addRow(pData);
            sheet.addRow(rData);
            totalRows += 2;
        });
    }

    // Estilização
    sheet.eachRow((row, rowNum) => {
        if (rowNum === 1) return;
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFDF9F0' } };
        row.eachCell((cell, colNum) => {
            cell.font = { name: 'Crimson Pro', size: 11 };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFE8A020' } } };
            if (colNum >= 6) cell.alignment = { horizontal: 'center' };
        });
    });

    sheet.views = [{ state: 'frozen', ySplit: 1, xSplit: 5 }];

    await workbook.xlsx.writeFile(NEW_FILE);
    console.log(`Concluído: ${totalRows} linhas geradas começando em 07/04/2026.`);
}

updateHHPlan().catch(console.error);
