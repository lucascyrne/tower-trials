-- Migração para sistema de venda de itens do inventário
-- Criada em: 2024-12-22
-- Sistema completo para vender equipamentos, consumíveis e materiais

-- ✅ FUNÇÃO: Vender equipamentos em lote
CREATE OR REPLACE FUNCTION sell_character_equipment_batch(
    p_character_id UUID,
    p_equipment_sales JSONB -- Array de {equipment_id: string, quantity: number}
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
) AS $$
DECLARE
    v_character_gold INTEGER;
    v_total_earnings INTEGER := 0;
    v_items_sold INTEGER := 0;
    v_sale JSONB;
    v_equipment_id UUID;
    v_quantity INTEGER;
    v_equipment_price INTEGER;
    v_equipment_rarity TEXT;
    v_sell_price INTEGER;
    v_character_equipment_count INTEGER;
    v_rarity_multiplier NUMERIC;
BEGIN
    -- Verificar se o personagem existe e obter gold atual
    SELECT gold INTO v_character_gold
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Processar cada venda
    FOR v_sale IN SELECT * FROM jsonb_array_elements(p_equipment_sales)
    LOOP
        v_equipment_id := (v_sale->>'equipment_id')::UUID;
        v_quantity := COALESCE((v_sale->>'quantity')::INTEGER, 1);
        
        -- Verificar se o personagem possui o equipamento
        SELECT COUNT(*) INTO v_character_equipment_count
        FROM character_equipment ce
        WHERE ce.character_id = p_character_id 
        AND ce.equipment_id = v_equipment_id;
        
        IF v_character_equipment_count < v_quantity THEN
            RAISE EXCEPTION 'Quantidade insuficiente do equipamento';
        END IF;
        
        -- Obter preço e raridade do equipamento
        SELECT price, rarity INTO v_equipment_price, v_equipment_rarity
        FROM equipment
        WHERE id = v_equipment_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Equipamento não encontrado';
        END IF;
        
        -- Calcular preço de venda baseado na raridade (anti-exploit)
        v_rarity_multiplier := CASE v_equipment_rarity
            WHEN 'common' THEN 0.25      -- 25% do preço original
            WHEN 'uncommon' THEN 0.30    -- 30% do preço original  
            WHEN 'rare' THEN 0.35        -- 35% do preço original
            WHEN 'epic' THEN 0.40        -- 40% do preço original
            WHEN 'legendary' THEN 0.45   -- 45% do preço original
            ELSE 0.25
        END;
        
        v_sell_price := FLOOR(v_equipment_price * v_rarity_multiplier) * v_quantity;
        
        -- Remover equipamentos (FIFO - primeiro que entrou, primeiro que sai)
        DELETE FROM character_equipment
        WHERE id IN (
            SELECT id FROM character_equipment
            WHERE character_id = p_character_id 
            AND equipment_id = v_equipment_id
            AND is_equipped = false  -- Só vender não equipados
            ORDER BY created_at ASC
            LIMIT v_quantity
        );
        
        -- Verificar quantos foram realmente removidos
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Erro ao remover equipamentos do inventário';
        END IF;
        
        v_total_earnings := v_total_earnings + v_sell_price;
        v_items_sold := v_items_sold + v_quantity;
        
        RAISE NOTICE 'Vendido % x % por % gold', v_quantity, v_equipment_id, v_sell_price;
    END LOOP;
    
    -- Atualizar gold do personagem
    UPDATE characters
    SET gold = gold + v_total_earnings,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Retornar resultados
    SELECT gold INTO v_character_gold FROM characters WHERE id = p_character_id;
    
    total_gold_earned := v_total_earnings;
    items_sold := v_items_sold;
    new_character_gold := v_character_gold;
    
    RETURN QUERY SELECT total_gold_earned, items_sold, new_character_gold;
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO: Vender consumíveis em lote
CREATE OR REPLACE FUNCTION sell_character_consumables_batch(
    p_character_id UUID,
    p_consumable_sales JSONB -- Array de {consumable_id: string, quantity: number}
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
) AS $$
DECLARE
    v_character_gold INTEGER;
    v_total_earnings INTEGER := 0;
    v_items_sold INTEGER := 0;
    v_sale JSONB;
    v_consumable_id UUID;
    v_quantity INTEGER;
    v_consumable_price INTEGER;
    v_sell_price INTEGER;
    v_character_quantity INTEGER;
    v_sell_multiplier NUMERIC := 0.20; -- 20% do preço original (anti-exploit)
BEGIN
    -- Verificar se o personagem existe e obter gold atual
    SELECT gold INTO v_character_gold
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Processar cada venda
    FOR v_sale IN SELECT * FROM jsonb_array_elements(p_consumable_sales)
    LOOP
        v_consumable_id := (v_sale->>'consumable_id')::UUID;
        v_quantity := COALESCE((v_sale->>'quantity')::INTEGER, 1);
        
        -- Verificar se o personagem possui quantidade suficiente
        SELECT quantity INTO v_character_quantity
        FROM character_consumables
        WHERE character_id = p_character_id 
        AND consumable_id = v_consumable_id;
        
        IF NOT FOUND OR v_character_quantity < v_quantity THEN
            RAISE EXCEPTION 'Quantidade insuficiente do consumível';
        END IF;
        
        -- Obter preço do consumível
        SELECT price INTO v_consumable_price
        FROM consumables
        WHERE id = v_consumable_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Consumível não encontrado';
        END IF;
        
        v_sell_price := FLOOR(v_consumable_price * v_sell_multiplier) * v_quantity;
        
        -- Atualizar quantidade ou remover se zerou
        IF v_character_quantity = v_quantity THEN
            DELETE FROM character_consumables
            WHERE character_id = p_character_id 
            AND consumable_id = v_consumable_id;
        ELSE
            UPDATE character_consumables
            SET quantity = quantity - v_quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id 
            AND consumable_id = v_consumable_id;
        END IF;
        
        v_total_earnings := v_total_earnings + v_sell_price;
        v_items_sold := v_items_sold + v_quantity;
        
        RAISE NOTICE 'Vendido % x % por % gold', v_quantity, v_consumable_id, v_sell_price;
    END LOOP;
    
    -- Atualizar gold do personagem
    UPDATE characters
    SET gold = gold + v_total_earnings,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Retornar resultados
    SELECT gold INTO v_character_gold FROM characters WHERE id = p_character_id;
    
    total_gold_earned := v_total_earnings;
    items_sold := v_items_sold;
    new_character_gold := v_character_gold;
    
    RETURN QUERY SELECT total_gold_earned, items_sold, new_character_gold;
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO: Vender materiais (drops) em lote  
CREATE OR REPLACE FUNCTION sell_character_drops_batch(
    p_character_id UUID,
    p_drop_sales JSONB -- Array de {drop_id: string, quantity: number}
) RETURNS TABLE (
    total_gold_earned INTEGER,
    items_sold INTEGER,
    new_character_gold INTEGER
) AS $$
DECLARE
    v_character_gold INTEGER;
    v_total_earnings INTEGER := 0;
    v_items_sold INTEGER := 0;
    v_sale JSONB;
    v_drop_id UUID;
    v_quantity INTEGER;
    v_drop_value INTEGER;
    v_sell_price INTEGER;
    v_character_quantity INTEGER;
BEGIN
    -- Verificar se o personagem existe e obter gold atual
    SELECT gold INTO v_character_gold
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Processar cada venda
    FOR v_sale IN SELECT * FROM jsonb_array_elements(p_drop_sales)
    LOOP
        v_drop_id := (v_sale->>'drop_id')::UUID;
        v_quantity := COALESCE((v_sale->>'quantity')::INTEGER, 1);
        
        -- Verificar se o personagem possui quantidade suficiente
        SELECT quantity INTO v_character_quantity
        FROM character_drops
        WHERE character_id = p_character_id 
        AND drop_id = v_drop_id;
        
        IF NOT FOUND OR v_character_quantity < v_quantity THEN
            RAISE EXCEPTION 'Quantidade insuficiente do material';
        END IF;
        
        -- Obter valor do material
        SELECT value INTO v_drop_value
        FROM monster_drops
        WHERE id = v_drop_id;
        
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Material não encontrado';
        END IF;
        
        v_sell_price := v_drop_value * v_quantity; -- Materiais vendem pelo valor integral
        
        -- Atualizar quantidade ou remover se zerou
        IF v_character_quantity = v_quantity THEN
            DELETE FROM character_drops
            WHERE character_id = p_character_id 
            AND drop_id = v_drop_id;
        ELSE
            UPDATE character_drops
            SET quantity = quantity - v_quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id 
            AND drop_id = v_drop_id;
        END IF;
        
        v_total_earnings := v_total_earnings + v_sell_price;
        v_items_sold := v_items_sold + v_quantity;
        
        RAISE NOTICE 'Vendido % x % por % gold', v_quantity, v_drop_id, v_sell_price;
    END LOOP;
    
    -- Atualizar gold do personagem
    UPDATE characters
    SET gold = gold + v_total_earnings,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Retornar resultados
    SELECT gold INTO v_character_gold FROM characters WHERE id = p_character_id;
    
    total_gold_earned := v_total_earnings;
    items_sold := v_items_sold;
    new_character_gold := v_character_gold;
    
    RETURN QUERY SELECT total_gold_earned, items_sold, new_character_gold;
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO: Calcular preços de venda antes da venda (preview)
CREATE OR REPLACE FUNCTION calculate_sell_prices(
    p_character_id UUID,
    p_item_type TEXT, -- 'equipment', 'consumable', 'drop'
    p_item_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS TABLE (
    can_sell BOOLEAN,
    available_quantity INTEGER,
    unit_sell_price INTEGER,
    total_sell_price INTEGER,
    original_price INTEGER
) AS $$
DECLARE
    v_available_qty INTEGER := 0;
    v_original_price INTEGER := 0;
    v_unit_sell_price INTEGER := 0;
    v_rarity TEXT;
    v_multiplier NUMERIC;
BEGIN
    can_sell := false;
    available_quantity := 0;
    unit_sell_price := 0;
    total_sell_price := 0;
    original_price := 0;
    
    IF p_item_type = 'equipment' THEN
        -- Verificar equipamentos não equipados
        SELECT COUNT(*) INTO v_available_qty
        FROM character_equipment ce
        WHERE ce.character_id = p_character_id 
        AND ce.equipment_id = p_item_id
        AND ce.is_equipped = false;
        
        IF v_available_qty > 0 THEN
            SELECT e.price, e.rarity INTO v_original_price, v_rarity
            FROM equipment e
            WHERE e.id = p_item_id;
            
            v_multiplier := CASE v_rarity
                WHEN 'common' THEN 0.25
                WHEN 'uncommon' THEN 0.30
                WHEN 'rare' THEN 0.35
                WHEN 'epic' THEN 0.40
                WHEN 'legendary' THEN 0.45
                ELSE 0.25
            END;
            
            v_unit_sell_price := FLOOR(v_original_price * v_multiplier);
            can_sell := true;
        END IF;
        
    ELSIF p_item_type = 'consumable' THEN
        SELECT cc.quantity INTO v_available_qty
        FROM character_consumables cc
        WHERE cc.character_id = p_character_id 
        AND cc.consumable_id = p_item_id;
        
        IF v_available_qty > 0 THEN
            SELECT c.price INTO v_original_price
            FROM consumables c
            WHERE c.id = p_item_id;
            
            v_unit_sell_price := FLOOR(v_original_price * 0.20); -- 20%
            can_sell := true;
        END IF;
        
    ELSIF p_item_type = 'drop' THEN
        SELECT cd.quantity INTO v_available_qty
        FROM character_drops cd
        WHERE cd.character_id = p_character_id 
        AND cd.drop_id = p_item_id;
        
        IF v_available_qty > 0 THEN
            SELECT md.value INTO v_original_price
            FROM monster_drops md
            WHERE md.id = p_item_id;
            
            v_unit_sell_price := v_original_price; -- 100% para materiais
            can_sell := true;
        END IF;
    END IF;
    
    available_quantity := COALESCE(v_available_qty, 0);
    unit_sell_price := COALESCE(v_unit_sell_price, 0);
    total_sell_price := LEAST(p_quantity, available_quantity) * unit_sell_price;
    original_price := COALESCE(v_original_price, 0);
    
    RETURN QUERY SELECT can_sell, available_quantity, unit_sell_price, total_sell_price, original_price;
END;
$$ LANGUAGE plpgsql;

-- ✅ COMENTÁRIOS
COMMENT ON FUNCTION sell_character_equipment_batch(UUID, JSONB) IS 
'Vende equipamentos em lote com preços baseados na raridade (25-45% do valor original)';

COMMENT ON FUNCTION sell_character_consumables_batch(UUID, JSONB) IS 
'Vende consumíveis em lote por 20% do valor original';

COMMENT ON FUNCTION sell_character_drops_batch(UUID, JSONB) IS 
'Vende materiais em lote pelo valor integral (100%)';

COMMENT ON FUNCTION calculate_sell_prices(UUID, TEXT, UUID, INTEGER) IS 
'Calcula preços de venda antes da transação para preview'; 