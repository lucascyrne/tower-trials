-- =============================================
-- MIGRATION: Sistema de Crafting de Equipamentos
-- Version: 1.0
-- Description: Tabelas e funções para crafting de equipamentos
-- Dependencies: 00006 (equipment), 00010 (drops), 00007 (consumables)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS equipment_crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS equipment_crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES equipment_crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable', 'equipment')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- === TRIGGERS ===

CREATE TRIGGER update_equipment_crafting_recipes_updated_at
    BEFORE UPDATE ON equipment_crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_crafting_ingredients_updated_at
    BEFORE UPDATE ON equipment_crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Validar se personagem tem ingredientes suficientes para crafting de equipamento
CREATE OR REPLACE FUNCTION validate_equipment_crafting_ingredients(p_character_id UUID, p_recipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    ingredient RECORD;
    current_quantity INTEGER;
BEGIN
    FOR ingredient IN 
        SELECT * FROM equipment_crafting_ingredients WHERE recipe_id = p_recipe_id
    LOOP
        IF ingredient.item_type = 'monster_drop' THEN
            SELECT quantity INTO current_quantity FROM character_drops 
            WHERE character_id = p_character_id AND drop_id = ingredient.item_id;
        ELSIF ingredient.item_type = 'consumable' THEN
            SELECT quantity INTO current_quantity FROM character_consumables 
            WHERE character_id = p_character_id AND consumable_id = ingredient.item_id;
        ELSIF ingredient.item_type = 'equipment' THEN
            -- Contar equipamentos não equipados
            SELECT COUNT(*) INTO current_quantity FROM character_equipment 
            WHERE character_id = p_character_id AND equipment_id = ingredient.item_id AND is_equipped = FALSE;
        END IF;
        
        IF current_quantity IS NULL OR current_quantity < ingredient.quantity THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Consumir ingredientes do inventário para crafting de equipamento
CREATE OR REPLACE FUNCTION consume_equipment_crafting_ingredients(p_character_id UUID, p_recipe_id UUID)
RETURNS VOID AS $$
DECLARE
    ingredient RECORD;
    v_quantity_to_delete INTEGER;
BEGIN
    FOR ingredient IN 
        SELECT * FROM equipment_crafting_ingredients WHERE recipe_id = p_recipe_id
    LOOP
        IF ingredient.item_type = 'monster_drop' THEN
            UPDATE character_drops SET quantity = quantity - ingredient.quantity
            WHERE character_id = p_character_id AND drop_id = ingredient.item_id;
            
            DELETE FROM character_drops 
            WHERE character_id = p_character_id AND drop_id = ingredient.item_id AND quantity <= 0;
        ELSIF ingredient.item_type = 'consumable' THEN
            UPDATE character_consumables SET quantity = quantity - ingredient.quantity
            WHERE character_id = p_character_id AND consumable_id = ingredient.item_id;
            
            DELETE FROM character_consumables 
            WHERE character_id = p_character_id AND consumable_id = ingredient.item_id AND quantity <= 0;
        ELSIF ingredient.item_type = 'equipment' THEN
            -- Deletar equipamentos não equipados consumidos (usando CTE para LIMIT com variável)
            WITH to_delete AS (
                SELECT id FROM character_equipment 
                WHERE character_id = p_character_id AND equipment_id = ingredient.item_id AND is_equipped = FALSE
                LIMIT ingredient.quantity
            )
            DELETE FROM character_equipment 
            WHERE id IN (SELECT id FROM to_delete);
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Craftar equipamento
CREATE OR REPLACE FUNCTION craft_equipment(p_character_id UUID, p_recipe_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, result_equipment_id UUID) AS $$
DECLARE
    v_result_equipment_id UUID;
    v_has_ingredients BOOLEAN;
BEGIN
    v_has_ingredients := validate_equipment_crafting_ingredients(p_character_id, p_recipe_id);
    
    IF NOT v_has_ingredients THEN
        RETURN QUERY SELECT FALSE, 'Ingredientes insuficientes'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    SELECT result_equipment_id INTO v_result_equipment_id FROM equipment_crafting_recipes WHERE id = p_recipe_id;
    
    PERFORM consume_equipment_crafting_ingredients(p_character_id, p_recipe_id);
    
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped)
    VALUES (p_character_id, v_result_equipment_id, FALSE)
    ON CONFLICT DO NOTHING;
    
    RETURN QUERY SELECT TRUE, 'Equipamento criado com sucesso!'::TEXT, v_result_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Verificar se pode craftar equipamento específico
CREATE OR REPLACE FUNCTION check_can_craft_equipment(p_character_id UUID, p_recipe_id UUID)
RETURNS TABLE(canCraft BOOLEAN, missingIngredients TEXT[]) AS $$
DECLARE
    v_has_ingredients BOOLEAN;
    v_missing TEXT[];
    ingredient RECORD;
    current_quantity INTEGER;
BEGIN
    v_has_ingredients := TRUE;
    v_missing := ARRAY[]::TEXT[];
    
    FOR ingredient IN 
        SELECT * FROM equipment_crafting_ingredients WHERE recipe_id = p_recipe_id
    LOOP
        current_quantity := 0;
        
        IF ingredient.item_type = 'monster_drop' THEN
            SELECT quantity INTO current_quantity FROM character_drops 
            WHERE character_id = p_character_id AND drop_id = ingredient.item_id;
        ELSIF ingredient.item_type = 'consumable' THEN
            SELECT quantity INTO current_quantity FROM character_consumables 
            WHERE character_id = p_character_id AND consumable_id = ingredient.item_id;
        ELSIF ingredient.item_type = 'equipment' THEN
            SELECT COUNT(*) INTO current_quantity FROM character_equipment 
            WHERE character_id = p_character_id AND equipment_id = ingredient.item_id AND is_equipped = FALSE;
        END IF;
        
        current_quantity := COALESCE(current_quantity, 0);
        
        IF current_quantity < ingredient.quantity THEN
            v_has_ingredients := FALSE;
            v_missing := array_append(v_missing, 'Faltam ' || (ingredient.quantity - current_quantity) || ' itens');
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_ingredients, v_missing;
END;
$$ LANGUAGE plpgsql;

-- === INDEXES ===

CREATE INDEX IF NOT EXISTS idx_equipment_crafting_recipes_result_id 
    ON equipment_crafting_recipes(result_equipment_id);

CREATE INDEX IF NOT EXISTS idx_equipment_crafting_ingredients_recipe_id 
    ON equipment_crafting_ingredients(recipe_id);

-- === RLS POLICIES ===

ALTER TABLE equipment_crafting_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_crafting_ingredients ENABLE ROW LEVEL SECURITY;

-- Permitir leitura pública das receitas
CREATE POLICY "Allow public read equipment_crafting_recipes"
    ON equipment_crafting_recipes FOR SELECT USING (true);

CREATE POLICY "Allow public read equipment_crafting_ingredients"
    ON equipment_crafting_ingredients FOR SELECT USING (true);
