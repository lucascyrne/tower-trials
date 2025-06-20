-- ===================================================================================================
-- MIGRAÇÃO: CORREÇÃO DA AMBIGUIDADE DA COLUNA is_boss
-- ===================================================================================================
-- Data: 2024-12-21
-- Versão: 20241221000014
-- Objetivo: Corrigir erro "column reference 'is_boss' is ambiguous" na função get_monster_for_floor_with_initiative

-- PROBLEMA IDENTIFICADO:
-- Na função get_monster_for_floor_with_initiative existe ambiguidade entre:
-- 1. A variável PL/pgSQL: v_is_boss BOOLEAN
-- 2. A coluna da tabela: monsters.is_boss
-- 
-- SOLUÇÃO: Usar aliases de tabela explícitos para resolver a ambiguidade

-- ===================================================================================================
-- 1. RECRIAR FUNÇÃO COM ALIASES EXPLÍCITOS
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
    
    -- Buscar monstro adequado - CORREÇÃO: usar alias explícito 'm'
    SELECT m.* INTO v_monster_record
    FROM monsters m
    WHERE m.min_floor <= p_floor
    AND COALESCE(m.is_boss, false) = v_is_boss
    ORDER BY m.min_floor DESC, RANDOM()
    LIMIT 1;
    
    -- Fallback se não encontrar - CORREÇÃO: usar alias explícito 'm'
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
-- 2. CONFIGURAR PERMISSÕES
-- ===================================================================================================

GRANT EXECUTE ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) TO authenticated;

-- ===================================================================================================
-- 3. COMENTÁRIOS E LOG FINAL
-- ===================================================================================================

COMMENT ON FUNCTION get_monster_for_floor_with_initiative IS 
'Função para obter monstros escalados por andar com iniciativa. CORRIGIDO: Ambiguidade is_boss resolvida com aliases explícitos.';

-- Log final
DO $$
BEGIN
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== CORREÇÃO DA AMBIGUIDADE is_boss CONCLUÍDA ===';
    RAISE NOTICE 'Problema: Ambiguidade entre variável v_is_boss e coluna monsters.is_boss';
    RAISE NOTICE 'Solução: Uso de aliases explícitos (m.is_boss) em todas as consultas';
    RAISE NOTICE 'Função get_monster_for_floor_with_initiative corrigida';
    RAISE NOTICE '===============================================';
END $$; 