const { parseAndSyncExcel } = require('./supabase');
const path = require('path');
require('dotenv').config();

async function test() {
  console.log("Iniciando teste de sincronização...");
  try {
    const excelPath = path.join(__dirname, 'Planejamento Previsto.xlsx');
    console.log("Caminho do Excel:", excelPath);
    const result = await parseAndSyncExcel(excelPath);
    console.log("Resultado da sincronização:", result);
  } catch (err) {
    console.error("ERRO NA SINCRONIZAÇÃO:", err);
  }
}

test();
