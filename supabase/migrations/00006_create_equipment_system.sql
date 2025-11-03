-- =============================================
-- MIGRATION: Sistema de Equipamentos
-- Version: 2.0
-- Description: Equipamentos, inventário e funções de compra/venda/toggle
-- Dependencies: 00002 (ENUMs), 00004 (characters)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    weapon_subtype weapon_subtype DEFAULT NULL,
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),
    
    strength_bonus INTEGER DEFAULT 0,
    dexterity_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    wisdom_bonus INTEGER DEFAULT 0,
    vitality_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,
    
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    
    critical_chance_bonus DECIMAL DEFAULT 0,
    critical_damage_bonus DECIMAL DEFAULT 0,
    
    strength_penalty INTEGER DEFAULT 0,
    dexterity_penalty INTEGER DEFAULT 0,
    intelligence_penalty INTEGER DEFAULT 0,
    wisdom_penalty INTEGER DEFAULT 0,
    vitality_penalty INTEGER DEFAULT 0,
    luck_penalty INTEGER DEFAULT 0,
    speed_penalty INTEGER DEFAULT 0,
    
    price INTEGER NOT NULL CHECK (price > 0),
    is_unlocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT weapon_subtype_check CHECK (
        (type = 'weapon' AND weapon_subtype IS NOT NULL) OR 
        (type != 'weapon' AND weapon_subtype IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS character_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);

-- === TRIGGERS ===

CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_equipment_updated_at
    BEFORE UPDATE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Calcular bônus total de equipamentos equipados
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(p_character_id UUID)
RETURNS TABLE (
    total_strength_bonus INTEGER, total_dexterity_bonus INTEGER, total_intelligence_bonus INTEGER,
    total_wisdom_bonus INTEGER, total_vitality_bonus INTEGER, total_luck_bonus INTEGER,
    total_atk_bonus INTEGER, total_def_bonus INTEGER, total_mana_bonus INTEGER, total_speed_bonus INTEGER,
    total_hp_bonus INTEGER, total_critical_chance_bonus DECIMAL, total_critical_damage_bonus DECIMAL,
    total_strength_penalty INTEGER, total_dexterity_penalty INTEGER, total_intelligence_penalty INTEGER,
    total_wisdom_penalty INTEGER, total_vitality_penalty INTEGER, total_luck_penalty INTEGER, total_speed_penalty INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(e.strength_bonus), 0)::INTEGER - COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_bonus), 0)::INTEGER - COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_bonus), 0)::INTEGER - COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_bonus), 0)::INTEGER - COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_bonus), 0)::INTEGER - COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_bonus), 0)::INTEGER - COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER - COALESCE(SUM(e.speed_penalty), 0)::INTEGER,
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER,
        COALESCE(SUM(e.critical_chance_bonus), 0.0)::DECIMAL,
        COALESCE(SUM(e.critical_damage_bonus), 0.0)::DECIMAL,
        COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.speed_penalty), 0)::INTEGER
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id AND ce.is_equipped = true;
END;
$$ LANGUAGE plpgsql;

-- Comprar equipamento
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
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped) VALUES (p_character_id, p_equipment_id, false);
END;
$$ LANGUAGE plpgsql;

-- Vender equipamento
CREATE OR REPLACE FUNCTION sell_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS VOID AS $$
DECLARE
    v_sell_price INTEGER;
BEGIN
    SELECT price / 2 INTO v_sell_price FROM equipment WHERE id = p_equipment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Equipamento não encontrado'; END IF;
    
    IF NOT EXISTS (SELECT 1 FROM character_equipment WHERE character_id = p_character_id AND equipment_id = p_equipment_id) THEN
        RAISE EXCEPTION 'Personagem não possui este equipamento';
    END IF;
    
    DELETE FROM character_equipment WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    UPDATE characters SET gold = gold + v_sell_price WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Equipar/desequipar equipamento
CREATE OR REPLACE FUNCTION toggle_equipment(p_character_id UUID, p_equipment_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_equipped BOOLEAN;
    v_equipment_type equipment_type;
BEGIN
    SELECT is_equipped INTO v_is_equipped FROM character_equipment 
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não possui este equipamento'; END IF;
    
    SELECT type INTO v_equipment_type FROM equipment WHERE id = p_equipment_id;
    
    IF NOT v_is_equipped THEN
        UPDATE character_equipment ce SET is_equipped = false
        FROM equipment e
        WHERE ce.character_id = p_character_id AND ce.equipment_id = e.id AND e.type = v_equipment_type;
    END IF;
    
    UPDATE character_equipment SET is_equipped = NOT v_is_equipped
    WHERE character_id = p_character_id AND equipment_id = p_equipment_id;
    
    PERFORM recalculate_character_stats(p_character_id);
    
    RETURN NOT v_is_equipped;
END;
$$ LANGUAGE plpgsql;

-- Desbloquear equipamento na loja
CREATE OR REPLACE FUNCTION unlock_equipment(p_equipment_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE equipment SET is_unlocked = true WHERE id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Vender equipamentos em lote
CREATE OR REPLACE FUNCTION sell_character_equipment_batch(p_character_id UUID, p_equipment_ids UUID[])
RETURNS TABLE(total_gold_earned INTEGER, items_sold INTEGER, new_character_gold BIGINT) AS $$
DECLARE
    v_total_gold INTEGER := 0;
    v_items_sold INTEGER := 0;
    equipment_id UUID;
    v_sell_price INTEGER;
BEGIN
    FOREACH equipment_id IN ARRAY p_equipment_ids LOOP
        SELECT (price / 2) INTO v_sell_price FROM equipment WHERE id = equipment_id;
        
        IF EXISTS (SELECT 1 FROM character_equipment WHERE character_id = p_character_id AND equipment_id = equipment_id) THEN
            DELETE FROM character_equipment WHERE character_id = p_character_id AND equipment_id = equipment_id;
            v_total_gold := v_total_gold + v_sell_price;
            v_items_sold := v_items_sold + 1;
        END IF;
    END LOOP;
    
    UPDATE characters SET gold = gold + v_total_gold WHERE id = p_character_id;
    
    RETURN QUERY SELECT v_total_gold, v_items_sold, (SELECT gold FROM characters WHERE id = p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_equipment ENABLE ROW LEVEL SECURITY;

