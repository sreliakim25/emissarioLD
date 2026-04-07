require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function checkSupabase() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    console.log(`URL: ${supabaseUrl}`);
    console.log(`Key (primeiros caracteres): ${supabaseKey.substring(0, 10)}...`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    console.log("\n--- TESTE 1: Tentando ler a tabela 'atividades_hh' ---");
    const { data, error } = await supabase.from('atividades_hh').select('id').limit(1);
    
    if (error) {
        console.error("ERRO na leitura:", error.message);
        if (error.message.includes('schema cache')) {
            console.log("\n⚠️ O POSTGREST NÃO RECONHECE A TABELA.");
            console.log("Dica: Vá no Dashboard do Supabase -> Settings -> API -> e procure por 'PostgREST Config'.");
            console.log("Tente encontrar uma opção de 'Reload Schema' ou verifique se o 'Schema' padrão é 'public'.");
        }
    } else {
        console.log("✅ SUCESSO: Tabela encontrada e acessível!");
        console.log("Dados:", data);
    }

    console.log("\n--- TESTE 2: Tentando listar todas as tabelas (via RPC se disponível) ---");
    // Tentativa simples de ver se outra tabela funciona
    const { data: data2, error: error2 } = await supabase.from('atividades_previstas').select('id').limit(1);
    if (error2) {
        console.error("Erro ao ler 'atividades_previstas':", error2.message);
    } else {
        console.log("✅ Tabela 'atividades_previstas' está funcionando ok.");
    }
}

checkSupabase();
