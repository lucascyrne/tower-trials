A-- ================================
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