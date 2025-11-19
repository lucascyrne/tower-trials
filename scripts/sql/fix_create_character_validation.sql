-- ============================================================================
-- MIGRAÇÃO: Corrigir validação de limite em create_character
-- DATA: 2025-01-19
-- DESCRIÇÃO:
--   Problema: A RPC create_character estava contando personagens mortos
--   ao validar o limite, impedindo criar novos mesmo com slots livres.
--   
--   Solução: Atualizar a RPC create_character para usar check_character_limit
--   que agora filtra apenas personagens vivos.
-- ============================================================================

-- ✅ CRÍTICO: Droplar AMBAS as versões conflitantes (varchar e text)
DROP FUNCTION IF EXISTS public.create_character(uuid, varchar);
DROP FUNCTION IF EXISTS public.create_character(uuid, text);

-- ============================================================================
-- NOVA RPC: create_character
-- Cria um novo personagem (APENAS CONTA PERSONAGENS VIVOS)
-- ============================================================================
CREATE FUNCTION public.create_character(
  p_user_id uuid,
  p_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_character_id uuid;
  v_can_create boolean;
  v_available_slots bigint;
  v_current_count bigint;
BEGIN
  -- ✅ CRÍTICO: Usar check_character_limit que filtra apenas vivos
  SELECT can_create, available_slots, current_characters
  INTO v_can_create, v_available_slots, v_current_count
  FROM public.check_character_limit(p_user_id);

  -- Se não conseguiu dados, assume que pode criar (sem limite)
  IF v_can_create IS NULL THEN
    v_can_create := true;
  END IF;

  -- Validar limite (conta apenas vivos)
  IF NOT v_can_create THEN
    RAISE EXCEPTION 'Limite de personagens atingido. Disponíveis: %, Criados: %', 
      v_available_slots, v_current_count;
  END IF;

  -- Validar nome
  IF p_name IS NULL OR TRIM(p_name) = '' THEN
    RAISE EXCEPTION 'Nome do personagem não pode estar vazio';
  END IF;

  IF LENGTH(TRIM(p_name)) < 3 OR LENGTH(p_name) > 20 THEN
    RAISE EXCEPTION 'Nome deve ter entre 3 e 20 caracteres';
  END IF;

  -- Verificar se nome já existe para este usuário (apenas vivos)
  IF EXISTS (
    SELECT 1 FROM characters 
    WHERE user_id = p_user_id 
      AND LOWER(name) = LOWER(TRIM(p_name))
      AND is_alive IS NOT FALSE
  ) THEN
    RAISE EXCEPTION 'Já existe um personagem com este nome';
  END IF;

  -- Criar novo personagem
  v_character_id := gen_random_uuid();
  
  INSERT INTO characters (
    id,
    user_id,
    name,
    level,
    xp,
    xp_next_level,
    gold,
    hp,
    max_hp,
    mana,
    max_mana,
    atk,
    def,
    speed,
    floor,
    strength,
    dexterity,
    intelligence,
    wisdom,
    vitality,
    luck,
    attribute_points,
    is_alive,
    created_at,
    updated_at
  ) VALUES (
    v_character_id,
    p_user_id,
    TRIM(p_name),
    1,
    0,
    100,
    0,
    50,
    50,
    20,
    20,
    5,
    5,
    5,
    1,
    10,
    10,
    10,
    10,
    10,
    10,
    0,
    TRUE,  -- ✅ Personagem novo sempre está vivo
    NOW(),
    NOW()
  );

  -- Log
  RAISE NOTICE 'Personagem criado com sucesso: % (ID: %)', p_name, v_character_id;
  
  RETURN v_character_id;
END;
$$;

-- ============================================================================
-- Grant permissões
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.create_character(uuid, text) TO authenticated;

-- ============================================================================
-- Log de migração
-- ============================================================================
INSERT INTO migration_logs (name, description, status, executed_at)
VALUES (
  'fix_create_character_validation',
  'Corrigir validação de limite em create_character para contar apenas vivos',
  'success',
  now()
)
ON CONFLICT DO NOTHING;

-- Mensagem de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ create_character agora valida limite contando apenas personagens vivos';
  RAISE NOTICE '✅ Personagens mortos não ocupam mais slots na criação';
  RAISE NOTICE '✅ Validação de nome mantida intacta';
END $$;


