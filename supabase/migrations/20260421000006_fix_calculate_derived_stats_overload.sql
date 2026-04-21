-- calculate_derived_stats existia em duas assinaturas compatíveis com 12 argumentos:
-- (12× INTEGER) da migração 0004 e (12× INTEGER + 8 com default) do squash → erro 42725.
-- Remove a sobrecarga de 12 parâmetros e mantém uma única função com bônus de equipamento
-- e fórmulas alinhadas à 0004.

DROP FUNCTION IF EXISTS calculate_derived_stats(
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER,
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
);

CREATE OR REPLACE FUNCTION calculate_derived_stats(
    p_level INTEGER,
    p_strength INTEGER DEFAULT 10,
    p_dexterity INTEGER DEFAULT 10,
    p_intelligence INTEGER DEFAULT 10,
    p_wisdom INTEGER DEFAULT 10,
    p_vitality INTEGER DEFAULT 10,
    p_luck INTEGER DEFAULT 10,
    p_sword_mastery INTEGER DEFAULT 1,
    p_axe_mastery INTEGER DEFAULT 1,
    p_blunt_mastery INTEGER DEFAULT 1,
    p_defense_mastery INTEGER DEFAULT 1,
    p_magic_mastery INTEGER DEFAULT 1,
    p_equipment_hp_bonus INTEGER DEFAULT 0,
    p_equipment_atk_bonus INTEGER DEFAULT 0,
    p_equipment_def_bonus INTEGER DEFAULT 0,
    p_equipment_mana_bonus INTEGER DEFAULT 0,
    p_equipment_speed_bonus INTEGER DEFAULT 0,
    p_equipment_critical_chance_bonus NUMERIC(5, 2) DEFAULT 0,
    p_equipment_critical_damage_bonus NUMERIC(5, 2) DEFAULT 0,
    p_equipment_double_attack_bonus NUMERIC(5, 2) DEFAULT 0,
    p_equipment_magic_damage_bonus NUMERIC(5, 2) DEFAULT 0
)
RETURNS TABLE (
    hp INTEGER,
    max_hp INTEGER,
    mana INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    magic_attack INTEGER,
    def INTEGER,
    speed INTEGER,
    critical_chance NUMERIC(5, 2),
    critical_damage NUMERIC(5, 2),
    magic_damage_bonus NUMERIC(5, 2),
    double_attack_chance NUMERIC(5, 2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    base_hp INTEGER := 38 + (p_level * 2);
    base_mana INTEGER := 14 + (p_level * 1);
    base_atk INTEGER := 1 + FLOOR(p_level * 0.45);
    base_magic_atk INTEGER := 1 + FLOOR(p_level * 0.45);
    base_def INTEGER := 1 + FLOOR(p_level * 0.28);
    base_speed INTEGER := 3 + FLOOR(p_level * 0.45);

    str_scaling NUMERIC := POWER(p_strength, 1.12);
    dex_scaling NUMERIC := POWER(p_dexterity, 1.1);
    int_scaling NUMERIC := POWER(p_intelligence, 1.22);
    wis_scaling NUMERIC := POWER(p_wisdom, 1.06);
    vit_scaling NUMERIC := POWER(p_vitality, 1.22);
    luck_scaling NUMERIC := p_luck * 0.65;

    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.04) * 0.18;
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.08) * 0.35;
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.1) * 0.72;

    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5, 2);
    v_crit_damage NUMERIC(5, 2);
    v_magic_dmg_bonus NUMERIC(5, 2);
    v_double_attack NUMERIC(5, 2);
BEGIN
    v_hp := base_hp + ROUND(vit_scaling * 2.1) + p_equipment_hp_bonus;

    v_mana := base_mana + ROUND(int_scaling * 1.35) + ROUND(wis_scaling * 1.05) + ROUND(magic_mastery_bonus * 0.45)
        + p_equipment_mana_bonus;

    v_atk := base_atk + ROUND(str_scaling * 1.0) + ROUND(weapon_mastery_bonus) + p_equipment_atk_bonus;

    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.55) + ROUND(wis_scaling * 0.55) + ROUND(magic_mastery_bonus * 0.92);

    v_def := base_def + ROUND(vit_scaling * 0.45) + ROUND(wis_scaling * 0.35) + ROUND(defense_mastery_bonus)
        + p_equipment_def_bonus;

    v_speed := base_speed + ROUND(dex_scaling * 0.72) + p_equipment_speed_bonus;

    v_crit_chance := LEAST(
        58,
        (luck_scaling * 0.26) + (dex_scaling * 0.17) + (weapon_mastery_bonus * 0.09)
            + COALESCE(p_equipment_critical_chance_bonus, 0)
    );

    v_crit_damage := 125 + (luck_scaling * 0.52) + (str_scaling * 0.35) + (weapon_mastery_bonus * 0.25)
        + COALESCE(p_equipment_critical_damage_bonus, 0);

    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.85 + COALESCE(p_equipment_magic_damage_bonus, 0);
    v_magic_dmg_bonus := LEAST(340, v_magic_dmg_bonus);

    v_double_attack := LEAST(
        18,
        GREATEST(0, v_speed - 5) * 0.22 + COALESCE(p_equipment_double_attack_bonus, 0)
    );

    RETURN QUERY
    SELECT
        v_hp,
        v_hp,
        v_mana,
        v_mana,
        v_atk,
        v_magic_atk,
        v_def,
        v_speed,
        v_crit_chance,
        v_crit_damage,
        v_magic_dmg_bonus,
        v_double_attack;
END;
$$;
