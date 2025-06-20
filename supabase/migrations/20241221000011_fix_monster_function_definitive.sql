-- ===================================================================================================
-- MIGRAÇÃO: Correção Definitiva da Função get_monster_for_floor_with_initiative
-- ===================================================================================================
-- Objetivo: Corrigir incompatibilidade de tipos que causa erro 42804
-- Estratégia: Recriar função com tipos explícitos e estrutura correta
-- ===================================================================================================

-- 1. REMOVER FUNÇÃO PROBLEMÁTICA SE EXISTIR
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(INTEGER);
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(p_floor INTEGER);

-- 2. VERIFICAR ESTRUTURA DA TABELA MONSTERS
DO $$ 
BEGIN
    -- Log da estrutura atual
    RAISE NOTICE 'Verificando estrutura da tabela monsters...';
    
    -- Verificar se colunas críticas existem
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'monsters' AND column_name = 'id' AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'Coluna monsters.id não é UUID - estrutura incompatível';
    END IF;
    
    RAISE NOTICE 'Tabela monsters tem estrutura correta';
END $$;

-- 3. CRIAR FUNÇÃO CORRIGIDA COM TIPOS EXPLÍCITOS
CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE(
    id TEXT,                           -- CORRIGIDO: TEXT ao invés de UUID
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
    v_monster_count INTEGER;
BEGIN
    -- Log da entrada
    RAISE NOTICE 'get_monster_for_floor_with_initiative: andar %', p_floor;
    
    -- Validação de entrada
    IF p_floor IS NULL OR p_floor < 1 THEN
        RAISE EXCEPTION 'Andar inválido: %', p_floor;
    END IF;
    
    -- Verificar se existem monstros
    SELECT COUNT(*) INTO v_monster_count FROM monsters WHERE min_floor <= p_floor;
    
    IF v_monster_count = 0 THEN
        RAISE NOTICE 'Nenhum monstro encontrado para andar %, gerando fallback', p_floor;
        
        -- Retornar monstro fallback
        RETURN QUERY
        SELECT
            'fallback_' || p_floor::TEXT || '_' || extract(epoch from now())::TEXT AS id,
            'Monstro Andar ' || p_floor::TEXT AS name,
            GREATEST(1, p_floor / 3)::INTEGER AS level,
            (30 + p_floor * 10)::INTEGER AS hp,
            (8 + p_floor * 2)::INTEGER AS attack,
            (3 + p_floor)::INTEGER AS defense,
            (10 + p_floor / 2)::INTEGER AS speed,
            'balanced'::TEXT AS behavior,
            (15 + p_floor * 3)::INTEGER AS mana,
            (5 + p_floor * 2)::INTEGER AS reward_xp,
            (3 + p_floor)::INTEGER AS reward_gold,
            GREATEST(1, p_floor / 20 + 1)::INTEGER AS tier,
            1::INTEGER AS base_tier,
            ((p_floor - 1) % 20 + 1)::INTEGER AS cycle_position,
            (p_floor % 10 = 0)::BOOLEAN AS is_boss,
            (8 + p_floor / 3)::INTEGER AS strength,
            (8 + p_floor / 3)::INTEGER AS dexterity,
            (6 + p_floor / 4)::INTEGER AS intelligence,
            (6 + p_floor / 4)::INTEGER AS wisdom,
            (10 + p_floor / 2)::INTEGER AS vitality,
            (5 + p_floor / 4)::INTEGER AS luck,
            LEAST(0.25, 0.05 + p_floor * 0.003)::DOUBLE PRECISION AS critical_chance,
            LEAST(1.8, 1.2 + p_floor * 0.02)::DOUBLE PRECISION AS critical_damage,
            LEAST(0.15, 0.05 + p_floor * 0.002)::DOUBLE PRECISION AS critical_resistance,
            LEAST(0.12, 0.02 + p_floor * 0.002)::DOUBLE PRECISION AS physical_resistance,
            LEAST(0.12, 0.02 + p_floor * 0.002)::DOUBLE PRECISION AS magical_resistance,
            LEAST(0.2, 0.05 + p_floor * 0.003)::DOUBLE PRECISION AS debuff_resistance,
            1.0::DOUBLE PRECISION AS physical_vulnerability,
            1.0::DOUBLE PRECISION AS magical_vulnerability,
            CASE WHEN p_floor % 10 = 0 THEN 'brutish' ELSE NULL END::TEXT AS primary_trait,
            NULL::TEXT AS secondary_trait,
            CASE WHEN p_floor % 10 = 0 THEN ARRAY['Ataque Poderoso'] ELSE ARRAY[]::TEXT[] END AS special_abilities;
            
        RETURN;
    END IF;
    
    -- Buscar monstro adequado
    SELECT * INTO v_monster_record
    FROM monsters 
    WHERE min_floor <= p_floor
    ORDER BY min_floor DESC, RANDOM()
    LIMIT 1;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Falha crítica: nenhum monstro encontrado para andar %', p_floor;
    END IF;
    
    -- Retornar resultado com tipos explícitos e stats escalados calculados inline
    RETURN QUERY
    SELECT
        v_monster_record.id::TEXT,  -- CONVERSÃO EXPLÍCITA UUID -> TEXT
        COALESCE(v_monster_record.name, 'Monstro Desconhecido')::TEXT,
        COALESCE(v_monster_record.level, 1)::INTEGER,
        -- Calcular HP escalado: 1.25x por tier + 1.5% por andar
        FLOOR(COALESCE(v_monster_record.hp, 50) * POWER(1.25, COALESCE(v_monster_record.tier, 1) - 1) * (1.0 + ((p_floor % 20) * 0.015)))::INTEGER,
        -- Calcular ATK escalado
        FLOOR(COALESCE(v_monster_record.atk, 10) * POWER(1.25, COALESCE(v_monster_record.tier, 1) - 1) * (1.0 + ((p_floor % 20) * 0.015)))::INTEGER,
        -- Calcular DEF escalado
        FLOOR(COALESCE(v_monster_record.def, 5) * POWER(1.25, COALESCE(v_monster_record.tier, 1) - 1) * (1.0 + ((p_floor % 20) * 0.015)))::INTEGER,
        -- Calcular SPEED escalado
        FLOOR(COALESCE(v_monster_record.speed, 10) * POWER(1.25, COALESCE(v_monster_record.tier, 1) - 1) * (1.0 + ((p_floor % 20) * 0.015)))::INTEGER,
        COALESCE(v_monster_record.behavior, 'balanced')::TEXT,
        COALESCE(v_monster_record.mana, 0)::INTEGER,
        COALESCE(v_monster_record.reward_xp, 10)::INTEGER,
        COALESCE(v_monster_record.reward_gold, 5)::INTEGER,
        COALESCE(v_monster_record.tier, 1)::INTEGER,
        COALESCE(v_monster_record.base_tier, 1)::INTEGER,
        COALESCE(v_monster_record.cycle_position, 1)::INTEGER,
        COALESCE(v_monster_record.is_boss, false)::BOOLEAN,
        COALESCE(v_monster_record.strength, 10)::INTEGER,
        COALESCE(v_monster_record.dexterity, 10)::INTEGER,
        COALESCE(v_monster_record.intelligence, 8)::INTEGER,
        COALESCE(v_monster_record.wisdom, 8)::INTEGER,
        COALESCE(v_monster_record.vitality, 12)::INTEGER,
        COALESCE(v_monster_record.luck, 5)::INTEGER,
        COALESCE(v_monster_record.critical_chance, 0.05)::DOUBLE PRECISION,
        COALESCE(v_monster_record.critical_damage, 1.5)::DOUBLE PRECISION,
        COALESCE(v_monster_record.critical_resistance, 0.1)::DOUBLE PRECISION,
        COALESCE(v_monster_record.physical_resistance, 0.0)::DOUBLE PRECISION,
        COALESCE(v_monster_record.magical_resistance, 0.0)::DOUBLE PRECISION,
        COALESCE(v_monster_record.debuff_resistance, 0.0)::DOUBLE PRECISION,
        COALESCE(v_monster_record.physical_vulnerability, 1.0)::DOUBLE PRECISION,
        COALESCE(v_monster_record.magical_vulnerability, 1.0)::DOUBLE PRECISION,
        v_monster_record.primary_trait::TEXT,
        v_monster_record.secondary_trait::TEXT,
        COALESCE(v_monster_record.special_abilities, ARRAY[]::TEXT[])::TEXT[];

    RAISE NOTICE 'Monstro retornado: % (ID: %)', v_monster_record.name, v_monster_record.id;
    
END $$;

-- 4. FUNÇÃO DE TESTE SIMPLES
CREATE OR REPLACE FUNCTION test_monster_function_types()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_result RECORD;
    v_test_floor INTEGER := 5;
BEGIN
    -- Testar função
    SELECT * INTO v_result 
    FROM get_monster_for_floor_with_initiative(v_test_floor)
    LIMIT 1;
    
    IF v_result.id IS NULL THEN
        RETURN 'ERRO: Função não retornou resultado';
    END IF;
    
    -- Verificar tipos
    IF LENGTH(v_result.id) < 1 THEN
        RETURN 'ERRO: ID inválido';
    END IF;
    
    IF v_result.name IS NULL OR LENGTH(v_result.name) < 1 THEN
        RETURN 'ERRO: Nome inválido';
    END IF;
    
    IF v_result.hp IS NULL OR v_result.hp <= 0 THEN
        RETURN 'ERRO: HP inválido';
    END IF;
    
    RETURN FORMAT('SUCESSO: Monstro %s (ID: %s, HP: %s) gerado para andar %s', 
                  v_result.name, v_result.id, v_result.hp, v_test_floor);
END $$;

-- 5. EXECUTAR TESTE
DO $$
DECLARE
    v_test_result TEXT;
BEGIN
    SELECT test_monster_function_types() INTO v_test_result;
    RAISE NOTICE 'Resultado do teste: %', v_test_result;
    
    IF v_test_result NOT LIKE 'SUCESSO:%' THEN
        RAISE EXCEPTION 'Função falhou no teste: %', v_test_result;
    END IF;
    
    RAISE NOTICE 'Função get_monster_for_floor_with_initiative corrigida com sucesso!';
END $$;

-- 6. CRIAR FUNÇÃO ALTERNATIVA SIMPLIFICADA (FALLBACK ADICIONAL)
CREATE OR REPLACE FUNCTION get_monster_for_floor_simple(p_floor INTEGER)
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
    reward_gold INTEGER
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT 
        m.id::TEXT,
        COALESCE(m.name, 'Monstro Andar ' || p_floor) AS name,
        COALESCE(m.level, 1) AS level,
        COALESCE(m.hp, 30 + p_floor * 10) AS hp,
        COALESCE(m.atk, 8 + p_floor * 2) AS attack,
        COALESCE(m.def, 3 + p_floor) AS defense,
        COALESCE(m.speed, 10) AS speed,
        COALESCE(m.behavior, 'balanced') AS behavior,
        COALESCE(m.mana, 0) AS mana,
        COALESCE(m.reward_xp, 5 + p_floor * 2) AS reward_xp,
        COALESCE(m.reward_gold, 3 + p_floor) AS reward_gold
    FROM monsters m
    WHERE m.min_floor <= p_floor
    ORDER BY m.min_floor DESC, RANDOM()
    LIMIT 1;
$$;

-- 7. CONCEDER PERMISSÕES
GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_monster_for_floor_simple(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION test_monster_function_types() TO authenticated;

-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
COMMENT ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) IS 
'Função corrigida para buscar monstro com iniciativa para andar específico. 
CORRIGIDO: Tipos de retorno explícitos (UUID->TEXT) para resolver erro 42804.
Inclui fallback automático e stats escalados sustentavelmente.';

COMMENT ON FUNCTION get_monster_for_floor_simple(INTEGER) IS 
'Função alternativa simplificada para buscar monstro. 
Usa apenas campos básicos para máxima compatibilidade.';

-- ===================================================================================================
-- LOG FINAL
-- ===================================================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CORREÇÃO DA FUNÇÃO MONSTER CONCLUÍDA ===';
    RAISE NOTICE 'Função get_monster_for_floor_with_initiative recriada com tipos corretos';
    RAISE NOTICE 'Função get_monster_for_floor_simple criada como fallback adicional';
    RAISE NOTICE 'Erro 42804 (incompatibilidade UUID/VARCHAR) deve estar resolvido';
    RAISE NOTICE '===============================================';
END $$; 