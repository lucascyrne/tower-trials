-- ===================================================================================================
-- MIGRAÇÃO: CORREÇÃO DEFINITIVA DO BALANCEAMENTO DE MONSTROS E SISTEMA ANTI-CHEAT
-- ===================================================================================================
-- Data: 2024-12-21
-- Versão: 20241221000012
-- Objetivo: Reset completo para experiência média/difícil equilibrada + correção do sistema anti-cheat

-- PROBLEMAS IDENTIFICADOS:
-- 1. Monstros extremamente fracos (1-hit kill até andar 10)
-- 2. Sistema anti-cheat bloqueando XP legítimo de bosses (437 XP = suspeito)
-- 3. Múltiplas migrações acumulativas criaram inconsistências

-- ===================================================================================================
-- 1. RESET COMPLETO DOS STATS BASE - VALORES EQUILIBRADOS
-- ===================================================================================================

-- FASE 1: Reset para stats base adequados (não extremamente baixos)
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor <= 3 THEN 80    -- Tutorial: ainda desafiador mas vencível
        WHEN min_floor <= 5 THEN 120   -- Pré-checkpoint: requer alguns hits
        WHEN min_floor <= 10 THEN 180  -- Early game: combate médio (3-5 hits)
        WHEN min_floor <= 15 THEN 250  -- Mid game: combate mais longo
        WHEN min_floor <= 20 THEN 320  -- Late early: desafiador
        ELSE 400                       -- End game: muito desafiador
    END;

UPDATE monsters SET 
    atk = CASE 
        WHEN min_floor <= 3 THEN 15    -- Tutorial: dano moderado
        WHEN min_floor <= 5 THEN 28    -- Pré-checkpoint: requer cuidado
        WHEN min_floor <= 10 THEN 36   -- Early game: dano significativo
        WHEN min_floor <= 15 THEN 48   -- Mid game: dano alto
        WHEN min_floor <= 20 THEN 60   -- Late early: dano muito alto
        ELSE 75                        -- End game: dano extremo
    END;

UPDATE monsters SET 
    def = CASE 
        WHEN min_floor <= 3 THEN 5     -- Tutorial: defesa baixa
        WHEN min_floor <= 5 THEN 16     -- Pré-checkpoint: defesa moderada
        WHEN min_floor <= 10 THEN 24   -- Early game: defesa média
        WHEN min_floor <= 15 THEN 32   -- Mid game: defesa alta
        WHEN min_floor <= 20 THEN 40   -- Late early: defesa muito alta
        ELSE 50                        -- End game: defesa extrema
    END;

-- FASE 2: Ajustar bosses para serem 80% mais fortes (não 40% como antes)
UPDATE monsters SET 
    hp = FLOOR(hp * 1.8),
    atk = FLOOR(atk * 1.8),
    def = FLOOR(def * 1.8)
WHERE is_boss = true;

-- FASE 3: Ajustar recompensas proporcionalmente aos stats aumentados
UPDATE monsters SET 
    reward_xp = CASE 
        WHEN min_floor <= 3 THEN GREATEST(15, 15 + min_floor * 8)     -- 15-47 XP
        WHEN min_floor <= 5 THEN GREATEST(20, 20 + min_floor * 12)    -- 20-60 XP  
        WHEN min_floor <= 10 THEN GREATEST(30, 30 + min_floor * 18)   -- 30-108 XP
        WHEN min_floor <= 15 THEN GREATEST(50, 50 + min_floor * 25)  -- 50-150 XP
        WHEN min_floor <= 20 THEN GREATEST(70, 70 + min_floor * 35)  -- 70-245 XP
        ELSE GREATEST(200, 100 + min_floor * 50)                      -- 150+ XP
    END,
    reward_gold = CASE 
        WHEN min_floor <= 3 THEN GREATEST(8, 8 + min_floor * 5)      -- 8-28 Gold
        WHEN min_floor <= 5 THEN GREATEST(12, 12 + min_floor * 8)     -- 12-52 Gold
        WHEN min_floor <= 10 THEN GREATEST(18, 18 + min_floor * 12)   -- 18-138 Gold
        WHEN min_floor <= 15 THEN GREATEST(25, 25 + min_floor * 18)   -- 25-295 Gold  
        WHEN min_floor <= 20 THEN GREATEST(75, 35 + min_floor * 25)   -- 75-535 Gold
        ELSE GREATEST(100, 50 + min_floor * 35)                       -- 85+ Gold
    END;

-- ===================================================================================================
-- 2. FUNÇÃO DE ESCALAMENTO MAIS AGRESSIVA
-- ===================================================================================================

CREATE OR REPLACE FUNCTION scale_monster_stats_balanced_v2(
    p_base_stat DECIMAL,
    p_current_tier INTEGER,
    p_floor_in_tier INTEGER,
    p_scaling_type TEXT DEFAULT 'normal'
) RETURNS INTEGER AS $$
DECLARE
    v_tier_multiplier DECIMAL;
    v_floor_multiplier DECIMAL;
    v_final_stat DECIMAL;
BEGIN
    -- Escalamento por tier mais agressivo: 1.5x ao invés de 1.25x
    v_tier_multiplier := POWER(1.5, GREATEST(0, p_current_tier - 1));
    
    -- Progressão dentro do tier: 3% por andar ao invés de 1.5%
    v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.03);
    
    -- Aplicar escalamento baseado no tipo
    CASE p_scaling_type
        WHEN 'hp' THEN
            -- HP escala mais para survivability
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 1.2;
        WHEN 'attack' THEN
            -- Ataque escala normalmente
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
        WHEN 'defense' THEN
            -- Defesa escala um pouco menos
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 0.9;
        ELSE
            -- Escalamento padrão
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
    END CASE;
    
    RETURN GREATEST(1, FLOOR(v_final_stat));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ===================================================================================================
-- 3. CORRIGIR SISTEMA ANTI-CHEAT - LIMITES REALISTAS
-- ===================================================================================================

-- Função de validação com limites mais realistas
CREATE OR REPLACE FUNCTION validate_xp_gain_realistic(
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
    
    -- Definir limites realistas baseados na fonte e nível
    CASE p_source
        WHEN 'combat' THEN
            -- XP de combate: MUITO mais generoso para permitir bosses
            -- Boss do andar 10 pode dar ~400-600 XP
            v_max_xp_per_source := GREATEST(1000, v_character_level * 80);
        WHEN 'quest' THEN
            -- XP de quest: ainda maior
            v_max_xp_per_source := GREATEST(2000, v_character_level * 150);
        WHEN 'skill' THEN
            -- XP de skill: moderado
            v_max_xp_per_source := GREATEST(200, v_character_level * 25);
        ELSE
            -- Outras fontes: limite conservador mas não restritivo
            v_max_xp_per_source := GREATEST(500, v_character_level * 50);
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
    
    -- Verificar rapidez de ganho - limite mais alto
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
      AND created_at > NOW() - INTERVAL '30 seconds'; -- Janela menor
    
    -- Se ganhou mais de 10x o limite em 30 segundos, pode ser exploit
    IF v_recent_xp_gains > (v_max_xp_per_source * 10) THEN
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

-- ===================================================================================================
-- 4. ATUALIZAR FUNÇÃO SECURE_GRANT_XP COM VALIDAÇÃO CORRIGIDA
-- ===================================================================================================

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
    -- CORREÇÃO: Usar validação realista
    IF NOT validate_xp_gain_realistic(p_character_id, p_xp_amount, p_source) THEN
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
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- Calcular novos stats base
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

-- ===================================================================================================
-- 5. ATUALIZAR FUNÇÃO DE MONSTROS PARA USAR ESCALAMENTO CORRETO
-- ===================================================================================================

CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE(
    id TEXT,
    name TEXT,
    level INTEGER,
    hp INTEGER,
    attack INTEGER,
    defense INTEGER,
    speed INTEGER,
    behavior TEXT,
    mana INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    tier INTEGER,
    base_tier INTEGER,
    cycle_position INTEGER,
    is_boss BOOLEAN,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance DOUBLE PRECISION,
    critical_damage DOUBLE PRECISION,
    critical_resistance DOUBLE PRECISION,
    physical_resistance DOUBLE PRECISION,
    magical_resistance DOUBLE PRECISION,
    debuff_resistance DOUBLE PRECISION,
    physical_vulnerability DOUBLE PRECISION,
    magical_vulnerability DOUBLE PRECISION,
    primary_trait TEXT,
    secondary_trait TEXT,
    special_abilities TEXT[]
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_monster_record RECORD;
    v_tier INTEGER;
    v_floor_in_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
BEGIN
    -- Calcular tier e posição
    v_tier := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_floor_in_tier := p_floor - ((v_tier - 1) * 20);
    
    -- Determinar se é boss
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Buscar monstro adequado
    SELECT * INTO v_monster_record
    FROM monsters 
    WHERE min_floor <= p_floor
    AND COALESCE(is_boss, false) = v_is_boss
    ORDER BY min_floor DESC, RANDOM()
    LIMIT 1;
    
    -- Fallback se não encontrar
    IF v_monster_record.id IS NULL THEN
        SELECT * INTO v_monster_record
        FROM monsters
        WHERE min_floor <= p_floor
        ORDER BY min_floor DESC, RANDOM()
        LIMIT 1;
    END IF;
    
    IF v_monster_record.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- Retornar com escalamento corrigido (v2)
    RETURN QUERY
    SELECT
        v_monster_record.id::TEXT,
        v_monster_record.name::TEXT,
        GREATEST(1, p_floor / 3)::INTEGER as level,
        -- USAR NOVA FUNÇÃO DE ESCALAMENTO
        scale_monster_stats_balanced_v2(v_monster_record.hp, v_tier, v_floor_in_tier, 'hp')::INTEGER as hp,
        scale_monster_stats_balanced_v2(v_monster_record.atk, v_tier, v_floor_in_tier, 'attack')::INTEGER as attack,
        scale_monster_stats_balanced_v2(v_monster_record.def, v_tier, v_floor_in_tier, 'defense')::INTEGER as defense,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.speed, 10), v_tier, v_floor_in_tier)::INTEGER as speed,
        COALESCE(v_monster_record.behavior, 'balanced')::TEXT,
        COALESCE(v_monster_record.mana, 0)::INTEGER,
        COALESCE(v_monster_record.reward_xp, 50)::INTEGER,
        COALESCE(v_monster_record.reward_gold, 25)::INTEGER,
        v_tier,
        COALESCE(v_monster_record.base_tier, 1),
        ((p_floor - 1) % 20 + 1)::INTEGER as cycle_position,
        v_is_boss,
        
        -- Atributos escalados
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.strength, 10), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.dexterity, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.intelligence, 6), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.wisdom, 6), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.vitality, 12), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_balanced_v2(COALESCE(v_monster_record.luck, 5), v_tier, v_floor_in_tier)::INTEGER,
        
        -- Propriedades de combate moderadas
        LEAST(30.0, 8.0 + p_floor * 0.4)::DOUBLE PRECISION as critical_chance,
        LEAST(200.0, 130.0 + p_floor * 1.5)::DOUBLE PRECISION as critical_damage,
        LEAST(20.0, 5.0 + p_floor * 0.3)::DOUBLE PRECISION as critical_resistance,
        LEAST(15.0, 2.0 + p_floor * 0.25)::DOUBLE PRECISION as physical_resistance,
        LEAST(15.0, 2.0 + p_floor * 0.25)::DOUBLE PRECISION as magical_resistance,
        LEAST(25.0, 5.0 + p_floor * 0.4)::DOUBLE PRECISION as debuff_resistance,
        1.0::DOUBLE PRECISION as physical_vulnerability,
        1.0::DOUBLE PRECISION as magical_vulnerability,
        
        -- Traits
        v_monster_record.primary_trait::TEXT,
        v_monster_record.secondary_trait::TEXT,
        COALESCE(v_monster_record.special_abilities, ARRAY[]::TEXT[])::TEXT[];
END;
$$;

-- ===================================================================================================
-- 6. REMOVER FUNÇÕES ANTIGAS
-- ===================================================================================================

DROP FUNCTION IF EXISTS scale_monster_stats_sustainable(DECIMAL, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS validate_xp_gain(UUID, INTEGER, VARCHAR);

-- ===================================================================================================
-- 7. CONFIGURAR PERMISSÕES
-- ===================================================================================================

REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;

GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION scale_monster_stats_balanced_v2(DECIMAL, INTEGER, INTEGER, TEXT) TO authenticated;

-- ===================================================================================================
-- 8. COMENTÁRIOS E LOG FINAL
-- ===================================================================================================

COMMENT ON FUNCTION scale_monster_stats_balanced_v2 IS 
'Escalamento equilibrado: 1.5x por tier + 3% por andar. Stats base aumentados para experiência média/difícil.';

COMMENT ON FUNCTION validate_xp_gain_realistic IS 
'Validação anti-cheat com limites realistas: permite até 80x nível para combat XP.';

COMMENT ON FUNCTION secure_grant_xp IS 
'Função segura para XP com validação corrigida - permite XP normal de bosses.';

-- Log final
DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== CORREÇÃO DEFINITIVA DO BALANCEAMENTO CONCLUÍDA ===';
    RAISE NOTICE 'Stats base corrigidos: HP 80-400, ATK 28-75, DEF 16-50';
    RAISE NOTICE 'Bosses: 80%% mais fortes que monstros normais';
    RAISE NOTICE 'Escalamento: 1.5x por tier + 3%% por andar';
    RAISE NOTICE 'Anti-cheat corrigido: limite combat XP = nível * 80';
    RAISE NOTICE 'Boss andar 10: ~400-600 XP agora permitido';
    RAISE NOTICE '===============================================';
END $$; 