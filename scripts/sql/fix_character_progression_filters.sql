-- ============================================================================
-- MIGRAÇÃO: Corrigir contagem de personagens para filtrar apenas vivos
-- DATA: 2025-01-19
-- DESCRIÇÃO:
--   Problema: Personagens mortos (is_alive = FALSE) ainda eram contados na
--   progressão do usuário, ocupando slots e contando para o total de níveis.
--   
--   Solução: Atualizar as RPCs get_user_character_progression e 
--   check_character_limit para filtrar apenas personagens vivos.
-- ============================================================================

-- Droplar as funções antigas se existirem
DROP FUNCTION IF EXISTS public.get_user_character_progression(uuid);
DROP FUNCTION IF EXISTS public.check_character_limit(uuid);

-- ============================================================================
-- NOVA RPC: get_user_character_progression
-- Busca informações de progressão do usuário (APENAS PERSONAGENS VIVOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_character_progression(p_user_id uuid)
RETURNS TABLE (
  total_character_level bigint,
  current_character_count bigint,
  max_character_slots bigint,
  next_slot_required_level bigint,
  progress_to_next_slot numeric
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    -- Total de níveis (APENAS VIVOS)
    COALESCE(SUM(c.level), 0)::bigint as total_character_level,
    -- Contagem de personagens (APENAS VIVOS)
    COUNT(c.id)::bigint as current_character_count,
    -- Slots máximos baseado no total de níveis
    LEAST((3 + COALESCE(SUM(c.level), 0) / 100)::bigint, 20)::bigint as max_character_slots,
    -- Próximo slot requer este nível total
    (3 + COUNT(c.id)) * 100::bigint as next_slot_required_level,
    -- Progresso para o próximo slot em percentual
    CASE
      WHEN (3 + COUNT(c.id)) * 100 = 0 THEN 0
      ELSE LEAST(
        100,
        (COALESCE(SUM(c.level), 0)::numeric / ((3 + COUNT(c.id)) * 100)::numeric) * 100
      )
    END as progress_to_next_slot
  FROM characters c
  WHERE c.user_id = p_user_id
    AND c.is_alive IS NOT FALSE  -- ✅ CRÍTICO: Filtrar apenas vivos
$$;

-- ============================================================================
-- NOVA RPC: check_character_limit
-- Verifica limite de personagens do usuário (APENAS VIVOS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.check_character_limit(p_user_id uuid)
RETURNS TABLE (
  can_create boolean,
  available_slots bigint,
  current_characters bigint,
  total_level_sum bigint,
  next_slot_required_level bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    -- Pode criar se o número de personagens vivos < slots máximos
    (COUNT(DISTINCT c.id)::bigint < LEAST((3 + COALESCE(SUM(c.level), 0) / 100)::bigint, 20))::boolean as can_create,
    -- Slots disponíveis
    GREATEST(0, LEAST((3 + COALESCE(SUM(c.level), 0) / 100)::bigint, 20) - COUNT(DISTINCT c.id)::bigint)::bigint as available_slots,
    -- Personagens vivos
    COUNT(DISTINCT c.id)::bigint as current_characters,
    -- Total de níveis dos vivos
    COALESCE(SUM(c.level), 0)::bigint as total_level_sum,
    -- Próximo slot requer
    (3 + COUNT(DISTINCT c.id)) * 100::bigint as next_slot_required_level
  FROM characters c
  WHERE c.user_id = p_user_id
    AND c.is_alive IS NOT FALSE  -- ✅ CRÍTICO: Filtrar apenas vivos
$$;

-- ============================================================================
-- Grant permissões necessárias
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.get_user_character_progression(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_character_limit(uuid) TO authenticated;

-- ============================================================================
-- Validação: Garantir que is_alive está setado corretamente
-- ============================================================================
-- Todos os personagens devem ter is_alive = TRUE (vivos) ou FALSE (mortos)
-- Não deve haver NULLs
ALTER TABLE characters ALTER COLUMN is_alive SET NOT NULL;
ALTER TABLE characters ALTER COLUMN is_alive SET DEFAULT true;

-- ============================================================================
-- Log de migração
-- ============================================================================
-- Inserir entrada de log para rastreamento
INSERT INTO migration_logs (name, description, status, executed_at)
VALUES (
  'fix_character_progression_filters',
  'Corrigir contagem de personagens para filtrar apenas vivos na progressão',
  'success',
  now()
)
ON CONFLICT DO NOTHING;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE 'Migração fix_character_progression_filters concluída com sucesso!';
  RAISE NOTICE '✅ get_user_character_progression agora filtra apenas personagens vivos';
  RAISE NOTICE '✅ check_character_limit agora conta apenas personagens vivos';
  RAISE NOTICE '✅ Personagens mortos não ocupam mais slots ou contam para progressão';
END $$;


