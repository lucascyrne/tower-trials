-- =============================================
-- MIGRATION: Sistema de Drops
-- Version: 2.0
-- Description: Sistema de drops de monstros e inventário
-- Dependencies: 00004 (characters), 00005 (monsters)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS monster_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (drop_chance BETWEEN 0 AND 1),
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS character_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);

-- === TRIGGERS ===

CREATE TRIGGER update_monster_drops_updated_at
    BEFORE UPDATE ON monster_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monster_possible_drops_updated_at
    BEFORE UPDATE ON monster_possible_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_drops_updated_at
    BEFORE UPDATE ON character_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Adicionar drop ao inventário do personagem
CREATE OR REPLACE FUNCTION add_character_drop(p_character_id UUID, p_drop_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (p_character_id, p_drop_id, p_quantity)
    ON CONFLICT (character_id, drop_id) 
    DO UPDATE SET quantity = character_drops.quantity + p_quantity, updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Buscar drops do personagem
CREATE OR REPLACE FUNCTION get_character_drops(p_character_id UUID)
RETURNS TABLE (
    drop_id UUID, name VARCHAR, description TEXT, rarity VARCHAR, quantity INTEGER, value INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT cd.drop_id, md.name, md.description, md.rarity, cd.quantity, md.value
    FROM character_drops cd
    JOIN monster_drops md ON cd.drop_id = md.id
    WHERE cd.character_id = p_character_id AND cd.quantity > 0
    ORDER BY md.rarity, md.name;
END;
$$ LANGUAGE plpgsql;

-- Vender drops em lote
CREATE OR REPLACE FUNCTION sell_drops_batch(p_character_id UUID, p_drop_ids UUID[], p_quantities INTEGER[])
RETURNS TABLE(total_gold_earned INTEGER, items_sold INTEGER, new_character_gold BIGINT) AS $$
DECLARE
    v_total_gold INTEGER := 0;
    v_items_sold INTEGER := 0;
    i INTEGER;
    v_sell_value INTEGER;
    v_current_quantity INTEGER;
BEGIN
    FOR i IN 1..array_length(p_drop_ids, 1) LOOP
        SELECT value INTO v_sell_value FROM monster_drops WHERE id = p_drop_ids[i];
        
        SELECT quantity INTO v_current_quantity FROM character_drops 
        WHERE character_id = p_character_id AND drop_id = p_drop_ids[i];
        
        IF v_current_quantity IS NOT NULL AND v_current_quantity >= p_quantities[i] THEN
            UPDATE character_drops SET quantity = quantity - p_quantities[i]
            WHERE character_id = p_character_id AND drop_id = p_drop_ids[i];
            
            DELETE FROM character_drops 
            WHERE character_id = p_character_id AND drop_id = p_drop_ids[i] AND quantity = 0;
            
            v_total_gold := v_total_gold + (v_sell_value * p_quantities[i]);
            v_items_sold := v_items_sold + p_quantities[i];
        END IF;
    END LOOP;
    
    UPDATE characters SET gold = gold + v_total_gold WHERE id = p_character_id;
    
    RETURN QUERY SELECT v_total_gold, v_items_sold, (SELECT gold FROM characters WHERE id = p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE monster_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE monster_possible_drops ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_drops ENABLE ROW LEVEL SECURITY;

