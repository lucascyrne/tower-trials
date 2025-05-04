-- Criação da tabela de drops de monstros
CREATE TABLE IF NOT EXISTS monster_drops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0, -- valor de venda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de possíveis drops para cada monstro
CREATE TABLE IF NOT EXISTS monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance FLOAT NOT NULL CHECK (drop_chance BETWEEN 0 AND 1), -- 0-1 (0-100%)
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (monster_id, drop_id)
);

-- Tabela para inventário de drops dos personagens
CREATE TABLE IF NOT EXISTS character_drops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);

-- Tabela de receitas de crafting
CREATE TABLE IF NOT EXISTS crafting_recipes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de ingredientes para receitas
CREATE TABLE IF NOT EXISTS crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Função para obter drops de um monstro
CREATE OR REPLACE FUNCTION get_monster_drops(p_monster_id UUID)
RETURNS TABLE (
    drop_id UUID,
    drop_name VARCHAR(255),
    drop_chance FLOAT,
    min_quantity INTEGER,
    max_quantity INTEGER,
    rarity VARCHAR(50)
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
    -- Verificar se o personagem já tem este drop
    SELECT quantity INTO v_current_quantity
    FROM character_drops
    WHERE character_id = p_character_id AND drop_id = p_drop_id;
    
    IF FOUND THEN
        -- Atualizar a quantidade
        UPDATE character_drops
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND drop_id = p_drop_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO character_drops (character_id, drop_id, quantity)
        VALUES (p_character_id, p_drop_id, p_quantity);
    END IF;
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

-- Inserir drops iniciais
INSERT INTO monster_drops (name, description, rarity, value)
VALUES
    -- Drops comuns (nível 1-5)
    ('Olho de Slime', 'Um olho viscoso de slime verde', 'common', 5),
    ('Gosma Azulada', 'Gosma brilhante de slime azul', 'common', 6),
    ('Dente de Rato', 'Dente afiado de rato gigante', 'common', 4),
    ('Garra de Goblin', 'Pequena garra afiada', 'common', 7),
    ('Escama de Kobold', 'Pequena escama resistente', 'common', 8),
    ('Fragmento de Osso', 'Fragmento de osso de esqueleto', 'common', 6),
    ('Presa de Lobo', 'Presa afiada de um lobo selvagem', 'common', 8),
    ('Glândula Venenosa', 'Glândula de veneno de aranha', 'common', 9),
    
    -- Drops incomuns (nível 6-10)
    ('Presa de Orc', 'Presa grande e pontiaguda', 'uncommon', 12),
    ('Carne Putrefata', 'Pedaço de carne de zumbi', 'uncommon', 14),
    ('Pena de Harpia', 'Pena afiada e colorida', 'uncommon', 15),
    ('Fragmento de Pedra', 'Pedaço do corpo de um golem', 'uncommon', 16),
    ('Orbe Mágico', 'Orbe usado por magos corrompidos', 'uncommon', 18),
    ('Garra de Alpha', 'Garra imponente de lobo alpha', 'uncommon', 15),
    ('Escama de Réptil', 'Escama resistente de basilisco', 'uncommon', 15),
    ('Sangue de Morcego', 'Sangue com propriedades mágicas', 'uncommon', 17),
    ('Lascas Metálicas', 'Lasca de armadura animada', 'uncommon', 16),
    ('Amuleto Corrompido', 'Amuleto usado por druidas corrompidos', 'uncommon', 19),
    
    -- Drops raros (nível 11-15)
    ('Dente de Ogro', 'Dente massivo e intimidador', 'rare', 25),
    ('Chifre de Quimera', 'Chifre mágico de uma quimera', 'rare', 30),
    ('Escama de Hidra', 'Escama resistente a magia', 'rare', 35),
    ('Escama de Dragão Jovem', 'Escama brilhante e valiosa', 'rare', 40),
    ('Essência de Lich', 'Energia mágica condensada', 'rare', 45),
    ('Couro de Troll', 'Pele resistente de troll', 'rare', 30),
    ('Essência Elemental', 'Essência pura de um elemental', 'rare', 40),
    ('Cristal de Gelo', 'Cristal formado de gelo puro', 'rare', 38),
    ('Fragmento de Cristal', 'Fragmento de cristal brilhante', 'rare', 42),
    ('Vial de Energia Necrótica', 'Energia escura engarrafada', 'rare', 45),
    
    -- Drops épicos (nível 16-19)
    ('Escama de Dragão Adulto', 'Escama dura como aço', 'epic', 70),
    ('Núcleo de Pedra', 'Centro de energia de um titã', 'epic', 80),
    ('Coração de Demônio', 'Coração pulsante de um demônio', 'epic', 90),
    ('Núcleo Ancestral', 'Relíquia poderosa de um golem', 'epic', 100),
    ('Essência Demoníaca', 'Essência concentrada de imp', 'epic', 75),
    ('Pedra de Lava', 'Pedra que irradia calor intenso', 'epic', 85),
    ('Espada Fantasma', 'Arma espectral de um cavaleiro', 'epic', 95),
    ('Cristal Glacial', 'Cristal que nunca derrete', 'epic', 105),
    
    -- Drops lendários (nível 20)
    ('Lágrima de Dragão', 'Lágrima cristalizada de um dragão ancião', 'legendary', 200),
    ('Pó de Estrela', 'Pó mágico com brilho de estrela', 'legendary', 250),
    ('Essência Elemental Pura', 'Essência concentrada de dragão elemental', 'legendary', 300);

-- Adicionar drops para todos os monstros da tabela
INSERT INTO monster_possible_drops (monster_id, drop_id, drop_chance, min_quantity, max_quantity)
VALUES
    -- Drops de Monstros Iniciais (Andares 1-5)
    -- Slimes
    ((SELECT id FROM monsters WHERE name = 'Slime Verde'), 
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime'), 0.7, 1, 3),
    ((SELECT id FROM monsters WHERE name = 'Slime Azul'), 
     (SELECT id FROM monster_drops WHERE name = 'Gosma Azulada'), 0.7, 1, 3),
     
    -- Rato Gigante
    ((SELECT id FROM monsters WHERE name = 'Rato Gigante'), 
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato'), 0.6, 1, 4),
     
    -- Goblin
    ((SELECT id FROM monsters WHERE name = 'Goblin'), 
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin'), 0.6, 1, 2),
     
    -- Kobold
    ((SELECT id FROM monsters WHERE name = 'Kobold'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold'), 0.65, 1, 2),
     
    -- Esqueleto
    ((SELECT id FROM monsters WHERE name = 'Esqueleto'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso'), 0.7, 2, 4),
     
    -- Lobo Selvagem
    ((SELECT id FROM monsters WHERE name = 'Lobo Selvagem'), 
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo'), 0.6, 1, 2),
     
    -- Aranha Venenosa
    ((SELECT id FROM monsters WHERE name = 'Aranha Venenosa'), 
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa'), 0.5, 1, 2),

    -- Drops de Monstros Intermediários (Andares 6-10)
    -- Orc
    ((SELECT id FROM monsters WHERE name = 'Orc'), 
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc'), 0.6, 1, 2),
     
    -- Zumbi
    ((SELECT id FROM monsters WHERE name = 'Zumbi'), 
     (SELECT id FROM monster_drops WHERE name = 'Carne Putrefata'), 0.65, 1, 3),
     
    -- Harpia
    ((SELECT id FROM monsters WHERE name = 'Harpia'), 
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia'), 0.6, 2, 4),
     
    -- Golem de Pedra
    ((SELECT id FROM monsters WHERE name = 'Golem de Pedra'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra'), 0.55, 1, 3),
     
    -- Mago Corrompido
    ((SELECT id FROM monsters WHERE name = 'Mago Corrompido'), 
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico'), 0.5, 1, 1),
     
    -- Lobo Alpha
    ((SELECT id FROM monsters WHERE name = 'Lobo Alpha'), 
     (SELECT id FROM monster_drops WHERE name = 'Garra de Alpha'), 0.6, 1, 2),
     
    -- Basilisco
    ((SELECT id FROM monsters WHERE name = 'Basilisco'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 0.65, 2, 4),
     
    -- Morcego Vampírico
    ((SELECT id FROM monsters WHERE name = 'Morcego Vampírico'), 
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego'), 0.55, 1, 2),
     
    -- Armadura Animada
    ((SELECT id FROM monsters WHERE name = 'Armadura Animada'), 
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas'), 0.6, 2, 3),
     
    -- Druida Corrompido
    ((SELECT id FROM monsters WHERE name = 'Druida Corrompido'), 
     (SELECT id FROM monster_drops WHERE name = 'Amuleto Corrompido'), 0.5, 1, 1),

    -- Drops de Monstros Avançados (Andares 11-15)
    -- Ogro
    ((SELECT id FROM monsters WHERE name = 'Ogro'), 
     (SELECT id FROM monster_drops WHERE name = 'Dente de Ogro'), 0.5, 1, 2),
     
    -- Quimera
    ((SELECT id FROM monsters WHERE name = 'Quimera'), 
     (SELECT id FROM monster_drops WHERE name = 'Chifre de Quimera'), 0.45, 1, 1),
     
    -- Hidra
    ((SELECT id FROM monsters WHERE name = 'Hidra'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra'), 0.5, 1, 3),
     
    -- Dragão Jovem
    ((SELECT id FROM monsters WHERE name = 'Dragão Jovem'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Jovem'), 0.4, 1, 2),
     
    -- Lich
    ((SELECT id FROM monsters WHERE name = 'Lich'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência de Lich'), 0.35, 1, 1),
     
    -- Troll da Montanha
    ((SELECT id FROM monsters WHERE name = 'Troll da Montanha'), 
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll'), 0.5, 1, 3),
     
    -- Elementais
    ((SELECT id FROM monsters WHERE name = 'Elemental de Fogo'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 0.4, 1, 2),
    ((SELECT id FROM monsters WHERE name = 'Elemental de Gelo'), 
     (SELECT id FROM monster_drops WHERE name = 'Cristal de Gelo'), 0.4, 1, 2),
     
    -- Golem de Cristal
    ((SELECT id FROM monsters WHERE name = 'Golem de Cristal'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 0.45, 1, 3),
     
    -- Necromante
    ((SELECT id FROM monsters WHERE name = 'Necromante'), 
     (SELECT id FROM monster_drops WHERE name = 'Vial de Energia Necrótica'), 0.35, 1, 1),

    -- Drops de Monstros End-Game (Andares 16-20)
    -- Dragão Adulto
    ((SELECT id FROM monsters WHERE name = 'Dragão Adulto'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 0.35, 1, 2),
     
    -- Titã de Pedra
    ((SELECT id FROM monsters WHERE name = 'Titã de Pedra'), 
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 0.3, 1, 1),
     
    -- Demônio Alado
    ((SELECT id FROM monsters WHERE name = 'Demônio Alado'), 
     (SELECT id FROM monster_drops WHERE name = 'Coração de Demônio'), 0.25, 1, 1),
     
    -- Golem Ancestral
    ((SELECT id FROM monsters WHERE name = 'Golem Ancestral'), 
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 0.25, 1, 1),

    -- Imp
    ((SELECT id FROM monsters WHERE name = 'Imp'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Demoníaca'), 0.3, 1, 1),
     
    -- Golem de Lava
    ((SELECT id FROM monsters WHERE name = 'Golem de Lava'), 
     (SELECT id FROM monster_drops WHERE name = 'Pedra de Lava'), 0.3, 1, 1),
     
    -- Cavaleiro da Morte
    ((SELECT id FROM monsters WHERE name = 'Cavaleiro da Morte'), 
     (SELECT id FROM monster_drops WHERE name = 'Espada Fantasma'), 0.25, 1, 1),
     
    -- Wyrm Glacial
    ((SELECT id FROM monsters WHERE name = 'Wyrm Glacial'), 
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 0.25, 1, 1),
     
    -- Chefes finais com drops lendários (raros)
    ((SELECT id FROM monsters WHERE name = 'Dragão Ancião'), 
     (SELECT id FROM monster_drops WHERE name = 'Lágrima de Dragão'), 0.15, 1, 1),
    ((SELECT id FROM monsters WHERE name = 'Dragão Elemental'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental Pura'), 0.1, 1, 1),
    ((SELECT id FROM monsters WHERE name = 'Dragão Ancião'), 
     (SELECT id FROM monster_drops WHERE name = 'Pó de Estrela'), 0.1, 1, 1);

-- Atualizar as receitas de crafting para incluir novos drops
-- Limpar receitas anteriores (opcional, se quiser criar do zero)
DELETE FROM crafting_ingredients;
DELETE FROM crafting_recipes;

-- Inserir receitas principais de consumíveis
INSERT INTO crafting_recipes (result_id, name)
VALUES 
    -- Poções básicas
    ((SELECT id FROM consumables WHERE name = 'Poção de Vida Média'), 'Receita: Poção de Vida Média'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Vida Grande'), 'Receita: Poção de Vida Grande'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Mana Média'), 'Receita: Poção de Mana Média'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Mana Grande'), 'Receita: Poção de Mana Grande'),
    -- Antídoto e Elixires
    ((SELECT id FROM consumables WHERE name = 'Antídoto'), 'Receita: Antídoto'),
    ((SELECT id FROM consumables WHERE name = 'Elixir de Força'), 'Receita: Elixir de Força'),
    ((SELECT id FROM consumables WHERE name = 'Elixir de Defesa'), 'Receita: Elixir de Defesa');

-- Inserir receitas para desbloquear equipamentos na loja (novidade)
INSERT INTO consumables (name, description, type, effect_value, price, craftable)
VALUES
    -- Pergaminhos para desbloquear equipamentos
    ('Pergaminho de Arma Rara', 'Desbloqueia uma arma rara na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Armadura Rara', 'Desbloqueia uma armadura rara na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Acessório Raro', 'Desbloqueia um acessório raro na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Arma Épica', 'Desbloqueia uma arma épica na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Armadura Épica', 'Desbloqueia uma armadura épica na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Acessório Épico', 'Desbloqueia um acessório épico na loja quando usado', 'elixir', 0, 0, true);

-- Adicionar receitas para desbloquear equipamentos
INSERT INTO crafting_recipes (result_id, name)
VALUES
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Rara'), 'Receita: Pergaminho de Arma Rara'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Rara'), 'Receita: Pergaminho de Armadura Rara'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Raro'), 'Receita: Pergaminho de Acessório Raro'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Épica'), 'Receita: Pergaminho de Arma Épica'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Épica'), 'Receita: Pergaminho de Armadura Épica'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Épico'), 'Receita: Pergaminho de Acessório Épico');

-- Ingredientes para as receitas
INSERT INTO crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Poção de Vida Média (Olho de Slime + Poções Pequenas)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Média'),
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime'), 'monster_drop', 3),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Média'),
     (SELECT id FROM consumables WHERE name = 'Poção de Vida Pequena'), 'consumable', 2),
     
    -- Poção de Vida Grande (Sangue de Morcego + Poções Médias)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Grande'),
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Grande'),
     (SELECT id FROM consumables WHERE name = 'Poção de Vida Média'), 'consumable', 2),
     
    -- Poção de Mana Média (Escama de Réptil + Poções Pequenas)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Média'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 'monster_drop', 3),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Média'),
     (SELECT id FROM consumables WHERE name = 'Poção de Mana Pequena'), 'consumable', 2),
     
    -- Poção de Mana Grande (Fragmento de Cristal + Poções Médias)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Grande'),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Grande'),
     (SELECT id FROM consumables WHERE name = 'Poção de Mana Média'), 'consumable', 2),
     
    -- Antídoto (Glândula Venenosa + Presa de Lobo)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Antídoto'),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Antídoto'),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo'), 'monster_drop', 1),
     
    -- Elixir de Força (Essência Elemental + Escama de Dragão Jovem)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Força'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Força'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Jovem'), 'monster_drop', 1),
     
    -- Elixir de Defesa (Escama de Réptil + Fragmento de Cristal)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Defesa'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Defesa'),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 'monster_drop', 1),
     
    -- RECEITAS PARA DESBLOQUEAR EQUIPAMENTOS NA LOJA
    -- Pergaminho de Arma Rara
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Chifre de Quimera'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia'), 'monster_drop', 3),
     
    -- Pergaminho de Armadura Rara
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll'), 'monster_drop', 2),
     
    -- Pergaminho de Acessório Raro
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Raro'),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Raro'),
     (SELECT id FROM monster_drops WHERE name = 'Amuleto Corrompido'), 'monster_drop', 1),
     
    -- Pergaminho de Arma Épica
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Demoníaca'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Espada Fantasma'), 'monster_drop', 1),
     
    -- Pergaminho de Armadura Épica
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Pedra de Lava'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Coração de Demônio'), 'monster_drop', 1),
     
    -- Pergaminho de Acessório Épico
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Épico'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Épico'),
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 'monster_drop', 1);

-- Criar triggers para atualizar timestamps
CREATE TRIGGER set_updated_at_monster_drops
BEFORE UPDATE ON monster_drops
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_monster_possible_drops
BEFORE UPDATE ON monster_possible_drops
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_character_drops
BEFORE UPDATE ON character_drops
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_crafting_recipes
BEFORE UPDATE ON crafting_recipes
FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

CREATE TRIGGER set_updated_at_crafting_ingredients
BEFORE UPDATE ON crafting_ingredients
FOR EACH ROW EXECUTE PROCEDURE set_updated_at(); 