require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const ExcelJS = require('exceljs');
const path = require('path');
const dns = require('dns');

// Correção para erro getaddrinfo ENOTFOUND no Node.js (preferência por IPv4)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

// Initialize Supabase Client
const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseKey = (process.env.SUPABASE_ANON_KEY || '').trim();

if(!supabaseUrl || !supabaseKey){
  console.warn("⚠️ AVISO: Variáveis SUPABASE_URL ou SUPABASE_ANON_KEY não encontradas no .env");
} else {
  console.log("✅ Conexão Supabase configurada para:", supabaseUrl);
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Mapa para associar Nome da Aba do Excel à Sigla da Atividade e Unidade
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

async function parseAndSyncExcel(filePath) {
  if (!supabase) throw new Error("Supabase não configurado.");
  
  console.log("Iniciando leitura do Excel:", filePath);
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  
  let recordsToInsert = [];

  // Encontrar a planilha correta (a que possui "ATIVIDADE" em B2)
  let worksheetName = workbook.SheetNames.find(name => {
    const ws = workbook.Sheets[name];
    if (ws && ws['B2'] && String(ws['B2'].v).trim().toUpperCase() === 'ATIVIDADE') return true;
    return false;
  });

  if(!worksheetName){
      console.log("Planilha com formato esperado não encontrada.");
      return 0;
  }
  
  const worksheet = workbook.Sheets[worksheetName];
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  if (data.length < 3) return 0;
  
  // Datas reais estão na linha 3 (índice 2)
  const headerDates = data[2]; 
  
  // Vamos mapear todos os índices de coluna que contém uma data válida, começando na coluna I (índice 7)
  const mappedDates = {}; // { colIndex: "2026-03-02" }
  for(let col = 7; col < headerDates.length; col++){
    let d = headerDates[col];
    if(d instanceof Date) {
      mappedDates[col] = d.toISOString().split('T')[0];
    } else if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      mappedDates[col] = d.split('T')[0]; // ex: 2026-03-02T03:00:00...
    } else if (typeof d === 'number' && d > 40000) {
      // Excel serial date bug handle:
      const dateVal = new Date((d - 25569) * 86400 * 1000);
      mappedDates[col] = dateVal.toISOString().split('T')[0];
    }
  }

  // Agora varremos todas as linhas buscando as que são "PREVISTO" ou "P"
  let currentAtividadeStr = "";
  let currentInterdicao = 1;

  // A partir da linha 4 (índice 3)
  for (let i = 3; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) continue;
    
    // Atualiza nome da atividade e interdição caso não seja vazio (devido ao merge de células)
    // Com ref B1..., Col B=0, Col C=1, Col G=5
    if (row[0]) currentAtividadeStr = String(row[0]).trim();
    if (row[1]) currentInterdicao = row[1];

    // Coluna G (índice 5) define se é P ou R
    const planType = row[5] ? String(row[5]).trim().toUpperCase() : "";
    
    // Lidar caso esteja 'P' ou 'PREVISTO' na coluna G
    if (planType !== "PREVISTO" && planType !== "P" && planType !== "PLAN") continue;
    
    // Procura por string parecida no meta
    let meta = null;
    const strLower = currentAtividadeStr.toLowerCase();
    for(const key of Object.keys(atividadeMeta)) {
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
    if (!meta) {
      // console.log(`Atividade ignorada (não mapeada): ${currentAtividadeStr}`);
      continue;
    }
    
    // Lemos as quantidades
    for (const [colIdx, dataPrevista] of Object.entries(mappedDates)) {
      const valorPrevisto = row[colIdx];
      let valorNum = parseFloat(valorPrevisto);
      
      if (!isNaN(valorNum) && valorNum > 0) {
        recordsToInsert.push({
          trecho_id: parseInt(currentInterdicao) || 1,
          atividade_nome: meta.nome,
          atividade_sigla: `T${parseInt(currentInterdicao) || 1}_${meta.sigla}`,
          unidade: meta.un,
          data_prevista: dataPrevista,
          meta_diaria: valorNum
        });
      }
    }
  }

  console.log(`Encontrados ${recordsToInsert.length} registros previstos válidos no Excel.`);
  
  if (recordsToInsert.length > 0) {
    // Apaga previstos antigos para evitar duplicidade (ou UPSERT)
    console.log("Limpando base antiga de previstas...");
    await supabase.from('atividades_previstas').delete().neq('trecho_id', 0);

    console.log("Inserindo no Supabase em lotes...");
    const chunkSize = 500;
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase.from('atividades_previstas').insert(chunk);
      if (error) {
        console.error("Erro ao inserir lote:", error);
        throw error;
      }
    }
    console.log("Sincronização concluída com sucesso!");
  }

  return recordsToInsert.length;
}

async function syncRealizadoToExcel(filePath) {
  if (!supabase) throw new Error("Supabase não configurado.");
  
  console.log("Iniciando a sincronização reversa: Supabase -> Excel...");

  // 1. Busca os dados no Supabase
  const { data: realizadas, error } = await supabase.from('producao_realizada').select('*');
  if (error) {
    console.error("> Erro ao buscar dados do Supabase:", error);
    throw error;
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

  // 3. Abre a planilha com ExcelJS para preservar formatação
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  let sheet = workbook.getWorksheet('Plan') || workbook.getWorksheet('Plan (Rev.3)');
  if (!sheet) {
    workbook.eachSheet((ws) => {
      const b2 = ws.getCell('B2').value || "";
      if (String(b2).trim().toUpperCase() === 'ATIVIDADE') sheet = ws;
    });
  }

  if (!sheet) throw new Error("Aba 'Plan' não encontrada no arquivo Excel.");
  
  // 4. Mapear as Datas de cada Coluna (Linha 3, começando na Coluna I=9)
  const rowDates = sheet.getRow(3);
  const dateColumns = {}; 
  
  rowDates.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    if (colNumber >= 9) {
      // Pequeno helper para formatar data do ExcelJS
      let val = cell.value;
      let formatDate = null;
      if (val instanceof Date) formatDate = val.toISOString().split('T')[0];
      else if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) formatDate = val.split('T')[0];
      else if (typeof val === 'number' && val > 40000) {
        formatDate = new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
      }
      
      if (formatDate) dateColumns[colNumber] = formatDate;
    }
  });

  // 5. Percorrer as Linhas e atualizar
  let currentAtividadeStr = "";
  let currentInterdicao = 1;
  let cellsUpdated = 0;

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 4) return;
    const valB = row.getCell(2).value;
    if (valB) currentAtividadeStr = String(valB).trim();
    const valC = row.getCell(3).value;
    if (valC) currentInterdicao = Number(valC && typeof valC === 'object' ? valC.result : valC) || 0;

    const planTypeLabel = String(row.getCell(7).value || "").trim().toUpperCase();
    if (planTypeLabel !== "REALIZADO" && planTypeLabel !== "R") return;

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
      const cellValueExcel = Number(cell.value && typeof cell.value === 'object' ? cell.value.result : cell.value) || 0;
      let cellValueDb = Number(dbDataForSigla[dateFormatted]) || 0;

      if (cellValueDb === 0 && cellValueExcel === 0) continue;

      if (Math.abs(cellValueExcel - cellValueDb) > 0.001) {
        cell.value = cellValueDb === 0 ? null : cellValueDb; 
        cellsUpdated++;
      }
    }
  });

  if (cellsUpdated > 0) {
    await workbook.xlsx.writeFile(filePath);
    console.log(`✅ Sincronização concluída: ${cellsUpdated} células atualizadas.`);
  }

  return cellsUpdated;
}

async function parseAndSyncHHExcel(filePath) {
  if (!supabase) throw new Error("Supabase não configurado.");
  
  console.log("Iniciando leitura do Excel H-H:", filePath);
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length < 2) return 0;

  let recordsToInsert = [];

  // Pular cabeçalho (linha 1)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 5) continue;

    const [dataVal, trecho, atividade, recurso, tipo] = row;
    if (!dataVal || !atividade) continue;

    // Formatar data para YYYY-MM-DD
    let isoDate = dataVal;
    if (dataVal instanceof Date) {
      isoDate = dataVal.toISOString().split('T')[0];
    } else if (typeof dataVal === 'string' && dataVal.includes('/')) {
      const parts = dataVal.split('/');
      isoDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
    }

    const record = {
      data: isoDate,
      trecho_id: String(trecho),
      atividade: String(atividade),
      recurso: String(recurso),
      tipo: String(tipo),
      h06: Number(row[5]) || 0,
      h07: Number(row[6]) || 0,
      h08: Number(row[7]) || 0,
      h09: Number(row[8]) || 0,
      h10: Number(row[9]) || 0,
      h11: Number(row[10]) || 0,
      h12: Number(row[11]) || 0,
      h13: Number(row[12]) || 0,
      h14: Number(row[13]) || 0,
      h15: Number(row[14]) || 0,
      h16: Number(row[15]) || 0,
      h17: Number(row[16]) || 0,
      h18: Number(row[17]) || 0,
      h19: Number(row[18]) || 0,
      h20: Number(row[19]) || 0,
      h21: Number(row[20]) || 0
    };

    recordsToInsert.push(record);
  }

  console.log(`Encontrados ${recordsToInsert.length} registros H-H.`);
  
  if (recordsToInsert.length > 0) {
    const chunkSize = 200; // Chunk menor para H-H devido à largura das linhas
    for (let i = 0; i < recordsToInsert.length; i += chunkSize) {
      const chunk = recordsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('equipes_hh')
        .upsert(chunk, { onConflict: 'data, trecho_id, atividade, recurso, tipo' });
      
      if (error) {
        console.error("Erro ao sincronizar H-H:", error);
        throw error;
      }
    }
  }

  return recordsToInsert.length;
}

module.exports = {
  supabase,
  parseAndSyncExcel,
  syncRealizadoToExcel,
  parseAndSyncHHExcel
};
