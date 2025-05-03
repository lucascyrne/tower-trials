-- Criar enum para tipos de equipamento
CREATE TYPE equipment_type AS ENUM (
    'weapon',    -- Armas
    'armor',     -- Armaduras
    'accessory'  -- Acessórios
);

-- Criar enum para raridades
CREATE TYPE equipment_rarity AS ENUM (
    'common',    -- Comum
    'uncommon',  -- Incomum
    'rare',      -- Raro
    'epic',      -- Épico
    'legendary'  -- Lendário
);

-- Criar tabela de equipamentos
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    price INTEGER NOT NULL CHECK (price > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar tabela de equipamentos do personagem
CREATE TABLE IF NOT EXISTS character_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_equipment_updated_at
    BEFORE UPDATE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Inserir alguns equipamentos iniciais
INSERT INTO equipment (name, description, type, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, price) VALUES
    ('Espada de Ferro', 'Uma espada básica mas confiável', 'weapon', 'common', 1, 5, 0, 0, 1, 100),
    ('Armadura de Couro', 'Proteção básica de couro resistente', 'armor', 'common', 1, 0, 5, 0, 5, 100),
    ('Anel de Mana', 'Um anel que aumenta o poder mágico', 'accessory', 'common', 1, 0, 0, 10, 1, 100),
    
    ('Espada de Aço', 'Uma espada bem forjada', 'weapon', 'uncommon', 5, 10, 0, 0, 5, 250),
    ('Armadura de Malha', 'Armadura reforçada com anéis de metal', 'armor', 'uncommon', 5, 0, 10, 0, 10, 250),
    ('Amuleto Arcano', 'Amplifica o poder mágico', 'accessory', 'uncommon', 5, 0, 0, 20, 1, 250),
    
    ('Lâmina do Dragão', 'Forjada com escamas de dragão', 'weapon', 'rare', 10, 20, 0, 0, 10, 500),
    ('Armadura de Placas', 'Proteção completa de metal', 'armor', 'rare', 10, 0, 20, 0, 15, 200),
    ('Coroa da Sabedoria', 'Aumenta significativamente o poder mágico', 'accessory', 'rare', 10, 5, 5, 30, 10, 200);

-- Função para equipar/desequipar item
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_equipment_type equipment_type;
BEGIN
    -- Obter tipo do equipamento
    SELECT type INTO v_equipment_type
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Se for para equipar, desequipar item do mesmo tipo primeiro
    IF p_equip THEN
        UPDATE character_equipment ce
        SET is_equipped = false
        FROM equipment e
        WHERE ce.equipment_id = e.id
        AND ce.character_id = p_character_id
        AND e.type = v_equipment_type
        AND ce.is_equipped = true;
    END IF;
    
    -- Equipar/desequipar o item selecionado
    UPDATE character_equipment
    SET is_equipped = p_equip
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Função para comprar equipamento
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS VOID AS $$
DECLARE
    v_character_gold INTEGER;
    v_character_level INTEGER;
    v_equipment_level INTEGER;
BEGIN
    -- Verificar se o personagem tem gold suficiente
    SELECT gold, level INTO v_character_gold, v_character_level
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem tem nível suficiente
    SELECT level_requirement INTO v_equipment_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    IF v_character_gold < p_price THEN
        RAISE EXCEPTION 'Gold insuficiente para comprar o equipamento';
    END IF;
    
    IF v_character_level < v_equipment_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento';
    END IF;
    
    -- Deduzir gold do personagem
    UPDATE characters
    SET gold = gold - p_price
    WHERE id = p_character_id;
    
    -- Adicionar equipamento ao inventário do personagem
    INSERT INTO character_equipment (character_id, equipment_id)
    VALUES (p_character_id, p_equipment_id);
END;
$$ LANGUAGE plpgsql;

-- Função para vender equipamento
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
BEGIN
    -- Obter preço do equipamento (50% do valor original)
    SELECT price/2 INTO v_price
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Adicionar gold ao personagem
    UPDATE characters
    SET gold = gold + v_price
    WHERE id = p_character_id;
    
    -- Remover equipamento do inventário
    DELETE FROM character_equipment
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
END;
$$ LANGUAGE plpgsql; 