-- Migração: Corrigir Escopo da Variável v_initiative
-- Data: 2024-12-21
-- Versão: 20241221000004
-- Objetivo: Corrigir erro "column v_initiative does not exist"

-- =====================================
-- PROBLEMA IDENTIFICADO
-- =====================================
/*
ERRO: "column "v_initiative" does not exist"
CAUSA: A variável v_initiative estava sendo declarada em um escopo local aninhado
       dentro da função get_monster_for_floor_with_initiative, mas sendo usada
       no escopo global do RETURN QUERY SELECT
*/

-- =====================================
-- SOLUÇÃO: RECRIAR FUNÇÃO COM ESCOPO CORRETO
-- =====================================

-- Remover função com problema de escopo
DROP FUNCTION IF EXISTS get_monster_for_floor_with_initiative(INTEGER) CASCADE;

-- Recriar função com escopo correto das variáveis
CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE(
    id TEXT,
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
    v_cycle INTEGER;
    v_position_in_cycle INTEGER;
    v_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
    v_monster monsters%ROWTYPE;
    v_total_monsters INTEGER;
    v_selected_index INTEGER;
    v_stats RECORD;
    v_build_types TEXT[] := ARRAY['swift', 'brutish', 'magical', 'armored', 'balanced'];
    v_selected_build TEXT;
    v_trait_primary TEXT;
    v_trait_secondary TEXT;
    v_initiative INTEGER;  -- MOVIDO PARA O ESCOPO PRINCIPAL
BEGIN
    -- Determinar se é andar de boss
    v_is_boss := p_floor = ANY(v_boss_floors) OR (p_floor > 20 AND p_floor % 10 = 0);
    
    -- Calcular ciclo e tier
    v_cycle := GREATEST(1, CEIL(p_floor::NUMERIC / 20));
    v_position_in_cycle := ((p_floor - 1) % 20) + 1;
    v_tier := v_cycle;
    
    -- Selecionar tipo de build baseado no andar
    v_selected_build := v_build_types[1 + (p_floor % array_length(v_build_types, 1))];
    
    -- Para bosses, garantir builds mais desafiadoras
    IF v_is_boss THEN
        v_selected_build := CASE (p_floor % 4)
            WHEN 0 THEN 'brutish'
            WHEN 1 THEN 'swift'
            WHEN 2 THEN 'magical'
            WHEN 3 THEN 'armored'
        END;
    END IF;
    
    -- Buscar monstro base
    SELECT COUNT(*) INTO v_total_monsters 
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, (m.min_floor = ANY(v_boss_floors))) = v_is_boss;
    
    IF v_total_monsters = 0 THEN
        -- Fallback para qualquer monstro disponível
        SELECT COUNT(*) INTO v_total_monsters FROM monsters WHERE min_floor <= p_floor;
    END IF;
    
    IF v_total_monsters = 0 THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- Selecionar monstro aleatório
    v_selected_index := 1 + FLOOR(RANDOM() * v_total_monsters);
    
    SELECT m.* INTO v_monster
    FROM monsters m 
    WHERE m.min_floor <= p_floor 
    AND COALESCE(m.is_boss, (m.min_floor = ANY(v_boss_floors))) = v_is_boss
    ORDER BY m.id
    LIMIT 1 OFFSET (v_selected_index - 1);
    
    -- Se não encontrou, pegar qualquer um
    IF v_monster.id IS NULL THEN
        SELECT m.* INTO v_monster
        FROM monsters m 
        WHERE m.min_floor <= p_floor
        ORDER BY m.id
        LIMIT 1 OFFSET (v_selected_index - 1);
    END IF;
    
    -- Gerar stats balanceados usando nova função
    SELECT * INTO v_stats FROM generate_balanced_monster_stats(
        p_floor,
        v_selected_build,
        v_monster.hp,
        v_monster.atk,
        v_monster.def,
        v_monster.speed
    );
    
    -- Definir traits baseados no build
    CASE v_selected_build
        WHEN 'swift' THEN
            v_trait_primary := 'swift';
            v_trait_secondary := 'agile';
        WHEN 'brutish' THEN
            v_trait_primary := 'brutish';
            v_trait_secondary := 'berserker';
        WHEN 'magical' THEN
            v_trait_primary := 'magical';
            v_trait_secondary := 'ethereal';
        WHEN 'armored' THEN
            v_trait_primary := 'armored';
            v_trait_secondary := 'resilient';
        ELSE
            v_trait_primary := 'balanced';
            v_trait_secondary := 'adaptive';
    END CASE;
    
    -- CORRIGIDO: Calcular iniciativa no escopo principal
    v_initiative := calculate_initiative(v_stats.speed, v_stats.dexterity);
    
    -- CORRIGIDO: Converter UUID para TEXT e usar v_initiative corretamente
    RETURN QUERY SELECT
        v_monster.id::TEXT,                               -- CONVERSÃO UUID → TEXT
        v_monster.name || CASE 
            WHEN v_selected_build != 'balanced' THEN ' ' || initcap(v_selected_build)
            ELSE ''
        END,
        GREATEST(1, p_floor - 2 + FLOOR(RANDOM() * 5))::INTEGER,
        v_stats.hp,
        v_stats.atk,
        v_stats.def,
        COALESCE(v_monster.mana, 20 + p_floor),
        v_stats.speed,
        v_monster.behavior::VARCHAR,                      -- Converter ENUM para VARCHAR
        v_monster.min_floor,
        FLOOR(v_monster.reward_xp * (1.0 + (p_floor * 0.1)))::INTEGER,
        FLOOR(v_monster.reward_gold * (1.0 + (p_floor * 0.1)))::INTEGER,
        COALESCE(v_monster.image, '👾'),
        v_tier,
        COALESCE(v_monster.base_tier, 1),
        v_position_in_cycle,
        v_is_boss,
        v_stats.strength,
        v_stats.dexterity,
        v_stats.intelligence,
        v_stats.wisdom,
        v_stats.vitality,
        v_stats.luck,
        v_stats.critical_chance,
        v_stats.critical_damage,
        CASE v_selected_build
            WHEN 'swift' THEN 15.0
            WHEN 'magical' THEN 25.0
            ELSE 10.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'armored' THEN 20.0
            WHEN 'brutish' THEN 15.0
            ELSE 10.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'magical' THEN 15.0
            WHEN 'armored' THEN 20.0
            ELSE 5.0
        END::NUMERIC(5,2),
        5.0::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'swift' THEN 15.0
            ELSE 0.0
        END::NUMERIC(5,2),
        CASE v_selected_build
            WHEN 'magical' THEN 20.0
            ELSE 0.0
        END::NUMERIC(5,2),
        v_trait_primary,
        v_trait_secondary,
        ARRAY[
            CASE v_selected_build
                WHEN 'swift' THEN 'Ataque Rápido'
                WHEN 'brutish' THEN 'Fúria Selvagem'
                WHEN 'magical' THEN 'Rajada Mágica'
                WHEN 'armored' THEN 'Muro de Ferro'
                ELSE 'Adaptação'
            END
        ],
        v_initiative,  -- AGORA NO ESCOPO CORRETO
        0,
        v_selected_build;
END;
$$;

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) IS 
'Versão corrigida que resolve problema de escopo da variável v_initiative';

-- =====================================
-- TESTE DA FUNÇÃO CORRIGIDA
-- =====================================

-- Verificar se a função agora funciona corretamente
DO $$
BEGIN
    -- Tentar executar a função para o andar 1
    PERFORM * FROM get_monster_for_floor_with_initiative(1) LIMIT 1;
    RAISE NOTICE 'Função get_monster_for_floor_with_initiative corrigida com sucesso!';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Ainda há problemas com a função: %', SQLERRM;
END
$$; 