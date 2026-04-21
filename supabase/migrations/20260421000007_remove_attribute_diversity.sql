-- Remove bônus/penalidade por "diversidade" e anti-mono-build em calculate_derived_stats_balanced.
-- Valores reais de combate vêm de calculate_derived_stats (migrações anteriores); esta função
-- ainda pode ser chamada por rotinas legadas no banco.

CREATE OR REPLACE FUNCTION calculate_derived_stats_balanced(
    p_character_id UUID,
    p_level INTEGER,
    p_strength INTEGER,
    p_dexterity INTEGER,
    p_intelligence INTEGER,
    p_wisdom INTEGER,
    p_vitality INTEGER,
    p_luck INTEGER,
    p_sword_mastery INTEGER,
    p_axe_mastery INTEGER,
    p_blunt_mastery INTEGER,
    p_defense_mastery INTEGER,
    p_magic_mastery INTEGER
)
RETURNS TABLE(
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5,2),
    critical_damage NUMERIC(5,2),
    magic_damage_bonus NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    str_scaling NUMERIC;
    dex_scaling NUMERIC;
    int_scaling NUMERIC;
    wis_scaling NUMERIC;
    vit_scaling NUMERIC;
    luck_scaling NUMERIC;
    weapon_mastery_bonus NUMERIC;
    def_mastery_bonus NUMERIC;
    magic_mastery_bonus NUMERIC;
    base_hp INTEGER;
    base_mana INTEGER;
    base_atk INTEGER;
    base_def INTEGER;
    base_speed INTEGER;
    final_hp INTEGER;
    final_mana INTEGER;
    final_atk INTEGER;
    final_magic_atk INTEGER;
    final_def INTEGER;
    final_speed INTEGER;
    final_crit_chance NUMERIC;
    final_crit_damage NUMERIC;
    final_magic_damage NUMERIC;
BEGIN
    str_scaling := POWER(p_strength, 1.2);
    dex_scaling := POWER(p_dexterity, 1.15);
    int_scaling := POWER(p_intelligence, 1.25);
    wis_scaling := POWER(p_wisdom, 1.1);
    vit_scaling := POWER(p_vitality, 1.3);
    luck_scaling := p_luck;

    weapon_mastery_bonus := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.1);
    def_mastery_bonus := POWER(p_defense_mastery, 1.2);
    magic_mastery_bonus := POWER(p_magic_mastery, 1.15);

    base_hp := 50 + (p_level * 2);
    base_mana := 20 + (p_level * 1);
    base_atk := 2 + p_level;
    base_def := 1 + p_level;
    base_speed := 3 + p_level;

    final_hp := base_hp + FLOOR(vit_scaling * 2.5) + FLOOR(str_scaling * 0.3);
    final_mana := base_mana + FLOOR(int_scaling * 1.5) + FLOOR(wis_scaling * 1.0) + FLOOR(magic_mastery_bonus * 0.8);
    final_atk := base_atk + FLOOR(str_scaling * 1.2) + FLOOR(weapon_mastery_bonus * 0.6) + FLOOR(dex_scaling * 0.2);
    final_magic_atk := base_atk + FLOOR(int_scaling * 1.4) + FLOOR(wis_scaling * 0.8) + FLOOR(magic_mastery_bonus * 1.0);
    final_def := base_def + FLOOR(vit_scaling * 0.6) + FLOOR(wis_scaling * 0.5) + FLOOR(def_mastery_bonus * 1.0);
    final_speed := base_speed + FLOOR(dex_scaling * 1.0) + FLOOR(luck_scaling * 0.2);

    final_crit_chance := (dex_scaling * 0.25) + (luck_scaling * 0.35) + (str_scaling * 0.1);
    final_crit_chance := LEAST(75.0, final_crit_chance);

    final_crit_damage := 130.0 + (str_scaling * 0.4) + (luck_scaling * 0.6) + (weapon_mastery_bonus * 0.3);
    final_crit_damage := LEAST(250.0, final_crit_damage);

    final_magic_damage := (int_scaling * 1.2) + (wis_scaling * 0.8) + (magic_mastery_bonus * 1.5);
    IF final_magic_damage > 100 THEN
        final_magic_damage := 100 + ((final_magic_damage - 100) * 0.7);
    END IF;
    final_magic_damage := LEAST(200.0, final_magic_damage);

    RETURN QUERY SELECT
        final_hp,
        final_hp,
        final_mana,
        final_mana,
        final_atk,
        final_magic_atk,
        final_def,
        final_speed,
        final_crit_chance,
        final_crit_damage,
        final_magic_damage;
END;
$$;
