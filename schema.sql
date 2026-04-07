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
-- Tabela de atividades H-H (Hora-a-Hora)
CREATE TABLE IF NOT EXISTS public.equipes_hh (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  data date NOT NULL,
  trecho_id text NOT NULL,
  atividade text NOT NULL,
  recurso text NOT NULL,
  tipo text NOT NULL, -- Planejado ou Realizado
  h06 numeric DEFAULT 0,
  h07 numeric DEFAULT 0,
  h08 numeric DEFAULT 0,
  h09 numeric DEFAULT 0,
  h10 numeric DEFAULT 0,
  h11 numeric DEFAULT 0,
  h12 numeric DEFAULT 0,
  h13 numeric DEFAULT 0,
  h14 numeric DEFAULT 0,
  h15 numeric DEFAULT 0,
  h16 numeric DEFAULT 0,
  h17 numeric DEFAULT 0,
  h18 numeric DEFAULT 0,
  h19 numeric DEFAULT 0,
  h20 numeric DEFAULT 0,
  h21 numeric DEFAULT 0,
  criado_em timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(data, trecho_id, atividade, recurso, tipo)
);

ALTER TABLE public.equipes_hh ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon select and insert for equipes_hh" ON public.equipes_hh FOR ALL USING (true);
