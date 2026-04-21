-- Corrige dados corrompidos de monstros e garante retorno não-negativo no RPC de floor.

UPDATE monsters
SET
  hp = GREATEST(1, COALESCE(hp, 1)),
  atk = GREATEST(1, COALESCE(atk, 1)),
  def = GREATEST(0, COALESCE(def, 0)),
  mana = GREATEST(0, COALESCE(mana, 0)),
  speed = GREATEST(1, COALESCE(speed, 1)),
  level = GREATEST(1, COALESCE(level, 1)),
  tier = GREATEST(1, COALESCE(tier, 1)),
  base_tier = GREATEST(1, COALESCE(base_tier, 1)),
  cycle_position = GREATEST(1, COALESCE(cycle_position, 1));

CREATE OR REPLACE FUNCTION scale_monster_stats_with_floor(
  p_base_stat DECIMAL,
  p_current_tier INTEGER,
  p_cycle_position INTEGER,
  p_is_boss BOOLEAN DEFAULT FALSE,
  p_stat_type TEXT DEFAULT 'hp'
) RETURNS INTEGER AS $$
DECLARE
  base_multiplier DECIMAL;
  boss_multiplier DECIMAL := 1.62;
  tier_floor INTEGER;
  final_stat INTEGER;

  tier_1_floor_hp INTEGER := 88;
  tier_1_floor_atk INTEGER := 27;
  tier_1_floor_def INTEGER := 16;
BEGIN
  base_multiplier := POWER(2.56, GREATEST(1, p_current_tier) - 1);

  IF p_is_boss THEN
    base_multiplier := base_multiplier * boss_multiplier;
  END IF;

  final_stat := (GREATEST(0, COALESCE(p_base_stat, 0)) * base_multiplier)::INTEGER;

  CASE p_stat_type
    WHEN 'hp' THEN
      tier_floor := (tier_1_floor_hp * POWER(2.56, GREATEST(1, p_current_tier) - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      final_stat := GREATEST(final_stat, tier_floor, 1);
    WHEN 'atk' THEN
      tier_floor := (tier_1_floor_atk * POWER(2.56, GREATEST(1, p_current_tier) - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      final_stat := GREATEST(final_stat, tier_floor, 1);
    WHEN 'def' THEN
      tier_floor := (tier_1_floor_def * POWER(2.56, GREATEST(1, p_current_tier) - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
      final_stat := GREATEST(final_stat, tier_floor, 0);
    ELSE
      final_stat := GREATEST(final_stat, 0);
  END CASE;

  final_stat := final_stat + (final_stat * GREATEST(0, p_cycle_position - 1) * 0.055)::INTEGER;

  IF p_stat_type IN ('hp', 'atk') THEN
    final_stat := GREATEST(final_stat, 1);
  ELSE
    final_stat := GREATEST(final_stat, 0);
  END IF;

  RETURN final_stat;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- IMPORTANTE: CREATE OR REPLACE não permite mudar rowtype de RETURNS TABLE.
-- Em ambientes onde a assinatura antiga divergiu, precisamos dropar antes de recriar.
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
  primary_trait monster_trait,
  secondary_trait monster_trait,
  special_abilities TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.name::TEXT,
    GREATEST(1, COALESCE(m.level, 1)),
    GREATEST(1, COALESCE(m.hp, 1)),
    GREATEST(1, COALESCE(m.atk, 1)),
    GREATEST(0, COALESCE(m.def, 0)),
    GREATEST(0, COALESCE(m.mana, 0)),
    GREATEST(1, COALESCE(m.speed, 1)),
    m.behavior,
    m.min_floor,
    GREATEST(1, COALESCE(m.reward_xp, 1)),
    GREATEST(1, COALESCE(m.reward_gold, 1)),
    COALESCE(m.image, ''),
    GREATEST(1, COALESCE(m.tier, 1)),
    GREATEST(1, COALESCE(m.base_tier, 1)),
    GREATEST(1, COALESCE(m.cycle_position, 1)),
    COALESCE(m.is_boss, false),
    GREATEST(1, COALESCE(m.strength, 1)),
    GREATEST(1, COALESCE(m.dexterity, 1)),
    GREATEST(1, COALESCE(m.intelligence, 1)),
    GREATEST(1, COALESCE(m.wisdom, 1)),
    GREATEST(1, COALESCE(m.vitality, 1)),
    GREATEST(1, COALESCE(m.luck, 1)),
    GREATEST(0::DECIMAL, COALESCE(m.critical_chance, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.critical_damage, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.critical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.physical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.magical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.debuff_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.physical_vulnerability, 0)),
    GREATEST(0::DECIMAL, COALESCE(m.magical_vulnerability, 0)),
    m.primary_trait,
    m.secondary_trait,
    COALESCE(m.special_abilities, ARRAY[]::TEXT[])
  FROM get_monster_for_floor_cyclic(p_floor) m;
END;
$$ LANGUAGE plpgsql;
