-- =====================================================
-- MIGRAÇÃO: REFINAMENTO DO BALANCEAMENTO EARLY GAME
-- =====================================================
-- Data: 2024-12-21
-- Versão: 20241221000019
-- 
-- OBJETIVO: Reduzir em 40% o HP dos monstros dos andares 1-10
-- para tornar o early game mais acessível aos jogadores iniciantes
--
-- CONTEXTO:
-- - Dano balanceado: Personagem nível 1 = 13 dano, Monstro = 13 dano ✅
-- - HP desbalanceado: Personagem = 80 HP, Monstro = 104+ HP ❌
-- - Solução: Reduzir HP dos monstros iniciais em 40% para criar progressão suave
--
-- RESULTADO ESPERADO:
-- - Monstros andares 1-3: HP ~62-70 (era 104-156)
-- - Monstros andares 4-6: HP ~75-95 (era 125-160) 
-- - Monstros andares 7-10: HP ~100-140 (era 167-234)
-- =====================================================

-- =====================================
-- 1. REDUÇÃO PRECISA DO HP DOS MONSTROS EARLY GAME
-- =====================================

-- Monstros Andares 1-3: Redução de 40% do HP atual
UPDATE monsters 
SET hp = FLOOR(hp * 0.6)  -- Reduzir 40% = multiplicar por 0.6
WHERE min_floor >= 1 AND min_floor <= 3;

-- Monstros Andares 4-6: Redução de 35% (transição gradual)
UPDATE monsters 
SET hp = FLOOR(hp * 0.65)  -- Reduzir 35% = multiplicar por 0.65
WHERE min_floor >= 4 AND min_floor <= 6;

-- Monstros Andares 7-10: Redução de 30% (preparação para mid game)
UPDATE monsters 
SET hp = FLOOR(hp * 0.7)  -- Reduzir 30% = multiplicar por 0.7
WHERE min_floor >= 7 AND min_floor <= 10;

-- =====================================
-- 2. VERIFICAR E AJUSTAR VALORES MÍNIMOS
-- =====================================

-- Garantir que nenhum monstro tenha HP menor que 30
UPDATE monsters 
SET hp = GREATEST(hp, 30)
WHERE min_floor <= 10;

-- =====================================
-- 3. RECALIBRAR RECOMPENSAS PROPORCIONALMENTE
-- =====================================

-- Ajustar recompensas de XP para compensar a redução de dificuldade
-- Reduzir XP em 15% para manter progressão balanceada
UPDATE monsters 
SET reward_xp = FLOOR(reward_xp * 0.85)
WHERE min_floor <= 10;

-- Manter recompensas de gold inalteradas (jogadores precisam de recursos)
-- O gold permanece o mesmo para facilitar compra de equipamentos e poções

-- =====================================
-- 4. AJUSTAR BOSSES DOS ANDARES INICIAIS
-- =====================================

-- Bosses dos andares 5 e 10 também devem ser reduzidos, mas menos drasticamente
-- Redução de 25% apenas para manter o desafio de boss
UPDATE monsters 
SET hp = FLOOR(hp * 0.75),
    atk = FLOOR(atk * 0.9)   -- Reduzir ataque dos bosses em 10% também
WHERE is_boss = true AND min_floor <= 10;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE ESCALAMENTO PARA EARLY GAME
-- =====================================

-- LIMPAR TODAS AS VERSÕES CONFLITANTES PRIMEIRO
DROP FUNCTION IF EXISTS scale_monster_stats_early_game CASCADE;

-- Criar função específica para early game com escalamento mais suave
CREATE OR REPLACE FUNCTION scale_monster_stats_early_game(
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
    -- Para early game (tier 1), usar escalamento mais suave
    IF p_current_tier = 1 THEN
        -- Escalamento mais suave: 1.3x ao invés de 1.5x
        v_tier_multiplier := POWER(1.3, GREATEST(0, p_current_tier - 1));
        
        -- Progressão dentro do tier mais suave: 2% por andar ao invés de 3%
        v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.02);
    ELSE
        -- Para tiers mais altos, manter escalamento normal
        v_tier_multiplier := POWER(1.5, GREATEST(0, p_current_tier - 1));
        v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.03);
    END IF;
    
    -- Aplicar escalamento baseado no tipo
    CASE p_scaling_type
        WHEN 'hp' THEN
            -- HP escala mais para survivability, mas suave no early game
            IF p_current_tier = 1 THEN
                v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 1.1;
            ELSE
                v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 1.2;
            END IF;
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

-- =====================================
-- 6. ATUALIZAR FUNÇÃO PRINCIPAL PARA USAR EARLY GAME SCALING
-- =====================================

-- LIMPAR VERSÕES CONFLITANTES
DROP FUNCTION IF EXISTS get_monster_for_floor_early_game_balanced CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor_early_game_balanced(p_floor INTEGER)
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
    
    -- Gerar modificadores nemesis apenas para não-bosses
    IF v_is_boss THEN
        SELECT FALSE, NULL, 1.0, 1.0, 1.0, 1.0, 1.0 
        INTO v_nemesis_result;
    ELSE
        SELECT * INTO v_nemesis_result FROM generate_nemesis_modifier();
    END IF;
    
    -- USAR ESCALAMENTO EARLY GAME SUAVE para os primeiros andares
    IF p_floor <= 20 THEN
        v_final_hp := scale_monster_stats_early_game(
            v_monster_record.hp * COALESCE(v_nemesis_result.hp_modifier, 1.0), 
            v_tier, v_floor_in_tier, 'hp'
        );
        
        v_final_atk := scale_monster_stats_early_game(
            v_monster_record.atk * COALESCE(v_nemesis_result.atk_modifier, 1.0), 
            v_tier, v_floor_in_tier, 'attack'
        );
        
        v_final_def := scale_monster_stats_early_game(
            v_monster_record.def * COALESCE(v_nemesis_result.def_modifier, 1.0), 
            v_tier, v_floor_in_tier, 'defense'
        );
    ELSE
        -- Para andares 21+, usar escalamento normal
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
    END IF;
    
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
    
    -- Retornar resultado balanceado
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
        
        -- Atributos escalados com early game suave
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.strength, 10), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.strength, 10), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.dexterity, 8), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.dexterity, 8), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.intelligence, 6), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.intelligence, 6), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.wisdom, 6), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.wisdom, 6), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.vitality, 12), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.vitality, 12), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        CASE WHEN p_floor <= 20 THEN
            scale_monster_stats_early_game(COALESCE(v_monster_record.luck, 5), v_tier, v_floor_in_tier)
        ELSE
            scale_monster_stats_unified(COALESCE(v_monster_record.luck, 5), v_tier, v_floor_in_tier)
        END::INTEGER,
        
        -- Propriedades de combate ajustadas para early game
        CASE WHEN p_floor <= 20 THEN
            LEAST(25.0, 3.0 + v_tier * 1.5 + v_floor_in_tier * 0.3)  -- Crítico mais baixo no early game
        ELSE
            LEAST(40.0, 5.0 + v_tier * 2.0 + v_floor_in_tier * 0.5)
        END::DOUBLE PRECISION as critical_chance,
        
        CASE WHEN p_floor <= 20 THEN
            LEAST(200.0, 120.0 + v_tier * 8.0 + v_floor_in_tier * 1.5)  -- Dano crítico mais baixo no early game
        ELSE
            LEAST(300.0, 150.0 + v_tier * 10.0 + v_floor_in_tier * 2.0)
        END::DOUBLE PRECISION as critical_damage,
        
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
-- 7. CONCEDER PERMISSÕES
-- =====================================

GRANT EXECUTE ON FUNCTION scale_monster_stats_early_game(DECIMAL, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor_early_game_balanced(INTEGER) TO authenticated;

-- =====================================
-- 8. SUBSTITUIR FUNÇÃO PRINCIPAL TEMPORARIAMENTE
-- =====================================

-- Criar alias para usar a versão balanceada para early game
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
    -- Usar a versão balanceada para early game
    RETURN QUERY
    SELECT 
        u.id, u.name, u.level, u.hp, u.attack, u.defense, u.speed, u.behavior, u.mana,
        u.reward_xp, u.reward_gold, u.tier, u.base_tier, u.cycle_position, u.is_boss,
        u.strength, u.dexterity, u.intelligence, u.wisdom, u.vitality, u.luck,
        u.critical_chance, u.critical_damage, u.critical_resistance,
        u.physical_resistance, u.magical_resistance, u.debuff_resistance,
        u.physical_vulnerability, u.magical_vulnerability,
        u.primary_trait, u.secondary_trait, u.special_abilities
    FROM get_monster_for_floor_early_game_balanced(p_floor) u;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;

-- =====================================
-- 9. COMENTÁRIOS E LOG FINAL
-- =====================================

COMMENT ON FUNCTION scale_monster_stats_early_game IS 
'Escalamento suave para early game (andares 1-20): reduz progressão de 1.5x->1.3x e 3%->2% por andar.';

COMMENT ON FUNCTION get_monster_for_floor_early_game_balanced IS 
'Versão balanceada para early game: HP reduzido 40% nos andares 1-10, escalamento mais suave.';

-- Log final da migração
DO $$
DECLARE
    v_monster_count INTEGER;
    v_avg_hp_early NUMERIC;
BEGIN
    -- Contar monstros afetados
    SELECT COUNT(*) INTO v_monster_count 
    FROM monsters 
    WHERE min_floor <= 10;
    
    -- Calcular HP médio dos monstros early game
    SELECT AVG(hp) INTO v_avg_hp_early 
    FROM monsters 
    WHERE min_floor <= 10;
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== REFINAMENTO EARLY GAME APLICADO ===';
    RAISE NOTICE 'Monstros afetados (andares 1-10): %', v_monster_count;
    RAISE NOTICE 'HP médio após redução: %', ROUND(v_avg_hp_early, 0);
    RAISE NOTICE 'Redução aplicada: 40%% (andares 1-3), 35%% (4-6), 30%% (7-10)';
    RAISE NOTICE 'XP reduzido em 15%% para manter progressão';
    RAISE NOTICE 'Escalamento suave implementado para tier 1';
    RAISE NOTICE '===============================================';
END $$; 