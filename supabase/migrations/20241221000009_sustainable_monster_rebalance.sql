-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO SUSTENTÁVEL DE MONSTROS
-- =====================================
-- Data: 2024-12-21
-- Versão: 20241221000009
-- Objetivo: Redefinir sistema de monstros para médio/difícil sustentável com checkpoint no andar 5

-- PROBLEMA: Múltiplas migrações aplicaram aumentos cumulativos resultando em monstros extremamente fortes
-- SOLUÇÃO: Reset completo dos stats base e escalamento mais suave

-- =====================================
-- 1. RESET DOS STATS BASE DOS MONSTROS
-- =====================================

-- Redefinir HP para valores muito mais baixos e sustentáveis
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor <= 3 THEN 35   -- Tutorial: HP muito baixo
        WHEN min_floor <= 5 THEN 45   -- Pré-checkpoint: HP baixo
        WHEN min_floor <= 10 THEN 60  -- Early game: HP moderado
        WHEN min_floor <= 15 THEN 80  -- Mid game: HP médio
        WHEN min_floor <= 20 THEN 100 -- Late early: HP alto
        ELSE 120                      -- End game: HP muito alto
    END;

-- Redefinir ATK para valores balanceados
UPDATE monsters SET 
    atk = CASE 
        WHEN min_floor <= 3 THEN 8    -- Tutorial: Ataque muito baixo
        WHEN min_floor <= 5 THEN 12   -- Pré-checkpoint: Ataque baixo
        WHEN min_floor <= 10 THEN 16  -- Early game: Ataque moderado
        WHEN min_floor <= 15 THEN 22  -- Mid game: Ataque médio
        WHEN min_floor <= 20 THEN 28  -- Late early: Ataque alto
        ELSE 35                       -- End game: Ataque muito alto
    END;

-- Redefinir DEF para valores sustentáveis
UPDATE monsters SET 
    def = CASE 
        WHEN min_floor <= 3 THEN 2    -- Tutorial: Defesa muito baixa
        WHEN min_floor <= 5 THEN 4    -- Pré-checkpoint: Defesa baixa
        WHEN min_floor <= 10 THEN 6   -- Early game: Defesa moderada
        WHEN min_floor <= 15 THEN 8   -- Mid game: Defesa média
        WHEN min_floor <= 20 THEN 10  -- Late early: Defesa alta
        ELSE 12                       -- End game: Defesa muito alta
    END;

-- Ajustar bosses para serem 40% mais fortes (não 150%+)
UPDATE monsters SET 
    hp = FLOOR(hp * 1.4),
    atk = FLOOR(atk * 1.4),
    def = FLOOR(def * 1.4)
WHERE is_boss = true;

-- =====================================
-- 2. REDUZIR RESISTÊNCIAS EXTREMAS
-- =====================================

-- Resistências muito mais baixas para não anular ataques do jogador
UPDATE monsters SET
    critical_resistance = CASE 
        WHEN is_boss = true THEN LEAST(0.25, 0.15)           -- Bosses: máximo 15%
        WHEN behavior = 'defensive' THEN LEAST(0.15, 0.10)   -- Defensive: máximo 10%
        ELSE LEAST(0.1, 0.05)                                -- Outros: máximo 5%
    END,
    physical_resistance = CASE 
        WHEN is_boss = true AND behavior = 'defensive' THEN LEAST(0.20, 0.12)
        WHEN is_boss = true THEN LEAST(0.15, 0.08)
        WHEN behavior = 'defensive' THEN LEAST(0.10, 0.06)
        ELSE LEAST(0.05, 0.03)                               -- Máximo 3%
    END,
    magical_resistance = CASE 
        WHEN is_boss = true AND name ILIKE '%lich%' THEN LEAST(0.20, 0.12)
        WHEN is_boss = true THEN LEAST(0.15, 0.08)
        WHEN name ILIKE '%elemental%' THEN LEAST(0.10, 0.06)
        ELSE LEAST(0.05, 0.03)                               -- Máximo 3%
    END,
    debuff_resistance = CASE 
        WHEN is_boss = true THEN LEAST(0.30, 0.20)           -- Bosses: máximo 20%
        WHEN behavior = 'defensive' THEN LEAST(0.20, 0.12)   -- Defensive: máximo 12%
        ELSE LEAST(0.10, 0.06)                               -- Outros: máximo 6%
    END;

-- =====================================
-- 3. FUNÇÃO DE ESCALAMENTO SUSTENTÁVEL
-- =====================================

-- Criar função de escalamento muito mais suave
CREATE OR REPLACE FUNCTION scale_monster_stats_sustainable(
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
    -- Escalamento por tier muito mais suave: 1.25x ao invés de 2.0x+
    v_tier_multiplier := POWER(1.25, GREATEST(0, p_current_tier - 1));
    
    -- Progressão dentro do tier: apenas 1.5% por andar
    v_floor_multiplier := 1.0 + (p_floor_in_tier * 0.015);
    
    -- Aplicar escalamento baseado no tipo
    CASE p_scaling_type
        WHEN 'hp' THEN
            -- HP pode escalar um pouco mais para survivability
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 1.1;
        WHEN 'attack' THEN
            -- Ataque escala normalmente
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
        WHEN 'defense' THEN
            -- Defesa escala mais conservadoramente
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier * 0.9;
        ELSE
            -- Escalamento padrão
            v_final_stat := p_base_stat * v_tier_multiplier * v_floor_multiplier;
    END CASE;
    
    RETURN GREATEST(1, FLOOR(v_final_stat));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO PRINCIPAL
-- =====================================

-- Recriar função com escalamento sustentável
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE(
    id VARCHAR,
    name VARCHAR,
    level INTEGER,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior VARCHAR,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    image VARCHAR,
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
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    critical_resistance NUMERIC(5,2),
    physical_resistance NUMERIC(5,2),
    magical_resistance NUMERIC(5,2),
    debuff_resistance NUMERIC(5,2),
    physical_vulnerability NUMERIC(5,2),
    magical_vulnerability NUMERIC(5,2),
    primary_trait VARCHAR,
    secondary_trait VARCHAR,
    special_abilities TEXT[],
    current_initiative INTEGER,
    extra_turns_remaining INTEGER,
    build_type TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tier INTEGER;
    v_position_in_cycle INTEGER;
    v_floor_in_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20]; -- NOVO: Checkpoint no andar 5
    v_monster monsters%ROWTYPE;
    v_selected_monster RECORD;
    v_build_type TEXT := 'balanced';
BEGIN
    -- Calcular tier e posição
    v_tier := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_position_in_cycle := ((p_floor - 1) % 20) + 1;
    v_floor_in_tier := p_floor - ((v_tier - 1) * 20);
    
    -- Determinar se é boss (incluindo checkpoint no 5)
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Buscar monstro apropriado
    SELECT m.* INTO v_monster
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, false) = v_is_boss
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Fallback se não encontrar
    IF v_monster.id IS NULL THEN
        SELECT m.* INTO v_monster
        FROM monsters m
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, erro
    IF v_monster.id IS NULL THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- Determinar build type
    v_build_type := CASE (p_floor % 5)
        WHEN 0 THEN 'armored'
        WHEN 1 THEN 'swift'
        WHEN 2 THEN 'brutish'
        WHEN 3 THEN 'magical'
        ELSE 'balanced'
    END;
    
    -- Retornar monstro com stats sustentáveis
    RETURN QUERY SELECT
        v_monster.id,
        v_monster.name || CASE 
            WHEN v_build_type != 'balanced' THEN ' ' || initcap(v_build_type)
            ELSE ''
        END,
        GREATEST(1, p_floor - 2 + FLOOR(RANDOM() * 3))::INTEGER as level,
        scale_monster_stats_sustainable(v_monster.hp, v_tier, v_floor_in_tier, 'hp')::INTEGER as hp,
        scale_monster_stats_sustainable(v_monster.atk, v_tier, v_floor_in_tier, 'attack')::INTEGER as atk,
        scale_monster_stats_sustainable(v_monster.def, v_tier, v_floor_in_tier, 'defense')::INTEGER as def,
        COALESCE(v_monster.mana, 15 + p_floor),
        scale_monster_stats_sustainable(COALESCE(v_monster.speed, 8), v_tier, v_floor_in_tier)::INTEGER as speed,
        v_monster.behavior,
        v_monster.min_floor,
        FLOOR(v_monster.reward_xp * POWER(1.2, v_tier - 1))::INTEGER as reward_xp,
        FLOOR(v_monster.reward_gold * POWER(1.2, v_tier - 1))::INTEGER as reward_gold,
        v_monster.image,
        v_tier,
        COALESCE(v_monster.base_tier, 1),
        v_position_in_cycle,
        v_is_boss,
        
        -- Atributos escalados suavemente
        scale_monster_stats_sustainable(COALESCE(v_monster.strength, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_sustainable(COALESCE(v_monster.dexterity, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_sustainable(COALESCE(v_monster.intelligence, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_sustainable(COALESCE(v_monster.wisdom, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_sustainable(COALESCE(v_monster.vitality, 8), v_tier, v_floor_in_tier)::INTEGER,
        scale_monster_stats_sustainable(COALESCE(v_monster.luck, 5), v_tier, v_floor_in_tier)::INTEGER,
        
        -- Propriedades de combate sustentáveis
        LEAST(25.0, 5.0 + p_floor * 0.3)::NUMERIC(5,2) as critical_chance,
        LEAST(170.0, 120.0 + p_floor * 1.0)::NUMERIC(5,2) as critical_damage,
        
        -- Resistências baixas
        LEAST(15.0, v_monster.critical_resistance * 100 + p_floor * 0.2)::NUMERIC(5,2),
        LEAST(12.0, v_monster.physical_resistance * 100 + p_floor * 0.15)::NUMERIC(5,2),
        LEAST(12.0, v_monster.magical_resistance * 100 + p_floor * 0.15)::NUMERIC(5,2),
        LEAST(20.0, v_monster.debuff_resistance * 100 + p_floor * 0.25)::NUMERIC(5,2),
        
        -- Vulnerabilidades inalteradas
        COALESCE(v_monster.physical_vulnerability, 1.0)::NUMERIC(5,2),
        COALESCE(v_monster.magical_vulnerability, 1.0)::NUMERIC(5,2),
        
        -- Traits
        v_monster.primary_trait,
        v_monster.secondary_trait,
        COALESCE(v_monster.special_abilities, ARRAY[]::TEXT[]),
        
        -- Iniciativa baseada em velocidade escalada
        FLOOR(scale_monster_stats_sustainable(COALESCE(v_monster.speed, 8), v_tier, v_floor_in_tier) + RANDOM() * 5)::INTEGER,
        0, -- extra_turns_remaining
        v_build_type;
END;
$$;

-- =====================================
-- 5. AJUSTAR SISTEMA DE CHECKPOINTS
-- =====================================

-- Atualizar dados de floors para incluir checkpoint no 5
UPDATE floors SET 
    is_checkpoint = true,
    description = 'Primeiro Santuário - Checkpoint Inicial'
WHERE floor_number = 5;

-- Se a tabela floors não existir, criar dados base
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'floors') THEN
        CREATE TABLE floors (
            floor_number INTEGER PRIMARY KEY,
            type TEXT DEFAULT 'common',
            is_checkpoint BOOLEAN DEFAULT false,
            description TEXT
        );
        
        -- Inserir dados base dos primeiros 20 andares
        INSERT INTO floors (floor_number, type, is_checkpoint, description) VALUES
        (1, 'common', true, 'Entrada da Torre'),
        (5, 'boss', true, 'Primeiro Desafio - Checkpoint Inicial'),
        (10, 'boss', true, 'Guardião dos Níveis Iniciais'),
        (15, 'elite', false, 'Domínio de Elite'),
        (20, 'boss', true, 'Senhor do Primeiro Ciclo');
    END IF;
END $$;

-- =====================================
-- 6. COMENTÁRIOS E FINALIZAÇÃO
-- =====================================

COMMENT ON FUNCTION scale_monster_stats_sustainable IS 
'Função de escalamento sustentável: 1.25x por tier + 1.5% por andar';

COMMENT ON FUNCTION get_monster_for_floor_with_initiative IS 
'Sistema rebalanceado: HP 35-120, ATK 8-35, resistências máx 15%, checkpoint no andar 5';

-- Confirmar aplicação
SELECT 'Rebalanceamento sustentável aplicado!' as status,
       'Stats base reduzidos drasticamente' as stats_info,
       'Checkpoint adicionado no andar 5' as checkpoint_info,
       'Escalamento suavizado para 1.25x/tier' as scaling_info; 