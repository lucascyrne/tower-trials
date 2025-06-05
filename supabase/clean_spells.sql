-- Script para limpar completamente a tabela de spells e suas dependências
-- Execute ANTES do script spells.sql
-- Data: 2024-12-03

-- =====================================
-- LIMPEZA SEGURA DA TABELA DE SPELLS
-- =====================================

-- Primeiro, remover todas as magias equipadas pelos personagens
-- para evitar problemas de foreign key
DELETE FROM character_spell_slots WHERE spell_id IN (SELECT id FROM spells);

-- Limpar qualquer log ou histórico relacionado a magias (se existir)
-- DELETE FROM spell_usage_logs WHERE spell_id IN (SELECT id FROM spells);

-- Agora podemos limpar a tabela principal de spells
DELETE FROM spells;

-- Resetar a sequência do ID (se usar SERIAL/auto-increment)
-- Isso garante que os IDs começem do 1 novamente
SELECT setval(pg_get_serial_sequence('spells', 'id'), 1, false);

-- Verificar se a tabela está vazia
SELECT 
    COUNT(*) as spells_remaining,
    'Tabela limpa com sucesso' as status
FROM spells;

-- Verificar se character_spell_slots foi limpa
SELECT 
    COUNT(*) as character_spell_slots_remaining,
    'Associações de personagens limpas' as status
FROM character_spell_slots;

-- Mostrar estrutura da tabela para confirmar
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'spells' 
ORDER BY ordinal_position;

-- Mensagem de confirmação
SELECT 'LIMPEZA CONCLUÍDA - Pronto para executar spells.sql' as message; 