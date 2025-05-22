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
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Função RPC para criar perfil de usuário com SECURITY DEFINER
CREATE OR REPLACE FUNCTION create_user_profile(p_uid UUID, p_username VARCHAR, p_email VARCHAR)
RETURNS void AS $$
BEGIN
  INSERT INTO public.users (
    uid, 
    username, 
    email, 
    role, 
    highest_floor, 
    total_games, 
    total_victories, 
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

-- Simplified RLS policies
CREATE POLICY "Enable read access for authenticated users"
    ON public.users
    FOR SELECT
    TO authenticated
    USING (true);

-- Permitir o service_role para realizar inserções
CREATE POLICY "Service role can insert users"
    ON public.users
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Permitir usuários autenticados atualizar apenas os próprios dados
CREATE POLICY "Enable update for users based on uid"
    ON public.users
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text::uuid = uid)
    WITH CHECK (auth.uid()::text::uuid = uid);

-- Grant permissions
GRANT ALL ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
GRANT USAGE ON SEQUENCE public.users_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.users_id_seq TO service_role;
GRANT EXECUTE ON FUNCTION create_user_profile TO anon;
GRANT EXECUTE ON FUNCTION create_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION create_user_profile TO service_role; 