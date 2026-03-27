require('dotenv').config();
const dns = require('dns');
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const express = require('express');
const path = require('path');
const cors = require('cors');
const { supabase, parseAndSyncExcel } = require('./supabase');

const app = express();
const port = 8000; // Porta hardcodada conforme solicitado

app.use(cors());
app.use(express.json());

// Servir arquivos estáticos da pasta public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname)); // Fallback para a raiz se necessário

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
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado no .env" });

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
    for (let p of previstas) {
      if (!trechosMap[p.trecho_id]) {
        trechosMap[p.trecho_id] = {
          id: p.trecho_id,
          nome: `Trecho ${p.trecho_id}`,
          cor: p.trecho_id === 1 ? '#8B1A1A' : p.trecho_id === 2 ? '#6d1414' : '#5e1010',
          inicio: p.data_prevista, // Vai atualizar para pegar o menor e maior depois
          fim: p.data_prevista,
          atividadesMap: {}
        };
      }

      const t = trechosMap[p.trecho_id];
      if (p.data_prevista < t.inicio) t.inicio = p.data_prevista;
      if (p.data_prevista > t.fim) t.fim = p.data_prevista;

      if (!t.atividadesMap[p.atividade_sigla]) {
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
      if (p.data_prevista < at.ini) at.ini = p.data_prevista;
      if (p.data_prevista > at.fim) at.fim = p.data_prevista;
    }

    // 3. Puxar Diários de Obra
    const { data: diarios, error: errD } = await supabase.from('diario_obra').select('*');
    if (errD) {
      console.warn("Tabela diario_obra não encontrada ou erro:", errD.message);
    }

    // Array de Trechos montado dinamicamente
    const trechos = Object.values(trechosMap).map(t => {
      return {
        ...t,
        atividades: Object.values(t.atividadesMap)
      };
    });

    res.json({ success: true, actuals: state, trechos: trechos, diarios: diarios || [] });
  } catch (err) {
    console.error("❌ Erro no endpoint /api/dashboard:", err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Endpoint para Lançamento Diário
app.post('/api/lancamento', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });
  const { trecho_id, data_lancamento, atividades } = req.body;
  // atividades ex: { "T1_RPA": 100, "T1_ESC": 20 }

  if (!trecho_id || !data_lancamento || !atividades) {
    return res.status(400).json({ error: "Faltam parâmetros" });
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

// Endpoints para Diário de Obra
app.get('/api/diario', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });
  const { data } = req.query;
  try {
    const { data: row, error } = await supabase.from('diario_obra').select('texto').eq('data', data).single();
    res.json({ texto: row ? row.texto : "" });
  } catch (err) {
    res.json({ texto: "" });
  }
});

app.post('/api/diario', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });
  const { data, texto } = req.body;
  try {
    const { error } = await supabase.from('diario_obra').upsert({ data, texto }, { onConflict: 'data' });
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════
// ENDPOINT IA — Proxy seguro para a API do Groq
// A chave GROQ_API_KEY fica em variável de ambiente,
// nunca exposta no frontend.
// ═══════════════════════════════════════════════════
app.post('/api/analyze', async (req, res) => {
  // Verifica se a chave da API está configurada
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'GROQ_API_KEY não configurada. Adicione no .env (local) ou nas Environment Variables do Vercel.'
    });
  }

  const { dados } = req.body;
  if (!dados) {
    return res.status(400).json({ error: 'Nenhum dado enviado para análise.' });
  }

  // Monta o prompt com os dados reais da obra
  const prompt = `
Você é um assistente especializado em gestão de obras de saneamento e infraestrutura.
Analise os dados abaixo do controle de obra do Emissário Leão Dourado e forneça:

1. 📊 Situação atual (avanço geral, ritmo vs planejado)
2. ⚠️ Alertas críticos (trechos atrasados, risco de não cumprimento do prazo)
3. 🎯 Recomendação de produção diária necessária para fechar no prazo
4. 💡 Insight principal (um ponto de atenção relevante)

Seja direto, objetivo e use dados concretos da análise. Responda em português.

DADOS DA OBRA:
${JSON.stringify(dados, null, 2)}
  `.trim();

  try {
    // Chamada à API do Groq (Llama 3.3 70B — gratuito)
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Você é um assistente de gestão de obras especializado em análise de progresso e prazos. Responda sempre em português brasileiro, de forma clara e objetiva.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 900,
        temperature: 0.4, // Menos criativo, mais preciso para análise técnica
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.error('Erro Groq:', err);
      return res.status(502).json({ error: 'Erro ao consultar o modelo de IA.' });
    }

    const groqData = await groqRes.json();
    const insight = groqData.choices?.[0]?.message?.content ?? 'Sem resposta do modelo.';
    return res.status(200).json({ insight });

  } catch (error) {
    console.error('Erro interno na análise IA:', error);
    return res.status(500).json({ error: 'Erro interno na função de análise.' });
  }
});

// RESUMO DE DIÁRIOS IA — Gera um parágrafo conciso a partir de relatos do diário
app.post('/api/summarize-diaries', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Chave IA não configurada.' });

  const { diarios } = req.body;
  if (!diarios || !Array.isArray(diarios) || diarios.length === 0) {
    return res.status(400).json({ error: 'Nenhum relato enviado para resumo.' });
  }

  const prompt = `
Você é um gestor de obras sênior. Resuma os seguintes relatos de diário de obra em um único parágrafo conciso, profissional e otimizado para leitura em WhatsApp. 
Foque no progresso físico, principais desafios superados e status atual. Não use bullet points, apenas um bloco de texto fluido. Responda em português brasileiro.

RELATOS DOS DIÁRIOS:
${diarios.join('\n---\n')}
  `.trim();

  try {
    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Você é um assistente especializado em relatórios executivos de engenharia.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 500,
        temperature: 0.3
      }),
    });

    if (!groqRes.ok) throw new Error('Falha na API Groq');

    const groqData = await groqRes.json();
    const summary = groqData.choices?.[0]?.message?.content ?? 'Não foi possível gerar o resumo.';
    return res.status(200).json({ summary });

  } catch (error) {
    console.error('Erro no resumo IA:', error);
    return res.status(500).json({ error: 'Erro ao gerar resumo dos diários.' });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard_v10.html'));
});
app.get('/v-final', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard_v10.html'));
});

app.listen(port, () => {
  console.log(`========================================`);
  console.log(`Servidor rodando em http://localhost:${port}`);
  console.log(`API Endpoints habilitados`);
  console.log(`========================================`);
});
