-- Usar a função update_updated_at_column que já existe

-- Criação da tabela de consumíveis
CREATE TABLE IF NOT EXISTS consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('potion', 'elixir', 'antidote', 'buff')),
    effect_value INTEGER NOT NULL,
    price INTEGER NOT NULL,
    level_requirement INTEGER NOT NULL DEFAULT 1,
    craftable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Criação da tabela para consumíveis dos personagens
CREATE TABLE IF NOT EXISTS character_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, consumable_id)
);

-- Função para comprar consumíveis
CREATE OR REPLACE FUNCTION buy_consumable(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o consumível existe
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumível não encontrado';
    END IF;
    
    -- Verificar se o personagem tem ouro suficiente
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    IF v_gold < (v_price * p_quantity) THEN
        RAISE EXCEPTION 'Ouro insuficiente para comprar % unidades', p_quantity;
    END IF;
    
    -- Atualizar o ouro do personagem
    UPDATE characters 
    SET gold = gold - (v_price * p_quantity)
    WHERE id = p_character_id;
    
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

-- Função para usar consumíveis
CREATE OR REPLACE FUNCTION use_consumable(
    p_character_id UUID,
    p_consumable_id UUID
) RETURNS VOID AS $$
DECLARE
    v_quantity INTEGER;
BEGIN
    -- Verificar se o personagem tem o consumível
    SELECT quantity INTO v_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF NOT FOUND OR v_quantity <= 0 THEN
        RAISE EXCEPTION 'Você não possui este item';
    END IF;
    
    -- Reduzir a quantidade
    UPDATE character_consumables
    SET quantity = quantity - 1,
        updated_at = NOW()
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp de updated_at
CREATE TRIGGER update_consumables_updated_at
    BEFORE UPDATE ON consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_consumables_updated_at
    BEFORE UPDATE ON character_consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();