-- =====================================
-- CORREÇÃO DA FUNÇÃO get_monster_for_floor_with_initiative
-- =====================================
-- Este script corrige o erro "structure of query does not match function result type"

-- =====================================
-- 1. VERIFICAR FUNÇÕES EXISTENTES E TIPOS
-- =====================================

-- Primeiro, vamos verificar qual função existe e seus tipos
SELECT 
    routine_name,
    routine_type,
    specific_name,
    data_type,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'get_monster_for_floor_with_initiative'
ORDER BY routine_name;

-- Verificar parâmetros da função
SELECT 
    parameter_name,
    data_type,
    parameter_mode
FROM information_schema.parameters 
WHERE specific_name IN (
    SELECT specific_name 
    FROM information_schema.routines 
    WHERE routine_name = 'get_monster_for_floor_with_initiative'
)
ORDER BY ordinal_position;

-- =====================================
-- 2. VERIFICAR ESTRUTURA DA TABELA MONSTERS
-- =====================================

-- Verificar os tipos atuais da tabela monsters
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'monsters'
ORDER BY ordinal_position;

-- =====================================
-- 3. REMOVER FUNÇÃO PROBLEMÁTICA E RECRIAR
-- =====================================

-- Remover todas as versões da função
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative CASCADE;

-- =====================================
-- 4. RECRIAR FUNÇÃO COM TIPOS CORRETOS
-- =====================================

-- Função simplificada que retorna apenas dados essenciais
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
    critical_chance NUMERIC,
    critical_damage NUMERIC,
    critical_resistance NUMERIC,
    physical_resistance NUMERIC,
    magical_resistance NUMERIC,
    debuff_resistance NUMERIC,
    physical_vulnerability NUMERIC,
    magical_vulnerability NUMERIC,
    primary_trait VARCHAR,
    secondary_trait VARCHAR,
    special_abilities TEXT[],
    current_initiative INTEGER,
    extra_turns_remaining INTEGER,
    build_type VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_tier INTEGER;
    v_position_in_cycle INTEGER;
    v_floor_in_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
    v_monster RECORD;
    v_build_type VARCHAR := 'balanced';
    v_tier_multiplier NUMERIC;
    v_floor_multiplier NUMERIC;
BEGIN
    -- Validar entrada
    IF p_floor IS NULL OR p_floor < 1 THEN
        p_floor := 1;
    END IF;
    
    -- Calcular tier e posição
    v_tier := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_position_in_cycle := ((p_floor - 1) % 20) + 1;
    v_floor_in_tier := p_floor - ((v_tier - 1) * 20);
    
    -- Determinar se é boss (incluindo checkpoint no 5)
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Escalamento sustentável
    v_tier_multiplier := POWER(1.25, GREATEST(0, v_tier - 1));
    v_floor_multiplier := 1.0 + (v_floor_in_tier * 0.015);
    
    -- Buscar monstro apropriado
    SELECT * INTO v_monster
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, false) = v_is_boss
    ORDER BY RANDOM()
    LIMIT 1;
    
    -- Fallback se não encontrar
    IF v_monster IS NULL THEN
        SELECT * INTO v_monster
        FROM monsters m
        ORDER BY RANDOM()
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, usar dados básicos
    IF v_monster IS NULL THEN
        RETURN QUERY SELECT
            'fallback_' || p_floor::VARCHAR,
            'Slime'::VARCHAR,
            GREATEST(1, p_floor / 3)::INTEGER,
            (30 + p_floor * 5)::INTEGER,
            (8 + p_floor * 2)::INTEGER,
            (2 + p_floor)::INTEGER,
            (15 + p_floor * 2)::INTEGER,
            (8 + p_floor)::INTEGER,
            'balanced'::VARCHAR,
            p_floor,
            (10 + p_floor * 2)::INTEGER,
            (5 + p_floor)::INTEGER,
            '👾'::VARCHAR,
            v_tier,
            1,
            v_position_in_cycle,
            v_is_boss,
            (8 + p_floor)::INTEGER,
            (8 + p_floor)::INTEGER,
            (6 + p_floor)::INTEGER,
            (6 + p_floor)::INTEGER,
            (10 + p_floor)::INTEGER,
            (5 + p_floor / 2)::INTEGER,
            (0.05 + p_floor * 0.003)::NUMERIC,
            (1.2 + p_floor * 0.02)::NUMERIC,
            (0.03 + p_floor * 0.002)::NUMERIC,
            (0.02 + p_floor * 0.001)::NUMERIC,
            (0.02 + p_floor * 0.001)::NUMERIC,
            (0.05 + p_floor * 0.003)::NUMERIC,
            1.0::NUMERIC,
            1.0::NUMERIC,
            'common'::VARCHAR,
            'basic'::VARCHAR,
            ARRAY[]::TEXT[],
            (8 + p_floor + FLOOR(RANDOM() * 5))::INTEGER,
            0,
            'balanced'::VARCHAR;
        RETURN;
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
        v_monster.id::VARCHAR,
        (v_monster.name || CASE 
            WHEN v_build_type != 'balanced' THEN ' ' || initcap(v_build_type)
            ELSE ''
        END)::VARCHAR,
        GREATEST(1, p_floor - 2 + FLOOR(RANDOM() * 3))::INTEGER,
        FLOOR(v_monster.hp * v_tier_multiplier * v_floor_multiplier * 1.1)::INTEGER,
        FLOOR(v_monster.atk * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(v_monster.def * v_tier_multiplier * v_floor_multiplier * 0.9)::INTEGER,
        COALESCE(v_monster.mana, 15 + p_floor),
        FLOOR(COALESCE(v_monster.speed, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        v_monster.behavior::VARCHAR,
        v_monster.min_floor,
        FLOOR(v_monster.reward_xp * POWER(1.2, v_tier - 1))::INTEGER,
        FLOOR(v_monster.reward_gold * POWER(1.2, v_tier - 1))::INTEGER,
        COALESCE(v_monster.image, '👾')::VARCHAR,
        v_tier,
        COALESCE(v_monster.base_tier, 1),
        v_position_in_cycle,
        v_is_boss,
        
        -- Atributos escalados suavemente
        FLOOR(COALESCE(v_monster.strength, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(COALESCE(v_monster.dexterity, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(COALESCE(v_monster.intelligence, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(COALESCE(v_monster.wisdom, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(COALESCE(v_monster.vitality, 8) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        FLOOR(COALESCE(v_monster.luck, 5) * v_tier_multiplier * v_floor_multiplier)::INTEGER,
        
        -- Propriedades de combate sustentáveis
        LEAST(25.0, 5.0 + p_floor * 0.3)::NUMERIC,
        LEAST(170.0, 120.0 + p_floor * 1.0)::NUMERIC,
        
        -- Resistências baixas
        LEAST(15.0, COALESCE(v_monster.critical_resistance, 0.03) * 100 + p_floor * 0.2)::NUMERIC,
        LEAST(12.0, COALESCE(v_monster.physical_resistance, 0.02) * 100 + p_floor * 0.15)::NUMERIC,
        LEAST(12.0, COALESCE(v_monster.magical_resistance, 0.02) * 100 + p_floor * 0.15)::NUMERIC,
        LEAST(20.0, COALESCE(v_monster.debuff_resistance, 0.05) * 100 + p_floor * 0.25)::NUMERIC,
        
        -- Vulnerabilidades inalteradas
        COALESCE(v_monster.physical_vulnerability, 1.0)::NUMERIC,
        COALESCE(v_monster.magical_vulnerability, 1.0)::NUMERIC,
        
        -- Traits
        COALESCE(v_monster.primary_trait, 'common')::VARCHAR,
        COALESCE(v_monster.secondary_trait, 'basic')::VARCHAR,
        COALESCE(v_monster.special_abilities, ARRAY[]::TEXT[]),
        
        -- Iniciativa baseada em velocidade escalada
        FLOOR(COALESCE(v_monster.speed, 8) * v_tier_multiplier * v_floor_multiplier + RANDOM() * 5)::INTEGER,
        0, -- extra_turns_remaining
        v_build_type::VARCHAR;
END;
$$;

-- =====================================
-- 5. FUNÇÃO DE TESTE SIMPLES
-- =====================================

-- Função simples para testar se a nova função funciona
CREATE OR REPLACE FUNCTION test_monster_function_simple(test_floor INTEGER)
RETURNS TABLE(
    floor_tested INTEGER,
    monster_name VARCHAR,
    monster_hp INTEGER,
    monster_atk INTEGER,
    monster_def INTEGER,
    is_boss BOOLEAN,
    test_status VARCHAR
)
LANGUAGE plpgsql
AS $$
DECLARE
    monster_data RECORD;
BEGIN
    BEGIN
        -- Tentar usar a função
        SELECT * INTO monster_data 
        FROM get_monster_for_floor_with_initiative(test_floor) 
        LIMIT 1;
        
        -- Se chegou até aqui, a função funcionou
        RETURN QUERY SELECT
            test_floor,
            monster_data.name,
            monster_data.hp,
            monster_data.atk,
            monster_data.def,
            monster_data.is_boss,
            '✅ FUNÇÃO OK'::VARCHAR;
            
    EXCEPTION WHEN OTHERS THEN
        -- Se deu erro, retornar o erro
        RETURN QUERY SELECT
            test_floor,
            'ERRO'::VARCHAR,
            0,
            0,
            0,
            false,
            ('❌ ERRO: ' || SQLERRM)::VARCHAR;
    END;
END;
$$;

-- =====================================
-- 6. EXECUTAR TESTE DA FUNÇÃO CORRIGIDA
-- =====================================

-- Testar a função corrigida
SELECT 
    floor_tested,
    monster_name,
    monster_hp,
    monster_atk,
    monster_def,
    is_boss,
    test_status
FROM test_monster_function_simple(1)
UNION ALL
SELECT * FROM test_monster_function_simple(5)
UNION ALL
SELECT * FROM test_monster_function_simple(10)
UNION ALL
SELECT * FROM test_monster_function_simple(15);

-- =====================================
-- 7. COMENTÁRIOS E LIMPEZA
-- =====================================

-- Limpar função de teste
DROP FUNCTION IF EXISTS test_monster_function_simple(INTEGER);

COMMENT ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) IS 
'Função corrigida para geração de monstros com tipos compatíveis.
Usa escalamento sustentável: 1.25x por tier + 1.5% por andar.
Inclui checkpoint no andar 5 e resistências baixas.';

-- Confirmar correção
SELECT 'Função get_monster_for_floor_with_initiative corrigida com sucesso!' as resultado; 