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