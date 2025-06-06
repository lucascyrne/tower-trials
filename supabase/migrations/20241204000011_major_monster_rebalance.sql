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

COMMENT ON FUNCTION get_monster_for_floor_cyclic(INTEGER) IS 
'REBALANCEAMENTO DRÁSTICO: Sistema de monstros MUITO mais desafiador.
- HP base 3-5x maior (200+ para bosses, 80-120 para normais)
- Atributos base 2-3x maiores para especialização extrema
- Escalamento 2.2x por tier (era 1.8x) = 22% mais stats por tier
- Bosses escalam 2.5x = 25% mais stats por tier
- Resistências muito mais significativas (até 60% crítico, 50% físico/mágico)
- Levels coerentes com progressão do player (floor/2)
- Recompensas 1.5-2x maiores para compensar dificuldade';

-- Migração aplicada com sucesso
-- Rebalanceamento DRÁSTICO dos monstros implementado 