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
    v_equipment_type equipment_type;
    v_equipment_rarity equipment_rarity;
    v_has_unlock BOOLEAN := FALSE;
BEGIN
    -- Obter dados do equipamento
    SELECT level_requirement, type, rarity INTO v_equipment_level, v_equipment_type, v_equipment_rarity
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Verificar se o personagem tem gold suficiente
    SELECT gold, level INTO v_character_gold, v_character_level
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem tem nível suficiente
    IF v_character_level < v_equipment_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento';
    END IF;
    
    -- Verificar gold
    IF v_character_gold < p_price THEN
        RAISE EXCEPTION 'Gold insuficiente para comprar o equipamento';
    END IF;
    
    -- Verificar se precisa de desbloqueio especial (raros e épicos)
    IF v_equipment_rarity = 'rare' OR v_equipment_rarity = 'epic' THEN
        -- Para equipamentos raros, verificar se usou o pergaminho correspondente
        IF v_equipment_rarity = 'rare' THEN
            -- Verificar se usou o pergaminho específico para o tipo
            IF v_equipment_type = 'weapon' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Rara')
                    AND quantity = 0 -- Quando usado, quantidade fica 0 mas o registro permanece
                ) INTO v_has_unlock;
            ELSIF v_equipment_type = 'armor' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Rara')
                    AND quantity = 0
                ) INTO v_has_unlock;
            ELSIF v_equipment_type = 'accessory' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Raro')
                    AND quantity = 0
                ) INTO v_has_unlock;
            END IF;
        -- Para equipamentos épicos, verificar pergaminho épico
        ELSIF v_equipment_rarity = 'epic' THEN
            IF v_equipment_type = 'weapon' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Épica')
                    AND quantity = 0
                ) INTO v_has_unlock;
            ELSIF v_equipment_type = 'armor' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Épica')
                    AND quantity = 0
                ) INTO v_has_unlock;
            ELSIF v_equipment_type = 'accessory' THEN
                SELECT EXISTS (
                    SELECT 1 FROM character_consumables 
                    WHERE character_id = p_character_id 
                    AND consumable_id = (SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Épico')
                    AND quantity = 0
                ) INTO v_has_unlock;
            END IF;
        END IF;
        
        -- Verificar se tem o desbloqueio necessário
        IF NOT v_has_unlock AND v_equipment_rarity != 'legendary' THEN
            RAISE EXCEPTION 'Este equipamento precisa ser desbloqueado com um pergaminho especial';
        END IF;
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
    v_rarity equipment_rarity;
BEGIN
    -- Obter preço e raridade do equipamento
    SELECT price, rarity INTO v_price, v_rarity
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Ajustar valor de venda com base na raridade (para balancear a economia)
    -- Equipamentos mais raros têm um melhor retorno percentual
    CASE v_rarity
        WHEN 'common' THEN v_price := v_price * 0.3;
        WHEN 'uncommon' THEN v_price := v_price * 0.35;
        WHEN 'rare' THEN v_price := v_price * 0.4;
        WHEN 'epic' THEN v_price := v_price * 0.45;
        WHEN 'legendary' THEN v_price := v_price * 0.5;
    END CASE;
    
    -- Arredondar para inteiro
    v_price := FLOOR(v_price);
    
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