-- Migração para adicionar sistema de crafting de equipamentos

-- Adicionar campo 'craftable' na tabela de equipamentos
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS craftable BOOLEAN DEFAULT FALSE;

-- Tabela de receitas de equipamentos craftáveis
CREATE TABLE IF NOT EXISTS equipment_crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de ingredientes para receitas de equipamentos
CREATE TABLE IF NOT EXISTS equipment_crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES equipment_crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable', 'equipment')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Função para validar ingredientes de equipamentos
CREATE OR REPLACE FUNCTION validate_equipment_crafting_ingredient()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.item_type = 'monster_drop' THEN
        IF NOT EXISTS (SELECT 1 FROM monster_drops WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid monster_drop id: %', NEW.item_id;
        END IF;
    ELSIF NEW.item_type = 'consumable' THEN
        IF NOT EXISTS (SELECT 1 FROM consumables WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid consumable id: %', NEW.item_id;
        END IF;
    ELSIF NEW.item_type = 'equipment' THEN
        IF NOT EXISTS (SELECT 1 FROM equipment WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid equipment id: %', NEW.item_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
CREATE TRIGGER validate_equipment_crafting_ingredient_trigger
    BEFORE INSERT OR UPDATE ON equipment_crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION validate_equipment_crafting_ingredient();

-- Função para verificar se o personagem pode criar um equipamento
CREATE OR REPLACE FUNCTION check_can_craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
) AS $$
DECLARE
    v_missing TEXT[] := '{}';
    v_has_all BOOLEAN := TRUE;
    r RECORD;
BEGIN
    -- Para cada ingrediente na receita
    FOR r IN (
        SELECT 
            eci.*, 
            md.name AS drop_name, 
            c.name AS consumable_name,
            e.name AS equipment_name
        FROM equipment_crafting_ingredients eci
        LEFT JOIN monster_drops md ON eci.item_type = 'monster_drop' AND eci.item_id = md.id
        LEFT JOIN consumables c ON eci.item_type = 'consumable' AND eci.item_id = c.id
        LEFT JOIN equipment e ON eci.item_type = 'equipment' AND eci.item_id = e.id
        WHERE eci.recipe_id = p_recipe_id
    ) LOOP
        -- Verificar se o personagem tem o ingrediente em quantidade suficiente
        IF r.item_type = 'monster_drop' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_drops
                WHERE character_id = p_character_id
                AND drop_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.drop_name || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'consumable' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_consumables
                WHERE character_id = p_character_id
                AND consumable_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.consumable_name || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'equipment' THEN
            -- Contar quantos itens do mesmo tipo o personagem possui (não equipados)
            DECLARE
                v_owned_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO v_owned_count
                FROM character_equipment
                WHERE character_id = p_character_id
                AND equipment_id = r.item_id
                AND is_equipped = false; -- Apenas equipamentos não equipados podem ser usados como ingredientes
                
                IF v_owned_count < r.quantity THEN
                    v_has_all := FALSE;
                    v_missing := array_append(v_missing, r.equipment_name || ' (x' || r.quantity || ')');
                END IF;
            END;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_all, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um equipamento
CREATE OR REPLACE FUNCTION craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID AS $$
DECLARE
    v_result_equipment_id UUID;
    v_can_craft BOOLEAN;
    v_missing TEXT[];
    r RECORD;
    v_consumed_count INTEGER;
    equipment_record RECORD;
BEGIN
    -- Verificar se pode criar o equipamento
    SELECT * INTO v_can_craft, v_missing FROM check_can_craft_equipment(p_character_id, p_recipe_id);
    
    IF NOT v_can_craft THEN
        RAISE EXCEPTION 'Ingredientes insuficientes: %', v_missing;
    END IF;
    
    -- Obter o ID do equipamento resultado
    SELECT result_equipment_id INTO v_result_equipment_id 
    FROM equipment_crafting_recipes 
    WHERE id = p_recipe_id;
    
    -- Consumir os ingredientes
    FOR r IN (
        SELECT * FROM equipment_crafting_ingredients WHERE recipe_id = p_recipe_id
    ) LOOP
        IF r.item_type = 'monster_drop' THEN
            UPDATE character_drops
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND drop_id = r.item_id;
        ELSIF r.item_type = 'consumable' THEN
            UPDATE character_consumables
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND consumable_id = r.item_id;
        ELSIF r.item_type = 'equipment' THEN
            -- Remover equipamentos específicos (não equipados)
            v_consumed_count := 0;
            FOR equipment_record IN (
                SELECT id 
                FROM character_equipment 
                WHERE character_id = p_character_id 
                AND equipment_id = r.item_id 
                AND is_equipped = false
                LIMIT r.quantity
            ) LOOP
                DELETE FROM character_equipment 
                WHERE id = equipment_record.id;
                v_consumed_count := v_consumed_count + 1;
            END LOOP;
            
            IF v_consumed_count < r.quantity THEN
                RAISE EXCEPTION 'Não foi possível consumir todos os equipamentos necessários';
            END IF;
        END IF;
    END LOOP;
    
    -- Adicionar o equipamento craftado ao inventário
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped)
    VALUES (p_character_id, v_result_equipment_id, false);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamps
CREATE TRIGGER update_equipment_crafting_recipes_updated_at
    BEFORE UPDATE ON equipment_crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_crafting_ingredients_updated_at
    BEFORE UPDATE ON equipment_crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CONFIGURAR RLS (Row Level Security)
-- ========================================

-- equipment_crafting_recipes: leitura pública (dados de referência)
ALTER TABLE equipment_crafting_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de receitas de equipamentos" ON equipment_crafting_recipes
    FOR SELECT 
    USING (true);

-- equipment_crafting_ingredients: leitura pública (dados de referência)
ALTER TABLE equipment_crafting_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de ingredientes de equipamentos" ON equipment_crafting_ingredients
    FOR SELECT 
    USING (true); 