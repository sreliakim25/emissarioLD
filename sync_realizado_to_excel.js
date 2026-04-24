require('dotenv').config();
const ExcelJS = require('exceljs');
const path = require('path');
const { supabase } = require('./supabase');

const atividadeMeta = {
  "Remoção de pavimento asfáltico (m²)": { sigla: "RPA", un: "m²", nome: "Rem. Pavimento Asfáltico" },
  "Remoção de pavimento granitico (m²)": { sigla: "RPG", un: "m²", nome: "Rem. Pavimento Granítico" },
  "Escavação (m³)": { sigla: "ESC", un: "m³", nome: "Escavação" },
  "Desmonte de Rocha (m³)": { sigla: "DRO", un: "m³", nome: "Desmonte de Rocha" },
  "Limpeza de Desmonte (m³)": { sigla: "LDE", un: "m³", nome: "Limpeza de Desmonte" },
  "Regularização de Vala (m)": { sigla: "RVA", un: "m", nome: "Regularização de Vala" },
  "Assentamento de Tubulação (m)": { sigla: "ATU", un: "m", nome: "Assentamento de Tubulação" },
  "Implantação de PV (und)": { sigla: "IPV", un: "und", nome: "Implantação de PV" },
  "Reaterro Compactado (m³)": { sigla: "REA", un: "m³", nome: "Reaterro Compactado" },
  "Reposição Pav. Asfáltico (m)": { sigla: "REPAS", un: "m", nome: "Reposição Pav. Asfáltico" },
  "Reposição Pav. Granítico (m²)": { sigla: "REPGR", un: "m²", nome: "Reposição Pav. Granítico" }
};

function formatExcelDate(dateVal) {
  if (dateVal instanceof Date) {
    return dateVal.toISOString().split('T')[0];
  }
  if (typeof dateVal === 'string' && dateVal.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateVal.split('T')[0];
  }
  if (typeof dateVal === 'number' && dateVal > 40000) {
    const rawDate = new Date((dateVal - 25569) * 86400 * 1000);
    return rawDate.toISOString().split('T')[0];
  }
  return null;
}

function getCellValue(cellValue) {
  if (cellValue && typeof cellValue === 'object' && cellValue.result !== undefined) {
    return Number(cellValue.result) || 0;
  }
  return Number(cellValue) || 0;
}

async function syncRealizado() {
  if (!supabase) {
    console.error("Supabase não configurado.");
    process.exit(1);
  }

  console.log("Iniciando a sincronização: Supabase -> Excel (Planejamento Previsto Geral.xlsx)...");

  // 1. Busca os dados no Supabase
  const { data: realizadas, error } = await supabase.from('producao_realizada').select('*');
  if (error) {
    console.error("> Erro ao buscar dados do Supabase:", error);
    process.exit(1);
  }

  const realMap = {};
  for (let r of realizadas) {
    const t = String(r.trecho_id);
    const s = r.atividade_sigla;
    const d = r.data_lancamento;
    const q = Number(r.quantidade);

    if (!realMap[t]) realMap[t] = {};
    if (!realMap[t][s]) realMap[t][s] = {};
    realMap[t][s][d] = q;
  }
  console.log(`> Carregados ${realizadas.length} registros de produção realizada do Banco.`);

  // 3. Abre a planilha base
  const filePath = path.join(__dirname, 'Planejamento Previsto Geral.xlsx');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let sheet = workbook.getWorksheet('Plan') || workbook.getWorksheet('Plan (Rev.3)');
  if (!sheet) {
    workbook.eachSheet((ws) => {
      const b2 = ws.getCell('B2').value || "";
      if (String(b2).trim().toUpperCase() === 'ATIVIDADE') sheet = ws;
    });
  }

  if (!sheet) {
    console.error("> Aba 'Plan' não encontrada (buscando 'ATIVIDADE' em B2).");
    process.exit(1);
  }
  
  console.log(`> Aba selecionada: ${sheet.name}`);

  // 4. Mapear as Datas de cada Coluna (Linha 3, começando na Coluna I=9)
  const rowDates = sheet.getRow(3);
  const dateColumns = {}; 
  
  rowDates.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber >= 9) {
      const formatDate = formatExcelDate(cell.value);
      if (formatDate) {
        dateColumns[colNumber] = formatDate;
      }
    }
  });

  if (Object.keys(dateColumns).length === 0) {
    console.warn("Aviso: Nenhuma data válida encontrada na linha 3 (colunas 9+).");
  } else {
    console.log(`> Detectadas ${Object.keys(dateColumns).length} colunas com datas.`);
  }

  // 5. Percorrer as Linhas
  let currentAtividadeStr = "";
  let currentInterdicao = 1;
  let cellsUpdated = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 4) return;

    // Atividade na Col B (2), Interdição na Col C (3)
    const valB = row.getCell(2).value;
    if (valB) currentAtividadeStr = String(valB).trim();
    
    const valC = row.getCell(3).value;
    if (valC) currentInterdicao = getCellValue(valC);

    // Tipo na Col G (7)
    const planTypeLabel = String(row.getCell(7).value || "").trim().toUpperCase();
    
    // Se for 'R' ou 'REALIZADO' ou se a linha de cima era P e essa é a linha de baixo com label de Realizado
    if (planTypeLabel !== "REALIZADO" && planTypeLabel !== "R") {
      return;
    }

    let meta = null;
    const strLower = currentAtividadeStr.toLowerCase();
    for (const key of Object.keys(atividadeMeta)) {
      if (strLower.includes(key.toLowerCase().substring(0, 10))) {
        if (strLower.includes('reposição') || strLower.includes('remoção')) {
          const isAsfaltico = strLower.includes('asfáltico') || strLower.includes('asfaltico');
          const isGranitico = strLower.includes('granitico') || strLower.includes('granítico');
          const keyAsfaltico = key.toLowerCase().includes('asfáltico') || key.toLowerCase().includes('asfaltico');
          const keyGranitico = key.toLowerCase().includes('granitico') || key.toLowerCase().includes('granítico');
          if ((isAsfaltico && keyAsfaltico) || (isGranitico && keyGranitico)) {
            meta = atividadeMeta[key];
            break;
          }
        } else {
          meta = atividadeMeta[key];
          break;
        }
      }
    }

    if (!meta) return;

    const tId = String(parseInt(currentInterdicao) || 1);
    const siglaDb = `T${tId}_${meta.sigla}`;

    const dbDataForSigla = (realMap[tId] || {})[siglaDb] || {};

    for (const [colStr, dateFormatted] of Object.entries(dateColumns)) {
      const cNum = parseInt(colStr);
      const cell = row.getCell(cNum);
      const cellValueExcel = getCellValue(cell.value);
      let cellValueDb = Number(dbDataForSigla[dateFormatted]) || 0;

      // Se ambos forem 0, ignora
      if (cellValueDb === 0 && cellValueExcel === 0) continue;

      // Se o valor no Excel for diferente do Banco (incluindo vazio)
      if (Math.abs(cellValueExcel - cellValueDb) > 0.001) {
        if (cellValueDb === 0) {
          cell.value = null; 
        } else {
          cell.value = cellValueDb; 
        }
        cellsUpdated++;
      }
    }
  });

  if (cellsUpdated === 0) {
    console.log("> Excel já está sincronizado com o Supabase.");
    process.exit(0);
  }

  console.log(`> Feitas ${cellsUpdated} atualizações no Excel. Salvando...`);
  await workbook.xlsx.writeFile(filePath);
  console.log("✅ Sincronização de 'Realizados' concluída com sucesso!");
}

syncRealizado().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});
