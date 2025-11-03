-- =============================================
-- MIGRATION: Criar Funções Faltantes de Floor e Monster
-- Version: 1.0
-- Description: Adiciona as funções RPC chamadas pelo frontend
-- Dependencies: 00005 (monsters), 00013 (special_events)
-- =============================================

-- ✅ FUNÇÃO 1: get_floor_data - Retorna dados completos do andar
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_floor_number::INTEGER,
        determine_floor_type(p_floor_number)::floor_type,
        is_checkpoint_floor(p_floor_number)::BOOLEAN,
        1::INTEGER,
        CASE 
            WHEN p_floor_number % 10 = 0 THEN 'Andar de Boss - Prepare-se para um desafio épico!'
            WHEN p_floor_number % 5 = 0 THEN 'Andar Elite - Monstros mais fortes aguardam'
            ELSE 'Andar ' || p_floor_number::TEXT
        END::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO 2: get_monster_for_floor_with_initiative - Retorna monstro com iniciativa/velocidade
CREATE OR REPLACE FUNCTION get_monster_for_floor_with_initiative(p_floor INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior monster_behavior,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    critical_resistance DECIMAL,
    physical_resistance DECIMAL,
    magical_resistance DECIMAL,
    debuff_resistance DECIMAL,
    physical_vulnerability DECIMAL,
    magical_vulnerability DECIMAL,
    primary_trait monster_trait,
    secondary_trait monster_trait,
    special_abilities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_monster_for_floor(p_floor);
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO 3: get_monster_for_floor_simple - Versão simplificada de get_monster_for_floor
CREATE OR REPLACE FUNCTION get_monster_for_floor_simple(p_floor INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior monster_behavior,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    critical_resistance DECIMAL,
    physical_resistance DECIMAL,
    magical_resistance DECIMAL,
    debuff_resistance DECIMAL,
    physical_vulnerability DECIMAL,
    magical_vulnerability DECIMAL,
    primary_trait monster_trait,
    secondary_trait monster_trait,
    special_abilities TEXT[]
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_monster_for_floor(p_floor);
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO 4: get_monster_possible_drops_with_info - Busca drops possíveis com informações detalhadas
CREATE OR REPLACE FUNCTION get_monster_possible_drops_with_info(p_monster_id UUID)
RETURNS TABLE (
    drop_id UUID,
    drop_chance DOUBLE PRECISION,
    min_quantity INTEGER,
    max_quantity INTEGER,
    drop_name VARCHAR,
    drop_description TEXT,
    rarity VARCHAR,
    value INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mpd.drop_id,
        mpd.drop_chance,
        mpd.min_quantity,
        mpd.max_quantity,
        md.name,
        md.description,
        md.rarity,
        md.value
    FROM monster_possible_drops mpd
    JOIN monster_drops md ON mpd.drop_id = md.id
    WHERE mpd.monster_id = p_monster_id;
END;
$$ LANGUAGE plpgsql;

-- ✅ FUNÇÃO 5: Corrigir get_special_event_for_floor para retornar TABLE ao invés de tipo
DROP FUNCTION IF EXISTS get_special_event_for_floor(INTEGER) CASCADE;

CREATE FUNCTION get_special_event_for_floor(p_floor INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    type special_event_type,
    description TEXT,
    hp_restore_percent INTEGER,
    mana_restore_percent INTEGER,
    gold_reward_min INTEGER,
    gold_reward_max INTEGER,
    chance_weight INTEGER,
    min_floor INTEGER
) AS $$
DECLARE
    v_event RECORD;
BEGIN
    SELECT se.* INTO v_event
    FROM special_events se
    WHERE se.min_floor <= p_floor
    ORDER BY (se.chance_weight * RANDOM()) DESC
    LIMIT 1;
    
    IF v_event IS NULL THEN
        -- Retornar nada em vez de levantar exceção para melhor UX
        RETURN;
    END IF;
    
    RETURN QUERY SELECT 
        v_event.id,
        v_event.name,
        v_event.type,
        v_event.description,
        v_event.hp_restore_percent,
        v_event.mana_restore_percent,
        v_event.gold_reward_min,
        v_event.gold_reward_max,
        v_event.chance_weight,
        v_event.min_floor;
END;
$$ LANGUAGE plpgsql;
