-- Corrige nível de monstro retornado pelas RPCs por andar.
-- Objetivo: evitar que todos inimigos apareçam como nível 1.

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
DECLARE
  v_floor INTEGER := GREATEST(1, COALESCE(p_floor, 1));
  v_monster RECORD;
  v_scaled_level INTEGER;
BEGIN
  SELECT m.*
  INTO v_monster
  FROM monsters m
  WHERE COALESCE(m.min_floor, 1) <= v_floor
  ORDER BY COALESCE(m.min_floor, 1) DESC, RANDOM()
  LIMIT 1;

  IF v_monster IS NULL THEN
    SELECT m.*
    INTO v_monster
    FROM monsters m
    ORDER BY RANDOM()
    LIMIT 1;
  END IF;

  IF v_monster IS NULL THEN
    RETURN;
  END IF;

  -- Escala mínima por andar para refletir progressão e evitar Nv 1 fixo.
  v_scaled_level := GREATEST(
    1,
    COALESCE(v_monster.level, 1),
    LEAST(100, 1 + FLOOR((v_floor - 1) / 2.0)::INTEGER)
  );

  RETURN QUERY
  SELECT
    v_monster.id,
    v_monster.name::TEXT,
    v_scaled_level,
    GREATEST(1, COALESCE(v_monster.hp, 1)),
    GREATEST(1, COALESCE(v_monster.atk, 1)),
    GREATEST(0, COALESCE(v_monster.def, 0)),
    GREATEST(0, COALESCE(v_monster.mana, 0)),
    GREATEST(1, COALESCE(v_monster.speed, 1)),
    v_monster.behavior,
    GREATEST(1, COALESCE(v_monster.min_floor, 1)),
    GREATEST(1, COALESCE(v_monster.reward_xp, 1)),
    GREATEST(1, COALESCE(v_monster.reward_gold, 1)),
    COALESCE(v_monster.image, ''),
    GREATEST(1, COALESCE(v_monster.tier, 1)),
    GREATEST(1, COALESCE(v_monster.base_tier, 1)),
    GREATEST(1, COALESCE(v_monster.cycle_position, 1)),
    COALESCE(v_monster.is_boss, false),
    GREATEST(1, COALESCE(v_monster.strength, 1)),
    GREATEST(1, COALESCE(v_monster.dexterity, 1)),
    GREATEST(1, COALESCE(v_monster.intelligence, 1)),
    GREATEST(1, COALESCE(v_monster.wisdom, 1)),
    GREATEST(1, COALESCE(v_monster.vitality, 1)),
    GREATEST(1, COALESCE(v_monster.luck, 1)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.critical_chance, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.critical_damage, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.critical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.physical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.magical_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.debuff_resistance, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.physical_vulnerability, 0)),
    GREATEST(0::DECIMAL, COALESCE(v_monster.magical_vulnerability, 0)),
    v_monster.primary_trait,
    v_monster.secondary_trait,
    COALESCE(v_monster.special_abilities, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql;

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
  RETURN QUERY SELECT * FROM get_monster_for_floor_cyclic(p_floor);
END;
$$ LANGUAGE plpgsql;
