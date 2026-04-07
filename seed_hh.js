require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function seedHH() {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    const date = '2026-04-07';
    
    // Lista de atividades baseadas no projeto
    const activities = [
        { t: '1', a: 'Escavação Mecânica' },
        { t: '1', a: 'Assentamento de Tubos' },
        { t: '2', a: 'Reaterro Compactado' },
        { t: '3', a: 'Sinalização de Interdições' }
    ];

    const records = [];
    activities.forEach(act => {
        const row = {
            data: date,
            trecho_id: act.t,
            atividade: act.a,
            recurso: 'Pessoal',
            tipo: 'Planejado'
        };
        // Gera números aleatórios de pessoal por hora
        for(let h=6; h<=21; h++) {
            row[`h${h.toString().padStart(2, '0')}`] = Math.floor(Math.random() * 8) + 2;
        }
        records.push(row);
    });

    console.log(`Inserindo ${records.length} registros de exemplo para ${date}...`);
    const { error } = await supabase.from('equipes_hh').upsert(records);
    
    if (error) console.error("Erro ao inserir:", error.message);
    else console.log("✅ Dados de exemplo inseridos com sucesso!");
}

seedHH();
