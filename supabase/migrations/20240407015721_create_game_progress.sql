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

-- Função para atualizar o andar do personagem
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_current_floor INTEGER;
BEGIN
    -- Obter user_id e andar atual do personagem
    SELECT user_id, floor INTO v_user_id, v_current_floor
    FROM characters
    WHERE id = p_character_id;
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    -- Verificar se o novo andar é maior que o atual para garantir progressão
    IF p_floor < v_current_floor THEN
        RAISE NOTICE 'Tentativa de retroceder andar rejeitada: % -> %', v_current_floor, p_floor;
        RETURN; -- Não permite retroceder de andar
    END IF;
    
    -- Atualizar andar na tabela de personagens
    UPDATE characters
    SET floor = p_floor
    WHERE id = p_character_id;
    
    -- Atualizar andar na tabela de progresso
    UPDATE game_progress
    SET current_floor = p_floor
    WHERE user_id = v_user_id;
    
    -- Atualizar highest_floor se necessário
    UPDATE game_progress
    SET highest_floor = GREATEST(highest_floor, p_floor)
    WHERE user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Habilitar RLS
ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;

-- Política para leitura do próprio progresso
CREATE POLICY "Usuários podem ler seu próprio progresso" ON game_progress
    FOR SELECT
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

-- Política para inserção do próprio progresso
CREATE POLICY "Usuários podem inserir seu próprio progresso" ON game_progress
    FOR INSERT
    WITH CHECK (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

-- Política para atualização do próprio progresso
CREATE POLICY "Usuários podem atualizar seu próprio progresso" ON game_progress
    FOR UPDATE
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid))
    WITH CHECK (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

-- Política para deleção do próprio progresso
CREATE POLICY "Usuários podem deletar seu próprio progresso" ON game_progress
    FOR DELETE
    USING (user_id IN (SELECT uid FROM users WHERE uid = auth.uid()::text::uuid));

-- Garantir que as funções possam ser executadas por usuários autenticados
GRANT EXECUTE ON FUNCTION update_character_floor TO authenticated; 