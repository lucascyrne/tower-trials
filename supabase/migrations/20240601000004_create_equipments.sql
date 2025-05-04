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
    -- Equipamentos Comuns (Nível 1-3)
    ('Espada de Ferro', 'Uma espada básica mas confiável', 'weapon', 'common', 1, 5, 0, 0, 1, 150),
    ('Adaga de Bronze', 'Pequena e rápida, boa para iniciantes', 'weapon', 'common', 1, 3, 0, 0, 3, 120),
    ('Varinha de Madeira', 'Canaliza magia básica', 'weapon', 'common', 1, 2, 0, 5, 0, 140),
    
    ('Armadura de Couro', 'Proteção básica de couro resistente', 'armor', 'common', 1, 0, 5, 0, 2, 150),
    ('Túnica de Aprendiz', 'Vestimenta leve com encantamentos básicos', 'armor', 'common', 1, 0, 3, 5, 1, 130),
    ('Vestes Leves', 'Roupas leves que não atrapalham movimentos', 'armor', 'common', 1, 0, 2, 0, 5, 120),
    
    ('Anel de Mana', 'Um anel que aumenta o poder mágico', 'accessory', 'common', 1, 0, 0, 10, 0, 160),
    ('Amuleto de Proteção', 'Oferece uma leve proteção mágica', 'accessory', 'common', 1, 0, 3, 3, 0, 150),
    ('Botas Velozes', 'Botas que melhoram levemente a agilidade', 'accessory', 'common', 1, 0, 0, 0, 5, 140),
    
    -- Equipamentos Incomuns (Nível 5-8)
    ('Espada de Aço', 'Uma espada bem forjada', 'weapon', 'uncommon', 5, 12, 0, 0, 2, 350),
    ('Machado de Batalha', 'Arma pesada com boa capacidade de dano', 'weapon', 'uncommon', 5, 15, 0, 0, -1, 380),
    ('Cajado de Carvalho', 'Canaliza magia com eficiência', 'weapon', 'uncommon', 5, 8, 0, 10, 0, 360),
    
    ('Armadura de Malha', 'Armadura reforçada com anéis de metal', 'armor', 'uncommon', 5, 0, 12, 0, 0, 350),
    ('Manto do Ocultista', 'Manto tecido com fios especiais para magia', 'armor', 'uncommon', 5, 0, 8, 12, 0, 370),
    ('Armadura de Escamas', 'Proteção feita de escamas de répteis', 'armor', 'uncommon', 5, 0, 10, 0, 3, 330),
    
    ('Amuleto Arcano', 'Amplifica o poder mágico', 'accessory', 'uncommon', 5, 0, 0, 20, 0, 390),
    ('Anel de Força', 'Aumenta o poder físico do usuário', 'accessory', 'uncommon', 5, 8, 0, 0, 0, 380),
    ('Braceletes de Defesa', 'Oferecem proteção adicional', 'accessory', 'uncommon', 5, 0, 8, 0, 3, 360),
    
    -- Equipamentos Raros (Nível 10-13)
    ('Lâmina do Dragão', 'Forjada com escamas de dragão', 'weapon', 'rare', 10, 25, 0, 0, 3, 800),
    ('Arco Élficos', 'Arco reforçado com madeira élfica', 'weapon', 'rare', 10, 20, 0, 5, 10, 780),
    ('Cetro Arcano', 'Poderosa arma mágica', 'weapon', 'rare', 10, 15, 0, 25, 0, 850),
    
    ('Armadura de Placas', 'Proteção completa de metal', 'armor', 'rare', 10, 0, 25, 0, -2, 800),
    ('Manto Elemental', 'Manto imbuído com magia elemental', 'armor', 'rare', 10, 5, 15, 15, 0, 830),
    ('Armadura Dracônica', 'Feita de escamas de dragão', 'armor', 'rare', 10, 5, 20, 0, 5, 850),
    
    ('Coroa da Sabedoria', 'Aumenta significativamente o poder mágico', 'accessory', 'rare', 10, 5, 5, 30, 0, 900),
    ('Amuleto do Guardião', 'Oferece grande proteção', 'accessory', 'rare', 10, 0, 20, 10, 0, 880),
    ('Botas Aladas', 'Botas encantadas que aumentam a velocidade', 'accessory', 'rare', 10, 0, 0, 0, 25, 850),
    
    -- Equipamentos Épicos (Nível 15-18)
    ('Espada do Abismo', 'Lâmina forjada nas profundezas do abismo', 'weapon', 'epic', 15, 40, 0, 10, 5, 1800),
    ('Martelo de Titã', 'Arma massiva com poder devastador', 'weapon', 'epic', 15, 50, 0, 0, -5, 1900),
    ('Bastão de Necromante', 'Capaz de canalizar energia necrótica', 'weapon', 'epic', 15, 30, 0, 40, 0, 2000),
    
    ('Armadura de Mithril', 'Forjada com o raro metal mithril', 'armor', 'epic', 15, 5, 40, 0, 5, 1800),
    ('Vestes do Arquimago', 'Vestes imbuídas com magia arcana', 'armor', 'epic', 15, 10, 25, 35, 0, 1900),
    ('Pele de Behemoth', 'Armadura feita da pele de uma criatura lendária', 'armor', 'epic', 15, 10, 35, 0, 10, 2000),
    
    ('Olho de Observador', 'Amuleto feito do olho de uma criatura mística', 'accessory', 'epic', 15, 15, 15, 25, 5, 2100),
    ('Coração Petrificado', 'Concede resistência sobrenatural', 'accessory', 'epic', 15, 0, 35, 15, 0, 2000),
    ('Asas Fantasmagóricas', 'Aumentam drasticamente a mobilidade', 'accessory', 'epic', 15, 10, 0, 10, 35, 1900),
    
    -- Equipamentos Lendários (Nível 20)
    ('Excalibur', 'A lendária espada do rei', 'weapon', 'legendary', 20, 80, 20, 20, 20, 5000),
    ('Mjolnir', 'Martelo forjado por deuses', 'weapon', 'legendary', 20, 100, 0, 0, 10, 5000),
    ('Cajado de Merlin', 'O lendário cajado do maior mago', 'weapon', 'legendary', 20, 50, 10, 80, 10, 5000),
    
    ('Armadura Divina', 'Forjada nos céus, esta armadura é quase impenetrável', 'armor', 'legendary', 20, 20, 80, 20, 0, 5000),
    ('Manto Celestial', 'Manto tecido com a própria luz das estrelas', 'armor', 'legendary', 20, 20, 50, 70, 10, 5000),
    ('Pele de Leviatã', 'Armadura feita da pele do lendário leviatã', 'armor', 'legendary', 20, 30, 70, 0, 30, 5000),
    
    ('Anel do Poder Supremo', 'Um anel para todos dominar', 'accessory', 'legendary', 20, 40, 40, 40, 0, 5000),
    ('Amuleto do Tempo', 'Permite manipular o fluxo do tempo', 'accessory', 'legendary', 20, 20, 20, 20, 60, 5000),
    ('Coração de Fênix', 'Concede poder de regeneração lendário', 'accessory', 'legendary', 20, 30, 30, 50, 20, 5000);

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