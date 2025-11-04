-- =============================================
-- MIGRATION: Corrigir referência ambígua de coluna em buy_equipment
-- Version: 1.0
-- Description: Fix "column reference quantity is ambiguous" error
-- Dependencies: 00029 (duplicate equipment fix)
-- =============================================

-- ✅ FIX: Recriar função buy_equipment com coluna quantity explicitamente qualificada

DROP FUNCTION IF EXISTS buy_equipment(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION buy_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
BEGIN
    SELECT price INTO v_price FROM equipment WHERE id = p_equipment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado'; END IF;
    
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
    IF v_gold < v_price THEN RAISE EXCEPTION 'Ouro insuficiente'; END IF;
    
    UPDATE characters SET gold = gold - v_price WHERE id = p_character_id;
    
    -- ✅ CORRIGIDO: Usar excluded.quantity para referenciar o valor inserido
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped, quantity) 
    VALUES (p_character_id, p_equipment_id, false, 1)
    ON CONFLICT (character_id, equipment_id) DO UPDATE
    SET quantity = character_equipment.quantity + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

