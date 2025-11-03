-- =============================================
-- MIGRATION: Sistema de Eventos Especiais
-- Version: 2.0
-- Description: Eventos especiais de andar (fogueiras, baús, fontes)
-- Dependencies: 00002 (ENUMs)
-- =============================================

-- === TABELAS ===

CREATE TABLE IF NOT EXISTS special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type special_event_type NOT NULL,
    description TEXT NOT NULL,
    hp_restore_percent INTEGER DEFAULT 0,
    mana_restore_percent INTEGER DEFAULT 0,
    gold_reward_min INTEGER DEFAULT 0,
    gold_reward_max INTEGER DEFAULT 0,
    chance_weight INTEGER DEFAULT 1,
    min_floor INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS floors (
    floor_number INTEGER PRIMARY KEY,
    type floor_type NOT NULL DEFAULT 'common',
    monster_pool UUID[] NOT NULL,
    is_checkpoint BOOLEAN DEFAULT FALSE,
    min_level INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- === TRIGGERS ===

CREATE TRIGGER update_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Buscar evento especial aleatório para andar
CREATE OR REPLACE FUNCTION get_special_event_for_floor(p_floor INTEGER)
RETURNS special_events AS $$
DECLARE
    v_event special_events;
BEGIN
    SELECT se.* INTO v_event
    FROM special_events se
    WHERE se.min_floor <= p_floor
    ORDER BY (se.chance_weight * RANDOM()) DESC
    LIMIT 1;
    
    IF v_event IS NULL THEN
        RAISE EXCEPTION 'Nenhum evento especial disponível para o andar %', p_floor;
    END IF;
    
    RETURN v_event;
END;
$$ LANGUAGE plpgsql;

-- Processar evento especial
CREATE OR REPLACE FUNCTION process_special_event(p_character_id UUID, p_event_id UUID)
RETURNS TABLE(hp_restored INTEGER, mana_restored INTEGER, gold_earned INTEGER, message TEXT) AS $$
DECLARE
    v_character RECORD;
    v_event RECORD;
    v_hp_restored INTEGER := 0;
    v_mana_restored INTEGER := 0;
    v_gold_earned INTEGER := 0;
BEGIN
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Personagem não encontrado'; END IF;
    
    SELECT * INTO v_event FROM special_events WHERE id = p_event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Evento não encontrado'; END IF;
    
    -- Restaurar HP
    IF v_event.hp_restore_percent > 0 THEN
        v_hp_restored := FLOOR(v_character.max_hp * (v_event.hp_restore_percent::DECIMAL / 100));
        UPDATE characters 
        SET hp = LEAST(hp + v_hp_restored, max_hp) 
        WHERE id = p_character_id;
    END IF;
    
    -- Restaurar Mana
    IF v_event.mana_restore_percent > 0 THEN
        v_mana_restored := FLOOR(v_character.max_mana * (v_event.mana_restore_percent::DECIMAL / 100));
        UPDATE characters 
        SET mana = LEAST(mana + v_mana_restored, max_mana) 
        WHERE id = p_character_id;
    END IF;
    
    -- Recompensa de ouro
    IF v_event.gold_reward_max > 0 THEN
        v_gold_earned := v_event.gold_reward_min + FLOOR(RANDOM() * (v_event.gold_reward_max - v_event.gold_reward_min + 1));
        UPDATE characters 
        SET gold = gold + v_gold_earned 
        WHERE id = p_character_id;
    END IF;
    
    RETURN QUERY SELECT v_hp_restored, v_mana_restored, v_gold_earned, v_event.description;
END;
$$ LANGUAGE plpgsql;

-- Determinar tipo de andar
CREATE OR REPLACE FUNCTION determine_floor_type(p_floor INTEGER)
RETURNS floor_type AS $$
BEGIN
    IF p_floor % 10 = 0 THEN
        RETURN 'boss';
    ELSIF p_floor % 5 = 0 THEN
        RETURN 'elite';
    ELSIF RANDOM() < 0.1 THEN
        RETURN 'event';
    ELSE
        RETURN 'common';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Verificar se andar é checkpoint
CREATE OR REPLACE FUNCTION is_checkpoint_floor(p_floor INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (p_floor % 10 = 0);
END;
$$ LANGUAGE plpgsql;

-- Buscar informações de andar
CREATE OR REPLACE FUNCTION get_floor_info(p_floor INTEGER)
RETURNS TABLE(floor_number INTEGER, floor_type floor_type, is_checkpoint BOOLEAN, description TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p_floor,
        determine_floor_type(p_floor),
        is_checkpoint_floor(p_floor),
        CASE 
            WHEN p_floor % 10 = 0 THEN 'Andar de Boss - Prepare-se para um desafio épico!'
            WHEN p_floor % 5 = 0 THEN 'Andar Elite - Monstros mais fortes aguardam'
            ELSE 'Andar Normal'
        END;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

