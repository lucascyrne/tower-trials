-- ============================================================
-- INCREMENTAIS MINIMAS POS-BASELINE (DRAFT)
-- ============================================================
-- Este arquivo lista apenas incrementais permitidas apos baseline.
-- Nao inserir hotfixes cumulativos: cada incremental deve ser final.

-- Incremental 001: ajustes de balanceamento (quando aprovados)
-- - spells tuning
-- - monster scaling tuning
-- - equipment tuning

-- Incremental 002: ajustes de observabilidade/auditoria
-- - tabelas/log de seguranca
-- - indices para consultas operacionais

-- Incremental 003: novas features
-- - somente DDL/DML estritamente ligado a feature aprovada

-- Regras:
-- 1) toda incremental deve passar pelo contrato runtime;
-- 2) sem cadeias de fix/final/final2;
-- 3) sem quebra de assinatura RPC sem versionamento controlado.
