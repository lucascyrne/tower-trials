-- Monstros: leve aumento de pisos e de boss multiplier (complementa nerfs no cliente / derived stats).
-- Cliente: lista de personagens passa a expor highest_floor (cache alinhado a checkpoints).

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
  base_multiplier := POWER(2.56, p_current_tier - 1);

  IF p_is_boss THEN
    base_multiplier := base_multiplier * boss_multiplier;
  END IF;

  final_stat := (p_base_stat * base_multiplier)::INTEGER;

  CASE p_stat_type
    WHEN 'hp' THEN
      tier_floor := (tier_1_floor_hp * POWER(2.56, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
    WHEN 'atk' THEN
      tier_floor := (tier_1_floor_atk * POWER(2.56, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
    WHEN 'def' THEN
      tier_floor := (tier_1_floor_def * POWER(2.56, p_current_tier - 1))::INTEGER;
      IF p_is_boss THEN
        tier_floor := (tier_floor * 1.5)::INTEGER;
      END IF;
    ELSE
      tier_floor := final_stat;
  END CASE;

  final_stat := GREATEST(final_stat, tier_floor);
  final_stat := final_stat + (final_stat * (p_cycle_position - 1) * 0.055)::INTEGER;

  RETURN final_stat;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION scale_monster_stats_with_floor(DECIMAL, INTEGER, INTEGER, BOOLEAN, TEXT) IS
'Escalamento de monstro: pisos e tier ligeiramente mais altos (rebalance 2026-04).';

DROP FUNCTION IF EXISTS get_user_characters(UUID);

CREATE OR REPLACE FUNCTION get_user_characters(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    name VARCHAR(100),
    level INTEGER,
    xp INTEGER,
    xp_next_level INTEGER,
    gold INTEGER,
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor INTEGER,
    highest_floor INTEGER,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    attribute_points INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    sword_mastery INTEGER,
    axe_mastery INTEGER,
    blunt_mastery INTEGER,
    defense_mastery INTEGER,
    magic_mastery INTEGER,
    sword_mastery_xp INTEGER,
    axe_mastery_xp INTEGER,
    blunt_mastery_xp INTEGER,
    defense_mastery_xp INTEGER,
    magic_mastery_xp INTEGER,
    is_alive BOOLEAN,
    last_activity TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.xp,
        c.xp_next_level,
        c.gold,
        c.hp,
        c.max_hp,
        c.mana,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        COALESCE(c.highest_floor, c.floor),
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.attribute_points,
        c.critical_chance,
        c.critical_damage,
        c.sword_mastery,
        c.axe_mastery,
        c.blunt_mastery,
        c.defense_mastery,
        c.magic_mastery,
        c.sword_mastery_xp,
        c.axe_mastery_xp,
        c.blunt_mastery_xp,
        c.defense_mastery_xp,
        c.magic_mastery_xp,
        COALESCE(c.is_alive, true),
        c.last_activity,
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id
      AND COALESCE(c.is_alive, true) = true
    ORDER BY c.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
