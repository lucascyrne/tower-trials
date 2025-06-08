-- Usar a função update_updated_at_column que já existe

-- Criação da tabela de drops de monstros
CREATE TABLE IF NOT EXISTS monster_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0, -- valor de venda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de possíveis drops para cada monstro
CREATE TABLE IF NOT EXISTS monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (drop_chance BETWEEN 0 AND 1), -- 0-1 (0-100%)
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela para inventário de drops dos personagens
CREATE TABLE IF NOT EXISTS character_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);

-- Tabela de receitas de crafting
CREATE TABLE IF NOT EXISTS crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de ingredientes para receitas
CREATE TABLE IF NOT EXISTS crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Função para validar ingredientes
CREATE OR REPLACE FUNCTION validate_crafting_ingredient()
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
CREATE TRIGGER validate_crafting_ingredient_trigger
    BEFORE INSERT OR UPDATE ON crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION validate_crafting_ingredient();

-- Função para obter drops de um monstro
CREATE OR REPLACE FUNCTION get_monster_drops(p_monster_id UUID)
RETURNS TABLE (
    drop_id UUID,
    drop_name VARCHAR,
    drop_chance DOUBLE PRECISION,
    min_quantity INTEGER,
    max_quantity INTEGER,
    rarity VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.id AS drop_id,
        md.name AS drop_name,
        mpd.drop_chance,
        mpd.min_quantity,
        mpd.max_quantity,
        md.rarity
    FROM monster_possible_drops mpd
    JOIN monster_drops md ON mpd.drop_id = md.id
    WHERE mpd.monster_id = p_monster_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar drop ao inventário do personagem
CREATE OR REPLACE FUNCTION add_monster_drop(
    p_character_id UUID,
    p_drop_id UUID,
    p_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o personagem existe (RLS cuidará da permissão)
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Utilizar padrão UPSERT para evitar problemas de concorrência
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (p_character_id, p_drop_id, p_quantity)
    ON CONFLICT (character_id, drop_id) 
    DO UPDATE SET 
        quantity = character_drops.quantity + EXCLUDED.quantity,
        updated_at = NOW();
EXCEPTION
    WHEN unique_violation THEN
        -- Caso ainda ocorra uma violação devido a condições de corrida, tenta novamente com abordagem mais segura
        UPDATE character_drops
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND drop_id = p_drop_id;
    WHEN OTHERS THEN
        -- Registrar o erro para depuração
        RAISE WARNING 'Erro ao adicionar drop % para o personagem %: %', p_drop_id, p_character_id, SQLERRM;
        -- Propagar o erro
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se o personagem pode criar um item
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
    r RECORD;
BEGIN
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
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_all, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um item
CREATE OR REPLACE FUNCTION craft_item(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID AS $$
DECLARE
    v_result_id UUID;
    v_can_craft BOOLEAN;
    v_missing TEXT[];
    r RECORD;
BEGIN
    -- Verificar se pode criar o item
    SELECT * INTO v_can_craft, v_missing FROM check_can_craft(p_character_id, p_recipe_id);
    
    IF NOT v_can_craft THEN
        RAISE EXCEPTION 'Ingredientes insuficientes: %', v_missing;
    END IF;
    
    -- Obter o ID do resultado
    SELECT result_id INTO v_result_id FROM crafting_recipes WHERE id = p_recipe_id;
    
    -- Consumir os ingredientes
    FOR r IN (
        SELECT * FROM crafting_ingredients WHERE recipe_id = p_recipe_id
    ) LOOP
        IF r.item_type = 'monster_drop' THEN
            UPDATE character_drops
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND drop_id = r.item_id;
        ELSIF r.item_type = 'consumable' THEN
            UPDATE character_consumables
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND consumable_id = r.item_id;
        END IF;
    END LOOP;
    
    -- Adicionar o item ao inventário
    PERFORM add_consumable_to_inventory(p_character_id, v_result_id, 1);
END;
$$ LANGUAGE plpgsql;

-- Função auxiliar para adicionar consumível ao inventário
CREATE OR REPLACE FUNCTION add_consumable_to_inventory(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o personagem já tem este consumível
    SELECT quantity INTO v_current_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF FOUND THEN
        -- Atualizar a quantidade
        UPDATE character_consumables
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO character_consumables (character_id, consumable_id, quantity)
        VALUES (p_character_id, p_consumable_id, p_quantity);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para atualizar timestamps
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

CREATE TRIGGER update_crafting_recipes_updated_at
    BEFORE UPDATE ON crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crafting_ingredients_updated_at
    BEFORE UPDATE ON crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CONFIGURAR RLS (Row Level Security)
-- ========================================

-- monster_drops: leitura pública (dados de referência)
ALTER TABLE monster_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de drops" ON monster_drops
    FOR SELECT 
    USING (true);

-- monster_possible_drops: leitura pública (dados de referência)
ALTER TABLE monster_possible_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de possíveis drops" ON monster_possible_drops
    FOR SELECT 
    USING (true);

-- character_drops: acesso apenas ao dono do personagem
ALTER TABLE character_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar drops dos próprios personagens" ON character_drops
    FOR ALL
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- crafting_recipes: leitura pública (dados de referência)
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de receitas" ON crafting_recipes
    FOR SELECT 
    USING (true);

-- crafting_ingredients: leitura pública (dados de referência)
ALTER TABLE crafting_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de ingredientes" ON crafting_ingredients
    FOR SELECT 
    USING (true);

-- Permissões serão gerenciadas automaticamente pelo Supabase 