-- Migração para corrigir vulnerabilidades de segurança em funções de personagem
-- Data: 2024-12-02
-- Remove exposição de funções críticas e cria funções seguras específicas

-- =====================================================
-- REMOÇÃO DE FUNÇÕES INSEGURAS
-- =====================================================

-- Remover a função update_character_stats da exposição pública
-- Esta função permite manipulação livre de stats e deve ser apenas interna
DROP FUNCTION IF EXISTS update_character_stats(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

-- =====================================================
-- FUNÇÕES SEGURAS PARA OPERAÇÕES ESPECÍFICAS
-- =====================================================

-- Função SEGURA para atualizar HP e Mana durante gameplay (não exposta via RPC)
CREATE OR REPLACE FUNCTION internal_update_character_hp_mana(
    p_character_id UUID,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Validar limites
    UPDATE characters
    SET
        hp = CASE 
            WHEN p_hp IS NOT NULL THEN LEAST(GREATEST(p_hp, 0), max_hp)
            ELSE hp
        END,
        mana = CASE 
            WHEN p_mana IS NOT NULL THEN LEAST(GREATEST(p_mana, 0), max_mana)
            ELSE mana
        END,
        last_activity = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para ganho de XP (com validação anti-cheat)
CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
    v_max_xp_per_call INTEGER := 10000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    IF p_xp_amount > v_max_xp_per_call THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada (máximo: %)', v_max_xp_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Calcular novo XP
    v_new_xp := v_current_xp + p_xp_amount;
    
    -- Processar level ups
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP -- Cap em level 100
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- Calcular novos stats base
        SELECT 
            derived_hp, derived_max_hp, derived_mana, derived_max_mana,
            derived_atk, derived_def, derived_speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id)
        );
        
        -- Atualizar stats com level up
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.derived_max_hp,
            max_mana = v_base_stats.derived_max_mana,
            atk = v_base_stats.derived_atk,
            def = v_base_stats.derived_def,
            speed = v_base_stats.derived_speed,
            hp = v_base_stats.derived_max_hp, -- Cura completa no level up
            mana = v_base_stats.derived_max_mana, -- Cura completa no level up
            last_activity = NOW()
        WHERE id = p_character_id;
        
        -- Conceder pontos de atributo
        PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
        
        -- Atualizar progressão do usuário
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    ELSE
        -- Apenas atualizar XP
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para ganho de gold (com validação anti-cheat)
CREATE OR REPLACE FUNCTION secure_grant_gold(
    p_character_id UUID,
    p_gold_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS INTEGER AS $$
DECLARE
    v_new_gold INTEGER;
    v_max_gold_per_call INTEGER := 50000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_gold_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de gold deve ser positiva';
    END IF;
    
    IF p_gold_amount > v_max_gold_per_call THEN
        RAISE EXCEPTION 'Quantidade de gold suspeita detectada (máximo: %)', v_max_gold_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'gold_gain', json_build_object('amount', p_gold_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Atualizar gold
    UPDATE characters
    SET
        gold = gold + p_gold_amount,
        last_activity = NOW()
    WHERE id = p_character_id
    RETURNING gold INTO v_new_gold;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para atualizar andar (apenas uma direção - para frente)
CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
BEGIN
    -- Obter andar atual
    SELECT floor INTO v_current_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validar que só pode avançar ou resetar para 1
    IF p_new_floor != 1 AND p_new_floor <= v_current_floor THEN
        RAISE EXCEPTION 'Só é possível avançar andares ou resetar para o andar 1';
    END IF;
    
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN -- Cap de 1000 andares
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- Log da operação
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'floor_change', json_build_object('old_floor', v_current_floor, 'new_floor', p_new_floor), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Atualizar andar
    UPDATE characters
    SET
        floor = p_new_floor,
        last_activity = NOW()
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função pública SEGURA para atualizar apenas last_activity
CREATE OR REPLACE FUNCTION update_character_activity(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE characters
    SET last_activity = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TABELA DE LOG PARA AUDITORIA (OPCIONAL)
-- =====================================================

-- Criar tabela de log de atividades para detectar comportamentos suspeitos
CREATE TABLE IF NOT EXISTS character_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índice para consultas por personagem e data
CREATE INDEX IF NOT EXISTS idx_character_activity_log_character_date 
ON character_activity_log(character_id, created_at DESC);

-- =====================================================
-- CORREÇÕES DE SEGURANÇA PARA MONSTER DROPS
-- =====================================================

-- Remover a função add_monster_drop da exposição pública
-- Esta função permite adicionar drops arbitrários ao inventário
DROP FUNCTION IF EXISTS add_monster_drop(UUID, UUID, INTEGER);

-- Função INTERNA e SEGURA para adicionar drops (não exposta via RPC)
CREATE OR REPLACE FUNCTION internal_add_monster_drop(
    p_character_id UUID,
    p_drop_id UUID,
    p_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_max_quantity_per_drop INTEGER := 50; -- Limite anti-cheat por drop
    v_drop_rarity VARCHAR;
BEGIN
    -- Validações anti-cheat
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    -- Verificar limite por raridade
    SELECT rarity INTO v_drop_rarity FROM monster_drops WHERE id = p_drop_id;
    
    -- Limites mais restritivos para itens raros
    CASE v_drop_rarity
        WHEN 'legendary' THEN v_max_quantity_per_drop := 5;
        WHEN 'epic' THEN v_max_quantity_per_drop := 10;
        WHEN 'rare' THEN v_max_quantity_per_drop := 20;
        WHEN 'uncommon' THEN v_max_quantity_per_drop := 30;
        ELSE v_max_quantity_per_drop := 50; -- common
    END CASE;
    
    IF p_quantity > v_max_quantity_per_drop THEN
        RAISE EXCEPTION 'Quantidade suspeita para % (máximo: %)', v_drop_rarity, v_max_quantity_per_drop;
    END IF;
    
    -- Verificar se o personagem existe
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'drop_received', json_build_object(
        'drop_id', p_drop_id, 
        'quantity', p_quantity, 
        'rarity', v_drop_rarity
    ), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Utilizar padrão UPSERT para evitar problemas de concorrência
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (p_character_id, p_drop_id, p_quantity)
    ON CONFLICT (character_id, drop_id) 
    DO UPDATE SET 
        quantity = character_drops.quantity + EXCLUDED.quantity,
        updated_at = NOW();
EXCEPTION
    WHEN unique_violation THEN
        -- Fallback em caso de condição de corrida
        UPDATE character_drops
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND drop_id = p_drop_id;
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao adicionar drop % para personagem %: %', p_drop_id, p_character_id, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para processar drops de combate (apenas service_role)
CREATE OR REPLACE FUNCTION secure_process_combat_drops(
    p_character_id UUID,
    p_drops JSONB -- Array de {drop_id, quantity}
)
RETURNS INTEGER AS $$
DECLARE
    v_drop RECORD;
    v_drops_processed INTEGER := 0;
    v_max_drops_per_combat INTEGER := 10; -- Limite de drops por combate
    v_total_drops INTEGER;
BEGIN
    -- Contar total de drops
    SELECT jsonb_array_length(p_drops) INTO v_total_drops;
    
    -- Validar limite de drops por combate
    IF v_total_drops > v_max_drops_per_combat THEN
        RAISE EXCEPTION 'Muitos drops por combate (máximo: %)', v_max_drops_per_combat;
    END IF;
    
    -- Processar cada drop
    FOR v_drop IN (
        SELECT 
            (item->>'drop_id')::UUID as drop_id,
            (item->>'quantity')::INTEGER as quantity
        FROM jsonb_array_elements(p_drops) as item
    ) LOOP
        -- Usar função interna segura
        PERFORM internal_add_monster_drop(
            p_character_id,
            v_drop.drop_id,
            v_drop.quantity
        );
        
        v_drops_processed := v_drops_processed + 1;
    END LOOP;
    
    RETURN v_drops_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REVOGAR PERMISSÕES DE FUNÇÕES PERIGOSAS
-- =====================================================

-- Revogar acesso público a funções que devem ser apenas internas
REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_process_combat_drops(UUID, JSONB) FROM PUBLIC;

-- Permitir apenas para service_role
GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO service_role;

-- update_character_activity pode ser pública pois só atualiza timestamp
GRANT EXECUTE ON FUNCTION update_character_activity(UUID) TO authenticated;

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) IS 
'Função interna para atualizar HP/Mana com validação de limites - apenas service_role';

COMMENT ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) IS 
'Função segura para conceder XP com validações anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) IS 
'Função segura para conceder gold com validações anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_advance_floor(UUID, INTEGER) IS 
'Função segura para avançar andares com validação - apenas service_role';

COMMENT ON FUNCTION update_character_activity(UUID) IS 
'Função pública para atualizar timestamp de atividade - sem dados sensíveis';

COMMENT ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) IS 
'Função interna para adicionar drops com validação anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_process_combat_drops(UUID, JSONB) IS 
'Função segura para processar múltiplos drops de combate - apenas service_role';

COMMENT ON TABLE character_activity_log IS 
'Log de atividades dos personagens para detecção de comportamentos suspeitos'; 