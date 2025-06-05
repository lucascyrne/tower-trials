-- Script para corrigir problemas com função get_monster_for_floor
-- Execute este script para resolver conflitos de função

-- PASSO 1: Verificar funções existentes
SELECT 'Verificando funções existentes...' as status;
SELECT 
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as return_type
FROM pg_proc 
WHERE proname IN ('get_monster_for_floor', 'get_monster_for_floor_cyclic')
ORDER BY proname;

-- PASSO 2: Remover TODAS as versões da função para evitar conflitos
SELECT 'Removendo funções existentes...' as status;

-- Remover todas as versões possíveis
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS get_monster_for_floor_cyclic(INTEGER) CASCADE;

-- PASSO 3: Verificar e adicionar colunas necessárias
SELECT 'Verificando estrutura da tabela...' as status;

-- Adicionar colunas faltantes se necessário
DO $$
BEGIN
  -- Adicionar level se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'level'
  ) THEN
    ALTER TABLE monsters ADD COLUMN level INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna level adicionada';
  END IF;

  -- Adicionar tier se não existir  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'tier'
  ) THEN
    ALTER TABLE monsters ADD COLUMN tier INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna tier adicionada';
  END IF;

  -- Adicionar base_tier se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'base_tier'
  ) THEN
    ALTER TABLE monsters ADD COLUMN base_tier INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna base_tier adicionada';
  END IF;

  -- Adicionar cycle_position se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'cycle_position'
  ) THEN
    ALTER TABLE monsters ADD COLUMN cycle_position INTEGER DEFAULT 1;
    RAISE NOTICE 'Coluna cycle_position adicionada';
  END IF;

  -- Adicionar is_boss se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'is_boss'
  ) THEN
    ALTER TABLE monsters ADD COLUMN is_boss BOOLEAN DEFAULT FALSE;
    RAISE NOTICE 'Coluna is_boss adicionada';
  END IF;

  -- Adicionar image se não existir
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'monsters' AND column_name = 'image'
  ) THEN
    ALTER TABLE monsters ADD COLUMN image TEXT DEFAULT NULL;
    RAISE NOTICE 'Coluna image adicionada';
  END IF;
END $$;

-- PASSO 4: Recriar funções auxiliares
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
  
  -- Escalonamento exponencial
  RETURN (p_base_stat * POWER(p_scaling_factor, p_current_tier - p_base_tier))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- PASSO 5: Recriar função principal com tipo correto
SELECT 'Recriando função principal...' as status;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
  id UUID,
  name VARCHAR(100),
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
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, false) = true
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum para esta posição no ciclo
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, false) = false
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
      AND COALESCE(m.is_boss, false) = (target_cycle_position = ANY(boss_floors))
    ORDER BY COALESCE(m.cycle_position, m.min_floor) DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, pegar qualquer monstro do tipo
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, false) = (target_cycle_position = ANY(boss_floors))
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Se ainda não encontrou, pegar qualquer monstro
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
  
  -- Retornar monstro com stats escalados
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name::VARCHAR(100),
    -- Level escalado
    GREATEST(COALESCE(selected_monster.level, 1), (current_tier - 1) * 20 + COALESCE(selected_monster.level, 1))::INTEGER,
    -- Stats principais escalados
    scale_monster_stats(selected_monster.hp, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.atk, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.def, current_tier)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.mana, 0), current_tier)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.speed, 10), current_tier)::INTEGER,
    selected_monster.behavior,
    p_floor, -- min_floor ajustado para andar atual
    -- Recompensas escaladas
    scale_monster_stats(selected_monster.reward_xp, current_tier)::INTEGER,
    scale_monster_stats(selected_monster.reward_gold, current_tier)::INTEGER,
    COALESCE(selected_monster.image, '')::TEXT,
    current_tier::INTEGER,
    COALESCE(selected_monster.base_tier, 1)::INTEGER,
    target_cycle_position::INTEGER,
    COALESCE(selected_monster.is_boss, false)::BOOLEAN,
    -- Atributos primários escalados
    COALESCE(scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier), 10)::INTEGER,
    COALESCE(scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier), 5)::INTEGER,
    -- Propriedades de combate (escalamento moderado)
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
    COALESCE(selected_monster.primary_trait, NULL::monster_trait),
    COALESCE(selected_monster.secondary_trait, NULL::monster_trait),
    COALESCE(selected_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- PASSO 6: Atualizar dados dos monstros se necessário
SELECT 'Atualizando dados dos monstros...' as status;

-- Atualizar dados do sistema cíclico
UPDATE monsters SET 
  tier = 1,
  base_tier = 1,
  cycle_position = min_floor,
  is_boss = CASE 
    WHEN min_floor IN (5, 10, 15, 20) THEN TRUE 
    ELSE FALSE 
  END;

-- Atualizar níveis baseados no min_floor
UPDATE monsters SET 
  level = CASE 
    WHEN min_floor <= 5 THEN GREATEST(1, min_floor)
    WHEN min_floor <= 10 THEN GREATEST(6, min_floor - 5 + 6)
    WHEN min_floor <= 15 THEN GREATEST(11, min_floor - 10 + 11)
    ELSE GREATEST(16, min_floor - 15 + 16)
  END;

-- PASSO 7: Testar função
SELECT 'Testando função...' as status;

-- Teste básico
SELECT 
  'Teste andar 1' as test_name,
  name, 
  level, 
  hp, 
  atk, 
  def, 
  tier, 
  cycle_position, 
  is_boss
FROM get_monster_for_floor(1) 
LIMIT 1;

SELECT 
  'Teste andar 21 (Tier 2)' as test_name,
  name, 
  level, 
  hp, 
  atk, 
  def, 
  tier, 
  cycle_position, 
  is_boss
FROM get_monster_for_floor(21) 
LIMIT 1;

-- PASSO 8: Criar índices se não existirem
CREATE INDEX IF NOT EXISTS idx_monsters_tier ON monsters(tier);
CREATE INDEX IF NOT EXISTS idx_monsters_cycle_position ON monsters(cycle_position);
CREATE INDEX IF NOT EXISTS idx_monsters_is_boss ON monsters(is_boss);
CREATE INDEX IF NOT EXISTS idx_monsters_tier_cycle ON monsters(tier, cycle_position);

SELECT 'Script concluído com sucesso!' as final_status; 