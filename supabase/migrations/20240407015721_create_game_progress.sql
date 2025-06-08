-- Criação da tabela de progresso do jogo
CREATE TABLE IF NOT EXISTS game_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    player_name VARCHAR(100) NOT NULL,
    current_floor INTEGER DEFAULT 1,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    highest_floor INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas por usuário
CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON game_progress(user_id);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_game_progress_updated_at
    BEFORE UPDATE ON game_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update character floor function will be available after characters migration

-- Habilitar RLS
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game progress
CREATE POLICY "Users can read own progress" ON game_progress
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own progress" ON game_progress
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own progress" ON game_progress
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own progress" ON game_progress
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

-- Game progress permissions

-- =====================================
-- SISTEMA DE EVENTOS ESPECIAIS
-- =====================================

-- Criar enum para tipos de eventos especiais
CREATE TYPE special_event_type AS ENUM ('bonfire', 'treasure_chest', 'magic_fountain');

-- Tabela de eventos especiais
CREATE TABLE IF NOT EXISTS special_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type special_event_type NOT NULL,
    description TEXT NOT NULL,
    hp_restore_percent INTEGER DEFAULT 0, -- Porcentagem de HP restaurado (0-100)
    mana_restore_percent INTEGER DEFAULT 0, -- Porcentagem de Mana restaurado (0-100)
    gold_reward_min INTEGER DEFAULT 0,
    gold_reward_max INTEGER DEFAULT 0,
    chance_weight INTEGER DEFAULT 1, -- Peso para sorteio aleatório
    min_floor INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Função para obter evento especial aleatório para um andar
CREATE OR REPLACE FUNCTION get_special_event_for_floor(p_floor INTEGER)
RETURNS special_events AS $$
DECLARE
    v_event special_events;
BEGIN
    -- Buscar evento aleatório baseado no peso e andar mínimo
    SELECT se.* INTO v_event
    FROM special_events se
    WHERE se.min_floor <= p_floor
    ORDER BY (se.chance_weight * RANDOM()) DESC
    LIMIT 1;
    
    -- Se nenhum evento foi encontrado, retornar fogueira padrão
    IF v_event IS NULL THEN
        SELECT se.* INTO v_event
        FROM special_events se
        WHERE se.type = 'bonfire'
        ORDER BY se.min_floor ASC
        LIMIT 1;
    END IF;
    
    RETURN v_event;
END;
$$ LANGUAGE plpgsql;

-- Função para processar evento especial
CREATE OR REPLACE FUNCTION process_special_event(
    p_character_id UUID,
    p_event_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    hp_restored INTEGER,
    mana_restored INTEGER,
    gold_gained INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_event special_events;
    v_hp_restored INTEGER := 0;
    v_mana_restored INTEGER := 0;
    v_gold_gained INTEGER := 0;
    v_message TEXT;
BEGIN
    -- Buscar dados do personagem
    SELECT c.hp, c.max_hp, c.mana, c.max_mana, c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, 0, 0, 0;
        RETURN;
    END IF;
    
    -- Buscar dados do evento
    SELECT se.* INTO v_event
    FROM special_events se
    WHERE se.id = p_event_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Evento não encontrado'::TEXT, 0, 0, 0;
        RETURN;
    END IF;
    
    -- Calcular restauração de HP
    IF v_event.hp_restore_percent > 0 THEN
        v_hp_restored := CEIL((v_character.max_hp * v_event.hp_restore_percent::NUMERIC) / 100.0) - v_character.hp;
        v_hp_restored := GREATEST(0, v_hp_restored); -- Não pode ser negativo
    END IF;
    
    -- Calcular restauração de Mana
    IF v_event.mana_restore_percent > 0 THEN
        v_mana_restored := CEIL((v_character.max_mana * v_event.mana_restore_percent::NUMERIC) / 100.0) - v_character.mana;
        v_mana_restored := GREATEST(0, v_mana_restored); -- Não pode ser negativo
    END IF;
    
    -- Calcular gold ganho (aleatório entre min e max)
    IF v_event.gold_reward_max > 0 THEN
        v_gold_gained := v_event.gold_reward_min + FLOOR(RANDOM() * (v_event.gold_reward_max - v_event.gold_reward_min + 1));
    END IF;
    
    -- Atualizar personagem
    UPDATE characters
    SET 
        hp = LEAST(max_hp, hp + v_hp_restored),
        mana = LEAST(max_mana, mana + v_mana_restored),
        gold = gold + v_gold_gained,
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Criar mensagem
    v_message := v_event.description;
    IF v_hp_restored > 0 OR v_mana_restored > 0 OR v_gold_gained > 0 THEN
        v_message := v_message || ' Você ganhou:';
        IF v_hp_restored > 0 THEN
            v_message := v_message || ' +' || v_hp_restored || ' HP';
        END IF;
        IF v_mana_restored > 0 THEN
            v_message := v_message || ' +' || v_mana_restored || ' Mana';
        END IF;
        IF v_gold_gained > 0 THEN
            v_message := v_message || ' +' || v_gold_gained || ' Gold';
        END IF;
        v_message := v_message || '!';
    END IF;
    
    RETURN QUERY SELECT TRUE, v_message, v_hp_restored, v_mana_restored, v_gold_gained;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS para special_events
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read special events" ON special_events
    FOR SELECT 
    USING (true);

CREATE POLICY "Service role full access special events" ON special_events
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Permissões serão gerenciadas automaticamente pelo Supabase 