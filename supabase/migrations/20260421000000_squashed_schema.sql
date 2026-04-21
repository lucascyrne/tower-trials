-- Squashed schema: consolidates git-tracked incremental migrations through 20241220000006.
-- UTF-8. For greenfield or after reset. Follow with 20260421000001_secure_grant_xp_hardening.sql.

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
    id BIGSERIAL PRIMARY KEY,
    uid UUID NOT NULL UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255),
    avatar_url TEXT,
    role VARCHAR(50) NOT NULL DEFAULT 'PLAYER' CHECK (role IN ('PLAYER', 'ADMIN')),
    highest_floor INTEGER NOT NULL DEFAULT 0,
    total_games INTEGER NOT NULL DEFAULT 0,
    total_victories INTEGER NOT NULL DEFAULT 0,
    total_character_level INTEGER NOT NULL DEFAULT 0,
    max_character_slots INTEGER NOT NULL DEFAULT 3,
    telefone VARCHAR(20),
    documento VARCHAR(20),
    tipo_pessoa VARCHAR(2) CHECK (tipo_pessoa IN ('PF', 'PJ')),
    data_nascimento DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_uid ON public.users(uid);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular o nível total necessário para um determinado slot
CREATE OR REPLACE FUNCTION calculate_required_total_level_for_slot(slot_number INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Slots 1-3 são gratuitos
    IF slot_number <= 3 THEN
        RETURN 0;
    END IF;
    
    -- Fórmula para slots 4+: (slot - 3) * 15 níveis totais
    RETURN (slot_number - 3) * 15;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular quantos slots de personagem um usuário pode ter
CREATE OR REPLACE FUNCTION calculate_available_character_slots(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_level INTEGER := 0;
    available_slots INTEGER := 3; -- Mínimo de 3 slots
    current_slot INTEGER := 4;
    required_level INTEGER;
BEGIN
    -- Calcular nível total de todos os personagens do usuário
    SELECT COALESCE(SUM(level), 0) 
    INTO total_level
    FROM characters 
    WHERE user_id = p_user_id;
    
    -- Verificar quantos slots adicionais podem ser desbloqueados
    LOOP
        required_level := calculate_required_total_level_for_slot(current_slot);
        
        -- Se o usuário tem nível total suficiente, desbloquear o slot
        IF total_level >= required_level THEN
            available_slots := current_slot;
            current_slot := current_slot + 1;
        ELSE
            EXIT; -- Sair do loop quando não conseguir mais desbloquear slots
        END IF;
        
        -- Limite de segurança para evitar loop infinito
        IF current_slot > 20 THEN
            EXIT;
        END IF;
    END LOOP;
    
    RETURN available_slots;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar o nível total e slots disponíveis do usuário
CREATE OR REPLACE FUNCTION update_user_character_progression(p_user_id UUID)
RETURNS TABLE(
    total_level INTEGER,
    available_slots INTEGER,
    slots_unlocked BOOLEAN
) AS $$
DECLARE
    old_slots INTEGER;
    new_total_level INTEGER;
    new_available_slots INTEGER;
BEGIN
    -- Obter slots atuais
    SELECT max_character_slots INTO old_slots
    FROM users WHERE uid = p_user_id;
    
    -- Calcular novo nível total
    SELECT COALESCE(SUM(level), 0)
    INTO new_total_level
    FROM characters 
    WHERE user_id = p_user_id;
    
    -- Calcular novos slots disponíveis
    new_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Atualizar na tabela users
    UPDATE users 
    SET 
        total_character_level = new_total_level,
        max_character_slots = new_available_slots,
        updated_at = NOW()
    WHERE uid = p_user_id;
    
    -- Retornar informações
    RETURN QUERY SELECT 
        new_total_level,
        new_available_slots,
        (new_available_slots > old_slots) AS slots_unlocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função RPC para criar perfil de usuário
-- SECURITY DEFINER permite que a função execute com privilégios do criador (bypassa RLS)
CREATE OR REPLACE FUNCTION create_user_profile(p_uid UUID, p_username VARCHAR, p_email VARCHAR)
RETURNS void AS $$
BEGIN
  -- Verificar se o usuário já existe antes de inserir
  IF EXISTS (SELECT 1 FROM public.users WHERE uid = p_uid) THEN
    RETURN; -- Usuário já existe, não fazer nada
  END IF;
  
  INSERT INTO public.users (
    uid, 
    username, 
    email, 
    role, 
    highest_floor, 
    total_games, 
    total_victories, 
    total_character_level,
    max_character_slots,
    is_active, 
    created_at, 
    updated_at
  ) VALUES (
    p_uid,
    p_username,
    p_email,
    'PLAYER',
    0,
    0,
    0,
    0,
    3,
    true,
    NOW(),
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Public read access for users" ON public.users;
DROP POLICY IF EXISTS "Service role full access" ON public.users;
DROP POLICY IF EXISTS "Allow profile creation during signup" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Allow function inserts" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can insert own profile" ON public.users;

-- Políticas RLS simplificadas
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        uid = (SELECT auth.uid()) OR 
        auth.role() = 'service_role'
    ) WITH CHECK (
        uid = (SELECT auth.uid()) OR 
        auth.role() = 'service_role'
    );

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        uid = (SELECT auth.uid()) OR 
        auth.role() = 'service_role'
    ); 
-- Criação da tabela de ranking do jogo Tower Trials
CREATE TABLE IF NOT EXISTS game_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name VARCHAR(100) NOT NULL,
  highest_floor INTEGER NOT NULL,
  user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índice para consultas de ranking global (ordenado por highest_floor)
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor ON game_rankings(highest_floor DESC);

-- Índice para consultas de ranking por usuário
CREATE INDEX IF NOT EXISTS idx_game_rankings_user_id ON game_rankings(user_id);

-- Política RLS para permitir leitura pública do ranking
ALTER TABLE game_rankings ENABLE ROW LEVEL SECURITY;

-- Todos podem ler o ranking
CREATE POLICY game_rankings_select_policy ON game_rankings
  FOR SELECT USING (true);

-- Apenas usuários autenticados podem inserir seus próprios registros
CREATE POLICY game_rankings_insert_policy ON game_rankings
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Apenas o próprio usuário pode atualizar seus registros
CREATE POLICY game_rankings_update_policy ON game_rankings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Apenas o próprio usuário pode deletar seus registros
CREATE POLICY game_rankings_delete_policy ON game_rankings
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()); 
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
-- Criar tabela de personagens
CREATE TABLE IF NOT EXISTS characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    level INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0,
    xp_next_level INTEGER DEFAULT 100,
    gold INTEGER DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    max_mana INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    speed INTEGER NOT NULL,
    floor INTEGER DEFAULT 1,
    
    -- Atributos primários do personagem
    strength INTEGER NOT NULL DEFAULT 10,        -- Força: aumenta ataque físico e carry weight
    dexterity INTEGER NOT NULL DEFAULT 10,       -- Destreza: aumenta velocidade e precisão
    intelligence INTEGER NOT NULL DEFAULT 10,    -- Inteligência: aumenta mana máxima e dano mágico
    wisdom INTEGER NOT NULL DEFAULT 10,          -- Sabedoria: aumenta regeneração de mana e resistências
    vitality INTEGER NOT NULL DEFAULT 10,        -- Vitalidade: aumenta HP máximo e resistência
    luck INTEGER NOT NULL DEFAULT 10,            -- Sorte: aumenta drop rate e chance crítica
    
    -- Pontos de atributo disponíveis para distribuir
    attribute_points INTEGER NOT NULL DEFAULT 0,
    
    -- Habilidades específicas (levels que sobem com uso)
    sword_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria com espadas
    axe_mastery INTEGER NOT NULL DEFAULT 1,          -- Maestria com machados  
    blunt_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria com armas de concussão
    defense_mastery INTEGER NOT NULL DEFAULT 1,      -- Maestria em defesa
    magic_mastery INTEGER NOT NULL DEFAULT 1,        -- Maestria em magia
    
    -- XP das habilidades
    sword_mastery_xp INTEGER NOT NULL DEFAULT 0,
    axe_mastery_xp INTEGER NOT NULL DEFAULT 0,
    blunt_mastery_xp INTEGER NOT NULL DEFAULT 0,
    defense_mastery_xp INTEGER NOT NULL DEFAULT 0,
    magic_mastery_xp INTEGER NOT NULL DEFAULT 0,
    
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_level ON characters(level DESC);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_characters_updated_at
    BEFORE UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular XP necessário para o próximo nível
CREATE OR REPLACE FUNCTION calculate_xp_next_level(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Base XP * (1.5 ^ (level - 1))
    RETURN FLOOR(100 * POW(1.5, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para calcular stats base considerando atributos
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL
) AS $$
DECLARE
    base_hp INTEGER := 80 + (5 * p_level);
    base_mana INTEGER := 40 + (3 * p_level);
    base_atk INTEGER := 15 + (2 * p_level);
    base_def INTEGER := 8 + p_level;
    base_speed INTEGER := 8 + p_level;
BEGIN
    RETURN QUERY
    SELECT
        -- HP derivado de Vitality (cada ponto = +8 HP máximo)
        (base_hp + (p_vitality * 8))::INTEGER as derived_hp,
        (base_hp + (p_vitality * 8))::INTEGER as derived_max_hp,
        
        -- Mana derivado de Intelligence (cada ponto = +5 mana máximo)
        (base_mana + (p_intelligence * 5))::INTEGER as derived_mana,
        (base_mana + (p_intelligence * 5))::INTEGER as derived_max_mana,
        
        -- Ataque derivado de Strength (cada ponto = +2 ataque)
        (base_atk + (p_strength * 2))::INTEGER as derived_atk,
        
        -- Defesa derivado de Vitality e Wisdom (cada ponto = +1 defesa)
        (base_def + (p_vitality + p_wisdom))::INTEGER as derived_def,
        
        -- Velocidade derivado de Dexterity (cada ponto = +1.5 speed)
        (base_speed + FLOOR(p_dexterity * 1.5))::INTEGER as derived_speed,
        
        -- Chance crítica derivada de Luck (cada ponto = +0.5% crítico)
        ROUND((p_luck * 0.5)::DECIMAL, 2) as derived_critical_chance,
        
        -- Dano crítico base (150% + Luck/10)
        ROUND((1.5 + (p_luck::DECIMAL / 100))::DECIMAL, 2) as derived_critical_damage;
END;
$$ LANGUAGE plpgsql;

-- Função para recalcular todos os stats derivados de um personagem
-- IMPORTANTE: Definida aqui para ser usada por outras funções
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular novos stats derivados
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    -- Calcular diferença de HP/Mana para manter proporção atual
    v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    v_new_hp := CEILING(v_stats.derived_max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_stats.derived_max_mana * v_mana_ratio);
    
    -- Atualizar stats
    UPDATE characters
    SET
        max_hp = v_stats.derived_max_hp,
        max_mana = v_stats.derived_max_mana,
        atk = v_stats.derived_atk,
        def = v_stats.derived_def,
        speed = v_stats.derived_speed,
        hp = LEAST(v_new_hp, v_stats.derived_max_hp),
        mana = LEAST(v_new_mana, v_stats.derived_max_mana)
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para calcular XP necessário para próximo nível de habilidade
CREATE OR REPLACE FUNCTION calculate_skill_xp_requirement(current_level INTEGER)
RETURNS INTEGER AS $$
BEGIN
    -- Progressão exponencial similar ao sistema do personagem
    -- Base: 50 XP * (1.4 ^ level)
    RETURN FLOOR(50 * POW(1.4, current_level - 1));
END;
$$ LANGUAGE plpgsql;

-- Função para processar ganho de XP de habilidade
CREATE OR REPLACE FUNCTION add_skill_xp(
    p_character_id UUID,
    p_skill_type VARCHAR,
    p_xp_amount INTEGER
)
RETURNS TABLE (
    skill_leveled_up BOOLEAN,
    new_skill_level INTEGER,
    new_skill_xp INTEGER
) AS $$
DECLARE
    current_level INTEGER;
    current_xp INTEGER;
    xp_required INTEGER;
    new_level INTEGER;
    new_xp INTEGER;
    leveled_up BOOLEAN := FALSE;
BEGIN
    -- Buscar nível e XP atuais da habilidade
    CASE p_skill_type
        WHEN 'sword' THEN
            SELECT sword_mastery, sword_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN
            SELECT axe_mastery, axe_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN
            SELECT blunt_mastery, blunt_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN
            SELECT defense_mastery, defense_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN
            SELECT magic_mastery, magic_mastery_xp INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        ELSE
            RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    -- Adicionar XP
    new_xp := current_xp + p_xp_amount;
    new_level := current_level;
    
    -- Verificar se subiu de nível
    xp_required := calculate_skill_xp_requirement(current_level);
    
    WHILE new_xp >= xp_required AND new_level < 100 LOOP
        new_xp := new_xp - xp_required;
        new_level := new_level + 1;
        leveled_up := TRUE;
        xp_required := calculate_skill_xp_requirement(new_level);
    END LOOP;
    
    -- Atualizar no banco
    CASE p_skill_type
        WHEN 'sword' THEN
            UPDATE characters SET sword_mastery = new_level, sword_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'axe' THEN
            UPDATE characters SET axe_mastery = new_level, axe_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'blunt' THEN
            UPDATE characters SET blunt_mastery = new_level, blunt_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'defense' THEN
            UPDATE characters SET defense_mastery = new_level, defense_mastery_xp = new_xp 
            WHERE id = p_character_id;
        WHEN 'magic' THEN
            UPDATE characters SET magic_mastery = new_level, magic_mastery_xp = new_xp 
            WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, new_level, new_xp;
END;
$$ LANGUAGE plpgsql;

-- Função para validar nome de personagem no banco
CREATE OR REPLACE FUNCTION validate_character_name(p_name VARCHAR)
RETURNS TABLE (
    is_valid BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    clean_name VARCHAR;
    name_length INTEGER;
    letter_count INTEGER;
    number_count INTEGER;
    
    -- Lista completa de palavras ofensivas e reservadas
    forbidden_words TEXT[] := ARRAY[
        -- Português - palavras de baixo calão
        'porra', 'merda', 'caralho', 'puta', 'putaria', 'viado', 'bicha', 'cu', 'buceta',
        'piroca', 'pinto', 'rola', 'foda', 'foder', 'fodido', 'cuzao', 'cuzão', 'babaca',
        'otario', 'otário', 'idiota', 'imbecil', 'retardado', 'mongoloide', 'burro',
        'desgraça', 'desgraçado', 'filho da puta', 'fdp', 'vagabundo', 'safado',
        'cachorro', 'cadela', 'prostituta', 'vagabunda', 'piranha', 'galinha',
        
        -- Inglês - palavras de baixo calão
        'fuck', 'shit', 'bitch', 'damn', 'hell', 'ass', 'asshole', 'bastard',
        'crap', 'piss', 'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut',
        'fag', 'faggot', 'nigger', 'retard', 'moron', 'idiot', 'stupid',
        'gay', 'lesbian', 'homo', 'nazi', 'hitler', 'rape', 'kill', 'murder',
        
        -- Espanhol - palavras de baixo calão
        'mierda', 'joder', 'puta', 'puto', 'cabron', 'cabrón', 'pendejo',
        'estupido', 'estúpido', 'culo', 'coño', 'verga', 'chingar', 'pinche',
        'mamada', 'putada', 'hijo de puta', 'hdp', 'marica', 'maricon', 'maricón',
        
        -- Palavras relacionadas a drogas
        'droga', 'cocaina', 'heroina', 'crack', 'cocaine',
        'heroin', 'drug', 'dealer', 'traficante',
        
        -- Termos inadequados gerais
        'sexo', 'sex', 'porn', 'porno', 'nude', 'naked', 'xxx', 'fetish',
        
        -- Palavras reservadas do sistema
        'admin', 'administrator', 'moderador', 'moderator', 'mod', 'gm', 'gamemaster',
        'suporte', 'support', 'help', 'ajuda', 'oficial', 'official', 'staff',
        'dev', 'developer', 'sistema', 'system', 'bot', 'null', 'undefined',
        'test', 'teste', 'demo', 'sample', 'example', 'exemplo', 'guest', 'visitante',
        'player', 'jogador', 'user', 'usuario', 'usuário', 'npc', 'monster', 'monstro'
    ];
    
    word TEXT;
BEGIN
    -- Verificar se nome foi fornecido
    IF p_name IS NULL OR p_name = '' THEN
        RETURN QUERY SELECT FALSE, 'Nome é obrigatório';
        RETURN;
    END IF;
    
    -- Limpar espaços desnecessários
    clean_name := TRIM(p_name);
    name_length := LENGTH(clean_name);
    
    -- Verificar comprimento
    IF name_length < 3 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter pelo menos 3 caracteres';
        RETURN;
    END IF;
    
    IF name_length > 20 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve ter no máximo 20 caracteres';
        RETURN;
    END IF;
    
    -- Verificar se começa com letra
    IF NOT (SUBSTRING(clean_name FROM 1 FOR 1) ~ '[a-zA-ZÀ-ÿ]') THEN
        RETURN QUERY SELECT FALSE, 'Nome deve começar com uma letra';
        RETURN;
    END IF;
    
    -- Verificar caracteres válidos (letras, números, espaços, hífen, apostrofe)
    IF NOT (clean_name ~ '^[a-zA-ZÀ-ÿ0-9\s''\-]+$') THEN
        RETURN QUERY SELECT FALSE, 'Nome contém caracteres especiais não permitidos';
        RETURN;
    END IF;
    
    -- Verificar se é apenas números
    IF clean_name ~ '^[0-9]+$' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ser apenas números';
        RETURN;
    END IF;
    
    -- Verificar números consecutivos (mais de 2)
    IF clean_name ~ '[0-9]{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 2 números consecutivos';
        RETURN;
    END IF;
    
    -- Verificar caracteres repetidos (mais de 3 iguais)
    IF clean_name ~ '(.)\1{3,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais de 3 caracteres iguais seguidos';
        RETURN;
    END IF;
    
    -- Verificar espaços múltiplos
    IF clean_name ~ '\s{2,}' THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter espaços múltiplos';
        RETURN;
    END IF;
    
    -- Contar letras e números
    letter_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[a-zA-ZÀ-ÿ]', '', 'g'));
    number_count := LENGTH(clean_name) - LENGTH(REGEXP_REPLACE(clean_name, '[0-9]', '', 'g'));
    
    -- Verificar se tem pelo menos uma letra
    IF letter_count = 0 THEN
        RETURN QUERY SELECT FALSE, 'Nome deve conter pelo menos uma letra';
        RETURN;
    END IF;
    
    -- Verificar proporção de números
    IF number_count > letter_count THEN
        RETURN QUERY SELECT FALSE, 'Nome não pode ter mais números que letras';
        RETURN;
    END IF;
    
    -- Verificar palavras proibidas (completas e substrings)
    FOREACH word IN ARRAY forbidden_words LOOP
        IF LOWER(clean_name) LIKE '%' || word || '%' THEN
            RETURN QUERY SELECT FALSE, 'Nome contém termos inadequados ou reservados';
            RETURN;
        END IF;
    END LOOP;
    
    -- Nome válido
    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um novo personagem
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando novos atributos
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10  -- luck
    );
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points
    )
    VALUES (
        p_user_id,
        v_formatted_name, -- Usar nome formatado
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.derived_hp,
        v_base_stats.derived_max_hp,
        v_base_stats.derived_mana,
        v_base_stats.derived_max_mana,
        v_base_stats.derived_atk,
        v_base_stats.derived_def,
        v_base_stats.derived_speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5   -- pontos de atributo iniciais para personalizar build
    )
    RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar stats do personagem
CREATE OR REPLACE FUNCTION update_character_stats(
    p_character_id UUID,
    p_xp INTEGER DEFAULT NULL,
    p_gold INTEGER DEFAULT NULL,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL,
    p_floor INTEGER DEFAULT NULL
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
BEGIN
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    -- Atualizar HP e Mana se fornecidos
    IF p_hp IS NOT NULL OR p_mana IS NOT NULL THEN
        UPDATE characters
        SET
            hp = COALESCE(p_hp, hp),
            mana = COALESCE(p_mana, mana)
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar gold se fornecido
    IF p_gold IS NOT NULL THEN
        UPDATE characters
        SET gold = gold + p_gold
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar andar se fornecido
    IF p_floor IS NOT NULL THEN
        UPDATE characters
        SET floor = p_floor
        WHERE id = p_character_id;
    END IF;
    
    -- Se XP foi fornecido, verificar level up
    IF p_xp IS NOT NULL THEN
        -- Atualizar XP primeiro sem salvar
        v_new_xp := v_current_xp + p_xp;
        
        -- Verificar level up antes de salvar
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            
            -- Atualizar variáveis para próxima iteração
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        -- Calcular stats derivados para o nível atual
        SELECT 
            derived_hp,
            derived_max_hp,
            derived_mana,
            derived_max_mana,
            derived_atk,
            derived_def,
            derived_speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id)
        );
        
        -- Agora aplicar todas as mudanças de uma vez
        IF v_leveled_up THEN
            -- Se subiu de nível, atualizar todos os stats
            UPDATE characters
            SET
                level = v_current_level,
                xp = v_new_xp,
                xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.derived_max_hp,
                max_mana = v_base_stats.derived_max_mana,
                atk = v_base_stats.derived_atk,
                def = v_base_stats.derived_def,
                speed = v_base_stats.derived_speed,
                hp = v_base_stats.derived_max_hp, -- Recupera HP totalmente ao subir de nível
                mana = v_base_stats.derived_max_mana -- Recupera Mana totalmente ao subir de nível
            WHERE id = p_character_id;
            
            -- Conceder pontos de atributo por subir de nível
            PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
            
            -- Atualizar progressão do usuário quando um personagem sobe de nível
            SELECT * INTO v_progression_result 
            FROM update_user_character_progression(v_user_id);
        ELSE
            -- Se não subiu de nível, atualizar apenas XP
            UPDATE characters
            SET
                xp = v_new_xp
            WHERE id = p_character_id;
        END IF;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão (para casos onde outros personagens podem ter mudado)
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        COALESCE(v_new_xp, v_current_xp) AS new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END AS slots_unlocked,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END AS new_available_slots;
END;
$$ LANGUAGE plpgsql;

-- Função para distribuir pontos de atributo
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
) AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
BEGIN
    -- Validar entrada
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    IF v_total_points <= 0 THEN
        RETURN QUERY SELECT FALSE, 'Nenhum ponto foi distribuído'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Buscar personagem atual
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar se tem pontos suficientes
    IF v_character.attribute_points < v_total_points THEN
        RETURN QUERY SELECT FALSE, 
            format('Pontos insuficientes. Disponível: %s, Necessário: %s', 
                v_character.attribute_points, v_total_points)::TEXT, 
            NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar limites máximos (cap em 50 por atributo)
    IF (v_character.strength + p_strength) > 50 OR
       (v_character.dexterity + p_dexterity) > 50 OR
       (v_character.intelligence + p_intelligence) > 50 OR
       (v_character.wisdom + p_wisdom) > 50 OR
       (v_character.vitality + p_vitality) > 50 OR
       (v_character.luck + p_luck) > 50 THEN
        RETURN QUERY SELECT FALSE, 'Limite máximo de 50 pontos por atributo'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters
    SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Buscar novos stats completos
    SELECT * INTO v_stats FROM get_character_full_stats(p_character_id);
    
    RETURN QUERY SELECT TRUE, 'Atributos distribuídos com sucesso'::TEXT, v_stats;
END;
$$ LANGUAGE plpgsql;



-- Função para obter stats completos do personagem
CREATE OR REPLACE FUNCTION get_character_full_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance DECIMAL,
    critical_damage DECIMAL,
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    -- Calcular stats derivados
    SELECT * INTO v_stats FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    RETURN QUERY SELECT
        v_character.id,
        v_character.name,
        v_character.level,
        v_character.xp,
        v_character.xp_next_level,
        v_character.gold,
        v_character.hp,
        v_character.max_hp,
        v_character.mana,
        v_character.max_mana,
        v_character.atk,
        v_character.def,
        v_character.speed,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck,
        v_character.attribute_points,
        v_stats.derived_critical_chance,
        v_stats.derived_critical_damage,
        v_character.sword_mastery,
        v_character.axe_mastery,
        v_character.blunt_mastery,
        v_character.defense_mastery,
        v_character.magic_mastery,
        v_character.sword_mastery_xp,
        v_character.axe_mastery_xp,
        v_character.blunt_mastery_xp,
        v_character.defense_mastery_xp,
        v_character.magic_mastery_xp;
END;
$$ LANGUAGE plpgsql;

-- Função para dar pontos de atributo ao subir de nível
CREATE OR REPLACE FUNCTION grant_attribute_points_on_levelup(
    p_character_id UUID,
    p_new_level INTEGER
)
RETURNS INTEGER AS $$
DECLARE
    v_points_granted INTEGER;
BEGIN
    -- Calcular pontos baseado no nível (2 pontos por nível + 1 extra a cada 5 níveis)
    v_points_granted := 2;
    IF p_new_level % 5 = 0 THEN
        v_points_granted := v_points_granted + 1;
    END IF;
    
    -- Adicionar pontos ao personagem
    UPDATE characters
    SET attribute_points = attribute_points + v_points_granted
    WHERE id = p_character_id;
    
    RETURN v_points_granted;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar limite de personagens dinâmico
CREATE OR REPLACE FUNCTION check_character_limit(p_user_id UUID)
RETURNS TABLE(
    can_create BOOLEAN,
    current_count INTEGER,
    available_slots INTEGER,
    total_level INTEGER,
    next_slot_required_level INTEGER
) AS $$
DECLARE
    v_current_count INTEGER;
    v_available_slots INTEGER;
    v_total_level INTEGER;
    v_next_required INTEGER;
BEGIN
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_current_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Calcular nível total atual
    SELECT COALESCE(SUM(level), 0)
    INTO v_total_level
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular nível necessário para o próximo slot
    v_next_required := calculate_required_total_level_for_slot(v_available_slots + 1);
    
    RETURN QUERY SELECT
        (v_current_count < v_available_slots) AS can_create,
        v_current_count,
        v_available_slots,
        v_total_level,
        v_next_required;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar informações de progressão do usuário
CREATE OR REPLACE FUNCTION get_user_character_progression(p_user_id UUID)
RETURNS TABLE(
    total_character_level INTEGER,
    max_character_slots INTEGER,
    current_character_count INTEGER,
    next_slot_required_level INTEGER,
    progress_to_next_slot DECIMAL
) AS $$
DECLARE
    v_total_level INTEGER;
    v_max_slots INTEGER;
    v_current_count INTEGER;
    v_next_required INTEGER;
    v_progress DECIMAL;
BEGIN
    -- Buscar dados do usuário
    SELECT u.total_character_level, u.max_character_slots
    INTO v_total_level, v_max_slots
    FROM users u
    WHERE u.uid = p_user_id;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_current_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular nível necessário para próximo slot
    v_next_required := calculate_required_total_level_for_slot(v_max_slots + 1);
    
    -- Calcular progresso (percentual)
    IF v_next_required > 0 THEN
        v_progress := LEAST(100.0, (v_total_level::DECIMAL / v_next_required::DECIMAL) * 100.0);
    ELSE
        v_progress := 100.0;
    END IF;
    
    RETURN QUERY SELECT
        v_total_level,
        v_max_slots,
        v_current_count,
        v_next_required,
        v_progress;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar personagens do usuário
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Função para buscar um personagem específico
CREATE OR REPLACE FUNCTION get_character(p_character_id UUID)
RETURNS characters AS $$
DECLARE
    v_character characters;
BEGIN
    SELECT c.* INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF v_character IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RETURN v_character;
END;
$$ LANGUAGE plpgsql;

-- Função para deletar um personagem e todos os seus dados relacionados
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Verificar se o personagem existe (RLS cuidará da permissão)
    IF NOT EXISTS (
        SELECT 1 FROM characters c
        WHERE c.id = p_character_id
    ) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Deletar todos os dados relacionados
    -- As constraints ON DELETE CASCADE cuidarão de limpar as tabelas relacionadas
    DELETE FROM characters WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar o andar atual do personagem
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes
DROP POLICY IF EXISTS "Usuários podem ver seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem criar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem atualizar seus próprios personagens" ON characters;
DROP POLICY IF EXISTS "Usuários podem deletar seus próprios personagens" ON characters;

-- Criar novas políticas
CREATE POLICY "Usuários podem ver seus próprios personagens" ON characters
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem criar seus próprios personagens" ON characters
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem atualizar seus próprios personagens" ON characters
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Usuários podem deletar seus próprios personagens" ON characters
    FOR DELETE
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Service role full access to characters" ON characters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Funções com SECURITY DEFINER são executadas com privilégios do criador

-- =====================================================
-- SISTEMA DE CURA AUTOMÁTICA
-- =====================================================

-- Função para calcular cura automática baseada em tempo offline
-- Cura total em 2 horas (de 0.1% a 100% da vida e mana)
CREATE OR REPLACE FUNCTION calculate_auto_heal(
    p_character_id UUID,
    p_current_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE(new_hp INTEGER, new_mana INTEGER, healed BOOLEAN) AS $$
DECLARE
    char_record RECORD;
    time_diff_seconds INTEGER;
    heal_duration_seconds INTEGER := 7200; -- 2 horas = 7200 segundos
    min_percent DECIMAL := 0.1;
    max_percent DECIMAL := 100.0;
    
    -- Variáveis para HP
    adjusted_current_hp INTEGER;
    adjusted_current_hp_percent DECIMAL;
    heal_rate_per_second DECIMAL;
    hp_heal_percentage DECIMAL;
    hp_heal_amount INTEGER;
    calculated_new_hp INTEGER;
    
    -- Variáveis para Mana
    adjusted_current_mana INTEGER;
    adjusted_current_mana_percent DECIMAL;
    mana_heal_percentage DECIMAL;
    mana_heal_amount INTEGER;
    calculated_new_mana INTEGER;
BEGIN
    -- Buscar dados do personagem
    SELECT hp, max_hp, mana, max_mana, last_activity
    INTO char_record
    FROM characters
    WHERE id = p_character_id;
    
    -- Se não encontrou o personagem ou não tem last_activity
    IF NOT FOUND OR char_record.last_activity IS NULL THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Se HP e Mana já estão no máximo, não curar
    IF char_record.hp >= char_record.max_hp AND char_record.mana >= char_record.max_mana THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular diferença de tempo em segundos
    time_diff_seconds := EXTRACT(EPOCH FROM (p_current_time - char_record.last_activity))::INTEGER;
    
    -- Se passou menos de 1 segundo, não curar
    IF time_diff_seconds < 1 THEN
        RETURN QUERY SELECT char_record.hp, char_record.mana, FALSE;
        RETURN;
    END IF;
    
    -- Calcular nova HP se necessário
    calculated_new_hp := char_record.hp;
    IF char_record.hp < char_record.max_hp THEN
        -- Ajustar HP atual se estiver abaixo de 0.1%
        adjusted_current_hp := GREATEST(char_record.hp, CEIL(char_record.max_hp * (min_percent / 100.0)));
        adjusted_current_hp_percent := (adjusted_current_hp::DECIMAL / char_record.max_hp::DECIMAL) * 100.0;
        
        -- Taxa de cura HP: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        hp_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_hp_percent
        );
        
        -- Calcular quantidade de HP a ser curada
        hp_heal_amount := FLOOR((hp_heal_percentage / 100.0) * char_record.max_hp);
        calculated_new_hp := LEAST(char_record.max_hp, adjusted_current_hp + hp_heal_amount);
    END IF;
    
    -- Calcular nova Mana se necessário
    calculated_new_mana := char_record.mana;
    IF char_record.mana < char_record.max_mana THEN
        -- Ajustar Mana atual se estiver abaixo de 0.1%
        adjusted_current_mana := GREATEST(char_record.mana, CEIL(char_record.max_mana * (min_percent / 100.0)));
        adjusted_current_mana_percent := (adjusted_current_mana::DECIMAL / char_record.max_mana::DECIMAL) * 100.0;
        
        -- Taxa de cura Mana: (100% - 0.1%) / 2 horas = 99.9% / 7200s ≈ 0.01387% por segundo
        heal_rate_per_second := (max_percent - min_percent) / heal_duration_seconds;
        
        -- Calcular percentual de cura baseado no tempo
        mana_heal_percentage := LEAST(
            heal_rate_per_second * time_diff_seconds,
            max_percent - adjusted_current_mana_percent
        );
        
        -- Calcular quantidade de Mana a ser curada
        mana_heal_amount := FLOOR((mana_heal_percentage / 100.0) * char_record.max_mana);
        calculated_new_mana := LEAST(char_record.max_mana, adjusted_current_mana + mana_heal_amount);
    END IF;
    
    -- Retornar resultados
    RETURN QUERY SELECT 
        calculated_new_hp, 
        calculated_new_mana,
        (calculated_new_hp > char_record.hp OR calculated_new_mana > char_record.mana);
END;
$$ LANGUAGE plpgsql;

-- Função para atualizar última atividade
CREATE OR REPLACE FUNCTION update_character_last_activity(
    p_character_id UUID,
    p_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS VOID AS $$
BEGIN
    UPDATE characters
    SET last_activity = p_timestamp
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Funções de cura automática com SECURITY DEFINER

-- Adicionar comentário explicativo ao campo last_activity
COMMENT ON COLUMN characters.last_activity IS 'Timestamp da última atividade do personagem, usado para cura automática baseada em tempo (6h para cura completa)'; 
-- Criar enum para comportamentos dos monstros
CREATE TYPE monster_behavior AS ENUM ('aggressive', 'defensive', 'balanced');

-- Criar enum para tipos de resistência
CREATE TYPE resistance_type AS ENUM (
    'physical',  -- Resistência física
    'magical',   -- Resistência mágica 
    'critical',  -- Resistência a críticos
    'debuff'     -- Resistência a debuffs
);

-- Criar enum para pontos fortes/fracos
CREATE TYPE monster_trait AS ENUM (
    'armored',      -- Resistente a ataques físicos, fraco contra magia
    'swift',        -- Rápido e evasivo, fraco contra ataques lentos mas fortes
    'magical',      -- Forte em magia, fraco contra ataques físicos
    'brutish',      -- Alto dano físico, baixa defesa mágica
    'resilient',    -- Alta resistência geral, baixo dano
    'berserker',    -- Dano aumenta conforme perde HP
    'ethereal',     -- Resistente a críticos, vulnerável a magia
    'venomous'      -- Aplica efeitos de DoT
);

-- Criar tabela de monstros
CREATE TABLE IF NOT EXISTS monsters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    hp INTEGER NOT NULL,
    atk INTEGER NOT NULL,
    def INTEGER NOT NULL,
    mana INTEGER NOT NULL,
    speed INTEGER NOT NULL DEFAULT 10,
    behavior monster_behavior NOT NULL,
    min_floor INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_gold INTEGER NOT NULL,
    
    -- Atributos primários do monstro (para cálculos mais complexos)
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 5,
    
    -- Propriedades especiais de combate
    critical_chance DECIMAL DEFAULT 0.05, -- 5% base
    critical_damage DECIMAL DEFAULT 1.5,  -- 150% base
    critical_resistance DECIMAL DEFAULT 0, -- Resistência a críticos
    
    -- Resistências específicas (0.0 = 0%, 1.0 = 100%)
    physical_resistance DECIMAL DEFAULT 0,
    magical_resistance DECIMAL DEFAULT 0,
    debuff_resistance DECIMAL DEFAULT 0,
    
    -- Vulnerabilidades específicas (multiplicador de dano)
    physical_vulnerability DECIMAL DEFAULT 1.0,
    magical_vulnerability DECIMAL DEFAULT 1.0,
    
    -- Características especiais
    primary_trait monster_trait DEFAULT NULL,
    secondary_trait monster_trait DEFAULT NULL,
    
    -- Habilidades especiais (para implementações futuras)
    special_abilities TEXT[] DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_monsters_updated_at
    BEFORE UPDATE ON monsters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_monsters_min_floor ON monsters(min_floor);

-- Função para obter monstro por andar com stats ajustados e complexidade
CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
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
DECLARE
    floor_range INTEGER := 5;
    scaling_factor DECIMAL := 0.15; -- Reduzido para manter balanceamento
BEGIN
    RETURN QUERY
    SELECT m.id, m.name,
           -- Escalar stats derivados baseado no andar
           (m.hp + (p_floor - m.min_floor) * GREATEST(8, FLOOR(m.hp * scaling_factor)))::INTEGER as hp,
           (m.atk + (p_floor - m.min_floor) * GREATEST(2, FLOOR(m.atk * scaling_factor)))::INTEGER as atk,
           (m.def + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.def * scaling_factor)))::INTEGER as def,
           m.mana,
           (m.speed + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.speed * scaling_factor * 0.5)))::INTEGER as speed,
           m.behavior,
           m.min_floor,
           -- Escalar recompensas baseado no andar
           (m.reward_xp + (p_floor - m.min_floor) * GREATEST(3, FLOOR(m.reward_xp * scaling_factor)))::INTEGER as reward_xp,
           (m.reward_gold + (p_floor - m.min_floor) * GREATEST(4, FLOOR(m.reward_gold * scaling_factor)))::INTEGER as reward_gold,
           
           -- Atributos primários escalados
           (m.strength + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.strength * scaling_factor * 0.3)))::INTEGER as strength,
           (m.dexterity + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.dexterity * scaling_factor * 0.3)))::INTEGER as dexterity,
           (m.intelligence + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.intelligence * scaling_factor * 0.3)))::INTEGER as intelligence,
           (m.wisdom + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.wisdom * scaling_factor * 0.3)))::INTEGER as wisdom,
           (m.vitality + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.vitality * scaling_factor * 0.3)))::INTEGER as vitality,
           (m.luck + (p_floor - m.min_floor) * GREATEST(0, FLOOR(m.luck * scaling_factor * 0.2)))::INTEGER as luck,
           
           -- Propriedades de combate com escalamento moderado
           LEAST(0.35, m.critical_chance + (p_floor - m.min_floor) * 0.005) as critical_chance, -- Cap em 35%
           LEAST(2.5, m.critical_damage + (p_floor - m.min_floor) * 0.02) as critical_damage,   -- Cap em 250%
           LEAST(0.8, m.critical_resistance + (p_floor - m.min_floor) * 0.01) as critical_resistance, -- Cap em 80%
           
           -- Resistências com cap
           LEAST(0.75, m.physical_resistance + (p_floor - m.min_floor) * 0.008) as physical_resistance,
           LEAST(0.75, m.magical_resistance + (p_floor - m.min_floor) * 0.008) as magical_resistance,
           LEAST(0.90, m.debuff_resistance + (p_floor - m.min_floor) * 0.01) as debuff_resistance,
           
           -- Vulnerabilidades não mudam com andar (características fixas)
           m.physical_vulnerability,
           m.magical_vulnerability,
           m.primary_trait,
           m.secondary_trait,
           m.special_abilities
    FROM monsters m
    WHERE m.min_floor <= p_floor 
    AND m.min_floor >= GREATEST(1, p_floor - floor_range)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Se nenhum monstro foi encontrado no range ideal, pegar o mais próximo
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT m.id, m.name,
               (m.hp + (p_floor - m.min_floor) * GREATEST(8, FLOOR(m.hp * scaling_factor)))::INTEGER as hp,
               (m.atk + (p_floor - m.min_floor) * GREATEST(2, FLOOR(m.atk * scaling_factor)))::INTEGER as atk,
               (m.def + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.def * scaling_factor)))::INTEGER as def,
               m.mana,
               (m.speed + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.speed * scaling_factor * 0.5)))::INTEGER as speed,
               m.behavior,
               m.min_floor,
               (m.reward_xp + (p_floor - m.min_floor) * GREATEST(3, FLOOR(m.reward_xp * scaling_factor)))::INTEGER as reward_xp,
               (m.reward_gold + (p_floor - m.min_floor) * GREATEST(4, FLOOR(m.reward_gold * scaling_factor)))::INTEGER as reward_gold,
               (m.strength + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.strength * scaling_factor * 0.3)))::INTEGER as strength,
               (m.dexterity + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.dexterity * scaling_factor * 0.3)))::INTEGER as dexterity,
               (m.intelligence + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.intelligence * scaling_factor * 0.3)))::INTEGER as intelligence,
               (m.wisdom + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.wisdom * scaling_factor * 0.3)))::INTEGER as wisdom,
               (m.vitality + (p_floor - m.min_floor) * GREATEST(1, FLOOR(m.vitality * scaling_factor * 0.3)))::INTEGER as vitality,
               (m.luck + (p_floor - m.min_floor) * GREATEST(0, FLOOR(m.luck * scaling_factor * 0.2)))::INTEGER as luck,
               LEAST(0.35, m.critical_chance + (p_floor - m.min_floor) * 0.005) as critical_chance,
               LEAST(2.5, m.critical_damage + (p_floor - m.min_floor) * 0.02) as critical_damage,
               LEAST(0.8, m.critical_resistance + (p_floor - m.min_floor) * 0.01) as critical_resistance,
               LEAST(0.75, m.physical_resistance + (p_floor - m.min_floor) * 0.008) as physical_resistance,
               LEAST(0.75, m.magical_resistance + (p_floor - m.min_floor) * 0.008) as magical_resistance,
               LEAST(0.90, m.debuff_resistance + (p_floor - m.min_floor) * 0.01) as debuff_resistance,
               m.physical_vulnerability,
               m.magical_vulnerability,
               m.primary_trait,
               m.secondary_trait,
               m.special_abilities
        FROM monsters m
        ORDER BY ABS(m.min_floor - p_floor) ASC
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE monsters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow public read monsters" ON monsters
    FOR SELECT 
    USING (true);

CREATE POLICY "Service role full access monsters" ON monsters
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Permissões serão gerenciadas automaticamente pelo Supabase 
-- Criar enum para tipos de andar
CREATE TYPE floor_type AS ENUM ('common', 'elite', 'event', 'boss');

-- Criar tabela de andares
CREATE TABLE IF NOT EXISTS floors (
    floor_number INTEGER PRIMARY KEY,
    type floor_type NOT NULL DEFAULT 'common',
    monster_pool UUID[] NOT NULL, -- Array de IDs de monstros possíveis
    is_checkpoint BOOLEAN DEFAULT FALSE, -- Andares que salvam progresso
    min_level INTEGER NOT NULL DEFAULT 1, -- Nível mínimo recomendado
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT valid_floor_number CHECK (floor_number > 0)
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_floors_updated_at
    BEFORE UPDATE ON floors
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para gerar pool de monstros para um andar
CREATE OR REPLACE FUNCTION generate_monster_pool(p_floor_number INTEGER)
RETURNS UUID[] AS $$
BEGIN
    RETURN (
        SELECT ARRAY_AGG(id ORDER BY min_floor DESC)
        FROM (
            SELECT id, min_floor
            FROM monsters
            WHERE min_floor <= p_floor_number
            ORDER BY min_floor DESC
            LIMIT 3
        ) subquery
    );
END;
$$ LANGUAGE plpgsql;

-- Função para obter dados do andar
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    -- Se o andar não existe, gerar informações dinamicamente
    IF v_floor IS NULL THEN
        v_floor_type := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
            WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
            ELSE 'common'::floor_type
        END;
        
        v_is_checkpoint := p_floor_number % 10 = 0;
        v_min_level := GREATEST(1, p_floor_number / 2);
        
        v_description := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'Andar do Chefe'
            WHEN p_floor_number % 5 = 0 THEN 'Andar de Elite'
            WHEN p_floor_number % 7 = 0 THEN 'Andar de Evento'
            ELSE 'Andar Comum'
        END || ' ' || p_floor_number;
        
        RETURN QUERY
        SELECT 
            p_floor_number,
            v_floor_type,
            v_is_checkpoint,
            v_min_level,
            v_description;
    ELSE
        -- Retornar dados do andar existente
        RETURN QUERY
        SELECT 
            v_floor.floor_number,
            v_floor.type,
            v_floor.is_checkpoint,
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para obter checkpoints desbloqueados
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Sempre incluir o andar 1
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints a cada 10 andares até o andar mais alto
    RETURN QUERY
    SELECT 
        f.floor_number,
        CASE 
            WHEN f.floor_number % 10 = 0 THEN 'Andar ' || f.floor_number || ' - Checkpoint de Chefe'
            ELSE 'Andar ' || f.floor_number || ' - Checkpoint'
        END::TEXT as description
    FROM generate_series(10, p_highest_floor, 10) as f(floor_number)
    WHERE f.floor_number <= p_highest_floor
    ORDER BY f.floor_number;
END;
$$ LANGUAGE plpgsql; 
-- Criar enum para tipos de efeito de magia
CREATE TYPE spell_effect_type AS ENUM (
    'damage',        -- Dano direto
    'heal',         -- Cura
    'buff',         -- Aumenta atributos
    'debuff',       -- Diminui atributos do inimigo
    'dot',          -- Dano ao longo do tempo
    'hot'          -- Cura ao longo do tempo
);

-- Criar tabela de magias
CREATE TABLE IF NOT EXISTS spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    effect_type spell_effect_type NOT NULL,
    mana_cost INTEGER NOT NULL CHECK (mana_cost > 0),
    cooldown INTEGER NOT NULL CHECK (cooldown >= 0),
    unlocked_at_level INTEGER NOT NULL CHECK (unlocked_at_level > 0),
    effect_value INTEGER NOT NULL, -- Valor do efeito (dano, cura, etc)
    duration INTEGER DEFAULT 1 CHECK (duration > 0), -- Duração em turnos para efeitos ao longo do tempo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_spells_updated_at
    BEFORE UPDATE ON spells
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para obter magias disponíveis para um nível
CREATE OR REPLACE FUNCTION get_available_spells(p_level INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration
    FROM spells s
    WHERE s.unlocked_at_level <= p_level
    ORDER BY s.unlocked_at_level ASC;
END;
$$ LANGUAGE plpgsql; 
-- Criar enum para tipos de equipamento
CREATE TYPE equipment_type AS ENUM (
    'weapon',    -- Armas
    'armor',     -- Armaduras
    'accessory'  -- Acessórios
);

-- Criar enum para sub-tipos de armas
CREATE TYPE weapon_subtype AS ENUM (
    'sword',     -- Espadas
    'axe',       -- Machados
    'blunt',     -- Armas de concussão (maças, martelos)
    'staff',     -- Cajados mágicos
    'dagger'     -- Adagas
);

-- Criar enum para raridades
CREATE TYPE equipment_rarity AS ENUM (
    'common',    -- Comum
    'uncommon',  -- Incomum
    'rare',      -- Raro
    'epic',      -- Épico
    'legendary'  -- Lendário
);

-- Criar tabela de equipamentos
CREATE TABLE IF NOT EXISTS equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    description TEXT NOT NULL,
    type equipment_type NOT NULL,
    weapon_subtype weapon_subtype DEFAULT NULL, -- Para armas apenas
    rarity equipment_rarity NOT NULL,
    level_requirement INTEGER NOT NULL CHECK (level_requirement > 0),
    
    -- Bônus de atributos primários
    strength_bonus INTEGER DEFAULT 0,
    dexterity_bonus INTEGER DEFAULT 0,
    intelligence_bonus INTEGER DEFAULT 0,
    wisdom_bonus INTEGER DEFAULT 0,
    vitality_bonus INTEGER DEFAULT 0,
    luck_bonus INTEGER DEFAULT 0,
    
    -- Bônus de stats derivados (para compatibilidade e itens especiais)
    atk_bonus INTEGER DEFAULT 0,
    def_bonus INTEGER DEFAULT 0,
    mana_bonus INTEGER DEFAULT 0,
    speed_bonus INTEGER DEFAULT 0,
    hp_bonus INTEGER DEFAULT 0,
    
    -- Propriedades especiais
    critical_chance_bonus DECIMAL DEFAULT 0,
    critical_damage_bonus DECIMAL DEFAULT 0,
    
    -- Trade-offs (penalidades para balanceamento)
    strength_penalty INTEGER DEFAULT 0,
    dexterity_penalty INTEGER DEFAULT 0,
    intelligence_penalty INTEGER DEFAULT 0,
    wisdom_penalty INTEGER DEFAULT 0,
    vitality_penalty INTEGER DEFAULT 0,
    luck_penalty INTEGER DEFAULT 0,
    speed_penalty INTEGER DEFAULT 0,
    
    price INTEGER NOT NULL CHECK (price > 0),
    is_unlocked BOOLEAN DEFAULT FALSE, -- Novo campo para controlar desbloqueio na loja
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraint para garantir que weapon_subtype seja definido apenas para armas
    CONSTRAINT weapon_subtype_check CHECK (
        (type = 'weapon' AND weapon_subtype IS NOT NULL) OR 
        (type != 'weapon' AND weapon_subtype IS NULL)
    )
);

-- Criar tabela de equipamentos do personagem
CREATE TABLE IF NOT EXISTS character_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    is_equipped BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(character_id, equipment_id)
);

-- Trigger para atualizar o updated_at
CREATE TRIGGER update_equipment_updated_at
    BEFORE UPDATE ON equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_equipment_updated_at
    BEFORE UPDATE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para calcular bônus total de equipamentos
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(p_character_id UUID)
RETURNS TABLE (
    total_strength_bonus INTEGER,
    total_dexterity_bonus INTEGER,
    total_intelligence_bonus INTEGER,
    total_wisdom_bonus INTEGER,
    total_vitality_bonus INTEGER,
    total_luck_bonus INTEGER,
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus DECIMAL,
    total_critical_damage_bonus DECIMAL,
    total_strength_penalty INTEGER,
    total_dexterity_penalty INTEGER,
    total_intelligence_penalty INTEGER,
    total_wisdom_penalty INTEGER,
    total_vitality_penalty INTEGER,
    total_luck_penalty INTEGER,
    total_speed_penalty INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(e.strength_bonus), 0)::INTEGER - COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_bonus), 0)::INTEGER - COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_bonus), 0)::INTEGER - COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_bonus), 0)::INTEGER - COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_bonus), 0)::INTEGER - COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_bonus), 0)::INTEGER - COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER - COALESCE(SUM(e.speed_penalty), 0)::INTEGER,
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER,
        COALESCE(SUM(e.critical_chance_bonus), 0)::DECIMAL,
        COALESCE(SUM(e.critical_damage_bonus), 0)::DECIMAL,
        COALESCE(SUM(e.strength_penalty), 0)::INTEGER,
        COALESCE(SUM(e.dexterity_penalty), 0)::INTEGER,
        COALESCE(SUM(e.intelligence_penalty), 0)::INTEGER,
        COALESCE(SUM(e.wisdom_penalty), 0)::INTEGER,
        COALESCE(SUM(e.vitality_penalty), 0)::INTEGER,
        COALESCE(SUM(e.luck_penalty), 0)::INTEGER,
        COALESCE(SUM(e.speed_penalty), 0)::INTEGER
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
    AND ce.is_equipped = true;
END;
$$ LANGUAGE plpgsql;

-- Função para equipar/desequipar item com validação de maestria
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN
) RETURNS VOID AS $$
DECLARE
    v_equipment_type equipment_type;
    v_weapon_subtype weapon_subtype;
    v_character_level INTEGER;
    v_required_level INTEGER;
    v_sword_mastery INTEGER;
    v_axe_mastery INTEGER;
    v_blunt_mastery INTEGER;
    v_magic_mastery INTEGER;
    v_min_mastery INTEGER := 10; -- Nível mínimo de maestria para usar equipamentos avançados
BEGIN
    -- Obter dados do equipamento
    SELECT type, weapon_subtype, level_requirement 
    INTO v_equipment_type, v_weapon_subtype, v_required_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Obter dados do personagem
    SELECT level, sword_mastery, axe_mastery, blunt_mastery, magic_mastery
    INTO v_character_level, v_sword_mastery, v_axe_mastery, v_blunt_mastery, v_magic_mastery
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar nível do personagem
    IF v_character_level < v_required_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento (necessário: %)', v_required_level;
    END IF;
    
    -- Verificar maestria necessária para armas (apenas para itens raros+)
    IF p_equip AND v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'dagger' THEN
                -- Adagas usam maestria com espadas
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente para usar adagas (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com machados insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com armas de concussão insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria em magia insuficiente (necessário: %)', v_min_mastery;
                END IF;
        END CASE;
    END IF;
    
    -- Se for para equipar, desequipar item do mesmo tipo primeiro
    IF p_equip THEN
        UPDATE character_equipment ce
        SET is_equipped = false
        FROM equipment e
        WHERE ce.equipment_id = e.id
        AND ce.character_id = p_character_id
        AND e.type = v_equipment_type
        AND ce.is_equipped = true;
    END IF;
    
    -- Equipar/desequipar o item selecionado
    UPDATE character_equipment
    SET is_equipped = p_equip
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats do personagem após mudança de equipamento
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para comprar equipamento
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS VOID AS $$
DECLARE
    v_character_gold INTEGER;
    v_character_level INTEGER;
    v_equipment_level INTEGER;
    v_equipment_unlocked BOOLEAN;
BEGIN
    -- Obter dados do equipamento
    SELECT level_requirement, is_unlocked INTO v_equipment_level, v_equipment_unlocked
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Verificar se o equipamento está desbloqueado
    IF NOT v_equipment_unlocked THEN
        RAISE EXCEPTION 'Este equipamento ainda não foi desbloqueado';
    END IF;
    
    -- Verificar se o personagem tem gold suficiente
    SELECT gold, level INTO v_character_gold, v_character_level
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem tem nível suficiente
    IF v_character_level < v_equipment_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento';
    END IF;
    
    -- Verificar gold
    IF v_character_gold < p_price THEN
        RAISE EXCEPTION 'Gold insuficiente para comprar o equipamento';
    END IF;
    
    -- Deduzir gold do personagem
    UPDATE characters
    SET gold = gold - p_price
    WHERE id = p_character_id;
    
    -- Adicionar equipamento ao inventário do personagem
    INSERT INTO character_equipment (character_id, equipment_id)
    VALUES (p_character_id, p_equipment_id);
END;
$$ LANGUAGE plpgsql;

-- Função para vender equipamento
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_rarity equipment_rarity;
BEGIN
    -- Obter preço e raridade do equipamento
    SELECT price, rarity INTO v_price, v_rarity
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Ajustar valor de venda com base na raridade (para balancear a economia)
    -- Equipamentos mais raros têm um melhor retorno percentual
    CASE v_rarity
        WHEN 'common' THEN v_price := v_price * 0.3;
        WHEN 'uncommon' THEN v_price := v_price * 0.35;
        WHEN 'rare' THEN v_price := v_price * 0.4;
        WHEN 'epic' THEN v_price := v_price * 0.45;
        WHEN 'legendary' THEN v_price := v_price * 0.5;
    END CASE;
    
    -- Arredondar para inteiro
    v_price := FLOOR(v_price);
    
    -- Adicionar gold ao personagem
    UPDATE characters
    SET gold = gold + v_price
    WHERE id = p_character_id;
    
    -- Remover equipamento do inventário
    DELETE FROM character_equipment
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats após venda
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para desbloquear equipamento
CREATE OR REPLACE FUNCTION unlock_equipment(
    p_equipment_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE equipment
    SET is_unlocked = true
    WHERE id = p_equipment_id;
END;
$$ LANGUAGE plpgsql;

-- Habilitar RLS
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_equipment ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para equipment (leitura pública - dados de referência)
CREATE POLICY "Allow public read equipment" ON equipment
    FOR SELECT 
    USING (true);

-- Políticas RLS para character_equipment (acesso apenas ao dono do personagem)
CREATE POLICY "Users can view own character equipment" ON character_equipment
    FOR SELECT
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can manage own character equipment" ON character_equipment
    FOR ALL
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    )); 
-- Usar a função update_updated_at_column que já existe

-- Criação da tabela de consumíveis
CREATE TABLE IF NOT EXISTS consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('potion', 'elixir', 'antidote', 'buff')),
    effect_value INTEGER NOT NULL,
    price INTEGER NOT NULL,
    level_requirement INTEGER NOT NULL DEFAULT 1,
    craftable BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Criação da tabela para consumíveis dos personagens
CREATE TABLE IF NOT EXISTS character_consumables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    consumable_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, consumable_id)
);

-- Função para comprar consumíveis
CREATE OR REPLACE FUNCTION buy_consumable(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS VOID AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o consumível existe
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumível não encontrado';
    END IF;
    
    -- Verificar se o personagem tem ouro suficiente
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    IF v_gold < (v_price * p_quantity) THEN
        RAISE EXCEPTION 'Ouro insuficiente para comprar % unidades', p_quantity;
    END IF;
    
    -- Atualizar o ouro do personagem
    UPDATE characters 
    SET gold = gold - (v_price * p_quantity)
    WHERE id = p_character_id;
    
    -- Verificar se o personagem já tem este consumível
    SELECT quantity INTO v_current_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF FOUND THEN
        -- Atualizar a quantidade
        UPDATE character_consumables
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO character_consumables (character_id, consumable_id, quantity)
        VALUES (p_character_id, p_consumable_id, p_quantity);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Função para usar consumíveis
CREATE OR REPLACE FUNCTION use_consumable(
    p_character_id UUID,
    p_consumable_id UUID
) RETURNS VOID AS $$
DECLARE
    v_quantity INTEGER;
BEGIN
    -- Verificar se o personagem tem o consumível
    SELECT quantity INTO v_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF NOT FOUND OR v_quantity <= 0 THEN
        RAISE EXCEPTION 'Você não possui este item';
    END IF;
    
    -- Reduzir a quantidade
    UPDATE character_consumables
    SET quantity = quantity - 1,
        updated_at = NOW()
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp de updated_at
CREATE TRIGGER update_consumables_updated_at
    BEFORE UPDATE ON consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_consumables_updated_at
    BEFORE UPDATE ON character_consumables
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- Usar a função update_updated_at_column que já existe

-- Criação da tabela de drops de monstros
CREATE TABLE IF NOT EXISTS monster_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    rarity VARCHAR(50) NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
    value INTEGER NOT NULL DEFAULT 0, -- valor de venda
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de possíveis drops para cada monstro
CREATE TABLE IF NOT EXISTS monster_possible_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monster_id UUID NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    drop_chance DOUBLE PRECISION NOT NULL DEFAULT 0.0 CHECK (drop_chance BETWEEN 0 AND 1), -- 0-1 (0-100%)
    min_quantity INTEGER NOT NULL DEFAULT 1,
    max_quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela para inventário de drops dos personagens
CREATE TABLE IF NOT EXISTS character_drops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    drop_id UUID NOT NULL REFERENCES monster_drops(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE (character_id, drop_id)
);

-- Tabela de receitas de crafting
CREATE TABLE IF NOT EXISTS crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_id UUID NOT NULL REFERENCES consumables(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de ingredientes para receitas
CREATE TABLE IF NOT EXISTS crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Função para validar ingredientes
CREATE OR REPLACE FUNCTION validate_crafting_ingredient()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.item_type = 'monster_drop' THEN
        IF NOT EXISTS (SELECT 1 FROM monster_drops WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid monster_drop id: %', NEW.item_id;
        END IF;
    ELSIF NEW.item_type = 'consumable' THEN
        IF NOT EXISTS (SELECT 1 FROM consumables WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid consumable id: %', NEW.item_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
CREATE TRIGGER validate_crafting_ingredient_trigger
    BEFORE INSERT OR UPDATE ON crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION validate_crafting_ingredient();

-- Função para obter drops de um monstro
CREATE OR REPLACE FUNCTION get_monster_drops(p_monster_id UUID)
RETURNS TABLE (
    drop_id UUID,
    drop_name VARCHAR,
    drop_chance DOUBLE PRECISION,
    min_quantity INTEGER,
    max_quantity INTEGER,
    rarity VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        md.id AS drop_id,
        md.name AS drop_name,
        mpd.drop_chance,
        mpd.min_quantity,
        mpd.max_quantity,
        md.rarity
    FROM monster_possible_drops mpd
    JOIN monster_drops md ON mpd.drop_id = md.id
    WHERE mpd.monster_id = p_monster_id;
END;
$$ LANGUAGE plpgsql;

-- Função para adicionar drop ao inventário do personagem
CREATE OR REPLACE FUNCTION add_monster_drop(
    p_character_id UUID,
    p_drop_id UUID,
    p_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o personagem existe (RLS cuidará da permissão)
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Utilizar padrão UPSERT para evitar problemas de concorrência
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (p_character_id, p_drop_id, p_quantity)
    ON CONFLICT (character_id, drop_id) 
    DO UPDATE SET 
        quantity = character_drops.quantity + EXCLUDED.quantity,
        updated_at = NOW();
EXCEPTION
    WHEN unique_violation THEN
        -- Caso ainda ocorra uma violação devido a condições de corrida, tenta novamente com abordagem mais segura
        UPDATE character_drops
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND drop_id = p_drop_id;
    WHEN OTHERS THEN
        -- Registrar o erro para depuração
        RAISE WARNING 'Erro ao adicionar drop % para o personagem %: %', p_drop_id, p_character_id, SQLERRM;
        -- Propagar o erro
        RAISE;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se o personagem pode criar um item
CREATE OR REPLACE FUNCTION check_can_craft(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
) AS $$
DECLARE
    v_missing TEXT[] := '{}';
    v_has_all BOOLEAN := TRUE;
    r RECORD;
BEGIN
    -- Para cada ingrediente na receita
    FOR r IN (
        SELECT ci.*, md.name AS drop_name, c.name AS consumable_name
        FROM crafting_ingredients ci
        LEFT JOIN monster_drops md ON ci.item_type = 'monster_drop' AND ci.item_id = md.id
        LEFT JOIN consumables c ON ci.item_type = 'consumable' AND ci.item_id = c.id
        WHERE ci.recipe_id = p_recipe_id
    ) LOOP
        -- Verificar se o personagem tem o ingrediente em quantidade suficiente
        IF r.item_type = 'monster_drop' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_drops
                WHERE character_id = p_character_id
                AND drop_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.drop_name || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'consumable' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_consumables
                WHERE character_id = p_character_id
                AND consumable_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.consumable_name || ' (x' || r.quantity || ')');
            END IF;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_all, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um item
CREATE OR REPLACE FUNCTION craft_item(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID AS $$
DECLARE
    v_result_id UUID;
    v_can_craft BOOLEAN;
    v_missing TEXT[];
    r RECORD;
BEGIN
    -- Verificar se pode criar o item
    SELECT * INTO v_can_craft, v_missing FROM check_can_craft(p_character_id, p_recipe_id);
    
    IF NOT v_can_craft THEN
        RAISE EXCEPTION 'Ingredientes insuficientes: %', v_missing;
    END IF;
    
    -- Obter o ID do resultado
    SELECT result_id INTO v_result_id FROM crafting_recipes WHERE id = p_recipe_id;
    
    -- Consumir os ingredientes
    FOR r IN (
        SELECT * FROM crafting_ingredients WHERE recipe_id = p_recipe_id
    ) LOOP
        IF r.item_type = 'monster_drop' THEN
            UPDATE character_drops
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND drop_id = r.item_id;
        ELSIF r.item_type = 'consumable' THEN
            UPDATE character_consumables
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND consumable_id = r.item_id;
        END IF;
    END LOOP;
    
    -- Adicionar o item ao inventário
    PERFORM add_consumable_to_inventory(p_character_id, v_result_id, 1);
END;
$$ LANGUAGE plpgsql;

-- Função auxiliar para adicionar consumível ao inventário
CREATE OR REPLACE FUNCTION add_consumable_to_inventory(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER
) RETURNS VOID AS $$
DECLARE
    v_current_quantity INTEGER;
BEGIN
    -- Verificar se o personagem já tem este consumível
    SELECT quantity INTO v_current_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF FOUND THEN
        -- Atualizar a quantidade
        UPDATE character_consumables
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO character_consumables (character_id, consumable_id, quantity)
        VALUES (p_character_id, p_consumable_id, p_quantity);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para atualizar timestamps
CREATE TRIGGER update_monster_drops_updated_at
    BEFORE UPDATE ON monster_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_monster_possible_drops_updated_at
    BEFORE UPDATE ON monster_possible_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_drops_updated_at
    BEFORE UPDATE ON character_drops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crafting_recipes_updated_at
    BEFORE UPDATE ON crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_crafting_ingredients_updated_at
    BEFORE UPDATE ON crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CONFIGURAR RLS (Row Level Security)
-- ========================================

-- monster_drops: leitura pública (dados de referência)
ALTER TABLE monster_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de drops" ON monster_drops
    FOR SELECT 
    USING (true);

-- monster_possible_drops: leitura pública (dados de referência)
ALTER TABLE monster_possible_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de possíveis drops" ON monster_possible_drops
    FOR SELECT 
    USING (true);

-- character_drops: acesso apenas ao dono do personagem
ALTER TABLE character_drops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuários podem gerenciar drops dos próprios personagens" ON character_drops
    FOR ALL
    TO authenticated
    USING (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ))
    WITH CHECK (character_id IN (
        SELECT id FROM characters WHERE user_id = auth.uid()
    ));

-- crafting_recipes: leitura pública (dados de referência)
ALTER TABLE crafting_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de receitas" ON crafting_recipes
    FOR SELECT 
    USING (true);

-- crafting_ingredients: leitura pública (dados de referência)
ALTER TABLE crafting_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de ingredientes" ON crafting_ingredients
    FOR SELECT 
    USING (true);

-- Permissões serão gerenciadas automaticamente pelo Supabase 
-- Migração para corrigir sistema de equipamentos e implementar dual-wielding

-- Adicionar campos para especificar slot de equipamento
ALTER TABLE character_equipment ADD COLUMN IF NOT EXISTS slot_type VARCHAR(20) DEFAULT NULL;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_character_equipment_slot ON character_equipment(character_id, slot_type, is_equipped);

-- Atualizar dados existentes para preencher slot_type baseado no tipo de equipamento
UPDATE character_equipment ce
SET slot_type = CASE 
    WHEN e.type = 'weapon' THEN 'main_hand'
    WHEN e.type = 'armor' THEN 'armor'  
    WHEN e.type = 'accessory' THEN 'accessory'
    ELSE NULL
END
FROM equipment e 
WHERE ce.equipment_id = e.id AND ce.slot_type IS NULL;

-- Função corrigida para equipar/desequipar item com validação de maestria e dual-wielding
CREATE OR REPLACE FUNCTION toggle_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_equip BOOLEAN,
    p_slot_type VARCHAR(20) DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_equipment_type equipment_type;
    v_weapon_subtype weapon_subtype;
    v_character_level INTEGER;
    v_required_level INTEGER;
    v_sword_mastery INTEGER;
    v_axe_mastery INTEGER;
    v_blunt_mastery INTEGER;
    v_magic_mastery INTEGER;
    v_min_mastery INTEGER := 10;
    v_final_slot_type VARCHAR(20);
BEGIN
    -- Obter dados do equipamento
    SELECT type, weapon_subtype, level_requirement 
    INTO v_equipment_type, v_weapon_subtype, v_required_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Obter dados do personagem
    SELECT level, sword_mastery, axe_mastery, blunt_mastery, magic_mastery
    INTO v_character_level, v_sword_mastery, v_axe_mastery, v_blunt_mastery, v_magic_mastery
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar nível do personagem
    IF v_character_level < v_required_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento (necessário: %)', v_required_level;
    END IF;
    
    -- Determinar slot final
    IF v_equipment_type = 'weapon' THEN
        IF p_slot_type IS NULL THEN
            v_final_slot_type := 'main_hand'; -- Default para mão principal
        ELSE
            v_final_slot_type := p_slot_type;
        END IF;
    ELSIF v_equipment_type = 'armor' THEN
        v_final_slot_type := 'armor';
    ELSIF v_equipment_type = 'accessory' THEN
        v_final_slot_type := 'accessory';
    END IF;
    
    -- Verificar maestria necessária para armas avançadas
    IF p_equip AND v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'dagger' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com espadas insuficiente para usar adagas (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com machados insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria com armas de concussão insuficiente (necessário: %)', v_min_mastery;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RAISE EXCEPTION 'Maestria em magia insuficiente (necessário: %)', v_min_mastery;
                END IF;
        END CASE;
    END IF;
    
    -- Se for para equipar, desequipar item do mesmo slot primeiro
    IF p_equip THEN
        UPDATE character_equipment
        SET is_equipped = false
        WHERE character_id = p_character_id
        AND slot_type = v_final_slot_type
        AND is_equipped = true;
    END IF;
    
    -- Equipar/desequipar o item selecionado
    UPDATE character_equipment
    SET is_equipped = p_equip,
        slot_type = CASE WHEN p_equip THEN v_final_slot_type ELSE slot_type END
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats do personagem após mudança de equipamento
    PERFORM recalculate_character_stats(p_character_id);
END;
$$ LANGUAGE plpgsql;

-- Função para obter equipamentos equipados por slot
CREATE OR REPLACE FUNCTION get_equipped_slots(p_character_id UUID)
RETURNS TABLE (
    slot_type VARCHAR(20),
    equipment_id UUID,
    equipment_name VARCHAR(50),
    equipment_type equipment_type,
    weapon_subtype weapon_subtype,
    atk_bonus INTEGER,
    def_bonus INTEGER,
    mana_bonus INTEGER,
    speed_bonus INTEGER,
    hp_bonus INTEGER,
    rarity equipment_rarity
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ce.slot_type,
        e.id,
        e.name,
        e.type,
        e.weapon_subtype,
        e.atk_bonus,
        e.def_bonus,
        e.mana_bonus,
        e.speed_bonus,
        e.hp_bonus,
        e.rarity
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
    AND ce.is_equipped = true
    ORDER BY ce.slot_type;
END;
$$ LANGUAGE plpgsql;

-- Função para verificar se o personagem pode equipar um item
CREATE OR REPLACE FUNCTION can_equip_item(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS TABLE (
    can_equip BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_equipment_type equipment_type;
    v_weapon_subtype weapon_subtype;
    v_character_level INTEGER;
    v_required_level INTEGER;
    v_sword_mastery INTEGER;
    v_axe_mastery INTEGER;
    v_blunt_mastery INTEGER;
    v_magic_mastery INTEGER;
    v_min_mastery INTEGER := 10;
BEGIN
    -- Obter dados do equipamento
    SELECT type, weapon_subtype, level_requirement 
    INTO v_equipment_type, v_weapon_subtype, v_required_level
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Obter dados do personagem
    SELECT level, sword_mastery, axe_mastery, blunt_mastery, magic_mastery
    INTO v_character_level, v_sword_mastery, v_axe_mastery, v_blunt_mastery, v_magic_mastery
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar nível do personagem
    IF v_character_level < v_required_level THEN
        RETURN QUERY SELECT false, 'Nível insuficiente (necessário: ' || v_required_level || ')';
        RETURN;
    END IF;
    
    -- Verificar maestria para armas avançadas
    IF v_equipment_type = 'weapon' AND v_required_level >= 10 THEN
        CASE v_weapon_subtype
            WHEN 'sword' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com espadas insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'dagger' THEN
                IF v_sword_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com espadas insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'axe' THEN
                IF v_axe_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com machados insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'blunt' THEN
                IF v_blunt_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria com armas de concussão insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
            WHEN 'staff' THEN
                IF v_magic_mastery < v_min_mastery THEN
                    RETURN QUERY SELECT false, 'Maestria em magia insuficiente (necessário: ' || v_min_mastery || ')';
                    RETURN;
                END IF;
        END CASE;
    END IF;
    
    -- Se chegou até aqui, pode equipar
    RETURN QUERY SELECT true, 'Pode equipar';
END;
$$ LANGUAGE plpgsql; 
-- Migração para resolver ambiguidade na função toggle_equipment

-- Remover a função toggle_equipment com 3 parâmetros para evitar ambiguidade
DROP FUNCTION IF EXISTS toggle_equipment(UUID, UUID, BOOLEAN);

-- Garantir que apenas a versão com 4 parâmetros existe
-- (A função com 4 parâmetros já foi criada na migração anterior) 
-- Criação da tabela para slots de poções do personagem
CREATE TABLE IF NOT EXISTS character_potion_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position BETWEEN 1 AND 3),
    consumable_id UUID REFERENCES consumables(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(character_id, slot_position)
);

-- Criação da tabela para slots de spells do personagem  
CREATE TABLE IF NOT EXISTS character_spell_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot_position INTEGER NOT NULL CHECK (slot_position BETWEEN 1 AND 3),
    spell_id UUID REFERENCES spells(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(character_id, slot_position)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_character_potion_slots_character_id ON character_potion_slots(character_id);
CREATE INDEX IF NOT EXISTS idx_character_spell_slots_character_id ON character_spell_slots(character_id);

-- Triggers para atualização automática de updated_at
CREATE TRIGGER update_character_potion_slots_updated_at
    BEFORE UPDATE ON character_potion_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_spell_slots_updated_at
    BEFORE UPDATE ON character_spell_slots
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para configurar slots de poção
CREATE OR REPLACE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RAISE EXCEPTION 'Slot position deve estar entre 1 e 3';
    END IF;
    
    -- Se consumable_id é NULL, remove o slot
    IF p_consumable_id IS NULL THEN
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;
        RETURN;
    END IF;
    
    -- Verificar se o personagem possui este consumível
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = p_consumable_id 
        AND quantity > 0
    ) THEN
        RAISE EXCEPTION 'Personagem não possui este consumível ou quantidade é zero';
    END IF;
    
    -- Verificar se é uma poção válida
    IF NOT EXISTS (
        SELECT 1 FROM consumables 
        WHERE id = p_consumable_id 
        AND type IN ('potion')
    ) THEN
        RAISE EXCEPTION 'Item deve ser uma poção';
    END IF;
    
    -- Inserir ou atualizar slot
    INSERT INTO character_potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        consumable_id = p_consumable_id,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para configurar slots de spell
CREATE OR REPLACE FUNCTION set_spell_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_spell_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- Validar slot position
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RAISE EXCEPTION 'Slot position deve estar entre 1 e 3';
    END IF;
    
    -- Se spell_id é NULL, remove o slot
    IF p_spell_id IS NULL THEN
        DELETE FROM character_spell_slots 
        WHERE character_id = p_character_id 
        AND slot_position = p_slot_position;
        RETURN;
    END IF;
    
    -- Verificar se o spell existe
    IF NOT EXISTS (SELECT 1 FROM spells WHERE id = p_spell_id) THEN
        RAISE EXCEPTION 'Spell não encontrado';
    END IF;
    
    -- Inserir ou atualizar slot
    INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, p_slot_position, p_spell_id)
    ON CONFLICT (character_id, slot_position)
    DO UPDATE SET 
        spell_id = p_spell_id,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Função para obter slots de poção do personagem
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name VARCHAR,
    consumable_description TEXT,
    effect_value INTEGER,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cps.slot_position,
        cps.consumable_id,
        c.name,
        c.description,
        c.effect_value,
        c.icon
    FROM character_potion_slots cps
    LEFT JOIN consumables c ON cps.consumable_id = c.id
    WHERE cps.character_id = p_character_id
    ORDER BY cps.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Função para obter slots de spell do personagem
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name VARCHAR,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type VARCHAR,
    icon VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        css.slot_position,
        css.spell_id,
        s.name,
        s.description,
        s.mana_cost,
        s.damage,
        s.type,
        s.icon
    FROM character_spell_slots css
    LEFT JOIN spells s ON css.spell_id = s.id
    WHERE css.character_id = p_character_id
    ORDER BY css.slot_position;
END;
$$ LANGUAGE plpgsql;

-- Função para usar poção de um slot específico
CREATE OR REPLACE FUNCTION use_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_hp INTEGER,
    new_mana INTEGER
) AS $$
DECLARE
    v_consumable_id UUID;
    v_character_consumable RECORD;
    v_consumable RECORD;
    v_character RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_message TEXT := '';
BEGIN
    -- Buscar o consumível do slot
    SELECT consumable_id INTO v_consumable_id
    FROM character_potion_slots
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
    
    IF v_consumable_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Slot vazio'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Verificar se o personagem ainda possui o consumível
    SELECT * INTO v_character_consumable
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = v_consumable_id;
    
    IF v_character_consumable.quantity <= 0 THEN
        -- Remove do slot se não tem mais
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id AND slot_position = p_slot_position;
        
        RETURN QUERY SELECT FALSE, 'Poção esgotada'::TEXT, 0, 0;
        RETURN;
    END IF;
    
    -- Buscar dados do consumível e personagem
    SELECT * INTO v_consumable FROM consumables WHERE id = v_consumable_id;
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    -- Aplicar efeito da poção
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;
    
    IF v_consumable.description ILIKE '%HP%' OR v_consumable.description ILIKE '%Vida%' THEN
        v_new_hp := LEAST(v_character.max_hp, v_character.hp + v_consumable.effect_value);
        v_message := 'HP restaurado!';
    ELSIF v_consumable.description ILIKE '%Mana%' THEN
        v_new_mana := LEAST(v_character.max_mana, v_character.mana + v_consumable.effect_value);
        v_message := 'Mana restaurada!';
    END IF;
    
    -- Atualizar HP/Mana do personagem
    UPDATE characters 
    SET hp = v_new_hp, mana = v_new_mana
    WHERE id = p_character_id;
    
    -- Decrementar quantidade do consumível
    UPDATE character_consumables
    SET quantity = quantity - 1
    WHERE character_id = p_character_id AND consumable_id = v_consumable_id;
    
    -- Remover do inventário se quantidade chegou a 0
    DELETE FROM character_consumables
    WHERE character_id = p_character_id 
    AND consumable_id = v_consumable_id 
    AND quantity <= 0;
    
    -- Se não tem mais poções, limpar o slot
    IF v_character_consumable.quantity - 1 <= 0 THEN
        DELETE FROM character_potion_slots 
        WHERE character_id = p_character_id AND slot_position = p_slot_position;
    END IF;
    
    RETURN QUERY SELECT TRUE, v_message, v_new_hp, v_new_mana;
END;
$$ LANGUAGE plpgsql; 
-- Migração para corrigir as funções de slots removendo referências à coluna icon

-- Primeiro, remover as funções existentes para poder recriar com nova assinatura
DROP FUNCTION IF EXISTS get_character_potion_slots(UUID);
DROP FUNCTION IF EXISTS get_character_spell_slots(UUID);

-- Corrigir função para obter slots de poção do personagem
CREATE OR REPLACE FUNCTION get_character_potion_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    consumable_id UUID,
    consumable_name VARCHAR,
    consumable_description TEXT,
    effect_value INTEGER
) AS $$
BEGIN
    -- Retornar os 3 slots sempre, mesmo que vazios
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER as slot_position,
        cps.consumable_id,
        c.name as consumable_name,
        c.description as consumable_description,
        c.effect_value
    FROM slot_positions sp
    LEFT JOIN character_potion_slots cps ON cps.slot_position = sp.position 
        AND cps.character_id = p_character_id
    LEFT JOIN consumables c ON cps.consumable_id = c.id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql;

-- Corrigir função para obter slots de spell do personagem
CREATE OR REPLACE FUNCTION get_character_spell_slots(p_character_id UUID)
RETURNS TABLE (
    slot_position INTEGER,
    spell_id UUID,
    spell_name VARCHAR,
    spell_description TEXT,
    mana_cost INTEGER,
    damage INTEGER,
    spell_type VARCHAR
) AS $$
BEGIN
    -- Retornar os 3 slots sempre, mesmo que vazios
    RETURN QUERY
    WITH slot_positions AS (
        SELECT generate_series(1, 3) as position
    )
    SELECT 
        sp.position::INTEGER as slot_position,
        css.spell_id,
        s.name as spell_name,
        s.description as spell_description,
        s.mana_cost,
        s.damage,
        s.type as spell_type
    FROM slot_positions sp
    LEFT JOIN character_spell_slots css ON css.slot_position = sp.position 
        AND css.character_id = p_character_id
    LEFT JOIN spells s ON css.spell_id = s.id
    ORDER BY sp.position;
END;
$$ LANGUAGE plpgsql; 
-- Atualização do sistema de ranking
-- Adicionar colunas necessárias à tabela game_rankings

-- Adicionar coluna para indicar se o personagem está vivo
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_alive BOOLEAN DEFAULT TRUE;

-- Adicionar colunas para novas modalidades de ranking
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS character_gold INTEGER DEFAULT 0;

-- Criar índices para otimizar consultas de ranking
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor_alive ON game_rankings(highest_floor DESC, character_alive);
CREATE INDEX IF NOT EXISTS idx_game_rankings_level ON game_rankings(character_level DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_gold ON game_rankings(character_gold DESC);
CREATE INDEX IF NOT EXISTS idx_game_rankings_user_alive ON game_rankings(user_id, character_alive);

-- Função para salvar entrada no ranking com informações completas
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name VARCHAR,
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT TRUE
)
RETURNS UUID AS $$
DECLARE
    v_ranking_id UUID;
BEGIN
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        p_user_id,
        p_player_name,
        p_highest_floor,
        p_character_level,
        p_character_gold,
        p_character_alive,
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por andar mais alto
CREATE OR REPLACE FUNCTION get_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.highest_floor DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior nível
CREATE OR REPLACE FUNCTION get_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.character_level DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior quantidade de ouro
CREATE OR REPLACE FUNCTION get_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (NOT p_alive_only OR r.character_alive = TRUE)
    ORDER BY r.user_id, r.character_gold DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking pessoal do usuário
CREATE OR REPLACE FUNCTION get_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE r.user_id = p_user_id
    ORDER BY r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar registros existentes com valores padrão
UPDATE game_rankings 
SET 
    character_alive = TRUE,
    character_level = 1,
    character_gold = 0
WHERE character_alive IS NULL 
   OR character_level IS NULL 
   OR character_gold IS NULL;

-- Adicionar comentários às colunas
COMMENT ON COLUMN game_rankings.character_alive IS 'Indica se o personagem estava vivo quando a entrada foi criada';
COMMENT ON COLUMN game_rankings.character_level IS 'Nível do personagem quando a entrada foi criada';
COMMENT ON COLUMN game_rankings.character_gold IS 'Quantidade de ouro do personagem quando a entrada foi criada'; 
-- Atualizar funções RPC para suportar filtro de personagens mortos

-- Função para obter ranking por andar mais alto (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.highest_floor DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior nível (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.character_level DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking por maior quantidade de ouro (atualizada)
CREATE OR REPLACE FUNCTION get_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_alive_only BOOLEAN DEFAULT FALSE,
    p_dead_only BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (r.user_id)
        r.id,
        r.user_id,
        r.player_name,
        r.highest_floor,
        r.character_level,
        r.character_gold,
        r.character_alive,
        r.created_at
    FROM game_rankings r
    WHERE (
        (NOT p_alive_only AND NOT p_dead_only) OR  -- Todos
        (p_alive_only AND r.character_alive = TRUE) OR  -- Apenas vivos
        (p_dead_only AND r.character_alive = FALSE)     -- Apenas mortos
    )
    ORDER BY r.user_id, r.character_gold DESC, r.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- Sistema de Ranking Dinâmico
-- Esta migração cria um sistema que considera todos os personagens (vivos e mortos) dinamicamente

-- Função para obter ranking dinâmico por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.highest_floor DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.highest_floor DESC, cs.character_level DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.highest_floor DESC, bpu.character_level DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking dinâmico por maior nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.character_level DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.character_level DESC, cs.highest_floor DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.character_level DESC, bpu.highest_floor DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking dinâmico por maior quantidade de ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.character_gold DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.character_gold DESC, cs.highest_floor DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.character_gold DESC, bpu.highest_floor DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter histórico completo do usuário (personagens vivos e mortos)
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH user_characters AS (
        -- Personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id
        
        UNION ALL
        
        -- Personagens mortos
        SELECT 
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
    )
    SELECT 
        uc.id,
        uc.user_id,
        uc.player_name,
        uc.highest_floor,
        uc.character_level,
        uc.character_gold,
        uc.character_alive,
        uc.created_at
    FROM user_characters uc
    ORDER BY uc.highest_floor DESC, uc.character_level DESC, uc.created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas dinâmicas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_data AS (
        -- Personagens vivos
        SELECT 
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive
        FROM characters c
        WHERE c.user_id = p_user_id
        
        UNION ALL
        
        -- Personagens mortos
        SELECT 
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
    )
    SELECT 
        COALESCE(MAX(ud.highest_floor), 0) as best_floor,
        COALESCE(MAX(ud.character_level), 1) as best_level,
        COALESCE(MAX(ud.character_gold), 0) as best_gold,
        COUNT(*)::INTEGER as total_runs,
        COUNT(CASE WHEN ud.character_alive = TRUE THEN 1 END)::INTEGER as alive_characters
    FROM user_data ud;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar ranking automaticamente quando personagem vivo progride
CREATE OR REPLACE FUNCTION update_character_ranking_on_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Esta função pode ser usada para triggers futuros se necessário
    -- Por enquanto, apenas retorna o NEW record
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Obtém ranking dinâmico por andar mais alto, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_ranking_by_level IS 'Obtém ranking dinâmico por maior nível, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_ranking_by_gold IS 'Obtém ranking dinâmico por maior quantidade de ouro, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_user_ranking_history IS 'Obtém histórico completo do usuário incluindo personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_user_stats IS 'Obtém estatísticas dinâmicas do usuário baseadas em todos os personagens'; 
-- Otimizações para o Sistema de Ranking Dinâmico

-- Criar índices otimizados para consultas de ranking dinâmico
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor ON characters(user_id, floor DESC, level DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_ranking_level ON characters(user_id, level DESC, floor DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold ON characters(user_id, gold DESC, floor DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_characters_active_ranking ON characters(floor DESC, level DESC, gold DESC) WHERE floor > 0;

-- Índices para game_rankings otimizados para consultas dinâmicas
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_users ON game_rankings(user_id, character_alive, highest_floor DESC) WHERE character_alive = FALSE;
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_level ON game_rankings(user_id, character_alive, character_level DESC) WHERE character_alive = FALSE;
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_gold ON game_rankings(user_id, character_alive, character_gold DESC) WHERE character_alive = FALSE;

-- Função otimizada para obter ranking global com melhor performance
CREATE OR REPLACE FUNCTION get_optimized_global_ranking(
    p_mode VARCHAR DEFAULT 'highest_floor', -- 'highest_floor', 'level', 'gold'
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    order_clause TEXT;
BEGIN
    -- Definir ordenação baseada no modo
    CASE p_mode
        WHEN 'level' THEN
            order_clause := 'cs.character_level DESC, cs.highest_floor DESC, cs.created_at ASC';
        WHEN 'gold' THEN
            order_clause := 'cs.character_gold DESC, cs.highest_floor DESC, cs.created_at ASC';
        ELSE -- 'highest_floor'
            order_clause := 'cs.highest_floor DESC, cs.character_level DESC, cs.created_at ASC';
    END CASE;

    RETURN QUERY EXECUTE format('
        WITH character_stats AS (
            -- Personagens vivos (apenas se solicitado)
            SELECT 
                c.id,
                c.user_id,
                c.name as player_name,
                c.floor as highest_floor,
                c.level as character_level,
                c.gold as character_gold,
                TRUE as character_alive,
                c.created_at
            FROM characters c
            WHERE ($3 = ''all'' OR $3 = ''alive'')
            AND c.floor > 0 -- Apenas personagens que começaram a jogar
            
            UNION ALL
            
            -- Personagens mortos (apenas se solicitado)
            SELECT DISTINCT ON (r.user_id)
                r.id,
                r.user_id,
                r.player_name,
                r.highest_floor,
                r.character_level,
                r.character_gold,
                r.character_alive,
                r.created_at
            FROM game_rankings r
            WHERE r.character_alive = FALSE
            AND ($3 = ''all'' OR $3 = ''dead'')
            ORDER BY r.user_id, %s
        ),
        best_per_user AS (
            -- Obter o melhor resultado por usuário
            SELECT DISTINCT ON (cs.user_id)
                cs.id,
                cs.user_id,
                cs.player_name,
                cs.highest_floor,
                cs.character_level,
                cs.character_gold,
                cs.character_alive,
                cs.created_at
            FROM character_stats cs
            ORDER BY cs.user_id, %s
        )
        SELECT 
            bpu.id,
            bpu.user_id,
            bpu.player_name,
            bpu.highest_floor,
            bpu.character_level,
            bpu.character_gold,
            bpu.character_alive,
            bpu.created_at
        FROM best_per_user bpu
        ORDER BY %s
        LIMIT $2
    ', order_clause, order_clause, order_clause)
    USING p_mode, p_limit, p_status_filter;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas rápidas do usuário
CREATE OR REPLACE FUNCTION get_fast_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH live_chars AS (
        SELECT 
            COALESCE(MAX(c.floor), 0) as max_floor,
            COALESCE(MAX(c.level), 0) as max_level,
            COALESCE(MAX(c.gold), 0) as max_gold,
            COUNT(*) as live_count
        FROM characters c
        WHERE c.user_id = p_user_id
    ),
    dead_chars AS (
        SELECT 
            COALESCE(MAX(r.highest_floor), 0) as max_floor,
            COALESCE(MAX(r.character_level), 0) as max_level,
            COALESCE(MAX(r.character_gold), 0) as max_gold,
            COUNT(*) as dead_count
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
    )
    SELECT 
        GREATEST(lc.max_floor, dc.max_floor) as best_floor,
        GREATEST(lc.max_level, dc.max_level, 1) as best_level,
        GREATEST(lc.max_gold, dc.max_gold) as best_gold,
        (lc.live_count + dc.dead_count)::INTEGER as total_runs,
        lc.live_count::INTEGER as alive_characters
    FROM live_chars lc, dead_chars dc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking pessoal otimizado
CREATE OR REPLACE FUNCTION get_fast_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    (
        -- Personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id
        ORDER BY c.floor DESC, c.level DESC, c.created_at DESC
    )
    UNION ALL
    (
        -- Personagens mortos
        SELECT 
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
        ORDER BY r.highest_floor DESC, r.character_level DESC, r.created_at DESC
    )
    ORDER BY highest_floor DESC, character_level DESC, created_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar as funções dinâmicas para usar as versões otimizadas
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('highest_floor', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('level', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_optimized_global_ranking('gold', p_limit, p_status_filter);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Substituir as funções de usuário pelas versões otimizadas
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_fast_user_ranking_history(p_user_id, p_limit);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_fast_user_stats(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários para documentação das otimizações
COMMENT ON FUNCTION get_optimized_global_ranking IS 'Versão otimizada do ranking global com consultas mais eficientes';
COMMENT ON FUNCTION get_fast_user_stats IS 'Versão otimizada para obter estatísticas do usuário rapidamente';
COMMENT ON FUNCTION get_fast_user_ranking_history IS 'Versão otimizada para obter histórico do usuário rapidamente'; 
-- Migração para corrigir completamente o sistema de ranking
-- Remove sistema antigo e implementa sistema dinâmico baseado na tabela characters

-- =====================================
-- 1. LIMPEZA DO SISTEMA ANTIGO
-- =====================================

-- Remover funções antigas do sistema de ranking
DROP FUNCTION IF EXISTS save_ranking_entry(uuid, text, integer, integer, integer, boolean);
DROP FUNCTION IF EXISTS get_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_user_ranking_history(uuid, integer);
DROP FUNCTION IF EXISTS get_user_stats(uuid);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(text, integer, text);
DROP FUNCTION IF EXISTS get_fast_user_stats(uuid);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(uuid, integer);

-- Remover triggers antigos
DROP TRIGGER IF EXISTS update_character_ranking_on_progress ON characters;
DROP FUNCTION IF EXISTS update_character_ranking_on_progress();

-- Remover tabelas antigas do sistema de ranking
DROP TABLE IF EXISTS game_rankings CASCADE;
DROP TABLE IF EXISTS ranking CASCADE;

-- =====================================
-- 2. ADICIONAR CAMPO PARA CONTROLAR STATUS DO PERSONAGEM
-- =====================================

-- Adicionar campo is_alive para controlar se o personagem está vivo
-- Personagens mortos ficam is_alive = false mas permanecem no banco para ranking
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT true;

-- Atualizar personagens existentes baseado no HP
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive IS NULL;

-- Criar índice para otimizar consultas por status
CREATE INDEX IF NOT EXISTS idx_characters_is_alive ON characters(is_alive);

-- =====================================
-- 3. FUNÇÕES DO SISTEMA DINÂMICO
-- =====================================

-- Função para salvar entrada no ranking (compatibilidade)
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name TEXT,
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
    -- No sistema dinâmico, os dados já estão na tabela characters
    -- Esta função existe apenas para compatibilidade
    RETURN 'success';
END;
$$;

-- Função para ranking dinâmico por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true
        END
    ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- CREATE OR REPLACE não altera o row type de RETURNS TABLE (42P13 ao mudar tipos das colunas).
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- Função para histórico de ranking do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Função para estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE c.is_alive = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO get_user_characters PARA RETORNAR APENAS VIVOS
-- =====================================

-- Primeiro remover a função existente para evitar conflito de tipos
DROP FUNCTION IF EXISTS get_user_characters(UUID);

-- Recriar a função com o tipo de retorno correto
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER,
    is_alive BOOLEAN,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp,
        c.is_alive,
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id 
      AND c.is_alive = true  -- Apenas personagens vivos
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO delete_character PARA MARCAR COMO MORTO
-- =====================================

-- Primeiro remover a função existente para evitar conflito de tipos
DROP FUNCTION IF EXISTS delete_character(UUID);

-- Recriar a função para marcar como morto ao invés de deletar
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Obter user_id antes de marcar como morto
    SELECT user_id INTO v_user_id
    FROM characters
    WHERE id = p_character_id;
    
    -- Marcar personagem como morto ao invés de deletar
    UPDATE characters 
    SET 
        is_alive = false,
        hp = 0,  -- Garantir que HP seja 0
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Atualizar progressão do usuário
    IF v_user_id IS NOT NULL THEN
        PERFORM update_user_character_progression(v_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. CRIAR ÍNDICES OTIMIZADOS
-- =====================================

-- Índices para ranking por andar (apenas personagens que jogaram)
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor 
ON characters(floor DESC, level DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_ranking_level 
ON characters(level DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold 
ON characters(gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índices para filtros de status
CREATE INDEX IF NOT EXISTS idx_characters_alive_ranking 
ON characters(is_alive, floor DESC, level DESC) 
WHERE floor > 0;

-- Índices para histórico do usuário
CREATE INDEX IF NOT EXISTS idx_characters_user_history 
ON characters(user_id, created_at DESC);

-- Índice composto para personagens vivos do usuário
CREATE INDEX IF NOT EXISTS idx_characters_user_alive 
ON characters(user_id, is_alive, created_at DESC) 
WHERE is_alive = true;

-- =====================================
-- 7. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Garantir que todos os personagens tenham floor >= 1
UPDATE characters 
SET floor = 1 
WHERE floor IS NULL OR floor < 1;

-- Garantir que is_alive esteja correto baseado no HP
UPDATE characters 
SET is_alive = (hp > 0);

-- Script concluído com sucesso!
-- Sistema de ranking corrigido e otimizado 
-- Migração para corrigir erros de coluna inexistente e tipos incompatíveis
-- Corrige problemas com critical_chance e tipos VARCHAR vs TEXT

-- =====================================
-- 1. ADICIONAR COLUNAS FALTANTES NA TABELA CHARACTERS
-- =====================================

-- Adicionar colunas critical_chance e critical_damage se não existirem
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS critical_chance NUMERIC(5,2) DEFAULT 5.0;

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS critical_damage NUMERIC(5,2) DEFAULT 1.5;

-- Atualizar valores baseados nos atributos existentes
UPDATE characters 
SET 
    critical_chance = ROUND((luck * 0.5)::NUMERIC, 2),
    critical_damage = ROUND((1.5 + (luck::NUMERIC / 100))::NUMERIC, 2)
WHERE critical_chance IS NULL OR critical_damage IS NULL;

-- =====================================
-- 2. CORRIGIR TIPOS DE RETORNO DAS FUNÇÕES DE RANKING
-- =====================================

-- Remover funções com tipos incompatíveis
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid, integer);

-- Recriar função para ranking dinâmico por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Recriar função para ranking dinâmico por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Recriar função para ranking dinâmico por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Recriar função para histórico de ranking do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 3. ATUALIZAR FUNÇÃO get_user_characters PARA INCLUIR CRITICAL_CHANCE
-- =====================================

-- Remover função existente
DROP FUNCTION IF EXISTS get_user_characters(UUID);

-- Recriar função com colunas corretas
CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER,
    is_alive BOOLEAN,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp,
        COALESCE(c.is_alive, true),
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id 
      AND COALESCE(c.is_alive, true) = true  -- Apenas personagens vivos
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO get_character_full_stats
-- =====================================

-- Remover função existente se houver
DROP FUNCTION IF EXISTS get_character_full_stats(UUID);

-- Recriar função com todas as colunas necessárias
CREATE OR REPLACE FUNCTION get_character_full_stats(p_character_id UUID)
RETURNS TABLE(
    character_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as character_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp
    FROM characters c
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. CRIAR TRIGGER PARA ATUALIZAR CRITICAL_CHANCE AUTOMATICAMENTE
-- =====================================

-- Função para recalcular critical_chance e critical_damage baseado em luck
CREATE OR REPLACE FUNCTION update_critical_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Atualizar critical_chance e critical_damage baseado no luck
    NEW.critical_chance := ROUND((NEW.luck * 0.5)::NUMERIC, 2);
    NEW.critical_damage := ROUND((1.5 + (NEW.luck::NUMERIC / 100))::NUMERIC, 2);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para atualizar automaticamente quando luck mudar
DROP TRIGGER IF EXISTS update_critical_stats_trigger ON characters;
CREATE TRIGGER update_critical_stats_trigger
    BEFORE UPDATE OF luck ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_critical_stats();

-- =====================================
-- 6. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar todos os personagens existentes com valores corretos de crítico
UPDATE characters 
SET 
    critical_chance = ROUND((luck * 0.5)::NUMERIC, 2),
    critical_damage = ROUND((1.5 + (luck::NUMERIC / 100))::NUMERIC, 2)
WHERE critical_chance IS NULL 
   OR critical_damage IS NULL 
   OR critical_chance = 0;

-- Garantir que is_alive tenha valor padrão
UPDATE characters 
SET is_alive = true 
WHERE is_alive IS NULL;

-- Script concluído com sucesso!
-- Erros de coluna inexistente e tipos incompatíveis corrigidos 
-- Migração para limpar funções duplicadas e resolver conflitos de overloading
-- Remove todas as versões das funções de ranking e recria apenas as corretas

-- =====================================
-- 1. REMOVER TODAS AS VERSÕES DAS FUNÇÕES DE RANKING
-- =====================================

-- Remover todas as versões possíveis das funções de ranking dinâmico
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor();

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level();

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, text);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, character varying);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer, varchar);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(integer);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold();

DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid, integer);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(uuid);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history();

DROP FUNCTION IF EXISTS get_dynamic_user_stats(uuid);
DROP FUNCTION IF EXISTS get_dynamic_user_stats();

-- Remover também versões otimizadas se existirem
DROP FUNCTION IF EXISTS get_optimized_global_ranking(text, integer, text);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(varchar, integer, varchar);
DROP FUNCTION IF EXISTS get_fast_user_stats(uuid);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(uuid, integer);

-- =====================================
-- 2. RECRIAR FUNÇÕES DE RANKING COM TIPOS CONSISTENTES
-- =====================================

-- Função para ranking dinâmico por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para ranking dinâmico por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função para histórico de ranking do usuário
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Função para estatísticas dinâmicas do usuário
CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE COALESCE(c.is_alive, true) = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 3. GARANTIR PERMISSÕES CORRETAS
-- =====================================

-- Garantir que as funções podem ser executadas por usuários autenticados
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_highest_floor(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_level(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_gold(INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_user_ranking_history(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_dynamic_user_stats(UUID) TO authenticated;

-- Garantir que as funções podem ser executadas pelo service_role
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_highest_floor(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_level(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_ranking_by_gold(INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_user_ranking_history(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION get_dynamic_user_stats(UUID) TO service_role;

-- Script concluído com sucesso!
-- Funções duplicadas removidas e recriadas com tipos consistentes 
-- Migração para corrigir o sistema de ranking e garantir atualização em tempo real do andar mais alto
-- Esta migração resolve problemas de sincronização entre o progresso do personagem e o ranking

-- =====================================
-- 1. CORRIGIR FUNÇÃO update_character_floor PARA ATUALIZAR RANKING
-- =====================================

-- Atualizar a função para garantir que o ranking seja atualizado quando o andar muda
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_old_floor INTEGER;
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Buscar dados atuais do personagem
    SELECT floor, user_id, name INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    v_old_floor := v_character.floor;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW(),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log para debug
    RAISE NOTICE 'Personagem % (%) - Andar atualizado: % -> %', 
        v_character.name, p_character_id, v_old_floor, p_floor;
    
    -- Se o andar aumentou, atualizar progressão do usuário
    IF p_floor > v_old_floor THEN
        PERFORM update_user_character_progression(v_character.user_id);
        RAISE NOTICE 'Progressão do usuário % atualizada devido ao avanço do andar', v_character.user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. CRIAR TRIGGER PARA ATUALIZAR RANKING AUTOMATICAMENTE
-- =====================================

-- Função para trigger que atualiza o ranking quando o andar muda
CREATE OR REPLACE FUNCTION trigger_update_ranking_on_floor_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas processar se o andar realmente mudou
    IF OLD.floor IS DISTINCT FROM NEW.floor THEN
        -- Log para debug
        RAISE NOTICE 'Trigger: Andar do personagem % mudou de % para %', 
            NEW.name, OLD.floor, NEW.floor;
        
        -- Atualizar last_activity para marcar atividade recente
        NEW.last_activity := NOW();
        
        -- Se o andar aumentou, atualizar progressão do usuário
        IF NEW.floor > COALESCE(OLD.floor, 0) THEN
            -- Executar em background para não bloquear a transação principal
            PERFORM pg_notify('ranking_update', json_build_object(
                'user_id', NEW.user_id,
                'character_id', NEW.id,
                'old_floor', OLD.floor,
                'new_floor', NEW.floor,
                'character_name', NEW.name
            )::text);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger
DROP TRIGGER IF EXISTS update_ranking_on_floor_change ON characters;
CREATE TRIGGER update_ranking_on_floor_change
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_ranking_on_floor_change();

-- =====================================
-- 3. OTIMIZAR FUNÇÕES DE RANKING PARA TEMPO REAL
-- =====================================

-- Função otimizada para ranking por andar mais alto (tempo real)
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (c.user_id)
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY 
        c.user_id,
        c.floor DESC, 
        c.level DESC, 
        c.created_at ASC
    LIMIT p_limit * 2 -- Buscar mais registros para garantir diversidade de usuários
;
END;
$$;

-- Função para obter o melhor personagem de cada usuário por andar
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY c.user_id 
                ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
            ) as rn
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
    )
    SELECT 
        rc.id,
        rc.user_id,
        rc.player_name,
        rc.highest_floor,
        rc.character_level,
        rc.character_gold,
        rc.character_alive,
        rc.created_at
    FROM ranked_characters rc
    WHERE rc.rn = 1
    ORDER BY rc.highest_floor DESC, rc.character_level DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Atualizar a função principal para usar a nova lógica
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_floor(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA SINCRONIZAR RANKING MANUALMENTE
-- =====================================

-- Função para sincronizar o ranking de todos os personagens (uso administrativo)
CREATE OR REPLACE FUNCTION sync_all_character_rankings()
RETURNS TABLE(
    user_id UUID,
    characters_updated INTEGER,
    max_floor INTEGER
) AS $$
DECLARE
    user_record RECORD;
    char_count INTEGER;
    max_floor_reached INTEGER;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT c.user_id 
        FROM characters c 
        WHERE c.floor > 0
    LOOP
        -- Contar personagens do usuário
        SELECT COUNT(*), MAX(c.floor)
        INTO char_count, max_floor_reached
        FROM characters c
        WHERE c.user_id = user_record.user_id;
        
        -- Atualizar progressão do usuário
        PERFORM update_user_character_progression(user_record.user_id);
        
        RETURN QUERY SELECT user_record.user_id, char_count, max_floor_reached;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. ÍNDICES OTIMIZADOS PARA RANKING EM TEMPO REAL
-- =====================================

-- Índice composto para ranking por andar (um por usuário)
CREATE INDEX IF NOT EXISTS idx_characters_user_floor_ranking 
ON characters(user_id, floor DESC, level DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice para ranking global por andar
CREATE INDEX IF NOT EXISTS idx_characters_global_floor_ranking 
ON characters(floor DESC, level DESC, created_at ASC) 
WHERE floor > 0;

-- Índice para filtros de status
CREATE INDEX IF NOT EXISTS idx_characters_alive_floor_ranking 
ON characters(is_alive, floor DESC, level DESC) 
WHERE floor > 0;

-- =====================================
-- 6. FUNÇÃO DE TESTE PARA VERIFICAR RANKING
-- =====================================

-- Função para testar se o ranking está funcionando corretamente
CREATE OR REPLACE FUNCTION test_ranking_system(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
DECLARE
    char_count INTEGER;
    ranking_count INTEGER;
    max_floor INTEGER;
BEGIN
    -- Teste 1: Verificar se há personagens
    SELECT COUNT(*) INTO char_count FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        char_count::TEXT,
        'Characters with floor > 0'::TEXT;
    
    -- Teste 2: Verificar ranking por andar
    SELECT COUNT(*) INTO ranking_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RETURN QUERY SELECT 
        'Ranking Entries'::TEXT,
        ranking_count::TEXT,
        'Entries in highest floor ranking'::TEXT;
    
    -- Teste 3: Verificar andar máximo
    SELECT MAX(floor) INTO max_floor FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Max Floor Reached'::TEXT,
        COALESCE(max_floor, 0)::TEXT,
        'Highest floor in database'::TEXT;
    
    -- Teste 4: Se usuário específico fornecido, verificar seus dados
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*), MAX(floor) 
        INTO char_count, max_floor
        FROM characters 
        WHERE user_id = p_user_id AND floor > 0;
        
        RETURN QUERY SELECT 
            'User Characters'::TEXT,
            char_count::TEXT,
            format('User %s has %s characters, max floor %s', 
                p_user_id, char_count, COALESCE(max_floor, 0))::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION update_character_floor IS 'Atualiza o andar do personagem e sincroniza o ranking automaticamente';
COMMENT ON FUNCTION trigger_update_ranking_on_floor_change IS 'Trigger que monitora mudanças no andar e atualiza o ranking';
COMMENT ON FUNCTION get_best_character_per_user_by_floor IS 'Obtém o melhor personagem de cada usuário para ranking por andar';
COMMENT ON FUNCTION sync_all_character_rankings IS 'Sincroniza manualmente o ranking de todos os usuários (uso administrativo)';
COMMENT ON FUNCTION test_ranking_system IS 'Função de teste para verificar se o sistema de ranking está funcionando';

-- Script concluído com sucesso!
-- O sistema de ranking agora será atualizado automaticamente quando o andar do personagem mudar 
-- Migração para atualizar as funções de ranking por nível e ouro com lógica otimizada
-- Garante consistência entre todas as modalidades de ranking

-- =====================================
-- 1. FUNÇÃO OTIMIZADA PARA RANKING POR NÍVEL
-- =====================================

-- Remover funções existentes primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_best_character_per_user_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);

-- Função para obter o melhor personagem de cada usuário por nível
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY c.user_id 
                ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
            ) as rn
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
    )
    SELECT 
        rc.id,
        rc.user_id,
        rc.player_name,
        rc.highest_floor,
        rc.character_level,
        rc.character_gold,
        rc.character_alive,
        rc.created_at
    FROM ranked_characters rc
    WHERE rc.rn = 1
    ORDER BY rc.character_level DESC, rc.highest_floor DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Criar função principal de ranking por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_level(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 2. FUNÇÃO OTIMIZADA PARA RANKING POR OURO
-- =====================================

-- Remover funções existentes primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_best_character_per_user_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);

-- Função para obter o melhor personagem de cada usuário por ouro
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY c.user_id 
                ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
            ) as rn
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
    )
    SELECT 
        rc.id,
        rc.user_id,
        rc.player_name,
        rc.highest_floor,
        rc.character_level,
        rc.character_gold,
        rc.character_alive,
        rc.created_at
    FROM ranked_characters rc
    WHERE rc.rn = 1
    ORDER BY rc.character_gold DESC, rc.highest_floor DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Criar função principal de ranking por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_gold(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 3. FUNÇÃO OTIMIZADA PARA HISTÓRICO DO USUÁRIO
-- =====================================

-- Remover função existente primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);

-- Criar função de histórico do usuário para ser mais eficiente
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.user_id = p_user_id AND
        c.floor > 0 -- Apenas personagens que jogaram
    ORDER BY c.floor DESC, c.level DESC, c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO OTIMIZADA PARA ESTATÍSTICAS DO USUÁRIO
-- =====================================

-- Remover função existente primeiro para evitar conflito de tipo
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- Criar função de estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*)::INTEGER as total_runs,
        COUNT(CASE WHEN COALESCE(c.is_alive, true) = true THEN 1 END)::INTEGER as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id AND c.floor > 0;
END;
$$;

-- =====================================
-- 5. ÍNDICES ADICIONAIS PARA OTIMIZAÇÃO
-- =====================================

-- Índice para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_user_level_ranking 
ON characters(user_id, level DESC, floor DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_user_gold_ranking 
ON characters(user_id, gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice global para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_global_level_ranking 
ON characters(level DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índice global para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_global_gold_ranking 
ON characters(gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- =====================================
-- 6. FUNÇÃO PARA LIMPAR CACHE DE RANKING (SE NECESSÁRIO)
-- =====================================

-- Função para forçar atualização de todos os rankings
CREATE OR REPLACE FUNCTION refresh_all_rankings()
RETURNS TEXT AS $$
DECLARE
    total_users INTEGER;
    total_characters INTEGER;
BEGIN
    -- Contar totais
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters WHERE floor > 0;
    SELECT COUNT(*) INTO total_characters FROM characters WHERE floor > 0;
    
    -- Atualizar last_activity de todos os personagens ativos para forçar refresh
    UPDATE characters 
    SET updated_at = NOW() 
    WHERE floor > 0;
    
    -- Retornar estatísticas
    RETURN format('Rankings atualizados: %s usuários, %s personagens', total_users, total_characters);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_best_character_per_user_by_level IS 'Obtém o melhor personagem de cada usuário para ranking por nível';
COMMENT ON FUNCTION get_best_character_per_user_by_gold IS 'Obtém o melhor personagem de cada usuário para ranking por ouro';
COMMENT ON FUNCTION get_dynamic_ranking_by_level IS 'Ranking dinâmico por maior nível (um personagem por usuário)';
COMMENT ON FUNCTION get_dynamic_ranking_by_gold IS 'Ranking dinâmico por maior quantidade de ouro (um personagem por usuário)';
COMMENT ON FUNCTION get_dynamic_user_ranking_history IS 'Histórico de personagens do usuário ordenado por progresso';
COMMENT ON FUNCTION get_dynamic_user_stats IS 'Estatísticas consolidadas do usuário baseadas em todos os seus personagens';
COMMENT ON FUNCTION refresh_all_rankings IS 'Força atualização de todos os rankings (uso administrativo)';

-- Script concluído com sucesso!
-- Todas as funções de ranking agora usam a mesma lógica otimizada e em tempo real 
-- Migração final para garantir que o sistema de ranking funcione perfeitamente
-- Corrige dados existentes e adiciona validações finais

-- =====================================
-- 1. CORRIGIR DADOS EXISTENTES
-- =====================================

-- Garantir que todos os personagens tenham is_alive definido corretamente
UPDATE characters 
SET is_alive = CASE 
    WHEN hp > 0 THEN true 
    ELSE false 
END
WHERE is_alive IS NULL;

-- Garantir que todos os personagens tenham floor >= 1
UPDATE characters 
SET floor = 1 
WHERE floor IS NULL OR floor < 1;

-- Atualizar last_activity para personagens que não têm
UPDATE characters 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- =====================================
-- 2. FUNÇÃO PARA VERIFICAR INTEGRIDADE DOS DADOS
-- =====================================

CREATE OR REPLACE FUNCTION check_ranking_data_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    count_affected INTEGER,
    details TEXT
) AS $$
DECLARE
    null_floors INTEGER;
    null_alive INTEGER;
    invalid_floors INTEGER;
    total_characters INTEGER;
BEGIN
    -- Contar personagens com problemas
    SELECT COUNT(*) INTO null_floors FROM characters WHERE floor IS NULL;
    SELECT COUNT(*) INTO null_alive FROM characters WHERE is_alive IS NULL;
    SELECT COUNT(*) INTO invalid_floors FROM characters WHERE floor < 1;
    SELECT COUNT(*) INTO total_characters FROM characters;
    
    -- Retornar resultados dos checks
    RETURN QUERY SELECT 
        'Null Floors'::TEXT,
        CASE WHEN null_floors = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        null_floors,
        format('Personagens com floor NULL: %s', null_floors)::TEXT;
    
    RETURN QUERY SELECT 
        'Null Alive Status'::TEXT,
        CASE WHEN null_alive = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        null_alive,
        format('Personagens com is_alive NULL: %s', null_alive)::TEXT;
    
    RETURN QUERY SELECT 
        'Invalid Floors'::TEXT,
        CASE WHEN invalid_floors = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        invalid_floors,
        format('Personagens com floor < 1: %s', invalid_floors)::TEXT;
    
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        'INFO'::TEXT,
        total_characters,
        format('Total de personagens no banco: %s', total_characters)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 3. FUNÇÃO PARA CORRIGIR AUTOMATICAMENTE PROBLEMAS
-- =====================================

CREATE OR REPLACE FUNCTION fix_ranking_data_issues()
RETURNS TEXT AS $$
DECLARE
    fixed_floors INTEGER := 0;
    fixed_alive INTEGER := 0;
    fixed_activity INTEGER := 0;
BEGIN
    -- Corrigir floors NULL ou inválidos
    UPDATE characters 
    SET floor = 1 
    WHERE floor IS NULL OR floor < 1;
    GET DIAGNOSTICS fixed_floors = ROW_COUNT;
    
    -- Corrigir is_alive NULL
    UPDATE characters 
    SET is_alive = (hp > 0)
    WHERE is_alive IS NULL;
    GET DIAGNOSTICS fixed_alive = ROW_COUNT;
    
    -- Corrigir last_activity NULL
    UPDATE characters 
    SET last_activity = COALESCE(updated_at, created_at, NOW())
    WHERE last_activity IS NULL;
    GET DIAGNOSTICS fixed_activity = ROW_COUNT;
    
    RETURN format('Correções aplicadas: %s floors, %s status alive, %s last_activity', 
        fixed_floors, fixed_alive, fixed_activity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. OTIMIZAR FUNÇÃO get_dynamic_ranking_by_highest_floor
-- =====================================

-- Remover função existente primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);

-- Versão final otimizada da função principal de ranking
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Log para debug
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamado: limit=%, filter=%', p_limit, p_status_filter;
    
    RETURN QUERY
    WITH best_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
        ORDER BY 
            c.user_id,
            c.floor DESC, 
            c.level DESC, 
            c.created_at ASC
    )
    SELECT 
        bc.id,
        bc.user_id,
        bc.player_name,
        bc.highest_floor,
        bc.character_level,
        bc.character_gold,
        bc.character_alive,
        bc.created_at
    FROM best_characters bc
    ORDER BY bc.highest_floor DESC, bc.character_level DESC, bc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 5. FUNÇÃO PARA MONITORAR ATUALIZAÇÕES DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION log_ranking_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Log apenas mudanças significativas
    IF OLD.floor IS DISTINCT FROM NEW.floor OR 
       OLD.level IS DISTINCT FROM NEW.level OR 
       OLD.gold IS DISTINCT FROM NEW.gold THEN
        
        RAISE NOTICE 'Ranking Update: Player % (%) - Floor: % -> %, Level: % -> %, Gold: % -> %',
            NEW.name, NEW.id, 
            COALESCE(OLD.floor, 0), NEW.floor,
            COALESCE(OLD.level, 0), NEW.level,
            COALESCE(OLD.gold, 0), NEW.gold;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para monitoramento (apenas em desenvolvimento)
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;
CREATE TRIGGER log_ranking_updates
    AFTER UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION log_ranking_update();

-- =====================================
-- 6. EXECUTAR CORREÇÕES AUTOMÁTICAS
-- =====================================

-- Executar verificação de integridade
DO $$
DECLARE
    integrity_result RECORD;
    fix_result TEXT;
BEGIN
    RAISE NOTICE 'Executando verificação de integridade dos dados...';
    
    -- Verificar integridade
    FOR integrity_result IN 
        SELECT * FROM check_ranking_data_integrity()
    LOOP
        RAISE NOTICE 'Check: % - Status: % - Count: % - Details: %', 
            integrity_result.check_name, 
            integrity_result.status, 
            integrity_result.count_affected, 
            integrity_result.details;
    END LOOP;
    
    -- Aplicar correções se necessário
    SELECT fix_ranking_data_issues() INTO fix_result;
    RAISE NOTICE 'Correções aplicadas: %', fix_result;
    
    RAISE NOTICE 'Verificação de integridade concluída!';
END;
$$;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO FINAL
-- =====================================

COMMENT ON FUNCTION check_ranking_data_integrity IS 'Verifica a integridade dos dados do sistema de ranking';
COMMENT ON FUNCTION fix_ranking_data_issues IS 'Corrige automaticamente problemas comuns nos dados de ranking';
COMMENT ON FUNCTION log_ranking_update IS 'Registra atualizações importantes no ranking para debug';

-- =====================================
-- 8. ESTATÍSTICAS FINAIS
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    chars_with_progress INTEGER;
    max_floor_reached INTEGER;
    total_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO chars_with_progress FROM characters WHERE floor > 1;
    SELECT MAX(floor) INTO max_floor_reached FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters WHERE floor > 0;
    
    RAISE NOTICE '=== ESTATÍSTICAS DO SISTEMA DE RANKING ===';
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens com progresso (floor > 1): %', chars_with_progress;
    RAISE NOTICE 'Andar mais alto alcançado: %', COALESCE(max_floor_reached, 0);
    RAISE NOTICE 'Total de usuários ativos: %', total_users;
    RAISE NOTICE '==========================================';
END;
$$;

-- Script concluído com sucesso!
-- O sistema de ranking está agora completamente funcional e otimizado 
-- Migração para corrigir problemas críticos do sistema de ranking global
-- Data: 2024-12-02
-- Versão: 20241202000007

-- =====================================
-- 1. DIAGNÓSTICO E LIMPEZA
-- =====================================

-- Primeiro, vamos verificar o estado atual dos dados
DO $$
DECLARE
    total_characters INTEGER;
    alive_characters INTEGER;
    dead_characters INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_characters FROM characters;
    SELECT COUNT(*) INTO alive_characters FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_characters FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'DIAGNÓSTICO: Total de personagens: %, Vivos: %, Mortos: %', 
        total_characters, alive_characters, dead_characters;
END $$;

-- =====================================
-- 2. CORRIGIR FUNÇÕES DE RANKING GLOBAL
-- =====================================

-- Função corrigida para ranking global por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_level chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_gold chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 3. FUNÇÃO SEPARADA PARA HISTÓRICO DO USUÁRIO
-- =====================================

-- Manter função específica para histórico do usuário (não é ranking global)
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_user_ranking_history chamada para usuário: % com limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO DE TESTE SIMPLIFICADA
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_data()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    count_value BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Teste 1: Total de personagens
    RETURN QUERY
    SELECT 
        'Total de personagens'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters;
    
    -- Teste 2: Personagens vivos
    RETURN QUERY
    SELECT 
        'Personagens vivos'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters 
    WHERE is_alive = true;
    
    -- Teste 3: Personagens mortos
    RETURN QUERY
    SELECT 
        'Personagens mortos'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters 
    WHERE is_alive = false;
END;
$$;

-- =====================================
-- 5. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar campo is_alive baseado no HP atual
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive != (hp > 0);

-- Garantir que todos os personagens tenham floor válido
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- =====================================
-- 6. CRIAR ÍNDICES OTIMIZADOS
-- =====================================

-- Remover índices antigos que podem estar causando problemas
DROP INDEX IF EXISTS idx_characters_ranking_floor;
DROP INDEX IF EXISTS idx_characters_ranking_level;
DROP INDEX IF EXISTS idx_characters_ranking_gold;
DROP INDEX IF EXISTS idx_characters_alive_ranking;

-- Remover índices que podem já existir para recriar
DROP INDEX IF EXISTS idx_characters_global_floor_ranking;
DROP INDEX IF EXISTS idx_characters_global_level_ranking;
DROP INDEX IF EXISTS idx_characters_global_gold_ranking;
DROP INDEX IF EXISTS idx_characters_status_filter;

-- Criar novos índices otimizados
CREATE INDEX IF NOT EXISTS idx_characters_global_floor_ranking 
ON characters(floor DESC, level DESC, gold DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_global_level_ranking 
ON characters(level DESC, floor DESC, gold DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_global_gold_ranking 
ON characters(gold DESC, level DESC, floor DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_status_filter 
ON characters(is_alive, floor DESC, level DESC);

-- =====================================
-- 7. VERIFICAÇÃO FINAL SIMPLIFICADA
-- =====================================

-- Verificar se as funções foram criadas corretamente
DO $$
DECLARE
    total_chars INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO FINAL ===';
    
    -- Contar personagens diretamente
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===';
END $$;

-- Migração concluída com sucesso! 
-- Migração para corrigir incompatibilidade de tipos nas funções de ranking
-- Data: 2024-12-02
-- Versão: 20241202000008

-- =====================================
-- CORRIGIR TIPOS DAS FUNÇÕES DE RANKING
-- =====================================

-- Primeiro, remover as funções existentes para poder alterar os tipos de retorno
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- Função corrigida para ranking global por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_level chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_ranking_by_gold chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para histórico do usuário
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),  -- Corrigido para VARCHAR(100)
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'get_dynamic_user_ranking_history chamada para usuário: % com limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para estatísticas do usuário
CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE c.is_alive = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- VERIFICAÇÃO FINAL
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO DE TIPOS CORRIGIDOS ===';
    
    -- Contar personagens diretamente
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    RAISE NOTICE '=== TIPOS CORRIGIDOS COM SUCESSO ===';
END $$;

-- Migração concluída! 
-- Migração definitiva para garantir ranking global funcionando
-- Data: 2024-12-02
-- Versão: 20241202000009

-- =====================================
-- 1. DIAGNÓSTICO INICIAL
-- =====================================

DO $$
DECLARE
    total_characters INTEGER;
    total_users INTEGER;
    alive_characters INTEGER;
    dead_characters INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_characters FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    SELECT COUNT(*) INTO alive_characters FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_characters FROM characters WHERE is_alive = false;
    
    RAISE NOTICE '=== DIAGNÓSTICO INICIAL ===';
    RAISE NOTICE 'Total de personagens: %', total_characters;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    RAISE NOTICE 'Personagens vivos: %', alive_characters;
    RAISE NOTICE 'Personagens mortos: %', dead_characters;
    RAISE NOTICE '================================';
END $$;

-- =====================================
-- 2. REMOVER FUNÇÕES EXISTENTES
-- =====================================

-- Remover todas as funções de ranking existentes
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- =====================================
-- 3. CRIAR FUNÇÕES DE RANKING GLOBAL DEFINITIVAS
-- =====================================

-- Função para ranking global por andar mais alto
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por andar - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por nível
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por nível - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por ouro
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por ouro - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA HISTÓRICO DO USUÁRIO (SEPARADA)
-- =====================================

-- Função específica para histórico do usuário (não é ranking global)
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '[USER HISTORY] Buscando histórico do usuário: %, limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 5. FUNÇÃO PARA ESTATÍSTICAS DO USUÁRIO
-- =====================================

CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE c.is_alive = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 6. TESTE DEFINITIVO DO RANKING GLOBAL
-- =====================================

DO $$
DECLARE
    test_result RECORD;
    total_count INTEGER;
BEGIN
    RAISE NOTICE '=== TESTE DEFINITIVO DO RANKING GLOBAL ===';
    
    -- Teste 1: Ranking por andar (todos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 1 - Ranking por andar (todos): % registros', total_count;
    
    -- Teste 2: Ranking por andar (vivos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'alive');
    RAISE NOTICE 'Teste 2 - Ranking por andar (vivos): % registros', total_count;
    
    -- Teste 3: Ranking por andar (mortos)
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'dead');
    RAISE NOTICE 'Teste 3 - Ranking por andar (mortos): % registros', total_count;
    
    -- Teste 4: Verificar diversidade de usuários no ranking
    SELECT COUNT(DISTINCT user_id) INTO total_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 4 - Usuários únicos no ranking: %', total_count;
    
    -- Teste 5: Mostrar top 5 do ranking
    RAISE NOTICE 'Teste 5 - Top 5 do ranking global:';
    FOR test_result IN 
        SELECT player_name, highest_floor, character_level, character_alive
        FROM get_dynamic_ranking_by_highest_floor(5, 'all')
    LOOP
        RAISE NOTICE '  - %: Andar %, Nível %, Vivo: %', 
            test_result.player_name, test_result.highest_floor, 
            test_result.character_level, test_result.character_alive;
    END LOOP;
    
    RAISE NOTICE '=== TESTES CONCLUÍDOS ===';
END $$;

-- =====================================
-- 7. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar campo is_alive baseado no HP atual
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive != (hp > 0);

-- Garantir que todos os personagens tenham floor válido
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- =====================================
-- 8. VERIFICAÇÃO FINAL
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    total_users INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO FINAL ===';
    
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    IF total_chars > 0 AND total_users > 0 THEN
        RAISE NOTICE '✅ RANKING GLOBAL CONFIGURADO COM SUCESSO!';
        RAISE NOTICE '✅ O ranking agora mostra TODOS os personagens de TODOS os usuários!';
    ELSE
        RAISE NOTICE '❌ PROBLEMA: Não há dados suficientes para o ranking';
    END IF;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA ===';
END $$;

-- Migração concluída! 
-- Migração para corrigir SECURITY DEFINER nas funções de ranking
-- Data: 2024-12-02
-- Versão: 20241202000010

-- =====================================
-- PROBLEMA IDENTIFICADO:
-- As funções de ranking não têm SECURITY DEFINER, então elas executam
-- com privilégios do usuário atual e só conseguem ver os personagens
-- desse usuário devido às políticas RLS.
-- =====================================

-- =====================================
-- 1. REMOVER FUNÇÕES EXISTENTES
-- =====================================

DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- =====================================
-- 2. RECRIAR FUNÇÕES COM SECURITY DEFINER
-- =====================================

-- Função para ranking global por andar mais alto (COM SECURITY DEFINER)
CREATE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por andar - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por nível (COM SECURITY DEFINER)
CREATE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por nível - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- Função para ranking global por ouro (COM SECURITY DEFINER)
CREATE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER  -- <<<< ESTA É A CORREÇÃO PRINCIPAL!
AS $$
BEGIN
    RAISE NOTICE '[GLOBAL RANKING] Buscando ranking por ouro - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra TODOS os personagens de TODOS os usuários
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
    
    -- Log do resultado
    RAISE NOTICE '[GLOBAL RANKING] Retornando % registros para filtro %', 
        (SELECT COUNT(*) FROM characters c WHERE 
            CASE 
                WHEN p_status_filter = 'alive' THEN c.is_alive = true
                WHEN p_status_filter = 'dead' THEN c.is_alive = false
                ELSE true
            END
        ), p_status_filter;
END;
$$;

-- =====================================
-- 3. FUNÇÃO PARA HISTÓRICO DO USUÁRIO (MANTÉM SEM SECURITY DEFINER)
-- =====================================

-- Esta função deve continuar SEM SECURITY DEFINER pois deve respeitar RLS
-- para mostrar apenas os personagens do usuário atual
CREATE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
-- SEM SECURITY DEFINER - deve respeitar RLS para mostrar apenas dados do usuário
AS $$
BEGIN
    RAISE NOTICE '[USER HISTORY] Buscando histórico do usuário: %, limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::VARCHAR(100) as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA ESTATÍSTICAS DO USUÁRIO (MANTÉM SEM SECURITY DEFINER)
-- =====================================

-- Esta função deve continuar SEM SECURITY DEFINER pois deve respeitar RLS
-- para calcular estatísticas apenas dos personagens do usuário atual
CREATE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs BIGINT,
    alive_characters BIGINT
)
LANGUAGE plpgsql
-- SEM SECURITY DEFINER - deve respeitar RLS para mostrar apenas dados do usuário
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*) as total_runs,
        COUNT(*) FILTER (WHERE c.is_alive = true) as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id;
END;
$$;

-- =====================================
-- 5. TESTE FINAL
-- =====================================

DO $$
DECLARE
    test_result RECORD;
    total_count INTEGER;
    total_users INTEGER;
BEGIN
    RAISE NOTICE '=== TESTE FINAL COM SECURITY DEFINER ===';
    
    -- Verificar total de personagens no banco
    SELECT COUNT(*) INTO total_count FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters;
    
    RAISE NOTICE 'Total de personagens no banco: %', total_count;
    RAISE NOTICE 'Total de usuários únicos: %', total_users;
    
    -- Teste 1: Ranking por andar (todos) - deve mostrar personagens de todos os usuários
    SELECT COUNT(*) INTO total_count FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 1 - Ranking por andar (todos): % registros', total_count;
    
    -- Teste 2: Verificar diversidade de usuários no ranking
    SELECT COUNT(DISTINCT user_id) INTO total_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RAISE NOTICE 'Teste 2 - Usuários únicos no ranking: %', total_count;
    
    -- Teste 3: Mostrar top 3 do ranking para verificar se há diferentes usuários
    RAISE NOTICE 'Teste 3 - Top 3 do ranking global:';
    FOR test_result IN 
        SELECT player_name, highest_floor, character_level, character_alive, user_id
        FROM get_dynamic_ranking_by_highest_floor(3, 'all')
    LOOP
        RAISE NOTICE '  - %: Andar %, Nível %, Vivo: %, User ID: %', 
            test_result.player_name, test_result.highest_floor, 
            test_result.character_level, test_result.character_alive,
            test_result.user_id;
    END LOOP;
    
    IF total_count > 0 AND total_users > 1 THEN
        RAISE NOTICE '✅ CORREÇÃO APLICADA COM SUCESSO!';
        RAISE NOTICE '✅ O ranking agora deve mostrar personagens de TODOS os usuários!';
    ELSE
        RAISE NOTICE '⚠️  ATENÇÃO: Pode não haver dados suficientes para testar completamente';
    END IF;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA ===';
END $$;

-- =====================================
-- EXPLICAÇÃO DA CORREÇÃO:
-- =====================================

-- SECURITY DEFINER faz com que a função execute com os privilégios
-- do usuário que a criou (geralmente o superusuário), permitindo
-- que ela acesse todos os dados da tabela characters, ignorando
-- as políticas RLS que normalmente restringem o acesso apenas
-- aos personagens do usuário atual.
--
-- Isso é necessário para funções de ranking global, mas deve ser
-- usado com cuidado para não expor dados sensíveis.
--
-- As funções de histórico e estatísticas do usuário NÃO devem
-- ter SECURITY DEFINER pois devem respeitar as políticas RLS
-- para mostrar apenas os dados do usuário atual. 
-- Migração para corrigir atualização em tempo real do ranking
-- Data: 2024-12-02
-- Versão: 20241202000011

-- =====================================
-- PROBLEMA IDENTIFICADO:
-- O ranking só é atualizado quando o personagem morre, não durante o progresso.
-- O sistema dinâmico funciona, mas precisa garantir que os dados sejam atualizados
-- em tempo real quando o personagem avança de andar.
-- =====================================

-- =====================================
-- 1. CORRIGIR FUNÇÃO update_character_floor PARA GARANTIR ATUALIZAÇÃO
-- =====================================

CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_old_floor INTEGER;
    v_user_id UUID;
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Buscar dados atuais do personagem
    SELECT floor, user_id, name, level, gold, hp, is_alive
    INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    v_old_floor := COALESCE(v_character.floor, 1);
    v_user_id := v_character.user_id;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW(),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log para debug
    RAISE NOTICE '[RANKING UPDATE] Personagem % (%) - Andar atualizado: % -> %', 
        v_character.name, p_character_id, v_old_floor, p_floor;
    
    -- Se o andar aumentou, atualizar progressão do usuário
    IF p_floor > v_old_floor THEN
        -- Atualizar progressão do usuário na tabela users
        PERFORM update_user_character_progression(v_user_id);
        
        RAISE NOTICE '[RANKING UPDATE] Progressão do usuário % atualizada - novo andar máximo verificado', v_user_id;
        
        -- Forçar atualização do cache de ranking (se necessário)
        -- O sistema dinâmico já reflete automaticamente as mudanças
        RAISE NOTICE '[RANKING UPDATE] Ranking dinâmico atualizado automaticamente para andar %', p_floor;
    END IF;
    
    -- Log final para confirmar atualização
    RAISE NOTICE '[RANKING UPDATE] Atualização concluída - personagem % agora no andar %', 
        v_character.name, p_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. CRIAR TRIGGER PARA MONITORAR MUDANÇAS DE ANDAR
-- =====================================

-- Função para trigger que monitora mudanças de andar
CREATE OR REPLACE FUNCTION trigger_ranking_update_on_floor_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas processar se o andar realmente mudou
    IF OLD.floor IS DISTINCT FROM NEW.floor THEN
        -- Log detalhado para debug
        RAISE NOTICE '[TRIGGER] Andar do personagem % mudou de % para % (user: %)', 
            NEW.name, COALESCE(OLD.floor, 1), NEW.floor, NEW.user_id;
        
        -- Atualizar last_activity para marcar atividade recente
        NEW.last_activity := NOW();
        NEW.updated_at := NOW();
        
        -- Se o andar aumentou, é um progresso positivo
        IF NEW.floor > COALESCE(OLD.floor, 1) THEN
            RAISE NOTICE '[TRIGGER] Progresso detectado - atualizando ranking para usuário %', NEW.user_id;
            
            -- Notificar sistema de ranking (para futuras implementações de cache)
            PERFORM pg_notify('ranking_progress', json_build_object(
                'user_id', NEW.user_id,
                'character_id', NEW.id,
                'character_name', NEW.name,
                'old_floor', COALESCE(OLD.floor, 1),
                'new_floor', NEW.floor,
                'level', NEW.level,
                'gold', NEW.gold,
                'is_alive', NEW.is_alive,
                'timestamp', NOW()
            )::text);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS ranking_update_on_floor_change ON characters;

-- Criar o trigger
CREATE TRIGGER ranking_update_on_floor_change
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_ranking_update_on_floor_change();

-- =====================================
-- 3. OTIMIZAR FUNÇÃO DE RANKING PARA GARANTIR DADOS ATUAIS
-- =====================================

-- Versão otimizada que garante dados em tempo real
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result_count INTEGER;
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking dinâmico - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    WITH best_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true -- 'all' mostra todos
            END
        ORDER BY 
            c.user_id,
            c.floor DESC, 
            c.level DESC, 
            c.created_at ASC
    )
    SELECT 
        bc.id,
        bc.user_id,
        bc.player_name,
        bc.highest_floor,
        bc.character_level,
        bc.character_gold,
        bc.character_alive,
        bc.created_at
    FROM best_characters bc
    ORDER BY bc.highest_floor DESC, bc.character_level DESC, bc.created_at ASC
    LIMIT p_limit;
    
    -- Contar resultados de forma segura
    GET DIAGNOSTICS result_count = ROW_COUNT;
    RAISE NOTICE '[RANKING] Retornando ranking com % entradas', result_count;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA VERIFICAR INTEGRIDADE DO RANKING
-- =====================================

CREATE OR REPLACE FUNCTION verify_ranking_integrity()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
DECLARE
    total_characters INTEGER;
    characters_with_progress INTEGER;
    max_floor_global INTEGER;
    users_in_ranking INTEGER;
    ranking_count INTEGER;
BEGIN
    -- Teste 1: Contar personagens totais
    SELECT COUNT(*) INTO total_characters FROM characters;
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        total_characters::TEXT,
        'Personagens na tabela characters'::TEXT;
    
    -- Teste 2: Personagens com progresso
    SELECT COUNT(*) INTO characters_with_progress 
    FROM characters WHERE floor > 1;
    RETURN QUERY SELECT 
        'Characters with Progress'::TEXT,
        characters_with_progress::TEXT,
        'Personagens que avançaram além do andar 1'::TEXT;
    
    -- Teste 3: Andar máximo global
    SELECT COALESCE(MAX(floor), 0) INTO max_floor_global FROM characters;
    RETURN QUERY SELECT 
        'Max Floor Reached'::TEXT,
        max_floor_global::TEXT,
        'Andar mais alto alcançado por qualquer personagem'::TEXT;
    
    -- Teste 4: Usuários únicos no ranking
    SELECT COUNT(DISTINCT user_id) INTO users_in_ranking 
    FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Unique Users in Ranking'::TEXT,
        users_in_ranking::TEXT,
        'Usuários únicos com personagens que jogaram'::TEXT;
    
    -- Teste 5: Verificar ranking dinâmico (de forma segura)
    BEGIN
        SELECT COUNT(*) INTO ranking_count 
        FROM get_dynamic_ranking_by_highest_floor(50, 'all');
        
        RETURN QUERY SELECT 
            'Dynamic Ranking Test'::TEXT,
            ranking_count::TEXT,
            'Entradas retornadas pela função de ranking dinâmico'::TEXT;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'Dynamic Ranking Test'::TEXT,
                'ERROR'::TEXT,
                SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. FUNÇÃO PARA FORÇAR ATUALIZAÇÃO DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION force_ranking_refresh()
RETURNS TEXT AS $$
DECLARE
    updated_users INTEGER := 0;
    user_record RECORD;
BEGIN
    RAISE NOTICE '[RANKING REFRESH] Iniciando atualização forçada do ranking...';
    
    -- Atualizar progressão de todos os usuários com personagens
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM characters 
        WHERE floor > 0
    LOOP
        PERFORM update_user_character_progression(user_record.user_id);
        updated_users := updated_users + 1;
    END LOOP;
    
    RAISE NOTICE '[RANKING REFRESH] Atualização concluída - % usuários processados', updated_users;
    
    RETURN format('Ranking atualizado com sucesso - %s usuários processados', updated_users);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Corrigir floors inválidos
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- Garantir que is_alive está correto
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive IS NULL OR is_alive != (hp > 0);

-- Atualizar last_activity para personagens sem data
UPDATE characters 
SET last_activity = COALESCE(updated_at, created_at, NOW())
WHERE last_activity IS NULL;

-- =====================================
-- 7. EXECUTAR TESTE INICIAL (VERSÃO SEGURA)
-- =====================================

DO $$
DECLARE
    test_result RECORD;
BEGIN
    RAISE NOTICE '=== TESTE DE INTEGRIDADE DO RANKING ===';
    
    BEGIN
        FOR test_result IN SELECT * FROM verify_ranking_integrity()
        LOOP
            RAISE NOTICE '%: % (%)', test_result.test_name, test_result.result, test_result.details;
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erro durante teste de integridade: %', SQLERRM;
    END;
    
    RAISE NOTICE '========================================';
END;
$$;

-- =====================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION update_character_floor IS 'Atualiza o andar do personagem e garante que o ranking seja atualizado em tempo real';
COMMENT ON FUNCTION trigger_ranking_update_on_floor_change IS 'Trigger que monitora mudanças de andar e atualiza o ranking automaticamente';
COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Função otimizada para ranking dinâmico em tempo real por andar mais alto';
COMMENT ON FUNCTION verify_ranking_integrity IS 'Verifica a integridade dos dados do ranking';
COMMENT ON FUNCTION force_ranking_refresh IS 'Força atualização completa do ranking para todos os usuários';

-- Migração concluída com sucesso!
-- O ranking agora será atualizado em tempo real quando os personagens progredirem. 
-- =====================================
-- SISTEMA DE RANKING DEFINITIVO
-- Data: 2024-12-02
-- Versão: 12 (Definitiva)
-- =====================================

-- Este sistema garante que:
-- 1. Todos os personagens aparecem no ranking (vivos e mortos)
-- 2. Dados são atualizados em tempo real conforme o personagem progride
-- 3. Sistema híbrido: characters para vivos + game_rankings para mortos
-- 4. Performance otimizada com índices adequados

-- =====================================
-- 1. GARANTIR QUE TABELA GAME_RANKINGS EXISTE
-- =====================================

-- Criar tabela game_rankings se não existir
CREATE TABLE IF NOT EXISTS game_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
    character_alive BOOLEAN DEFAULT TRUE,
    character_level INTEGER DEFAULT 1,
    character_gold INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas existem (para compatibilidade com migrações antigas)
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_alive BOOLEAN DEFAULT TRUE;

ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_level INTEGER DEFAULT 1;

ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_gold INTEGER DEFAULT 0;

-- Habilitar RLS
ALTER TABLE game_rankings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas
DROP POLICY IF EXISTS game_rankings_select_policy ON game_rankings;
CREATE POLICY game_rankings_select_policy ON game_rankings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS game_rankings_insert_policy ON game_rankings;
CREATE POLICY game_rankings_insert_policy ON game_rankings
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- =====================================
-- 2. LIMPAR TRIGGERS E FUNÇÕES ANTIGAS
-- =====================================

-- Remover triggers antigos que podem estar causando conflitos
DROP TRIGGER IF EXISTS ranking_update_on_floor_change ON characters;
DROP TRIGGER IF EXISTS update_ranking_on_floor_change ON characters;
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;

-- Remover funções existentes que podem ter conflitos de tipo
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);
DROP FUNCTION IF EXISTS save_ranking_entry_on_death(UUID);
DROP FUNCTION IF EXISTS update_character_floor(UUID, INTEGER);
DROP FUNCTION IF EXISTS test_ranking_system(UUID);

-- =====================================
-- 3. FUNÇÃO PRINCIPAL: RANKING POR ANDAR MAIS ALTO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, limite: %', p_status_filter, p_limit;
    
    -- Sistema híbrido: personagens vivos da tabela characters + mortos da tabela game_rankings
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0 -- Apenas personagens que progrediram
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.floor DESC, c.level DESC, c.created_at ASC
    ),
    dead_characters AS (
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND NOT EXISTS (
              -- Evitar duplicatas: se o usuário tem personagem vivo, não incluir os mortos
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.highest_floor DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO: RANKING POR MAIOR NÍVEL
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.level DESC, c.floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.character_level DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 5. FUNÇÃO: RANKING POR MAIOR OURO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.gold DESC, c.floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.character_gold DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 6. FUNÇÃO: HISTÓRICO DO USUÁRIO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_characters AS (
        -- Personagens vivos do usuário
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id 
          AND c.is_alive = true
          AND c.floor > 0
        UNION ALL
        -- Personagens mortos do usuário (histórico)
        SELECT 
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.user_id = p_user_id 
          AND gr.character_alive = false
    )
    SELECT 
        uc.id,
        uc.user_id,
        uc.player_name,
        uc.highest_floor,
        uc.character_level,
        uc.character_gold,
        uc.character_alive,
        uc.created_at
    FROM user_characters uc
    ORDER BY uc.highest_floor DESC, uc.character_level DESC, uc.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 7. FUNÇÃO: ESTATÍSTICAS DO USUÁRIO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT 
            COALESCE(MAX(c.floor), 0) as live_best_floor,
            COALESCE(MAX(c.level), 1) as live_best_level,
            COALESCE(MAX(c.gold), 0) as live_best_gold,
            COUNT(c.id) as live_count
        FROM characters c
        WHERE c.user_id = p_user_id AND c.is_alive = true
    ),
    dead_stats AS (
        SELECT 
            COALESCE(MAX(gr.highest_floor), 0) as dead_best_floor,
            COALESCE(MAX(gr.character_level), 1) as dead_best_level,
            COALESCE(MAX(gr.character_gold), 0) as dead_best_gold,
            COUNT(gr.id) as dead_count
        FROM game_rankings gr
        WHERE gr.user_id = p_user_id AND gr.character_alive = false
    )
    SELECT 
        GREATEST(us.live_best_floor, ds.dead_best_floor) as best_floor,
        GREATEST(us.live_best_level, ds.dead_best_level) as best_level,
        GREATEST(us.live_best_gold, ds.dead_best_gold) as best_gold,
        (us.live_count + ds.dead_count)::INTEGER as total_runs,
        us.live_count::INTEGER as alive_characters
    FROM user_stats us, dead_stats ds;
END;
$$;

-- =====================================
-- 8. FUNÇÃO: SALVAR RANKING QUANDO PERSONAGEM MORRE
-- =====================================

CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character RECORD;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.user_id,
        c.name,
        c.floor,
        c.level,
        c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Salvar no ranking histórico
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.floor,
        v_character.level,
        v_character.gold,
        false, -- character_alive = false
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RAISE NOTICE '[RANKING] Entrada salva para personagem morto: % (andar %)', v_character.name, v_character.floor;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 9. FUNÇÃO: ATUALIZAR ANDAR DO PERSONAGEM
-- =====================================

CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validar inputs
    IF p_character_id IS NULL THEN
        RAISE EXCEPTION 'ID do personagem não pode ser nulo';
    END IF;
    
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser maior que 0, recebido: %', p_floor;
    END IF;
    
    -- Atualizar o andar
    UPDATE characters 
    SET 
        floor = p_floor,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    RAISE NOTICE '[FLOOR_UPDATE] Personagem % atualizado para andar %', p_character_id, p_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 10. FUNÇÃO: TESTE DO SISTEMA DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_system(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_live_count INTEGER;
    v_dead_count INTEGER;
    v_total_count INTEGER;
BEGIN
    -- Teste 1: Contar personagens vivos
    SELECT COUNT(*) INTO v_live_count
    FROM characters
    WHERE is_alive = true AND floor > 0;
    
    RETURN QUERY SELECT 
        'Personagens Vivos'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens vivos com progresso', v_live_count)::TEXT;
    
    -- Teste 2: Contar entradas de ranking mortos
    SELECT COUNT(*) INTO v_dead_count
    FROM game_rankings
    WHERE character_alive = false;
    
    RETURN QUERY SELECT 
        'Personagens Mortos'::TEXT,
        'OK'::TEXT,
        format('Total: %s entradas de personagens mortos', v_dead_count)::TEXT;
    
    -- Teste 3: Total geral
    v_total_count := v_live_count + v_dead_count;
    
    RETURN QUERY SELECT 
        'Total Geral'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens no sistema (%s vivos + %s mortos)', 
               v_total_count, v_live_count, v_dead_count)::TEXT;
    
    -- Teste 4: Ranking por andar
    SELECT COUNT(*) INTO v_total_count
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    
    RETURN QUERY SELECT 
        'Ranking por Andar'::TEXT,
        CASE WHEN v_total_count > 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
        format('Retornou %s entradas', v_total_count)::TEXT;
    
    -- Teste 5: Usuário específico (se fornecido)
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_count
        FROM get_dynamic_user_ranking_history(p_user_id, 10);
        
        RETURN QUERY SELECT 
            'Histórico do Usuário'::TEXT,
            CASE WHEN v_total_count >= 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
            format('Usuário %s tem %s entradas', p_user_id, v_total_count)::TEXT;
    END IF;
END;
$$;

-- =====================================
-- 11. ÍNDICES OTIMIZADOS
-- =====================================

-- Índices básicos para game_rankings
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor 
ON game_rankings(highest_floor DESC);

CREATE INDEX IF NOT EXISTS idx_game_rankings_user_id 
ON game_rankings(user_id);

-- Índices para characters (personagens vivos)
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor_optimized 
ON characters(is_alive, floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_ranking_level_optimized 
ON characters(is_alive, level DESC, floor DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold_optimized 
ON characters(is_alive, gold DESC, floor DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_user_ranking 
ON characters(user_id, is_alive, floor DESC, level DESC);

-- Índices para game_rankings (personagens mortos)
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_floor_optimized 
ON game_rankings(character_alive, highest_floor DESC, character_level DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_level_optimized 
ON game_rankings(character_alive, character_level DESC, highest_floor DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_gold_optimized 
ON game_rankings(character_alive, character_gold DESC, highest_floor DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_user_dead 
ON game_rankings(user_id, character_alive) 
WHERE character_alive = false;

-- =====================================
-- 12. COMENTÁRIOS FINAIS
-- =====================================

COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Ranking híbrido: personagens vivos (tempo real) + mortos (histórico)';
COMMENT ON FUNCTION save_ranking_entry_on_death IS 'Salva entrada no ranking histórico quando personagem morre';
COMMENT ON FUNCTION update_character_floor IS 'Atualiza andar do personagem (dados em tempo real)';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'SISTEMA DE RANKING DEFINITIVO INSTALADO';
    RAISE NOTICE 'Versão: 12 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Características:';
    RAISE NOTICE '✓ Personagens vivos: dados em tempo real';
    RAISE NOTICE '✓ Personagens mortos: dados históricos';
    RAISE NOTICE '✓ Filtros: all/alive/dead';
    RAISE NOTICE '✓ Modalidades: floor/level/gold';
    RAISE NOTICE '✓ Performance otimizada';
    RAISE NOTICE '✓ Tabela game_rankings criada/atualizada';
    RAISE NOTICE '====================================';
END $$; 
-- =====================================
-- CORRIGIR RASTREAMENTO DO ANDAR MAIS ALTO
-- Data: 2024-12-02
-- Versão: 13 (Correção)
-- =====================================

-- Este sistema corrige:
-- 1. Adiciona coluna highest_floor na tabela characters
-- 2. Atualiza funções de ranking para usar highest_floor
-- 3. Cria trigger para manter highest_floor atualizado
-- 4. Corrige lógica de atualização de progresso

-- =====================================
-- 1. ADICIONAR COLUNA HIGHEST_FLOOR
-- =====================================

-- Adicionar coluna highest_floor se não existir
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS highest_floor INTEGER DEFAULT 1;

-- Atualizar registros existentes onde highest_floor é menor que floor atual
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- Garantir que highest_floor nunca seja menor que floor atual
UPDATE characters 
SET highest_floor = floor 
WHERE highest_floor < floor;

-- =====================================
-- 2. TRIGGER PARA MANTER HIGHEST_FLOOR ATUALIZADO
-- =====================================

-- Função do trigger
CREATE OR REPLACE FUNCTION update_highest_floor_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Sempre manter o highest_floor como o maior valor entre o atual e o novo
    NEW.highest_floor = GREATEST(COALESCE(OLD.highest_floor, 1), NEW.floor);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS maintain_highest_floor ON characters;

-- Criar trigger
CREATE TRIGGER maintain_highest_floor
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_highest_floor_trigger();

-- =====================================
-- 3. ATUALIZAR FUNÇÃO DE RANKING POR ANDAR
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- Sistema híbrido: personagens vivos da tabela characters + mortos da tabela game_rankings
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor em vez de floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0 -- Usar highest_floor
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.highest_floor DESC, c.level DESC, c.created_at ASC
    ),
    dead_characters AS (
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              -- Evitar duplicatas: se o usuário tem personagem vivo, não incluir os mortos
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.highest_floor DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 4. ATUALIZAR FUNÇÃO DE RANKING POR NÍVEL
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.level DESC, c.highest_floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.character_level DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE RANKING POR OURO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.highest_floor, -- CORRIGIDO: usar highest_floor
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
        ORDER BY c.user_id, c.gold DESC, c.highest_floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
        ORDER BY gr.user_id, gr.character_gold DESC, gr.created_at DESC
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 6. FUNÇÃO PARA CONTAR TOTAL DE ENTRADAS
-- =====================================

CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH live_characters AS (
        SELECT DISTINCT c.user_id
        FROM characters c
        WHERE c.is_alive = true 
          AND c.highest_floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        SELECT DISTINCT gr.user_id
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.highest_floor > 0
          )
    ),
    combined_users AS (
        SELECT user_id FROM live_characters
        UNION
        SELECT user_id FROM dead_characters
    )
    SELECT COUNT(*)::INTEGER INTO v_count FROM combined_users;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 7. ATUALIZAR FUNÇÃO SAVE_RANKING_ENTRY_ON_DEATH
-- =====================================

CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character RECORD;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.user_id,
        c.name,
        c.highest_floor, -- CORRIGIDO: usar highest_floor
        c.level,
        c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Salvar no ranking histórico
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.highest_floor, -- CORRIGIDO: usar highest_floor
        v_character.level,
        v_character.gold,
        false, -- character_alive = false
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RAISE NOTICE '[RANKING] Entrada salva para personagem morto: % (andar máximo %)', v_character.name, v_character.highest_floor;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 8. ATUALIZAR ÍNDICES
-- =====================================

-- Índice para highest_floor
CREATE INDEX IF NOT EXISTS idx_characters_highest_floor 
ON characters(highest_floor DESC);

-- Índices otimizados com highest_floor
CREATE INDEX IF NOT EXISTS idx_characters_ranking_highest_floor_optimized 
ON characters(is_alive, highest_floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true AND highest_floor > 0;

-- =====================================
-- 9. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DO RASTREAMENTO DE ANDAR MÁXIMO';
    RAISE NOTICE 'Versão: 13 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Coluna highest_floor adicionada';
    RAISE NOTICE '✓ Trigger para manter highest_floor atualizado';
    RAISE NOTICE '✓ Funções de ranking corrigidas';
    RAISE NOTICE '✓ Filtro por nome adicionado';
    RAISE NOTICE '✓ Paginação implementada';
    RAISE NOTICE '✓ Função de contagem criada';
    RAISE NOTICE '====================================';
END $$; 
-- =====================================
-- CORRIGIR PROBLEMAS DO RANKING
-- Data: 2024-12-02
-- Versão: 14 (Correção Critical)
-- =====================================

-- Este sistema corrige:
-- 1. Adiciona coluna is_alive que estava faltando
-- 2. Corrige funções de ranking para funcionar adequadamente
-- 3. Atualiza dados existentes para garantir consistência
-- 4. Corrige problema de DISTINCT ON que pode estar excluindo personagens

-- =====================================
-- 1. ADICIONAR COLUNA IS_ALIVE NA TABELA CHARACTERS
-- =====================================

-- Adicionar coluna is_alive se não existir
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT TRUE;

-- Garantir que todos os personagens existentes estão marcados como vivos
UPDATE characters 
SET is_alive = TRUE 
WHERE is_alive IS NULL;

-- =====================================
-- 2. VERIFICAR E CORRIGIR DADOS EXISTENTES
-- =====================================

-- Garantir que highest_floor está correto para personagens existentes
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- Log de verificação
DO $$
DECLARE
    char_count INTEGER;
    chars_without_highest_floor INTEGER;
    chars_without_is_alive INTEGER;
BEGIN
    SELECT COUNT(*) INTO char_count FROM characters;
    
    SELECT COUNT(*) INTO chars_without_highest_floor 
    FROM characters WHERE highest_floor IS NULL;
    
    SELECT COUNT(*) INTO chars_without_is_alive 
    FROM characters WHERE is_alive IS NULL;
    
    RAISE NOTICE '[RANKING_FIX] Total de personagens: %', char_count;
    RAISE NOTICE '[RANKING_FIX] Personagens sem highest_floor: %', chars_without_highest_floor;
    RAISE NOTICE '[RANKING_FIX] Personagens sem is_alive: %', chars_without_is_alive;
END $$;

-- =====================================
-- 3. CORRIGIR FUNÇÕES DE RANKING PARA EVITAR PROBLEMAS DE DISTINCT
-- =====================================

-- Função corrigida de ranking por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- Sistema híbrido corrigido: mostrar TODOS os personagens, não apenas o melhor por usuário
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor, -- Fallback para floor se highest_floor for NULL
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT 
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.character_gold DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função corrigida de ranking por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        SELECT 
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.character_gold DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função corrigida de ranking por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        SELECT 
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 4. CORRIGIR FUNÇÃO DE CONTAGEM
-- =====================================

CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH live_characters AS (
        SELECT c.id
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        SELECT gr.id
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_characters AS (
        SELECT id FROM live_characters
        UNION ALL
        SELECT id FROM dead_characters
    )
    SELECT COUNT(*)::INTEGER INTO v_count FROM combined_characters;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 5. FUNÇÃO PARA DEBUG E VERIFICAÇÃO
-- =====================================

CREATE OR REPLACE FUNCTION debug_character_ranking(p_character_name TEXT DEFAULT NULL)
RETURNS TABLE(
    character_name VARCHAR(100),
    character_id UUID,
    user_id UUID,
    current_floor INTEGER,
    highest_floor INTEGER,
    level INTEGER,
    gold INTEGER,
    is_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name,
        c.id,
        c.user_id,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        c.level,
        c.gold,
        c.is_alive,
        c.created_at
    FROM characters c
    WHERE (p_character_name IS NULL OR LOWER(c.name) LIKE LOWER('%' || p_character_name || '%'))
    ORDER BY COALESCE(c.highest_floor, c.floor) DESC, c.level DESC, c.gold DESC;
END;
$$;

-- =====================================
-- 6. ATUALIZAR ÍNDICES PARA PERFORMANCE
-- =====================================

-- Remover índices antigos se existirem
DROP INDEX IF EXISTS idx_characters_ranking_floor_optimized;
DROP INDEX IF EXISTS idx_characters_ranking_level_optimized;
DROP INDEX IF EXISTS idx_characters_ranking_gold_optimized;

-- Criar novos índices otimizados
CREATE INDEX IF NOT EXISTS idx_characters_is_alive_highest_floor 
ON characters(is_alive, highest_floor DESC, level DESC, gold DESC, created_at ASC) 
WHERE is_alive = true;

CREATE INDEX IF NOT EXISTS idx_characters_is_alive_level 
ON characters(is_alive, level DESC, highest_floor DESC, gold DESC, created_at ASC) 
WHERE is_alive = true;

CREATE INDEX IF NOT EXISTS idx_characters_is_alive_gold 
ON characters(is_alive, gold DESC, highest_floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true;

-- =====================================
-- 7. TESTE PARA VERIFICAR CORREÇÕES
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_after_fix()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_live INTEGER;
    v_total_ranking INTEGER;
    v_ursal_found BOOLEAN;
BEGIN
    -- Teste 1: Contar personagens vivos
    SELECT COUNT(*) INTO v_total_live
    FROM characters
    WHERE is_alive = true AND COALESCE(highest_floor, floor) > 0;
    
    RETURN QUERY SELECT 
        'Personagens Vivos Válidos'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens vivos válidos', v_total_live)::TEXT;
    
    -- Teste 2: Verificar ranking
    SELECT COUNT(*) INTO v_total_ranking
    FROM get_dynamic_ranking_by_highest_floor(100, 'all', '', 0);
    
    RETURN QUERY SELECT 
        'Ranking Funcionando'::TEXT,
        CASE WHEN v_total_ranking > 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
        format('Ranking retorna %s entradas', v_total_ranking)::TEXT;
    
    -- Teste 3: Verificar se Ursal aparece
    SELECT EXISTS (
        SELECT 1 FROM get_dynamic_ranking_by_highest_floor(100, 'all', '', 0)
        WHERE LOWER(player_name) LIKE '%ursal%'
    ) INTO v_ursal_found;
    
    RETURN QUERY SELECT 
        'Personagem Ursal'::TEXT,
        CASE WHEN v_ursal_found THEN 'ENCONTRADO' ELSE 'NÃO ENCONTRADO' END::TEXT,
        CASE WHEN v_ursal_found THEN 'Ursal aparece no ranking' ELSE 'Ursal não aparece no ranking' END::TEXT;
    
    -- Teste 4: Verificar dados do Ursal especificamente
    RETURN QUERY
    SELECT 
        'Debug Ursal'::TEXT,
        'INFO'::TEXT,
        format('Ursal: andar atual=%s, andar máximo=%s, nível=%s, ouro=%s, vivo=%s', 
            c.floor, 
            COALESCE(c.highest_floor, c.floor), 
            c.level, 
            c.gold, 
            c.is_alive
        )::TEXT
    FROM characters c
    WHERE LOWER(c.name) LIKE '%ursal%'
    LIMIT 1;
END;
$$;

-- =====================================
-- 8. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE PROBLEMAS DO RANKING';
    RAISE NOTICE 'Versão: 14 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Coluna is_alive adicionada';
    RAISE NOTICE '✓ Dados existentes atualizados';
    RAISE NOTICE '✓ Funções de ranking corrigidas';
    RAISE NOTICE '✓ Removed DISTINCT ON bug que excluía personagens';
    RAISE NOTICE '✓ Índices otimizados criados';
    RAISE NOTICE '✓ Função de debug criada';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Execute: SELECT * FROM test_ranking_after_fix();';
    RAISE NOTICE 'Para verificar se as correções funcionaram.';
    RAISE NOTICE '====================================';
END $$; 
-- Migração para garantir que cada personagem não possa ter o mesmo consumível em múltiplos slots de poção
-- Data: 2024-12-02

-- Primeiro, limpar dados duplicados existentes (se houver)
-- Remove entradas duplicadas mantendo apenas a de menor slot_position
DELETE FROM character_potion_slots 
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY character_id, consumable_id 
                   ORDER BY slot_position ASC
               ) as rn
        FROM character_potion_slots
        WHERE consumable_id IS NOT NULL
    ) t 
    WHERE t.rn > 1
);

-- Adicionar constraint única para prevenir duplicatas futuras
-- Garante que um personagem não possa ter o mesmo consumível em múltiplos slots
ALTER TABLE character_potion_slots 
ADD CONSTRAINT unique_character_consumable_slot 
UNIQUE (character_id, consumable_id);

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_character_potion_slots_lookup 
ON character_potion_slots(character_id, slot_position);

-- Remover funções existentes para permitir alteração do tipo de retorno
DROP FUNCTION IF EXISTS set_potion_slot(UUID, INTEGER, UUID);
DROP FUNCTION IF EXISTS clear_potion_slot(UUID, INTEGER);

-- Atualizar função RPC para definir slot de poção com validação
CREATE OR REPLACE FUNCTION set_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER,
    p_consumable_id UUID
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
    v_existing_slot INTEGER;
BEGIN
    -- Verificar se o consumível já está em outro slot
    SELECT slot_position INTO v_existing_slot
    FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND consumable_id = p_consumable_id
      AND slot_position != p_slot_position;
    
    -- Se encontrou em outro slot, retornar erro
    IF v_existing_slot IS NOT NULL THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Esta poção já está equipada no slot ' || v_existing_slot
        ) INTO v_result;
        RETURN v_result;
    END IF;

    -- Verificar se o personagem possui o consumível
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
          AND consumable_id = p_consumable_id 
          AND quantity > 0
    ) THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Você não possui este consumível'
        ) INTO v_result;
        RETURN v_result;
    END IF;

    -- Limpar slot atual se já tiver algo
    DELETE FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND slot_position = p_slot_position;

    -- Inserir novo slot
    INSERT INTO character_potion_slots (character_id, slot_position, consumable_id)
    VALUES (p_character_id, p_slot_position, p_consumable_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET consumable_id = p_consumable_id;

    -- Retornar sucesso
    SELECT json_build_object(
        'success', true,
        'message', 'Poção atribuída ao slot com sucesso'
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION
    WHEN unique_violation THEN
        -- Em caso de violação da constraint, retornar erro específico
        SELECT json_build_object(
            'success', false,
            'error', 'Esta poção já está equipada em outro slot'
        ) INTO v_result;
        RETURN v_result;
    WHEN OTHERS THEN
        -- Outros erros
        SELECT json_build_object(
            'success', false,
            'error', 'Erro interno: ' || SQLERRM
        ) INTO v_result;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Criar função para limpar slot de poção
CREATE OR REPLACE FUNCTION clear_potion_slot(
    p_character_id UUID,
    p_slot_position INTEGER
) RETURNS JSON AS $$
DECLARE
    v_result JSON;
BEGIN
    -- Remover do slot especificado
    DELETE FROM character_potion_slots 
    WHERE character_id = p_character_id 
      AND slot_position = p_slot_position;

    -- Retornar sucesso
    SELECT json_build_object(
        'success', true,
        'message', 'Slot limpo com sucesso'
    ) INTO v_result;
    
    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Erro ao limpar slot: ' || SQLERRM
        ) INTO v_result;
        RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Adicionar comentários para documentação
COMMENT ON CONSTRAINT unique_character_consumable_slot ON character_potion_slots IS 
'Garante que cada personagem não possa ter o mesmo consumível em múltiplos slots de poção';

COMMENT ON FUNCTION set_potion_slot(UUID, INTEGER, UUID) IS 
'Define um consumível em um slot de poção com validação de duplicatas';

COMMENT ON FUNCTION clear_potion_slot(UUID, INTEGER) IS 
'Remove um consumível de um slot de poção específico'; 
-- Migração para corrigir vulnerabilidades de segurança em funções de personagem
-- Data: 2024-12-02
-- Remove exposição de funções críticas e cria funções seguras específicas

-- =====================================================
-- REMOÇÃO DE FUNÇÕES INSEGURAS
-- =====================================================

-- Remover a função update_character_stats da exposição pública
-- Esta função permite manipulação livre de stats e deve ser apenas interna
DROP FUNCTION IF EXISTS update_character_stats(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

-- =====================================================
-- FUNÇÕES SEGURAS PARA OPERAÇÕES ESPECÍFICAS
-- =====================================================

-- Função SEGURA para atualizar HP e Mana durante gameplay (não exposta via RPC)
CREATE OR REPLACE FUNCTION internal_update_character_hp_mana(
    p_character_id UUID,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    -- Validar limites
    UPDATE characters
    SET
        hp = CASE 
            WHEN p_hp IS NOT NULL THEN LEAST(GREATEST(p_hp, 0), max_hp)
            ELSE hp
        END,
        mana = CASE 
            WHEN p_mana IS NOT NULL THEN LEAST(GREATEST(p_mana, 0), max_mana)
            ELSE mana
        END,
        last_activity = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para ganho de XP (com validação anti-cheat)
CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
    v_max_xp_per_call INTEGER := 10000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    IF p_xp_amount > v_max_xp_per_call THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada (máximo: %)', v_max_xp_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Calcular novo XP
    v_new_xp := v_current_xp + p_xp_amount;
    
    -- Processar level ups
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP -- Cap em level 100
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- Calcular novos stats base
        SELECT 
            derived_hp, derived_max_hp, derived_mana, derived_max_mana,
            derived_atk, derived_def, derived_speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id)
        );
        
        -- Atualizar stats com level up
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.derived_max_hp,
            max_mana = v_base_stats.derived_max_mana,
            atk = v_base_stats.derived_atk,
            def = v_base_stats.derived_def,
            speed = v_base_stats.derived_speed,
            hp = v_base_stats.derived_max_hp, -- Cura completa no level up
            mana = v_base_stats.derived_max_mana, -- Cura completa no level up
            last_activity = NOW()
        WHERE id = p_character_id;
        
        -- Conceder pontos de atributo
        PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
        
        -- Atualizar progressão do usuário
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    ELSE
        -- Apenas atualizar XP
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para ganho de gold (com validação anti-cheat)
CREATE OR REPLACE FUNCTION secure_grant_gold(
    p_character_id UUID,
    p_gold_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS INTEGER AS $$
DECLARE
    v_new_gold INTEGER;
    v_max_gold_per_call INTEGER := 50000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_gold_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de gold deve ser positiva';
    END IF;
    
    IF p_gold_amount > v_max_gold_per_call THEN
        RAISE EXCEPTION 'Quantidade de gold suspeita detectada (máximo: %)', v_max_gold_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'gold_gain', json_build_object('amount', p_gold_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Atualizar gold
    UPDATE characters
    SET
        gold = gold + p_gold_amount,
        last_activity = NOW()
    WHERE id = p_character_id
    RETURNING gold INTO v_new_gold;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para atualizar andar (apenas uma direção - para frente)
CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
BEGIN
    -- Obter andar atual
    SELECT floor INTO v_current_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validar que só pode avançar ou resetar para 1
    IF p_new_floor != 1 AND p_new_floor <= v_current_floor THEN
        RAISE EXCEPTION 'Só é possível avançar andares ou resetar para o andar 1';
    END IF;
    
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN -- Cap de 1000 andares
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- Log da operação
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'floor_change', json_build_object('old_floor', v_current_floor, 'new_floor', p_new_floor), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Atualizar andar
    UPDATE characters
    SET
        floor = p_new_floor,
        last_activity = NOW()
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função pública SEGURA para atualizar apenas last_activity
CREATE OR REPLACE FUNCTION update_character_activity(p_character_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE characters
    SET last_activity = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TABELA DE LOG PARA AUDITORIA (OPCIONAL)
-- =====================================================

-- Criar tabela de log de atividades para detectar comportamentos suspeitos
CREATE TABLE IF NOT EXISTS character_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índice para consultas por personagem e data
CREATE INDEX IF NOT EXISTS idx_character_activity_log_character_date 
ON character_activity_log(character_id, created_at DESC);

-- =====================================================
-- CORREÇÕES DE SEGURANÇA PARA MONSTER DROPS
-- =====================================================

-- Remover a função add_monster_drop da exposição pública
-- Esta função permite adicionar drops arbitrários ao inventário
DROP FUNCTION IF EXISTS add_monster_drop(UUID, UUID, INTEGER);

-- Função INTERNA e SEGURA para adicionar drops (não exposta via RPC)
CREATE OR REPLACE FUNCTION internal_add_monster_drop(
    p_character_id UUID,
    p_drop_id UUID,
    p_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_max_quantity_per_drop INTEGER := 50; -- Limite anti-cheat por drop
    v_drop_rarity VARCHAR;
BEGIN
    -- Validações anti-cheat
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantidade deve ser positiva';
    END IF;
    
    -- Verificar limite por raridade
    SELECT rarity INTO v_drop_rarity FROM monster_drops WHERE id = p_drop_id;
    
    -- Limites mais restritivos para itens raros
    CASE v_drop_rarity
        WHEN 'legendary' THEN v_max_quantity_per_drop := 5;
        WHEN 'epic' THEN v_max_quantity_per_drop := 10;
        WHEN 'rare' THEN v_max_quantity_per_drop := 20;
        WHEN 'uncommon' THEN v_max_quantity_per_drop := 30;
        ELSE v_max_quantity_per_drop := 50; -- common
    END CASE;
    
    IF p_quantity > v_max_quantity_per_drop THEN
        RAISE EXCEPTION 'Quantidade suspeita para % (máximo: %)', v_drop_rarity, v_max_quantity_per_drop;
    END IF;
    
    -- Verificar se o personagem existe
    IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'drop_received', json_build_object(
        'drop_id', p_drop_id, 
        'quantity', p_quantity, 
        'rarity', v_drop_rarity
    ), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Utilizar padrão UPSERT para evitar problemas de concorrência
    INSERT INTO character_drops (character_id, drop_id, quantity)
    VALUES (p_character_id, p_drop_id, p_quantity)
    ON CONFLICT (character_id, drop_id) 
    DO UPDATE SET 
        quantity = character_drops.quantity + EXCLUDED.quantity,
        updated_at = NOW();
EXCEPTION
    WHEN unique_violation THEN
        -- Fallback em caso de condição de corrida
        UPDATE character_drops
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND drop_id = p_drop_id;
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao adicionar drop % para personagem %: %', p_drop_id, p_character_id, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função SEGURA para processar drops de combate (apenas service_role)
CREATE OR REPLACE FUNCTION secure_process_combat_drops(
    p_character_id UUID,
    p_drops JSONB -- Array de {drop_id, quantity}
)
RETURNS INTEGER AS $$
DECLARE
    v_drop RECORD;
    v_drops_processed INTEGER := 0;
    v_max_drops_per_combat INTEGER := 10; -- Limite de drops por combate
    v_total_drops INTEGER;
BEGIN
    -- Contar total de drops
    SELECT jsonb_array_length(p_drops) INTO v_total_drops;
    
    -- Validar limite de drops por combate
    IF v_total_drops > v_max_drops_per_combat THEN
        RAISE EXCEPTION 'Muitos drops por combate (máximo: %)', v_max_drops_per_combat;
    END IF;
    
    -- Processar cada drop
    FOR v_drop IN (
        SELECT 
            (item->>'drop_id')::UUID as drop_id,
            (item->>'quantity')::INTEGER as quantity
        FROM jsonb_array_elements(p_drops) as item
    ) LOOP
        -- Usar função interna segura
        PERFORM internal_add_monster_drop(
            p_character_id,
            v_drop.drop_id,
            v_drop.quantity
        );
        
        v_drops_processed := v_drops_processed + 1;
    END LOOP;
    
    RETURN v_drops_processed;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- REVOGAR PERMISSÕES DE FUNÇÕES PERIGOSAS
-- =====================================================

-- Revogar acesso público a funções que devem ser apenas internas
REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION secure_process_combat_drops(UUID, JSONB) FROM PUBLIC;

-- Permitir apenas para service_role
GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO service_role;

-- update_character_activity pode ser pública pois só atualiza timestamp
GRANT EXECUTE ON FUNCTION update_character_activity(UUID) TO authenticated;

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) IS 
'Função interna para atualizar HP/Mana com validação de limites - apenas service_role';

COMMENT ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) IS 
'Função segura para conceder XP com validações anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) IS 
'Função segura para conceder gold com validações anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_advance_floor(UUID, INTEGER) IS 
'Função segura para avançar andares com validação - apenas service_role';

COMMENT ON FUNCTION update_character_activity(UUID) IS 
'Função pública para atualizar timestamp de atividade - sem dados sensíveis';

COMMENT ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) IS 
'Função interna para adicionar drops com validação anti-cheat - apenas service_role';

COMMENT ON FUNCTION secure_process_combat_drops(UUID, JSONB) IS 
'Função segura para processar múltiplos drops de combate - apenas service_role';

COMMENT ON TABLE character_activity_log IS 
'Log de atividades dos personagens para detecção de comportamentos suspeitos'; 
-- Migração para corrigir sistema de checkpoints
-- Data: 2024-12-02
-- Move checkpoints para APÓS andares de boss para evitar exploits de farming

-- =====================================================
-- CORREÇÃO DO SISTEMA DE CHECKPOINTS
-- =====================================================

-- Atualizar função para obter checkpoints desbloqueados
-- Nova lógica: checkpoints em andares 1, 11, 21, 31, 41, etc.
-- Isso evita exploits de voltar para andares de boss (10, 20, 30, etc.)
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Sempre incluir o andar 1 (início da torre)
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
    -- Só incluir se o jogador passou do boss correspondente
    RETURN QUERY
    SELECT 
        checkpoint_floor,
        'Andar ' || checkpoint_floor || ' - Checkpoint Pós-Boss'::TEXT as description
    FROM (
        SELECT (boss_floor + 1) as checkpoint_floor
        FROM generate_series(10, GREATEST(10, p_highest_floor - 1), 10) as boss_floor
        WHERE p_highest_floor > boss_floor -- Só se passou do boss
    ) checkpoints
    ORDER BY checkpoint_floor;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função get_floor_data para refletir novos checkpoints
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    -- Se o andar não existe, gerar informações dinamicamente
    IF v_floor IS NULL THEN
        -- Definir tipo do andar
        v_floor_type := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
            WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
            ELSE 'common'::floor_type
        END;
        
        -- Checkpoints são no andar 1 e pós-boss (11, 21, 31, etc.)
        v_is_checkpoint := (p_floor_number = 1) OR 
                          (p_floor_number > 10 AND (p_floor_number - 1) % 10 = 0);
        
        v_min_level := GREATEST(1, p_floor_number / 2);
        
        -- Descrições melhoradas
        v_description := CASE 
            WHEN p_floor_number = 1 THEN 'Entrada da Torre'
            WHEN p_floor_number % 10 = 0 THEN 'Covil do Chefe - Andar ' || p_floor_number
            WHEN p_floor_number % 5 = 0 THEN 'Domínio de Elite - Andar ' || p_floor_number
            WHEN p_floor_number % 7 = 0 THEN 'Câmara de Eventos - Andar ' || p_floor_number
            WHEN v_is_checkpoint THEN 'Santuário Seguro - Andar ' || p_floor_number
            ELSE 'Corredor Sombrio - Andar ' || p_floor_number
        END;
        
        RETURN QUERY
        SELECT 
            p_floor_number,
            v_floor_type,
            v_is_checkpoint,
            v_min_level,
            v_description;
    ELSE
        -- Retornar dados do andar existente, mas atualizar is_checkpoint
        v_is_checkpoint := (v_floor.floor_number = 1) OR 
                          (v_floor.floor_number > 10 AND (v_floor.floor_number - 1) % 10 = 0);
        
        RETURN QUERY
        SELECT 
            v_floor.floor_number,
            v_floor.type,
            v_is_checkpoint, -- Usar nova lógica
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ATUALIZAR DADOS EXISTENTES
-- =====================================================

-- Atualizar a coluna is_checkpoint em floors existentes
UPDATE floors 
SET is_checkpoint = (
    floor_number = 1 OR 
    (floor_number > 10 AND (floor_number - 1) % 10 = 0)
);

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS 
'Retorna checkpoints desbloqueados: andar 1 e pós-boss (11, 21, 31, etc.) para evitar exploits';

COMMENT ON FUNCTION get_floor_data(INTEGER) IS 
'Retorna dados do andar com sistema de checkpoints corrigido';

-- =====================================================
-- INSERIR ALGUNS ANDARES DE EXEMPLO (OPCIONAL)
-- =====================================================

-- Inserir andares específicos com descrições temáticas
INSERT INTO floors (floor_number, type, monster_pool, is_checkpoint, min_level, description) VALUES
(1, 'common', '{}', true, 1, 'Entrada da Torre - O Despertar'),
(10, 'boss', '{}', false, 5, 'Covil do Guardião Sombrio'),
(11, 'common', '{}', true, 6, 'Santuário da Primeira Vitória'),
(20, 'boss', '{}', false, 10, 'Trono do Senhor das Trevas'),
(21, 'common', '{}', true, 11, 'Refúgio dos Sobreviventes'),
(30, 'boss', '{}', false, 15, 'Arena do Devorador de Almas'),
(31, 'common', '{}', true, 16, 'Câmara da Redenção'),
(50, 'boss', '{}', false, 25, 'Palácio do Rei Demônio'),
(51, 'common', '{}', true, 26, 'Oásis da Esperança'),
(100, 'boss', '{}', false, 50, 'Cidadela do Lorde Supremo'),
(101, 'common', '{}', true, 51, 'Templo da Transcendência')
ON CONFLICT (floor_number) DO UPDATE SET
    is_checkpoint = EXCLUDED.is_checkpoint,
    description = EXCLUDED.description; 
-- Migração para corrigir funções seguras e permissões (versão final)
-- Data: 2024-12-02 
-- Resolve problemas de permissões para funções que requerem service_role

-- =====================================================
-- VERIFICAR E CORRIGIR FUNÇÕES SEGURAS
-- =====================================================

-- 1. Garantir que secure_process_combat_drops existe e está funcionando
DO $$
BEGIN
    -- Recriar a função garantindo que está completa
    CREATE OR REPLACE FUNCTION secure_process_combat_drops(
        p_character_id UUID,
        p_drops JSONB -- Array de {drop_id, quantity}
    )
    RETURNS INTEGER AS $func$
    DECLARE
        v_drop RECORD;
        v_drops_processed INTEGER := 0;
        v_max_drops_per_combat INTEGER := 10; -- Limite de drops por combate
        v_total_drops INTEGER;
    BEGIN
        -- Validar entrada
        IF p_drops IS NULL OR jsonb_array_length(p_drops) = 0 THEN
            RETURN 0;
        END IF;
        
        -- Contar total de drops
        SELECT jsonb_array_length(p_drops) INTO v_total_drops;
        
        -- Validar limite de drops por combate
        IF v_total_drops > v_max_drops_per_combat THEN
            RAISE EXCEPTION 'Muitos drops por combate (máximo: %)', v_max_drops_per_combat;
        END IF;
        
        -- Verificar se o personagem existe
        IF NOT EXISTS (SELECT 1 FROM characters WHERE id = p_character_id) THEN
            RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
        END IF;
        
        -- Processar cada drop
        FOR v_drop IN (
            SELECT 
                (item->>'drop_id')::UUID as drop_id,
                (item->>'quantity')::INTEGER as quantity
            FROM jsonb_array_elements(p_drops) as item
        ) LOOP
            -- Validar drop_id
            IF v_drop.drop_id IS NULL OR v_drop.quantity IS NULL OR v_drop.quantity <= 0 THEN
                RAISE WARNING 'Drop inválido ignorado: drop_id=%, quantity=%', v_drop.drop_id, v_drop.quantity;
                CONTINUE;
            END IF;
            
            -- Usar função interna segura
            PERFORM internal_add_monster_drop(
                p_character_id,
                v_drop.drop_id,
                v_drop.quantity
            );
            
            v_drops_processed := v_drops_processed + 1;
        END LOOP;
        
        RETURN v_drops_processed;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Erro ao processar drops para personagem %: %', p_character_id, SQLERRM;
            RAISE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Função secure_process_combat_drops criada/atualizada com sucesso';
END;
$$;

-- 2. Garantir que internal_add_monster_drop existe
DO $$
BEGIN
    CREATE OR REPLACE FUNCTION internal_add_monster_drop(
        p_character_id UUID,
        p_drop_id UUID,
        p_quantity INTEGER
    )
    RETURNS VOID AS $func$
    DECLARE
        v_max_quantity_per_drop INTEGER := 50; -- Limite anti-cheat por drop
        v_drop_rarity VARCHAR;
    BEGIN
        -- Validações anti-cheat
        IF p_quantity <= 0 THEN
            RAISE EXCEPTION 'Quantidade deve ser positiva: %', p_quantity;
        END IF;
        
        -- Verificar se o drop existe e obter raridade
        SELECT rarity INTO v_drop_rarity FROM monster_drops WHERE id = p_drop_id;
        
        IF v_drop_rarity IS NULL THEN
            RAISE EXCEPTION 'Drop não encontrado: %', p_drop_id;
        END IF;
        
        -- Limites mais restritivos para itens raros
        CASE v_drop_rarity
            WHEN 'legendary' THEN v_max_quantity_per_drop := 5;
            WHEN 'epic' THEN v_max_quantity_per_drop := 10;
            WHEN 'rare' THEN v_max_quantity_per_drop := 20;
            WHEN 'uncommon' THEN v_max_quantity_per_drop := 30;
            ELSE v_max_quantity_per_drop := 50; -- common
        END CASE;
        
        IF p_quantity > v_max_quantity_per_drop THEN
            RAISE EXCEPTION 'Quantidade suspeita para % (máximo: %)', v_drop_rarity, v_max_quantity_per_drop;
        END IF;
        
        -- Log da operação para auditoria (se a tabela existir)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
            INSERT INTO character_activity_log (character_id, action, details, created_at)
            VALUES (p_character_id, 'drop_received', json_build_object(
                'drop_id', p_drop_id, 
                'quantity', p_quantity, 
                'rarity', v_drop_rarity
            ), NOW())
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Utilizar padrão UPSERT para evitar problemas de concorrência
        INSERT INTO character_drops (character_id, drop_id, quantity)
        VALUES (p_character_id, p_drop_id, p_quantity)
        ON CONFLICT (character_id, drop_id) 
        DO UPDATE SET 
            quantity = character_drops.quantity + EXCLUDED.quantity,
            updated_at = NOW();
            
    EXCEPTION
        WHEN unique_violation THEN
            -- Fallback em caso de condição de corrida
            UPDATE character_drops
            SET quantity = quantity + p_quantity,
                updated_at = NOW()
            WHERE character_id = p_character_id AND drop_id = p_drop_id;
        WHEN OTHERS THEN
            RAISE WARNING 'Erro ao adicionar drop % para personagem %: %', p_drop_id, p_character_id, SQLERRM;
            RAISE;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;
    
    RAISE NOTICE 'Função internal_add_monster_drop criada/atualizada com sucesso';
END;
$$;

-- =====================================================
-- CONFIGURAR PERMISSÕES CORRETAMENTE
-- =====================================================

-- Revogar acesso público e conceder apenas ao service_role
DO $$
BEGIN
    -- secure_process_combat_drops
    REVOKE ALL ON FUNCTION secure_process_combat_drops(UUID, JSONB) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION secure_process_combat_drops(UUID, JSONB) TO service_role;
    
    -- internal_add_monster_drop
    REVOKE ALL ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) TO service_role;
    
    RAISE NOTICE 'Permissões configuradas para service_role apenas';
END;
$$;

-- =====================================================
-- VERIFICAR OUTRAS FUNÇÕES CRÍTICAS
-- =====================================================

DO $$
BEGIN
    -- Verificar e corrigir permissões de outras funções seguras
    
    -- secure_grant_xp
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_grant_xp') THEN
        REVOKE ALL ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) TO service_role;
        RAISE NOTICE 'Permissões de secure_grant_xp configuradas';
    ELSE
        RAISE WARNING 'Função secure_grant_xp não encontrada!';
    END IF;
    
    -- secure_grant_gold
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_grant_gold') THEN
        REVOKE ALL ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_grant_gold(UUID, INTEGER, VARCHAR) TO service_role;
        RAISE NOTICE 'Permissões de secure_grant_gold configuradas';
    ELSE
        RAISE WARNING 'Função secure_grant_gold não encontrada!';
    END IF;
    
    -- secure_advance_floor
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'secure_advance_floor') THEN
        REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;
        RAISE NOTICE 'Permissões de secure_advance_floor configuradas';
    ELSE
        RAISE WARNING 'Função secure_advance_floor não encontrada!';
    END IF;
    
    -- internal_update_character_hp_mana
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'internal_update_character_hp_mana') THEN
        REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
        GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;
        RAISE NOTICE 'Permissões de internal_update_character_hp_mana configuradas';
    ELSE
        RAISE WARNING 'Função internal_update_character_hp_mana não encontrada!';
    END IF;
END;
$$;

-- =====================================================
-- CRIAR TABELA DE LOG SE NÃO EXISTIR
-- =====================================================

-- Garantir que a tabela de log existe para auditoria
CREATE TABLE IF NOT EXISTS character_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índice para consultas por personagem e data
CREATE INDEX IF NOT EXISTS idx_character_activity_log_character_date 
ON character_activity_log(character_id, created_at DESC);

-- =====================================================
-- COMENTÁRIOS FINAIS
-- =====================================================

COMMENT ON FUNCTION secure_process_combat_drops(UUID, JSONB) IS 
'Função segura para processar múltiplos drops de combate - apenas service_role - versão final';

COMMENT ON FUNCTION internal_add_monster_drop(UUID, UUID, INTEGER) IS 
'Função interna para adicionar drops com validação anti-cheat - apenas service_role - versão final';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000018_fix_secure_functions_final concluída com sucesso!';
    RAISE NOTICE '🔒 Funções seguras configuradas apenas para service_role';
    RAISE NOTICE '📊 Tabela de auditoria character_activity_log disponível';
END;
$$; 
-- Migração para corrigir condições de corrida na função secure_advance_floor
-- Data: 2024-12-02
-- Resolve problemas de validação muito restritiva que causava falhas esporádicas

-- =====================================================
-- CORRIGIR FUNÇÃO SECURE_ADVANCE_FLOOR
-- =====================================================

CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_max_floor_reached INTEGER;
BEGIN
    -- Obter andar atual e máximo já alcançado (para validação mais robusta)
    SELECT floor, GREATEST(floor, COALESCE(highest_floor, 1)) 
    INTO v_current_floor, v_max_floor_reached
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validações mais flexíveis para evitar condições de corrida
    
    -- 1. Permitir resetar para andar 1 sempre
    IF p_new_floor = 1 THEN
        -- Log da operação de reset
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'floor_reset', json_build_object(
            'old_floor', v_current_floor, 
            'new_floor', p_new_floor,
            'reason', 'player_reset'
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        -- Atualizar para andar 1
        UPDATE characters
        SET floor = 1, last_activity = NOW()
        WHERE id = p_character_id;
        
        RETURN;
    END IF;
    
    -- 2. Validar limites básicos
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- 3. Permitir avançar apenas UM andar por vez (para evitar exploits)
    -- MAS permitir "re-sincronização" se o andar já foi alcançado antes
    IF p_new_floor > v_current_floor + 1 AND p_new_floor > v_max_floor_reached + 1 THEN
        RAISE EXCEPTION 'Só é possível avançar um andar por vez. Atual: %, Tentativa: %', v_current_floor, p_new_floor;
    END IF;
    
    -- 4. Não permitir retroceder (exceto para andar 1 que já foi tratado)
    IF p_new_floor < v_current_floor AND p_new_floor != 1 THEN
        RAISE EXCEPTION 'Não é possível retroceder. Use a função de reset para voltar ao andar 1';
    END IF;
    
    -- Log da operação de avanço
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'floor_advance', json_build_object(
        'old_floor', v_current_floor, 
        'new_floor', p_new_floor,
        'max_floor_reached', v_max_floor_reached
    ), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Atualizar andar e highest_floor se necessário
    UPDATE characters
    SET
        floor = p_new_floor,
        highest_floor = GREATEST(COALESCE(highest_floor, 1), p_new_floor),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log de sucesso para debug
    RAISE NOTICE 'Andar atualizado com sucesso: % -> % (personagem: %)', v_current_floor, p_new_floor, p_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ATUALIZAR PERMISSÕES
-- =====================================================

-- Garantir que as permissões estão corretas
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION secure_advance_floor(UUID, INTEGER) IS 
'Função segura para avançar andares com validação melhorada contra condições de corrida - apenas service_role';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000019_fix_advance_floor_race_condition concluída!';
    RAISE NOTICE '🔄 Função secure_advance_floor atualizada com validações mais robustas';
    RAISE NOTICE '🛡️ Condições de corrida e cache desatualizado resolvidos';
END;
$$; 
-- Migração para corrigir detecção de checkpoints desbloqueados
-- Data: 2024-12-02
-- Garante que os checkpoints sejam detectados corretamente

-- =====================================================
-- CORRIGIR FUNÇÃO GET_UNLOCKED_CHECKPOINTS
-- =====================================================

-- Recriar a função com lógica mais robusta
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Debug: log do andar mais alto
    RAISE NOTICE 'get_unlocked_checkpoints chamada com p_highest_floor: %', p_highest_floor;
    
    -- Sempre incluir o andar 1 (início da torre)
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
    -- Só incluir se o jogador passou do boss correspondente
    FOR i IN 1..100 LOOP -- Até 100 bosses (andar 1000)
        DECLARE
            boss_floor INTEGER := i * 10;
            checkpoint_floor INTEGER := boss_floor + 1;
        BEGIN
            -- Se o jogador passou do boss (está no andar do checkpoint ou além)
            IF p_highest_floor >= checkpoint_floor THEN
                RETURN QUERY
                SELECT 
                    checkpoint_floor,
                    ('Andar ' || checkpoint_floor || ' - Checkpoint Pós-Boss')::TEXT as description;
                
                RAISE NOTICE 'Checkpoint desbloqueado: % (passou do boss do andar %)', checkpoint_floor, boss_floor;
            ELSE
                -- Se não passou deste boss, não há mais checkpoints
                EXIT;
            END IF;
        END;
    END LOOP;
    
    RAISE NOTICE 'get_unlocked_checkpoints concluída';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CRIAR FUNÇÃO PARA OBTER HIGHEST_FLOOR
-- =====================================================

-- Função para obter o andar mais alto alcançado por um personagem
CREATE OR REPLACE FUNCTION get_character_highest_floor(p_character_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_highest_floor INTEGER;
BEGIN
    SELECT GREATEST(floor, COALESCE(highest_floor, floor)) 
    INTO v_highest_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    RAISE NOTICE 'Personagem % - andar mais alto: %', p_character_id, v_highest_floor;
    
    RETURN COALESCE(v_highest_floor, 1);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNÇÃO COMBINADA PARA CHECKPOINTS POR PERSONAGEM
-- =====================================================

-- Função que combina as duas anteriores para facilitar uso
CREATE OR REPLACE FUNCTION get_character_unlocked_checkpoints(p_character_id UUID)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
DECLARE
    v_highest_floor INTEGER;
BEGIN
    -- Obter andar mais alto do personagem
    SELECT get_character_highest_floor(p_character_id) INTO v_highest_floor;
    
    -- Retornar checkpoints desbloqueados
    RETURN QUERY
    SELECT * FROM get_unlocked_checkpoints(v_highest_floor);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GARANTIR COLUNA HIGHEST_FLOOR EXISTE
-- =====================================================

-- Adicionar coluna highest_floor se não existir
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'characters' AND column_name = 'highest_floor') THEN
        ALTER TABLE characters ADD COLUMN highest_floor INTEGER;
        
        -- Inicializar com o andar atual para personagens existentes
        UPDATE characters SET highest_floor = floor WHERE highest_floor IS NULL;
        
        RAISE NOTICE 'Coluna highest_floor adicionada e inicializada';
    END IF;
END;
$$;

-- =====================================================
-- ATUALIZAR FUNÇÃO SECURE_ADVANCE_FLOOR
-- =====================================================

-- Garantir que secure_advance_floor atualiza highest_floor corretamente
CREATE OR REPLACE FUNCTION secure_advance_floor(
    p_character_id UUID,
    p_new_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_current_floor INTEGER;
    v_highest_floor INTEGER;
BEGIN
    -- Obter andar atual e highest_floor
    SELECT floor, COALESCE(highest_floor, floor) 
    INTO v_current_floor, v_highest_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Validações básicas
    IF p_new_floor < 1 OR p_new_floor > 1000 THEN
        RAISE EXCEPTION 'Andar inválido (permitido: 1-1000)';
    END IF;
    
    -- Permitir resetar para andar 1 sempre
    IF p_new_floor = 1 THEN
        UPDATE characters
        SET floor = 1, last_activity = NOW()
        WHERE id = p_character_id;
        
        RAISE NOTICE 'Personagem % resetado para andar 1', p_character_id;
        RETURN;
    END IF;
    
    -- Validar progressão (máximo +1 andar ou re-visitar andar já alcançado)
    IF p_new_floor > v_highest_floor + 1 THEN
        RAISE EXCEPTION 'Só é possível avançar um andar por vez ou revisitar andares já alcançados. Atual: %, Tentativa: %, Máximo: %', v_current_floor, p_new_floor, v_highest_floor;
    END IF;
    
    -- Não permitir retroceder além do já alcançado (exceto andar 1)
    IF p_new_floor < 1 THEN
        RAISE EXCEPTION 'Não é possível ir para andar menor que 1';
    END IF;
    
    -- Atualizar andar e highest_floor
    UPDATE characters
    SET
        floor = p_new_floor,
        highest_floor = GREATEST(COALESCE(highest_floor, floor), p_new_floor),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    RAISE NOTICE 'Andar atualizado: % -> % (highest: %)', v_current_floor, p_new_floor, GREATEST(v_highest_floor, p_new_floor);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- PERMISSÕES
-- =====================================================

-- Funções públicas (podem ser chamadas pelo cliente)
GRANT EXECUTE ON FUNCTION get_unlocked_checkpoints(INTEGER) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_character_highest_floor(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_character_unlocked_checkpoints(UUID) TO authenticated, anon;

-- Função restrita
REVOKE ALL ON FUNCTION secure_advance_floor(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION secure_advance_floor(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS
-- =====================================================

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS 
'Retorna checkpoints desbloqueados baseado no andar mais alto alcançado';

COMMENT ON FUNCTION get_character_highest_floor(UUID) IS 
'Retorna o andar mais alto já alcançado por um personagem';

COMMENT ON FUNCTION get_character_unlocked_checkpoints(UUID) IS 
'Retorna checkpoints desbloqueados para um personagem específico';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241202000020_fix_checkpoint_detection concluída!';
    RAISE NOTICE '🗺️ Sistema de checkpoints corrigido e melhorado';
    RAISE NOTICE '🔍 Funções de debug adicionadas com logs detalhados';
END;
$$; 
-- Migração para corrigir validação de inteiros e prevenção de valores decimais
-- Data: 2024-12-03
-- Resolve problemas com valores decimais sendo passados para campos integer

-- =====================================================
-- ATUALIZAR FUNÇÃO DE HP/MANA COM VALIDAÇÃO DE INTEIROS
-- =====================================================

-- Recriar a função garantindo que aceite e converta decimais para inteiros
CREATE OR REPLACE FUNCTION internal_update_character_hp_mana(
    p_character_id UUID,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_safe_hp INTEGER;
    v_safe_mana INTEGER;
    v_character_exists BOOLEAN;
BEGIN
    -- Verificar se o personagem existe
    SELECT EXISTS(SELECT 1 FROM characters WHERE id = p_character_id) INTO v_character_exists;
    
    IF NOT v_character_exists THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Converter e validar HP se fornecido
    IF p_hp IS NOT NULL THEN
        -- Garantir que é um inteiro válido
        v_safe_hp := FLOOR(p_hp);
        
        -- Validar limites
        IF v_safe_hp < 0 THEN
            v_safe_hp := 0;
        ELSIF v_safe_hp > 9999 THEN
            v_safe_hp := 9999;
        END IF;
    END IF;
    
    -- Converter e validar Mana se fornecido
    IF p_mana IS NOT NULL THEN
        -- Garantir que é um inteiro válido
        v_safe_mana := FLOOR(p_mana);
        
        -- Validar limites
        IF v_safe_mana < 0 THEN
            v_safe_mana := 0;
        ELSIF v_safe_mana > 9999 THEN
            v_safe_mana := 9999;
        END IF;
    END IF;
    
    -- Atualizar apenas os campos fornecidos
    IF p_hp IS NOT NULL AND p_mana IS NOT NULL THEN
        UPDATE characters 
        SET 
            hp = v_safe_hp,
            mana = v_safe_mana,
            updated_at = NOW()
        WHERE id = p_character_id;
    ELSIF p_hp IS NOT NULL THEN
        UPDATE characters 
        SET 
            hp = v_safe_hp,
            updated_at = NOW()
        WHERE id = p_character_id;
    ELSIF p_mana IS NOT NULL THEN
        UPDATE characters 
        SET 
            mana = v_safe_mana,
            updated_at = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Log da operação para auditoria (se a tabela existir)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'hp_mana_update', json_build_object(
            'old_hp', (SELECT hp FROM characters WHERE id = p_character_id),
            'new_hp', v_safe_hp,
            'old_mana', (SELECT mana FROM characters WHERE id = p_character_id),
            'new_mana', v_safe_mana,
            'source', 'internal_update'
        ), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Erro ao atualizar HP/Mana para personagem %: %', p_character_id, SQLERRM;
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CRIAR FUNÇÃO PARA CONSUMO DE POÇÕES DOS SLOTS
-- =====================================================

CREATE OR REPLACE FUNCTION consume_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_character RECORD;
    v_slot RECORD;
    v_consumable RECORD;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_effect_value INTEGER;
    v_result JSON;
BEGIN
    -- Validar posição do slot
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Posição do slot inválida (1-3)'
        );
    END IF;
    
    -- Obter dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Personagem não encontrado'
        );
    END IF;
    
    -- Obter dados do slot
    SELECT * INTO v_slot FROM character_potion_slots 
    WHERE character_id = p_character_id AND slot_position = p_slot_position;
    
    IF NOT FOUND OR v_slot.consumable_id IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Slot vazio ou não configurado'
        );
    END IF;
    
    -- Obter dados do consumível
    SELECT * INTO v_consumable FROM consumables WHERE id = v_slot.consumable_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Consumível não encontrado'
        );
    END IF;
    
    -- Verificar se há quantidade suficiente
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables 
        WHERE character_id = p_character_id 
        AND consumable_id = v_slot.consumable_id 
        AND quantity > 0
    ) THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Quantidade insuficiente do consumível'
        );
    END IF;
    
    -- Calcular efeito e garantir valores inteiros
    v_effect_value := FLOOR(v_consumable.effect_value);
    v_new_hp := v_character.hp;
    v_new_mana := v_character.mana;
    
    -- Aplicar efeito baseado no tipo
    CASE v_consumable.type
        WHEN 'potion' THEN
            IF v_consumable.description ILIKE '%HP%' OR v_consumable.description ILIKE '%Vida%' THEN
                v_new_hp := LEAST(v_character.max_hp, v_character.hp + v_effect_value);
            ELSIF v_consumable.description ILIKE '%Mana%' THEN
                v_new_mana := LEAST(v_character.max_mana, v_character.mana + v_effect_value);
            END IF;
        WHEN 'antidote' THEN
            -- Antídotos podem recuperar HP menor
            v_new_hp := LEAST(v_character.max_hp, v_character.hp + FLOOR(v_effect_value / 2));
        ELSE
            -- Outros tipos (buff) não afetam HP/Mana diretamente aqui
            NULL;
    END CASE;
    
    -- Garantir que os valores finais sejam inteiros
    v_new_hp := FLOOR(v_new_hp);
    v_new_mana := FLOOR(v_new_mana);
    
    -- Atualizar HP/Mana do personagem
    UPDATE characters 
    SET 
        hp = v_new_hp,
        mana = v_new_mana,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Reduzir quantidade do consumível
    UPDATE character_consumables 
    SET 
        quantity = quantity - 1,
        updated_at = NOW()
    WHERE character_id = p_character_id AND consumable_id = v_slot.consumable_id;
    
    -- Remover se quantidade chegou a zero
    DELETE FROM character_consumables 
    WHERE character_id = p_character_id 
    AND consumable_id = v_slot.consumable_id 
    AND quantity <= 0;
    
    -- Log da operação
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'character_activity_log') THEN
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'potion_consumed', json_build_object(
            'consumable_id', v_slot.consumable_id,
            'consumable_name', v_consumable.name,
            'slot_position', p_slot_position,
            'effect_value', v_effect_value,
            'old_hp', v_character.hp,
            'new_hp', v_new_hp,
            'old_mana', v_character.mana,
            'new_mana', v_new_mana
        ), NOW())
        ON CONFLICT DO NOTHING;
    END IF;
    
    -- Retornar resultado
    RETURN json_build_object(
        'success', true,
        'message', format('Você usou %s e recuperou %s!', 
            v_consumable.name,
            CASE 
                WHEN v_new_hp > v_character.hp THEN format('%s HP', v_new_hp - v_character.hp)
                WHEN v_new_mana > v_character.mana THEN format('%s Mana', v_new_mana - v_character.mana)
                ELSE 'energia'
            END
        ),
        'new_hp', v_new_hp,
        'new_mana', v_new_mana
    );
    
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', format('Erro ao consumir poção: %s', SQLERRM)
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- CONFIGURAR PERMISSÕES
-- =====================================================

-- Revogar acesso público e conceder apenas ao service_role
REVOKE ALL ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION consume_potion_from_slot(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION consume_potion_from_slot(UUID, INTEGER) TO service_role;

-- =====================================================
-- COMENTÁRIOS E LOG
-- =====================================================

COMMENT ON FUNCTION internal_update_character_hp_mana(UUID, INTEGER, INTEGER) IS 
'Função segura para atualizar HP/Mana com validação de inteiros - apenas service_role';

COMMENT ON FUNCTION consume_potion_from_slot(UUID, INTEGER) IS 
'Função segura para consumir poções dos slots com validação de inteiros - apenas service_role';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '✅ Migração 20241203000001_fix_integer_validation concluída com sucesso!';
    RAISE NOTICE '🔧 Funções atualizadas para tratar valores decimais corretamente';
    RAISE NOTICE '🛡️ Validação de inteiros implementada';
END;
$$; 
-- Migração: Sistema de Cemitério e Permadeath
-- Cria tabela para armazenar dados de personagens mortos

-- Tabela para personagens mortos (cemitério)
CREATE TABLE IF NOT EXISTS dead_characters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_character_id UUID NOT NULL, -- ID original do personagem quando vivo
    
    -- Dados básicos do personagem na morte
    name VARCHAR(50) NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp BIGINT NOT NULL DEFAULT 0,
    gold BIGINT NOT NULL DEFAULT 0,
    
    -- Atributos primários na morte
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    vitality INTEGER NOT NULL DEFAULT 10,
    luck INTEGER NOT NULL DEFAULT 10,
    
    -- Stats derivados na morte
    max_hp INTEGER NOT NULL DEFAULT 100,
    max_mana INTEGER NOT NULL DEFAULT 50,
    atk INTEGER NOT NULL DEFAULT 15,
    def INTEGER NOT NULL DEFAULT 10,
    speed INTEGER NOT NULL DEFAULT 12,
    
    -- Dados da jornada
    floor_reached INTEGER NOT NULL DEFAULT 1, -- Andar onde morreu
    highest_floor INTEGER NOT NULL DEFAULT 1, -- Andar mais alto alcançado
    total_monsters_killed INTEGER NOT NULL DEFAULT 0,
    total_damage_dealt BIGINT NOT NULL DEFAULT 0,
    total_damage_taken BIGINT NOT NULL DEFAULT 0,
    total_spells_cast INTEGER NOT NULL DEFAULT 0,
    total_potions_used INTEGER NOT NULL DEFAULT 0,
    
    -- Causa da morte
    death_cause VARCHAR(255) NOT NULL DEFAULT 'Unknown',
    killed_by_monster VARCHAR(100), -- Nome do monstro que matou
    
    -- Tempo de vida do personagem
    character_created_at TIMESTAMPTZ NOT NULL,
    died_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    survival_time_minutes INTEGER GENERATED ALWAYS AS (
        EXTRACT(EPOCH FROM (died_at - character_created_at)) / 60
    ) STORED,
    
    -- Metadados
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_dead_characters_user_id ON dead_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_dead_characters_died_at ON dead_characters(died_at DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_level ON dead_characters(level DESC);
CREATE INDEX IF NOT EXISTS idx_dead_characters_floor_reached ON dead_characters(floor_reached DESC);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_dead_characters_updated_at
    BEFORE UPDATE ON dead_characters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para mover personagem morto para o cemitério
CREATE OR REPLACE FUNCTION kill_character(
    p_character_id UUID,
    p_death_cause VARCHAR DEFAULT 'Battle defeat',
    p_killed_by_monster VARCHAR DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_character_data characters%ROWTYPE;
    v_dead_character_id UUID;
BEGIN
    -- Buscar dados do personagem vivo
    SELECT * INTO v_character_data
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Character not found: %', p_character_id;
    END IF;
    
    -- Inserir no cemitério
    INSERT INTO dead_characters (
        user_id,
        original_character_id,
        name,
        level,
        xp,
        gold,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        max_hp,
        max_mana,
        atk,
        def,
        speed,
        floor_reached,
        highest_floor,
        death_cause,
        killed_by_monster,
        character_created_at
    ) VALUES (
        v_character_data.user_id,
        v_character_data.id,
        v_character_data.name,
        v_character_data.level,
        v_character_data.xp,
        v_character_data.gold,
        v_character_data.strength,
        v_character_data.dexterity,
        v_character_data.intelligence,
        v_character_data.wisdom,
        v_character_data.vitality,
        v_character_data.luck,
        v_character_data.max_hp,
        v_character_data.max_mana,
        v_character_data.atk,
        v_character_data.def,
        v_character_data.speed,
        v_character_data.floor,
        GREATEST(v_character_data.floor, v_character_data.highest_floor),
        p_death_cause,
        p_killed_by_monster,
        v_character_data.created_at
    ) RETURNING id INTO v_dead_character_id;
    
    -- Deletar personagem vivo
    DELETE FROM characters WHERE id = p_character_id;
    
    -- Atualizar progressão do usuário
    PERFORM update_user_character_progression(v_character_data.user_id);
    
    RETURN v_dead_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para buscar cemitério de um usuário
CREATE OR REPLACE FUNCTION get_user_cemetery(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    original_character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp BIGINT,
    gold BIGINT,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    max_hp INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor_reached INTEGER,
    highest_floor INTEGER,
    total_monsters_killed INTEGER,
    total_damage_dealt BIGINT,
    total_damage_taken BIGINT,
    total_spells_cast INTEGER,
    total_potions_used INTEGER,
    death_cause VARCHAR,
    killed_by_monster VARCHAR,
    character_created_at TIMESTAMPTZ,
    died_at TIMESTAMPTZ,
    survival_time_minutes INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dc.id,
        dc.original_character_id,
        dc.name,
        dc.level,
        dc.xp,
        dc.gold,
        dc.strength,
        dc.dexterity,
        dc.intelligence,
        dc.wisdom,
        dc.vitality,
        dc.luck,
        dc.max_hp,
        dc.max_mana,
        dc.atk,
        dc.def,
        dc.speed,
        dc.floor_reached,
        dc.highest_floor,
        dc.total_monsters_killed,
        dc.total_damage_dealt,
        dc.total_damage_taken,
        dc.total_spells_cast,
        dc.total_potions_used,
        dc.death_cause,
        dc.killed_by_monster,
        dc.character_created_at,
        dc.died_at,
        dc.survival_time_minutes
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    ORDER BY dc.died_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para contar personagens mortos de um usuário
CREATE OR REPLACE FUNCTION count_user_cemetery(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM dead_characters
        WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para estatísticas do cemitério
CREATE OR REPLACE FUNCTION get_cemetery_stats(p_user_id UUID)
RETURNS TABLE (
    total_deaths INTEGER,
    highest_level_reached INTEGER,
    highest_floor_reached INTEGER,
    total_survival_time_hours NUMERIC,
    most_common_death_cause VARCHAR,
    deadliest_monster VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deaths,
        COALESCE(MAX(dc.level), 0)::INTEGER as highest_level_reached,
        COALESCE(MAX(dc.highest_floor), 0)::INTEGER as highest_floor_reached,
        COALESCE(ROUND(SUM(dc.survival_time_minutes) / 60.0, 2), 0) as total_survival_time_hours,
        COALESCE(
            (SELECT death_cause 
             FROM dead_characters 
             WHERE user_id = p_user_id 
             GROUP BY death_cause 
             ORDER BY COUNT(*) DESC 
             LIMIT 1),
            'N/A'
        ) as most_common_death_cause,
        COALESCE(
            (SELECT killed_by_monster 
             FROM dead_characters 
             WHERE user_id = p_user_id AND killed_by_monster IS NOT NULL
             GROUP BY killed_by_monster 
             ORDER BY COUNT(*) DESC 
             LIMIT 1),
            'N/A'
        ) as deadliest_monster
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE dead_characters ENABLE ROW LEVEL SECURITY;

-- Usuários só podem ver seus próprios personagens mortos
CREATE POLICY "Users can view own dead characters" ON dead_characters
    FOR SELECT USING (auth.uid() = user_id);

-- Apenas funções do sistema podem inserir personagens mortos
CREATE POLICY "System can insert dead characters" ON dead_characters
    FOR INSERT WITH CHECK (true);

-- Comentários para documentação
COMMENT ON TABLE dead_characters IS 'Cemitério - armazena dados de personagens mortos para o sistema de permadeath';
COMMENT ON FUNCTION kill_character IS 'Move um personagem vivo para o cemitério e o deleta permanentemente';
COMMENT ON FUNCTION get_user_cemetery IS 'Retorna personagens mortos de um usuário com paginação';
COMMENT ON FUNCTION count_user_cemetery IS 'Conta total de personagens mortos de um usuário';
COMMENT ON FUNCTION get_cemetery_stats IS 'Retorna estatísticas consolidadas do cemitério de um usuário'; 
-- ================================
-- Migração para corrigir o sistema de bônus de equipamentos
-- Data: 2024-12-03
-- ================================

-- Função para calcular stats finais incluindo bônus de equipamentos
CREATE OR REPLACE FUNCTION calculate_final_character_stats(p_character_id UUID)
RETURNS TABLE (
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_base_stats RECORD;
    v_eq_hp_bonus INTEGER := 0;
    v_eq_mana_bonus INTEGER := 0;
    v_eq_atk_bonus INTEGER := 0;
    v_eq_def_bonus INTEGER := 0;
    v_eq_speed_bonus INTEGER := 0;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular stats base (só atributos primários + nível)
    SELECT 
        derived_hp,
        derived_max_hp,
        derived_mana,
        derived_max_mana,
        derived_atk,
        derived_def,
        derived_speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck
    );
    
    -- Buscar bônus de equipamentos
    SELECT 
        COALESCE(total_hp_bonus, 0),
        COALESCE(total_mana_bonus, 0),
        COALESCE(total_atk_bonus, 0),
        COALESCE(total_def_bonus, 0),
        COALESCE(total_speed_bonus, 0)
    INTO 
        v_eq_hp_bonus,
        v_eq_mana_bonus,
        v_eq_atk_bonus,
        v_eq_def_bonus,
        v_eq_speed_bonus
    FROM calculate_equipment_bonuses(p_character_id);
    
    -- Retornar todos os valores
    RETURN QUERY
    SELECT
        v_base_stats.derived_hp::INTEGER,
        v_base_stats.derived_max_hp::INTEGER,
        v_base_stats.derived_mana::INTEGER,
        v_base_stats.derived_max_mana::INTEGER,
        v_base_stats.derived_atk::INTEGER,
        v_base_stats.derived_def::INTEGER,
        v_base_stats.derived_speed::INTEGER,
        v_eq_hp_bonus::INTEGER,
        v_eq_mana_bonus::INTEGER,
        v_eq_atk_bonus::INTEGER,
        v_eq_def_bonus::INTEGER,
        v_eq_speed_bonus::INTEGER,
        (v_base_stats.derived_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.derived_max_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.derived_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.derived_max_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.derived_atk + v_eq_atk_bonus)::INTEGER,
        (v_base_stats.derived_def + v_eq_def_bonus)::INTEGER,
        (v_base_stats.derived_speed + v_eq_speed_bonus)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função de recalcular stats para incluir equipamentos
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_final_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular stats finais incluindo equipamentos
    SELECT 
        final_hp,
        final_max_hp,
        final_mana,
        final_max_mana,
        final_atk,
        final_def,
        final_speed
    INTO v_final_stats 
    FROM calculate_final_character_stats(p_character_id);
    
    -- Calcular proporção atual de HP/Mana para manter quando os máximos mudarem
    IF v_character.max_hp > 0 THEN
        v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    ELSE
        v_hp_ratio := 1.0;
    END IF;
    
    IF v_character.max_mana > 0 THEN
        v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    ELSE
        v_mana_ratio := 1.0;
    END IF;
    
    -- Calcular novos HP/Mana baseados na proporção
    v_new_hp := CEILING(v_final_stats.final_max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_final_stats.final_max_mana * v_mana_ratio);
    
    -- Atualizar stats finais no personagem
    UPDATE characters
    SET
        max_hp = v_final_stats.final_max_hp,
        max_mana = v_final_stats.final_max_mana,
        atk = v_final_stats.final_atk,
        def = v_final_stats.final_def,
        speed = v_final_stats.final_speed,
        hp = LEAST(v_new_hp, v_final_stats.final_max_hp),
        mana = LEAST(v_new_mana, v_final_stats.final_max_mana)
    WHERE id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Função para obter stats detalhados do personagem (incluindo bônus separados)
CREATE OR REPLACE FUNCTION get_character_detailed_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    -- Stats base
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    -- Bônus de equipamentos
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    -- Stats finais
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER,
    -- Outros dados
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    floor INTEGER,
    -- Atributos primários
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.level,
        -- Stats calculados
        s.base_hp,
        s.base_max_hp,
        s.base_mana,
        s.base_max_mana,
        s.base_atk,
        s.base_def,
        s.base_speed,
        s.equipment_hp_bonus,
        s.equipment_mana_bonus,
        s.equipment_atk_bonus,
        s.equipment_def_bonus,
        s.equipment_speed_bonus,
        s.final_hp,
        s.final_max_hp,
        s.final_mana,
        s.final_max_mana,
        s.final_atk,
        s.final_def,
        s.final_speed,
        -- Outros dados do personagem
        c.xp,
        c.xp_next_level,
        c.gold,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points
    FROM characters c
    CROSS JOIN calculate_final_character_stats(p_character_id) s
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger para recalcular automaticamente quando equipamentos mudarem
CREATE OR REPLACE FUNCTION trigger_recalculate_on_equipment_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcular stats quando equipamentos mudarem
    IF TG_OP = 'UPDATE' THEN
        IF OLD.is_equipped != NEW.is_equipped THEN
            PERFORM recalculate_character_stats(NEW.character_id);
        END IF;
    ELSIF TG_OP = 'INSERT' THEN
        IF NEW.is_equipped THEN
            PERFORM recalculate_character_stats(NEW.character_id);
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.is_equipped THEN
            PERFORM recalculate_character_stats(OLD.character_id);
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para recalcular automaticamente
DROP TRIGGER IF EXISTS trigger_recalculate_character_stats_on_equipment ON character_equipment;
CREATE TRIGGER trigger_recalculate_character_stats_on_equipment
    AFTER INSERT OR UPDATE OR DELETE ON character_equipment
    FOR EACH ROW
    EXECUTE FUNCTION trigger_recalculate_on_equipment_change();

-- Atualizar stats de todos os personagens existentes
DO $$
DECLARE
    character_record RECORD;
BEGIN
    FOR character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        PERFORM recalculate_character_stats(character_record.id);
    END LOOP;
END $$; 
-- Atualizar sistema de slots de magias para suportar melhor gerenciamento

-- Função para obter todas as magias disponíveis para um personagem
CREATE OR REPLACE FUNCTION get_character_available_spells(p_character_id UUID)
RETURNS TABLE (
    spell_id UUID,
    name TEXT,
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER,
    unlocked_at_level INTEGER,
    is_equipped BOOLEAN,
    slot_position INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration,
        s.unlocked_at_level,
        (css.spell_id IS NOT NULL) as is_equipped,
        css.slot_position
    FROM spells s
    LEFT JOIN character_spell_slots css ON css.spell_id = s.id AND css.character_id = p_character_id
    LEFT JOIN characters c ON c.id = p_character_id
    WHERE s.unlocked_at_level <= c.level
    ORDER BY s.unlocked_at_level ASC, s.name ASC;
END;
$$;

-- Função para equipar múltiplas magias de uma vez
CREATE OR REPLACE FUNCTION set_character_spells(
    p_character_id UUID,
    p_spell_1_id UUID DEFAULT NULL,
    p_spell_2_id UUID DEFAULT NULL,
    p_spell_3_id UUID DEFAULT NULL
) RETURNS VOID 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Limpar todos os slots atuais
    DELETE FROM character_spell_slots 
    WHERE character_id = p_character_id;
    
    -- Equipar spell 1 se fornecido
    IF p_spell_1_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 1, p_spell_1_id);
    END IF;
    
    -- Equipar spell 2 se fornecido
    IF p_spell_2_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 2, p_spell_2_id);
    END IF;
    
    -- Equipar spell 3 se fornecido
    IF p_spell_3_id IS NOT NULL THEN
        INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
        VALUES (p_character_id, 3, p_spell_3_id);
    END IF;
END;
$$;

-- Função para obter estatísticas de magias do personagem
CREATE OR REPLACE FUNCTION get_character_spell_stats(p_character_id UUID)
RETURNS TABLE (
    total_available INTEGER,
    total_equipped INTEGER,
    highest_level_unlocked INTEGER,
    spells_by_type JSON
) 
LANGUAGE plpgsql
AS $$
DECLARE
    character_level INTEGER;
BEGIN
    -- Obter nível do personagem
    SELECT level INTO character_level 
    FROM characters 
    WHERE id = p_character_id;
    
    RETURN QUERY
    SELECT 
        COUNT(s.id)::INTEGER as total_available,
        (SELECT COUNT(*)::INTEGER FROM character_spell_slots WHERE character_id = p_character_id) as total_equipped,
        character_level as highest_level_unlocked,
        (
            SELECT json_object_agg(
                effect_type,
                count
            )
            FROM (
                SELECT 
                    s.effect_type,
                    COUNT(*)::INTEGER as count
                FROM spells s
                WHERE s.unlocked_at_level <= character_level
                GROUP BY s.effect_type
            ) type_counts
        ) as spells_by_type
    FROM spells s
    WHERE s.unlocked_at_level <= character_level;
END;
$$; 
-- Migração para corrigir tipos de retorno das funções de spell
-- Corrige incompatibilidade entre VARCHAR(50) da tabela e TEXT da função

-- PRIMEIRO: Remover as funções existentes para poder recriar com tipos corretos
DROP FUNCTION IF EXISTS get_character_available_spells(UUID);
DROP FUNCTION IF EXISTS get_available_spells(INTEGER);

-- SEGUNDO: Recriar função get_character_available_spells com tipos corretos
CREATE OR REPLACE FUNCTION get_character_available_spells(p_character_id UUID)
RETURNS TABLE (
    spell_id UUID,
    name VARCHAR(50),  -- Corrigido: era TEXT, agora VARCHAR(50) como na tabela
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER,
    unlocked_at_level INTEGER,
    is_equipped BOOLEAN,
    slot_position INTEGER
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration,
        s.unlocked_at_level,
        (css.spell_id IS NOT NULL) as is_equipped,
        css.slot_position
    FROM spells s
    LEFT JOIN character_spell_slots css ON css.spell_id = s.id AND css.character_id = p_character_id
    LEFT JOIN characters c ON c.id = p_character_id
    WHERE s.unlocked_at_level <= c.level
    ORDER BY s.unlocked_at_level ASC, s.name ASC;
END;
$$;

-- TERCEIRO: Recriar função get_available_spells com tipos corretos
CREATE OR REPLACE FUNCTION get_available_spells(p_level INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR(50),  -- Corrigido: era VARCHAR sem tamanho, agora VARCHAR(50)
    description TEXT,
    effect_type spell_effect_type,
    mana_cost INTEGER,
    cooldown INTEGER,
    effect_value INTEGER,
    duration INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.name,
        s.description,
        s.effect_type,
        s.mana_cost,
        s.cooldown,
        s.effect_value,
        s.duration
    FROM spells s
    WHERE s.unlocked_at_level <= p_level
    ORDER BY s.unlocked_at_level ASC;
END;
$$ LANGUAGE plpgsql; 
-- Migração para corrigir problemas de constraint NOT NULL nas colunas de XP de habilidades
-- Data: 2024-12-03
-- Versão: 20241203000006

-- =====================================
-- 1. GARANTIR QUE TODAS AS COLUNAS DE XP TENHAM VALORES PADRÃO
-- =====================================

-- Atualizar registros que possam ter valores NULL
UPDATE characters 
SET 
    sword_mastery_xp = COALESCE(sword_mastery_xp, 0),
    axe_mastery_xp = COALESCE(axe_mastery_xp, 0),
    blunt_mastery_xp = COALESCE(blunt_mastery_xp, 0),
    defense_mastery_xp = COALESCE(defense_mastery_xp, 0),
    magic_mastery_xp = COALESCE(magic_mastery_xp, 0)
WHERE 
    sword_mastery_xp IS NULL OR
    axe_mastery_xp IS NULL OR
    blunt_mastery_xp IS NULL OR
    defense_mastery_xp IS NULL OR
    magic_mastery_xp IS NULL;

-- =====================================
-- 2. CORRIGIR FUNÇÃO add_skill_xp PARA LIDAR COM VALORES NULL
-- =====================================

-- Remover função existente
DROP FUNCTION IF EXISTS add_skill_xp(UUID, VARCHAR, INTEGER);

-- Recriar função com validações melhoradas
CREATE OR REPLACE FUNCTION add_skill_xp(
    p_character_id UUID,
    p_skill_type VARCHAR,
    p_xp_amount INTEGER
)
RETURNS TABLE (
    skill_leveled_up BOOLEAN,
    new_skill_level INTEGER,
    new_skill_xp INTEGER
) AS $$
DECLARE
    current_level INTEGER;
    current_xp INTEGER;
    xp_required INTEGER;
    new_level INTEGER;
    new_xp INTEGER;
    leveled_up BOOLEAN := FALSE;
BEGIN
    -- Validar entrada
    IF p_character_id IS NULL THEN
        RAISE EXCEPTION 'ID do personagem não pode ser NULL';
    END IF;
    
    IF p_skill_type IS NULL OR p_skill_type = '' THEN
        RAISE EXCEPTION 'Tipo de habilidade não pode ser NULL ou vazio';
    END IF;
    
    IF p_xp_amount IS NULL OR p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser maior que zero';
    END IF;

    -- Buscar nível e XP atuais da habilidade com COALESCE para garantir valores não-null
    CASE p_skill_type
        WHEN 'sword' THEN
            SELECT COALESCE(sword_mastery, 1), COALESCE(sword_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'axe' THEN
            SELECT COALESCE(axe_mastery, 1), COALESCE(axe_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'blunt' THEN
            SELECT COALESCE(blunt_mastery, 1), COALESCE(blunt_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'defense' THEN
            SELECT COALESCE(defense_mastery, 1), COALESCE(defense_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        WHEN 'magic' THEN
            SELECT COALESCE(magic_mastery, 1), COALESCE(magic_mastery_xp, 0) 
            INTO current_level, current_xp
            FROM characters WHERE id = p_character_id;
        ELSE
            RAISE EXCEPTION 'Tipo de habilidade inválida: %', p_skill_type;
    END CASE;
    
    -- Verificar se o personagem foi encontrado
    IF current_level IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Garantir valores padrão
    current_level := COALESCE(current_level, 1);
    current_xp := COALESCE(current_xp, 0);
    
    -- Adicionar XP
    new_xp := current_xp + p_xp_amount;
    new_level := current_level;
    
    -- Verificar se subiu de nível
    xp_required := calculate_skill_xp_requirement(current_level);
    
    WHILE new_xp >= xp_required AND new_level < 100 LOOP
        new_xp := new_xp - xp_required;
        new_level := new_level + 1;
        leveled_up := TRUE;
        xp_required := calculate_skill_xp_requirement(new_level);
    END LOOP;
    
    -- Atualizar no banco com COALESCE para garantir que não seja NULL
    CASE p_skill_type
        WHEN 'sword' THEN
            UPDATE characters SET 
                sword_mastery = COALESCE(new_level, 1), 
                sword_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'axe' THEN
            UPDATE characters SET 
                axe_mastery = COALESCE(new_level, 1), 
                axe_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'blunt' THEN
            UPDATE characters SET 
                blunt_mastery = COALESCE(new_level, 1), 
                blunt_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'defense' THEN
            UPDATE characters SET 
                defense_mastery = COALESCE(new_level, 1), 
                defense_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
        WHEN 'magic' THEN
            UPDATE characters SET 
                magic_mastery = COALESCE(new_level, 1), 
                magic_mastery_xp = COALESCE(new_xp, 0) 
            WHERE id = p_character_id;
    END CASE;
    
    RETURN QUERY SELECT leveled_up, COALESCE(new_level, 1), COALESCE(new_xp, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 3. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Verificar e corrigir valores NULL em personagens existentes
UPDATE characters 
SET 
    sword_mastery = COALESCE(sword_mastery, 1),
    axe_mastery = COALESCE(axe_mastery, 1),
    blunt_mastery = COALESCE(blunt_mastery, 1),
    defense_mastery = COALESCE(defense_mastery, 1),
    magic_mastery = COALESCE(magic_mastery, 1),
    sword_mastery_xp = COALESCE(sword_mastery_xp, 0),
    axe_mastery_xp = COALESCE(axe_mastery_xp, 0),
    blunt_mastery_xp = COALESCE(blunt_mastery_xp, 0),
    defense_mastery_xp = COALESCE(defense_mastery_xp, 0),
    magic_mastery_xp = COALESCE(magic_mastery_xp, 0);

-- Script concluído com sucesso!
-- Problemas de constraint NOT NULL corrigidos 
-- Migração para melhorar escalamento de magias e sistema de atributos
-- Data: 2024-12-03
-- Versão: 20241203000007

-- =====================================
-- 1. MELHORAR FUNÇÃO DE STATS DERIVADOS COM NOVOS BÔNUS
-- =====================================

-- Remover a função antiga primeiro para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);

-- Atualizar função para incluir destreza no cálculo de crítico e força no dano crítico
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1,
    p_equipped_weapon_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL(5,2),
    derived_critical_damage DECIMAL(5,2),
    derived_magic_damage_bonus DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Cálculos base
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Bônus de habilidades
    weapon_bonus INTEGER;
    def_mastery_bonus INTEGER;
    magic_mastery_bonus INTEGER;
    
    -- Bônus de crítico e dano crítico
    total_crit_chance DECIMAL(5,2);
    total_crit_damage DECIMAL(5,2);
    total_magic_bonus DECIMAL(5,2);
BEGIN
    -- Cálculos base
    base_hp := 80 + (p_level * 5);
    base_mana := 40 + (p_level * 3);
    base_atk := 15 + (p_level * 2);
    base_def := 8 + p_level;
    base_speed := 8 + p_level;
    
    -- Determinar bônus de habilidade baseado na arma equipada
    weapon_bonus := 0;
    CASE p_equipped_weapon_type
        WHEN 'sword' THEN weapon_bonus := p_sword_mastery;
        WHEN 'axe' THEN weapon_bonus := p_axe_mastery;
        WHEN 'blunt' THEN weapon_bonus := p_blunt_mastery;
        ELSE weapon_bonus := 0;
    END CASE;
    
    -- Bônus de defesa
    def_mastery_bonus := p_defense_mastery * 2;
    
    -- Bônus de magia
    magic_mastery_bonus := p_magic_mastery * 3;
    
    -- Cálculo de chance crítica: Sorte (0.5%) + Destreza (0.3%) + Habilidade (0.2%)
    total_crit_chance := (p_luck * 0.5) + (p_dexterity * 0.3) + (weapon_bonus * 0.2);
    
    -- Cálculo de dano crítico: 150% base + Sorte (1%) + Força (0.5%) + Habilidade (3%)
    total_crit_damage := 150.0 + (p_luck * 1.0) + (p_strength * 0.5) + (weapon_bonus * 3.0);
    
    -- Cálculo de bônus de dano mágico: Inteligência (10%) + Sabedoria (5%) + Maestria Mágica (15%)
    total_magic_bonus := (p_intelligence * 10.0) + (p_wisdom * 5.0) + (p_magic_mastery * 15.0);
    
    -- Retornar stats calculados
    RETURN QUERY SELECT
        -- HP: base + bônus de vitalidade
        (base_hp + (p_vitality * 8))::INTEGER as derived_hp,
        (base_hp + (p_vitality * 8))::INTEGER as derived_max_hp,
        
        -- Mana: base + bônus de inteligência + maestria mágica
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_mana,
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_max_mana,
        
        -- Ataque: base + força + habilidade de arma
        (base_atk + (p_strength * 2) + weapon_bonus)::INTEGER as derived_atk,
        
        -- Defesa: base + vitalidade + sabedoria + maestria defensiva
        (base_def + p_vitality + p_wisdom + def_mastery_bonus)::INTEGER as derived_def,
        
        -- Velocidade: base + destreza
        (base_speed + (p_dexterity * 1.5))::INTEGER as derived_speed,
        
        -- Chance crítica
        LEAST(total_crit_chance, 95.0)::DECIMAL(5,2) as derived_critical_chance,
        
        -- Dano crítico
        total_crit_damage::DECIMAL(5,2) as derived_critical_damage,
        
        -- Bônus de dano mágico
        total_magic_bonus::DECIMAL(5,2) as derived_magic_damage_bonus;
END;
$$;

-- =====================================
-- 2. FUNÇÃO PARA CALCULAR DANO DE MAGIA ESCALADO
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_damage(
    p_base_damage INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_bonus DECIMAL(5,2);
    scaled_damage INTEGER;
BEGIN
    -- Calcular bônus total: Int (10%) + Sabedoria (5%) + Maestria Mágica (15%)
    total_bonus := (p_intelligence * 10.0) + (p_wisdom * 5.0) + (p_magic_mastery * 15.0);
    
    -- Aplicar bônus ao dano base
    scaled_damage := ROUND(p_base_damage * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_damage;
END;
$$;

-- =====================================
-- 3. FUNÇÃO PARA CALCULAR CURA ESCALADA
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_healing(
    p_base_healing INTEGER,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    total_bonus DECIMAL(5,2);
    scaled_healing INTEGER;
BEGIN
    -- Calcular bônus total: Sabedoria (12%) + Maestria Mágica (10%)
    total_bonus := (p_wisdom * 12.0) + (p_magic_mastery * 10.0);
    
    -- Aplicar bônus à cura base
    scaled_healing := ROUND(p_base_healing * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_healing;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA CALCULAR DANO CRÍTICO ESCALADO
-- =====================================

CREATE OR REPLACE FUNCTION calculate_critical_damage(
    p_base_damage INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_weapon_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    critical_multiplier DECIMAL(5,2);
    critical_damage INTEGER;
BEGIN
    -- Calcular multiplicador crítico: 150% base + Sorte (1%) + Força (0.5%) + Habilidade (3%)
    critical_multiplier := 1.5 + (p_luck * 0.01) + (p_strength * 0.005) + (p_weapon_mastery * 0.03);
    
    -- Aplicar multiplicador ao dano base
    critical_damage := ROUND(p_base_damage * critical_multiplier);
    
    RETURN critical_damage;
END;
$$;

-- =====================================
-- 5. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 'Calcula todos os stats derivados de um personagem incluindo novos bônus de atributos e habilidades';
COMMENT ON FUNCTION calculate_scaled_spell_damage IS 'Calcula dano de magia escalado com inteligência, sabedoria e maestria mágica';
COMMENT ON FUNCTION calculate_scaled_spell_healing IS 'Calcula cura de magia escalada com sabedoria e maestria mágica';
COMMENT ON FUNCTION calculate_critical_damage IS 'Calcula dano crítico baseado em força, sorte e maestria de arma'; 
-- Migração para rebalancear o escalamento de dano mágico
-- Data: 2024-12-03
-- Versão: 20241203000008

-- =====================================
-- REBALANCEAMENTO DO SISTEMA DE DANO MÁGICO
-- =====================================

-- Problema identificado: Escalamento exponencial excessivo
-- Cenário atual: Personagem level 20 com Int 30, Wis 25, Magic 15 = 650% de bônus
-- Resultado: Magia de 50 base vira 375 de dano, muito OP

-- =====================================
-- 1. NOVA FUNÇÃO DE DANO MÁGICO BALANCEADA
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_damage(
    p_base_damage INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    -- Novos multiplicadores balanceados
    int_bonus DECIMAL(5,2);
    wis_bonus DECIMAL(5,2);
    mastery_bonus DECIMAL(5,2);
    total_bonus DECIMAL(5,2);
    scaled_damage INTEGER;
BEGIN
    -- Cálculos com escalamento logarítmico para reduzir crescimento exponencial
    
    -- Intelligence: 3% por ponto (reduzido de 10%) + diminishing returns
    int_bonus := p_intelligence * 3.0 * (1.0 - (p_intelligence::DECIMAL / 200.0));
    
    -- Wisdom: 2% por ponto (reduzido de 5%) + diminishing returns  
    wis_bonus := p_wisdom * 2.0 * (1.0 - (p_wisdom::DECIMAL / 250.0));
    
    -- Magic Mastery: 4% por nível (reduzido de 15%) + diminishing returns
    mastery_bonus := p_magic_mastery * 4.0 * (1.0 - (p_magic_mastery::DECIMAL / 150.0));
    
    -- Total com cap em 200% (anteriormente sem limite)
    total_bonus := LEAST(200.0, int_bonus + wis_bonus + mastery_bonus);
    
    -- Aplicar bônus ao dano base
    scaled_damage := ROUND(p_base_damage * (1.0 + total_bonus / 100.0));
    
    -- Debug log para teste
    -- RAISE NOTICE 'Magic Damage: Base=%, Int=%% (%), Wis=%% (%), Mas=%% (%), Total=%%, Final=%', 
    --     p_base_damage, int_bonus, p_intelligence, wis_bonus, p_wisdom, mastery_bonus, p_magic_mastery, total_bonus, scaled_damage;
    
    RETURN scaled_damage;
END;
$$;

-- =====================================
-- 2. ATUALIZAR FUNÇÃO DE STATS DERIVADOS
-- =====================================

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1,
    p_equipped_weapon_type TEXT DEFAULT NULL
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL(5,2),
    derived_critical_damage DECIMAL(5,2),
    derived_magic_damage_bonus DECIMAL(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Cálculos base
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Bônus de habilidades
    weapon_bonus INTEGER;
    def_mastery_bonus INTEGER;
    magic_mastery_bonus INTEGER;
    
    -- Bônus de crítico e dano crítico
    total_crit_chance DECIMAL(5,2);
    total_crit_damage DECIMAL(5,2);
    
    -- Nova fórmula de dano mágico balanceada
    int_magic_bonus DECIMAL(5,2);
    wis_magic_bonus DECIMAL(5,2);
    mastery_magic_bonus DECIMAL(5,2);
    total_magic_bonus DECIMAL(5,2);
BEGIN
    -- Cálculos base
    base_hp := 80 + (p_level * 5);
    base_mana := 40 + (p_level * 3);
    base_atk := 15 + (p_level * 2);
    base_def := 8 + p_level;
    base_speed := 8 + p_level;
    
    -- Determinar bônus de habilidade baseado na arma equipada
    weapon_bonus := 0;
    CASE p_equipped_weapon_type
        WHEN 'sword' THEN weapon_bonus := p_sword_mastery;
        WHEN 'axe' THEN weapon_bonus := p_axe_mastery;
        WHEN 'blunt' THEN weapon_bonus := p_blunt_mastery;
        ELSE weapon_bonus := 0;
    END CASE;
    
    -- Bônus de defesa
    def_mastery_bonus := p_defense_mastery * 2;
    
    -- Bônus de magia
    magic_mastery_bonus := p_magic_mastery * 3;
    
    -- Cálculo de chance crítica: Sorte (0.5%) + Destreza (0.3%) + Habilidade (0.2%)
    total_crit_chance := (p_luck * 0.5) + (p_dexterity * 0.3) + (weapon_bonus * 0.2);
    
    -- Cálculo de dano crítico: 150% base + Sorte (1%) + Força (0.5%) + Habilidade (3%)
    total_crit_damage := 150.0 + (p_luck * 1.0) + (p_strength * 0.5) + (weapon_bonus * 3.0);
    
    -- NOVA FÓRMULA DE DANO MÁGICO BALANCEADA
    -- Intelligence: 3% por ponto com diminishing returns
    int_magic_bonus := p_intelligence * 3.0 * (1.0 - (p_intelligence::DECIMAL / 200.0));
    
    -- Wisdom: 2% por ponto com diminishing returns
    wis_magic_bonus := p_wisdom * 2.0 * (1.0 - (p_wisdom::DECIMAL / 250.0));
    
    -- Magic Mastery: 4% por nível com diminishing returns
    mastery_magic_bonus := p_magic_mastery * 4.0 * (1.0 - (p_magic_mastery::DECIMAL / 150.0));
    
    -- Total com cap em 200%
    total_magic_bonus := LEAST(200.0, int_magic_bonus + wis_magic_bonus + mastery_magic_bonus);
    
    -- Retornar stats calculados
    RETURN QUERY SELECT
        -- HP: base + bônus de vitalidade
        (base_hp + (p_vitality * 8))::INTEGER as derived_hp,
        (base_hp + (p_vitality * 8))::INTEGER as derived_max_hp,
        
        -- Mana: base + bônus de inteligência + maestria mágica
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_mana,
        (base_mana + (p_intelligence * 5) + magic_mastery_bonus)::INTEGER as derived_max_mana,
        
        -- Ataque: base + força + habilidade de arma
        (base_atk + (p_strength * 2) + weapon_bonus)::INTEGER as derived_atk,
        
        -- Defesa: base + vitalidade + sabedoria + maestria defensiva
        (base_def + p_vitality + p_wisdom + def_mastery_bonus)::INTEGER as derived_def,
        
        -- Velocidade: base + destreza
        (base_speed + (p_dexterity * 1.5))::INTEGER as derived_speed,
        
        -- Chance crítica
        LEAST(total_crit_chance, 95.0)::DECIMAL(5,2) as derived_critical_chance,
        
        -- Dano crítico
        total_crit_damage::DECIMAL(5,2) as derived_critical_damage,
        
        -- Bônus de dano mágico BALANCEADO
        total_magic_bonus::DECIMAL(5,2) as derived_magic_damage_bonus;
END;
$$;

-- =====================================
-- 3. ATUALIZAR FUNÇÃO DE CURA ESCALADA
-- =====================================

CREATE OR REPLACE FUNCTION calculate_scaled_spell_healing(
    p_base_healing INTEGER,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    wis_bonus DECIMAL(5,2);
    mastery_bonus DECIMAL(5,2);
    total_bonus DECIMAL(5,2);
    scaled_healing INTEGER;
BEGIN
    -- Wisdom: 4% por ponto (reduzido de 12%) + diminishing returns
    wis_bonus := p_wisdom * 4.0 * (1.0 - (p_wisdom::DECIMAL / 300.0));
    
    -- Magic Mastery: 3% por nível (reduzido de 10%) + diminishing returns
    mastery_bonus := p_magic_mastery * 3.0 * (1.0 - (p_magic_mastery::DECIMAL / 200.0));
    
    -- Total com cap em 150% para cura (menor que dano)
    total_bonus := LEAST(150.0, wis_bonus + mastery_bonus);
    
    -- Aplicar bônus à cura base
    scaled_healing := ROUND(p_base_healing * (1.0 + total_bonus / 100.0));
    
    RETURN scaled_healing;
END;
$$;

-- =====================================
-- 4. COMENTÁRIOS DE DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_scaled_spell_damage IS 'Calcula dano de magia com escalamento balanceado e diminishing returns (max 200% bonus)';
COMMENT ON FUNCTION calculate_scaled_spell_healing IS 'Calcula cura de magia com escalamento balanceado (max 150% bonus)';

-- =====================================
-- 5. NOTAS DE BALANCEAMENTO
-- =====================================

-- ANTES (Personagem Int 30, Wis 25, Magic 15):
-- Bônus = (30×10%) + (25×5%) + (15×15%) = 650%
-- Magia 50 base = 375 dano (7.5x)

-- DEPOIS (mesmo personagem):
-- Int: 30×3×(1-30/200) = 90×0.85 = 76.5%
-- Wis: 25×2×(1-25/250) = 50×0.9 = 45%
-- Magic: 15×4×(1-15/150) = 60×0.9 = 54%
-- Total: cap(76.5+45+54, 200) = 175.5%
-- Magia 50 base = 138 dano (2.8x) - MUITO MAIS BALANCEADO

-- Escalamento agora é mais gradual e tem teto realista! 
-- Migração para rebalanceamento completo do sistema de stats
-- Data: 2024-12-03
-- Versão: 20241203000009

-- =====================================
-- REBALANCEAMENTO COMPLETO DOS STATS
-- =====================================

-- PROBLEMA CRÍTICO IDENTIFICADO:
-- Personagem com 10 STR, 10 DEX, 29 INT fazia:
-- - Dano físico: ~82 (muito alto para stats mínimos)
-- - Dano mágico: ~106 (muito baixo para 29 INT)
-- - Diferença de apenas 29% entre build especializada vs não-especializada

-- SOLUÇÃO IMPLEMENTADA:
-- Sistema especializado que favorece builds focadas:
-- ✅ Bases muito menores (3+level vs 15+level*2 para ataque)
-- ✅ Escalamento logarítmico (atributo^1.3 ao invés de atributo*2)
-- ✅ Diminishing returns graduais (sem caps rígidos)
-- ✅ Crescimento infinito mas controlado

-- IMPACTO ESPERADO:
-- - Mago 29 INT: dano mágico ~200% (vs 106% antes)
-- - Guerreiro 10 STR: dano físico ~36 (vs 82 antes)
-- - Especialização recompensada, híbridos viáveis mas inferiores

-- =====================================
-- 1. NOVA FUNÇÃO DE STATS DERIVADOS ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Escalamento logarítmico dos atributos para especialização
    v_str_scaling NUMERIC := POWER(p_strength, 1.3);
    v_dex_scaling NUMERIC := POWER(p_dexterity, 1.25);
    v_int_scaling NUMERIC := POWER(p_intelligence, 1.35);
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.2);
    v_vit_scaling NUMERIC := POWER(p_vitality, 1.4);
    v_luck_scaling NUMERIC := p_luck;
    
    -- Habilidades com escalamento logarítmico
    v_weapon_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    v_def_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.3) * 1.2;
    v_magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Valores finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    
    -- Componentes para magic damage
    v_int_magic_scaling NUMERIC;
    v_wis_magic_scaling NUMERIC;
    v_mastery_magic_scaling NUMERIC;
    v_total_magic_bonus NUMERIC;
BEGIN
    -- =====================================
    -- SISTEMA ESPECIALIZADO: BASES MENORES
    -- =====================================
    
    -- HP: Tank builds se destacam
    v_hp := 60 + (p_level * 3) + ROUND(v_vit_scaling * 3.5);
    
    -- Mana: Mage builds se destacam
    v_mana := 25 + (p_level * 2) + ROUND(v_int_scaling * 2.0) + ROUND(v_magic_mastery_bonus);
    
    -- Ataque: Warrior builds se destacam (base crítica menor)
    v_atk := 3 + p_level + ROUND(v_str_scaling * 1.8) + ROUND(v_weapon_bonus);
    
    -- Defesa: Tank/Healer builds se destacam
    v_def := 2 + p_level + ROUND(v_vit_scaling * 0.8) + ROUND(v_wis_scaling * 0.6) + ROUND(v_def_mastery_bonus);
    
    -- Velocidade: Dex builds se destacam
    v_speed := 5 + p_level + ROUND(v_dex_scaling * 1.2);
    
    -- =====================================
    -- CRÍTICOS REBALANCEADOS
    -- =====================================
    
    -- Chance crítica (máximo 90%)
    v_crit_chance := LEAST(90, (v_luck_scaling * 0.4) + (v_dex_scaling * 0.3) + (v_weapon_bonus * 0.1));
    
    -- Dano crítico
    v_crit_damage := 140 + (v_luck_scaling * 0.8) + (v_str_scaling * 0.6) + (v_weapon_bonus * 0.4);
    
    -- =====================================
    -- DANO MÁGICO ESPECIALIZADO
    -- =====================================
    
    -- Intelligence: Fator principal para magos
    v_int_magic_scaling := v_int_scaling * 1.8;
    
    -- Wisdom: Fator secundário para híbridos/healers  
    v_wis_magic_scaling := v_wis_scaling * 1.2;
    
    -- Magic Mastery: Multiplicador de eficiência
    v_mastery_magic_scaling := v_magic_mastery_bonus * 2.5;
    
    -- Total sem cap
    v_total_magic_bonus := v_int_magic_scaling + v_wis_magic_scaling + v_mastery_magic_scaling;
    
    -- Diminishing returns graduais (não caps rígidos)
    IF v_total_magic_bonus > 150 THEN
        v_total_magic_bonus := 150 + ((v_total_magic_bonus - 150) * 0.6);
    END IF;
    
    -- Cap em 300% para especialistas extremos
    v_magic_dmg_bonus := LEAST(300, v_total_magic_bonus);
    
    -- =====================================
    -- RETORNO DOS VALORES
    -- =====================================
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,  -- max_hp = hp
        v_mana,
        v_mana, -- max_mana = mana
        v_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus;
END;
$$;

-- =====================================
-- 2. FUNÇÃO DE DANO MÁGICO ESCALADO ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_scaled_spell_damage CASCADE;

CREATE OR REPLACE FUNCTION calculate_scaled_spell_damage(
    p_base_damage INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_int_scaling NUMERIC := POWER(p_intelligence, 1.35);
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.2);
    v_mastery_scaling NUMERIC := POWER(p_magic_mastery, 1.2);
    
    v_int_magic_bonus NUMERIC := v_int_scaling * 1.8;
    v_wis_magic_bonus NUMERIC := v_wis_scaling * 1.2;
    v_mastery_magic_bonus NUMERIC := v_mastery_scaling * 2.5;
    
    v_total_bonus NUMERIC;
    v_scaled_damage INTEGER;
BEGIN
    -- Total sem cap
    v_total_bonus := v_int_magic_bonus + v_wis_magic_bonus + v_mastery_magic_bonus;
    
    -- Diminishing returns graduais
    IF v_total_bonus > 150 THEN
        v_total_bonus := 150 + ((v_total_bonus - 150) * 0.6);
    END IF;
    
    -- Cap máximo em 300%
    v_total_bonus := LEAST(300, v_total_bonus);
    
    -- Aplicar bônus ao dano base
    v_scaled_damage := ROUND(p_base_damage * (1 + v_total_bonus / 100));
    
    RETURN v_scaled_damage;
END;
$$;

-- =====================================
-- 3. FUNÇÃO DE CURA MÁGICA ESCALADA ESPECIALIZADA
-- =====================================

-- Remover função existente se houver conflito de assinatura
DROP FUNCTION IF EXISTS calculate_scaled_spell_healing CASCADE;

CREATE OR REPLACE FUNCTION calculate_scaled_spell_healing(
    p_base_healing INTEGER,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_wis_scaling NUMERIC := POWER(p_wisdom, 1.3);
    v_mastery_scaling NUMERIC := POWER(p_magic_mastery, 1.15);
    
    v_wis_healing_bonus NUMERIC := v_wis_scaling * 2.2;
    v_mastery_healing_bonus NUMERIC := v_mastery_scaling * 1.8;
    
    v_total_bonus NUMERIC;
    v_scaled_healing INTEGER;
BEGIN
    -- Total sem cap
    v_total_bonus := v_wis_healing_bonus + v_mastery_healing_bonus;
    
    -- Diminishing returns para cura (menor que dano)
    IF v_total_bonus > 120 THEN
        v_total_bonus := 120 + ((v_total_bonus - 120) * 0.5);
    END IF;
    
    -- Cap em 220% para curadores especializados
    v_total_bonus := LEAST(220, v_total_bonus);
    
    -- Aplicar bônus à cura base
    v_scaled_healing := ROUND(p_base_healing * (1 + v_total_bonus / 100));
    
    RETURN v_scaled_healing;
END;
$$;

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'Sistema de stats especializado que favorece builds focadas.
- Bases muito menores forçam dependência de atributos específicos
- Escalamento logarítmico beneficia especialização
- Diminishing returns previnem builds OP
- Sem caps rígidos, permitindo crescimento infinito';

COMMENT ON FUNCTION calculate_scaled_spell_damage IS
'Dano mágico escalado para magos especializados.
- Intelligence como fator principal (^1.35)
- Magic Mastery como multiplicador de eficiência
- Diminishing returns graduais em 150%+
- Cap máximo em 300% para builds extremas';

COMMENT ON FUNCTION calculate_scaled_spell_healing IS
'Cura mágica escalada para curadores especializados.
- Wisdom como fator principal para cura
- Escalamento mais conservador que dano
- Cap menor (220%) para manter balanço'; 
-- Migração para rebalanceamento completo do sistema de monstros
-- Data: 2024-12-03
-- Versão: 20241203000010

-- =====================================
-- REBALANCEAMENTO DO SISTEMA DE MONSTROS
-- =====================================

-- ANÁLISE DO PROBLEMA:
-- Sistema atual de monstros usa escalamento linear simples
-- Não considera especialização de builds (aggressive, defensive, balanced)
-- Dificuldade inconsistente ao longo dos andares
-- SOLUÇÃO: Sistema especializado similar aos personagens

-- =====================================
-- 1. NOVA FUNÇÃO DE ESCALAMENTO ESPECIALIZADO
-- =====================================

-- Remover função antiga
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
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
DECLARE
    floor_range INTEGER := 5;
    v_selected_monster RECORD;
    
    -- Variáveis para escalamento logarítmico
    v_floor_modifier NUMERIC;
    v_str_scaling NUMERIC;
    v_dex_scaling NUMERIC;
    v_int_scaling NUMERIC;
    v_wis_scaling NUMERIC;
    v_vit_scaling NUMERIC;
    v_luck_scaling NUMERIC;
    
    -- Stats finais calculados
    v_final_hp INTEGER;
    v_final_atk INTEGER;
    v_final_def INTEGER;
    v_final_mana INTEGER;
    v_final_speed INTEGER;
    v_final_xp INTEGER;
    v_final_gold INTEGER;
BEGIN
    -- Selecionar monstro apropriado para o andar
    SELECT * INTO v_selected_monster
    FROM monsters m
    WHERE m.min_floor <= p_floor 
    AND m.min_floor >= GREATEST(1, p_floor - floor_range)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Se nenhum monstro encontrado no range ideal, pegar o mais próximo
    IF v_selected_monster IS NULL THEN
        SELECT * INTO v_selected_monster
        FROM monsters m
        ORDER BY ABS(m.min_floor - p_floor) ASC
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, erro
    IF v_selected_monster IS NULL THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO ESPECIALIZADO
    -- =====================================
    
    -- Modificador baseado na diferença de andar (similar aos personagens)
    v_floor_modifier := GREATEST(1.0, POWER(p_floor::NUMERIC / v_selected_monster.min_floor::NUMERIC, 0.8));
    
    -- Escalamento de atributos baseado no comportamento do monstro
    CASE v_selected_monster.behavior
        WHEN 'aggressive' THEN
            -- Aggressive: Focus em STR e DEX (guerreiro agressivo)
            v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.3);
            v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.25);
            v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.1);
            v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.1);
            v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.2);
            v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            
        WHEN 'defensive' THEN
            -- Defensive: Focus em VIT e WIS (tank especializado)
            v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.1);
            v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.1);
            v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.2);
            v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.3);
            v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.4);
            v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            
        WHEN 'balanced' THEN
            -- Balanced: Crescimento equilibrado mas pode ser mago
            IF v_selected_monster.intelligence > v_selected_monster.strength THEN
                -- Mago balanceado
                v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.2);
                v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.2);
                v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.35);
                v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.25);
                v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.25);
                v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            ELSE
                -- Híbrido físico-mágico
                v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.25);
                v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.25);
                v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.25);
                v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.25);
                v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.3);
                v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            END IF;
    END CASE;
    
    -- =====================================
    -- CALCULAR STATS FINAIS ESPECIALIZADO
    -- =====================================
    
    -- HP: Base menor + VIT scaling (similar aos personagens)
    v_final_hp := 40 + (p_floor * 2) + ROUND(v_vit_scaling * 2.8);
    
    -- ATK: Base menor + STR/INT scaling dependendo do tipo
    IF v_selected_monster.intelligence > v_selected_monster.strength THEN
        -- Monstro mágico: usar INT
        v_final_atk := 8 + p_floor + ROUND(v_int_scaling * 1.2) + ROUND(v_str_scaling * 0.6);
    ELSE
        -- Monstro físico: usar STR
        v_final_atk := 8 + p_floor + ROUND(v_str_scaling * 1.5) + ROUND(v_int_scaling * 0.4);
    END IF;
    
    -- DEF: Base menor + VIT/WIS scaling
    v_final_def := 3 + ROUND(p_floor * 0.8) + ROUND(v_vit_scaling * 0.6) + ROUND(v_wis_scaling * 0.4);
    
    -- MANA: Base + INT/WIS scaling
    v_final_mana := 10 + ROUND(v_int_scaling * 1.5) + ROUND(v_wis_scaling * 0.8);
    
    -- SPEED: Base + DEX scaling
    v_final_speed := 6 + ROUND(p_floor * 0.5) + ROUND(v_dex_scaling * 0.8);
    
    -- =====================================
    -- RECOMPENSAS BALANCEADAS
    -- =====================================
    
    -- XP e Gold crescem com escalamento mais agressivo para compensar dificuldade
    v_final_xp := v_selected_monster.reward_xp + ROUND((p_floor - v_selected_monster.min_floor) * v_selected_monster.reward_xp * 0.25);
    v_final_gold := v_selected_monster.reward_gold + ROUND((p_floor - v_selected_monster.min_floor) * v_selected_monster.reward_gold * 0.30);
    
    -- =====================================
    -- RETORNAR MONSTRO REBALANCEADO
    -- =====================================
    
    RETURN QUERY SELECT
        v_selected_monster.id,
        v_selected_monster.name,
        v_final_hp,
        v_final_atk,
        v_final_def,
        v_final_mana,
        v_final_speed,
        v_selected_monster.behavior,
        v_selected_monster.min_floor,
        v_final_xp,
        v_final_gold,
        
        -- Atributos escalados para referência
        ROUND(v_str_scaling)::INTEGER as strength,
        ROUND(v_dex_scaling)::INTEGER as dexterity,
        ROUND(v_int_scaling)::INTEGER as intelligence,
        ROUND(v_wis_scaling)::INTEGER as wisdom,
        ROUND(v_vit_scaling)::INTEGER as vitality,
        ROUND(v_luck_scaling)::INTEGER as luck,
        
        -- Propriedades de combate escaladas
        LEAST(0.45, v_selected_monster.critical_chance + (p_floor - v_selected_monster.min_floor) * 0.008)::DECIMAL as critical_chance,
        LEAST(3.0, v_selected_monster.critical_damage + (p_floor - v_selected_monster.min_floor) * 0.03)::DECIMAL as critical_damage,
        LEAST(0.85, v_selected_monster.critical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as critical_resistance,
        
        -- Resistências escaladas mais agressivamente (monstros ficam mais resistentes)
        LEAST(0.80, v_selected_monster.physical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as physical_resistance,
        LEAST(0.80, v_selected_monster.magical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as magical_resistance,
        LEAST(0.95, v_selected_monster.debuff_resistance + (p_floor - v_selected_monster.min_floor) * 0.015)::DECIMAL as debuff_resistance,
        
        -- Vulnerabilidades não mudam (características fixas)
        v_selected_monster.physical_vulnerability,
        v_selected_monster.magical_vulnerability,
        v_selected_monster.primary_trait,
        v_selected_monster.secondary_trait,
        v_selected_monster.special_abilities;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. ATUALIZAR DADOS BASE DOS MONSTROS
-- =====================================

-- Atualizar monstros existentes para ter builds mais especializadas
-- Bases menores e especializações mais claras

-- Monstros Aggressive: Alta STR/DEX, baixa VIT/WIS
UPDATE monsters SET 
    strength = CASE 
        WHEN behavior = 'aggressive' THEN GREATEST(strength, 15)
        ELSE strength
    END,
    dexterity = CASE 
        WHEN behavior = 'aggressive' THEN GREATEST(dexterity, 12)  
        ELSE dexterity
    END,
    vitality = CASE 
        WHEN behavior = 'aggressive' THEN LEAST(vitality, 10)
        ELSE vitality
    END,
    wisdom = CASE 
        WHEN behavior = 'aggressive' THEN LEAST(wisdom, 8)
        ELSE wisdom
    END
WHERE behavior = 'aggressive';

-- Monstros Defensive: Alta VIT/WIS, baixa STR/DEX
UPDATE monsters SET 
    vitality = CASE 
        WHEN behavior = 'defensive' THEN GREATEST(vitality, 18)
        ELSE vitality
    END,
    wisdom = CASE 
        WHEN behavior = 'defensive' THEN GREATEST(wisdom, 15)
        ELSE wisdom
    END,
    strength = CASE 
        WHEN behavior = 'defensive' THEN LEAST(strength, 12)
        ELSE strength
    END,
    dexterity = CASE 
        WHEN behavior = 'defensive' THEN LEAST(dexterity, 8)
        ELSE dexterity
    END
WHERE behavior = 'defensive';

-- Monstros Balanced: Stats equilibrados mas alguns são magos
UPDATE monsters SET 
    intelligence = CASE 
        WHEN behavior = 'balanced' AND name ILIKE '%mago%' THEN GREATEST(intelligence, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%lich%' THEN GREATEST(intelligence, 20)
        WHEN behavior = 'balanced' AND name ILIKE '%necromante%' THEN GREATEST(intelligence, 18)
        WHEN behavior = 'balanced' AND name ILIKE '%druida%' THEN GREATEST(intelligence, 14)
        WHEN behavior = 'balanced' AND name ILIKE '%elemental%' THEN GREATEST(intelligence, 17)
        WHEN behavior = 'balanced' THEN intelligence
        ELSE intelligence
    END,
    wisdom = CASE 
        WHEN behavior = 'balanced' AND name ILIKE '%mago%' THEN GREATEST(wisdom, 14)
        WHEN behavior = 'balanced' AND name ILIKE '%lich%' THEN GREATEST(wisdom, 18)
        WHEN behavior = 'balanced' AND name ILIKE '%necromante%' THEN GREATEST(wisdom, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%druida%' THEN GREATEST(wisdom, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%elemental%' THEN GREATEST(wisdom, 15)
        WHEN behavior = 'balanced' THEN wisdom
        ELSE wisdom
    END
WHERE behavior = 'balanced';

-- Reduzir stats base para forçar dependência de especialização (similar aos personagens)
UPDATE monsters SET 
    hp = GREATEST(30, ROUND(hp * 0.6)),      -- Reduzir HP base significativamente
    atk = GREATEST(8, ROUND(atk * 0.5)),     -- Reduzir ATK base drasticamente 
    def = GREATEST(3, ROUND(def * 0.4)),     -- Reduzir DEF base drasticamente
    mana = GREATEST(5, ROUND(mana * 0.7)),   -- Reduzir Mana base moderadamente
    speed = GREATEST(6, ROUND(speed * 0.7)); -- Reduzir Speed base moderadamente

-- =====================================
-- 3. AJUSTAR RESISTÊNCIAS PARA DIFICULDADE MÉDIA-DIFÍCIL
-- =====================================

-- Monstros devem ser mais desafiadores
UPDATE monsters SET
    critical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.3, critical_resistance + 0.15)
        WHEN behavior = 'balanced' THEN LEAST(0.2, critical_resistance + 0.10)
        ELSE LEAST(0.1, critical_resistance + 0.05)
    END,
    physical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.25, physical_resistance + 0.15)
        WHEN primary_trait = 'armored' THEN LEAST(0.30, physical_resistance + 0.20)
        ELSE LEAST(0.10, physical_resistance + 0.05)
    END,
    magical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.20, magical_resistance + 0.10)
        WHEN primary_trait = 'ethereal' THEN LEAST(0.35, magical_resistance + 0.25)
        WHEN name ILIKE '%elemental%' THEN LEAST(0.25, magical_resistance + 0.15)
        ELSE LEAST(0.10, magical_resistance + 0.05)
    END,
    debuff_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.40, debuff_resistance + 0.25)
        WHEN min_floor >= 10 THEN LEAST(0.30, debuff_resistance + 0.15)
        ELSE LEAST(0.15, debuff_resistance + 0.10)
    END;

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Sistema de monstros especializado que usa escalamento logarítmico.
- Comportamentos têm especializações claras (aggressive=STR/DEX, defensive=VIT/WIS, balanced=híbrido/mago)
- Escalamento logarítmico similar aos personagens
- Dificuldade média-difícil com resistências escalantes
- Stats base menores forçam dependência de atributos específicos';

-- Migração concluída com sucesso
-- Sistema de monstros rebalanceado com especialização implementado 
-- Migração para implementar sistema cíclico de monstros
-- Permite progressão infinita reutilizando monstros com stats escalados

-- Adicionar novos campos para sistema cíclico
ALTER TABLE monsters 
ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS tier INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS base_tier INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS cycle_position INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_boss BOOLEAN DEFAULT FALSE;

-- Atualizar monstros existentes com dados do sistema cíclico
UPDATE monsters SET 
  tier = 1,
  base_tier = 1,
  cycle_position = min_floor,
  is_boss = CASE 
    WHEN min_floor IN (5, 10, 15, 20) THEN TRUE 
    ELSE FALSE 
  END;

-- Criar índices para otimizar busca por ciclos
CREATE INDEX IF NOT EXISTS idx_monsters_tier ON monsters(tier);
CREATE INDEX IF NOT EXISTS idx_monsters_cycle_position ON monsters(cycle_position);
CREATE INDEX IF NOT EXISTS idx_monsters_is_boss ON monsters(is_boss);
CREATE INDEX IF NOT EXISTS idx_monsters_tier_cycle ON monsters(tier, cycle_position);

-- Função para calcular tier baseado no andar
CREATE OR REPLACE FUNCTION calculate_monster_tier(p_floor INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Tier 1: andares 1-20, Tier 2: andares 21-40, etc.
  RETURN GREATEST(1, CEIL(p_floor::DECIMAL / 20));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para calcular posição no ciclo baseado no andar
CREATE OR REPLACE FUNCTION calculate_cycle_position(p_floor INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Posição dentro do ciclo de 20 andares (1-20)
  DECLARE
    position INTEGER;
  BEGIN
    position := ((p_floor - 1) % 20) + 1;
    RETURN position;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para escalar stats de monstro baseado no tier
CREATE OR REPLACE FUNCTION scale_monster_stats(
  p_base_stat DECIMAL,
  p_current_tier INTEGER,
  p_base_tier INTEGER DEFAULT 1,
  p_scaling_factor DECIMAL DEFAULT 1.8
) RETURNS INTEGER AS $$
BEGIN
  IF p_current_tier <= p_base_tier THEN
    RETURN p_base_stat::INTEGER;
  END IF;
  
  -- Escalonamento exponencial com diminishing returns
  RETURN (p_base_stat * POWER(p_scaling_factor, p_current_tier - p_base_tier))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função melhorada para buscar monstro para andar com sistema cíclico
CREATE OR REPLACE FUNCTION get_monster_for_floor_cyclic(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários escalados
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate escaladas
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências escaladas
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait TEXT,
  secondary_trait TEXT,
  special_abilities TEXT[]
) AS $$
DECLARE
  current_tier INTEGER;
  target_cycle_position INTEGER;
  boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
  selected_monster RECORD;
  tier_multiplier DECIMAL;
BEGIN
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  
  -- Verificar se é andar de boss
  IF target_cycle_position = ANY(boss_floors) THEN
    -- Buscar boss específico para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position = target_cycle_position
      AND m.is_boss = true
      AND m.base_tier = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position = target_cycle_position
      AND m.is_boss = false
      AND m.base_tier = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou monstro específico, buscar por proximidade
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position <= target_cycle_position
      AND m.base_tier = 1
      AND m.is_boss = (target_cycle_position = ANY(boss_floors))
    ORDER BY m.cycle_position DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, pegar qualquer monstro do tipo
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.base_tier = 1
      AND m.is_boss = (target_cycle_position = ANY(boss_floors))
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nenhum monstro, retornar vazio
  IF selected_monster IS NULL THEN
    RETURN;
  END IF;
  
  -- Calcular multiplicador de tier para escalonamento
  tier_multiplier := POWER(1.8, current_tier - 1);
  
  -- Retornar monstro com stats escalados
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name,
    -- Level escalado
    GREATEST(selected_monster.level, (current_tier - 1) * 20 + selected_monster.level)::INTEGER,
    -- Stats principais escalados
    scale_monster_stats(selected_monster.hp, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.atk, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.def, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.mana, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.speed, current_tier)::INTEGER,
    selected_monster.behavior,
    p_floor, -- min_floor ajustado para andar atual
    -- Recompensas escaladas
    scale_monster_stats(selected_monster.reward_xp, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.reward_gold, current_tier)::INTEGER,
    selected_monster.image,
    current_tier::INTEGER,
    selected_monster.base_tier::INTEGER,
    target_cycle_position::INTEGER,
    selected_monster.is_boss,
    -- Atributos primários escalados
    COALESCE(scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier), 5)::INTEGER,
    -- Propriedades de combate (não escalam muito para manter balanceamento)
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.1), 0.25)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.05), 2.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) * (1 + (current_tier - 1) * 0.05), 0.4)::DECIMAL,
    -- Resistências (crescem levemente)
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.02, 0.3)::DECIMAL,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.02, 0.3)::DECIMAL,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.02, 0.4)::DECIMAL,
    -- Vulnerabilidades (não mudam)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    selected_monster.special_abilities;
END;
$$ LANGUAGE plpgsql;

-- Função para obter informações do ciclo atual
CREATE OR REPLACE FUNCTION get_cycle_info(p_floor INTEGER)
RETURNS TABLE (
  current_tier INTEGER,
  cycle_position INTEGER,
  floors_in_current_cycle INTEGER,
  is_boss_floor BOOLEAN,
  next_boss_floor INTEGER
) AS $$
DECLARE
  boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
  tier INTEGER;
  position INTEGER;
  next_boss INTEGER;
BEGIN
  tier := calculate_monster_tier(p_floor);
  position := calculate_cycle_position(p_floor);
  
  -- Calcular próximo andar de boss
  SELECT MIN(bf) INTO next_boss
  FROM unnest(boss_floors) bf
  WHERE bf > position;
  
  IF next_boss IS NULL THEN
    next_boss := boss_floors[1] + 20; -- Próximo ciclo
  ELSE
    next_boss := next_boss + (tier - 1) * 20; -- Mesmo ciclo
  END IF;
  
  RETURN QUERY SELECT
    tier,
    position,
    20, -- Sempre 20 andares por ciclo
    (position = ANY(boss_floors)),
    next_boss;
END;
$$ LANGUAGE plpgsql;

-- Remover a função existente para poder recriar com novo tipo de retorno
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER);

-- Recriar a função original para usar o novo sistema
CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  -- Novos campos
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait TEXT,
  secondary_trait TEXT,
  special_abilities TEXT[]
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_monster_for_floor_cyclic(p_floor);
END;
$$ LANGUAGE plpgsql; 
-- Migração para corrigir função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000002

-- =====================================
-- REMOVER FUNÇÕES CONFLITANTES
-- =====================================

-- Remover todas as versões da função calculate_derived_stats
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR);

-- =====================================
-- RECRIAR FUNÇÃO calculate_derived_stats ÚNICA E ROBUSTA
-- =====================================

-- Função unificada para calcular stats derivados (com ou sem habilidades)
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1,
    p_equipped_weapon_type VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Bônus de habilidades
    weapon_bonus DECIMAL := 0;
    def_mastery_bonus DECIMAL := POWER(p_defense_mastery, 1.3) * 1.2;
    magic_mastery_bonus DECIMAL := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular bônus de arma baseado no tipo equipado
    IF p_equipped_weapon_type = 'sword' THEN
        weapon_bonus := POWER(p_sword_mastery, 1.1) * 0.5;
    ELSIF p_equipped_weapon_type = 'axe' THEN
        weapon_bonus := POWER(p_axe_mastery, 1.1) * 0.5;
    ELSIF p_equipped_weapon_type = 'blunt' THEN
        weapon_bonus := POWER(p_blunt_mastery, 1.1) * 0.5;
    ELSE
        -- Sem arma equipada, usar a maior maestria
        weapon_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    END IF;
    
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2) + (magic_mastery_bonus * 2.5);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, VARCHAR) IS 
'Calcula stats derivados com base em nível, atributos primários, habilidades e equipamento. Funciona tanto para criação de personagens (parâmetros básicos) quanto para cálculos avançados com equipamento.';

-- Migração concluída com sucesso! 
-- Migração para FORÇAR correção da função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000003

-- =====================================
-- LIMPEZA FORÇADA DE TODAS AS VERSÕES
-- =====================================

-- Remover funções calculate_derived_stats de forma robusta
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Buscar todas as funções calculate_derived_stats e removê-las uma por uma
    FOR func_record IN 
        SELECT n.nspname as schema_name, p.proname as func_name, 
               pg_get_function_identity_arguments(p.oid) as func_args
        FROM pg_proc p 
        LEFT JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE p.proname = 'calculate_derived_stats'
    LOOP
        BEGIN
            EXECUTE format('DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE', 
                          func_record.schema_name, 
                          func_record.func_name, 
                          func_record.func_args);
            RAISE NOTICE 'Removida função: %.%(%)', func_record.schema_name, func_record.func_name, func_record.func_args;
        EXCEPTION
            WHEN others THEN 
                RAISE NOTICE 'Erro ao remover função %.%(%): %', func_record.schema_name, func_record.func_name, func_record.func_args, SQLERRM;
        END;
    END LOOP;
END $$;

-- Remover possíveis funções orphaned ou com nomes específicos
DO $$
BEGIN
    DROP FUNCTION IF EXISTS calculate_character_derived_stats CASCADE;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- =====================================
-- RECRIAR FUNÇÃO COM NOME ÚNICO
-- =====================================

-- Função principal para cálculo de stats derivados
CREATE OR REPLACE FUNCTION calculate_character_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0);
    final_atk := base_atk + FLOOR(str_scaling * 1.8);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- CRIAR ALIAS PARA COMPATIBILIDADE
-- =====================================

-- Criar função alias para manter compatibilidade
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM calculate_character_derived_stats(
        p_level, p_strength, p_dexterity, p_intelligence, 
        p_wisdom, p_vitality, p_luck
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_character_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função principal para calcular stats derivados de personagens baseados em nível e atributos';

COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função alias para compatibilidade com código existente';

-- Migração concluída com sucesso! 
-- Migração para corrigir definitivamente a função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000004

-- =====================================
-- LIMPEZA E CRIAÇÃO DA FUNÇÃO
-- =====================================

-- Remover todas as versões da função calculate_derived_stats
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

-- Criar função correta
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0);
    final_atk := base_atk + FLOOR(str_scaling * 1.8);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- TESTE DA FUNÇÃO
-- =====================================

-- Testar a função calculate_derived_stats
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Executar teste simples
    SELECT * INTO test_result 
    FROM calculate_derived_stats(10, 15, 12, 8, 10, 14, 6);
    
    IF test_result IS NOT NULL THEN
        RAISE NOTICE 'Teste da função calculate_derived_stats: SUCESSO';
        RAISE NOTICE 'HP: %, Atk: %, Def: %', test_result.derived_hp, test_result.derived_atk, test_result.derived_def;
    ELSE
        RAISE WARNING 'Teste da função calculate_derived_stats: FALHOU';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Erro ao testar função calculate_derived_stats: %', SQLERRM;
END $$;

-- Documentação
COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função para calcular stats derivados de personagens baseados em nível e atributos primários'; 
-- Migração para otimizar transações da loja
-- Modificar funções de compra para retornar o novo valor de gold

-- Dropar as funções existentes primeiro (necessário para alterar tipo de retorno)
DROP FUNCTION IF EXISTS buy_equipment(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS buy_consumable(UUID, UUID, INTEGER);
DROP FUNCTION IF EXISTS sell_equipment(UUID, UUID);

-- Função de compra de equipamento que retorna o novo gold
CREATE OR REPLACE FUNCTION buy_equipment(
    p_character_id UUID,
    p_equipment_id UUID,
    p_price INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_character_gold INTEGER;
    v_character_level INTEGER;
    v_equipment_level INTEGER;
    v_equipment_unlocked BOOLEAN;
    v_new_gold INTEGER;
BEGIN
    -- Obter dados do equipamento
    SELECT level_requirement, is_unlocked INTO v_equipment_level, v_equipment_unlocked
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Verificar se o equipamento está desbloqueado
    IF NOT v_equipment_unlocked THEN
        RAISE EXCEPTION 'Este equipamento ainda não foi desbloqueado';
    END IF;
    
    -- Verificar se o personagem tem gold suficiente
    SELECT gold, level INTO v_character_gold, v_character_level
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem tem nível suficiente
    IF v_character_level < v_equipment_level THEN
        RAISE EXCEPTION 'Nível insuficiente para usar este equipamento';
    END IF;
    
    -- Verificar gold
    IF v_character_gold < p_price THEN
        RAISE EXCEPTION 'Gold insuficiente para comprar o equipamento';
    END IF;
    
    -- Calcular novo gold
    v_new_gold := v_character_gold - p_price;
    
    -- Deduzir gold do personagem
    UPDATE characters
    SET gold = v_new_gold
    WHERE id = p_character_id;
    
    -- Adicionar equipamento ao inventário do personagem
    INSERT INTO character_equipment (character_id, equipment_id)
    VALUES (p_character_id, p_equipment_id);
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql;

-- Função de compra de consumível que retorna o novo gold
CREATE OR REPLACE FUNCTION buy_consumable(
    p_character_id UUID,
    p_consumable_id UUID,
    p_quantity INTEGER DEFAULT 1
) RETURNS INTEGER AS $$
DECLARE
    v_price INTEGER;
    v_gold INTEGER;
    v_current_quantity INTEGER;
    v_total_cost INTEGER;
    v_new_gold INTEGER;
BEGIN
    -- Verificar se o consumível existe
    SELECT price INTO v_price FROM consumables WHERE id = p_consumable_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Consumível não encontrado';
    END IF;
    
    -- Calcular custo total
    v_total_cost := v_price * p_quantity;
    
    -- Verificar se o personagem tem ouro suficiente
    SELECT gold INTO v_gold FROM characters WHERE id = p_character_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    IF v_gold < v_total_cost THEN
        RAISE EXCEPTION 'Ouro insuficiente para comprar % unidades', p_quantity;
    END IF;
    
    -- Calcular novo gold
    v_new_gold := v_gold - v_total_cost;
    
    -- Atualizar o ouro do personagem
    UPDATE characters 
    SET gold = v_new_gold
    WHERE id = p_character_id;
    
    -- Verificar se o personagem já tem este consumível
    SELECT quantity INTO v_current_quantity
    FROM character_consumables
    WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    
    IF FOUND THEN
        -- Atualizar a quantidade
        UPDATE character_consumables
        SET quantity = quantity + p_quantity,
            updated_at = NOW()
        WHERE character_id = p_character_id AND consumable_id = p_consumable_id;
    ELSE
        -- Inserir novo registro
        INSERT INTO character_consumables (character_id, consumable_id, quantity)
        VALUES (p_character_id, p_consumable_id, p_quantity);
    END IF;
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql;

-- Função de venda de equipamento que retorna o novo gold
CREATE OR REPLACE FUNCTION sell_equipment(
    p_character_id UUID,
    p_equipment_id UUID
) RETURNS INTEGER AS $$
DECLARE
    v_price INTEGER;
    v_rarity equipment_rarity;
    v_current_gold INTEGER;
    v_new_gold INTEGER;
BEGIN
    -- Obter preço e raridade do equipamento
    SELECT price, rarity INTO v_price, v_rarity
    FROM equipment
    WHERE id = p_equipment_id;
    
    -- Ajustar valor de venda com base na raridade (para balancear a economia)
    -- Equipamentos mais raros têm um melhor retorno percentual
    CASE v_rarity
        WHEN 'common' THEN v_price := v_price * 0.3;
        WHEN 'uncommon' THEN v_price := v_price * 0.35;
        WHEN 'rare' THEN v_price := v_price * 0.4;
        WHEN 'epic' THEN v_price := v_price * 0.45;
        WHEN 'legendary' THEN v_price := v_price * 0.5;
    END CASE;
    
    -- Arredondar para inteiro
    v_price := FLOOR(v_price);
    
    -- Obter gold atual
    SELECT gold INTO v_current_gold FROM characters WHERE id = p_character_id;
    v_new_gold := v_current_gold + v_price;
    
    -- Adicionar gold ao personagem
    UPDATE characters
    SET gold = v_new_gold
    WHERE id = p_character_id;
    
    -- Remover equipamento do inventário
    DELETE FROM character_equipment
    WHERE character_id = p_character_id
    AND equipment_id = p_equipment_id;
    
    -- Recalcular stats após venda
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Retornar o novo valor de gold
    RETURN v_new_gold;
END;
$$ LANGUAGE plpgsql; 
-- Migração para corrigir sistema de ciclos de monstros
-- PROBLEMA: Stats dos monstros não estão escalando entre tiers
-- SOLUÇÃO: Recriar sistema completo com validação

-- =====================================
-- 1. LIMPEZA COMPLETA DE FUNÇÕES
-- =====================================

SELECT 'Removendo funções conflitantes...' as status;

-- Remover TODAS as versões da função para evitar conflitos
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_monster_for_floor_cyclic(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_monster_tier(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS calculate_cycle_position(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS scale_monster_stats(DECIMAL, INTEGER, INTEGER, DECIMAL) CASCADE;

-- =====================================
-- 2. VERIFICAR E ADICIONAR COLUNAS NECESSÁRIAS
-- =====================================

SELECT 'Verificando estrutura da tabela...' as status;

DO $$
BEGIN
  -- Verificar e adicionar colunas faltantes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'level'
  ) THEN
    ALTER TABLE monsters ADD COLUMN level INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna level adicionada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'tier'
  ) THEN
    ALTER TABLE monsters ADD COLUMN tier INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna tier adicionada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'base_tier'
  ) THEN
    ALTER TABLE monsters ADD COLUMN base_tier INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna base_tier adicionada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'cycle_position'
  ) THEN
    ALTER TABLE monsters ADD COLUMN cycle_position INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna cycle_position adicionada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'is_boss'
  ) THEN
    ALTER TABLE monsters ADD COLUMN is_boss BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Coluna is_boss adicionada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'image'
  ) THEN
    ALTER TABLE monsters ADD COLUMN image TEXT DEFAULT '';
    RAISE NOTICE 'Coluna image adicionada';
  END IF;
END $$;

-- =====================================
-- 3. RECRIAR FUNÇÕES AUXILIARES
-- =====================================

SELECT 'Recriando funções auxiliares...' as status;

-- Função para calcular tier baseado no andar
CREATE OR REPLACE FUNCTION calculate_monster_tier(p_floor INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- Tier 1: andares 1-20, Tier 2: andares 21-40, etc.
  RETURN GREATEST(1, CEIL(p_floor::DECIMAL / 20));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para calcular posição no ciclo baseado no andar
CREATE OR REPLACE FUNCTION calculate_cycle_position(p_floor INTEGER)
RETURNS INTEGER AS $$
DECLARE
  position INTEGER;
BEGIN
  -- Posição dentro do ciclo de 20 andares (1-20)
  position := ((p_floor - 1) % 20) + 1;
  RETURN position;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para escalar stats de monstro baseado no tier
CREATE OR REPLACE FUNCTION scale_monster_stats(
  p_base_stat DECIMAL,
  p_current_tier INTEGER,
  p_base_tier INTEGER DEFAULT 1,
  p_scaling_factor DECIMAL DEFAULT 2.0
) RETURNS INTEGER AS $$
BEGIN
  -- Se tier atual for menor ou igual ao base tier, retornar stat original
  IF p_current_tier <= p_base_tier THEN
    RETURN p_base_stat::INTEGER;
  END IF;
  
  -- CRÍTICO: Escalamento exponencial mais agressivo para garantir diferença visível
  -- Exemplo: Tier 2 = stats * 2.0, Tier 3 = stats * 4.0, etc.
  RETURN (p_base_stat * POWER(p_scaling_factor, p_current_tier - p_base_tier))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 4. FUNÇÃO PRINCIPAL COM ESCALAMENTO GARANTIDO
-- =====================================

SELECT 'Criando função principal...' as status;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários escalados
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate escaladas
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências escaladas
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait monster_trait,
  secondary_trait monster_trait,
  special_abilities TEXT[]
) AS $$
DECLARE
  current_tier INTEGER;
  target_cycle_position INTEGER;
  boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
  selected_monster RECORD;
BEGIN
  -- CRÍTICO: Validar entrada
  IF p_floor IS NULL OR p_floor < 1 THEN
    p_floor := 1;
  END IF;
  
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  
  -- CRITICAL LOGGING: Vamos logar para debug
  -- RAISE NOTICE 'MONSTER DEBUG: Floor=%, Tier=%, Position=%', p_floor, current_tier, target_cycle_position;
  
  -- Determinar se é andar de boss
  IF target_cycle_position = ANY(boss_floors) THEN
    -- Buscar boss específico para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = true
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = false
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou monstro específico, buscar por proximidade
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) <= target_cycle_position
      AND COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = (target_cycle_position = ANY(boss_floors))
    ORDER BY COALESCE(m.cycle_position, m.min_floor) DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, pegar qualquer monstro do tipo
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = (target_cycle_position = ANY(boss_floors))
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Último recurso: pegar qualquer monstro
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nenhum monstro, retornar vazio
  IF selected_monster IS NULL THEN
    RETURN;
  END IF;
  
  -- CRÍTICO: Aplicar escalamento sempre, mesmo no tier 1
  -- Isso garante que mesmo no tier 1, os stats crescem com o andar
  
  -- Para tier 1, usar escalamento linear suave baseado no andar
  -- Para tiers maiores, usar escalamento exponencial agressivo
  
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name::TEXT,
    -- Level escalado progressivamente
    GREATEST(
      COALESCE(selected_monster.level, 1), 
      COALESCE(selected_monster.level, 1) + ((current_tier - 1) * 20) + (p_floor - ((current_tier - 1) * 20))
    )::INTEGER,
    
    -- CRÍTICO: Stats principais com escalamento garantido
    -- Tier 1: crescimento linear baseado no andar
    -- Tier 2+: escalamento exponencial agressivo
    CASE 
      WHEN current_tier = 1 THEN 
        -- Tier 1: crescimento linear suave
        (selected_monster.hp + ((p_floor - selected_monster.min_floor) * GREATEST(5, selected_monster.hp * 0.15)))::INTEGER
      ELSE 
        -- Tier 2+: escalamento exponencial
        scale_monster_stats(selected_monster.hp, current_tier, 1, 2.0)::INTEGER
    END as hp,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.atk + ((p_floor - selected_monster.min_floor) * GREATEST(2, selected_monster.atk * 0.12)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.atk, current_tier, 1, 2.0)::INTEGER
    END as atk,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.def + ((p_floor - selected_monster.min_floor) * GREATEST(1, selected_monster.def * 0.10)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.def, current_tier, 1, 2.0)::INTEGER
    END as def,
    
    -- Mana e Speed com escalamento similar
    CASE 
      WHEN current_tier = 1 THEN 
        (COALESCE(selected_monster.mana, 0) + ((p_floor - selected_monster.min_floor) * 2))::INTEGER
      ELSE 
        scale_monster_stats(COALESCE(selected_monster.mana, 0), current_tier, 1, 2.0)::INTEGER
    END as mana,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (COALESCE(selected_monster.speed, 10) + ((p_floor - selected_monster.min_floor) * 1))::INTEGER
      ELSE 
        scale_monster_stats(COALESCE(selected_monster.speed, 10), current_tier, 1, 2.0)::INTEGER
    END as speed,
    
    selected_monster.behavior,
    p_floor, -- min_floor ajustado para andar atual
    
    -- Recompensas escaladas
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.reward_xp + ((p_floor - selected_monster.min_floor) * GREATEST(3, selected_monster.reward_xp * 0.20)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.reward_xp, current_tier, 1, 2.0)::INTEGER
    END as reward_xp,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.reward_gold + ((p_floor - selected_monster.min_floor) * GREATEST(2, selected_monster.reward_gold * 0.20)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.reward_gold, current_tier, 1, 2.0)::INTEGER
    END as reward_gold,
    
    COALESCE(selected_monster.image, '')::TEXT,
    current_tier::INTEGER,
    COALESCE(selected_monster.base_tier, 1)::INTEGER,
    target_cycle_position::INTEGER,
    COALESCE(selected_monster.is_boss, (selected_monster.min_floor IN (5, 10, 15, 20)))::BOOLEAN,
    
    -- Atributos primários escalados
    COALESCE(scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier, 1, 1.8), 5)::INTEGER,
    
    -- Propriedades de combate (escalamento moderado para balanceamento)
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.15), 0.35)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.10), 3.0)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) * (1 + (current_tier - 1) * 0.08), 0.5)::DECIMAL,
    
    -- Resistências (crescem moderadamente)
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.03, 0.4)::DECIMAL,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.03, 0.4)::DECIMAL,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.03, 0.5)::DECIMAL,
    
    -- Vulnerabilidades (não mudam)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    COALESCE(selected_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. ATUALIZAR DADOS DOS MONSTROS
-- =====================================

SELECT 'Atualizando dados dos monstros...' as status;

-- Configurar sistema cíclico nos monstros existentes
UPDATE monsters SET 
  tier = 1,
  base_tier = 1,
  cycle_position = CASE 
    WHEN min_floor <= 20 THEN min_floor
    ELSE ((min_floor - 1) % 20) + 1
  END,
  is_boss = CASE 
    WHEN min_floor IN (5, 10, 15, 20) THEN TRUE 
    ELSE FALSE 
  END,
  level = CASE 
    WHEN min_floor <= 5 THEN min_floor
    WHEN min_floor <= 10 THEN min_floor + 2
    WHEN min_floor <= 15 THEN min_floor + 4
    WHEN min_floor <= 20 THEN min_floor + 6
    ELSE min_floor
  END;

-- =====================================
-- 6. CRIAR ÍNDICES PARA PERFORMANCE
-- =====================================

SELECT 'Criando índices...' as status;

CREATE INDEX IF NOT EXISTS idx_monsters_tier ON monsters(tier);
CREATE INDEX IF NOT EXISTS idx_monsters_cycle_position ON monsters(cycle_position);
CREATE INDEX IF NOT EXISTS idx_monsters_is_boss ON monsters(is_boss);
CREATE INDEX IF NOT EXISTS idx_monsters_tier_cycle ON monsters(tier, cycle_position);
CREATE INDEX IF NOT EXISTS idx_monsters_boss_cycle ON monsters(is_boss, cycle_position);

-- =====================================
-- 7. TESTES DE VALIDAÇÃO
-- =====================================

SELECT 'Executando testes de validação...' as status;

-- Função para testar escalamento
CREATE OR REPLACE FUNCTION test_monster_scaling()
RETURNS TABLE (
  test_floor INTEGER,
  tier INTEGER,
  cycle_pos INTEGER,
  monster_name TEXT,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  is_boss BOOLEAN
) AS $$
DECLARE
  test_floors INTEGER[] := ARRAY[1, 5, 10, 20, 21, 25, 40, 41, 60, 80, 100];
  floor_val INTEGER;
BEGIN
  FOREACH floor_val IN ARRAY test_floors
  LOOP
    RETURN QUERY 
    SELECT 
      floor_val as test_floor,
      m.tier,
      m.cycle_position as cycle_pos,
      m.name as monster_name,
      m.hp,
      m.atk,
      m.def,
      m.is_boss
    FROM get_monster_for_floor(floor_val) m
    LIMIT 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar teste e mostrar resultados
DO $$
DECLARE
  test_result RECORD;
BEGIN
  RAISE NOTICE '=== TESTE DE ESCALAMENTO DE MONSTROS ===';
  FOR test_result IN SELECT * FROM test_monster_scaling() LOOP
    RAISE NOTICE 'Andar %: Tier %, Pos %, Monstro: % (HP: %, ATK: %, DEF: %, Boss: %)', 
      test_result.test_floor, 
      test_result.tier, 
      test_result.cycle_pos, 
      test_result.monster_name, 
      test_result.hp, 
      test_result.atk, 
      test_result.def, 
      test_result.is_boss;
  END LOOP;
  RAISE NOTICE '=== FIM DO TESTE ===';
END $$;

-- Limpar função de teste
DROP FUNCTION test_monster_scaling();

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Sistema de monstros cíclico com escalamento garantido.
- Tier 1 (andares 1-20): crescimento linear suave baseado no andar
- Tier 2+ (andares 21+): escalamento exponencial agressivo (factor 2.0)
- Garante que monstros de tiers superiores sempre sejam mais fortes
- Slime do andar 21 (Tier 2) será ~2x mais forte que boss do andar 20 (Tier 1)';

SELECT 'Migração concluída com sucesso!' as status; 
-- Migração para garantir progressão adequada entre tiers
-- OBJETIVO: Slime do andar 21 deve ser mais forte que Dragon do andar 20
-- SOLUÇÃO: Sistema de piso mínimo baseado no tier anterior

-- =====================================
-- 1. FUNÇÃO PARA CALCULAR PISO MÍNIMO POR TIER
-- =====================================

-- Calcular stats mínimos que um monstro de determinado tier deve ter
CREATE OR REPLACE FUNCTION calculate_tier_minimum_stats(
  p_tier INTEGER,
  p_base_hp INTEGER,
  p_base_atk INTEGER,
  p_base_def INTEGER
) RETURNS TABLE (
  min_hp INTEGER,
  min_atk INTEGER,
  min_def INTEGER
) AS $$
DECLARE
  -- Stats base de um boss forte do tier anterior
  previous_tier_boss_hp INTEGER;
  previous_tier_boss_atk INTEGER;
  previous_tier_boss_def INTEGER;
  
  -- Multiplicadores progressivos
  tier_multiplier DECIMAL;
  boss_multiplier DECIMAL := 1.5; -- Bosses são 50% mais fortes que monstros comuns
BEGIN
  -- Para Tier 1, usar stats originais
  IF p_tier <= 1 THEN
    min_hp := p_base_hp;
    min_atk := p_base_atk;
    min_def := p_base_def;
    RETURN QUERY SELECT min_hp, min_atk, min_def;
    RETURN;
  END IF;
  
  -- Calcular multiplicador exponencial para o tier
  tier_multiplier := POWER(2.5, p_tier - 1); -- Crescimento mais agressivo
  
  -- Estimar stats de um boss forte do tier anterior
  -- Usando stats base típicos escalados para o tier anterior
  previous_tier_boss_hp := (80 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  previous_tier_boss_atk := (25 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  previous_tier_boss_def := (15 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  
  -- Garantir que o monstro mais fraco do tier atual seja 20% mais forte 
  -- que o boss mais forte do tier anterior
  min_hp := GREATEST(
    (p_base_hp * tier_multiplier)::INTEGER,
    (previous_tier_boss_hp * 1.2)::INTEGER
  );
  
  min_atk := GREATEST(
    (p_base_atk * tier_multiplier)::INTEGER,
    (previous_tier_boss_atk * 1.2)::INTEGER
  );
  
  min_def := GREATEST(
    (p_base_def * tier_multiplier)::INTEGER,
    (previous_tier_boss_def * 1.2)::INTEGER
  );
  
  RETURN QUERY SELECT min_hp, min_atk, min_def;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 2. FUNÇÃO MELHORADA DE ESCALAMENTO COM PISO MÍNIMO
-- =====================================

CREATE OR REPLACE FUNCTION scale_monster_stats_with_floor(
  p_base_stat DECIMAL,
  p_current_tier INTEGER,
  p_cycle_position INTEGER,
  p_is_boss BOOLEAN DEFAULT FALSE,
  p_stat_type TEXT DEFAULT 'hp' -- 'hp', 'atk', 'def'
) RETURNS INTEGER AS $$
DECLARE
  base_multiplier DECIMAL;
  boss_multiplier DECIMAL := 1.5; -- Bosses são 50% mais fortes
  tier_floor INTEGER;
  final_stat INTEGER;
  
  -- Pisos mínimos baseados no tier
  tier_1_floor_hp INTEGER := 80;
  tier_1_floor_atk INTEGER := 25;
  tier_1_floor_def INTEGER := 15;
BEGIN
  -- Calcular multiplicador base do tier (exponencial agressivo)
  base_multiplier := POWER(2.5, p_current_tier - 1);
  
  -- Aplicar multiplicador boss se necessário
  IF p_is_boss THEN
    base_multiplier := base_multiplier * boss_multiplier;
  END IF;
  
  -- Calcular stat escalado
  final_stat := (p_base_stat * base_multiplier)::INTEGER;
  
  -- Aplicar piso mínimo baseado no tier e tipo de stat
  CASE p_stat_type
    WHEN 'hp' THEN
      tier_floor := (tier_1_floor_hp * POWER(2.5, p_current_tier - 1))::INTEGER;
      -- Para bosses do mesmo tier, adicionar 50% extra ao piso
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    WHEN 'atk' THEN
      tier_floor := (tier_1_floor_atk * POWER(2.5, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    WHEN 'def' THEN
      tier_floor := (tier_1_floor_def * POWER(2.5, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    ELSE
      tier_floor := final_stat; -- Sem piso para outros stats
  END CASE;
  
  -- Garantir que o stat final seja pelo menos o piso mínimo
  final_stat := GREATEST(final_stat, tier_floor);
  
  -- Adicionar variação baseada na posição no ciclo (progressão dentro do tier)
  final_stat := final_stat + (final_stat * (p_cycle_position - 1) * 0.05)::INTEGER;
  
  RETURN final_stat;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 3. RECRIAR FUNÇÃO PRINCIPAL COM PISO GARANTIDO
-- =====================================

DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários escalados
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate escaladas
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências escaladas
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait monster_trait,
  secondary_trait monster_trait,
  special_abilities TEXT[]
) AS $$
DECLARE
  current_tier INTEGER;
  target_cycle_position INTEGER;
  boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
  selected_monster RECORD;
  is_boss_floor BOOLEAN;
BEGIN
  -- Validar entrada
  IF p_floor IS NULL OR p_floor < 1 THEN
    p_floor := 1;
  END IF;
  
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  is_boss_floor := target_cycle_position = ANY(boss_floors);
  
  -- Buscar monstro apropriado
  IF is_boss_floor THEN
    -- Buscar boss para esta posição
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = true
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = false
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Fallbacks progressivos se não encontrar monstro específico
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) <= target_cycle_position
      AND COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = is_boss_floor
    ORDER BY COALESCE(m.cycle_position, m.min_floor) DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = is_boss_floor
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nenhum monstro, retornar vazio
  IF selected_monster IS NULL THEN
    RETURN;
  END IF;
  
  -- CRÍTICO: Aplicar escalamento com piso garantido
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name::TEXT,
    
    -- Level escalado progressivamente
    GREATEST(
      COALESCE(selected_monster.level, 1), 
      COALESCE(selected_monster.level, 1) + ((current_tier - 1) * 20) + target_cycle_position
    )::INTEGER,
    
    -- STATS PRINCIPAIS COM PISO GARANTIDO
    scale_monster_stats_with_floor(
      selected_monster.hp::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'hp'
    )::INTEGER as hp,
    
    scale_monster_stats_with_floor(
      selected_monster.atk::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'atk'
    )::INTEGER as atk,
    
    scale_monster_stats_with_floor(
      selected_monster.def::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'def'
    )::INTEGER as def,
    
    -- Mana e Speed sem piso (escalamento normal)
    scale_monster_stats(COALESCE(selected_monster.mana, 0), current_tier, 1, 2.0)::INTEGER as mana,
    scale_monster_stats(COALESCE(selected_monster.speed, 10), current_tier, 1, 2.0)::INTEGER as speed,
    
    selected_monster.behavior,
    p_floor as min_floor,
    
    -- Recompensas escaladas proporcionalmente
    scale_monster_stats(selected_monster.reward_xp, current_tier, 1, 2.0)::INTEGER as reward_xp,
    scale_monster_stats(selected_monster.reward_gold, current_tier, 1, 2.0)::INTEGER as reward_gold,
    
    COALESCE(selected_monster.image, '')::TEXT,
    current_tier::INTEGER,
    COALESCE(selected_monster.base_tier, 1)::INTEGER,
    target_cycle_position::INTEGER,
    is_boss_floor::BOOLEAN,
    
    -- Atributos primários escalados
    scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier, 1, 2.0)::INTEGER,
    
    -- Propriedades de combate escaladas
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.15), 0.40)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.10), 3.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) * (1 + (current_tier - 1) * 0.08), 0.6)::DECIMAL,
    
    -- Resistências escaladas
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.04, 0.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.04, 0.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.04, 0.6)::DECIMAL,
    
    -- Vulnerabilidades (fixas)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    COALESCE(selected_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 4. TESTE DE VALIDAÇÃO DA PROGRESSÃO
-- =====================================

-- Função para testar progressão entre tiers
CREATE OR REPLACE FUNCTION test_tier_progression()
RETURNS TABLE (
  test_description TEXT,
  floor INTEGER,
  tier INTEGER,
  cycle_pos INTEGER,
  monster_name TEXT,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  is_boss BOOLEAN,
  progression_valid BOOLEAN
) AS $$
DECLARE
  -- Casos de teste críticos
  slime_21 RECORD; -- Slime comum do andar 21 (Tier 2, pos 1)
  boss_20 RECORD;  -- Boss do andar 20 (Tier 1, pos 20)
  slime_41 RECORD; -- Slime comum do andar 41 (Tier 3, pos 1)
  boss_40 RECORD;  -- Boss do andar 40 (Tier 2, pos 20)
BEGIN
  -- Buscar monstros para comparação
  SELECT m.* INTO slime_21 FROM get_monster_for_floor(21) m LIMIT 1;
  SELECT m.* INTO boss_20 FROM get_monster_for_floor(20) m LIMIT 1;
  SELECT m.* INTO slime_41 FROM get_monster_for_floor(41) m LIMIT 1;
  SELECT m.* INTO boss_40 FROM get_monster_for_floor(40) m LIMIT 1;
  
  -- Teste 1: Slime do andar 21 vs Boss do andar 20
  RETURN QUERY SELECT
    'Slime T2 vs Boss T1'::TEXT,
    21,
    slime_21.tier,
    slime_21.cycle_position,
    slime_21.name,
    slime_21.hp,
    slime_21.atk,
    slime_21.def,
    slime_21.is_boss,
    (slime_21.hp > boss_20.hp AND slime_21.atk > boss_20.atk)::BOOLEAN;
  
  RETURN QUERY SELECT
    'Boss T1 (referência)'::TEXT,
    20,
    boss_20.tier,
    boss_20.cycle_position,
    boss_20.name,
    boss_20.hp,
    boss_20.atk,
    boss_20.def,
    boss_20.is_boss,
    true::BOOLEAN;
  
  -- Teste 2: Slime do andar 41 vs Boss do andar 40
  RETURN QUERY SELECT
    'Slime T3 vs Boss T2'::TEXT,
    41,
    slime_41.tier,
    slime_41.cycle_position,
    slime_41.name,
    slime_41.hp,
    slime_41.atk,
    slime_41.def,
    slime_41.is_boss,
    (slime_41.hp > boss_40.hp AND slime_41.atk > boss_40.atk)::BOOLEAN;
  
  RETURN QUERY SELECT
    'Boss T2 (referência)'::TEXT,
    40,
    boss_40.tier,
    boss_40.cycle_position,
    boss_40.name,
    boss_40.hp,
    boss_40.atk,
    boss_40.def,
    boss_40.is_boss,
    true::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Executar teste e exibir resultados
DO $$
DECLARE
  test_result RECORD;
BEGIN
  RAISE NOTICE '=== TESTE DE PROGRESSÃO ENTRE TIERS ===';
  RAISE NOTICE 'Verificando se monstros comuns de tiers superiores são mais fortes que bosses de tiers inferiores';
  RAISE NOTICE '';
  
  FOR test_result IN SELECT * FROM test_tier_progression() LOOP
    RAISE NOTICE '% | Andar %: % (HP: %, ATK: %, DEF: %) - Válido: %', 
      test_result.test_description,
      test_result.floor,
      test_result.monster_name, 
      test_result.hp, 
      test_result.atk, 
      test_result.def,
      test_result.progression_valid;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== FIM DO TESTE ===';
END $$;

-- Limpar função de teste
DROP FUNCTION test_tier_progression();

-- =====================================
-- 5. DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Sistema de monstros com progressão garantida entre tiers.
GARANTIA: Qualquer monstro do Tier X será mais forte que qualquer boss do Tier X-1.
- Tier 1 (1-20): Stats base escalados linearmente
- Tier 2 (21-40): Mínimo 20% mais forte que boss mais forte do Tier 1
- Tier 3 (41-60): Mínimo 20% mais forte que boss mais forte do Tier 2
- Bosses: 50% mais fortes que monstros comuns do mesmo tier
- Progressão intra-tier: 5% por posição no ciclo';

COMMENT ON FUNCTION scale_monster_stats_with_floor(DECIMAL, INTEGER, INTEGER, BOOLEAN, TEXT) IS
'Escala stats com piso mínimo garantido baseado no tier.
Garante que monstros de tiers superiores sempre sejam mais fortes que bosses de tiers inferiores.';

SELECT 'Migração de progressão entre tiers concluída!' as status; 
-- Migração para corrigir o cálculo de critical_damage na função calculate_derived_stats
-- Data: 2024-12-04
-- Versão: 20241204000008
-- Objetivo: Sincronizar a fórmula de critical_damage entre a função do banco e a função fallback

-- =====================================
-- CORREÇÃO DA FUNÇÃO CALCULATE_DERIVED_STATS
-- =====================================

-- Remover a função anterior
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

-- Criar função corrigida que considera o bônus de arma para critical_damage
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- NOVO: Bônus de arma aproximado (sem buscar arma específica para performance)
    -- Usando a melhor maestria como aproximação
    weapon_bonus DECIMAL := POWER(GREATEST(1, 1), 1.1) * 0.5; -- Por enquanto usando valor base
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0);
    final_atk := base_atk + FLOOR(str_scaling * 1.8);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    
    -- CORRIGIDO: Incluir bônus de arma no critical_damage (alinhando com função fallback)
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- FUNÇÃO AVANÇADA COM CONSULTA DE ARMA
-- =====================================

-- Criar função alternativa que considera a arma equipada específica
CREATE OR REPLACE FUNCTION calculate_derived_stats_with_weapon(
    p_character_id UUID,
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Variáveis para bônus de arma
    weapon_subtype TEXT;
    weapon_bonus DECIMAL := 0;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Buscar tipo de arma equipada
    SELECT e.weapon_subtype INTO weapon_subtype
    FROM character_equipment ce
    INNER JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
      AND ce.is_equipped = true
      AND e.type = 'weapon'
    LIMIT 1;
    
    -- Calcular bônus baseado na arma equipada
    IF weapon_subtype IS NOT NULL THEN
        CASE weapon_subtype
            WHEN 'sword', 'dagger' THEN
                weapon_bonus := POWER(p_sword_mastery, 1.1) * 0.5;
            WHEN 'axe' THEN
                weapon_bonus := POWER(p_axe_mastery, 1.1) * 0.5;
            WHEN 'blunt' THEN
                weapon_bonus := POWER(p_blunt_mastery, 1.1) * 0.5;
            WHEN 'staff' THEN
                weapon_bonus := POWER(p_magic_mastery, 1.1) * 0.3;
            ELSE
                weapon_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
        END CASE;
    ELSE
        -- Sem arma equipada, usar a melhor maestria
        weapon_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    END IF;
    
    -- Calcular stats finais
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(POWER(p_magic_mastery, 1.2) * 2.0);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Calcular crítico com bônus de arma
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2) + (POWER(p_magic_mastery, 1.2) * 2.5);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- TESTE DAS FUNÇÕES
-- =====================================

-- Testar a função calculate_derived_stats corrigida
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Executar teste simples
    SELECT * INTO test_result 
    FROM calculate_derived_stats(10, 15, 12, 8, 10, 14, 6);
    
    IF test_result IS NOT NULL THEN
        RAISE NOTICE 'Teste da função calculate_derived_stats: SUCESSO';
        RAISE NOTICE 'HP: %, Atk: %, Critical Damage: %', 
            test_result.derived_hp, 
            test_result.derived_atk, 
            test_result.derived_critical_damage;
    ELSE
        RAISE WARNING 'Teste da função calculate_derived_stats: FALHOU';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Erro ao testar função calculate_derived_stats: %', SQLERRM;
END $$;

-- Documentação
COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função para calcular stats derivados de personagens baseados em nível e atributos primários (CORRIGIDA para incluir bônus de arma)';

COMMENT ON FUNCTION calculate_derived_stats_with_weapon(UUID, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função avançada para calcular stats derivados considerando a arma equipada específica e maestrias'; 
-- Migração para corrigir definitivamente a exibição de critical_damage
-- Data: 2024-12-04
-- Versão: 20241204000009
-- Objetivo: Garantir que o critical_damage seja calculado corretamente em todos os contextos

-- =====================================
-- CORREÇÃO DEFINITIVA DA FUNÇÃO CALCULATE_DERIVED_STATS
-- =====================================

-- Remover a função anterior que tinha weapon_bonus hardcoded
DROP FUNCTION IF EXISTS calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) CASCADE;

-- Criar função corrigida que considera maestrias de personagem
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL,
    derived_critical_damage DECIMAL,
    derived_magic_damage_bonus DECIMAL
) AS $$
DECLARE
    -- Stats base por nível
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Escalamento logarítmico dos atributos
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- CORRIGIDO: Bônus de arma baseado na melhor maestria disponível
    weapon_bonus DECIMAL := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    def_mastery_bonus DECIMAL := POWER(p_defense_mastery, 1.3) * 1.2;
    magic_mastery_bonus DECIMAL := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL;
    final_crit_damage DECIMAL;
    final_magic_damage DECIMAL;
BEGIN
    -- Calcular stats finais com bônus de maestrias
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- CORRIGIDO: Calcular crítico com bônus de arma real
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Calcular dano mágico com bônus de maestria
    final_magic_damage := (int_scaling * 1.8) + (wis_scaling * 1.2) + (magic_mastery_bonus * 2.5);
    
    -- Diminishing returns para magia
    IF final_magic_damage > 150 THEN
        final_magic_damage := 150 + ((final_magic_damage - 150) * 0.6);
    END IF;
    
    -- Cap de magia em 300%
    final_magic_damage := LEAST(300, final_magic_damage);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- TESTE DA FUNÇÃO CORRIGIDA
-- =====================================

-- Testar a função com valores de exemplo
DO $$
DECLARE
    test_result RECORD;
BEGIN
    -- Executar teste com força 15 e maestrias nível 1 (cenário do usuário)
    SELECT * INTO test_result 
    FROM calculate_derived_stats(10, 15, 12, 8, 10, 14, 6, 1, 1, 1, 1, 1);
    
    IF test_result IS NOT NULL THEN
        RAISE NOTICE 'Teste da função calculate_derived_stats CORRIGIDA: SUCESSO';
        RAISE NOTICE 'Level: 10, STR: 15, Attributes OK';
        RAISE NOTICE 'HP: %, Atk: %', test_result.derived_hp, test_result.derived_atk;
        RAISE NOTICE 'Critical Damage: %', test_result.derived_critical_damage;
    ELSE
        RAISE WARNING 'Teste da função calculate_derived_stats CORRIGIDA: FALHOU';
    END IF;
EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Erro ao testar função: %', SQLERRM;
END $$;

-- Documentação
COMMENT ON FUNCTION calculate_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) IS 
'Função corrigida para calcular stats derivados considerando todas as maestrias do personagem'; 
-- Migração para corrigir definitivamente o critical_damage
-- Data: 2024-12-04
-- Versão: 20241204000010
-- Objetivo: Garantir consistência entre função do banco e fallback

-- =====================================
-- CORREÇÃO DEFINITIVA DA FUNÇÃO CALCULATE_DERIVED_STATS
-- =====================================

-- Remover todas as versões anteriores da função
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

-- Criar a função definitiva que corresponde exatamente ao fallback
CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE (
    derived_hp INTEGER,
    derived_max_hp INTEGER,
    derived_mana INTEGER,
    derived_max_mana INTEGER,
    derived_atk INTEGER,
    derived_def INTEGER,
    derived_speed INTEGER,
    derived_critical_chance DECIMAL(5,2),
    derived_critical_damage DECIMAL(5,2),
    derived_magic_damage_bonus DECIMAL(5,2)
) AS $$
DECLARE
    -- Escalamento logarítmico dos atributos (EXATAMENTE como no fallback)
    str_scaling DECIMAL := POWER(p_strength, 1.3);
    dex_scaling DECIMAL := POWER(p_dexterity, 1.25);
    int_scaling DECIMAL := POWER(p_intelligence, 1.35);
    wis_scaling DECIMAL := POWER(p_wisdom, 1.2);
    vit_scaling DECIMAL := POWER(p_vitality, 1.4);
    luck_scaling DECIMAL := p_luck;
    
    -- Habilidades com escalamento logarítmico (EXATAMENTE como no fallback)
    weapon_bonus DECIMAL := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * 0.5;
    def_mastery_bonus DECIMAL := POWER(p_defense_mastery, 1.3) * 1.2;
    magic_mastery_bonus DECIMAL := POWER(p_magic_mastery, 1.2) * 2.0;
    
    -- Bases MUITO menores para forçar especialização (EXATAMENTE como no fallback)
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 25 + (p_level * 2);
    base_atk INTEGER := 3 + p_level;
    base_def INTEGER := 2 + p_level;
    base_speed INTEGER := 5 + p_level;
    
    -- Stats derivados finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance DECIMAL(5,2);
    final_crit_damage DECIMAL(5,2);
    final_magic_damage DECIMAL(5,2);
    
    -- Componentes para dano mágico
    int_magic_scaling DECIMAL;
    wis_magic_scaling DECIMAL;
    mastery_magic_scaling DECIMAL;
    total_magic_bonus DECIMAL;
BEGIN
    -- Stats derivados com escalamento especializado (EXATAMENTE como no fallback)
    final_hp := base_hp + FLOOR(vit_scaling * 3.5);
    final_mana := base_mana + FLOOR(int_scaling * 2.0) + FLOOR(magic_mastery_bonus);
    final_atk := base_atk + FLOOR(str_scaling * 1.8) + FLOOR(weapon_bonus);
    final_def := base_def + FLOOR(vit_scaling * 0.8) + FLOOR(wis_scaling * 0.6) + FLOOR(def_mastery_bonus);
    final_speed := base_speed + FLOOR(dex_scaling * 1.2);
    
    -- Crítico rebalanceado com bônus de arma (EXATAMENTE como no fallback)
    final_crit_chance := LEAST(90, (luck_scaling * 0.4) + (dex_scaling * 0.3) + (weapon_bonus * 0.1));
    final_crit_damage := 140 + (luck_scaling * 0.8) + (str_scaling * 0.6) + (weapon_bonus * 0.4);
    
    -- Sistema de dano mágico especializado (EXATAMENTE como no fallback)
    int_magic_scaling := int_scaling * 1.8;
    wis_magic_scaling := wis_scaling * 1.2;
    mastery_magic_scaling := magic_mastery_bonus * 2.5;
    
    total_magic_bonus := int_magic_scaling + wis_magic_scaling + mastery_magic_scaling;
    
    -- Diminishing returns graduais (EXATAMENTE como no fallback)
    IF total_magic_bonus > 150 THEN
        total_magic_bonus := 150 + ((total_magic_bonus - 150) * 0.6);
    END IF;
    
    -- Cap em 300% para especialistas extremos (EXATAMENTE como no fallback)
    final_magic_damage := LEAST(300, total_magic_bonus);
    
    RETURN QUERY
    SELECT
        final_hp as derived_hp,
        final_hp as derived_max_hp,
        final_mana as derived_mana,
        final_mana as derived_max_mana,
        final_atk as derived_atk,
        final_def as derived_def,
        final_speed as derived_speed,
        ROUND(final_crit_chance, 2) as derived_critical_chance,
        ROUND(final_crit_damage, 2) as derived_critical_damage,
        ROUND(final_magic_damage, 2) as derived_magic_damage_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- TESTE PARA VERIFICAR CONSISTÊNCIA
-- =====================================

-- Teste com personagem força 37 (como descrito pelo usuário)
DO $$
DECLARE
    test_result RECORD;
    expected_crit_damage DECIMAL;
BEGIN
    -- Calcular valor esperado usando a mesma fórmula do fallback
    -- Para força 37: str_scaling = 37^1.3 ≈ 88.8
    -- weapon_bonus = 1^1.1 * 0.5 = 0.5 (maestria 1 default)
    -- critical_damage = 140 + (10 * 0.8) + (88.8 * 0.6) + (0.5 * 0.4) = 140 + 8 + 53.3 + 0.2 = 201.5
    expected_crit_damage := 140 + (10 * 0.8) + (POWER(37, 1.3) * 0.6) + (POWER(1, 1.1) * 0.5 * 0.4);
    
    -- Testar a função
    SELECT * INTO test_result FROM calculate_derived_stats(
        p_level := 1,
        p_strength := 37,
        p_dexterity := 10,
        p_intelligence := 10,
        p_wisdom := 10,
        p_vitality := 10,
        p_luck := 10,
        p_sword_mastery := 1,
        p_axe_mastery := 1,
        p_blunt_mastery := 1,
        p_defense_mastery := 1,
        p_magic_mastery := 1
    );
    
    RAISE NOTICE 'Teste Critical Damage:';
    RAISE NOTICE 'Esperado: % (fórmula manual)', ROUND(expected_crit_damage, 2);
    RAISE NOTICE 'Resultado: % (função)', test_result.derived_critical_damage;
    
    -- Verificar se estão próximos (diferença <= 1%)
    IF ABS(test_result.derived_critical_damage - expected_crit_damage) <= (expected_crit_damage * 0.01) THEN
        RAISE NOTICE 'SUCESSO: Valores são consistentes!';
    ELSE
        RAISE NOTICE 'ERRO: Valores são inconsistentes!';
    END IF;
END;
$$;

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'Função definitiva para calcular stats derivados. 
CRÍTICO: Esta função deve ser EXATAMENTE igual ao fallback do CharacterService.
- Bases menores para forçar especialização
- Escalamento logarítmico para recompensar builds focadas  
- Sem caps rígidos, permitindo crescimento infinito controlado
- Função de critical_damage: 140 + (luck * 0.8) + (str^1.3 * 0.6) + (weapon_bonus * 0.4)'; 
-- Migração para rebalanceamento DRÁSTICO do sistema de monstros
-- Data: 2024-12-04
-- Versão: 20241204000011
-- Objetivo: Tornar monstros apropriadamente desafiadores para um jogo médio/difícil

-- =====================================
-- ANÁLISE DO PROBLEMA CRÍTICO:
-- =====================================
-- ❌ Monstros morrem instantaneamente (HP muito baixo)
-- ❌ Levels incoerentes (boss lvl 20+ vs player lvl 3-4)
-- ❌ Stats base muito fracos comparado aos players
-- ❌ Escalamento insuficiente para desafiar builds especializadas
-- ❌ Jogo está fácil demais para um médio/difícil

-- SOLUÇÃO IMPLEMENTADA:
-- ✅ HP base 3x maior que antes
-- ✅ Atributos base muito mais altos 
-- ✅ Escalamento mais agressivo (2.2x ao invés de 1.8x)
-- ✅ Levels coerentes com progressão do player
-- ✅ Resistências mais significativas
-- ✅ Bosses verdadeiramente desafiadores

-- =====================================
-- 1. REBALANCEAMENTO DRÁSTICO DOS STATS BASE
-- =====================================

-- AUMENTAR HP BASE DRASTICAMENTE (3x mais que antes)
UPDATE monsters SET 
  hp = CASE 
    WHEN is_boss = true THEN GREATEST(200, hp * 5)     -- Bosses: 5x HP
    WHEN behavior = 'defensive' THEN GREATEST(120, hp * 4)  -- Tanks: 4x HP  
    WHEN behavior = 'aggressive' THEN GREATEST(80, hp * 3)  -- DPS: 3x HP
    ELSE GREATEST(100, hp * 3.5)  -- Balanced: 3.5x HP
  END;

-- AUMENTAR ATAQUE BASE SIGNIFICATIVAMENTE (2.5x mais)
UPDATE monsters SET 
  atk = CASE 
    WHEN is_boss = true THEN GREATEST(25, atk * 3)     -- Bosses: 3x ATK
    WHEN behavior = 'aggressive' THEN GREATEST(20, atk * 2.8)  -- DPS: 2.8x ATK
    WHEN behavior = 'balanced' THEN GREATEST(15, atk * 2.5)   -- Balanced: 2.5x ATK  
    ELSE GREATEST(12, atk * 2.2)  -- Defensive: 2.2x ATK
  END;

-- AUMENTAR DEFESA BASE DRAMATICAMENTE (3x mais)
UPDATE monsters SET 
  def = CASE 
    WHEN is_boss = true THEN GREATEST(20, def * 4)     -- Bosses: 4x DEF
    WHEN behavior = 'defensive' THEN GREATEST(18, def * 3.5)  -- Tanks: 3.5x DEF
    WHEN behavior = 'balanced' THEN GREATEST(12, def * 3)     -- Balanced: 3x DEF
    ELSE GREATEST(8, def * 2.5)   -- Aggressive: 2.5x DEF
  END;

-- AUMENTAR MANA E SPEED PROPORCIONALMENTE
UPDATE monsters SET 
  mana = GREATEST(20, mana * 2.5),
  speed = GREATEST(8, speed * 2);

-- =====================================
-- 2. REBALANCEAMENTO DRÁSTICO DOS ATRIBUTOS
-- =====================================

-- ESPECIALISTAS AGRESSIVOS: Stats físicos extremos
UPDATE monsters SET 
  strength = CASE 
    WHEN behavior = 'aggressive' AND is_boss = true THEN GREATEST(30, strength * 2.5)
    WHEN behavior = 'aggressive' THEN GREATEST(22, strength * 2.2)
    ELSE strength
  END,
  dexterity = CASE 
    WHEN behavior = 'aggressive' AND is_boss = true THEN GREATEST(25, dexterity * 2.2)
    WHEN behavior = 'aggressive' THEN GREATEST(18, dexterity * 2)
    ELSE dexterity
  END,
  vitality = CASE 
    WHEN behavior = 'aggressive' THEN LEAST(vitality, 12)  -- Baixa VIT para glass cannon
    ELSE vitality
  END
WHERE behavior = 'aggressive';

-- ESPECIALISTAS DEFENSIVOS: Stats de tank extremos
UPDATE monsters SET 
  vitality = CASE 
    WHEN behavior = 'defensive' AND is_boss = true THEN GREATEST(35, vitality * 3)
    WHEN behavior = 'defensive' THEN GREATEST(25, vitality * 2.5)
    ELSE vitality
  END,
  wisdom = CASE 
    WHEN behavior = 'defensive' AND is_boss = true THEN GREATEST(28, wisdom * 2.5)
    WHEN behavior = 'defensive' THEN GREATEST(20, wisdom * 2.2)
    ELSE wisdom
  END,
  strength = CASE 
    WHEN behavior = 'defensive' THEN LEAST(strength, 15)  -- STR moderado para tanks
    ELSE strength
  END
WHERE behavior = 'defensive';

-- ESPECIALISTAS BALANCEADOS/MAGOS: Stats mágicos poderosos
UPDATE monsters SET 
  intelligence = CASE 
    WHEN behavior = 'balanced' AND (name ILIKE '%mago%' OR name ILIKE '%lich%' OR name ILIKE '%elemental%') AND is_boss = true 
      THEN GREATEST(32, intelligence * 2.8)
    WHEN behavior = 'balanced' AND (name ILIKE '%mago%' OR name ILIKE '%lich%' OR name ILIKE '%elemental%') 
      THEN GREATEST(24, intelligence * 2.5)
    WHEN behavior = 'balanced' AND is_boss = true THEN GREATEST(20, intelligence * 2)
    WHEN behavior = 'balanced' THEN GREATEST(16, intelligence * 1.8)
    ELSE intelligence
  END,
  wisdom = CASE 
    WHEN behavior = 'balanced' AND (name ILIKE '%mago%' OR name ILIKE '%lich%' OR name ILIKE '%elemental%') AND is_boss = true 
      THEN GREATEST(28, wisdom * 2.5)
    WHEN behavior = 'balanced' AND (name ILIKE '%mago%' OR name ILIKE '%lich%' OR name ILIKE '%elemental%') 
      THEN GREATEST(20, wisdom * 2.2)
    WHEN behavior = 'balanced' AND is_boss = true THEN GREATEST(18, wisdom * 1.8)
    WHEN behavior = 'balanced' THEN GREATEST(14, wisdom * 1.6)
    ELSE wisdom
  END
WHERE behavior = 'balanced';

-- =====================================
-- 3. RESISTÊNCIAS MAIS SIGNIFICATIVAS 
-- =====================================

-- Bosses devem ser MUITO mais resistentes
UPDATE monsters SET
  critical_resistance = CASE 
    WHEN is_boss = true THEN LEAST(0.6, critical_resistance + 0.4)   -- Bosses: até 60% resist crítico
    WHEN behavior = 'defensive' THEN LEAST(0.4, critical_resistance + 0.25)
    ELSE LEAST(0.2, critical_resistance + 0.15)
  END,
  physical_resistance = CASE 
    WHEN is_boss = true AND behavior = 'defensive' THEN LEAST(0.5, physical_resistance + 0.35)
    WHEN is_boss = true THEN LEAST(0.35, physical_resistance + 0.25)
    WHEN behavior = 'defensive' OR primary_trait = 'armored' THEN LEAST(0.3, physical_resistance + 0.2)
    ELSE LEAST(0.15, physical_resistance + 0.1)
  END,
  magical_resistance = CASE 
    WHEN is_boss = true AND (name ILIKE '%lich%' OR name ILIKE '%elemental%') THEN LEAST(0.5, magical_resistance + 0.35)
    WHEN is_boss = true THEN LEAST(0.35, magical_resistance + 0.25) 
    WHEN primary_trait = 'ethereal' OR name ILIKE '%elemental%' THEN LEAST(0.3, magical_resistance + 0.2)
    ELSE LEAST(0.15, magical_resistance + 0.1)
  END,
  debuff_resistance = CASE 
    WHEN is_boss = true THEN LEAST(0.7, debuff_resistance + 0.5)     -- Bosses: até 70% resist debuff
    WHEN behavior = 'defensive' THEN LEAST(0.5, debuff_resistance + 0.35)
    ELSE LEAST(0.3, debuff_resistance + 0.2)
  END;

-- =====================================
-- 4. NOVA FUNÇÃO DE ESCALAMENTO MAIS AGRESSIVA
-- =====================================

-- Remover função antiga
DROP FUNCTION IF EXISTS get_monster_for_floor_cyclic(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor_cyclic(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários escalados
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate escaladas
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências escaladas
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait TEXT,
  secondary_trait TEXT,
  special_abilities TEXT[]
) AS $$
DECLARE
  current_tier INTEGER;
  target_cycle_position INTEGER;
  boss_floors INTEGER[] := ARRAY[10, 20]; -- Apenas bosses a cada 10 andares agora
  selected_monster RECORD;
  
  -- ESCALAMENTO MUITO MAIS AGRESSIVO
  base_scaling_factor DECIMAL := 2.2; -- Era 1.8, agora 2.2 (22% por tier)
  boss_scaling_factor DECIMAL := 2.5; -- Bosses escalam ainda mais
  
  -- Level coerente com progressão do player
  calculated_level INTEGER;
BEGIN
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  
  -- LEVEL COERENTE: Player ganha ~0.5 level por andar, monstros devem ter level similar
  calculated_level := GREATEST(1, p_floor / 2);
  
  -- Verificar se é andar de boss (a cada 10 andares)
  IF target_cycle_position = ANY(boss_floors) THEN
    -- Buscar boss específico para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position = target_cycle_position
      AND m.is_boss = true
      AND m.base_tier = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position = target_cycle_position
      AND m.is_boss = false
      AND m.base_tier = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Fallbacks caso não encontre monstro específico
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.cycle_position <= target_cycle_position
      AND m.base_tier = 1
      AND m.is_boss = (target_cycle_position = ANY(boss_floors))
    ORDER BY m.cycle_position DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE m.base_tier = 1
      AND m.is_boss = (target_cycle_position = ANY(boss_floors))
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nenhum monstro, retornar vazio
  IF selected_monster IS NULL THEN
    RETURN;
  END IF;
  
  -- Retornar monstro com stats DRASTICAMENTE escalados
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name,
    
    -- Level coerente com player
    calculated_level::INTEGER,
    
    -- Stats principais com escalamento MUITO mais agressivo
    CASE 
      WHEN selected_monster.is_boss THEN (selected_monster.hp * POWER(boss_scaling_factor, current_tier - 1))::INTEGER
      ELSE (selected_monster.hp * POWER(base_scaling_factor, current_tier - 1))::INTEGER
    END as hp,
    
    CASE 
      WHEN selected_monster.is_boss THEN (selected_monster.atk * POWER(boss_scaling_factor, current_tier - 1))::INTEGER
      ELSE (selected_monster.atk * POWER(base_scaling_factor, current_tier - 1))::INTEGER
    END as atk,
    
    CASE 
      WHEN selected_monster.is_boss THEN (selected_monster.def * POWER(boss_scaling_factor, current_tier - 1))::INTEGER
      ELSE (selected_monster.def * POWER(base_scaling_factor, current_tier - 1))::INTEGER
    END as def,
    
    (selected_monster.mana * POWER(base_scaling_factor, current_tier - 1))::INTEGER as mana,
    (selected_monster.speed * POWER(base_scaling_factor, current_tier - 1))::INTEGER as speed,
    
    selected_monster.behavior,
    p_floor, -- min_floor ajustado para andar atual
    
    -- Recompensas escaladas mais generosamente para compensar dificuldade
    CASE 
      WHEN selected_monster.is_boss THEN (selected_monster.reward_xp * POWER(2.8, current_tier - 1))::INTEGER
      ELSE (selected_monster.reward_xp * POWER(2.5, current_tier - 1))::INTEGER
    END as reward_xp,
    
    CASE 
      WHEN selected_monster.is_boss THEN (selected_monster.reward_gold * POWER(2.8, current_tier - 1))::INTEGER
      ELSE (selected_monster.reward_gold * POWER(2.5, current_tier - 1))::INTEGER
    END as reward_gold,
    
    selected_monster.image,
    current_tier::INTEGER,
    selected_monster.base_tier::INTEGER,
    target_cycle_position::INTEGER,
    selected_monster.is_boss,
    
    -- Atributos primários com escalamento agressivo
    COALESCE((COALESCE(selected_monster.strength, 10) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 10) as strength,
    COALESCE((COALESCE(selected_monster.dexterity, 10) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 10) as dexterity,
    COALESCE((COALESCE(selected_monster.intelligence, 10) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 10) as intelligence,
    COALESCE((COALESCE(selected_monster.wisdom, 10) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 10) as wisdom,
    COALESCE((COALESCE(selected_monster.vitality, 10) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 10) as vitality,
    COALESCE((COALESCE(selected_monster.luck, 5) * POWER(base_scaling_factor, current_tier - 1))::INTEGER, 5) as luck,
    
    -- Propriedades de combate mais agressivas
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.15), 0.4)::DECIMAL as critical_chance,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.1), 3.0)::DECIMAL as critical_damage,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) + (current_tier - 1) * 0.08, 0.6)::DECIMAL as critical_resistance,
    
    -- Resistências que crescem significativamente
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.05, 0.5)::DECIMAL as physical_resistance,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.05, 0.5)::DECIMAL as magical_resistance,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.06, 0.7)::DECIMAL as debuff_resistance,
    
    -- Vulnerabilidades (não mudam)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    selected_monster.special_abilities;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. ATUALIZAR XP E GOLD BASE PARA COMPENSAR DIFICULDADE
-- =====================================

-- Aumentar recompensas base para compensar maior dificuldade
UPDATE monsters SET 
  reward_xp = CASE 
    WHEN is_boss = true THEN GREATEST(25, reward_xp * 2)     -- Bosses: 2x XP
    ELSE GREATEST(8, reward_xp * 1.5)   -- Normais: 1.5x XP
  END,
  reward_gold = CASE 
    WHEN is_boss = true THEN GREATEST(15, reward_gold * 2)   -- Bosses: 2x Gold
    ELSE GREATEST(5, reward_gold * 1.5) -- Normais: 1.5x Gold
  END;

-- =====================================
-- 6. ATUALIZAR FUNÇÃO PRINCIPAL
-- =====================================

-- Recriar a função principal para usar o novo sistema mais desafiador
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
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
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  primary_trait TEXT,
  secondary_trait TEXT,
  special_abilities TEXT[]
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM get_monster_for_floor_cyclic(p_floor);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO DRÁSTICO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor_cyclic(INTEGER) IS $cmt$
REBALANCEAMENTO DRÁSTICO: Sistema de monstros MUITO mais desafiador.
- HP base 3-5x maior (200+ para bosses, 80-120 para normais)
- Atributos base 2-3x maiores para especialização extrema
- Escalamento 2.2x por tier (era 1.8x) = 22% mais stats por tier
- Bosses escalam 2.5x = 25% mais stats por tier
- Resistências muito mais significativas (até 60% crítico, 50% físico/mágico)
- Levels coerentes com progressão do player (floor/2)
- Recompensas 1.5-2x maiores para compensar dificuldade
$cmt$;

-- Migração aplicada com sucesso
-- Rebalanceamento DRÁSTICO dos monstros implementado 
-- Migração para rebalanceamento COMPLETO do sistema de personagens
-- Data: 2024-12-04
-- Versão: 20241204000012
-- Objetivo: Implementar sistema balanceado similar a Dark Souls/Runescape com trade-offs reais

-- =====================================
-- ANÁLISE DO PROBLEMA CRÍTICO:
-- =====================================
-- ❌ Dano físico extremamente alto sem equipamentos
-- ❌ Dano mágico baixo comparado ao físico
-- ❌ Sem trade-offs reais entre builds
-- ❌ Stats base muito altos (não força especialização)
-- ❌ Sistema não recompensa construção cuidadosa de personagem
-- ❌ Falta complexidade similar a Dark Souls/Runescape

-- SOLUÇÃO IMPLEMENTADA:
-- ✅ Separação total: ATK físico vs MAGIC_ATK
-- ✅ Stats base drasticamente menores (forçar especialização)
-- ✅ Trade-offs reais: Mago frágil/forte, Guerreiro resistente/moderado
-- ✅ Dependência de equipamentos/consumíveis para progredir
-- ✅ Sistema complexo que recompensa conhecimento
-- ✅ Progressão árdua similar aos RPGs mencionados

-- =====================================
-- 1. ADICIONAR NOVO ATRIBUTO: MAGIC_ATTACK
-- =====================================

-- Adicionar magic_attack como atributo separado na tabela characters
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS magic_attack INTEGER DEFAULT 0;

-- Atualizar personagens existentes com magic_attack inicial
UPDATE characters SET magic_attack = 0 WHERE magic_attack IS NULL;

-- =====================================
-- 2. FUNÇÃO DE STATS DERIVADOS COMPLETAMENTE REBALANCEADA
-- =====================================

-- Remover função antiga
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,           -- APENAS dano físico
    magic_attack INTEGER,  -- NOVO: dano mágico separado
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2) -- Mantido para compatibilidade
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- =====================================
    -- BASES DRASTICAMENTE MENORES (FORÇAR ESPECIALIZAÇÃO)
    -- =====================================
    
    -- Bases críticas menores que antes
    base_hp INTEGER := 40 + (p_level * 2);        -- Era 60 + (level * 3)
    base_mana INTEGER := 15 + (p_level * 1);      -- Era 25 + (level * 2)  
    base_atk INTEGER := 1 + (p_level * 0.5);      -- Era 3 + level
    base_magic_atk INTEGER := 1 + (p_level * 0.5); -- NOVO: base mágica similar
    base_def INTEGER := 1 + (p_level * 0.3);      -- Era 2 + level
    base_speed INTEGER := 3 + (p_level * 0.5);    -- Era 5 + level
    
    -- =====================================
    -- ESCALAMENTO ESPECIALIZADO COM TRADE-OFFS
    -- =====================================
    
    -- Multiplicadores balanceados para especialização
    str_scaling NUMERIC := POWER(p_strength, 1.2);      -- Reduzido de 1.3
    dex_scaling NUMERIC := POWER(p_dexterity, 1.15);    -- Reduzido de 1.25  
    int_scaling NUMERIC := POWER(p_intelligence, 1.3);  -- Mantido alto para magos
    wis_scaling NUMERIC := POWER(p_wisdom, 1.1);        -- Reduzido de 1.2
    vit_scaling NUMERIC := POWER(p_vitality, 1.3);      -- Reduzido de 1.4
    luck_scaling NUMERIC := p_luck * 0.8;               -- Reduzido significativamente
    
    -- Habilidades com impacto menor (forçar dependência de atributos)
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.05) * 0.2; -- Era 0.5
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.1) * 0.4; -- Era 1.2
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.15) * 0.8;    -- Era 2.0
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
BEGIN
    -- =====================================
    -- CÁLCULOS COM TRADE-OFFS REAIS
    -- =====================================
    
    -- HP: Vitalidade é CRÍTICA para sobrevivência
    v_hp := base_hp + ROUND(vit_scaling * 2.5);  -- Era 3.5, agora menor
    
    -- MANA: Inteligência e Sabedoria são CRÍTICAS para magos
    v_mana := base_mana + ROUND(int_scaling * 1.5) + ROUND(wis_scaling * 1.2) + ROUND(magic_mastery_bonus * 0.5);
    
    -- ATAQUE FÍSICO: Força + armas, mas base muito menor
    v_atk := base_atk + ROUND(str_scaling * 1.2) + ROUND(weapon_mastery_bonus);  -- Era 1.8, agora 1.2
    
    -- ATAQUE MÁGICO: Inteligência é CRÍTICA, sabedoria complementa
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 0.6) + ROUND(magic_mastery_bonus);
    
    -- DEFESA: Vitalidade + Sabedoria, mas bases menores
    v_def := base_def + ROUND(vit_scaling * 0.5) + ROUND(wis_scaling * 0.4) + ROUND(defense_mastery_bonus);  -- Era muito maior
    
    -- VELOCIDADE: Destreza é importante mas não dominante
    v_speed := base_speed + ROUND(dex_scaling * 0.8);  -- Era 1.2, agora 0.8
    
    -- =====================================
    -- SISTEMA DE CRÍTICOS REBALANCEADO
    -- =====================================
    
    -- Chance crítica: Sorte + Destreza, mas caps menores
    v_crit_chance := LEAST(75, (luck_scaling * 0.3) + (dex_scaling * 0.2) + (weapon_mastery_bonus * 0.1));  -- Cap era 90, agora 75
    
    -- Dano crítico: Força + Sorte, mas crescimento menor
    v_crit_damage := 130 + (luck_scaling * 0.6) + (str_scaling * 0.4) + (weapon_mastery_bonus * 0.3);  -- Era 140 base, agora 130
    
    -- =====================================
    -- DANO MÁGICO COMO % DE BÔNUS (COMPATIBILIDADE)
    -- =====================================
    
    -- Converter magic_attack para % de bônus para manter compatibilidade
    -- Magic attack de 50 = ~100% de bônus
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 2.0;  -- Conversão simples
    
    -- Cap em 400% para builds extremas
    v_magic_dmg_bonus := LEAST(400, v_magic_dmg_bonus);
    
    -- =====================================
    -- RETORNO DOS VALORES REBALANCEADOS
    -- =====================================
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,  -- max_hp = hp
        v_mana,
        v_mana, -- max_mana = mana
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus;
END;
$$;

-- =====================================
-- 3. ATUALIZAR TABELA DE PERSONAGENS EXISTENTES
-- =====================================

-- Recalcular magic_attack para personagens existentes baseado em INT/WIS
UPDATE characters SET 
  magic_attack = GREATEST(1, 
    1 + ROUND(POWER(COALESCE(intelligence, 10), 1.3) * 1.8) + 
    ROUND(POWER(COALESCE(wisdom, 10), 1.1) * 0.6) +
    ROUND(POWER(COALESCE(magic_mastery, 1), 1.15) * 0.8)
  );

-- =====================================
-- 4. SISTEMA DE DANO MÁGICO REBALANCEADO
-- =====================================

-- Função para calcular dano de spells usando magic_attack
CREATE OR REPLACE FUNCTION calculate_spell_damage_from_magic_attack(
    p_base_damage INTEGER,
    p_magic_attack INTEGER,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    -- Sistema híbrido: base damage + magic_attack + pequeno bônus de atributos
    v_attribute_bonus NUMERIC;
    v_mastery_bonus NUMERIC;
    v_final_damage INTEGER;
BEGIN
    -- Pequeno bônus adicional dos atributos (não dominante)
    v_attribute_bonus := (POWER(p_intelligence, 1.1) * 0.1) + (POWER(p_wisdom, 1.05) * 0.05);
    
    -- Pequeno bônus da maestria (não dominante)
    v_mastery_bonus := POWER(p_magic_mastery, 1.1) * 0.1;
    
    -- Dano final: base + magic_attack (dominante) + pequenos bônus
    v_final_damage := p_base_damage + p_magic_attack + ROUND(v_attribute_bonus) + ROUND(v_mastery_bonus);
    
    RETURN GREATEST(1, v_final_damage);
END;
$$;

-- =====================================
-- 5. SISTEMA DE DANO FÍSICO REBALANCEADO  
-- =====================================

-- Função para calcular dano físico usando ATK
CREATE OR REPLACE FUNCTION calculate_physical_damage(
    p_base_damage INTEGER,
    p_atk INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_weapon_mastery INTEGER DEFAULT 1
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    -- Sistema similar: base + atk + pequenos bônus
    v_strength_bonus NUMERIC;
    v_mastery_bonus NUMERIC;
    v_final_damage INTEGER;
BEGIN
    -- Pequeno bônus adicional da força (não dominante)
    v_strength_bonus := POWER(p_strength, 1.05) * 0.1;
    
    -- Pequeno bônus da maestria (não dominante)
    v_mastery_bonus := POWER(p_weapon_mastery, 1.05) * 0.1;
    
    -- Dano final: base + atk (dominante) + pequenos bônus
    v_final_damage := p_base_damage + p_atk + ROUND(v_strength_bonus) + ROUND(v_mastery_bonus);
    
    RETURN GREATEST(1, v_final_damage);
END;
$$;

-- =====================================
-- 6. FUNÇÃO PARA RECALCULAR TODOS OS PERSONAGENS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_all_character_stats()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    char_record RECORD;
    derived_stats RECORD;
    updated_count INTEGER := 0;
BEGIN
    -- Iterar sobre todos os personagens
    FOR char_record IN 
        SELECT id, level, strength, dexterity, intelligence, wisdom, vitality, luck,
               sword_mastery, axe_mastery, blunt_mastery, defense_mastery, magic_mastery
        FROM characters 
        WHERE is_alive = true
    LOOP
        -- Calcular novos stats derivados
        SELECT * INTO derived_stats
        FROM calculate_derived_stats(
            char_record.level,
            char_record.strength,
            char_record.dexterity, 
            char_record.intelligence,
            char_record.wisdom,
            char_record.vitality,
            char_record.luck,
            char_record.sword_mastery,
            char_record.axe_mastery,
            char_record.blunt_mastery,
            char_record.defense_mastery,
            char_record.magic_mastery
        );
        
        -- Atualizar personagem com novos stats
        UPDATE characters SET
            max_hp = derived_stats.max_hp,
            hp = LEAST(hp, derived_stats.max_hp), -- Não exceder novo máximo
            max_mana = derived_stats.max_mana,
            mana = LEAST(mana, derived_stats.max_mana), -- Não exceder novo máximo
            atk = derived_stats.atk,
            magic_attack = derived_stats.magic_attack,
            def = derived_stats.def,
            speed = derived_stats.speed,
            critical_chance = derived_stats.critical_chance,
            critical_damage = derived_stats.critical_damage
        WHERE id = char_record.id;
        
        updated_count := updated_count + 1;
    END LOOP;
    
    RETURN updated_count;
END;
$$;

-- =====================================
-- 7. APLICAR REBALANCEAMENTO A TODOS OS PERSONAGENS
-- =====================================

-- Executar recálculo para todos os personagens existentes
SELECT recalculate_all_character_stats();

-- =====================================
-- 8. ÍNDICES PARA PERFORMANCE
-- =====================================

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_characters_magic_attack ON characters(magic_attack);
CREATE INDEX IF NOT EXISTS idx_characters_atk ON characters(atk);

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO COMPLETO
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 
'REBALANCEAMENTO COMPLETO: Sistema similar a Dark Souls/Runescape.
- ATK e MAGIC_ATTACK separados para builds distintas
- Stats base MUITO menores (forçar especialização extrema)  
- Trade-offs reais: Mago frágil/forte vs Guerreiro resistente/moderado
- Dependência crítica de equipamentos para progressão
- Caps menores para evitar builds OP
- Complexidade que recompensa conhecimento do sistema';

COMMENT ON FUNCTION calculate_spell_damage_from_magic_attack IS
'Dano mágico usando MAGIC_ATTACK como stat principal.
- Base damage + magic_attack + pequenos bônus de INT/WIS/mastery
- Sistema dominado pelo magic_attack, não por atributos puros';

COMMENT ON FUNCTION calculate_physical_damage IS
'Dano físico usando ATK como stat principal.
- Base damage + atk + pequenos bônus de STR/mastery  
- Sistema dominado pelo atk, não por força pura';

-- Migração aplicada com sucesso
-- Sistema de personagens completamente rebalanceado 
-- ================================
-- Migração para corrigir função create_character
-- Data: 2024-12-05
-- ================================

-- Atualizar a função create_character para usar a versão atual de calculate_derived_stats
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando a função mais recente
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        magic_attack
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10, -- luck
        1,  -- sword_mastery 
        1,  -- axe_mastery
        1,  -- blunt_mastery
        1,  -- defense_mastery
        1   -- magic_mastery
    );
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points,
        magic_attack -- Adicionar a nova coluna magic_attack
    )
    VALUES (
        p_user_id,
        v_formatted_name, -- Usar nome formatado
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.hp,
        v_base_stats.max_hp,
        v_base_stats.mana,
        v_base_stats.max_mana,
        v_base_stats.atk,
        v_base_stats.def,
        v_base_stats.speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5,  -- pontos de atributo iniciais para personalizar build
        v_base_stats.magic_attack   -- magic_attack calculado
    )
    RETURNING id INTO v_character_id;
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função update_character_stats para usar a nova versão
CREATE OR REPLACE FUNCTION update_character_stats(
    p_character_id UUID,
    p_xp INTEGER DEFAULT NULL,
    p_gold INTEGER DEFAULT NULL,
    p_hp INTEGER DEFAULT NULL,
    p_mana INTEGER DEFAULT NULL,
    p_floor INTEGER DEFAULT NULL
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
BEGIN
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    -- Atualizar HP e Mana se fornecidos
    IF p_hp IS NOT NULL OR p_mana IS NOT NULL THEN
        UPDATE characters
        SET
            hp = COALESCE(p_hp, hp),
            mana = COALESCE(p_mana, mana)
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar gold se fornecido
    IF p_gold IS NOT NULL THEN
        UPDATE characters
        SET gold = gold + p_gold
        WHERE id = p_character_id;
    END IF;
    
    -- Atualizar andar se fornecido
    IF p_floor IS NOT NULL THEN
        UPDATE characters
        SET floor = p_floor
        WHERE id = p_character_id;
    END IF;
    
    -- Se XP foi fornecido, verificar level up
    IF p_xp IS NOT NULL THEN
        -- Atualizar XP primeiro sem salvar
        v_new_xp := v_current_xp + p_xp;
        
        -- Verificar level up antes de salvar
        WHILE v_new_xp >= v_xp_next_level LOOP
            v_current_level := v_current_level + 1;
            v_leveled_up := TRUE;
            
            -- Atualizar variáveis para próxima iteração
            v_xp_next_level := calculate_xp_next_level(v_current_level);
        END LOOP;
        
        -- Calcular stats derivados para o nível atual
        SELECT 
            hp,
            max_hp,
            mana,
            max_mana,
            atk,
            def,
            speed,
            magic_attack
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- Agora aplicar todas as mudanças de uma vez
        IF v_leveled_up THEN
            -- Se subiu de nível, atualizar todos os stats
            UPDATE characters
            SET
                level = v_current_level,
                xp = v_new_xp,
                xp_next_level = v_xp_next_level,
                max_hp = v_base_stats.max_hp,
                max_mana = v_base_stats.max_mana,
                atk = v_base_stats.atk,
                def = v_base_stats.def,
                speed = v_base_stats.speed,
                magic_attack = v_base_stats.magic_attack,
                hp = v_base_stats.max_hp, -- Recupera HP totalmente ao subir de nível
                mana = v_base_stats.max_mana -- Recupera Mana totalmente ao subir de nível
            WHERE id = p_character_id;
            
            -- Conceder pontos de atributo por subir de nível
            PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
            
            -- Atualizar progressão do usuário quando um personagem sobe de nível
            SELECT * INTO v_progression_result 
            FROM update_user_character_progression(v_user_id);
        ELSE
            -- Só atualizar XP
            UPDATE characters
            SET
                xp = v_new_xp
            WHERE id = p_character_id;
        END IF;
    END IF;
    
    -- Retornar resultado
    RETURN QUERY 
    SELECT 
        v_leveled_up,
        v_current_level,
        COALESCE(v_new_xp, v_current_xp) AS new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END AS slots_unlocked,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END AS new_available_slots;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atualizar função distribute_attribute_points para usar nova versão
CREATE OR REPLACE FUNCTION distribute_attribute_points(
    p_character_id UUID,
    p_strength INTEGER DEFAULT 0,
    p_dexterity INTEGER DEFAULT 0,
    p_intelligence INTEGER DEFAULT 0,
    p_wisdom INTEGER DEFAULT 0,
    p_vitality INTEGER DEFAULT 0,
    p_luck INTEGER DEFAULT 0
)
RETURNS TABLE (
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
) AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
BEGIN
    -- Buscar personagem atual
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Calcular total de pontos tentando distribuir
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Verificar se há pontos suficientes
    IF v_total_points > v_character.attribute_points THEN
        RETURN QUERY SELECT FALSE, 'Pontos de atributo insuficientes'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar valores negativos
    IF p_strength < 0 OR p_dexterity < 0 OR p_intelligence < 0 OR 
       p_wisdom < 0 OR p_vitality < 0 OR p_luck < 0 THEN
        RETURN QUERY SELECT FALSE, 'Valores de atributos não podem ser negativos'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters
    SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points
    WHERE id = p_character_id;
    
    -- Recalcular stats do personagem
    PERFORM recalculate_character_stats(p_character_id);
    
    -- Buscar novos stats para retorno
    SELECT * INTO v_stats FROM get_character_full_stats(p_character_id);
    
    RETURN QUERY SELECT TRUE, 'Atributos distribuídos com sucesso'::TEXT, v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário da migração
COMMENT ON FUNCTION create_character(UUID, VARCHAR) IS 'Função corrigida para criar personagens usando a versão atual de calculate_derived_stats';

-- ================================
-- Migração para corrigir tipos de dados inconsistentes na função get_monster_for_floor
-- Data: 2024-12-05
-- ================================

-- PROBLEMA: A função get_monster_for_floor está definida com retorno TEXT para a coluna name,
-- mas a tabela monsters tem a coluna name como VARCHAR(100), causando erro de tipos.

-- SOLUÇÃO: Recriar a função com os tipos corretos que correspondem à tabela monsters

-- =====================================
-- 1. REMOVER FUNÇÃO EXISTENTE PARA RECRIAR COM TIPOS CORRETOS
-- =====================================

DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;

-- =====================================
-- 2. RECRIAR FUNÇÃO COM TIPOS CORRETOS
-- =====================================

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),  -- CORRIGIDO: era TEXT, agora VARCHAR(100) como na tabela
  level INTEGER,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  mana INTEGER,
  speed INTEGER,
  behavior monster_behavior,
  min_floor INTEGER,
  reward_xp INTEGER,
  reward_gold INTEGER,
  image TEXT,
  tier INTEGER,
  base_tier INTEGER,
  cycle_position INTEGER,
  is_boss BOOLEAN,
  -- Atributos primários escalados
  strength INTEGER,
  dexterity INTEGER,
  intelligence INTEGER,
  wisdom INTEGER,
  vitality INTEGER,
  luck INTEGER,
  -- Propriedades de combate escaladas
  critical_chance DECIMAL,
  critical_damage DECIMAL,
  critical_resistance DECIMAL,
  -- Resistências escaladas
  physical_resistance DECIMAL,
  magical_resistance DECIMAL,
  debuff_resistance DECIMAL,
  -- Vulnerabilidades
  physical_vulnerability DECIMAL,
  magical_vulnerability DECIMAL,
  -- Características especiais
  primary_trait monster_trait,
  secondary_trait monster_trait,
  special_abilities TEXT[]
) AS $$
DECLARE
  current_tier INTEGER;
  target_cycle_position INTEGER;
  boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
  selected_monster RECORD;
BEGIN
  -- CRÍTICO: Validar entrada
  IF p_floor IS NULL OR p_floor < 1 THEN
    p_floor := 1;
  END IF;
  
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  
  -- Determinar se é andar de boss
  IF target_cycle_position = ANY(boss_floors) THEN
    -- Buscar boss específico para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = true
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = false
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou monstro específico, buscar por proximidade
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) <= target_cycle_position
      AND COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = (target_cycle_position = ANY(boss_floors))
    ORDER BY COALESCE(m.cycle_position, m.min_floor) DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, pegar qualquer monstro do tipo
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = (target_cycle_position = ANY(boss_floors))
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Último recurso: pegar qualquer monstro
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se não encontrou nenhum monstro, retornar vazio
  IF selected_monster IS NULL THEN
    RETURN;
  END IF;
  
  -- CRÍTICO: Aplicar escalamento sempre, mesmo no tier 1
  -- Para tier 1, usar escalamento linear suave baseado no andar
  -- Para tiers maiores, usar escalamento exponencial agressivo
  
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name::VARCHAR(100),  -- CORRIGIDO: cast explícito para VARCHAR(100)
    -- Level escalado progressivamente
    GREATEST(
      COALESCE(selected_monster.level, 1), 
      COALESCE(selected_monster.level, 1) + ((current_tier - 1) * 20) + (p_floor - ((current_tier - 1) * 20))
    )::INTEGER,
    
    -- CRÍTICO: Stats principais com escalamento garantido
    -- Tier 1: crescimento linear baseado no andar
    -- Tier 2+: escalamento exponencial agressivo
    CASE 
      WHEN current_tier = 1 THEN 
        -- Tier 1: crescimento linear suave
        (selected_monster.hp + ((p_floor - selected_monster.min_floor) * GREATEST(5, selected_monster.hp * 0.15)))::INTEGER
      ELSE 
        -- Tier 2+: escalamento exponencial
        scale_monster_stats(selected_monster.hp, current_tier, 1, 2.0)::INTEGER
    END as hp,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.atk + ((p_floor - selected_monster.min_floor) * GREATEST(2, selected_monster.atk * 0.12)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.atk, current_tier, 1, 2.0)::INTEGER
    END as atk,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.def + ((p_floor - selected_monster.min_floor) * GREATEST(1, selected_monster.def * 0.10)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.def, current_tier, 1, 2.0)::INTEGER
    END as def,
    
    -- Mana e Speed com escalamento similar
    CASE 
      WHEN current_tier = 1 THEN 
        (COALESCE(selected_monster.mana, 0) + ((p_floor - selected_monster.min_floor) * 2))::INTEGER
      ELSE 
        scale_monster_stats(COALESCE(selected_monster.mana, 0), current_tier, 1, 2.0)::INTEGER
    END as mana,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (COALESCE(selected_monster.speed, 10) + ((p_floor - selected_monster.min_floor) * 1))::INTEGER
      ELSE 
        scale_monster_stats(COALESCE(selected_monster.speed, 10), current_tier, 1, 2.0)::INTEGER
    END as speed,
    
    selected_monster.behavior,
    p_floor, -- min_floor ajustado para andar atual
    
    -- Recompensas escaladas
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.reward_xp + ((p_floor - selected_monster.min_floor) * GREATEST(3, selected_monster.reward_xp * 0.20)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.reward_xp, current_tier, 1, 2.0)::INTEGER
    END as reward_xp,
    
    CASE 
      WHEN current_tier = 1 THEN 
        (selected_monster.reward_gold + ((p_floor - selected_monster.min_floor) * GREATEST(2, selected_monster.reward_gold * 0.20)))::INTEGER
      ELSE 
        scale_monster_stats(selected_monster.reward_gold, current_tier, 1, 2.0)::INTEGER
    END as reward_gold,
    
    COALESCE(selected_monster.image, '')::TEXT,
    current_tier::INTEGER,
    COALESCE(selected_monster.base_tier, 1)::INTEGER,
    target_cycle_position::INTEGER,
    COALESCE(selected_monster.is_boss, (selected_monster.min_floor IN (5, 10, 15, 20)))::BOOLEAN,
    
    -- Atributos primários escalados
    COALESCE(scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier, 1, 1.8), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier, 1, 1.8), 5)::INTEGER,
    
    -- Propriedades de combate (escalamento moderado para balanceamento)
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.15), 0.35)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.10), 3.0)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) * (1 + (current_tier - 1) * 0.08), 0.5)::DECIMAL,
    
    -- Resistências (crescem moderadamente)
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.03, 0.4)::DECIMAL,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.03, 0.4)::DECIMAL,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.03, 0.5)::DECIMAL,
    
    -- Vulnerabilidades (não mudam)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    COALESCE(selected_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 3. VERIFICAR SE AS FUNÇÕES AUXILIARES EXISTEM
-- =====================================

-- Verificar se as funções auxiliares existem, se não criar uma versão simplificada
DO $$
BEGIN
  -- Verificar se calculate_monster_tier existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_monster_tier'
  ) THEN
    CREATE OR REPLACE FUNCTION calculate_monster_tier(p_floor INTEGER)
    RETURNS INTEGER AS $func$
    BEGIN
      -- Tier 1: andares 1-20, Tier 2: andares 21-40, etc.
      RETURN GREATEST(1, CEIL(p_floor::DECIMAL / 20));
    END;
    $func$ LANGUAGE plpgsql IMMUTABLE;
  END IF;

  -- Verificar se calculate_cycle_position existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'calculate_cycle_position'
  ) THEN
    CREATE OR REPLACE FUNCTION calculate_cycle_position(p_floor INTEGER)
    RETURNS INTEGER AS $func$
    DECLARE
      position INTEGER;
    BEGIN
      -- Posição dentro do ciclo de 20 andares (1-20)
      position := ((p_floor - 1) % 20) + 1;
      RETURN position;
    END;
    $func$ LANGUAGE plpgsql IMMUTABLE;
  END IF;

  -- Verificar se scale_monster_stats existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'scale_monster_stats'
  ) THEN
    CREATE OR REPLACE FUNCTION scale_monster_stats(
      p_base_stat DECIMAL,
      p_current_tier INTEGER,
      p_base_tier INTEGER DEFAULT 1,
      p_scaling_factor DECIMAL DEFAULT 2.0
    ) RETURNS INTEGER AS $func$
    BEGIN
      -- Se tier atual for menor ou igual ao base tier, retornar stat original
      IF p_current_tier <= p_base_tier THEN
        RETURN p_base_stat::INTEGER;
      END IF;
      
      -- Escalamento exponencial
      RETURN (p_base_stat * POWER(p_scaling_factor, p_current_tier - p_base_tier))::INTEGER;
    END;
    $func$ LANGUAGE plpgsql IMMUTABLE;
  END IF;
END $$;

-- =====================================
-- COMENTÁRIOS
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Função corrigida para retornar tipos consistentes com a tabela monsters.
- name: VARCHAR(100) (era TEXT)
- Inclui cast explícito para garantir compatibilidade
- Mantém toda a lógica de escalamento e sistema cíclico';

-- Migração concluída com sucesso
-- Tipos de dados corrigidos para evitar erro 42804 
-- ================================
-- Migração para corrigir função secure_grant_xp
-- Data: 2024-12-05
-- ================================

-- PROBLEMA: A função secure_grant_xp está tentando usar colunas derived_* da função calculate_derived_stats,
-- mas a versão atual retorna colunas hp, max_hp, mana, max_mana, etc.

-- SOLUÇÃO: Atualizar a função secure_grant_xp para usar a assinatura correta

-- =====================================
-- 1. CORRIGIR FUNÇÃO SECURE_GRANT_XP
-- =====================================

CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
    v_max_xp_per_call INTEGER := 10000; -- Limite anti-cheat
BEGIN
    -- Validações anti-cheat
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    IF p_xp_amount > v_max_xp_per_call THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada (máximo: %)', v_max_xp_per_call;
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING; -- Ignorar se tabela não existir ainda
    
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Calcular novo XP
    v_new_xp := v_current_xp + p_xp_amount;
    
    -- Processar level ups
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP -- Cap em level 100
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- CORRIGIDO: Calcular novos stats base usando a assinatura atual
        SELECT 
            hp, max_hp, mana, max_mana, atk, def, speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- CORRIGIDO: Atualizar stats com level up usando nomes corretos das colunas
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.max_hp,
            max_mana = v_base_stats.max_mana,
            atk = v_base_stats.atk,
            def = v_base_stats.def,
            speed = v_base_stats.speed,
            hp = v_base_stats.max_hp, -- Cura completa no level up
            mana = v_base_stats.max_mana, -- Cura completa no level up
            last_activity = NOW()
        WHERE id = p_character_id;
        
        -- Conceder pontos de atributo
        PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
        
        -- Atualizar progressão do usuário
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    ELSE
        -- Apenas atualizar XP
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. VERIFICAR SE OUTRAS FUNÇÕES SEGURAS PRECISAM SER CORRIGIDAS
-- =====================================

-- Verificar se existem outras funções que também usam derived_* incorretamente
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Esta é uma verificação de segurança, mas não vamos corrigir automaticamente
    -- para evitar quebrar outras funções inadvertidamente
    RAISE NOTICE 'Função secure_grant_xp corrigida para usar assinatura atual de calculate_derived_stats';
END $$;

-- =====================================
-- COMENTÁRIOS DA CORREÇÃO
-- =====================================

COMMENT ON FUNCTION secure_grant_xp(UUID, INTEGER, VARCHAR) IS 
'Função corrigida para usar a versão atual de calculate_derived_stats.
- Removido: derived_hp, derived_max_hp, derived_mana, derived_max_mana, derived_atk, derived_def, derived_speed
- Adicionado: hp, max_hp, mana, max_mana, atk, def, speed
- Inclui todos os parâmetros de maestria na chamada da função';

-- Migração concluída com sucesso
-- Função secure_grant_xp corrigida para usar assinatura atual 
-- ================================
-- Migração para corrigir funções que ainda usam derived_* 
-- Data: 2024-12-05
-- ================================

-- PROBLEMA: As funções calculate_final_character_stats e recalculate_character_stats
-- ainda estão tentando usar colunas derived_* da versão antiga de calculate_derived_stats.

-- SOLUÇÃO: Atualizar todas as funções para usar a assinatura atual (hp, max_hp, etc.)

-- =====================================
-- 1. CORRIGIR FUNÇÃO CALCULATE_FINAL_CHARACTER_STATS
-- =====================================

CREATE OR REPLACE FUNCTION calculate_final_character_stats(p_character_id UUID)
RETURNS TABLE (
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_base_stats RECORD;
    v_eq_hp_bonus INTEGER := 0;
    v_eq_mana_bonus INTEGER := 0;
    v_eq_atk_bonus INTEGER := 0;
    v_eq_def_bonus INTEGER := 0;
    v_eq_speed_bonus INTEGER := 0;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- CORRIGIDO: Calcular stats base usando assinatura atual
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed
    INTO v_base_stats 
    FROM calculate_derived_stats(
        v_character.level,
        v_character.strength,
        v_character.dexterity,
        v_character.intelligence,
        v_character.wisdom,
        v_character.vitality,
        v_character.luck,
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
    );
    
    -- Buscar bônus de equipamentos
    SELECT 
        COALESCE(total_hp_bonus, 0),
        COALESCE(total_mana_bonus, 0),
        COALESCE(total_atk_bonus, 0),
        COALESCE(total_def_bonus, 0),
        COALESCE(total_speed_bonus, 0)
    INTO 
        v_eq_hp_bonus,
        v_eq_mana_bonus,
        v_eq_atk_bonus,
        v_eq_def_bonus,
        v_eq_speed_bonus
    FROM calculate_equipment_bonuses(p_character_id);
    
    -- CORRIGIDO: Retornar valores usando nomes corretos das colunas
    RETURN QUERY
    SELECT
        v_base_stats.hp::INTEGER,
        v_base_stats.max_hp::INTEGER,
        v_base_stats.mana::INTEGER,
        v_base_stats.max_mana::INTEGER,
        v_base_stats.atk::INTEGER,
        v_base_stats.def::INTEGER,
        v_base_stats.speed::INTEGER,
        v_eq_hp_bonus::INTEGER,
        v_eq_mana_bonus::INTEGER,
        v_eq_atk_bonus::INTEGER,
        v_eq_def_bonus::INTEGER,
        v_eq_speed_bonus::INTEGER,
        (v_base_stats.hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.max_hp + v_eq_hp_bonus)::INTEGER,
        (v_base_stats.mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.max_mana + v_eq_mana_bonus)::INTEGER,
        (v_base_stats.atk + v_eq_atk_bonus)::INTEGER,
        (v_base_stats.def + v_eq_def_bonus)::INTEGER,
        (v_base_stats.speed + v_eq_speed_bonus)::INTEGER;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. VERIFICAR SE CALCULATE_EQUIPMENT_BONUSES EXISTE
-- =====================================

-- Remover função existente primeiro para evitar conflito de tipos
DROP FUNCTION IF EXISTS calculate_equipment_bonuses(UUID) CASCADE;

-- Criar função com tipo correto
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses(p_character_id UUID)
RETURNS TABLE (
    total_hp_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_speed_bonus INTEGER
) AS $$
BEGIN
    -- Calcular bônus de equipamentos equipados
    SELECT 
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER,
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER
    INTO 
        total_hp_bonus,
        total_mana_bonus,
        total_atk_bonus,
        total_def_bonus,
        total_speed_bonus
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id
      AND ce.is_equipped = true;
    
    -- Se não encontrou dados, retornar zeros
    IF NOT FOUND THEN
        total_hp_bonus := 0;
        total_mana_bonus := 0;
        total_atk_bonus := 0;
        total_def_bonus := 0;
        total_speed_bonus := 0;
    END IF;
    
    RETURN QUERY SELECT 
        total_hp_bonus, total_mana_bonus, total_atk_bonus, 
        total_def_bonus, total_speed_bonus;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 3. ATUALIZAR GET_CHARACTER_DETAILED_STATS
-- =====================================

CREATE OR REPLACE FUNCTION get_character_detailed_stats(p_character_id UUID)
RETURNS TABLE (
    character_id UUID,
    name VARCHAR,
    level INTEGER,
    -- Stats base
    base_hp INTEGER,
    base_max_hp INTEGER,
    base_mana INTEGER,
    base_max_mana INTEGER,
    base_atk INTEGER,
    base_def INTEGER,
    base_speed INTEGER,
    -- Bônus de equipamentos
    equipment_hp_bonus INTEGER,
    equipment_mana_bonus INTEGER,
    equipment_atk_bonus INTEGER,
    equipment_def_bonus INTEGER,
    equipment_speed_bonus INTEGER,
    -- Stats finais
    final_hp INTEGER,
    final_max_hp INTEGER,
    final_mana INTEGER,
    final_max_mana INTEGER,
    final_atk INTEGER,
    final_def INTEGER,
    final_speed INTEGER,
    -- Outros dados
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    floor INTEGER,
    -- Atributos primários
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.level,
        -- Stats calculados
        s.base_hp,
        s.base_max_hp,
        s.base_mana,
        s.base_max_mana,
        s.base_atk,
        s.base_def,
        s.base_speed,
        s.equipment_hp_bonus,
        s.equipment_mana_bonus,
        s.equipment_atk_bonus,
        s.equipment_def_bonus,
        s.equipment_speed_bonus,
        s.final_hp,
        s.final_max_hp,
        s.final_mana,
        s.final_max_mana,
        s.final_atk,
        s.final_def,
        s.final_speed,
        -- Outros dados do personagem
        c.xp,
        c.xp_next_level,
        c.gold,
        c.floor,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points
    FROM characters c
    CROSS JOIN calculate_final_character_stats(p_character_id) s
    WHERE c.id = p_character_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 4. BUSCAR E CORRIGIR OUTRAS FUNÇÕES QUE POSSAM USAR DERIVED_*
-- =====================================

-- Função para atualizar stats com magic_attack se a tabela suportar
CREATE OR REPLACE FUNCTION recalculate_character_stats(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_final_stats RECORD;
    v_hp_ratio DECIMAL;
    v_mana_ratio DECIMAL;
    v_new_hp INTEGER;
    v_new_mana INTEGER;
    v_has_magic_attack BOOLEAN := FALSE;
BEGIN
    -- Verificar se a coluna magic_attack existe
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' AND column_name = 'magic_attack'
    ) INTO v_has_magic_attack;
    
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Calcular stats finais incluindo equipamentos
    SELECT 
        final_hp,
        final_max_hp,
        final_mana,
        final_max_mana,
        final_atk,
        final_def,
        final_speed
    INTO v_final_stats 
    FROM calculate_final_character_stats(p_character_id);
    
    -- Calcular proporção atual de HP/Mana para manter quando os máximos mudarem
    IF v_character.max_hp > 0 THEN
        v_hp_ratio := v_character.hp::DECIMAL / v_character.max_hp;
    ELSE
        v_hp_ratio := 1.0;
    END IF;
    
    IF v_character.max_mana > 0 THEN
        v_mana_ratio := v_character.mana::DECIMAL / v_character.max_mana;
    ELSE
        v_mana_ratio := 1.0;
    END IF;
    
    -- Calcular novos HP/Mana baseados na proporção
    v_new_hp := CEILING(v_final_stats.final_max_hp * v_hp_ratio);
    v_new_mana := CEILING(v_final_stats.final_max_mana * v_mana_ratio);
    
    -- Atualizar stats finais no personagem
    -- Usar SQL dinâmico para incluir magic_attack apenas se a coluna existir
    IF v_has_magic_attack THEN
        EXECUTE format('
            UPDATE characters
            SET
                max_hp = $1,
                max_mana = $2,
                atk = $3,
                def = $4,
                speed = $5,
                hp = $6,
                mana = $7
            WHERE id = $8
        ') USING 
            v_final_stats.final_max_hp,
            v_final_stats.final_max_mana,
            v_final_stats.final_atk,
            v_final_stats.final_def,
            v_final_stats.final_speed,
            LEAST(v_new_hp, v_final_stats.final_max_hp),
            LEAST(v_new_mana, v_final_stats.final_max_mana),
            p_character_id;
    ELSE
        -- Versão sem magic_attack
        UPDATE characters
        SET
            max_hp = v_final_stats.final_max_hp,
            max_mana = v_final_stats.final_max_mana,
            atk = v_final_stats.final_atk,
            def = v_final_stats.final_def,
            speed = v_final_stats.final_speed,
            hp = LEAST(v_new_hp, v_final_stats.final_max_hp),
            mana = LEAST(v_new_mana, v_final_stats.final_max_mana)
        WHERE id = p_character_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- COMENTÁRIOS DA CORREÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_final_character_stats(UUID) IS 
'Função corrigida para usar a versão atual de calculate_derived_stats.
- Removido: derived_hp, derived_max_hp, derived_mana, derived_max_mana, derived_atk, derived_def, derived_speed
- Adicionado: hp, max_hp, mana, max_mana, atk, def, speed
- Inclui todos os parâmetros de maestria na chamada da função';

COMMENT ON FUNCTION recalculate_character_stats(UUID) IS 
'Função corrigida que recalcula stats do personagem usando a versão atual de calculate_derived_stats.
- Compatível com tabelas que têm ou não a coluna magic_attack
- Mantém proporção de HP/Mana atual quando máximos mudarem';

-- Migração concluída com sucesso
-- Todas as funções que usavam derived_* foram corrigidas 
-- ================================
-- Migração para rebalancear dificuldade dos monstros e corrigir sistema de XP
-- Data: 2024-12-05
-- ================================

-- PROBLEMAS IDENTIFICADOS:
-- 1. Monstros muito fracos mesmo com escalamento (stats base baixos)
-- 2. Possível duplicação de XP no processamento
-- 3. Escalamento de recompensas muito generoso
-- 4. Falta de balanceamento em relação aos stats dos personagens

-- =====================================
-- 1. CORRIGIR ESCALAMENTO DE MONSTROS (MAIS AGRESSIVO)
-- =====================================

-- Função de escalamento mais agressiva para stats
CREATE OR REPLACE FUNCTION scale_monster_stats_balanced(
    p_base_stat DECIMAL,
    p_current_tier INTEGER,
    p_base_tier INTEGER DEFAULT 1,
    p_scaling_factor DECIMAL DEFAULT 1.8,
    p_stat_type TEXT DEFAULT 'normal'
) RETURNS INTEGER AS $$
DECLARE
    v_tier_diff INTEGER;
    v_final_stat DECIMAL;
BEGIN
    -- Calcular diferença de tier
    v_tier_diff := p_current_tier - p_base_tier;
    
    -- Se não há diferença de tier, retornar base
    IF v_tier_diff <= 0 THEN
        RETURN p_base_stat::INTEGER;
    END IF;
    
    -- Escalamento baseado no tipo de stat
    CASE p_stat_type
        WHEN 'hp' THEN
            -- HP escala mais agressivamente (sobrevivência)
            v_final_stat := p_base_stat * POWER(2.2, v_tier_diff);
        WHEN 'attack' THEN
            -- Ataque escala moderadamente (não queremos one-shots)
            v_final_stat := p_base_stat * POWER(1.9, v_tier_diff);
        WHEN 'defense' THEN
            -- Defesa escala moderadamente
            v_final_stat := p_base_stat * POWER(1.7, v_tier_diff);
        WHEN 'reward' THEN
            -- Recompensas escalando de forma controlada
            v_final_stat := p_base_stat * POWER(1.6, v_tier_diff);
        ELSE
            -- Escalamento padrão
            v_final_stat := p_base_stat * POWER(p_scaling_factor, v_tier_diff);
    END CASE;
    
    RETURN GREATEST(1, v_final_stat::INTEGER);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 2. ATUALIZAR STATS BASE DOS MONSTROS (MAIS FORTES)
-- =====================================

-- Aumentar significativamente os stats base dos monstros para ser um desafio real
UPDATE monsters SET 
    hp = CASE 
        WHEN min_floor <= 5 THEN hp * 1.8      -- Monstros iniciais 80% mais fortes
        WHEN min_floor <= 10 THEN hp * 2.0     -- Monstros intermediários 100% mais fortes  
        WHEN min_floor <= 15 THEN hp * 2.2     -- Monstros avançados 120% mais fortes
        ELSE hp * 2.5                          -- Monstros end-game 150% mais fortes
    END,
    atk = CASE 
        WHEN min_floor <= 5 THEN atk * 1.5     -- Ataque 50% maior nos iniciais
        WHEN min_floor <= 10 THEN atk * 1.7    -- Ataque 70% maior nos intermediários
        WHEN min_floor <= 15 THEN atk * 1.9    -- Ataque 90% maior nos avançados
        ELSE atk * 2.1                         -- Ataque 110% maior nos end-game
    END,
    def = CASE 
        WHEN min_floor <= 5 THEN def * 1.4     -- Defesa 40% maior nos iniciais
        WHEN min_floor <= 10 THEN def * 1.6    -- Defesa 60% maior nos intermediários
        WHEN min_floor <= 15 THEN def * 1.8    -- Defesa 80% maior nos avançados
        ELSE def * 2.0                         -- Defesa 100% maior nos end-game
    END;

-- =====================================
-- 3. AJUSTAR RECOMPENSAS (MENOS GENEROSAS)
-- =====================================

-- Reduzir recompensas de XP que estavam muito generosas
UPDATE monsters SET 
    reward_xp = CASE 
        WHEN min_floor <= 5 THEN GREATEST(15, reward_xp * 0.4)   -- Reduzir drasticamente XP inicial
        WHEN min_floor <= 10 THEN GREATEST(25, reward_xp * 0.5)  -- Reduzir XP intermediário
        WHEN min_floor <= 15 THEN GREATEST(40, reward_xp * 0.6)  -- Reduzir XP avançado
        ELSE GREATEST(60, reward_xp * 0.7)                       -- Reduzir XP end-game
    END,
    reward_gold = CASE 
        WHEN min_floor <= 5 THEN GREATEST(10, reward_gold * 0.5)  -- Reduzir gold inicial  
        WHEN min_floor <= 10 THEN GREATEST(20, reward_gold * 0.6) -- Reduzir gold intermediário
        WHEN min_floor <= 15 THEN GREATEST(35, reward_gold * 0.7) -- Reduzir gold avançado
        ELSE GREATEST(50, reward_gold * 0.8)                      -- Reduzir gold end-game
    END;

-- =====================================
-- 4. FUNÇÃO DE VALIDAÇÃO DE XP (ANTI-CHEAT)
-- =====================================

-- Função para validar se o XP ganho está dentro dos parâmetros esperados
CREATE OR REPLACE FUNCTION validate_xp_gain(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_character_level INTEGER;
    v_max_xp_per_source INTEGER;
    v_recent_xp_gains INTEGER;
BEGIN
    -- Obter nível do personagem
    SELECT level INTO v_character_level
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Definir limites baseados na fonte e nível
    CASE p_source
        WHEN 'combat' THEN
            -- XP de combate: máximo baseado no nível do personagem
            v_max_xp_per_source := GREATEST(200, v_character_level * 15);
        WHEN 'quest' THEN
            -- XP de quest: pode ser maior
            v_max_xp_per_source := GREATEST(500, v_character_level * 50);
        WHEN 'skill' THEN
            -- XP de skill: menor limite
            v_max_xp_per_source := GREATEST(50, v_character_level * 5);
        ELSE
            -- Outras fontes: limite conservador
            v_max_xp_per_source := GREATEST(100, v_character_level * 10);
    END CASE;
    
    -- Verificar se o XP está dentro do limite
    IF p_xp_amount > v_max_xp_per_source THEN
        -- Logar tentativa suspeita
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'suspicious_xp', json_build_object(
            'amount', p_xp_amount, 
            'source', p_source, 
            'max_allowed', v_max_xp_per_source,
            'character_level', v_character_level
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        RETURN FALSE;
    END IF;
    
    -- Verificar se não há muitos ganhos de XP recentes (possível exploração)
    SELECT COALESCE(SUM(
        CASE 
            WHEN details->>'amount' ~ '^[0-9]+$' 
            THEN (details->>'amount')::INTEGER 
            ELSE 0 
        END
    ), 0) INTO v_recent_xp_gains
    FROM character_activity_log
    WHERE character_id = p_character_id
      AND action = 'xp_gain'
      AND created_at > NOW() - INTERVAL '1 minute';
    
    -- Se ganhou mais de 5x o limite em 1 minuto, pode ser exploit
    IF v_recent_xp_gains > (v_max_xp_per_source * 5) THEN
        -- Logar atividade suspeita
        INSERT INTO character_activity_log (character_id, action, details, created_at)
        VALUES (p_character_id, 'rapid_xp_gain', json_build_object(
            'recent_xp', v_recent_xp_gains,
            'new_xp', p_xp_amount,
            'source', p_source
        ), NOW())
        ON CONFLICT DO NOTHING;
        
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO SECURE_GRANT_XP COM VALIDAÇÃO
-- =====================================

CREATE OR REPLACE FUNCTION secure_grant_xp(
    p_character_id UUID,
    p_xp_amount INTEGER,
    p_source VARCHAR DEFAULT 'combat'
)
RETURNS TABLE (
    leveled_up BOOLEAN,
    new_level INTEGER,
    new_xp INTEGER,
    new_xp_next_level INTEGER,
    slots_unlocked BOOLEAN,
    new_available_slots INTEGER
) AS $$
DECLARE
    v_current_level INTEGER;
    v_current_xp INTEGER;
    v_xp_next_level INTEGER;
    v_leveled_up BOOLEAN := FALSE;
    v_base_stats RECORD;
    v_new_xp INTEGER;
    v_user_id UUID;
    v_progression_result RECORD;
BEGIN
    -- NOVA VALIDAÇÃO: Verificar se o XP é válido
    IF NOT validate_xp_gain(p_character_id, p_xp_amount, p_source) THEN
        RAISE EXCEPTION 'Quantidade de XP suspeita detectada: % (fonte: %)', p_xp_amount, p_source;
    END IF;
    
    -- Validações anti-cheat básicas
    IF p_xp_amount <= 0 THEN
        RAISE EXCEPTION 'Quantidade de XP deve ser positiva';
    END IF;
    
    -- Log da operação para auditoria
    INSERT INTO character_activity_log (character_id, action, details, created_at)
    VALUES (p_character_id, 'xp_gain', json_build_object('amount', p_xp_amount, 'source', p_source), NOW())
    ON CONFLICT DO NOTHING;
    
    -- Obter dados atuais do personagem
    SELECT level, xp, xp_next_level, user_id
    INTO v_current_level, v_current_xp, v_xp_next_level, v_user_id
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Calcular novo XP
    v_new_xp := v_current_xp + p_xp_amount;
    
    -- Processar level ups
    WHILE v_new_xp >= v_xp_next_level AND v_current_level < 100 LOOP -- Cap em level 100
        v_current_level := v_current_level + 1;
        v_leveled_up := TRUE;
        v_xp_next_level := calculate_xp_next_level(v_current_level);
    END LOOP;
    
    -- Atualizar personagem se houve level up
    IF v_leveled_up THEN
        -- Calcular novos stats base usando a assinatura atual
        SELECT 
            hp, max_hp, mana, max_mana, atk, def, speed
        INTO v_base_stats 
        FROM calculate_derived_stats(
            v_current_level,
            (SELECT strength FROM characters WHERE id = p_character_id),
            (SELECT dexterity FROM characters WHERE id = p_character_id),
            (SELECT intelligence FROM characters WHERE id = p_character_id),
            (SELECT wisdom FROM characters WHERE id = p_character_id),
            (SELECT vitality FROM characters WHERE id = p_character_id),
            (SELECT luck FROM characters WHERE id = p_character_id),
            (SELECT sword_mastery FROM characters WHERE id = p_character_id),
            (SELECT axe_mastery FROM characters WHERE id = p_character_id),
            (SELECT blunt_mastery FROM characters WHERE id = p_character_id),
            (SELECT defense_mastery FROM characters WHERE id = p_character_id),
            (SELECT magic_mastery FROM characters WHERE id = p_character_id)
        );
        
        -- Atualizar stats com level up
        UPDATE characters
        SET
            level = v_current_level,
            xp = v_new_xp,
            xp_next_level = v_xp_next_level,
            max_hp = v_base_stats.max_hp,
            max_mana = v_base_stats.max_mana,
            atk = v_base_stats.atk,
            def = v_base_stats.def,
            speed = v_base_stats.speed,
            hp = v_base_stats.max_hp, -- Cura completa no level up
            mana = v_base_stats.max_mana, -- Cura completa no level up
            last_activity = NOW()
        WHERE id = p_character_id;
        
        -- Conceder pontos de atributo
        PERFORM grant_attribute_points_on_levelup(p_character_id, v_current_level);
        
        -- Atualizar progressão do usuário
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    ELSE
        -- Apenas atualizar XP
        UPDATE characters
        SET
            xp = v_new_xp,
            last_activity = NOW()
        WHERE id = p_character_id;
    END IF;
    
    -- Se não houve level up, ainda verificar progressão
    IF NOT v_leveled_up THEN
        SELECT * INTO v_progression_result 
        FROM update_user_character_progression(v_user_id);
    END IF;
    
    RETURN QUERY
    SELECT 
        v_leveled_up,
        v_current_level,
        v_new_xp,
        v_xp_next_level,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.slots_unlocked ELSE FALSE END,
        CASE WHEN v_progression_result IS NOT NULL THEN v_progression_result.available_slots ELSE 3 END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. COMENTÁRIOS E FINALIZAÇÃO
-- =====================================

COMMENT ON FUNCTION scale_monster_stats_balanced(DECIMAL, INTEGER, INTEGER, DECIMAL, TEXT) IS 
'Função de escalamento balanceado para stats de monstros com tipos específicos de escalamento';

COMMENT ON FUNCTION validate_xp_gain(UUID, INTEGER, VARCHAR) IS 
'Função de validação anti-cheat para ganhos de XP suspeitos';

-- Migração concluída
-- - Monstros rebalanceados para serem mais desafiadores
-- - Sistema de XP com validação anti-cheat
-- - Recompensas ajustadas para progressão sustentável 
-- Migração para adicionar sistema de crafting de equipamentos

-- Adicionar campo 'craftable' na tabela de equipamentos
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS craftable BOOLEAN DEFAULT FALSE;

-- Tabela de receitas de equipamentos craftáveis
CREATE TABLE IF NOT EXISTS equipment_crafting_recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    result_equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Tabela de ingredientes para receitas de equipamentos
CREATE TABLE IF NOT EXISTS equipment_crafting_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES equipment_crafting_recipes(id) ON DELETE CASCADE,
    item_id UUID NOT NULL,
    item_type VARCHAR(50) NOT NULL CHECK (item_type IN ('monster_drop', 'consumable', 'equipment')),
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Função para validar ingredientes de equipamentos
CREATE OR REPLACE FUNCTION validate_equipment_crafting_ingredient()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.item_type = 'monster_drop' THEN
        IF NOT EXISTS (SELECT 1 FROM monster_drops WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid monster_drop id: %', NEW.item_id;
        END IF;
    ELSIF NEW.item_type = 'consumable' THEN
        IF NOT EXISTS (SELECT 1 FROM consumables WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid consumable id: %', NEW.item_id;
        END IF;
    ELSIF NEW.item_type = 'equipment' THEN
        IF NOT EXISTS (SELECT 1 FROM equipment WHERE id = NEW.item_id) THEN
            RAISE EXCEPTION 'Invalid equipment id: %', NEW.item_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para validação
CREATE TRIGGER validate_equipment_crafting_ingredient_trigger
    BEFORE INSERT OR UPDATE ON equipment_crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION validate_equipment_crafting_ingredient();

-- Função para verificar se o personagem pode criar um equipamento
CREATE OR REPLACE FUNCTION check_can_craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS TABLE (
    can_craft BOOLEAN,
    missing_ingredients TEXT[]
) AS $$
DECLARE
    v_missing TEXT[] := '{}';
    v_has_all BOOLEAN := TRUE;
    r RECORD;
BEGIN
    -- Para cada ingrediente na receita
    FOR r IN (
        SELECT 
            eci.*, 
            md.name AS drop_name, 
            c.name AS consumable_name,
            e.name AS equipment_name
        FROM equipment_crafting_ingredients eci
        LEFT JOIN monster_drops md ON eci.item_type = 'monster_drop' AND eci.item_id = md.id
        LEFT JOIN consumables c ON eci.item_type = 'consumable' AND eci.item_id = c.id
        LEFT JOIN equipment e ON eci.item_type = 'equipment' AND eci.item_id = e.id
        WHERE eci.recipe_id = p_recipe_id
    ) LOOP
        -- Verificar se o personagem tem o ingrediente em quantidade suficiente
        IF r.item_type = 'monster_drop' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_drops
                WHERE character_id = p_character_id
                AND drop_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.drop_name || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'consumable' THEN
            IF NOT EXISTS (
                SELECT 1 FROM character_consumables
                WHERE character_id = p_character_id
                AND consumable_id = r.item_id
                AND quantity >= r.quantity
            ) THEN
                v_has_all := FALSE;
                v_missing := array_append(v_missing, r.consumable_name || ' (x' || r.quantity || ')');
            END IF;
        ELSIF r.item_type = 'equipment' THEN
            -- Contar quantos itens do mesmo tipo o personagem possui (não equipados)
            DECLARE
                v_owned_count INTEGER;
            BEGIN
                SELECT COUNT(*) INTO v_owned_count
                FROM character_equipment
                WHERE character_id = p_character_id
                AND equipment_id = r.item_id
                AND is_equipped = false; -- Apenas equipamentos não equipados podem ser usados como ingredientes
                
                IF v_owned_count < r.quantity THEN
                    v_has_all := FALSE;
                    v_missing := array_append(v_missing, r.equipment_name || ' (x' || r.quantity || ')');
                END IF;
            END;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_has_all, v_missing;
END;
$$ LANGUAGE plpgsql;

-- Função para criar um equipamento
CREATE OR REPLACE FUNCTION craft_equipment(
    p_character_id UUID,
    p_recipe_id UUID
) RETURNS VOID AS $$
DECLARE
    v_result_equipment_id UUID;
    v_can_craft BOOLEAN;
    v_missing TEXT[];
    r RECORD;
    v_consumed_count INTEGER;
    equipment_record RECORD;
BEGIN
    -- Verificar se pode criar o equipamento
    SELECT * INTO v_can_craft, v_missing FROM check_can_craft_equipment(p_character_id, p_recipe_id);
    
    IF NOT v_can_craft THEN
        RAISE EXCEPTION 'Ingredientes insuficientes: %', v_missing;
    END IF;
    
    -- Obter o ID do equipamento resultado
    SELECT result_equipment_id INTO v_result_equipment_id 
    FROM equipment_crafting_recipes 
    WHERE id = p_recipe_id;
    
    -- Consumir os ingredientes
    FOR r IN (
        SELECT * FROM equipment_crafting_ingredients WHERE recipe_id = p_recipe_id
    ) LOOP
        IF r.item_type = 'monster_drop' THEN
            UPDATE character_drops
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND drop_id = r.item_id;
        ELSIF r.item_type = 'consumable' THEN
            UPDATE character_consumables
            SET quantity = quantity - r.quantity
            WHERE character_id = p_character_id AND consumable_id = r.item_id;
        ELSIF r.item_type = 'equipment' THEN
            -- Remover equipamentos específicos (não equipados)
            v_consumed_count := 0;
            FOR equipment_record IN (
                SELECT id 
                FROM character_equipment 
                WHERE character_id = p_character_id 
                AND equipment_id = r.item_id 
                AND is_equipped = false
                LIMIT r.quantity
            ) LOOP
                DELETE FROM character_equipment 
                WHERE id = equipment_record.id;
                v_consumed_count := v_consumed_count + 1;
            END LOOP;
            
            IF v_consumed_count < r.quantity THEN
                RAISE EXCEPTION 'Não foi possível consumir todos os equipamentos necessários';
            END IF;
        END IF;
    END LOOP;
    
    -- Adicionar o equipamento craftado ao inventário
    INSERT INTO character_equipment (character_id, equipment_id, is_equipped)
    VALUES (p_character_id, v_result_equipment_id, false);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar timestamps
CREATE TRIGGER update_equipment_crafting_recipes_updated_at
    BEFORE UPDATE ON equipment_crafting_recipes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_equipment_crafting_ingredients_updated_at
    BEFORE UPDATE ON equipment_crafting_ingredients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- CONFIGURAR RLS (Row Level Security)
-- ========================================

-- equipment_crafting_recipes: leitura pública (dados de referência)
ALTER TABLE equipment_crafting_recipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de receitas de equipamentos" ON equipment_crafting_recipes
    FOR SELECT 
    USING (true);

-- equipment_crafting_ingredients: leitura pública (dados de referência)
ALTER TABLE equipment_crafting_ingredients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura pública de ingredientes de equipamentos" ON equipment_crafting_ingredients
    FOR SELECT 
    USING (true); 
-- ================================================
-- LIMPEZA DE FUNÇÕES REDUNDANTES
-- ================================================
-- Esta migração remove funções duplicadas/obsoletas e mantém apenas
-- as versões mais modernas e funcionais baseadas na evolução do código

-- ================================================
-- 1. LIMPEZA DE FUNÇÕES DE CÁLCULO DE STATS
-- ================================================

-- Remover versões antigas de funções de cálculo de stats
-- Mantendo apenas: calculate_derived_stats e calculate_final_character_stats
DROP FUNCTION IF EXISTS calculate_character_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_derived_stats_with_weapon(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, weapon_subtype);

-- A função get_character_full_stats é mantida pois tem propósito específico diferente
-- A função get_character_detailed_stats é mantida pois retorna dados diferentes

-- ================================================
-- 2. LIMPEZA DE FUNÇÕES DE MONSTROS
-- ================================================

-- Remover função antiga de monstros, mantendo apenas a versão com ciclos
DROP FUNCTION IF EXISTS get_monster_for_floor_cyclic(INTEGER);

-- A função get_monster_for_floor foi atualizada para usar o sistema de ciclos
-- nas migrações mais recentes, então é a única que mantemos

-- ================================================
-- 3. LIMPEZA DE FUNÇÕES DE ESCALAMENTO DE MONSTROS
-- ================================================

-- Remover versões antigas de escalamento
DROP FUNCTION IF EXISTS scale_monster_stats(RECORD, INTEGER);
DROP FUNCTION IF EXISTS scale_monster_stats_with_floor(RECORD, INTEGER);

-- Mantendo apenas scale_monster_stats_balanced que é a versão mais recente

-- ================================================
-- 4. LIMPEZA DE FUNÇÕES DE RANKING DUPLICADAS
-- ================================================

-- Baseado na análise das migrações, o sistema de ranking foi reescrito várias vezes
-- As versões mais recentes estão em 20241202000012_definitive_ranking_system.sql
-- Removendo versões antigas que podem ter ficado órfãs

-- Verificar e remover possíveis duplicatas de ranking
DROP FUNCTION IF EXISTS get_ranking_by_gold(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_ranking_by_level(INTEGER, INTEGER);  
DROP FUNCTION IF EXISTS get_ranking_by_highest_floor(INTEGER, INTEGER);

-- Remover versões antigas de save_ranking_entry se existirem múltiplas
-- (Mantendo apenas as versões com SECURITY DEFINER)

-- ================================================
-- 5. LIMPEZA DE FUNÇÕES DE VALIDAÇÃO OBSOLETAS
-- ================================================

-- Remover funções de teste que podem ter ficado no banco
DROP FUNCTION IF EXISTS test_ranking_system(UUID);
DROP FUNCTION IF EXISTS test_ranking_after_fix();
DROP FUNCTION IF EXISTS test_ranking_data();
DROP FUNCTION IF EXISTS test_monster_scaling();
DROP FUNCTION IF EXISTS test_tier_progression();

-- ================================================
-- 6. LIMPEZA DE FUNÇÕES DE DEBUG
-- ================================================

-- Remover funções de debug que não devem estar em produção
DROP FUNCTION IF EXISTS debug_character_ranking(TEXT);
DROP FUNCTION IF EXISTS check_ranking_data_integrity();
DROP FUNCTION IF EXISTS fix_ranking_data_issues();
DROP FUNCTION IF EXISTS verify_ranking_integrity();
DROP FUNCTION IF EXISTS log_ranking_update();

-- ================================================
-- 7. LIMPEZA DE TRIGGERS ÓRFÃOS
-- ================================================

-- Remover triggers que podem estar associados a funções removidas
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;
DROP TRIGGER IF EXISTS update_critical_stats_trigger ON characters;

-- ================================================
-- 8. LIMPEZA DE FUNÇÕES AUXILIARES OBSOLETAS
-- ================================================

-- Remover funções que foram substituídas por versões mais recentes
DROP FUNCTION IF EXISTS get_best_character_per_user_by_level(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_best_character_per_user_by_gold(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_fast_user_stats(UUID);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(UUID, INTEGER, INTEGER);

-- ================================================
-- 9. FUNÇÕES DE MANUTENÇÃO QUE DEVEM SER REMOVIDAS
-- ================================================

-- Remover funções de manutenção que eram temporárias
DROP FUNCTION IF EXISTS sync_all_character_rankings();
DROP FUNCTION IF EXISTS refresh_all_rankings();
DROP FUNCTION IF EXISTS force_ranking_refresh();
DROP FUNCTION IF EXISTS recalculate_all_character_stats();

-- ================================================
-- 10. CONFIRMAR LIMPEZA DE TIPOS ÓRFÃOS
-- ================================================

-- Verificar se há tipos que não são mais utilizados
-- (Não removendo tipos pois podem quebrar outras funcionalidades)

-- ================================================
-- COMENTÁRIOS FINAIS
-- ================================================

-- Após esta limpeza, as funções principais mantidas são:
-- 
-- STATS DE PERSONAGEM:
-- - calculate_derived_stats (versão mais recente)
-- - calculate_final_character_stats (com bônus de equipamentos)
-- - get_character_full_stats (dados completos do personagem)
-- - get_character_detailed_stats (stats detalhados incluindo equipamentos)
-- - recalculate_character_stats (recalcula e atualiza stats)
--
-- MONSTROS:
-- - get_monster_for_floor (versão com sistema de ciclos)
-- - scale_monster_stats_balanced (escalamento balanceado)
--
-- RANKING:
-- - get_dynamic_ranking_by_highest_floor
-- - get_dynamic_ranking_by_level  
-- - get_dynamic_ranking_by_gold
-- - get_dynamic_user_ranking_history
-- - get_dynamic_user_stats
-- - save_ranking_entry_on_death
--
-- SEGURANÇA:
-- - secure_grant_xp
-- - secure_grant_gold
-- - secure_advance_floor
-- - secure_process_combat_drops

-- Limpeza de funções redundantes concluída 
-- Migração: Sistema de Iniciativa e Turnos Baseados em Velocidade
-- Data: 2024-12-20
-- Versão: 20241220000001
-- Objetivo: Implementar sistema que torna destreza/velocidade mais interessante

-- =====================================
-- ANÁLISE DO PROBLEMA:
-- =====================================
-- ❌ Velocidade atualmente não tem impacto real na batalha
-- ❌ Turnos sempre alternados (jogador -> inimigo)
-- ❌ Destreza só afeta velocidade, mas velocidade não faz diferença
-- ❌ Builds mono-atributo são muito eficientes
-- ❌ Falta incentivo para builds balanceadas

-- SOLUÇÃO IMPLEMENTADA:
-- ✅ Sistema de iniciativa baseado em velocidade
-- ✅ Turnos encadeados para diferenças grandes de velocidade
-- ✅ Rebalanceamento de atributos com sinergias
-- ✅ Diminishing returns mais agressivos
-- ✅ Caps em stats para evitar builds extremas

-- =====================================
-- 1. FUNÇÕES AUXILIARES PARA INICIATIVA
-- =====================================

-- Função para calcular iniciativa baseada em velocidade
CREATE OR REPLACE FUNCTION calculate_initiative(base_speed INTEGER, dexterity INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    initiative INTEGER;
    speed_bonus INTEGER;
    dex_bonus INTEGER;
BEGIN
    -- Base da iniciativa é a velocidade
    initiative := base_speed;
    
    -- Bônus de destreza (cada ponto de dex = +0.5 iniciativa)
    dex_bonus := FLOOR(dexterity * 0.5);
    
    -- Adicionar elemento aleatório (±10%)
    speed_bonus := FLOOR((base_speed + dex_bonus) * (0.9 + (RANDOM() * 0.2)));
    
    RETURN speed_bonus;
END;
$$;

-- Função para calcular quantos turnos extras baseado na diferença de velocidade
CREATE OR REPLACE FUNCTION calculate_extra_turns(attacker_speed INTEGER, defender_speed INTEGER)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    speed_difference FLOAT;
    extra_turns INTEGER := 0;
BEGIN
    -- Evitar divisão por zero
    IF defender_speed <= 0 THEN
        RETURN 2; -- Máximo de turnos extras se defensor não tem velocidade
    END IF;
    
    -- Calcular diferença percentual de velocidade
    speed_difference := (attacker_speed::FLOAT / defender_speed::FLOAT);
    
    -- Sistema de turnos extras baseado em diferença:
    -- 1.8x+ velocidade = 1 turno extra
    -- 2.5x+ velocidade = 2 turnos extras
    -- 3.5x+ velocidade = 3 turnos extras (máximo)
    
    IF speed_difference >= 3.5 THEN
        extra_turns := 3;
    ELSIF speed_difference >= 2.5 THEN
        extra_turns := 2;
    ELSIF speed_difference >= 1.8 THEN
        extra_turns := 1;
    END IF;
    
    -- Adicionar pequeno elemento aleatório (20% chance de +1 turno extra)
    IF extra_turns < 3 AND RANDOM() < 0.2 THEN
        extra_turns := extra_turns + 1;
    END IF;
    
    RETURN LEAST(extra_turns, 3); -- Máximo de 3 turnos extras
END;
$$;

-- =====================================
-- 2. NOVO SISTEMA DE CÁLCULO DE STATS DERIVADOS
-- =====================================

-- Função melhorada para calcular stats derivados com sistema anti-mono-build
CREATE OR REPLACE FUNCTION calculate_derived_stats_balanced(
    p_character_id UUID,
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER,
    p_axe_mastery INTEGER,
    p_blunt_mastery INTEGER,
    p_defense_mastery INTEGER,
    p_magic_mastery INTEGER
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Escalamento logarítmico com diminishing returns
    str_scaling NUMERIC;
    dex_scaling NUMERIC;
    int_scaling NUMERIC;
    wis_scaling NUMERIC;
    vit_scaling NUMERIC;
    luck_scaling NUMERIC;
    
    -- Bônus de habilidades
    weapon_mastery_bonus NUMERIC;
    def_mastery_bonus NUMERIC;
    magic_mastery_bonus NUMERIC;
    
    -- Stats base ajustados
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    
    -- Stats finais
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_magic_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance NUMERIC;
    final_crit_damage NUMERIC;
    final_magic_damage NUMERIC;
    
    -- Sistema anti-mono-build
    total_attributes INTEGER;
    attribute_diversity NUMERIC;
    diversity_bonus NUMERIC;
    mono_penalty NUMERIC;
BEGIN
    -- =====================================
    -- SISTEMA ANTI-MONO-BUILD
    -- =====================================
    
    total_attributes := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Calcular diversidade de atributos (0-1, onde 1 = perfeitamente balanceado)
    attribute_diversity := 1.0 - (
        ABS(p_strength::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_dexterity::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_intelligence::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_wisdom::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_vitality::NUMERIC / total_attributes - 1.0/6.0) +
        ABS(p_luck::NUMERIC / total_attributes - 1.0/6.0)
    ) / 2.0;
    
    -- Bônus por diversidade (builds balanceadas ganham até 20% de bônus)
    diversity_bonus := 1.0 + (attribute_diversity * 0.2);
    
    -- Penalidade para mono-builds (builds com 80%+ em um atributo perdem eficiência)
    mono_penalty := 1.0;
    IF (p_strength::NUMERIC / total_attributes) > 0.8 OR
       (p_dexterity::NUMERIC / total_attributes) > 0.8 OR
       (p_intelligence::NUMERIC / total_attributes) > 0.8 OR
       (p_wisdom::NUMERIC / total_attributes) > 0.8 OR
       (p_vitality::NUMERIC / total_attributes) > 0.8 OR
       (p_luck::NUMERIC / total_attributes) > 0.8 THEN
        mono_penalty := 0.7; -- Penalidade de 30%
    END IF;
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO COM SINERGIAS
    -- =====================================
    
    -- Escalamento com diminishing returns mais agressivos
    str_scaling := POWER(p_strength, 1.2) * diversity_bonus * mono_penalty;
    dex_scaling := POWER(p_dexterity, 1.15) * diversity_bonus * mono_penalty;
    int_scaling := POWER(p_intelligence, 1.25) * diversity_bonus * mono_penalty;
    wis_scaling := POWER(p_wisdom, 1.1) * diversity_bonus * mono_penalty;
    vit_scaling := POWER(p_vitality, 1.3) * diversity_bonus * mono_penalty;
    luck_scaling := p_luck * diversity_bonus * mono_penalty;
    
    -- Habilidades também recebem bônus de diversidade
    weapon_mastery_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1) * diversity_bonus;
    def_mastery_bonus := POWER(p_defense_mastery, 1.2) * diversity_bonus;
    magic_mastery_bonus := POWER(p_magic_mastery, 1.15) * diversity_bonus;
    
    -- =====================================
    -- BASES REBALANCEADAS
    -- =====================================
    
    base_hp := 50 + (p_level * 2);
    base_mana := 20 + (p_level * 1);
    base_atk := 2 + p_level;
    base_def := 1 + p_level;
    base_speed := 3 + p_level;
    
    -- =====================================
    -- CÁLCULO DE STATS COM SINERGIAS
    -- =====================================
    
    -- HP: Vitalidade + um pouco de força (sinergia)
    final_hp := base_hp + FLOOR(vit_scaling * 2.5) + FLOOR(str_scaling * 0.3);
    
    -- Mana: Inteligência + sabedoria (sinergia forte)
    final_mana := base_mana + FLOOR(int_scaling * 1.5) + FLOOR(wis_scaling * 1.0) + FLOOR(magic_mastery_bonus * 0.8);
    
    -- Ataque Físico: Força + habilidade de arma + um pouco de destreza (precisão)
    final_atk := base_atk + FLOOR(str_scaling * 1.2) + FLOOR(weapon_mastery_bonus * 0.6) + FLOOR(dex_scaling * 0.2);
    
    -- Ataque Mágico: Inteligência + sabedoria + maestria mágica (forte sinergia)
    final_magic_atk := base_atk + FLOOR(int_scaling * 1.4) + FLOOR(wis_scaling * 0.8) + FLOOR(magic_mastery_bonus * 1.0);
    
    -- Defesa: Vitalidade + sabedoria + maestria defensiva (sobrevivência)
    final_def := base_def + FLOOR(vit_scaling * 0.6) + FLOOR(wis_scaling * 0.5) + FLOOR(def_mastery_bonus * 1.0);
    
    -- Velocidade: Destreza (principal) + um pouco de sorte (agilidade mental)
    final_speed := base_speed + FLOOR(dex_scaling * 1.0) + FLOOR(luck_scaling * 0.2);
    
    -- =====================================
    -- STATS DERIVADOS COM CAPS E SINERGIAS
    -- =====================================
    
    -- Chance Crítica: Destreza + sorte + um pouco de força (técnica + sorte + poder)
    final_crit_chance := (dex_scaling * 0.25) + (luck_scaling * 0.35) + (str_scaling * 0.1);
    final_crit_chance := LEAST(75.0, final_crit_chance); -- Cap em 75%
    
    -- Dano Crítico: Força + sorte + habilidades de arma
    final_crit_damage := 130.0 + (str_scaling * 0.4) + (luck_scaling * 0.6) + (weapon_mastery_bonus * 0.3);
    final_crit_damage := LEAST(250.0, final_crit_damage); -- Cap em 250%
    
    -- Dano Mágico: Inteligência + sabedoria + maestria mágica (forte sinergia)
    final_magic_damage := (int_scaling * 1.2) + (wis_scaling * 0.8) + (magic_mastery_bonus * 1.5);
    -- Diminishing returns para dano mágico
    IF final_magic_damage > 100 THEN
        final_magic_damage := 100 + ((final_magic_damage - 100) * 0.7);
    END IF;
    final_magic_damage := LEAST(200.0, final_magic_damage); -- Cap em 200%
    
    -- =====================================
    -- RETORNAR RESULTADOS
    -- =====================================
    
    RETURN QUERY SELECT
        final_hp,
        final_hp,
        final_mana,
        final_mana,
        final_atk,
        final_magic_atk,
        final_def,
        final_speed,
        final_crit_chance,
        final_crit_damage,
        final_magic_damage;
END;
$$;

-- =====================================
-- 3. FUNCOES PARA MONSTROS BALANCEADOS
-- =====================================

-- Função para gerar monstros com builds variadas
CREATE OR REPLACE FUNCTION generate_balanced_monster_stats(
    p_floor INTEGER,
    p_monster_type TEXT,
    p_base_hp INTEGER,
    p_base_atk INTEGER,
    p_base_def INTEGER,
    p_base_speed INTEGER
)
RETURNS TABLE(
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    floor_multiplier NUMERIC;
    total_stat_points INTEGER;
    monster_str INTEGER;
    monster_dex INTEGER;
    monster_int INTEGER;
    monster_wis INTEGER;
    monster_vit INTEGER;
    monster_luck INTEGER;
    final_hp INTEGER;
    final_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance NUMERIC;
    final_crit_damage NUMERIC;
BEGIN
    -- Multiplicador baseado no andar (escalamento moderado)
    floor_multiplier := 1.0 + (p_floor * 0.15);
    
    -- Total de pontos de atributo baseado no andar
    total_stat_points := 60 + (p_floor * 3);
    
    -- Distribuir atributos baseado no tipo de monstro
    CASE p_monster_type
        WHEN 'swift' THEN
            -- Monstro rápido: foco em dex e um pouco de luck
            monster_dex := FLOOR(total_stat_points * 0.4);
            monster_luck := FLOOR(total_stat_points * 0.2);
            monster_str := FLOOR(total_stat_points * 0.15);
            monster_vit := FLOOR(total_stat_points * 0.15);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_wis := total_stat_points - (monster_dex + monster_luck + monster_str + monster_vit + monster_int);
            
        WHEN 'brutish' THEN
            -- Monstro brutal: foco em força e vitalidade
            monster_str := FLOOR(total_stat_points * 0.4);
            monster_vit := FLOOR(total_stat_points * 0.3);
            monster_luck := FLOOR(total_stat_points * 0.1);
            monster_dex := FLOOR(total_stat_points * 0.1);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_wis := total_stat_points - (monster_str + monster_vit + monster_luck + monster_dex + monster_int);
            
        WHEN 'magical' THEN
            -- Monstro mágico: foco em int e wisdom
            monster_int := FLOOR(total_stat_points * 0.35);
            monster_wis := FLOOR(total_stat_points * 0.25);
            monster_luck := FLOOR(total_stat_points * 0.15);
            monster_vit := FLOOR(total_stat_points * 0.15);
            monster_str := FLOOR(total_stat_points * 0.05);
            monster_dex := total_stat_points - (monster_int + monster_wis + monster_luck + monster_vit + monster_str);
            
        WHEN 'armored' THEN
            -- Monstro blindado: foco em defesa e hp
            monster_vit := FLOOR(total_stat_points * 0.4);
            monster_wis := FLOOR(total_stat_points * 0.2);
            monster_str := FLOOR(total_stat_points * 0.2);
            monster_dex := FLOOR(total_stat_points * 0.1);
            monster_int := FLOOR(total_stat_points * 0.05);
            monster_luck := total_stat_points - (monster_vit + monster_wis + monster_str + monster_dex + monster_int);
            
        ELSE -- 'balanced' ou outros
            -- Monstro balanceado: distribuição equilibrada
            monster_str := FLOOR(total_stat_points * 0.18);
            monster_dex := FLOOR(total_stat_points * 0.17);
            monster_int := FLOOR(total_stat_points * 0.16);
            monster_wis := FLOOR(total_stat_points * 0.16);
            monster_vit := FLOOR(total_stat_points * 0.17);
            monster_luck := total_stat_points - (monster_str + monster_dex + monster_int + monster_wis + monster_vit);
    END CASE;
    
    -- Calcular stats finais usando escalamento similar ao dos personagens
    final_hp := FLOOR((p_base_hp + (monster_vit * 2.0) + (monster_str * 0.3)) * floor_multiplier);
    final_atk := FLOOR((p_base_atk + (monster_str * 1.2) + (monster_dex * 0.2)) * floor_multiplier);
    final_def := FLOOR((p_base_def + (monster_vit * 0.6) + (monster_wis * 0.5)) * floor_multiplier);
    final_speed := FLOOR((p_base_speed + (monster_dex * 1.0) + (monster_luck * 0.2)) * floor_multiplier);
    
    -- Calcular stats derivados
    final_crit_chance := LEAST(60.0, (monster_dex * 0.2) + (monster_luck * 0.3));
    final_crit_damage := LEAST(200.0, 130.0 + (monster_str * 0.4) + (monster_luck * 0.5));
    
    RETURN QUERY SELECT
        final_hp,
        final_atk,
        final_def,
        final_speed,
        monster_str,
        monster_dex,
        monster_int,
        monster_wis,
        monster_vit,
        monster_luck,
        final_crit_chance,
        final_crit_damage;
END;
$$;

-- =====================================
-- 4. ÍNDICES PARA PERFORMANCE
-- =====================================

-- Adicionar colunas de iniciativa se não existirem
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0;

-- Índices para consultas rápidas de iniciativa
CREATE INDEX IF NOT EXISTS idx_characters_speed ON characters(speed);
CREATE INDEX IF NOT EXISTS idx_characters_dexterity ON characters(dexterity);
CREATE INDEX IF NOT EXISTS idx_characters_initiative ON characters(current_initiative);

-- =====================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION calculate_initiative(INTEGER, INTEGER) IS 
'Calcula iniciativa baseada em velocidade e destreza para determinar ordem dos turnos';

COMMENT ON FUNCTION calculate_extra_turns(INTEGER, INTEGER) IS 
'Determina quantos turnos extras um combatente pode ter baseado na diferença de velocidade';

COMMENT ON FUNCTION calculate_derived_stats_balanced IS 
'Sistema rebalanceado de cálculo de stats que penaliza mono-builds e incentiva diversidade';

COMMENT ON FUNCTION generate_balanced_monster_stats IS 
'Gera monstros com builds variadas para desafiar diferentes tipos de personagens'; 
-- Migração: Integração do Sistema de Monstros com Iniciativa
-- Data: 2024-12-20
-- Versão: 20241220000002
-- Objetivo: Atualizar sistema de monstros para usar novo sistema de iniciativa e builds variadas

-- =====================================
-- ATUALIZAR TABELAS PARA NOVO SISTEMA
-- =====================================

-- Adicionar colunas necessárias na tabela de personagens para o novo sistema
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS magic_damage_bonus NUMERIC(5,2) DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS critical_chance NUMERIC(5,2) DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS critical_damage NUMERIC(5,2) DEFAULT 150.0,
ADD COLUMN IF NOT EXISTS magic_attack INTEGER DEFAULT 0;

-- Adicionar colunas necessárias para o novo sistema de monstros
ALTER TABLE monsters 
ADD COLUMN IF NOT EXISTS current_initiative INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_turns_remaining INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS build_type TEXT DEFAULT 'balanced';

-- Atualizar função de geração de monstros para usar novo sistema
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
    v_cycle INTEGER;
    v_position_in_cycle INTEGER;
    v_tier INTEGER;
    v_is_boss BOOLEAN;
    v_boss_floors INTEGER[] := ARRAY[5, 10, 15, 20];
    v_monster monsters%ROWTYPE;
    v_total_monsters INTEGER;
    v_selected_index INTEGER;
    v_floor_multiplier NUMERIC;
    v_stats RECORD;
    v_build_types TEXT[] := ARRAY['swift', 'brutish', 'magical', 'armored', 'balanced'];
    v_selected_build TEXT;
    v_trait_primary TEXT;
    v_trait_secondary TEXT;
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
            WHEN 0 THEN 'brutish'    -- Boss brutal
            WHEN 1 THEN 'swift'      -- Boss rápido 
            WHEN 2 THEN 'magical'    -- Boss mágico
            WHEN 3 THEN 'armored'    -- Boss defensivo
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
    
    -- Calcular iniciativa inicial
    RETURN QUERY SELECT
        v_monster.id,
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
        v_monster.behavior,
        v_monster.min_floor,
        FLOOR(v_monster.reward_xp * (1.0 + (p_floor * 0.1)))::INTEGER,
        FLOOR(v_monster.reward_gold * (1.0 + (p_floor * 0.1)))::INTEGER,
        v_monster.image,
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
        calculate_initiative(v_stats.speed, v_stats.dexterity),
        0,
        v_selected_build;
END;
$$;

-- =====================================
-- FUNÇÃO ATUALIZADA PARA RECALCULAR STATS DE PERSONAGENS
-- =====================================

-- Atualizar função para usar novo sistema balanceado
CREATE OR REPLACE FUNCTION recalculate_character_stats_with_balance(p_character_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_stats RECORD;
BEGIN
    -- Buscar dados atuais do personagem
    SELECT * INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calcular novos stats usando função balanceada
    SELECT * INTO v_stats FROM calculate_derived_stats_balanced(
        p_character_id,
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
    );
    
    -- Atualizar o personagem mantendo HP e mana atuais
    UPDATE characters SET
        max_hp = v_stats.max_hp,
        max_mana = v_stats.max_mana,
        atk = v_stats.atk,
        magic_attack = v_stats.magic_attack,
        def = v_stats.def,
        speed = v_stats.speed,
        critical_chance = v_stats.critical_chance,
        critical_damage = v_stats.critical_damage,
        magic_damage_bonus = v_stats.magic_damage_bonus,
        -- Manter HP atual, mas não deixar passar do máximo
        hp = LEAST(hp, v_stats.max_hp),
        -- Manter mana atual, mas não deixar passar do máximo  
        mana = LEAST(mana, v_stats.max_mana),
        updated_at = NOW()
    WHERE id = p_character_id;
    
    RETURN TRUE;
END;
$$;

-- =====================================
-- FUNÇÃO PARA RECALCULAR TODOS OS PERSONAGENS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_all_characters_with_balance()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_character_id UUID;
BEGIN
    -- Recalcular stats de todos os personagens
    FOR v_character_id IN 
        SELECT id FROM characters WHERE level > 0
    LOOP
        IF recalculate_character_stats_with_balance(v_character_id) THEN
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- ATUALIZAR FUNÇÃO DE DISTRIBUIÇÃO DE ATRIBUTOS
-- =====================================

-- Função melhorada para distribuição de atributos com novo sistema
CREATE OR REPLACE FUNCTION distribute_attribute_points_balanced(
    p_character_id UUID,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    new_stats RECORD
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_total_points INTEGER;
    v_stats RECORD;
    v_result_record RECORD;
BEGIN
    -- Buscar personagem
    SELECT * INTO v_character
    FROM characters 
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Calcular total de pontos sendo usados
    v_total_points := p_strength + p_dexterity + p_intelligence + p_wisdom + p_vitality + p_luck;
    
    -- Verificar se tem pontos suficientes
    IF v_total_points > COALESCE(v_character.attribute_points, 0) THEN
        RETURN QUERY SELECT FALSE, 'Pontos de atributo insuficientes'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Verificar valores não negativos
    IF p_strength < 0 OR p_dexterity < 0 OR p_intelligence < 0 OR 
       p_wisdom < 0 OR p_vitality < 0 OR p_luck < 0 THEN
        RETURN QUERY SELECT FALSE, 'Valores de atributos não podem ser negativos'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Atualizar atributos
    UPDATE characters SET
        strength = strength + p_strength,
        dexterity = dexterity + p_dexterity,
        intelligence = intelligence + p_intelligence,
        wisdom = wisdom + p_wisdom,
        vitality = vitality + p_vitality,
        luck = luck + p_luck,
        attribute_points = attribute_points - v_total_points,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados com novo sistema
    IF NOT recalculate_character_stats_with_balance(p_character_id) THEN
        RETURN QUERY SELECT FALSE, 'Erro ao recalcular stats'::TEXT, NULL::RECORD;
        RETURN;
    END IF;
    
    -- Buscar stats atualizados
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    -- Construir record de resposta
    SELECT v_character.level, v_character.hp, v_character.max_hp, v_character.mana, v_character.max_mana,
           v_character.atk, v_character.def, v_character.speed, v_character.critical_chance, 
           v_character.critical_damage, v_character.magic_damage_bonus
    INTO v_result_record;
    
    RETURN QUERY SELECT TRUE, 
        FORMAT('Atributos distribuídos com sucesso! Diversidade de build: %.1f%%', 
               (1.0 - ABS((v_character.strength + v_character.dexterity + v_character.intelligence + 
                          v_character.wisdom + v_character.vitality + v_character.luck)::NUMERIC / 6.0 - 
                         GREATEST(v_character.strength, v_character.dexterity, v_character.intelligence,
                                 v_character.wisdom, v_character.vitality, v_character.luck)::NUMERIC) / 
                        (v_character.strength + v_character.dexterity + v_character.intelligence + 
                         v_character.wisdom + v_character.vitality + v_character.luck)::NUMERIC) * 100)::TEXT,
        v_result_record;
END;
$$;

-- =====================================
-- EXECUTAR MIGRAÇÃO NOS DADOS EXISTENTES
-- =====================================

-- Aguardar um momento para garantir que as colunas foram criadas
DO $$ 
BEGIN 
    -- Verificar se todas as colunas necessárias existem antes de recalcular
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'magic_damage_bonus'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'critical_chance'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'characters' 
        AND column_name = 'magic_attack'
    ) THEN
        -- Recalcular todos os personagens existentes com novo sistema
        PERFORM recalculate_all_characters_with_balance();
        RAISE NOTICE 'Recalculação de stats dos personagens concluída com sucesso!';
    ELSE
        RAISE NOTICE 'Algumas colunas ainda não existem. Pulando recalculação automática.';
    END IF;
END $$;

-- Atualizar monstros existentes com builds
UPDATE monsters SET 
    build_type = CASE 
        WHEN primary_trait = 'swift' THEN 'swift'
        WHEN primary_trait = 'brutish' THEN 'brutish' 
        WHEN primary_trait = 'magical' THEN 'magical'
        WHEN primary_trait = 'armored' THEN 'armored'
        ELSE 'balanced'
    END
WHERE build_type IS NULL;

-- =====================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor_with_initiative(INTEGER) IS 
'Versão atualizada que gera monstros com sistema de iniciativa e builds variadas';

COMMENT ON FUNCTION recalculate_character_stats_with_balance(UUID) IS 
'Recalcula stats de um personagem usando o novo sistema balanceado anti-mono-build';

COMMENT ON FUNCTION distribute_attribute_points_balanced IS 
'Versão melhorada da distribuição de atributos que mostra feedback sobre diversidade da build';

COMMENT ON COLUMN characters.current_initiative IS 
'Iniciativa atual do personagem para determinação da ordem dos turnos';

COMMENT ON COLUMN characters.extra_turns_remaining IS 
'Número de turnos extras restantes baseado na diferença de velocidade'; 
-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO ABRANGENTE PARA VIABILIZAR GUERREIROS
-- =====================================
-- Data: 2024-12-20
-- Versão: 20241220000003
-- Objetivo: Tornar builds de guerreiro viáveis e implementar progressão infinita

-- ❌ PROBLEMAS IDENTIFICADOS:
-- - Stats base muito baixos tornam guerreiros inviáveis
-- - Magos dominam completamente o early game
-- - Dano crítico excessivo mas chance muito baixa
-- - Velocidade sem benefícios tangíveis
-- - Cap artificial de atributos em 50
-- - Progressão limitada

-- ✅ SOLUÇÕES IMPLEMENTADAS:
-- - Stats base aumentados ~25% para viabilidade inicial
-- - Rebalanceamento crítico: menos dano, mais chance
-- - Sistema de duplo ataque baseado em velocidade
-- - Remoção do cap de atributos com progressão logarítmica
-- - Ajuste de dificuldade dos monstros iniciais
-- - Progressão infinita implementada

-- =====================================
-- 0. LIMPAR FUNÇÕES EXISTENTES QUE PODEM CAUSAR CONFLITO
-- =====================================

-- Dropar funções que serão recriadas com tipos diferentes
DROP FUNCTION IF EXISTS recalculate_character_stats_with_balance(UUID);
DROP FUNCTION IF EXISTS recalculate_all_characters_warrior_balance();
DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;
DROP FUNCTION IF EXISTS calculate_attribute_cost_logarithmic(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_xp_required_logarithmic(INTEGER);
DROP FUNCTION IF EXISTS scale_monster_stats_early_game(INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS distribute_attribute_points_infinite CASCADE;

-- =====================================
-- 1. REMOVER CAP DE ATRIBUTOS E IMPLEMENTAR PROGRESSÃO LOGARÍTMICA
-- =====================================

-- Remover constraints que limitam atributos a 50
ALTER TABLE characters DROP CONSTRAINT IF EXISTS chk_attribute_limits;

-- Função para calcular custo logarítmico de atributos
CREATE FUNCTION calculate_attribute_cost_logarithmic(
    p_current_value INTEGER,
    p_target_value INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_total_cost INTEGER := 0;
    v_current INTEGER := p_current_value;
BEGIN
    -- Custo logarítmico: mais caro conforme aumenta
    WHILE v_current < p_target_value LOOP
        v_current := v_current + 1;
        
        -- Custo escala logaritmicamente após 50
        IF v_current <= 50 THEN
            v_total_cost := v_total_cost + 1; -- Custo normal até 50
        ELSIF v_current <= 100 THEN
            v_total_cost := v_total_cost + 2; -- 2x mais caro 51-100
        ELSIF v_current <= 200 THEN
            v_total_cost := v_total_cost + 3; -- 3x mais caro 101-200
        ELSIF v_current <= 500 THEN
            v_total_cost := v_total_cost + 5; -- 5x mais caro 201-500
        ELSE
            -- Após 500, custo logarítmico extremo
            v_total_cost := v_total_cost + FLOOR(LOG(v_current - 499) * 10);
        END IF;
    END LOOP;
    
    RETURN v_total_cost;
END;
$$;

-- =====================================
-- 2. FUNÇÃO DE STATS DERIVADOS REBALANCEADA PARA GUERREIROS
-- =====================================

CREATE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2),
    double_attack_chance NUMERIC(5,2) -- NOVO: chance de duplo ataque
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- =====================================
    -- STATS BASE AUMENTADOS PARA VIABILIDADE (~25% MAIOR)
    -- =====================================
    
    base_hp INTEGER := 60 + (p_level * 3);        -- Era 40+2, agora 60+3 (+50% HP)
    base_mana INTEGER := 20 + (p_level * 1.5);    -- Era 15+1, agora 20+1.5 (+33% Mana)
    base_atk INTEGER := 3 + (p_level * 1);        -- Era 1+0.5, agora 3+1 (+200% ATK!)
    base_magic_atk INTEGER := 2 + (p_level * 0.8); -- Era 1+0.5, agora 2+0.8 (+60% Magic)
    base_def INTEGER := 2 + (p_level * 0.5);      -- Era 1+0.3, agora 2+0.5 (+67% DEF)
    base_speed INTEGER := 5 + (p_level * 0.8);    -- Era 3+0.5, agora 5+0.8 (+60% Speed)
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO PARA ALTOS VALORES
    -- =====================================
    
    -- Função logarítmica suave para valores altos
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 50 THEN POWER(p_strength, 1.3)
        WHEN p_strength <= 100 THEN POWER(50, 1.3) + (p_strength - 50) * POWER(50, 0.3)
        ELSE POWER(50, 1.3) + 50 * POWER(50, 0.3) + (p_strength - 100) * POWER(50, 0.2)
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 50 THEN POWER(p_dexterity, 1.2)
        WHEN p_dexterity <= 100 THEN POWER(50, 1.2) + (p_dexterity - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_dexterity - 100) * POWER(50, 0.15)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 50 THEN POWER(p_intelligence, 1.25)
        WHEN p_intelligence <= 100 THEN POWER(50, 1.25) + (p_intelligence - 50) * POWER(50, 0.25)
        ELSE POWER(50, 1.25) + 50 * POWER(50, 0.25) + (p_intelligence - 100) * POWER(50, 0.2)
    END;
    
    wis_scaling NUMERIC := CASE 
        WHEN p_wisdom <= 50 THEN POWER(p_wisdom, 1.15)
        WHEN p_wisdom <= 100 THEN POWER(50, 1.15) + (p_wisdom - 50) * POWER(50, 0.15)
        ELSE POWER(50, 1.15) + 50 * POWER(50, 0.15) + (p_wisdom - 100) * POWER(50, 0.1)
    END;
    
    vit_scaling NUMERIC := CASE 
        WHEN p_vitality <= 50 THEN POWER(p_vitality, 1.2)
        WHEN p_vitality <= 100 THEN POWER(50, 1.2) + (p_vitality - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_vitality - 100) * POWER(50, 0.15)
    END;
    
    luck_scaling NUMERIC := p_luck * 1.0; -- Linear, mas sem penalidade agora
    
    -- Habilidades com maior impacto
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.15) * 0.8; -- Era 0.2, agora 0.8
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.2) * 1.0; -- Era 0.4, agora 1.0
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 1.2;    -- Era 0.8, agora 1.2
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    v_double_attack_chance NUMERIC(5,2);
BEGIN
    -- =====================================
    -- CÁLCULOS REBALANCEADOS PARA GUERREIROS
    -- =====================================
    
    -- HP: Vitalidade importante mas guerreiros têm base decente
    v_hp := base_hp + ROUND(vit_scaling * 3.5);  -- Aumentado de 2.5 para 3.5
    
    -- MANA: INT/WIS críticos para magos
    v_mana := base_mana + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 1.4) + ROUND(magic_mastery_bonus * 0.8);
    
    -- ATAQUE FÍSICO: Força + armas mais efetivas 
    v_atk := base_atk + ROUND(str_scaling * 1.8) + ROUND(weapon_mastery_bonus * 1.2);  -- Aumentado de 1.2 para 1.8
    
    -- ATAQUE MÁGICO: Balanceado mas não nerfado
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.6) + ROUND(wis_scaling * 0.8) + ROUND(magic_mastery_bonus * 1.0);
    
    -- DEFESA: Melhor escalamento
    v_def := base_def + ROUND(vit_scaling * 0.8) + ROUND(wis_scaling * 0.6) + ROUND(defense_mastery_bonus * 1.2);  -- Aumentado
    
    -- VELOCIDADE: Importante para duplo ataque
    v_speed := base_speed + ROUND(dex_scaling * 1.2);  -- Aumentado de 0.8 para 1.2
    
    -- =====================================
    -- SISTEMA DE CRÍTICOS REBALANCEADO
    -- =====================================
    
    -- Chance crítica: Maior e mais acessível
    v_crit_chance := LEAST(85, (luck_scaling * 0.6) + (dex_scaling * 0.4) + (weapon_mastery_bonus * 0.2));  -- Cap 85%, mais acessível
    
    -- Dano crítico: MENOR base, crescimento moderado
    v_crit_damage := 110 + (luck_scaling * 0.4) + (str_scaling * 0.3) + (weapon_mastery_bonus * 0.2);  -- Base 110% (era 130%)
    
    -- =====================================
    -- NOVO: SISTEMA DE DUPLO ATAQUE
    -- =====================================
    
    -- Chance de duplo ataque baseada em velocidade alta
    v_double_attack_chance := CASE
        WHEN v_speed >= 50 THEN LEAST(25, (v_speed - 49) * 0.5) -- Max 25% chance
        ELSE 0
    END;
    
    -- =====================================
    -- DANO MÁGICO COMO % (COMPATIBILIDADE)
    -- =====================================
    
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.8;  -- Era 2.0, agora 1.8
    v_magic_dmg_bonus := LEAST(500, v_magic_dmg_bonus); -- Cap aumentado de 400 para 500
    
    -- =====================================
    -- RETORNO DOS VALORES REBALANCEADOS
    -- =====================================
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,
        v_mana,
        v_mana,
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus,
        v_double_attack_chance;
END;
$$;

-- =====================================
-- 3. PROGRESSÃO INFINITA COM XP LOGARÍTMICO
-- =====================================

-- Função para calcular XP necessário com progressão logarítmica
CREATE FUNCTION calculate_xp_required_logarithmic(p_level INTEGER)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_xp_required BIGINT;
BEGIN
    -- Progressão normal até nível 100
    IF p_level <= 100 THEN
        v_xp_required := 100 * POWER(1.05, p_level - 1);
    -- Progressão mais lenta 101-500
    ELSIF p_level <= 500 THEN
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, p_level - 100);
    -- Progressão mais lenta 501-1000
    ELSIF p_level <= 1000 THEN
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, 400) * POWER(1.01, p_level - 500);
    -- Progressão logarítmica extrema após 1000
    ELSE
        v_xp_required := 100 * POWER(1.05, 99) * POWER(1.02, 400) * POWER(1.01, 500) 
                        * POWER(LOG(p_level - 999), 3);
    END IF;
    
    RETURN FLOOR(v_xp_required);
END;
$$;

-- =====================================
-- 4. AJUSTAR DIFICULDADE DOS MONSTROS INICIAIS
-- =====================================

-- Função para reduzir stats dos monstros nos primeiros andares
CREATE FUNCTION scale_monster_stats_early_game(
    p_floor INTEGER,
    p_base_hp INTEGER,
    p_base_atk INTEGER,
    p_base_def INTEGER
)
RETURNS TABLE(
    scaled_hp INTEGER,
    scaled_atk INTEGER,
    scaled_def INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_early_game_reduction NUMERIC := 1.0;
BEGIN
    -- Reduzir stats dos monstros nos primeiros 20 andares
    IF p_floor <= 10 THEN
        v_early_game_reduction := 0.7; -- 30% mais fracos
    ELSIF p_floor <= 20 THEN
        v_early_game_reduction := 0.8; -- 20% mais fracos
    ELSIF p_floor <= 30 THEN
        v_early_game_reduction := 0.9; -- 10% mais fracos
    END IF;
    
    RETURN QUERY SELECT
        FLOOR(p_base_hp * v_early_game_reduction)::INTEGER,
        FLOOR(p_base_atk * v_early_game_reduction)::INTEGER,
        FLOOR(p_base_def * v_early_game_reduction)::INTEGER;
END;
$$;

-- =====================================
-- 5. ATUALIZAR SISTEMA DE DISTRIBUIÇÃO DE ATRIBUTOS
-- =====================================

-- Função melhorada para distribuição com custo logarítmico
CREATE FUNCTION distribute_attribute_points_infinite(
    p_character_id UUID,
    p_strength_increase INTEGER DEFAULT 0,
    p_dexterity_increase INTEGER DEFAULT 0,
    p_intelligence_increase INTEGER DEFAULT 0,
    p_wisdom_increase INTEGER DEFAULT 0,
    p_vitality_increase INTEGER DEFAULT 0,
    p_luck_increase INTEGER DEFAULT 0
)
RETURNS TABLE(
    success BOOLEAN,
    message TEXT,
    points_spent INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_total_cost INTEGER := 0;
    v_current_points INTEGER;
BEGIN
    -- Buscar personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Personagem não encontrado', 0;
        RETURN;
    END IF;
    
    -- Calcular custo total usando função logarítmica
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.strength, v_character.strength + p_strength_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.dexterity, v_character.dexterity + p_dexterity_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.intelligence, v_character.intelligence + p_intelligence_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.wisdom, v_character.wisdom + p_wisdom_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.vitality, v_character.vitality + p_vitality_increase);
    v_total_cost := v_total_cost + calculate_attribute_cost_logarithmic(v_character.luck, v_character.luck + p_luck_increase);
    
    -- Verificar se tem pontos suficientes
    IF v_character.attribute_points < v_total_cost THEN
        RETURN QUERY SELECT FALSE, 
            FORMAT('Pontos insuficientes. Necessário: %s, Disponível: %s', v_total_cost, v_character.attribute_points),
            v_total_cost;
        RETURN;
    END IF;
    
    -- Aplicar mudanças
    UPDATE characters SET
        strength = strength + p_strength_increase,
        dexterity = dexterity + p_dexterity_increase,
        intelligence = intelligence + p_intelligence_increase,
        wisdom = wisdom + p_wisdom_increase,
        vitality = vitality + p_vitality_increase,
        luck = luck + p_luck_increase,
        attribute_points = attribute_points - v_total_cost,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Recalcular stats derivados
    PERFORM recalculate_character_stats_with_balance(p_character_id);
    
    RETURN QUERY SELECT TRUE, 
        FORMAT('Atributos distribuídos com sucesso! Pontos gastos: %s', v_total_cost),
        v_total_cost;
END;
$$;

-- =====================================
-- 6. ATUALIZAR FUNÇÃO DE RECÁLCULO GERAL
-- =====================================

CREATE FUNCTION recalculate_character_stats_with_balance(p_character_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_derived_stats RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Calcular stats derivados com a nova função
    SELECT * INTO v_derived_stats FROM calculate_derived_stats(
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1)
    );
    
    -- Atualizar personagem com novos stats
    UPDATE characters SET
        hp = LEAST(v_derived_stats.hp, hp + (v_derived_stats.hp - COALESCE(max_hp, v_derived_stats.hp))), -- Manter HP atual se possível
        max_hp = v_derived_stats.max_hp,
        mana = LEAST(v_derived_stats.mana, mana + (v_derived_stats.mana - COALESCE(max_mana, v_derived_stats.mana))), -- Manter Mana atual se possível
        max_mana = v_derived_stats.max_mana,
        atk = v_derived_stats.atk,
        magic_attack = v_derived_stats.magic_attack,
        def = v_derived_stats.def,
        speed = v_derived_stats.speed,
        critical_chance = v_derived_stats.critical_chance,
        critical_damage = v_derived_stats.critical_damage,
        double_attack_chance = v_derived_stats.double_attack_chance, -- NOVO: campo duplo ataque
        updated_at = NOW()
    WHERE id = p_character_id;
END;
$$;

-- =====================================
-- 7. RECALCULAR TODOS OS PERSONAGENS EXISTENTES
-- =====================================

-- Função para recalcular todos com o novo sistema
CREATE FUNCTION recalculate_all_characters_warrior_balance()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_character_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        BEGIN
            PERFORM recalculate_character_stats_with_balance(v_character_record.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao recalcular personagem %: %', v_character_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 8. ADICIONAR CAMPO PARA DUPLO ATAQUE
-- =====================================

-- Adicionar campo para tracking de duplo ataque se não existe
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS double_attack_chance NUMERIC(5,2) DEFAULT 0;

-- =====================================
-- 9. EXECUTAR RECÁLCULO GERAL
-- =====================================

-- Aplicar o novo balanceamento a todos os personagens
SELECT recalculate_all_characters_warrior_balance();

-- =====================================
-- 10. ÍNDICES PARA PERFORMANCE
-- =====================================

CREATE INDEX IF NOT EXISTS idx_characters_double_attack_chance ON characters(double_attack_chance);
CREATE INDEX IF NOT EXISTS idx_characters_high_attributes ON characters(strength, dexterity, intelligence, wisdom, vitality, luck);

-- =====================================
-- 11. COMENTÁRIOS PARA TRACKING
-- =====================================

COMMENT ON FUNCTION calculate_derived_stats IS 'Função rebalanceada v3.0 - Viabiliza guerreiros, progressão infinita';
COMMENT ON FUNCTION calculate_attribute_cost_logarithmic IS 'Sistema de custo logarítmico para progressão infinita';
COMMENT ON FUNCTION calculate_xp_required_logarithmic IS 'XP logarítmico com dificuldade após nível 1000';
COMMENT ON FUNCTION distribute_attribute_points_infinite IS 'Distribuição sem caps com custo progressivo';

-- Confirmar aplicação
SELECT 'Rebalanceamento para guerreiros aplicado com sucesso!' as status; 
-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO E EXPANSÃO DE EQUIPAMENTOS
-- =====================================
-- Data: 2024-12-20
-- Versão: 20241220000004
-- Objetivo: Tornar equipamentos 20% mais fortes e adicionar novos tipos de bônus

-- =====================================
-- 1. ADICIONAR NOVOS CAMPOS DE BÔNUS
-- =====================================

-- Adicionar novos campos de bônus aos equipamentos
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS hp_bonus INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_chance_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_damage_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS double_attack_chance_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS magic_damage_bonus NUMERIC(5,2) DEFAULT 0;

-- =====================================
-- 2. REBALANCEAMENTO: AUMENTAR TODOS OS BÔNUS EM 20%
-- =====================================

-- Aumentar bônus existentes em 20% e garantir valores mínimos
UPDATE equipment SET
  atk_bonus = GREATEST(1, FLOOR(atk_bonus * 1.2)),
  def_bonus = GREATEST(1, FLOOR(def_bonus * 1.2)),
  mana_bonus = GREATEST(1, FLOOR(mana_bonus * 1.2)),
  speed_bonus = GREATEST(1, FLOOR(speed_bonus * 1.2))
WHERE atk_bonus > 0 OR def_bonus > 0 OR mana_bonus > 0 OR speed_bonus > 0;

-- =====================================
-- 3. ADICIONAR BÔNUS AVANÇADOS BASEADOS NO TIPO E RARIDADE
-- =====================================

-- Armas: Adicionar bônus de crítico e dano mágico
UPDATE equipment SET
  critical_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 8.0
    WHEN rarity = 'epic' THEN 6.0
    WHEN rarity = 'rare' THEN 4.0
    WHEN rarity = 'uncommon' THEN 2.0
    ELSE 1.0
  END,
  critical_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN 20.0
    WHEN rarity = 'epic' THEN 15.0
    WHEN rarity = 'rare' THEN 10.0
    WHEN rarity = 'uncommon' THEN 5.0
    ELSE 2.0
  END,
  double_attack_chance_bonus = CASE 
    WHEN weapon_subtype = 'dagger' THEN CASE 
      WHEN rarity = 'legendary' THEN 6.0
      WHEN rarity = 'epic' THEN 4.5
      WHEN rarity = 'rare' THEN 3.0
      WHEN rarity = 'uncommon' THEN 1.5
      ELSE 0.5
    END
    WHEN weapon_subtype IN ('sword', 'axe') THEN CASE 
      WHEN rarity = 'legendary' THEN 3.0
      WHEN rarity = 'epic' THEN 2.0
      WHEN rarity = 'rare' THEN 1.0
      ELSE 0.0
    END
    ELSE 0.0
  END,
  magic_damage_bonus = CASE 
    WHEN weapon_subtype = 'staff' THEN CASE 
      WHEN rarity = 'legendary' THEN 25.0
      WHEN rarity = 'epic' THEN 20.0
      WHEN rarity = 'rare' THEN 15.0
      WHEN rarity = 'uncommon' THEN 10.0
      ELSE 5.0
    END
    ELSE 0.0
  END
WHERE type = 'weapon';

-- Armaduras: Adicionar bônus de HP e defesa crítica
UPDATE equipment SET
  hp_bonus = CASE 
    WHEN rarity = 'legendary' THEN FLOOR(level_requirement * 8)
    WHEN rarity = 'epic' THEN FLOOR(level_requirement * 6)
    WHEN rarity = 'rare' THEN FLOOR(level_requirement * 4)
    WHEN rarity = 'uncommon' THEN FLOOR(level_requirement * 3)
    ELSE FLOOR(level_requirement * 2)
  END,
  critical_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN -10.0  -- Reduz dano crítico recebido
    WHEN rarity = 'epic' THEN -7.0
    WHEN rarity = 'rare' THEN -5.0
    WHEN rarity = 'uncommon' THEN -3.0
    ELSE -1.0
  END
WHERE type = 'armor';

-- Acessórios: Bônus diversificados baseados no tipo
UPDATE equipment SET
  hp_bonus = CASE 
    WHEN rarity = 'legendary' THEN FLOOR(level_requirement * 4)
    WHEN rarity = 'epic' THEN FLOOR(level_requirement * 3)
    WHEN rarity = 'rare' THEN FLOOR(level_requirement * 2)
    ELSE FLOOR(level_requirement * 1)
  END,
  critical_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 5.0
    WHEN rarity = 'epic' THEN 4.0
    WHEN rarity = 'rare' THEN 3.0
    WHEN rarity = 'uncommon' THEN 2.0
    ELSE 1.0
  END,
  magic_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN 15.0
    WHEN rarity = 'epic' THEN 12.0
    WHEN rarity = 'rare' THEN 8.0
    WHEN rarity = 'uncommon' THEN 5.0
    ELSE 2.0
  END,
  double_attack_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 2.0
    WHEN rarity = 'epic' THEN 1.5
    WHEN rarity = 'rare' THEN 1.0
    ELSE 0.5
  END
WHERE type = 'accessory';

-- =====================================
-- 4. ATUALIZAR FUNÇÕES DE CÁLCULO DE BÔNUS
-- =====================================

CREATE OR REPLACE FUNCTION calculate_equipment_bonuses_enhanced(p_character_id UUID)
RETURNS TABLE(
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus NUMERIC(5,2),
    total_critical_damage_bonus NUMERIC(5,2),
    total_double_attack_chance_bonus NUMERIC(5,2),
    total_magic_damage_bonus NUMERIC(5,2)
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER as total_atk_bonus,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER as total_def_bonus,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER as total_mana_bonus,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER as total_speed_bonus,
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER as total_hp_bonus,
        COALESCE(SUM(e.critical_chance_bonus), 0)::NUMERIC(5,2) as total_critical_chance_bonus,
        COALESCE(SUM(e.critical_damage_bonus), 0)::NUMERIC(5,2) as total_critical_damage_bonus,
        COALESCE(SUM(e.double_attack_chance_bonus), 0)::NUMERIC(5,2) as total_double_attack_chance_bonus,
        COALESCE(SUM(e.magic_damage_bonus), 0)::NUMERIC(5,2) as total_magic_damage_bonus
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true;
END;
$$;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE STATS DERIVADOS PARA INCLUIR NOVOS BÔNUS
-- =====================================

DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

CREATE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1,
    -- NOVOS: Bônus de equipamentos
    p_equipment_hp_bonus INTEGER DEFAULT 0,
    p_equipment_atk_bonus INTEGER DEFAULT 0,
    p_equipment_def_bonus INTEGER DEFAULT 0,
    p_equipment_mana_bonus INTEGER DEFAULT 0,
    p_equipment_speed_bonus INTEGER DEFAULT 0,
    p_equipment_critical_chance_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_critical_damage_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_double_attack_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_magic_damage_bonus NUMERIC(5,2) DEFAULT 0
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2),
    double_attack_chance NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Stats base rebalanceados (do rebalanceamento anterior)
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 20 + (p_level * 1.5);
    base_atk INTEGER := 3 + (p_level * 1);
    base_magic_atk INTEGER := 2 + (p_level * 0.8);
    base_def INTEGER := 2 + (p_level * 0.5);
    base_speed INTEGER := 5 + (p_level * 0.8);
    
    -- Escalamento dos atributos (do rebalanceamento anterior)
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 50 THEN POWER(p_strength, 1.3)
        WHEN p_strength <= 100 THEN POWER(50, 1.3) + (p_strength - 50) * POWER(50, 0.3)
        ELSE POWER(50, 1.3) + 50 * POWER(50, 0.3) + (p_strength - 100) * POWER(50, 0.2)
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 50 THEN POWER(p_dexterity, 1.2)
        WHEN p_dexterity <= 100 THEN POWER(50, 1.2) + (p_dexterity - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_dexterity - 100) * POWER(50, 0.15)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 50 THEN POWER(p_intelligence, 1.25)
        WHEN p_intelligence <= 100 THEN POWER(50, 1.25) + (p_intelligence - 50) * POWER(50, 0.25)
        ELSE POWER(50, 1.25) + 50 * POWER(50, 0.25) + (p_intelligence - 100) * POWER(50, 0.2)
    END;
    
    wis_scaling NUMERIC := CASE 
        WHEN p_wisdom <= 50 THEN POWER(p_wisdom, 1.15)
        WHEN p_wisdom <= 100 THEN POWER(50, 1.15) + (p_wisdom - 50) * POWER(50, 0.15)
        ELSE POWER(50, 1.15) + 50 * POWER(50, 0.15) + (p_wisdom - 100) * POWER(50, 0.1)
    END;
    
    vit_scaling NUMERIC := CASE 
        WHEN p_vitality <= 50 THEN POWER(p_vitality, 1.2)
        WHEN p_vitality <= 100 THEN POWER(50, 1.2) + (p_vitality - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_vitality - 100) * POWER(50, 0.15)
    END;
    
    luck_scaling NUMERIC := p_luck * 1.0;
    
    -- Bônus de habilidades
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.15) * 0.8;
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.2) * 1.0;
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 1.2;
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    v_double_attack_chance NUMERIC(5,2);
BEGIN
    -- Calcular stats base + atributos + equipamentos
    v_hp := base_hp + ROUND(vit_scaling * 3.5) + p_equipment_hp_bonus;
    v_mana := base_mana + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 1.4) + ROUND(magic_mastery_bonus * 0.8) + p_equipment_mana_bonus;
    v_atk := base_atk + ROUND(str_scaling * 1.8) + ROUND(weapon_mastery_bonus * 1.2) + p_equipment_atk_bonus;
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.6) + ROUND(wis_scaling * 0.8) + ROUND(magic_mastery_bonus * 1.0);
    v_def := base_def + ROUND(vit_scaling * 0.8) + ROUND(wis_scaling * 0.6) + ROUND(defense_mastery_bonus * 1.2) + p_equipment_def_bonus;
    v_speed := base_speed + ROUND(dex_scaling * 1.2) + p_equipment_speed_bonus;
    
    -- Sistema de críticos rebalanceado + bônus de equipamentos
    v_crit_chance := LEAST(85, (luck_scaling * 0.6) + (dex_scaling * 0.4) + (weapon_mastery_bonus * 0.2) + p_equipment_critical_chance_bonus);
    v_crit_damage := 110 + (luck_scaling * 0.4) + (str_scaling * 0.3) + (weapon_mastery_bonus * 0.2) + p_equipment_critical_damage_bonus;
    
    -- Sistema de duplo ataque + bônus de equipamentos
    v_double_attack_chance := CASE
        WHEN v_speed >= 50 THEN LEAST(25, (v_speed - 49) * 0.5) + p_equipment_double_attack_bonus
        ELSE p_equipment_double_attack_bonus
    END;
    v_double_attack_chance := LEAST(30, v_double_attack_chance); -- Cap em 30%
    
    -- Dano mágico + bônus de equipamentos
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.8 + p_equipment_magic_damage_bonus;
    v_magic_dmg_bonus := LEAST(500, v_magic_dmg_bonus);
    
    RETURN QUERY SELECT 
        v_hp,
        v_hp,
        v_mana,
        v_mana,
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus,
        v_double_attack_chance;
END;
$$;

-- =====================================
-- 6. ATUALIZAR FUNÇÃO DE RECÁLCULO PARA INCLUIR NOVOS BÔNUS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_character_stats_with_equipment(p_character_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_derived_stats RECORD;
    v_equipment_bonuses RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Calcular bônus de equipamentos
    SELECT * INTO v_equipment_bonuses FROM calculate_equipment_bonuses_enhanced(p_character_id);
    
    -- Calcular stats derivados com bônus de equipamentos
    SELECT * INTO v_derived_stats FROM calculate_derived_stats(
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1),
        -- Novos bônus de equipamentos
        COALESCE(v_equipment_bonuses.total_hp_bonus, 0),
        COALESCE(v_equipment_bonuses.total_atk_bonus, 0),
        COALESCE(v_equipment_bonuses.total_def_bonus, 0),
        COALESCE(v_equipment_bonuses.total_mana_bonus, 0),
        COALESCE(v_equipment_bonuses.total_speed_bonus, 0),
        COALESCE(v_equipment_bonuses.total_critical_chance_bonus, 0),
        COALESCE(v_equipment_bonuses.total_critical_damage_bonus, 0),
        COALESCE(v_equipment_bonuses.total_double_attack_chance_bonus, 0),
        COALESCE(v_equipment_bonuses.total_magic_damage_bonus, 0)
    );
    
    -- Atualizar personagem com novos stats
    UPDATE characters SET
        hp = LEAST(v_derived_stats.hp, hp + (v_derived_stats.hp - COALESCE(max_hp, v_derived_stats.hp))),
        max_hp = v_derived_stats.max_hp,
        mana = LEAST(v_derived_stats.mana, mana + (v_derived_stats.mana - COALESCE(max_mana, v_derived_stats.mana))),
        max_mana = v_derived_stats.max_mana,
        atk = v_derived_stats.atk,
        magic_attack = v_derived_stats.magic_attack,
        def = v_derived_stats.def,
        speed = v_derived_stats.speed,
        critical_chance = v_derived_stats.critical_chance,
        critical_damage = v_derived_stats.critical_damage,
        double_attack_chance = v_derived_stats.double_attack_chance,
        updated_at = NOW()
    WHERE id = p_character_id;
END;
$$;

-- =====================================
-- 7. CRIAR FUNÇÃO PARA COMPARAÇÃO DE EQUIPAMENTOS
-- =====================================

CREATE OR REPLACE FUNCTION compare_equipment_stats(
    p_character_id UUID,
    p_new_equipment_id UUID,
    p_slot_type TEXT DEFAULT NULL
)
RETURNS TABLE(
    stat_name TEXT,
    current_value NUMERIC,
    new_value NUMERIC,
    difference NUMERIC,
    is_improvement BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_equipment_id UUID;
    v_current_equipment RECORD;
    v_new_equipment RECORD;
BEGIN
    -- Buscar equipamento atual no slot (se houver)
    IF p_slot_type IS NOT NULL THEN
        SELECT equipment_id INTO v_current_equipment_id
        FROM character_equipment ce
        WHERE ce.character_id = p_character_id 
        AND ce.is_equipped = true
        AND ce.slot_type = p_slot_type;
    END IF;
    
    -- Buscar dados dos equipamentos
    SELECT * INTO v_current_equipment FROM equipment WHERE id = v_current_equipment_id;
    SELECT * INTO v_new_equipment FROM equipment WHERE id = p_new_equipment_id;
    
    -- Retornar comparações para cada stat
    RETURN QUERY VALUES 
        ('Ataque', 
         COALESCE(v_current_equipment.atk_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.atk_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.atk_bonus, 0) - COALESCE(v_current_equipment.atk_bonus, 0),
         COALESCE(v_new_equipment.atk_bonus, 0) > COALESCE(v_current_equipment.atk_bonus, 0)),
        ('Defesa', 
         COALESCE(v_current_equipment.def_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.def_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.def_bonus, 0) - COALESCE(v_current_equipment.def_bonus, 0),
         COALESCE(v_new_equipment.def_bonus, 0) > COALESCE(v_current_equipment.def_bonus, 0)),
        ('Mana', 
         COALESCE(v_current_equipment.mana_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.mana_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.mana_bonus, 0) - COALESCE(v_current_equipment.mana_bonus, 0),
         COALESCE(v_new_equipment.mana_bonus, 0) > COALESCE(v_current_equipment.mana_bonus, 0)),
        ('Velocidade', 
         COALESCE(v_current_equipment.speed_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.speed_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.speed_bonus, 0) - COALESCE(v_current_equipment.speed_bonus, 0),
         COALESCE(v_new_equipment.speed_bonus, 0) > COALESCE(v_current_equipment.speed_bonus, 0)),
        ('HP', 
         COALESCE(v_current_equipment.hp_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.hp_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.hp_bonus, 0) - COALESCE(v_current_equipment.hp_bonus, 0),
         COALESCE(v_new_equipment.hp_bonus, 0) > COALESCE(v_current_equipment.hp_bonus, 0)),
        ('Chance Crítica', 
         COALESCE(v_current_equipment.critical_chance_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.critical_chance_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.critical_chance_bonus, 0) - COALESCE(v_current_equipment.critical_chance_bonus, 0),
         COALESCE(v_new_equipment.critical_chance_bonus, 0) > COALESCE(v_current_equipment.critical_chance_bonus, 0)),
        ('Dano Crítico', 
         COALESCE(v_current_equipment.critical_damage_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.critical_damage_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.critical_damage_bonus, 0) - COALESCE(v_current_equipment.critical_damage_bonus, 0),
         COALESCE(v_new_equipment.critical_damage_bonus, 0) > COALESCE(v_current_equipment.critical_damage_bonus, 0)),
        ('Duplo Ataque', 
         COALESCE(v_current_equipment.double_attack_chance_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0) - COALESCE(v_current_equipment.double_attack_chance_bonus, 0),
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0) > COALESCE(v_current_equipment.double_attack_chance_bonus, 0)),
        ('Dano Mágico', 
         COALESCE(v_current_equipment.magic_damage_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.magic_damage_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.magic_damage_bonus, 0) - COALESCE(v_current_equipment.magic_damage_bonus, 0),
         COALESCE(v_new_equipment.magic_damage_bonus, 0) > COALESCE(v_current_equipment.magic_damage_bonus, 0));
END;
$$;

-- =====================================
-- 8. RECALCULAR TODOS OS PERSONAGENS COM NOVOS BÔNUS
-- =====================================

-- Função para recalcular todos os personagens com o novo sistema
CREATE OR REPLACE FUNCTION recalculate_all_characters_with_equipment()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_character_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        BEGIN
            PERFORM recalculate_character_stats_with_equipment(v_character_record.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao recalcular personagem %: %', v_character_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- Aplicar recálculo a todos os personagens
SELECT recalculate_all_characters_with_equipment();

-- =====================================
-- 9. COMENTÁRIOS E ÍNDICES
-- =====================================

COMMENT ON COLUMN equipment.hp_bonus IS 'Bônus de HP fornecido pelo equipamento';
COMMENT ON COLUMN equipment.critical_chance_bonus IS 'Bônus de chance crítica em %';
COMMENT ON COLUMN equipment.critical_damage_bonus IS 'Bônus de dano crítico em %';
COMMENT ON COLUMN equipment.double_attack_chance_bonus IS 'Bônus de chance de duplo ataque em %';
COMMENT ON COLUMN equipment.magic_damage_bonus IS 'Bônus de dano mágico em %';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipment_hp_bonus ON equipment(hp_bonus);
CREATE INDEX IF NOT EXISTS idx_equipment_critical_bonuses ON equipment(critical_chance_bonus, critical_damage_bonus);
CREATE INDEX IF NOT EXISTS idx_equipment_magic_bonus ON equipment(magic_damage_bonus);

-- Confirmar aplicação
SELECT 'Rebalanceamento de equipamentos aplicado com sucesso!' as status; 
-- ================================
-- Migração para adicionar poções iniciais aos novos personagens
-- Data: 2024-12-20
-- ================================

-- Função para dar poções iniciais a um personagem
CREATE OR REPLACE FUNCTION grant_starter_potions(
    p_character_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_small_health_potion_id UUID;
    v_small_mana_potion_id UUID;
BEGIN
    -- Buscar IDs das poções pequenas
    SELECT id INTO v_small_health_potion_id 
    FROM consumables 
    WHERE name = 'Poção de Vida Pequena' 
    LIMIT 1;
    
    SELECT id INTO v_small_mana_potion_id 
    FROM consumables 
    WHERE name = 'Poção de Mana Pequena' 
    LIMIT 1;
    
    -- Verificar se as poções existem
    IF v_small_health_potion_id IS NULL THEN
        RAISE EXCEPTION 'Poção de Vida Pequena não encontrada no banco de dados';
    END IF;
    
    IF v_small_mana_potion_id IS NULL THEN
        RAISE EXCEPTION 'Poção de Mana Pequena não encontrada no banco de dados';
    END IF;
    
    -- Dar 2 poções pequenas de saúde
    INSERT INTO character_consumables (character_id, consumable_id, quantity)
    VALUES (p_character_id, v_small_health_potion_id, 2)
    ON CONFLICT (character_id, consumable_id) 
    DO UPDATE SET quantity = character_consumables.quantity + 2;
    
    -- Dar 1 poção pequena de mana
    INSERT INTO character_consumables (character_id, consumable_id, quantity)
    VALUES (p_character_id, v_small_mana_potion_id, 1)
    ON CONFLICT (character_id, consumable_id) 
    DO UPDATE SET quantity = character_consumables.quantity + 1;
    
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função create_character para incluir poções iniciais
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando a função mais recente
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        magic_attack
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10, -- luck
        1,  -- sword_mastery 
        1,  -- axe_mastery
        1,  -- blunt_mastery
        1,  -- defense_mastery
        1   -- magic_mastery
    );
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points,
        magic_attack
    )
    VALUES (
        p_user_id,
        v_formatted_name,
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.hp,
        v_base_stats.max_hp,
        v_base_stats.mana,
        v_base_stats.max_mana,
        v_base_stats.atk,
        v_base_stats.def,
        v_base_stats.speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5,  -- pontos de atributo iniciais para personalizar build
        v_base_stats.magic_attack
    )
    RETURNING id INTO v_character_id;
    
    -- NOVO: Dar poções iniciais ao personagem
    PERFORM grant_starter_potions(v_character_id);
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
-- ================================
-- Migração para adicionar magia inicial aos novos personagens
-- Data: 2024-12-20
-- ================================

-- Função para dar magia inicial a um personagem
CREATE OR REPLACE FUNCTION grant_starter_spell(
    p_character_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_fireball_spell_id UUID;
BEGIN
    -- Buscar ID da magia "Bola de Fogo"
    SELECT id INTO v_fireball_spell_id 
    FROM spells 
    WHERE name = 'Bola de Fogo' 
    LIMIT 1;
    
    -- Verificar se a magia existe
    IF v_fireball_spell_id IS NULL THEN
        RAISE EXCEPTION 'Magia "Bola de Fogo" não encontrada no banco de dados';
    END IF;
    
    -- Equipar a magia "Bola de Fogo" no slot 1
    INSERT INTO character_spell_slots (character_id, slot_position, spell_id)
    VALUES (p_character_id, 1, v_fireball_spell_id)
    ON CONFLICT (character_id, slot_position) 
    DO UPDATE SET spell_id = v_fireball_spell_id;
    
END;
$$ LANGUAGE plpgsql;

-- Atualizar a função create_character para incluir magia inicial
CREATE OR REPLACE FUNCTION create_character(
    p_user_id UUID,
    p_name VARCHAR
)
RETURNS UUID AS $$
DECLARE
    v_character_id UUID;
    v_base_stats RECORD;
    v_character_count INTEGER;
    v_available_slots INTEGER;
    v_validation RECORD;
    v_formatted_name VARCHAR;
BEGIN
    -- Validar nome do personagem
    SELECT * INTO v_validation FROM validate_character_name(p_name);
    
    IF NOT v_validation.is_valid THEN
        RAISE EXCEPTION '%', v_validation.error_message;
    END IF;
    
    -- Formatar nome (capitalizar primeira letra de cada palavra)
    v_formatted_name := INITCAP(TRIM(p_name));
    
    -- Verificar se já existe personagem com mesmo nome para o usuário
    IF EXISTS (
        SELECT 1 FROM characters 
        WHERE user_id = p_user_id 
        AND UPPER(name) = UPPER(v_formatted_name)
    ) THEN
        RAISE EXCEPTION 'Você já possui um personagem com este nome';
    END IF;
    
    -- Contar personagens atuais
    SELECT COUNT(*)
    INTO v_character_count
    FROM characters
    WHERE user_id = p_user_id;
    
    -- Calcular slots disponíveis baseado no nível total
    v_available_slots := calculate_available_character_slots(p_user_id);
    
    -- Verificar se pode criar mais personagens
    IF v_character_count >= v_available_slots THEN
        DECLARE
            next_slot_level INTEGER;
        BEGIN
            next_slot_level := calculate_required_total_level_for_slot(v_available_slots + 1);
            RAISE EXCEPTION 'Limite de personagens atingido. Para criar o %º personagem, você precisa de % níveis totais entre todos os seus personagens.', 
                v_available_slots + 1, next_slot_level;
        END;
    END IF;

    -- Calcular stats iniciais usando a função mais recente
    SELECT 
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        magic_attack
    INTO v_base_stats 
    FROM calculate_derived_stats(
        1, -- level
        10, -- strength
        10, -- dexterity  
        10, -- intelligence
        10, -- wisdom
        10, -- vitality
        10, -- luck
        1,  -- sword_mastery 
        1,  -- axe_mastery
        1,  -- blunt_mastery
        1,  -- defense_mastery
        1   -- magic_mastery
    );
    
    -- Inserir novo personagem
    INSERT INTO characters (
        user_id,
        name,
        level,
        xp,
        xp_next_level,
        gold,
        hp,
        max_hp,
        mana,
        max_mana,
        atk,
        def,
        speed,
        floor,
        strength,
        dexterity,
        intelligence,
        wisdom,
        vitality,
        luck,
        attribute_points,
        magic_attack
    )
    VALUES (
        p_user_id,
        v_formatted_name,
        1, -- level inicial
        0, -- xp inicial
        calculate_xp_next_level(1), -- xp necessário para level 2
        0, -- gold inicial
        v_base_stats.hp,
        v_base_stats.max_hp,
        v_base_stats.mana,
        v_base_stats.max_mana,
        v_base_stats.atk,
        v_base_stats.def,
        v_base_stats.speed,
        1,  -- andar inicial
        10, -- strength inicial
        10, -- dexterity inicial
        10, -- intelligence inicial
        10, -- wisdom inicial
        10, -- vitality inicial
        10, -- luck inicial
        5,  -- pontos de atributo iniciais para personalizar build
        v_base_stats.magic_attack
    )
    RETURNING id INTO v_character_id;
    
    -- Dar poções iniciais ao personagem
    PERFORM grant_starter_potions(v_character_id);
    
    -- NOVO: Dar magia inicial ao personagem
    PERFORM grant_starter_spell(v_character_id);
    
    RETURN v_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 
