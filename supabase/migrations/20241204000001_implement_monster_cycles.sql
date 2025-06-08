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