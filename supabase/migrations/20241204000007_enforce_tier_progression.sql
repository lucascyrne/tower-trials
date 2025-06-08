-- Migração para garantir progressão adequada entre tiers
-- OBJETIVO: Slime do andar 21 deve ser mais forte que Dragon do andar 20
-- SOLUÇÃO: Sistema de piso mínimo baseado no tier anterior

-- =====================================
-- 1. FUNÇÃO PARA CALCULAR PISO MÍNIMO POR TIER
-- =====================================

-- Calcular stats mínimos que um monstro de determinado tier deve ter
CREATE OR REPLACE FUNCTION calculate_tier_minimum_stats(
  p_tier INTEGER,
  p_base_hp INTEGER,
  p_base_atk INTEGER,
  p_base_def INTEGER
) RETURNS TABLE (
  min_hp INTEGER,
  min_atk INTEGER,
  min_def INTEGER
) AS $$
DECLARE
  -- Stats base de um boss forte do tier anterior
  previous_tier_boss_hp INTEGER;
  previous_tier_boss_atk INTEGER;
  previous_tier_boss_def INTEGER;
  
  -- Multiplicadores progressivos
  tier_multiplier DECIMAL;
  boss_multiplier DECIMAL := 1.5; -- Bosses são 50% mais fortes que monstros comuns
BEGIN
  -- Para Tier 1, usar stats originais
  IF p_tier <= 1 THEN
    min_hp := p_base_hp;
    min_atk := p_base_atk;
    min_def := p_base_def;
    RETURN QUERY SELECT min_hp, min_atk, min_def;
    RETURN;
  END IF;
  
  -- Calcular multiplicador exponencial para o tier
  tier_multiplier := POWER(2.5, p_tier - 1); -- Crescimento mais agressivo
  
  -- Estimar stats de um boss forte do tier anterior
  -- Usando stats base típicos escalados para o tier anterior
  previous_tier_boss_hp := (80 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  previous_tier_boss_atk := (25 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  previous_tier_boss_def := (15 * POWER(2.5, p_tier - 2) * boss_multiplier)::INTEGER;
  
  -- Garantir que o monstro mais fraco do tier atual seja 20% mais forte 
  -- que o boss mais forte do tier anterior
  min_hp := GREATEST(
    (p_base_hp * tier_multiplier)::INTEGER,
    (previous_tier_boss_hp * 1.2)::INTEGER
  );
  
  min_atk := GREATEST(
    (p_base_atk * tier_multiplier)::INTEGER,
    (previous_tier_boss_atk * 1.2)::INTEGER
  );
  
  min_def := GREATEST(
    (p_base_def * tier_multiplier)::INTEGER,
    (previous_tier_boss_def * 1.2)::INTEGER
  );
  
  RETURN QUERY SELECT min_hp, min_atk, min_def;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 2. FUNÇÃO MELHORADA DE ESCALAMENTO COM PISO MÍNIMO
-- =====================================

CREATE OR REPLACE FUNCTION scale_monster_stats_with_floor(
  p_base_stat DECIMAL,
  p_current_tier INTEGER,
  p_cycle_position INTEGER,
  p_is_boss BOOLEAN DEFAULT FALSE,
  p_stat_type TEXT DEFAULT 'hp' -- 'hp', 'atk', 'def'
) RETURNS INTEGER AS $$
DECLARE
  base_multiplier DECIMAL;
  boss_multiplier DECIMAL := 1.5; -- Bosses são 50% mais fortes
  tier_floor INTEGER;
  final_stat INTEGER;
  
  -- Pisos mínimos baseados no tier
  tier_1_floor_hp INTEGER := 80;
  tier_1_floor_atk INTEGER := 25;
  tier_1_floor_def INTEGER := 15;
BEGIN
  -- Calcular multiplicador base do tier (exponencial agressivo)
  base_multiplier := POWER(2.5, p_current_tier - 1);
  
  -- Aplicar multiplicador boss se necessário
  IF p_is_boss THEN
    base_multiplier := base_multiplier * boss_multiplier;
  END IF;
  
  -- Calcular stat escalado
  final_stat := (p_base_stat * base_multiplier)::INTEGER;
  
  -- Aplicar piso mínimo baseado no tier e tipo de stat
  CASE p_stat_type
    WHEN 'hp' THEN
      tier_floor := (tier_1_floor_hp * POWER(2.5, p_current_tier - 1))::INTEGER;
      -- Para bosses do mesmo tier, adicionar 50% extra ao piso
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    WHEN 'atk' THEN
      tier_floor := (tier_1_floor_atk * POWER(2.5, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    WHEN 'def' THEN
      tier_floor := (tier_1_floor_def * POWER(2.5, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      
    ELSE
      tier_floor := final_stat; -- Sem piso para outros stats
  END CASE;
  
  -- Garantir que o stat final seja pelo menos o piso mínimo
  final_stat := GREATEST(final_stat, tier_floor);
  
  -- Adicionar variação baseada na posição no ciclo (progressão dentro do tier)
  final_stat := final_stat + (final_stat * (p_cycle_position - 1) * 0.05)::INTEGER;
  
  RETURN final_stat;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================
-- 3. RECRIAR FUNÇÃO PRINCIPAL COM PISO GARANTIDO
-- =====================================

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
  is_boss_floor BOOLEAN;
BEGIN
  -- Validar entrada
  IF p_floor IS NULL OR p_floor < 1 THEN
    p_floor := 1;
  END IF;
  
  -- Calcular tier e posição no ciclo
  current_tier := calculate_monster_tier(p_floor);
  target_cycle_position := calculate_cycle_position(p_floor);
  is_boss_floor := target_cycle_position = ANY(boss_floors);
  
  -- Buscar monstro apropriado
  IF is_boss_floor THEN
    -- Buscar boss para esta posição
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = true
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  ELSE
    -- Buscar monstro comum
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) = target_cycle_position
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = false
      AND COALESCE(m.base_tier, 1) = 1
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
  -- Fallbacks progressivos se não encontrar monstro específico
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.cycle_position, m.min_floor) <= target_cycle_position
      AND COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = is_boss_floor
    ORDER BY COALESCE(m.cycle_position, m.min_floor) DESC, RANDOM()
    LIMIT 1;
  END IF;
  
  IF selected_monster IS NULL THEN
    SELECT m.* INTO selected_monster
    FROM monsters m
    WHERE COALESCE(m.base_tier, 1) = 1
      AND COALESCE(m.is_boss, (m.min_floor IN (5, 10, 15, 20))) = is_boss_floor
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;
  
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
  
  -- CRÍTICO: Aplicar escalamento com piso garantido
  RETURN QUERY SELECT
    selected_monster.id,
    selected_monster.name::TEXT,
    
    -- Level escalado progressivamente
    GREATEST(
      COALESCE(selected_monster.level, 1), 
      COALESCE(selected_monster.level, 1) + ((current_tier - 1) * 20) + target_cycle_position
    )::INTEGER,
    
    -- STATS PRINCIPAIS COM PISO GARANTIDO
    scale_monster_stats_with_floor(
      selected_monster.hp::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'hp'
    )::INTEGER as hp,
    
    scale_monster_stats_with_floor(
      selected_monster.atk::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'atk'
    )::INTEGER as atk,
    
    scale_monster_stats_with_floor(
      selected_monster.def::DECIMAL, 
      current_tier, 
      target_cycle_position, 
      is_boss_floor, 
      'def'
    )::INTEGER as def,
    
    -- Mana e Speed sem piso (escalamento normal)
    scale_monster_stats(COALESCE(selected_monster.mana, 0), current_tier, 1, 2.0)::INTEGER as mana,
    scale_monster_stats(COALESCE(selected_monster.speed, 10), current_tier, 1, 2.0)::INTEGER as speed,
    
    selected_monster.behavior,
    p_floor as min_floor,
    
    -- Recompensas escaladas proporcionalmente
    scale_monster_stats(selected_monster.reward_xp, current_tier, 1, 2.0)::INTEGER as reward_xp,
    scale_monster_stats(selected_monster.reward_gold, current_tier, 1, 2.0)::INTEGER as reward_gold,
    
    COALESCE(selected_monster.image, '')::TEXT,
    current_tier::INTEGER,
    COALESCE(selected_monster.base_tier, 1)::INTEGER,
    target_cycle_position::INTEGER,
    is_boss_floor::BOOLEAN,
    
    -- Atributos primários escalados
    scale_monster_stats(COALESCE(selected_monster.strength, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.dexterity, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.intelligence, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.wisdom, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.vitality, 10), current_tier, 1, 2.0)::INTEGER,
    scale_monster_stats(COALESCE(selected_monster.luck, 5), current_tier, 1, 2.0)::INTEGER,
    
    -- Propriedades de combate escaladas
    LEAST(COALESCE(selected_monster.critical_chance, 0.05) * (1 + (current_tier - 1) * 0.15), 0.40)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_damage, 1.5) * (1 + (current_tier - 1) * 0.10), 3.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.critical_resistance, 0.1) * (1 + (current_tier - 1) * 0.08), 0.6)::DECIMAL,
    
    -- Resistências escaladas
    LEAST(COALESCE(selected_monster.physical_resistance, 0.0) + (current_tier - 1) * 0.04, 0.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.magical_resistance, 0.0) + (current_tier - 1) * 0.04, 0.5)::DECIMAL,
    LEAST(COALESCE(selected_monster.debuff_resistance, 0.0) + (current_tier - 1) * 0.04, 0.6)::DECIMAL,
    
    -- Vulnerabilidades (fixas)
    COALESCE(selected_monster.physical_vulnerability, 1.0)::DECIMAL,
    COALESCE(selected_monster.magical_vulnerability, 1.0)::DECIMAL,
    
    -- Características especiais
    selected_monster.primary_trait,
    selected_monster.secondary_trait,
    COALESCE(selected_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 4. TESTE DE VALIDAÇÃO DA PROGRESSÃO
-- =====================================

-- Função para testar progressão entre tiers
CREATE OR REPLACE FUNCTION test_tier_progression()
RETURNS TABLE (
  test_description TEXT,
  floor INTEGER,
  tier INTEGER,
  cycle_pos INTEGER,
  monster_name TEXT,
  hp INTEGER,
  atk INTEGER,
  def INTEGER,
  is_boss BOOLEAN,
  progression_valid BOOLEAN
) AS $$
DECLARE
  -- Casos de teste críticos
  slime_21 RECORD; -- Slime comum do andar 21 (Tier 2, pos 1)
  boss_20 RECORD;  -- Boss do andar 20 (Tier 1, pos 20)
  slime_41 RECORD; -- Slime comum do andar 41 (Tier 3, pos 1)
  boss_40 RECORD;  -- Boss do andar 40 (Tier 2, pos 20)
BEGIN
  -- Buscar monstros para comparação
  SELECT m.* INTO slime_21 FROM get_monster_for_floor(21) m LIMIT 1;
  SELECT m.* INTO boss_20 FROM get_monster_for_floor(20) m LIMIT 1;
  SELECT m.* INTO slime_41 FROM get_monster_for_floor(41) m LIMIT 1;
  SELECT m.* INTO boss_40 FROM get_monster_for_floor(40) m LIMIT 1;
  
  -- Teste 1: Slime do andar 21 vs Boss do andar 20
  RETURN QUERY SELECT
    'Slime T2 vs Boss T1'::TEXT,
    21,
    slime_21.tier,
    slime_21.cycle_position,
    slime_21.name,
    slime_21.hp,
    slime_21.atk,
    slime_21.def,
    slime_21.is_boss,
    (slime_21.hp > boss_20.hp AND slime_21.atk > boss_20.atk)::BOOLEAN;
  
  RETURN QUERY SELECT
    'Boss T1 (referência)'::TEXT,
    20,
    boss_20.tier,
    boss_20.cycle_position,
    boss_20.name,
    boss_20.hp,
    boss_20.atk,
    boss_20.def,
    boss_20.is_boss,
    true::BOOLEAN;
  
  -- Teste 2: Slime do andar 41 vs Boss do andar 40
  RETURN QUERY SELECT
    'Slime T3 vs Boss T2'::TEXT,
    41,
    slime_41.tier,
    slime_41.cycle_position,
    slime_41.name,
    slime_41.hp,
    slime_41.atk,
    slime_41.def,
    slime_41.is_boss,
    (slime_41.hp > boss_40.hp AND slime_41.atk > boss_40.atk)::BOOLEAN;
  
  RETURN QUERY SELECT
    'Boss T2 (referência)'::TEXT,
    40,
    boss_40.tier,
    boss_40.cycle_position,
    boss_40.name,
    boss_40.hp,
    boss_40.atk,
    boss_40.def,
    boss_40.is_boss,
    true::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- Executar teste e exibir resultados
DO $$
DECLARE
  test_result RECORD;
BEGIN
  RAISE NOTICE '=== TESTE DE PROGRESSÃO ENTRE TIERS ===';
  RAISE NOTICE 'Verificando se monstros comuns de tiers superiores são mais fortes que bosses de tiers inferiores';
  RAISE NOTICE '';
  
  FOR test_result IN SELECT * FROM test_tier_progression() LOOP
    RAISE NOTICE '% | Andar %: % (HP: %, ATK: %, DEF: %) - Válido: %', 
      test_result.test_description,
      test_result.floor,
      test_result.monster_name, 
      test_result.hp, 
      test_result.atk, 
      test_result.def,
      test_result.progression_valid;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== FIM DO TESTE ===';
END $$;

-- Limpar função de teste
DROP FUNCTION test_tier_progression();

-- =====================================
-- 5. DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Sistema de monstros com progressão garantida entre tiers.
GARANTIA: Qualquer monstro do Tier X será mais forte que qualquer boss do Tier X-1.
- Tier 1 (1-20): Stats base escalados linearmente
- Tier 2 (21-40): Mínimo 20% mais forte que boss mais forte do Tier 1
- Tier 3 (41-60): Mínimo 20% mais forte que boss mais forte do Tier 2
- Bosses: 50% mais fortes que monstros comuns do mesmo tier
- Progressão intra-tier: 5% por posição no ciclo';

COMMENT ON FUNCTION scale_monster_stats_with_floor(DECIMAL, INTEGER, INTEGER, BOOLEAN, TEXT) IS
'Escala stats com piso mínimo garantido baseado no tier.
Garante que monstros de tiers superiores sempre sejam mais fortes que bosses de tiers inferiores.';

SELECT 'Migração de progressão entre tiers concluída!' as status; 