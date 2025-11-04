-- =============================================
-- MIGRATION: Permitir múltiplas cópias do mesmo equipamento
-- Version: 1.0
-- Description: Remove constraint UNIQUE que impedia duplicatas, adiciona quantity
-- Dependencies: 00006 (equipment system)
-- =============================================

-- ✅ SOLUÇÃO: Remover constraint que impedia duplicatas
-- Permitir múltiplas linhas (character_id, equipment_id) se cada uma for uma cópia diferente

-- 1. Remover constraint atual
ALTER TABLE character_equipment 
DROP CONSTRAINT character_equipment_character_id_equipment_id_key;

-- 2. Adicionar coluna de quantidade para rastrear múltiplas cópias
ALTER TABLE character_equipment
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 CHECK (quantity > 0);

-- 3. Atualizar função buy_equipment para usar ON CONFLICT
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
    
    -- ✅ CORRIGIDO: Usar ON CONFLICT para permitir duplicatas
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped, quantity) 
    VALUES (p_character_id, p_equipment_id, false, 1)
    ON CONFLICT (character_id, equipment_id) DO UPDATE
    SET quantity = quantity + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 4. Atualizar função sell_equipment para decrementar quantidade
DROP FUNCTION IF EXISTS sell_equipment(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION sell_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_sell_price INTEGER;
    v_current_quantity INTEGER;
BEGIN
    SELECT price / 2 INTO v_sell_price FROM equipment WHERE id = p_equipment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado'; END IF;
    
    SELECT quantity INTO v_current_quantity 
    FROM character_equipment 
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    
    IF NOT FOUND OR v_current_quantity IS NULL THEN
        RAISE EXCEPTION 'Personagem não possui este equipamento';
    END IF;
    
    -- ✅ CORRIGIDO: Se quantity > 1, decrementar; se quantity = 1, deletar
    IF v_current_quantity > 1 THEN
        UPDATE character_equipment 
        SET quantity = quantity - 1,
            updated_at = NOW()
        WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    ELSE
        DELETE FROM character_equipment 
        WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    END IF;
    
    UPDATE characters SET gold = gold + v_sell_price WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Restaurar constraint UNIQUE (para permitir múltiplas compras)
ALTER TABLE character_equipment 
ADD UNIQUE(character_id, equipment_id);

-- 6. Atualizar função toggle_equipment
DROP FUNCTION IF EXISTS toggle_equipment(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION toggle_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_equipped BOOLEAN;
BEGIN
    SELECT is_equipped INTO v_is_equipped
    FROM character_equipment
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não possui este equipamento';
    END IF;

    UPDATE character_equipment
    SET is_equipped = NOT v_is_equipped,
        updated_at = NOW()
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;

    PERFORM recalculate_character_stats(p_character_id);

    RETURN NOT v_is_equipped;
END;
$$ LANGUAGE plpgsql;
