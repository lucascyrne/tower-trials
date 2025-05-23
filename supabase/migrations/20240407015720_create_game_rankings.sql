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