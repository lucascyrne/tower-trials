-- =====================================================
-- MIGRAÇÃO: REBALANCEAMENTO DE RECOMPENSAS E STATS DE MONSTROS
-- =====================================================
-- Data: 2024-12-21
-- Versão: 20241221000022
-- 
-- OBJETIVOS:
-- 1. Aumentar XP/Gold para progressão mais fluida (12-16 XP, 18-32 Gold)
-- 2. Rebalancear stats dos monstros para alinhar com personagens ultra-baixos
-- 3. Criar experiência de tutorial seguida de progressão gradual
-- =====================================================

-- =====================================
-- 1. REBALANCEAR RECOMPENSAS DE XP E GOLD
-- =====================================

-- Aumentar drasticamente as recompensas para progressão mais fluida
UPDATE monsters SET 
    reward_xp = CASE 
        WHEN min_floor <= 3 THEN 12 + (min_floor * 2)     -- 14-18 XP (era ~2-4)
        WHEN min_floor <= 5 THEN 16 + (min_floor * 3)     -- 19-31 XP (era ~4-8)
        WHEN min_floor <= 10 THEN 20 + (min_floor * 4)    -- 24-60 XP (era ~6-18)
        WHEN min_floor <= 15 THEN 30 + (min_floor * 6)    -- 36-120 XP (era ~15-45)
        WHEN min_floor <= 20 THEN 50 + (min_floor * 8)    -- 58-210 XP (era ~25-70)
        ELSE 80 + (min_floor * 12)                        -- 92+ XP (era ~40+)
    END,
    reward_gold = CASE 
        WHEN min_floor <= 3 THEN 18 + (min_floor * 4) + FLOOR(RANDOM() * 8)     -- 22-38 Gold variável
        WHEN min_floor <= 5 THEN 25 + (min_floor * 6) + FLOOR(RANDOM() * 12)    -- 31-67 Gold variável
        WHEN min_floor <= 10 THEN 35 + (min_floor * 8) + FLOOR(RANDOM() * 16)   -- 43-131 Gold variável
        WHEN min_floor <= 15 THEN 50 + (min_floor * 12) + FLOOR(RANDOM() * 20)  -- 62-230 Gold variável
        WHEN min_floor <= 20 THEN 80 + (min_floor * 15) + FLOOR(RANDOM() * 25)  -- 95-345 Gold variável
        ELSE 120 + (min_floor * 20) + FLOOR(RANDOM() * 30)                      -- 140+ Gold variável
    END;

-- Bosses mantêm multiplicador mas com base aumentada
UPDATE monsters SET 
    reward_xp = FLOOR(reward_xp * 2.2),  -- Bosses dão 2.2x XP (era 2.5x)
    reward_gold = FLOOR(reward_gold * 1.8) -- Bosses dão 1.8x Gold (era 2.0x)
WHERE is_boss = true;

-- =====================================
-- 2. REBALANCEAR STATS DOS MONSTROS PARA TUTORIAL PROGRESSIVO
-- =====================================

-- TUTORIAL (Andares 1-3): Monstros mais fracos que o personagem para ensinar mecânicas
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor = 1 THEN 45    -- Personagem nível 1 tem ~80 HP
        WHEN min_floor = 2 THEN 55    -- Ligeiramente mais forte
        WHEN min_floor = 3 THEN 65    -- Preparação para desafio real
    END,
    atk = CASE 
        WHEN min_floor = 1 THEN 8     -- Personagem nível 1 tem ~12 ATK
        WHEN min_floor = 2 THEN 10    -- Ligeiramente mais forte
        WHEN min_floor = 3 THEN 12    -- Igualar o personagem
    END,
    def = CASE 
        WHEN min_floor = 1 THEN 2     -- Personagem nível 1 tem ~3 DEF
        WHEN min_floor = 2 THEN 3     -- Ligeiramente mais forte
        WHEN min_floor = 3 THEN 4     -- Ligeiramente mais forte que personagem
    END
WHERE min_floor <= 3 AND is_boss = false;

-- EARLY GAME (Andares 4-10): Progressão gradual mais desafiadora
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor = 4 THEN 75    -- Começar a desafiar
        WHEN min_floor = 5 THEN 85    -- Boss checkpoint
        WHEN min_floor = 6 THEN 95    
        WHEN min_floor = 7 THEN 105   
        WHEN min_floor = 8 THEN 115   
        WHEN min_floor = 9 THEN 125   
        WHEN min_floor = 10 THEN 135  -- Boss importante
    END,
    atk = CASE 
        WHEN min_floor = 4 THEN 14    -- Começar a pressionar
        WHEN min_floor = 5 THEN 16    
        WHEN min_floor = 6 THEN 18    
        WHEN min_floor = 7 THEN 20    
        WHEN min_floor = 8 THEN 22    
        WHEN min_floor = 9 THEN 24    
        WHEN min_floor = 10 THEN 26   
    END,
    def = CASE 
        WHEN min_floor = 4 THEN 5     
        WHEN min_floor = 5 THEN 6     
        WHEN min_floor = 6 THEN 7     
        WHEN min_floor = 7 THEN 8     
        WHEN min_floor = 8 THEN 9     
        WHEN min_floor = 9 THEN 10    
        WHEN min_floor = 10 THEN 11   
    END
WHERE min_floor >= 4 AND min_floor <= 10 AND is_boss = false;

-- MID GAME (Andares 11-20): Desafio real, requer equipamentos e estratégia
UPDATE monsters SET 
    hp = 140 + (min_floor - 10) * 15,    -- 155-290 HP
    atk = 28 + (min_floor - 10) * 3,     -- 31-58 ATK
    def = 12 + (min_floor - 10) * 2      -- 14-32 DEF
WHERE min_floor >= 11 AND min_floor <= 20 AND is_boss = false;

-- LATE GAME (Andares 21+): Escalamento mais agressivo
UPDATE monsters SET 
    hp = 300 + (min_floor - 20) * 25,    -- 325+ HP
    atk = 60 + (min_floor - 20) * 5,     -- 65+ ATK
    def = 35 + (min_floor - 20) * 3      -- 38+ DEF
WHERE min_floor > 20 AND is_boss = false;

-- =====================================
-- 3. REBALANCEAR BOSSES PROPORCIONALMENTE
-- =====================================

-- Bosses devem ser 50% mais fortes que monstros normais (não 80% como antes)
UPDATE monsters SET 
    hp = FLOOR(hp * 1.5),     -- Reduzido de 1.8x para 1.5x
    atk = FLOOR(atk * 1.4),   -- Reduzido de 1.8x para 1.4x
    def = FLOOR(def * 1.3)    -- Reduzido de 1.8x para 1.3x
WHERE is_boss = true;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO DE ESCALAMENTO PARA NOVA REALIDADE
-- =====================================

-- Função de escalamento mais suave para alinhar com stats rebalanceados
CREATE OR REPLACE FUNCTION scale_monster_stats_tutorial_friendly(
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
    -- Escalamento mais suave para tutorial melhor
    -- Tier 1 (andares 1-20): Crescimento muito gradual
    IF p_current_tier = 1 THEN
        v_tier_multiplier := 1.0; -- Sem multiplicador de tier no tutorial
        v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.015); -- Apenas 1.5% por andar
    ELSE
        -- Tiers superiores: Escalamento mais agressivo
        v_tier_multiplier := POWER(1.3, GREATEST(0, p_current_tier - 1)); -- Reduzido de 1.5x
        v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.025); -- Reduzido de 3%
    END IF;
    
    -- Aplicar escalamento baseado no tipo
    CASE p_scaling_type
        WHEN 'hp' THEN
            -- HP escala um pouco mais
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 1.1;
        WHEN 'attack' THEN
            -- Ataque escala normalmente
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
        WHEN 'defense' THEN
            -- Defesa escala menos
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 0.9;
        ELSE
            -- Escalamento padrão
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
    END CASE;
    
    RETURN GREATEST(1, FLOOR(v_final_stat));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO PRINCIPAL DE MONSTROS
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
    
    -- Buscar monstro base adequado
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
    
    -- Aplicar escalamento tutorial-friendly + modificadores nemesis
    v_final_hp := scale_monster_stats_tutorial_friendly(
        v_monster_record.hp * COALESCE(v_nemesis_result.hp_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'hp'
    );
    
    v_final_atk := scale_monster_stats_tutorial_friendly(
        v_monster_record.atk * COALESCE(v_nemesis_result.atk_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'attack'
    );
    
    v_final_def := scale_monster_stats_tutorial_friendly(
        v_monster_record.def * COALESCE(v_nemesis_result.def_modifier, 1.0), 
        v_tier, v_floor_in_tier, 'defense'
    );
    
    v_final_speed := scale_monster_stats_tutorial_friendly(
        COALESCE(v_monster_record.speed, 8) + GREATEST(1, p_floor / 4) + v_tier, 
        v_tier, v_floor_in_tier
    );
    
    -- Recompensas com modificadores nemesis e variabilidade no gold
    v_final_reward_xp := FLOOR(
        COALESCE(v_monster_record.reward_xp, 14) * COALESCE(v_nemesis_result.xp_modifier, 1.0)
    );
    
    -- Gold com variabilidade (±25%)
    v_final_reward_gold := FLOOR(
        COALESCE(v_monster_record.reward_gold, 25) * COALESCE(v_nemesis_result.gold_modifier, 1.0) * 
        (0.75 + RANDOM() * 0.5) -- Variação de 75% a 125% do valor base
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
        GREATEST(1, p_floor / 4)::INTEGER as level, -- Nível mais baixo
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
        
        -- Atributos escalados mais suavemente
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.strength, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.dexterity, 6), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.intelligence, 4), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.wisdom, 4), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.vitality, 10), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_tutorial_friendly(COALESCE(v_monster_record.luck, 3), v_tier, v_floor_in_tier)::INTEGER,
        
        -- Propriedades de combate mais moderadas
        LEAST(25.0, 2.0 + v_tier * 1.0 + v_floor_in_tier * 0.3)::DOUBLE PRECISION as critical_chance,
        LEAST(180.0, 110.0 + v_tier * 5.0 + v_floor_in_tier * 1.0)::DOUBLE PRECISION as critical_damage,
        LEAST(20.0, v_tier * 1.0 + (CASE WHEN v_is_boss THEN 8.0 ELSE 3.0 END))::DOUBLE PRECISION as critical_resistance,
        LEAST(15.0, v_tier * 1.0 + (CASE WHEN v_is_boss THEN 3.0 ELSE 1.0 END))::DOUBLE PRECISION as physical_resistance,
        LEAST(15.0, v_tier * 1.0 + (CASE WHEN v_nemesis_result.is_nemesis THEN 3.0 ELSE 1.0 END))::DOUBLE PRECISION as magical_resistance,
        LEAST(30.0, v_tier * 2.0 + (CASE WHEN v_is_boss THEN 10.0 ELSE 3.0 END))::DOUBLE PRECISION as debuff_resistance,
        GREATEST(0.9, 1.0 - v_tier * 0.005)::DOUBLE PRECISION as physical_vulnerability,
        GREATEST(0.9, 1.0 - v_tier * 0.005)::DOUBLE PRECISION as magical_vulnerability,
        
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
-- 6. CONFIGURAR PERMISSÕES
-- =====================================

GRANT EXECUTE ON FUNCTION scale_monster_stats_tutorial_friendly(DECIMAL, INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor_unified(INTEGER) TO authenticated;

-- =====================================
-- 7. ATUALIZAR FRONTEND SERVICE PARA USAR NOVOS VALORES
-- =====================================

-- Comentário para lembrar de atualizar o MonsterService.ts
COMMENT ON FUNCTION get_monster_for_floor_unified IS 
'Função unificada com rebalanceamento tutorial-friendly:
- XP: 12-16 base, progressão gradual
- Gold: 18-32 base com variabilidade ±25%
- Stats: Tutorial suave (andares 1-3), depois progressão gradual
- Escalamento: Muito mais suave no tier 1, moderado depois';

-- =====================================
-- 8. LOG FINAL
-- =====================================

DO $$
DECLARE
    v_slime_stats RECORD;
    v_boss_5_stats RECORD;
BEGIN
    -- Verificar stats do Slime após rebalanceamento
    SELECT hp, atk, def, reward_xp, reward_gold INTO v_slime_stats
    FROM monsters 
    WHERE min_floor = 1 AND is_boss = false
    LIMIT 1;
    
    -- Verificar stats do Boss andar 5
    SELECT hp, atk, def, reward_xp, reward_gold INTO v_boss_5_stats
    FROM monsters 
    WHERE min_floor = 5 AND is_boss = true
    LIMIT 1;
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== REBALANCEAMENTO DE RECOMPENSAS E STATS ===';
    RAISE NOTICE 'Slime (andar 1): HP=%, ATK=%, DEF=%, XP=%, Gold=%', 
        COALESCE(v_slime_stats.hp, 0), 
        COALESCE(v_slime_stats.atk, 0), 
        COALESCE(v_slime_stats.def, 0),
        COALESCE(v_slime_stats.reward_xp, 0),
        COALESCE(v_slime_stats.reward_gold, 0);
    RAISE NOTICE 'Boss 5: HP=%, ATK=%, DEF=%, XP=%, Gold=%', 
        COALESCE(v_boss_5_stats.hp, 0), 
        COALESCE(v_boss_5_stats.atk, 0), 
        COALESCE(v_boss_5_stats.def, 0),
        COALESCE(v_boss_5_stats.reward_xp, 0),
        COALESCE(v_boss_5_stats.reward_gold, 0);
    RAISE NOTICE 'Tutorial: Andares 1-3 mais fáceis que personagem';
    RAISE NOTICE 'Progressão: Gradual e recompensadora';
    RAISE NOTICE '===============================================';
END $$; 