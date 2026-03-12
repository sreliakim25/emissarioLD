const express = require('express');
const path = require('path');
const cors = require('cors');
const { supabase, parseAndSyncExcel } = require('./supabase');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Servir o arquivo estático
app.use(express.static(__dirname));

// Endpoint para ler e processar a planilha
app.post('/api/sync-excel', async (req, res) => {
  try {
    const recordsParsed = await parseAndSyncExcel(path.join(__dirname, 'Planejamento Previsto.xlsx'));
    res.json({ message: "Sincronização concluída", registros_afetados: recordsParsed });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/dashboard', async (req, res) => {
  if(!supabase) return res.status(500).json({error: "Supabase não configurado no .env"});
  
  try {
    // 1. Puxar Realizadas
    const { data: realizadas, error: errR } = await supabase.from('producao_realizada').select('*');
    if (errR) throw errR;
    
    let state = {};
    for (let r of realizadas) {
      if (!state[r.data_lancamento]) state[r.data_lancamento] = {};
      state[r.data_lancamento][r.atividade_sigla] = r.quantidade;
    }

    // 2. Puxar Previstas (PLANO Base)
    const { data: previstas, error: errP } = await supabase.from('atividades_previstas').select('*').order('data_prevista', { ascending: true });
    if (errP) throw errP;

    // Constrói um array agrupado por TRECHO semelhante ao TRECHOS estático do Front-End
    let trechosMap = {};
    for(let p of previstas) {
      if(!trechosMap[p.trecho_id]) {
         trechosMap[p.trecho_id] = {
           id: p.trecho_id,
           nome: `Trecho ${p.trecho_id}`,
           cor: p.trecho_id===1 ? '#8B1A1A' : p.trecho_id===2 ? '#6d1414' : '#5e1010',
           inicio: p.data_prevista, // Vai atualizar para pegar o menor e maior depois
           fim: p.data_prevista,
           atividadesMap: {}
         };
      }
      
      const t = trechosMap[p.trecho_id];
      if(p.data_prevista < t.inicio) t.inicio = p.data_prevista;
      if(p.data_prevista > t.fim) t.fim = p.data_prevista;

      if(!t.atividadesMap[p.atividade_sigla]) {
        t.atividadesMap[p.atividade_sigla] = {
          id: p.atividade_sigla,
          nome: p.atividade_nome,
          un: p.unidade,
          total: 0,
          ini: p.data_prevista,
          fim: p.data_prevista,
          plano: {}   // { "2026-03-04": 100, "2026-03-05": 100, ... }
        };
      }
      
      const at = t.atividadesMap[p.atividade_sigla];
      at.total += Number(p.meta_diaria);
      at.plano[p.data_prevista] = Number(p.meta_diaria);  // Valor exato por dia
      if(p.data_prevista < at.ini) at.ini = p.data_prevista;
      if(p.data_prevista > at.fim) at.fim = p.data_prevista;
    }

    // Array de Trechos montado dinamicamente
    const trechos = Object.values(trechosMap).map(t => {
       return {
         ...t,
         atividades: Object.values(t.atividadesMap)
       };
    });
    
    res.json({ success: true, actuals: state, trechos: trechos });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint para Lançamento Diário
app.post('/api/lancamento', async (req, res) => {
  if(!supabase) return res.status(500).json({error: "Supabase não configurado"});
  const { trecho_id, data_lancamento, atividades } = req.body;
  // atividades ex: { "T1_RPA": 100, "T1_ESC": 20 }
  
  if(!trecho_id || !data_lancamento || !atividades) {
    return res.status(400).json({error: "Faltam parâmetros"});
  }

  try {
    const upsertRows = Object.keys(atividades).map(sigla => ({
      trecho_id,
      atividade_sigla: sigla,
      data_lancamento,
      quantidade: atividades[sigla]
    }));

    // Upsert para garantir update no mesmo dia
    const { error } = await supabase
      .from('producao_realizada')
      .upsert(upsertRows, { onConflict: 'trecho_id, atividade_sigla, data_lancamento' });
      
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'emissario_controle.html'));
});

app.listen(port, () => {
  console.log(`========================================`);
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`API Endpoints habilitados`);
  console.log(`========================================`);
});
