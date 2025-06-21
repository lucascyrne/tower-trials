-- =====================================================
-- MIGRAÇÃO: CORREÇÃO DE CONFLITOS DE FUNÇÕES
-- =====================================================
-- Data: 2024-12-21
-- Versão: 20241221000021
-- 
-- PROBLEMAS CORRIGIDOS:
-- 1. Ambiguidade na coluna is_boss (erro 42702)
-- 2. Função validate_xp_gain_realistic não existe (erro 42883)
-- =====================================================

-- =====================================
-- 1. RECRIAR FUNÇÃO validate_xp_gain_realistic
-- =====================================

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
      AND created_at > NOW() - INTERVAL '30 seconds';
    
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

-- =====================================
-- 2. CORRIGIR AMBIGUIDADE is_boss
-- =====================================

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
) AS $$
BEGIN
    -- ✅ CORREÇÃO: Usar função unificada que não tem ambiguidade
    RETURN QUERY
    SELECT 
        u.id, u.name, u.level, u.hp, u.attack, u.defense, u.speed, u.behavior, u.mana,
        u.reward_xp, u.reward_gold, u.tier, u.base_tier, u.cycle_position, u.is_boss,
        u.strength, u.dexterity, u.intelligence, u.wisdom, u.vitality, u.luck,
        u.critical_chance, u.critical_damage, u.critical_resistance,
        u.physical_resistance, u.magical_resistance, u.debuff_resistance,
        u.physical_vulnerability, u.magical_vulnerability,
        u.primary_trait, u.secondary_trait, u.special_abilities
    FROM get_monster_for_floor_unified(p_floor) u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 3. CORRIGIR FUNÇÃO get_monster_for_floor_unified
-- =====================================

CREATE OR REPLACE FUNCTION get_monster_for_floor_unified(p_floor INTEGER)
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
    is_nemesis BOOLEAN,
    nemesis_type TEXT,
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
AS $$
DECLARE
    v_monster_record RECORD;
    v_tier INTEGER;
    v_floor_in_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
    v_nemesis_result RECORD;
    v_final_hp INTEGER;
    v_final_atk INTEGER;
    v_final_def INTEGER;
    v_final_speed INTEGER;
    v_final_reward_xp INTEGER;
    v_final_reward_gold INTEGER;
BEGIN
    -- Calcular tier e posição
    v_tier := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_floor_in_tier := p_floor - ((v_tier - 1) * 20);
    
    -- Determinar se é boss
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- ✅ CORREÇÃO: Usar alias explícito 'm' para resolver ambiguidade
    SELECT m.* INTO v_monster_record
    FROM monsters m
    WHERE m.min_floor <= p_floor
    AND COALESCE(m.is_boss, false) = v_is_boss
    ORDER BY m.min_floor DESC, RANDOM()
    LIMIT 1;
    
    -- Fallback se não encontrar
    IF v_monster_record.id IS NULL THEN
        SELECT m.* INTO v_monster_record
        FROM monsters m
        WHERE m.min_floor <= p_floor
        ORDER BY m.min_floor DESC, RANDOM()
        LIMIT 1;
    END IF;
    
    IF v_monster_record.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- Gerar modificadores nemesis apenas para não-bosses
    IF v_is_boss THEN
        SELECT FALSE, NULL, 1.0, 1.0, 1.0, 1.0, 1.0 
        INTO v_nemesis_result;
    ELSE
        SELECT * INTO v_nemesis_result FROM generate_nemesis_modifier();
    END IF;
    
    -- Aplicar escalamento unificado + modificadores nemesis
    v_final_hp := scale_monster_stats_unified(
        v_monster_record.hp * COALESCE(v_nemesis_result.hp_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'hp'
    );
    
    v_final_atk := scale_monster_stats_unified(
        v_monster_record.atk * COALESCE(v_nemesis_result.atk_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'attack'
    );
    
    v_final_def := scale_monster_stats_unified(
        v_monster_record.def * COALESCE(v_nemesis_result.def_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'defense'
    );
    
    v_final_speed := scale_monster_stats_unified(
        COALESCE(v_monster_record.speed, 10) + GREATEST(1, p_floor / 3) + v_tier * 2, 
        v_tier, v_floor_in_tier
    );
    
    -- Recompensas com modificadores nemesis
    v_final_reward_xp := FLOOR(
        COALESCE(v_monster_record.reward_xp, 50) * COALESCE(v_nemesis_result.xp_modifier, 1.0)
    );
    
    v_final_reward_gold := FLOOR(
        COALESCE(v_monster_record.reward_gold, 25) * COALESCE(v_nemesis_result.gold_modifier, 1.0)
    );
    
    -- Retornar resultado
    RETURN QUERY
    SELECT
        v_monster_record.id::TEXT,
        CASE 
            WHEN v_nemesis_result.is_nemesis THEN 
                COALESCE(v_nemesis_result.nemesis_type, '') || ' ' || v_monster_record.name
            ELSE v_monster_record.name
        END::TEXT,
        GREATEST(1, p_floor / 3)::INTEGER as level,
        v_final_hp,
        v_final_atk,
        v_final_def,
        v_final_speed,
        COALESCE(v_monster_record.behavior, 'balanced')::TEXT,
        COALESCE(v_monster_record.mana, 0)::INTEGER,
        v_final_reward_xp,
        v_final_reward_gold,
        v_tier,
        COALESCE(v_monster_record.base_tier, 1),
        v_floor_in_tier::INTEGER,
        v_is_boss,
        COALESCE(v_nemesis_result.is_nemesis, FALSE),
        v_nemesis_result.nemesis_type::TEXT,
        
        -- Atributos escalados
        scale_monster_stats_unified(COALESCE(v_monster_record.strength, 10), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_unified(COALESCE(v_monster_record.dexterity, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_unified(COALESCE(v_monster_record.intelligence, 6), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_unified(COALESCE(v_monster_record.wisdom, 6), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_unified(COALESCE(v_monster_record.vitality, 12), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_unified(COALESCE(v_monster_record.luck, 5), v_tier, v_floor_in_tier)::INTEGER,
        
        -- Propriedades de combate escaladas
        LEAST(40.0, 5.0 + v_tier * 2.0 + v_floor_in_tier * 0.5)::DOUBLE PRECISION as critical_chance,
        LEAST(300.0, 150.0 + v_tier * 10.0 + v_floor_in_tier * 2.0)::DOUBLE PRECISION as critical_damage,
        LEAST(30.0, v_tier * 2.0 + (CASE WHEN v_is_boss THEN 10.0 ELSE 5.0 END))::DOUBLE PRECISION as critical_resistance,
        LEAST(25.0, v_tier * 1.5 + (CASE WHEN v_is_boss THEN 5.0 ELSE 2.0 END))::DOUBLE PRECISION as physical_resistance,
        LEAST(25.0, v_tier * 1.5 + (CASE WHEN v_nemesis_result.is_nemesis THEN 5.0 ELSE 2.0 END))::DOUBLE PRECISION as magical_resistance,
        LEAST(40.0, v_tier * 2.5 + (CASE WHEN v_is_boss THEN 15.0 ELSE 5.0 END))::DOUBLE PRECISION as debuff_resistance,
        GREATEST(0.8, 1.0 - v_tier * 0.01)::DOUBLE PRECISION as physical_vulnerability,
        GREATEST(0.8, 1.0 - v_tier * 0.01)::DOUBLE PRECISION as magical_vulnerability,
        
        -- Traits dinâmicos
        CASE 
            WHEN v_is_boss THEN 'boss'
            WHEN v_nemesis_result.is_nemesis THEN 'nemesis'
            WHEN v_tier > 3 THEN 'veteran'
            ELSE 'common'
        END::TEXT as primary_trait,
        
        CASE 
            WHEN v_nemesis_result.is_nemesis THEN LOWER(v_nemesis_result.nemesis_type)
            WHEN v_tier > 5 THEN 'ancient'
            WHEN v_tier > 2 THEN 'experienced'
            ELSE 'basic'
        END::TEXT as secondary_trait,
        
        -- Habilidades especiais dinâmicas
        ARRAY_CAT(
            COALESCE(v_monster_record.special_abilities, ARRAY[]::TEXT[]),
            CASE 
                WHEN v_is_boss THEN ARRAY['Powerful Strike', 'Boss Aura']
                WHEN v_nemesis_result.is_nemesis THEN ARRAY[v_nemesis_result.nemesis_type || ' Mastery']
                ELSE ARRAY[]::TEXT[]
            END ||
            CASE WHEN v_tier > 3 THEN ARRAY['Tier Mastery'] ELSE ARRAY[]::TEXT[] END ||
            CASE WHEN v_tier > 6 THEN ARRAY['Ancient Power'] ELSE ARRAY[]::TEXT[] END
        )::TEXT[];
END;
$$;

-- =====================================
-- 4. CONFIGURAR PERMISSÕES
-- =====================================

GRANT EXECUTE ON FUNCTION validate_xp_gain_realistic(UUID, INTEGER, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor_unified(INTEGER) TO authenticated;

-- =====================================
-- 5. LOG DA CORREÇÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== CORREÇÃO DE CONFLITOS DE FUNÇÕES ===';
    RAISE NOTICE 'Função validate_xp_gain_realistic recriada';
    RAISE NOTICE 'Ambiguidade is_boss corrigida com aliases explícitos';
    RAISE NOTICE 'Função get_monster_for_floor_unified corrigida';
    RAISE NOTICE '===============================================';
END $$; 