require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');

// Initialize Supabase Client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if(!supabaseUrl || !supabaseKey){
  console.warn("⚠️ AVISO: Variáveis SUPABASE_URL ou SUPABASE_ANON_KEY não encontradas no .env");
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
  "Reposição Pav. Asfáltico (m²)": { sigla: "REPAS", un: "m²", nome: "Reposição Pav. Asfáltico" },
  "Reposição Pav. Granítico (m²)": { sigla: "REPGR", un: "m²", nome: "Reposição Pav. Granítico" }
};

async function parseAndSyncExcel(filePath) {
  if (!supabase) throw new Error("Supabase não configurado.");
  
  console.log("Iniciando leitura do Excel:", filePath);
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  
  let recordsToInsert = [];

  const worksheet = workbook.Sheets['Plan'];
  if(!worksheet){
      console.log("Aba 'Plan' não encontrada");
      return 0;
  }
  
  const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
  if (data.length < 2) return 0;
  
  // Datas reais estão na linha 1 (segunda linha)
  const headerDates = data[1]; 
  
  // Vamos mapear todos os índices de coluna que contém uma data válida
  const mappedDates = {}; // { colIndex: "2026-03-02" }
  for(let col = 6; col < headerDates.length; col++){
    let d = headerDates[col];
    if(d instanceof Date) {
      mappedDates[col] = d.toISOString().split('T')[0];
    } else if (typeof d === 'string' && d.match(/^\d{4}-\d{2}-\d{2}/)) {
      mappedDates[col] = d.split('T')[0]; // ex: 2026-03-02T03:00:00...
    }
  }

  // Agora varremos todas as linhas buscando as que são "PREVISTO"
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 6) continue;
    
    // Coluna 0 = Nome da Atividade, mas ela só vem preenchida na primeira vez. 
    // Pode vir vazia nas linhas de baixo se as células estiverem mescladas ou apenas vazias 
    // Mas na linha do PREVISTO nós temos o nome em column 0
    const atividadeStr = row[0] ? String(row[0]).trim() : "";
    const interdição = row[1] || 1;
    const planType = row[5] ? String(row[5]).trim() : "";
    
    if (planType !== "PREVISTO") continue;
    
    // Procura por string parecida no meta
    let meta = null;
    for(const key of Object.keys(atividadeMeta)) {
       if (atividadeStr.toLowerCase().includes(key.toLowerCase().substring(0, 10))) {
         meta = atividadeMeta[key];
         break;
       }
    }
    if (!meta) {
      console.log(`Atividade ignorada (não mapeada na constante): ${atividadeStr}`);
      continue;
    }
    
    // Lemos as quantidades
    for (const [colIdx, dataPrevista] of Object.entries(mappedDates)) {
      const valorPrevisto = row[colIdx];
      const valorNum = parseFloat(valorPrevisto);
      
      if (!isNaN(valorNum) && valorNum > 0) {
        recordsToInsert.push({
          trecho_id: parseInt(interdição) || 1,
          atividade_nome: meta.nome,
          atividade_sigla: `T${parseInt(interdição) || 1}_${meta.sigla}`,
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

module.exports = {
  supabase,
  parseAndSyncExcel
};
