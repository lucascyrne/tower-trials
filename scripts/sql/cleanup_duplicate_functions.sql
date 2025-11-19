-- ============================================================================
-- LIMPEZA: Remover funções duplicadas/conflitantes
-- DATA: 2025-01-19
-- DESCRIÇÃO:
--   A migração 00004 criou create_character(uuid, varchar)
--   A nova migração cria create_character(uuid, text)
--   Postgres não consegue escolher entre as duas → erro 300
--   
--   SOLUÇÃO: Remover ambas ANTES de aplicar a nova migração
-- ============================================================================

-- ✅ Droplar AMBAS as versões da função conflitante
-- Isto permite que a nova versão seja criada sem conflito
DROP FUNCTION IF EXISTS public.create_character(uuid, varchar) CASCADE;
DROP FUNCTION IF EXISTS public.create_character(uuid, text) CASCADE;

-- Confirmar que foram removidas
DO $$
BEGIN
  RAISE NOTICE '✅ Funções duplicadas removidas';
  RAISE NOTICE '✅ Pronto para aplicar fix_create_character_validation.sql';
  RAISE NOTICE '⚠️  PRÓXIMO PASSO: Executar fix_create_character_validation.sql';
END $$;

