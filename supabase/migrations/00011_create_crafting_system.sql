-- =============================================
-- MIGRATION: Sistema de Crafting
-- Version: 2.0
-- Description: Sistema de crafting com receitas e ingredientes polimórficos
-- Dependencies: 00007 (consumables), 00010 (drops)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- === TRIGGERS ===

CREATE TRIGGER update_crafting_recipes_updated_at
    BEFORE UPDATE ON crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crafting_ingredients_updated_at
    BEFORE UPDATE ON crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Validar se personagem tem ingredientes suficientes
CREATE OR REPLACE FUNCTION validate_crafting_ingredients(p_character_id UUID, p_recipe_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    ingredient RECORD;
    current_quantity INTEGER;
BEGIN
    FOR ingredient IN 
        SELECT * FROM crafting_ingredients WHERE recipe_id = p_recipe_id
    LOOP
        IF ingredient.item_type = 'monster_drop' THEN
            SELECT quantity INTO current_quantity FROM character_drops 
            WHERE character_id = p_character_id AND drop_id = ingredient.item_id;
        ELSIF ingredient.item_type = 'consumable' THEN
            SELECT quantity INTO current_quantity FROM character_consumables 
            WHERE character_id = p_character_id AND consumable_id = ingredient.item_id;
        END IF;
        
        IF current_quantity IS NULL OR current_quantity < ingredient.quantity THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Consumir ingredientes do inventário
CREATE OR REPLACE FUNCTION consume_crafting_ingredients(p_character_id UUID, p_recipe_id UUID)
RETURNS VOID AS $$
DECLARE
    ingredient RECORD;
BEGIN
    FOR ingredient IN 
        SELECT * FROM crafting_ingredients WHERE recipe_id = p_recipe_id
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
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar crafting
CREATE OR REPLACE FUNCTION craft_item(p_character_id UUID, p_recipe_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, result_id UUID) AS $$
DECLARE
    v_result_id UUID;
    v_has_ingredients BOOLEAN;
BEGIN
    v_has_ingredients := validate_crafting_ingredients(p_character_id, p_recipe_id);
    
    IF NOT v_has_ingredients THEN
        RETURN QUERY SELECT FALSE, 'Ingredientes insuficientes'::TEXT, NULL::UUID;
        RETURN;
    END IF;
    
    SELECT result_id INTO v_result_id FROM crafting_recipes WHERE id = p_recipe_id;
    
    PERFORM consume_crafting_ingredients(p_character_id, p_recipe_id);
    
    INSERT INTO character_consumables (character_id, consumable_id, quantity)
    VALUES (p_character_id, v_result_id, 1)
    ON CONFLICT (character_id, consumable_id) 
    DO UPDATE SET quantity = character_consumables.quantity + 1, updated_at = NOW();
    
    RETURN QUERY SELECT TRUE, 'Item craftado com sucesso'::TEXT, v_result_id;
END;
$$ LANGUAGE plpgsql;

-- Buscar receitas disponíveis
CREATE OR REPLACE FUNCTION get_available_recipes(p_character_id UUID)
RETURNS TABLE (
    recipe_id UUID, recipe_name VARCHAR, result_id UUID, result_name VARCHAR,
    can_craft BOOLEAN, ingredients JSON
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.id,
        cr.name,
        cr.result_id,
        c.name,
        validate_crafting_ingredients(p_character_id, cr.id),
        (
            SELECT json_agg(json_build_object(
                'item_id', ci.item_id,
                'item_type', ci.item_type,
                'quantity', ci.quantity
            ))
            FROM crafting_ingredients ci
            WHERE ci.recipe_id = cr.id
        )
    FROM crafting_recipes cr
    JOIN consumables c ON cr.result_id = c.id
    ORDER BY c.level_requirement;
END;
$$ LANGUAGE plpgsql;

-- Buscar ingredientes de uma receita
CREATE OR REPLACE FUNCTION get_recipe_ingredients(p_recipe_id UUID)
RETURNS TABLE (
    ingredient_id UUID, item_id UUID, item_type VARCHAR, quantity INTEGER, item_name VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.id,
        ci.item_id,
        ci.item_type,
        ci.quantity,
        CASE 
            WHEN ci.item_type = 'monster_drop' THEN (SELECT name FROM monster_drops WHERE id = ci.item_id)
            WHEN ci.item_type = 'consumable' THEN (SELECT name FROM consumables WHERE id = ci.item_id)
        END
    FROM crafting_ingredients ci
    WHERE ci.recipe_id = p_recipe_id;
END;
$$ LANGUAGE plpgsql;

-- Verificar se pode craftar item específico
CREATE OR REPLACE FUNCTION can_craft_item(p_character_id UUID, p_recipe_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN validate_crafting_ingredients(p_character_id, p_recipe_id);
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE crafting_ingredients ENABLE ROW LEVEL SECURITY;

