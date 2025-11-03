-- =============================================
-- MIGRATION: Sistema de Usuários
-- Version: 2.0
-- Description: Tabela de usuários, progressão e slots de personagens
-- Dependencies: 00001
-- =============================================

-- === TABELAS ===

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

-- === ÍNDICES ===

CREATE INDEX IF NOT EXISTS idx_users_uid ON public.users(uid);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- === TRIGGERS ===

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- === FUNÇÕES ===

-- Calcular nível total necessário para desbloquear um slot
CREATE OR REPLACE FUNCTION calculate_required_total_level_for_slot(slot_number INTEGER)
RETURNS INTEGER AS $$
BEGIN
    IF slot_number <= 3 THEN
        RETURN 0; -- Slots 1-3 são gratuitos
    END IF;
    RETURN (slot_number - 3) * 15; -- Fórmula: (slot - 3) * 15
END;
$$ LANGUAGE plpgsql;

-- Calcular quantos slots de personagem um usuário pode ter
CREATE OR REPLACE FUNCTION calculate_available_character_slots(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    total_level INTEGER := 0;
    available_slots INTEGER := 3;
    current_slot INTEGER := 4;
    required_level INTEGER;
BEGIN
    SELECT COALESCE(SUM(level), 0) 
    INTO total_level
    FROM characters 
    WHERE user_id = p_user_id;
    
    LOOP
        required_level := calculate_required_total_level_for_slot(current_slot);
        
        IF total_level >= required_level THEN
            available_slots := current_slot;
            current_slot := current_slot + 1;
        ELSE
            EXIT;
        END IF;
        
        IF current_slot > 20 THEN
            EXIT; -- Limite de segurança
        END IF;
    END LOOP;
    
    RETURN available_slots;
END;
$$ LANGUAGE plpgsql;

-- Atualizar progressão do usuário (nível total e slots)
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
    SELECT max_character_slots INTO old_slots
    FROM users WHERE uid = p_user_id;
    
    SELECT COALESCE(SUM(level), 0)
    INTO new_total_level
    FROM characters 
    WHERE user_id = p_user_id;
    
    new_available_slots := calculate_available_character_slots(p_user_id);
    
    UPDATE users 
    SET 
        total_character_level = new_total_level,
        max_character_slots = new_available_slots,
        updated_at = NOW()
    WHERE uid = p_user_id;
    
    RETURN QUERY SELECT 
        new_total_level,
        new_available_slots,
        (new_available_slots > old_slots) AS slots_unlocked;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar perfil de usuário
CREATE OR REPLACE FUNCTION create_user_profile(p_uid UUID, p_username VARCHAR, p_email VARCHAR)
RETURNS void AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.users WHERE uid = p_uid) THEN
        RETURN;
    END IF;
    
    INSERT INTO public.users (
        uid, username, email, role, highest_floor, total_games, total_victories,
        total_character_level, max_character_slots, is_active, created_at, updated_at
    ) VALUES (
        p_uid, p_username, p_email, 'PLAYER', 0, 0, 0, 0, 3, true, NOW(), NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS (políticas na migração 00015)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

