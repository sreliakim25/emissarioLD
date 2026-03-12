-- schema.sql
-- Run this in the Supabase SQL Editor

-- Tabela de planejamento lida do Excel
CREATE TABLE IF NOT EXISTS public.atividades_previstas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trecho_id integer NOT NULL,
  atividade_nome text NOT NULL,
  atividade_sigla text NOT NULL,
  unidade text NOT NULL,
  data_prevista date NOT NULL,
  meta_diaria numeric NOT NULL,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela do realizado apontado dia a dia
CREATE TABLE IF NOT EXISTS public.producao_realizada (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  trecho_id integer NOT NULL,
  atividade_sigla text NOT NULL,
  data_lancamento date NOT NULL,
  quantidade numeric NOT NULL,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  -- Evitar lançamentos duplicados para a mesma atividade no mesmo dia
  UNIQUE(trecho_id, atividade_sigla, data_lancamento)
);

-- Políticas RLS (Row Level Security) - por ora permitindo acesso anônimo total para simplificar o dev
ALTER TABLE public.atividades_previstas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.producao_realizada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon select and insert for atividades" ON public.atividades_previstas FOR ALL USING (true);
CREATE POLICY "Allow anon select and insert for producao" ON public.producao_realizada FOR ALL USING (true);
