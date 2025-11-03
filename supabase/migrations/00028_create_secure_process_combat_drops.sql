-- =============================================
-- MIGRATION: Função Segura para Processar Drops de Combate
-- Version: 1.0
-- Description: Cria a função RPC segura para adicionar drops do combate ao inventário
-- Dependencies: 00010 (drops_system)
-- =============================================

-- Função segura para processar múltiplos drops de uma só vez
CREATE OR REPLACE FUNCTION secure_process_combat_drops(
  p_character_id UUID,
  p_drops JSONB
)
RETURNS INTEGER AS $$
DECLARE
  v_drop_item JSONB;
  v_drops_count INTEGER := 0;
BEGIN
  -- Validar entrada
  IF p_character_id IS NULL THEN
    RAISE EXCEPTION 'Character ID não pode ser nulo';
  END IF;

  IF p_drops IS NULL OR p_drops = 'null'::JSONB THEN
    RETURN 0;
  END IF;

  -- Processar cada drop
  FOR v_drop_item IN SELECT jsonb_array_elements(p_drops)
  LOOP
    -- Validar se o drop existe
    IF NOT EXISTS (SELECT 1 FROM monster_drops WHERE id = (v_drop_item->>'drop_id')::UUID) THEN
      RAISE WARNING 'Drop não encontrado: %', v_drop_item->>'drop_id';
      CONTINUE;
    END IF;

    -- Validar quantidade
    IF (v_drop_item->>'quantity')::INTEGER <= 0 THEN
      RAISE WARNING 'Quantidade inválida para drop: %', v_drop_item->>'drop_id';
      CONTINUE;
    END IF;

    -- Adicionar drop ao inventário do personagem
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (
      p_character_id,
      (v_drop_item->>'drop_id')::UUID,
      (v_drop_item->>'quantity')::INTEGER
    )
    ON CONFLICT (character_id, drop_id) DO UPDATE
    SET quantity = character_drops.quantity + EXCLUDED.quantity,
        updated_at = NOW();

    v_drops_count := v_drops_count + 1;
  END LOOP;

  RETURN v_drops_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário descritivo
COMMENT ON FUNCTION secure_process_combat_drops(UUID, JSONB) IS
  'Processa múltiplos drops de combate e adiciona ao inventário do personagem. Retorna o número de drops processados.';

-- Grant para usuários autenticados
GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO authenticated;

-- RLS Policy para character_drops (leitura)
ALTER TABLE character_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their character drops" ON character_drops
  FOR SELECT
  USING (
    character_id IN (
      SELECT id FROM characters WHERE user_id = auth.uid()
    )
  );

-- RLS Policy para character_drops (atualização via função segura)
CREATE POLICY "Only secure functions can update character drops" ON character_drops
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);
