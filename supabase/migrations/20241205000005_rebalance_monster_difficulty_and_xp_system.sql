-- ================================
-- Migração para rebalancear dificuldade dos monstros e corrigir sistema de XP
-- Data: 2024-12-05
-- ================================

-- PROBLEMAS IDENTIFICADOS:
-- 1. Monstros muito fracos mesmo com escalamento (stats base baixos)
-- 2. Possível duplicação de XP no processamento
-- 3. Escalamento de recompensas muito generoso
-- 4. Falta de balanceamento em relação aos stats dos personagens

-- =====================================
-- 1. CORRIGIR ESCALAMENTO DE MONSTROS (MAIS AGRESSIVO)
-- =====================================

-- Função de escalamento mais agressiva para stats
CREATE OR REPLACE FUNCTION scale_monster_stats_balanced(
    p_base_stat DECIMAL,
    p_current_tier INTEGER,
    p_base_tier INTEGER DEFAULT 1,
    p_scaling_factor DECIMAL DEFAULT 1.8,
    p_stat_type TEXT DEFAULT 'normal'
) RETURNS INTEGER AS $$
DECLARE
    v_tier_diff INTEGER;
    v_final_stat DECIMAL;
BEGIN
    -- Calcular diferença de tier
    v_tier_diff := p_current_tier - p_base_tier;
    
    -- Se não há diferença de tier, retornar base
    IF v_tier_diff <= 0 THEN
        RETURN p_base_stat::INTEGER;
    END IF;
    
    -- Escalamento baseado no tipo de stat
    CASE p_stat_type
        WHEN 'hp' THEN
            -- HP escala mais agressivamente (sobrevivência)
            v_final_stat := p_base_stat * POWER(2.2, v_tier_diff);
        WHEN 'attack' THEN
            -- Ataque escala moderadamente (não queremos one-shots)
            v_final_stat := p_base_stat * POWER(1.9, v_tier_diff);
        WHEN 'defense' THEN
            -- Defesa escala moderadamente
            v_final_stat := p_base_stat * POWER(1.7, v_tier_diff);
        WHEN 'reward' THEN
            -- Recompensas escalando de forma controlada
            v_final_stat := p_base_stat * POWER(1.6, v_tier_diff);
        ELSE
            -- Escalamento padrão
            v_final_stat := p_base_stat * POWER(p_scaling_factor, v_tier_diff);
    END CASE;
    
    RETURN GREATEST(1, v_final_stat::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 2. ATUALIZAR STATS BASE DOS MONSTROS (MAIS FORTES)
-- =====================================

-- Aumentar significativamente os stats base dos monstros para ser um desafio real
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor <= 5 THEN hp * 1.8      -- Monstros iniciais 80% mais fortes
        WHEN min_floor <= 10 THEN hp * 2.0     -- Monstros intermediários 100% mais fortes  
        WHEN min_floor <= 15 THEN hp * 2.2     -- Monstros avançados 120% mais fortes
        ELSE hp * 2.5                          -- Monstros end-game 150% mais fortes
    END,
    atk = CASE 
        WHEN min_floor <= 5 THEN atk * 1.5     -- Ataque 50% maior nos iniciais
        WHEN min_floor <= 10 THEN atk * 1.7    -- Ataque 70% maior nos intermediários
        WHEN min_floor <= 15 THEN atk * 1.9    -- Ataque 90% maior nos avançados
        ELSE atk * 2.1                         -- Ataque 110% maior nos end-game
    END,
    def = CASE 
        WHEN min_floor <= 5 THEN def * 1.4     -- Defesa 40% maior nos iniciais
        WHEN min_floor <= 10 THEN def * 1.6    -- Defesa 60% maior nos intermediários
        WHEN min_floor <= 15 THEN def * 1.8    -- Defesa 80% maior nos avançados
        ELSE def * 2.0                         -- Defesa 100% maior nos end-game
    END;

-- =====================================
-- 3. AJUSTAR RECOMPENSAS (MENOS GENEROSAS)
-- =====================================

-- Reduzir recompensas de XP que estavam muito generosas
UPDATE monsters SET 
    reward_xp = CASE 
        WHEN min_floor <= 5 THEN GREATEST(15, reward_xp * 0.4)   -- Reduzir drasticamente XP inicial
        WHEN min_floor <= 10 THEN GREATEST(25, reward_xp * 0.5)  -- Reduzir XP intermediário
        WHEN min_floor <= 15 THEN GREATEST(40, reward_xp * 0.6)  -- Reduzir XP avançado
        ELSE GREATEST(60, reward_xp * 0.7)                       -- Reduzir XP end-game
    END,
    reward_gold = CASE 
        WHEN min_floor <= 5 THEN GREATEST(10, reward_gold * 0.5)  -- Reduzir gold inicial  
        WHEN min_floor <= 10 THEN GREATEST(20, reward_gold * 0.6) -- Reduzir gold intermediário
        WHEN min_floor <= 15 THEN GREATEST(35, reward_gold * 0.7) -- Reduzir gold avançado
        ELSE GREATEST(50, reward_gold * 0.8)                      -- Reduzir gold end-game
    END;

-- =====================================
-- 4. FUNÇÃO DE VALIDAÇÃO DE XP (ANTI-CHEAT)
-- =====================================

-- Função para validar se o XP ganho está dentro dos parâmetros esperados
CREATE OR REPLACE FUNCTION validate_xp_gain(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_character_level INTEGER;
    v_max_xp_per_source INTEGER;
    v_recent_xp_gains INTEGER;
BEGIN
    -- Obter nível do personagem
    SELECT level INTO v_character_level
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Definir limites baseados na fonte e nível
    CASE p_source
        WHEN 'combat' THEN
            -- XP de combate: máximo baseado no nível do personagem
            v_max_xp_per_source := GREATEST(200, v_character_level * 15);
        WHEN 'quest' THEN
            -- XP de quest: pode ser maior
            v_max_xp_per_source := GREATEST(500, v_character_level * 50);
        WHEN 'skill' THEN
            -- XP de skill: menor limite
            v_max_xp_per_source := GREATEST(50, v_character_level * 5);
        ELSE
            -- Outras fontes: limite conservador
            v_max_xp_per_source := GREATEST(100, v_character_level * 10);
    END CASE;
    
    -- Verificar se o XP está dentro do limite
    IF p_xp_amount > v_max_xp_per_source THEN
        -- Logar tentativa suspeita
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'suspicious_xp', json_build_object(
            'amount', p_xp_amount, 
            'source', p_source, 
            'max_allowed', v_max_xp_per_source,
            'character_level', v_character_level
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        RETURN FALSE;
    END IF;
    
    -- Verificar se não há muitos ganhos de XP recentes (possível exploração)
    SELECT COALESCE(SUM(
        CASE 
            WHEN details->>'amount' ~ '^[0-9]+$' 
            THEN (details->>'amount')::INTEGER 
            ELSE 0 
        END
    ), 0) INTO v_recent_xp_gains
    FROM character_activity_log
    WHERE character_id = p_character_id
      AND action = 'xp_gain'
      AND created_at > NOW() - INTERVAL '1 minute';
    
    -- Se ganhou mais de 5x o limite em 1 minuto, pode ser exploit
    IF v_recent_xp_gains > (v_max_xp_per_source * 5) THEN
        -- Logar atividade suspeita
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'rapid_xp_gain', json_build_object(
            'recent_xp', v_recent_xp_gains,
            'new_xp', p_xp_amount,
            'source', p_source
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO SECURE_GRANT_XP COM VALIDAÇÃO
-- =====================================

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
BEGIN
    -- NOVA VALIDAÇÃO: Verificar se o XP é válido
    IF NOT validate_xp_gain(p_character_id, p_xp_amount, p_source) THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada: % (fonte: %)', p_xp_amount, p_source;
    END IF;
    
    -- Validações anti-cheat básicas
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING;
    
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
        -- Calcular novos stats base usando a assinatura atual
        SELECT 
            hp, max_hp, mana, max_mana, atk, def, speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- Atualizar stats com level up
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.max_hp,
            max_mana = v_base_stats.max_mana,
            atk = v_base_stats.atk,
            def = v_base_stats.def,
            speed = v_base_stats.speed,
            hp = v_base_stats.max_hp, -- Cura completa no level up
            mana = v_base_stats.max_mana, -- Cura completa no level up
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

-- =====================================
-- 6. COMENTÁRIOS E FINALIZAÇÃO
-- =====================================

COMMENT ON FUNCTION scale_monster_stats_balanced(DECIMAL, INTEGER, INTEGER, DECIMAL, TEXT) IS 
'Função de escalamento balanceado para stats de monstros com tipos específicos de escalamento';

COMMENT ON FUNCTION validate_xp_gain(UUID, INTEGER, VARCHAR) IS 
'Função de validação anti-cheat para ganhos de XP suspeitos';

-- Migração concluída
-- - Monstros rebalanceados para serem mais desafiadores
-- - Sistema de XP com validação anti-cheat
-- - Recompensas ajustadas para progressão sustentável 