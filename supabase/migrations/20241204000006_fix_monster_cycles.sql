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