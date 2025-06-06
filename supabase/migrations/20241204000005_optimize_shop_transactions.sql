-- Migração para otimizar transações da loja
-- Modificar funções de compra para retornar o novo valor de gold

-- Dropar as funções existentes primeiro (necessário para alterar tipo de retorno)
DROP FUNCTION IF EXISTS buy_equipment(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS buy_consumable(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS sell_equipment(UUID, UUID);

-- Função de compra de equipamento que retorna o novo gold
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_character_gold INTEGER;
    v_character_level INTEGER;
    v_equipment_level INTEGER;
    v_equipment_unlocked BOOLEAN;
    v_new_gold INTEGER;
BEGIN
    -- Obter dados do equipamento
    SELECT level_requirement, is_unlocked INTO v_equipment_level, v_equipment_unlocked
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Verificar se o equipamento está desbloqueado
    IF NOT v_equipment_unlocked THEN
        RAISE EXCEPTION 'Este equipamento ainda não foi desbloqueado';
    END IF;
    
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
    
    -- Calcular novo gold
    v_new_gold := v_character_gold - p_price;
    
    -- Deduzir gold do personagem
    UPDATE characters
    SET gold = v_new_gold
    WHERE id = p_character_id;
    
    -- Adicionar equipamento ao inventário do personagem
    INSERT INTO character_equipment (character_id, equipment_id)
    VALUES (p_character_id, p_equipment_id);
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql;

-- Função de compra de consumível que retorna o novo gold
CREATE OR REPLACE FUNCTION buy_consumable(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS INTEGER AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
    v_current_quantity INTEGER;
    v_total_cost INTEGER;
    v_new_gold INTEGER;
BEGIN
    -- Verificar se o consumível existe
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumível não encontrado';
    END IF;
    
    -- Calcular custo total
    v_total_cost := v_price * p_quantity;
    
    -- Verificar se o personagem tem ouro suficiente
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    IF v_gold < v_total_cost THEN
        RAISE EXCEPTION 'Ouro insuficiente para comprar % unidades', p_quantity;
    END IF;
    
    -- Calcular novo gold
    v_new_gold := v_gold - v_total_cost;
    
    -- Atualizar o ouro do personagem
    UPDATE characters 
    SET gold = v_new_gold
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
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql;

-- Função de venda de equipamento que retorna o novo gold
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_price INTEGER;
    v_rarity equipment_rarity;
    v_current_gold INTEGER;
    v_new_gold INTEGER;
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
    
    -- Obter gold atual
    SELECT gold INTO v_current_gold FROM characters WHERE id = p_character_id;
    v_new_gold := v_current_gold + v_price;
    
    -- Adicionar gold ao personagem
    UPDATE characters
    SET gold = v_new_gold
    WHERE id = p_character_id;
    
    -- Remover equipamento do inventário
    DELETE FROM character_equipment
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats após venda
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql; 