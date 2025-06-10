-- Migração para corrigir problemas no sistema de crafting
-- Timestamp: 20241220000007

-- Primeiro, vamos adicionar uma coluna de descrição para as receitas se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='crafting_recipes' AND column_name='description') THEN
        ALTER TABLE crafting_recipes ADD COLUMN description TEXT NOT NULL DEFAULT '';
    END IF;
END $$;

-- Função melhorada para verificar se o personagem pode criar um item
CREATE OR REPLACE FUNCTION check_can_craft(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
) AS $$
DECLARE
    v_missing TEXT[] := '{}';
    v_has_all BOOLEAN := TRUE;
    v_recipe_exists BOOLEAN;
    r RECORD;
BEGIN
    -- Verificar se a receita existe
    SELECT EXISTS(SELECT 1 FROM crafting_recipes WHERE id = p_recipe_id) INTO v_recipe_exists;
    
    IF NOT v_recipe_exists THEN
        RETURN QUERY SELECT FALSE, ARRAY['Receita não encontrada'];
        RETURN;
    END IF;

    -- Para cada ingrediente na receita
    FOR r IN (
        SELECT ci.*, md.name AS drop_name, c.name AS consumable_name
        FROM crafting_ingredients ci
        LEFT JOIN monster_drops md ON ci.item_type = 'monster_drop' AND ci.item_id = md.id
        LEFT JOIN consumables c ON ci.item_type = 'consumable' AND ci.item_id = c.id
        WHERE ci.recipe_id = p_recipe_id
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
                v_missing := array_append(v_missing, COALESCE(r.drop_name, 'Drop desconhecido') || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'consumable' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_consumables
                WHERE character_id = p_character_id
                AND consumable_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, COALESCE(r.consumable_name, 'Consumível desconhecido') || ' (x' || r.quantity || ')');
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_all, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Função melhorada para criar um item com validações
CREATE OR REPLACE FUNCTION craft_item(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID AS $$
DECLARE
    v_result_id UUID;
    v_can_craft BOOLEAN;
    v_missing TEXT[];
    v_character_exists BOOLEAN;
    v_recipe_exists BOOLEAN;
    r RECORD;
BEGIN
    -- Verificar se o personagem existe
    SELECT EXISTS(SELECT 1 FROM characters WHERE id = p_character_id) INTO v_character_exists;
    IF NOT v_character_exists THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Verificar se a receita existe
    SELECT EXISTS(SELECT 1 FROM crafting_recipes WHERE id = p_recipe_id) INTO v_recipe_exists;
    IF NOT v_recipe_exists THEN
        RAISE EXCEPTION 'Receita não encontrada';
    END IF;

    -- Obter o ID do resultado e verificar se é válido
    SELECT result_id INTO v_result_id FROM crafting_recipes WHERE id = p_recipe_id;
    
    IF v_result_id IS NULL THEN
        RAISE EXCEPTION 'Receita inválida: resultado não definido';
    END IF;

    -- Verificar se o consumível resultado existe
    IF NOT EXISTS (SELECT 1 FROM consumables WHERE id = v_result_id) THEN
        RAISE EXCEPTION 'Consumível resultado não encontrado: %', v_result_id;
    END IF;
    
    -- Verificar se pode criar o item
    SELECT * INTO v_can_craft, v_missing FROM check_can_craft(p_character_id, p_recipe_id);
    
    IF NOT v_can_craft THEN
        RAISE EXCEPTION 'Ingredientes insuficientes: %', array_to_string(v_missing, ', ');
    END IF;
    
    -- Consumir os ingredientes
    FOR r IN (
        SELECT * FROM crafting_ingredients WHERE recipe_id = p_recipe_id
    ) LOOP
        IF r.item_type = 'monster_drop' THEN
            UPDATE character_drops
            SET quantity = quantity - r.quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id AND drop_id = r.item_id;
            
            -- Verificar se a atualização afetou alguma linha
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha ao consumir drop: %', r.item_id;
            END IF;
            
        ELSIF r.item_type = 'consumable' THEN
            UPDATE character_consumables
            SET quantity = quantity - r.quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id AND consumable_id = r.item_id;
            
            -- Verificar se a atualização afetou alguma linha
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha ao consumir consumível: %', r.item_id;
            END IF;
        END IF;
    END LOOP;
    
    -- Remover itens com quantidade zero
    DELETE FROM character_drops 
    WHERE character_id = p_character_id AND quantity <= 0;
    
    DELETE FROM character_consumables 
    WHERE character_id = p_character_id AND quantity <= 0;
    
    -- Adicionar o item ao inventário
    PERFORM add_consumable_to_inventory(p_character_id, v_result_id, 1);
    
    RAISE NOTICE 'Item criado com sucesso para o personagem %', p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função melhorada para adicionar consumível ao inventário
CREATE OR REPLACE FUNCTION add_consumable_to_inventory(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_quantity INTEGER := 0;
BEGIN
    -- Validar parâmetros
    IF p_character_id IS NULL THEN
        RAISE EXCEPTION 'ID do personagem não pode ser NULL';
    END IF;
    
    IF p_consumable_id IS NULL THEN
        RAISE EXCEPTION 'ID do consumível não pode ser NULL';
    END IF;
    
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    -- Verificar se o personagem existe
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Verificar se o consumível existe
    IF NOT EXISTS (SELECT 1 FROM consumables WHERE id = p_consumable_id) THEN
        RAISE EXCEPTION 'Consumível não encontrado: %', p_consumable_id;
    END IF;
    
    -- Usar UPSERT (INSERT ... ON CONFLICT) para evitar problemas de concorrência
    INSERT INTO character_consumables (character_id, consumable_id, quantity)
    VALUES (p_character_id, p_consumable_id, p_quantity)
    ON CONFLICT (character_id, consumable_id) 
    DO UPDATE SET 
        quantity = character_consumables.quantity + EXCLUDED.quantity,
        updated_at = NOW();
        
    RAISE NOTICE 'Adicionado % unidades do consumível % ao inventário do personagem %', 
                 p_quantity, p_consumable_id, p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para validar integridade das receitas
CREATE OR REPLACE FUNCTION validate_crafting_recipes()
RETURNS TABLE (
    recipe_id UUID,
    recipe_name VARCHAR,
    issue TEXT
) AS $$
BEGIN
    -- Verificar receitas com result_id NULL
    RETURN QUERY
    SELECT 
        cr.id,
        cr.name,
        'result_id é NULL'::TEXT
    FROM crafting_recipes cr
    WHERE cr.result_id IS NULL;
    
    -- Verificar receitas com result_id inválido
    RETURN QUERY
    SELECT 
        cr.id,
        cr.name,
        'consumível resultado não existe'::TEXT
    FROM crafting_recipes cr
    WHERE cr.result_id IS NOT NULL 
    AND NOT EXISTS (SELECT 1 FROM consumables WHERE id = cr.result_id);
    
    -- Verificar ingredientes inválidos
    RETURN QUERY
    SELECT 
        cr.id,
        cr.name,
        'ingrediente inválido: ' || ci.item_type || ' ' || ci.item_id
    FROM crafting_recipes cr
    JOIN crafting_ingredients ci ON cr.id = ci.recipe_id
    WHERE (ci.item_type = 'monster_drop' AND NOT EXISTS (SELECT 1 FROM monster_drops WHERE id = ci.item_id))
    OR (ci.item_type = 'consumable' AND NOT EXISTS (SELECT 1 FROM consumables WHERE id = ci.item_id));
END;
$$ LANGUAGE plpgsql;

-- Adicionar constraint para garantir que result_id não seja NULL
ALTER TABLE crafting_recipes 
ALTER COLUMN result_id SET NOT NULL;

-- Adicionar indexes para melhor performance
CREATE INDEX IF NOT EXISTS idx_character_drops_character_drop 
ON character_drops(character_id, drop_id);

CREATE INDEX IF NOT EXISTS idx_character_consumables_character_consumable 
ON character_consumables(character_id, consumable_id);

CREATE INDEX IF NOT EXISTS idx_crafting_ingredients_recipe 
ON crafting_ingredients(recipe_id);

CREATE INDEX IF NOT EXISTS idx_monster_possible_drops_monster 
ON monster_possible_drops(monster_id);

-- Comentários para documentação
COMMENT ON FUNCTION craft_item(UUID, UUID) IS 'Função para criar um item através de crafting com validações completas';
COMMENT ON FUNCTION add_consumable_to_inventory(UUID, UUID, INTEGER) IS 'Função para adicionar consumível ao inventário com validações';
COMMENT ON FUNCTION check_can_craft(UUID, UUID) IS 'Função para verificar se um personagem pode criar um item';
COMMENT ON FUNCTION validate_crafting_recipes() IS 'Função para validar integridade das receitas de crafting'; 