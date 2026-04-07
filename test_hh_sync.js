const { parseAndSyncHHExcel } = require('./supabase');
const path = require('path');

async function testSync() {
    try {
        console.log("Iniciando teste de sincronização H-H...");
        const result = await parseAndSyncHHExcel(path.join(__dirname, 'Planejamento Previsto Geral H-H.xlsx'));
        console.log(`Sucesso: ${result} registros sincronizados.`);
    } catch (err) {
        console.error("Erro no teste de sincronização:", err.message);
        if (err.message.includes('relation "public.atividades_hh" does not exist')) {
            console.log("DICA: Você precisa criar a tabela 'atividades_hh' no Supabase usando o schema.sql.");
        }
    }
}

testSync();
