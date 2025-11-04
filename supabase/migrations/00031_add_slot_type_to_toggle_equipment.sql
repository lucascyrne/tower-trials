-- =============================================
-- MIGRATION: Adicionar slot_type ao toggle_equipment
-- Version: 1.0
-- Description: Permite equipar no slot correto (main_hand, off_hand, etc)
-- Dependencies: 00029 (duplicate equipment fix)
-- =============================================

-- 1. Adicionar coluna slot_type se não existir
ALTER TABLE character_equipment
ADD COLUMN IF NOT EXISTS slot_type VARCHAR(50);

-- 2. Atualizar função toggle_equipment para aceitar slot_type
DROP FUNCTION IF EXISTS toggle_equipment(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION toggle_equipment(
  p_character_id UUID, 
  p_equipment_id UUID,
  p_slot_type VARCHAR(50) DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_equipped BOOLEAN;
    v_equipment_type VARCHAR(50);
BEGIN
    -- Buscar tipo do equipamento
    SELECT type INTO v_equipment_type
    FROM equipment
    WHERE id = p_equipment_id;

    IF v_equipment_type IS NULL THEN
        RAISE EXCEPTION 'Equipamento não encontrado';
    END IF;

    -- Se slot_type não foi especificado, determinar automaticamente
    IF p_slot_type IS NULL THEN
        p_slot_type := CASE v_equipment_type
            WHEN 'weapon' THEN 'main_hand'
            WHEN 'armor' THEN 'armor'
            WHEN 'chest' THEN 'chest'
            WHEN 'helmet' THEN 'helmet'
            WHEN 'legs' THEN 'legs'
            WHEN 'boots' THEN 'boots'
            WHEN 'ring' THEN 'ring_1'
            WHEN 'necklace' THEN 'necklace'
            WHEN 'amulet' THEN 'amulet'
            ELSE 'main_hand'
        END;
    END IF;

    -- Buscar status atual
    SELECT is_equipped INTO v_is_equipped
    FROM character_equipment
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não possui este equipamento';
    END IF;

    -- Atualizar equipamento COM slot_type
    UPDATE character_equipment
    SET is_equipped = NOT v_is_equipped,
        slot_type = CASE 
            WHEN NOT v_is_equipped THEN p_slot_type
            ELSE NULL
        END,
        updated_at = NOW()
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;

    PERFORM recalculate_character_stats(p_character_id);

    RETURN NOT v_is_equipped;
END;
$$ LANGUAGE plpgsql;
