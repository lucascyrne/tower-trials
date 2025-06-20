-- ===================================================================================================
-- MIGRAÇÃO: SISTEMA UNIFICADO DE MONSTROS - FONTE ÚNICA DA VERDADE
-- ===================================================================================================
-- Data: 2024-12-21
-- Versão: 20241221000015
-- Objetivo: Implementar sistema unificado que elimina redundâncias entre frontend e backend

-- PROBLEMAS RESOLVIDOS:
-- ❌ Múltiplas fontes da verdade (banco vs frontend)
-- ❌ Lógicas incompatíveis de escalamento
-- ❌ Jogo muito fácil (stats baixos, recompensas altas)
-- ❌ Falta de variabilidade e surpresas

-- SOLUÇÕES IMPLEMENTADAS:
-- ✅ Única fonte da verdade replicada identicamente
-- ✅ Stats base aumentados 30% para dificuldade
-- ✅ Recompensas reduzidas 60-70% para grind mais longo
-- ✅ Sistema de monstros Nemesis (15% chance)
-- ✅ Escalamento agressivo idêntico ao frontend

-- ===================================================================================================
-- 1. ATUALIZAR STATS BASE DOS MONSTROS (IDÊNTICO AO FRONTEND)
-- ===================================================================================================

-- AUMENTAR STATS BASE EM 30% PARA DIFICULDADE + REPLICAR LÓGICA EXATA
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor <= 3 THEN FLOOR(80 * 1.3)    -- Era 80, agora 104
        WHEN min_floor <= 5 THEN FLOOR(120 * 1.3)   -- Era 120, agora 156
        WHEN min_floor <= 10 THEN FLOOR(180 * 1.3)  -- Era 180, agora 234
        WHEN min_floor <= 15 THEN FLOOR(250 * 1.3)  -- Era 250, agora 325
        WHEN min_floor <= 20 THEN FLOOR(320 * 1.3)  -- Era 320, agora 416
        ELSE FLOOR(400 * 1.3)                       -- Era 400, agora 520
    END;

UPDATE monsters SET 
    atk = CASE 
        WHEN min_floor <= 3 THEN FLOOR(15 * 1.3)    -- Era 15, agora 19
        WHEN min_floor <= 5 THEN FLOOR(28 * 1.3)    -- Era 28, agora 36
        WHEN min_floor <= 10 THEN FLOOR(36 * 1.3)   -- Era 36, agora 46
        WHEN min_floor <= 15 THEN FLOOR(48 * 1.3)   -- Era 48, agora 62
        WHEN min_floor <= 20 THEN FLOOR(60 * 1.3)   -- Era 60, agora 78
        ELSE FLOOR(75 * 1.3)                        -- Era 75, agora 97
    END;

UPDATE monsters SET 
    def = CASE 
        WHEN min_floor <= 3 THEN FLOOR(5 * 1.3)     -- Era 5, agora 6
        WHEN min_floor <= 5 THEN FLOOR(16 * 1.3)    -- Era 16, agora 20
        WHEN min_floor <= 10 THEN FLOOR(24 * 1.3)   -- Era 24, agora 31
        WHEN min_floor <= 15 THEN FLOOR(32 * 1.3)   -- Era 32, agora 41
        WHEN min_floor <= 20 THEN FLOOR(40 * 1.3)   -- Era 40, agora 52
        ELSE FLOOR(50 * 1.3)                        -- Era 50, agora 65
    END;

-- ===================================================================================================
-- 2. REDUZIR DRASTICAMENTE RECOMPENSAS (IDÊNTICO AO FRONTEND)
-- ===================================================================================================

-- REDUÇÃO DE 60-70% NAS RECOMPENSAS PARA MAIOR GRIND
UPDATE monsters SET 
    reward_xp = CASE 
        WHEN min_floor <= 3 THEN FLOOR((15 + min_floor * 8) * 0.4)      -- REDUZIDO 60%
        WHEN min_floor <= 5 THEN FLOOR((20 + min_floor * 12) * 0.4)     -- REDUZIDO 60%
        WHEN min_floor <= 10 THEN FLOOR((30 + min_floor * 18) * 0.3)    -- REDUZIDO 70%
        WHEN min_floor <= 15 THEN FLOOR((50 + min_floor * 25) * 0.3)    -- REDUZIDO 70%
        WHEN min_floor <= 20 THEN FLOOR((70 + min_floor * 35) * 0.3)    -- REDUZIDO 70%
        ELSE FLOOR((100 + min_floor * 50) * 0.3)                        -- REDUZIDO 70%
    END,
    reward_gold = CASE 
        WHEN min_floor <= 3 THEN FLOOR((8 + min_floor * 5) * 0.4)       -- REDUZIDO 60%
        WHEN min_floor <= 5 THEN FLOOR((12 + min_floor * 8) * 0.4)      -- REDUZIDO 60%
        WHEN min_floor <= 10 THEN FLOOR((18 + min_floor * 12) * 0.3)    -- REDUZIDO 70%
        WHEN min_floor <= 15 THEN FLOOR((25 + min_floor * 18) * 0.3)    -- REDUZIDO 70%
        WHEN min_floor <= 20 THEN FLOOR((35 + min_floor * 25) * 0.3)    -- REDUZIDO 70%
        ELSE FLOOR((50 + min_floor * 35) * 0.3)                         -- REDUZIDO 70%
    END;

-- BOSSES MANTÊM MULTIPLICADOR MAS COM BASE REDUZIDA
UPDATE monsters SET 
    hp = FLOOR(hp * 1.8),
    atk = FLOOR(atk * 1.8),
    def = FLOOR(def * 1.8),
    reward_xp = FLOOR(reward_xp * 2.5),  -- Bosses ainda dão mais XP
    reward_gold = FLOOR(reward_gold * 2.0)
WHERE is_boss = true;

-- ===================================================================================================
-- 3. FUNÇÃO DE ESCALAMENTO UNIFICADA (REPLICAR FRONTEND)
-- ===================================================================================================

-- Substituir função existente por versão idêntica ao frontend
DROP FUNCTION IF EXISTS scale_monster_stats_unified CASCADE;

CREATE FUNCTION scale_monster_stats_unified(
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
    -- Escalamento por tier mais agressivo: 1.5x ao invés de 1.25x (IDÊNTICO AO FRONTEND)
    v_tier_multiplier := POWER(1.5, GREATEST(0, p_current_tier - 1));
    
    -- Progressão dentro do tier: 3% por andar ao invés de 1.5% (IDÊNTICO AO FRONTEND)
    v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.03);
    
    -- Aplicar escalamento baseado no tipo (IDÊNTICO AO FRONTEND)
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
-- 4. FUNÇÃO PARA GERAR MONSTROS NEMESIS (NOVA FUNCIONALIDADE)
-- ===================================================================================================

-- Função para determinar se um monstro é nemesis (15% chance)
CREATE OR REPLACE FUNCTION generate_nemesis_modifier()
RETURNS TABLE(
    is_nemesis BOOLEAN,
    nemesis_type TEXT,
    hp_modifier DECIMAL,
    atk_modifier DECIMAL,
    def_modifier DECIMAL,
    xp_modifier DECIMAL,
    gold_modifier DECIMAL
) AS $$
DECLARE
    v_nemesis_roll DECIMAL := RANDOM();
    v_nemesis_type_roll INTEGER;
BEGIN
    -- 15% de chance de nemesis
    IF v_nemesis_roll > 0.15 THEN
        RETURN QUERY SELECT FALSE, NULL::TEXT, 1.0::DECIMAL, 1.0::DECIMAL, 1.0::DECIMAL, 1.0::DECIMAL, 1.0::DECIMAL;
        RETURN;
    END IF;
    
    -- Escolher tipo de nemesis aleatoriamente
    v_nemesis_type_roll := FLOOR(RANDOM() * 4) + 1;
    
    CASE v_nemesis_type_roll
        WHEN 1 THEN -- Berserker: Ataque devastador, defesa baixa
            RETURN QUERY SELECT TRUE, 'Berserker'::TEXT, 0.8::DECIMAL, 2.5::DECIMAL, 0.4::DECIMAL, 1.8::DECIMAL, 1.5::DECIMAL;
        WHEN 2 THEN -- Fortress: Defesa impenetrável, ataque baixo  
            RETURN QUERY SELECT TRUE, 'Fortress'::TEXT, 2.0::DECIMAL, 0.6::DECIMAL, 3.0::DECIMAL, 1.6::DECIMAL, 1.3::DECIMAL;
        WHEN 3 THEN -- Specter: Muito HP, stats normais
            RETURN QUERY SELECT TRUE, 'Specter'::TEXT, 3.5::DECIMAL, 1.0::DECIMAL, 1.0::DECIMAL, 2.2::DECIMAL, 1.8::DECIMAL;
        WHEN 4 THEN -- Assassin: Balanceado mas alto
            RETURN QUERY SELECT TRUE, 'Assassin'::TEXT, 1.8::DECIMAL, 1.8::DECIMAL, 1.8::DECIMAL, 2.0::DECIMAL, 1.6::DECIMAL;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- ===================================================================================================
-- 5. ATUALIZAR FUNÇÃO PRINCIPAL DE MONSTROS COM SISTEMA UNIFICADO
-- ===================================================================================================

-- Atualizar função principal para usar lógica unificada
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
    -- Calcular tier e posição (IDÊNTICO AO FRONTEND)
    v_tier := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_floor_in_tier := p_floor - ((v_tier - 1) * 20);
    
    -- Determinar se é boss (IDÊNTICO AO FRONTEND)
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Buscar monstro base adequado
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
    
    -- Gerar modificadores nemesis apenas para não-bosses (IDÊNTICO AO FRONTEND)
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
    
    -- Retornar com sistema unificado
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

-- ===================================================================================================
-- 6. CONFIGURAR PERMISSÕES E SUBSTITUIR FUNÇÃO ANTIGA
-- ===================================================================================================

-- Conceder permissões
GRANT EXECUTE ON FUNCTION get_monster_for_floor_unified(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION scale_monster_stats_unified(DECIMAL, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_nemesis_modifier() TO authenticated;

-- Criar alias para manter compatibilidade com o frontend
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(INTEGER) CASCADE;
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
    -- Simplesmente chamar a função unificada, omitindo campos específicos de nemesis
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

GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;

-- ===================================================================================================
-- 7. REMOVER FUNÇÕES ANTIGAS E DUPLICADAS
-- ===================================================================================================

-- Limpar funções antigas para evitar confusão
DROP FUNCTION IF EXISTS scale_monster_stats_balanced_v2(DECIMAL, INTEGER, INTEGER, TEXT);
DROP FUNCTION IF EXISTS validate_xp_gain_realistic(UUID, INTEGER, VARCHAR);

-- ===================================================================================================
-- 8. COMENTÁRIOS E LOG FINAL
-- ===================================================================================================

COMMENT ON FUNCTION scale_monster_stats_unified IS 
'Função de escalamento unificada: idêntica ao frontend. Elimina redundâncias entre banco e código.';

COMMENT ON FUNCTION generate_nemesis_modifier IS 
'Sistema de monstros Nemesis: 15% chance de spawn com características extremas para surpreender jogadores.';

COMMENT ON FUNCTION get_monster_for_floor_unified IS 
'Função unificada principal: incorpora sistema nemesis, dificuldade aumentada e recompensas reduzidas.';

-- Log final da migração
DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== SISTEMA UNIFICADO DE MONSTROS IMPLEMENTADO ===';
    RAISE NOTICE 'Stats base aumentados 30%% para dificuldade';
    RAISE NOTICE 'Recompensas reduzidas 60-70%% para grind mais longo';
    RAISE NOTICE 'Sistema Nemesis: 15%% chance, 4 tipos diferentes';
    RAISE NOTICE 'Única fonte da verdade: frontend = backend';
    RAISE NOTICE 'Função unificada: get_monster_for_floor_unified()';
    RAISE NOTICE '===============================================';
END $$; 