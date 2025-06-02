-- Migração para garantir que cada personagem não possa ter o mesmo consumível em múltiplos slots de poção
-- Data: 2024-12-02

-- Primeiro, limpar dados duplicados existentes (se houver)
-- Remove entradas duplicadas mantendo apenas a de menor slot_position
DELETE FROM character_potion_slots 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY character_id, consumable_id 
                   ORDER BY slot_position ASC
               ) as rn
        FROM character_potion_slots
        WHERE consumable_id IS NOT NULL
    ) t 
    WHERE t.rn > 1
);

-- Adicionar constraint única para prevenir duplicatas futuras
-- Garante que um personagem não possa ter o mesmo consumível em múltiplos slots
ALTER TABLE character_potion_slots 
ADD CONSTRAINT unique_character_consumable_slot 
UNIQUE (character_id, consumable_id);

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_character_potion_slots_lookup 
ON character_potion_slots(character_id, slot_position);

-- Remover funções existentes para permitir alteração do tipo de retorno
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER);

-- Atualizar função RPC para definir slot de poção com validação
CREATE OR REPLACE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_existing_slot INTEGER;
BEGIN
    -- Verificar se o consumível já está em outro slot
    SELECT slot_position INTO v_existing_slot
    FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND consumable_id = p_consumable_id
      AND slot_position != p_slot_position;
    
    -- Se encontrou em outro slot, retornar erro
    IF v_existing_slot IS NOT NULL THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Esta poção já está equipada no slot ' || v_existing_slot
        ) INTO v_result;
        RETURN v_result;
    END IF;

    -- Verificar se o personagem possui o consumível
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
          AND consumable_id = p_consumable_id 
          AND quantity > 0
    ) THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Você não possui este consumível'
        ) INTO v_result;
        RETURN v_result;
    END IF;

    -- Limpar slot atual se já tiver algo
    DELETE FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND slot_position = p_slot_position;

    -- Inserir novo slot
    INSERT INTO character_potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET consumable_id = p_consumable_id;

    -- Retornar sucesso
    SELECT json_build_object(
        'success', true,
        'message', 'Poção atribuída ao slot com sucesso'
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        -- Em caso de violação da constraint, retornar erro específico
        SELECT json_build_object(
            'success', false,
            'error', 'Esta poção já está equipada em outro slot'
        ) INTO v_result;
        RETURN v_result;
    WHEN OTHERS THEN
        -- Outros erros
        SELECT json_build_object(
            'success', false,
            'error', 'Erro interno: ' || SQLERRM
        ) INTO v_result;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Criar função para limpar slot de poção
CREATE OR REPLACE FUNCTION clear_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Remover do slot especificado
    DELETE FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND slot_position = p_slot_position;

    -- Retornar sucesso
    SELECT json_build_object(
        'success', true,
        'message', 'Slot limpo com sucesso'
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Erro ao limpar slot: ' || SQLERRM
        ) INTO v_result;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Adicionar comentários para documentação
COMMENT ON CONSTRAINT unique_character_consumable_slot ON character_potion_slots IS 
'Garante que cada personagem não possa ter o mesmo consumível em múltiplos slots de poção';

COMMENT ON FUNCTION set_potion_slot(UUID, INTEGER, UUID) IS 
'Define um consumível em um slot de poção com validação de duplicatas';

COMMENT ON FUNCTION clear_potion_slot(UUID, INTEGER) IS 
'Remove um consumível de um slot de poção específico'; 