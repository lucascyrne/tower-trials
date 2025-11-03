-- =============================================
-- MIGRATION: Sistema de Consumíveis
-- Version: 2.0
-- Description: Consumíveis, inventário e funções de compra/venda/uso
-- Dependencies: 00004 (characters)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('potion', 'elixir', 'antidote', 'buff')),
    effect_value INTEGER NOT NULL,
    price INTEGER NOT NULL,
    level_requirement INTEGER NOT NULL DEFAULT 1,
    craftable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS character_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, consumable_id)
);

-- === TRIGGERS ===

CREATE TRIGGER update_consumables_updated_at
    BEFORE UPDATE ON consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_consumables_updated_at
    BEFORE UPDATE ON character_consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Comprar consumível
CREATE OR REPLACE FUNCTION buy_consumable(p_character_id UUID, p_consumable_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
BEGIN
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Consumível não encontrado'; END IF;
    
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
    IF v_gold < (v_price * p_quantity) THEN RAISE EXCEPTION 'Ouro insuficiente para comprar % unidades', p_quantity; END IF;
    
    UPDATE characters SET gold = gold - (v_price * p_quantity) WHERE id = p_character_id;
    
    INSERT INTO character_consumables (character_id, consumable_id, quantity)
    VALUES (p_character_id, p_consumable_id, p_quantity)
    ON CONFLICT (character_id, consumable_id) 
    DO UPDATE SET quantity = character_consumables.quantity + p_quantity, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Usar consumível
CREATE OR REPLACE FUNCTION use_consumable(p_character_id UUID, p_consumable_id UUID)
RETURNS VOID AS $$
DECLARE
    v_quantity INTEGER;
    v_effect_value INTEGER;
    v_type VARCHAR(50);
BEGIN
    SELECT quantity INTO v_quantity FROM character_consumables 
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF NOT FOUND OR v_quantity <= 0 THEN RAISE EXCEPTION 'Consumível não encontrado no inventário'; END IF;
    
    SELECT effect_value, type INTO v_effect_value, v_type FROM consumables WHERE id = p_consumable_id;
    
    IF v_type = 'potion' THEN
        UPDATE characters SET hp = LEAST(hp + v_effect_value, max_hp) WHERE id = p_character_id;
    ELSIF v_type = 'elixir' THEN
        UPDATE characters SET mana = LEAST(mana + v_effect_value, max_mana) WHERE id = p_character_id;
    END IF;
    
    UPDATE character_consumables SET quantity = quantity - 1 WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    DELETE FROM character_consumables WHERE character_id = p_character_id AND consumable_id = p_consumable_id AND quantity = 0;
END;
$$ LANGUAGE plpgsql;

-- Vender consumível
CREATE OR REPLACE FUNCTION sell_consumable(p_character_id UUID, p_consumable_id UUID, p_quantity INTEGER DEFAULT 1)
RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_quantity INTEGER;
BEGIN
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Consumível não encontrado'; END IF;
    
    SELECT quantity INTO v_quantity FROM character_consumables 
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF NOT FOUND OR v_quantity < p_quantity THEN RAISE EXCEPTION 'Quantidade insuficiente no inventário'; END IF;
    
    UPDATE character_consumables SET quantity = quantity - p_quantity 
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    DELETE FROM character_consumables WHERE character_id = p_character_id AND consumable_id = p_consumable_id AND quantity = 0;
    
    UPDATE characters SET gold = gold + ((v_price / 2) * p_quantity) WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Vender consumíveis em lote
CREATE OR REPLACE FUNCTION sell_consumables_batch(p_character_id UUID, p_consumable_ids UUID[], p_quantities INTEGER[])
RETURNS TABLE(total_gold_earned INTEGER, items_sold INTEGER, new_character_gold BIGINT) AS $$
DECLARE
    v_total_gold INTEGER := 0;
    v_items_sold INTEGER := 0;
    i INTEGER;
    v_sell_price INTEGER;
    v_current_quantity INTEGER;
BEGIN
    FOR i IN 1..array_length(p_consumable_ids, 1) LOOP
        SELECT (price / 2) INTO v_sell_price FROM consumables WHERE id = p_consumable_ids[i];
        
        SELECT quantity INTO v_current_quantity FROM character_consumables 
        WHERE character_id = p_character_id AND consumable_id = p_consumable_ids[i];
        
        IF v_current_quantity IS NOT NULL AND v_current_quantity >= p_quantities[i] THEN
            UPDATE character_consumables SET quantity = quantity - p_quantities[i]
            WHERE character_id = p_character_id AND consumable_id = p_consumable_ids[i];
            
            DELETE FROM character_consumables 
            WHERE character_id = p_character_id AND consumable_id = p_consumable_ids[i] AND quantity = 0;
            
            v_total_gold := v_total_gold + (v_sell_price * p_quantities[i]);
            v_items_sold := v_items_sold + p_quantities[i];
        END IF;
    END LOOP;
    
    UPDATE characters SET gold = gold + v_total_gold WHERE id = p_character_id;
    
    RETURN QUERY SELECT v_total_gold, v_items_sold, (SELECT gold FROM characters WHERE id = p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Consumir poção
CREATE OR REPLACE FUNCTION consume_potion(p_character_id UUID, p_consumable_id UUID)
RETURNS TABLE(success BOOLEAN, new_hp INTEGER, new_mana INTEGER, message TEXT) AS $$
DECLARE
    v_character RECORD;
    v_consumable RECORD;
    v_quantity INTEGER;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0, 0, 'Personagem não encontrado'::TEXT; RETURN; END IF;
    
    SELECT * INTO v_consumable FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN RETURN QUERY SELECT FALSE, 0, 0, 'Consumível não encontrado'::TEXT; RETURN; END IF;
    
    SELECT quantity INTO v_quantity FROM character_consumables 
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    IF v_quantity IS NULL OR v_quantity <= 0 THEN 
        RETURN QUERY SELECT FALSE, v_character.hp, v_character.mana, 'Sem consumíveis disponíveis'::TEXT; 
        RETURN; 
    END IF;
    
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;
    
    IF v_consumable.type = 'potion' THEN
        v_new_hp := LEAST(v_character.hp + v_consumable.effect_value, v_character.max_hp);
        UPDATE characters SET hp = v_new_hp WHERE id = p_character_id;
    ELSIF v_consumable.type = 'elixir' THEN
        v_new_mana := LEAST(v_character.mana + v_consumable.effect_value, v_character.max_mana);
        UPDATE characters SET mana = v_new_mana WHERE id = p_character_id;
    END IF;
    
    UPDATE character_consumables SET quantity = quantity - 1 WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    DELETE FROM character_consumables WHERE character_id = p_character_id AND consumable_id = p_consumable_id AND quantity = 0;
    
    RETURN QUERY SELECT TRUE, v_new_hp, v_new_mana, 'Consumível usado com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE consumables ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_consumables ENABLE ROW LEVEL SECURITY;

