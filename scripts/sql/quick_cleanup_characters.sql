-- Script RÁPIDO para limpeza completa de personagens
-- ⚠️  CUIDADO: Este script deleta TUDO relacionado a personagens!

-- Mostrar o que será deletado
SELECT 'CONTAGEM ANTES DA LIMPEZA:' as info;
SELECT 'Personagens vivos: ' || COUNT(*) as contagem FROM characters;
SELECT 'Personagens mortos: ' || COUNT(*) as contagem FROM dead_characters;

-- DESABILITAR TRIGGERS temporariamente para evitar conflitos
SET session_replication_role = replica;

-- LIMPEZA RÁPIDA (ordem importante para constraints FK)

-- 1. Limpar tabelas relacionadas
DELETE FROM character_activity_log;

-- 2. Limpar equipamentos se existir
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_equipment') THEN
        DELETE FROM character_equipment;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_drops') THEN
        DELETE FROM character_drops;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_spells') THEN
        DELETE FROM character_spells;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_inventory') THEN
        DELETE FROM character_inventory;
    END IF;
END $$;

-- 3. Deletar personagens mortos
DELETE FROM dead_characters;

-- 4. Deletar personagens vivos
DELETE FROM characters;

-- 5. Resetar progressão dos usuários
UPDATE users 
SET 
    total_character_level = 0,
    max_character_slots = 3
WHERE total_character_level > 0 OR max_character_slots > 3;

-- Verificação final
SELECT 'CONTAGEM APÓS LIMPEZA:' as info;
SELECT 'Personagens vivos: ' || COUNT(*) as contagem FROM characters;
SELECT 'Personagens mortos: ' || COUNT(*) as contagem FROM dead_characters;
SELECT 'Usuários resetados: ' || COUNT(*) as contagem FROM users WHERE max_character_slots = 3;

-- REABILITAR TRIGGERS
SET session_replication_role = DEFAULT;

-- Otimizar tabelas (ANALYZE pode ser executado em transação, VACUUM não)
ANALYZE characters;
ANALYZE dead_characters;
ANALYZE users;

SELECT '🧹 LIMPEZA CONCLUÍDA! Todos os personagens foram removidos.' as status;

-- =======================================================
-- NOTAS IMPORTANTES:
-- =======================================================
-- 
-- Para recuperar espaço em disco (opcional), execute separadamente:
-- VACUUM FULL characters;
-- VACUUM FULL dead_characters;
-- VACUUM FULL character_activity_log;
-- 
-- Função de teste para verificar se o sistema funciona:
-- SELECT create_character('your-user-uuid', 'TesteChar');
-- ======================================================= 