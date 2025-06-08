-- =====================================
-- MIGRAÇÃO: REBALANCEAMENTO E EXPANSÃO DE EQUIPAMENTOS
-- =====================================
-- Data: 2024-12-20
-- Versão: 20241220000004
-- Objetivo: Tornar equipamentos 20% mais fortes e adicionar novos tipos de bônus

-- =====================================
-- 1. ADICIONAR NOVOS CAMPOS DE BÔNUS
-- =====================================

-- Adicionar novos campos de bônus aos equipamentos
ALTER TABLE equipment 
ADD COLUMN IF NOT EXISTS hp_bonus INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_chance_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS critical_damage_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS double_attack_chance_bonus NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS magic_damage_bonus NUMERIC(5,2) DEFAULT 0;

-- =====================================
-- 2. REBALANCEAMENTO: AUMENTAR TODOS OS BÔNUS EM 20%
-- =====================================

-- Aumentar bônus existentes em 20% e garantir valores mínimos
UPDATE equipment SET
  atk_bonus = GREATEST(1, FLOOR(atk_bonus * 1.2)),
  def_bonus = GREATEST(1, FLOOR(def_bonus * 1.2)),
  mana_bonus = GREATEST(1, FLOOR(mana_bonus * 1.2)),
  speed_bonus = GREATEST(1, FLOOR(speed_bonus * 1.2))
WHERE atk_bonus > 0 OR def_bonus > 0 OR mana_bonus > 0 OR speed_bonus > 0;

-- =====================================
-- 3. ADICIONAR BÔNUS AVANÇADOS BASEADOS NO TIPO E RARIDADE
-- =====================================

-- Armas: Adicionar bônus de crítico e dano mágico
UPDATE equipment SET
  critical_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 8.0
    WHEN rarity = 'epic' THEN 6.0
    WHEN rarity = 'rare' THEN 4.0
    WHEN rarity = 'uncommon' THEN 2.0
    ELSE 1.0
  END,
  critical_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN 20.0
    WHEN rarity = 'epic' THEN 15.0
    WHEN rarity = 'rare' THEN 10.0
    WHEN rarity = 'uncommon' THEN 5.0
    ELSE 2.0
  END,
  double_attack_chance_bonus = CASE 
    WHEN weapon_subtype = 'dagger' THEN CASE 
      WHEN rarity = 'legendary' THEN 6.0
      WHEN rarity = 'epic' THEN 4.5
      WHEN rarity = 'rare' THEN 3.0
      WHEN rarity = 'uncommon' THEN 1.5
      ELSE 0.5
    END
    WHEN weapon_subtype IN ('sword', 'axe') THEN CASE 
      WHEN rarity = 'legendary' THEN 3.0
      WHEN rarity = 'epic' THEN 2.0
      WHEN rarity = 'rare' THEN 1.0
      ELSE 0.0
    END
    ELSE 0.0
  END,
  magic_damage_bonus = CASE 
    WHEN weapon_subtype = 'staff' THEN CASE 
      WHEN rarity = 'legendary' THEN 25.0
      WHEN rarity = 'epic' THEN 20.0
      WHEN rarity = 'rare' THEN 15.0
      WHEN rarity = 'uncommon' THEN 10.0
      ELSE 5.0
    END
    ELSE 0.0
  END
WHERE type = 'weapon';

-- Armaduras: Adicionar bônus de HP e defesa crítica
UPDATE equipment SET
  hp_bonus = CASE 
    WHEN rarity = 'legendary' THEN FLOOR(level_requirement * 8)
    WHEN rarity = 'epic' THEN FLOOR(level_requirement * 6)
    WHEN rarity = 'rare' THEN FLOOR(level_requirement * 4)
    WHEN rarity = 'uncommon' THEN FLOOR(level_requirement * 3)
    ELSE FLOOR(level_requirement * 2)
  END,
  critical_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN -10.0  -- Reduz dano crítico recebido
    WHEN rarity = 'epic' THEN -7.0
    WHEN rarity = 'rare' THEN -5.0
    WHEN rarity = 'uncommon' THEN -3.0
    ELSE -1.0
  END
WHERE type = 'armor';

-- Acessórios: Bônus diversificados baseados no tipo
UPDATE equipment SET
  hp_bonus = CASE 
    WHEN rarity = 'legendary' THEN FLOOR(level_requirement * 4)
    WHEN rarity = 'epic' THEN FLOOR(level_requirement * 3)
    WHEN rarity = 'rare' THEN FLOOR(level_requirement * 2)
    ELSE FLOOR(level_requirement * 1)
  END,
  critical_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 5.0
    WHEN rarity = 'epic' THEN 4.0
    WHEN rarity = 'rare' THEN 3.0
    WHEN rarity = 'uncommon' THEN 2.0
    ELSE 1.0
  END,
  magic_damage_bonus = CASE 
    WHEN rarity = 'legendary' THEN 15.0
    WHEN rarity = 'epic' THEN 12.0
    WHEN rarity = 'rare' THEN 8.0
    WHEN rarity = 'uncommon' THEN 5.0
    ELSE 2.0
  END,
  double_attack_chance_bonus = CASE 
    WHEN rarity = 'legendary' THEN 2.0
    WHEN rarity = 'epic' THEN 1.5
    WHEN rarity = 'rare' THEN 1.0
    ELSE 0.5
  END
WHERE type = 'accessory';

-- =====================================
-- 4. ATUALIZAR FUNÇÕES DE CÁLCULO DE BÔNUS
-- =====================================

CREATE OR REPLACE FUNCTION calculate_equipment_bonuses_enhanced(p_character_id UUID)
RETURNS TABLE(
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus NUMERIC(5,2),
    total_critical_damage_bonus NUMERIC(5,2),
    total_double_attack_chance_bonus NUMERIC(5,2),
    total_magic_damage_bonus NUMERIC(5,2)
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(SUM(e.atk_bonus), 0)::INTEGER as total_atk_bonus,
        COALESCE(SUM(e.def_bonus), 0)::INTEGER as total_def_bonus,
        COALESCE(SUM(e.mana_bonus), 0)::INTEGER as total_mana_bonus,
        COALESCE(SUM(e.speed_bonus), 0)::INTEGER as total_speed_bonus,
        COALESCE(SUM(e.hp_bonus), 0)::INTEGER as total_hp_bonus,
        COALESCE(SUM(e.critical_chance_bonus), 0)::NUMERIC(5,2) as total_critical_chance_bonus,
        COALESCE(SUM(e.critical_damage_bonus), 0)::NUMERIC(5,2) as total_critical_damage_bonus,
        COALESCE(SUM(e.double_attack_chance_bonus), 0)::NUMERIC(5,2) as total_double_attack_chance_bonus,
        COALESCE(SUM(e.magic_damage_bonus), 0)::NUMERIC(5,2) as total_magic_damage_bonus
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true;
END;
$$;

-- =====================================
-- 5. ATUALIZAR FUNÇÃO DE STATS DERIVADOS PARA INCLUIR NOVOS BÔNUS
-- =====================================

DROP FUNCTION IF EXISTS calculate_derived_stats CASCADE;

CREATE FUNCTION calculate_derived_stats(
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
    -- NOVOS: Bônus de equipamentos
    p_equipment_hp_bonus INTEGER DEFAULT 0,
    p_equipment_atk_bonus INTEGER DEFAULT 0,
    p_equipment_def_bonus INTEGER DEFAULT 0,
    p_equipment_mana_bonus INTEGER DEFAULT 0,
    p_equipment_speed_bonus INTEGER DEFAULT 0,
    p_equipment_critical_chance_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_critical_damage_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_double_attack_bonus NUMERIC(5,2) DEFAULT 0,
    p_equipment_magic_damage_bonus NUMERIC(5,2) DEFAULT 0
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
    magic_damage_bonus NUMERIC(5,2),
    double_attack_chance NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Stats base rebalanceados (do rebalanceamento anterior)
    base_hp INTEGER := 60 + (p_level * 3);
    base_mana INTEGER := 20 + (p_level * 1.5);
    base_atk INTEGER := 3 + (p_level * 1);
    base_magic_atk INTEGER := 2 + (p_level * 0.8);
    base_def INTEGER := 2 + (p_level * 0.5);
    base_speed INTEGER := 5 + (p_level * 0.8);
    
    -- Escalamento dos atributos (do rebalanceamento anterior)
    str_scaling NUMERIC := CASE 
        WHEN p_strength <= 50 THEN POWER(p_strength, 1.3)
        WHEN p_strength <= 100 THEN POWER(50, 1.3) + (p_strength - 50) * POWER(50, 0.3)
        ELSE POWER(50, 1.3) + 50 * POWER(50, 0.3) + (p_strength - 100) * POWER(50, 0.2)
    END;
    
    dex_scaling NUMERIC := CASE 
        WHEN p_dexterity <= 50 THEN POWER(p_dexterity, 1.2)
        WHEN p_dexterity <= 100 THEN POWER(50, 1.2) + (p_dexterity - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_dexterity - 100) * POWER(50, 0.15)
    END;
    
    int_scaling NUMERIC := CASE 
        WHEN p_intelligence <= 50 THEN POWER(p_intelligence, 1.25)
        WHEN p_intelligence <= 100 THEN POWER(50, 1.25) + (p_intelligence - 50) * POWER(50, 0.25)
        ELSE POWER(50, 1.25) + 50 * POWER(50, 0.25) + (p_intelligence - 100) * POWER(50, 0.2)
    END;
    
    wis_scaling NUMERIC := CASE 
        WHEN p_wisdom <= 50 THEN POWER(p_wisdom, 1.15)
        WHEN p_wisdom <= 100 THEN POWER(50, 1.15) + (p_wisdom - 50) * POWER(50, 0.15)
        ELSE POWER(50, 1.15) + 50 * POWER(50, 0.15) + (p_wisdom - 100) * POWER(50, 0.1)
    END;
    
    vit_scaling NUMERIC := CASE 
        WHEN p_vitality <= 50 THEN POWER(p_vitality, 1.2)
        WHEN p_vitality <= 100 THEN POWER(50, 1.2) + (p_vitality - 50) * POWER(50, 0.2)
        ELSE POWER(50, 1.2) + 50 * POWER(50, 0.2) + (p_vitality - 100) * POWER(50, 0.15)
    END;
    
    luck_scaling NUMERIC := p_luck * 1.0;
    
    -- Bônus de habilidades
    weapon_mastery_bonus NUMERIC := POWER(GREATEST(p_sword_mastery, p_axe_mastery, p_blunt_mastery), 1.15) * 0.8;
    defense_mastery_bonus NUMERIC := POWER(p_defense_mastery, 1.2) * 1.0;
    magic_mastery_bonus NUMERIC := POWER(p_magic_mastery, 1.2) * 1.2;
    
    -- Stats finais
    v_hp INTEGER;
    v_mana INTEGER;
    v_atk INTEGER;
    v_magic_atk INTEGER;
    v_def INTEGER;
    v_speed INTEGER;
    v_crit_chance NUMERIC(5,2);
    v_crit_damage NUMERIC(5,2);
    v_magic_dmg_bonus NUMERIC(5,2);
    v_double_attack_chance NUMERIC(5,2);
BEGIN
    -- Calcular stats base + atributos + equipamentos
    v_hp := base_hp + ROUND(vit_scaling * 3.5) + p_equipment_hp_bonus;
    v_mana := base_mana + ROUND(int_scaling * 1.8) + ROUND(wis_scaling * 1.4) + ROUND(magic_mastery_bonus * 0.8) + p_equipment_mana_bonus;
    v_atk := base_atk + ROUND(str_scaling * 1.8) + ROUND(weapon_mastery_bonus * 1.2) + p_equipment_atk_bonus;
    v_magic_atk := base_magic_atk + ROUND(int_scaling * 1.6) + ROUND(wis_scaling * 0.8) + ROUND(magic_mastery_bonus * 1.0);
    v_def := base_def + ROUND(vit_scaling * 0.8) + ROUND(wis_scaling * 0.6) + ROUND(defense_mastery_bonus * 1.2) + p_equipment_def_bonus;
    v_speed := base_speed + ROUND(dex_scaling * 1.2) + p_equipment_speed_bonus;
    
    -- Sistema de críticos rebalanceado + bônus de equipamentos
    v_crit_chance := LEAST(85, (luck_scaling * 0.6) + (dex_scaling * 0.4) + (weapon_mastery_bonus * 0.2) + p_equipment_critical_chance_bonus);
    v_crit_damage := 110 + (luck_scaling * 0.4) + (str_scaling * 0.3) + (weapon_mastery_bonus * 0.2) + p_equipment_critical_damage_bonus;
    
    -- Sistema de duplo ataque + bônus de equipamentos
    v_double_attack_chance := CASE
        WHEN v_speed >= 50 THEN LEAST(25, (v_speed - 49) * 0.5) + p_equipment_double_attack_bonus
        ELSE p_equipment_double_attack_bonus
    END;
    v_double_attack_chance := LEAST(30, v_double_attack_chance); -- Cap em 30%
    
    -- Dano mágico + bônus de equipamentos
    v_magic_dmg_bonus := (v_magic_atk - base_magic_atk) * 1.8 + p_equipment_magic_damage_bonus;
    v_magic_dmg_bonus := LEAST(500, v_magic_dmg_bonus);
    
    RETURN QUERY SELECT 
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
        v_double_attack_chance;
END;
$$;

-- =====================================
-- 6. ATUALIZAR FUNÇÃO DE RECÁLCULO PARA INCLUIR NOVOS BÔNUS
-- =====================================

CREATE OR REPLACE FUNCTION recalculate_character_stats_with_equipment(p_character_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_character RECORD;
    v_derived_stats RECORD;
    v_equipment_bonuses RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Calcular bônus de equipamentos
    SELECT * INTO v_equipment_bonuses FROM calculate_equipment_bonuses_enhanced(p_character_id);
    
    -- Calcular stats derivados com bônus de equipamentos
    SELECT * INTO v_derived_stats FROM calculate_derived_stats(
        v_character.level,
        COALESCE(v_character.strength, 10),
        COALESCE(v_character.dexterity, 10),
        COALESCE(v_character.intelligence, 10),
        COALESCE(v_character.wisdom, 10),
        COALESCE(v_character.vitality, 10),
        COALESCE(v_character.luck, 10),
        COALESCE(v_character.sword_mastery, 1),
        COALESCE(v_character.axe_mastery, 1),
        COALESCE(v_character.blunt_mastery, 1),
        COALESCE(v_character.defense_mastery, 1),
        COALESCE(v_character.magic_mastery, 1),
        -- Novos bônus de equipamentos
        COALESCE(v_equipment_bonuses.total_hp_bonus, 0),
        COALESCE(v_equipment_bonuses.total_atk_bonus, 0),
        COALESCE(v_equipment_bonuses.total_def_bonus, 0),
        COALESCE(v_equipment_bonuses.total_mana_bonus, 0),
        COALESCE(v_equipment_bonuses.total_speed_bonus, 0),
        COALESCE(v_equipment_bonuses.total_critical_chance_bonus, 0),
        COALESCE(v_equipment_bonuses.total_critical_damage_bonus, 0),
        COALESCE(v_equipment_bonuses.total_double_attack_chance_bonus, 0),
        COALESCE(v_equipment_bonuses.total_magic_damage_bonus, 0)
    );
    
    -- Atualizar personagem com novos stats
    UPDATE characters SET
        hp = LEAST(v_derived_stats.hp, hp + (v_derived_stats.hp - COALESCE(max_hp, v_derived_stats.hp))),
        max_hp = v_derived_stats.max_hp,
        mana = LEAST(v_derived_stats.mana, mana + (v_derived_stats.mana - COALESCE(max_mana, v_derived_stats.mana))),
        max_mana = v_derived_stats.max_mana,
        atk = v_derived_stats.atk,
        magic_attack = v_derived_stats.magic_attack,
        def = v_derived_stats.def,
        speed = v_derived_stats.speed,
        critical_chance = v_derived_stats.critical_chance,
        critical_damage = v_derived_stats.critical_damage,
        double_attack_chance = v_derived_stats.double_attack_chance,
        updated_at = NOW()
    WHERE id = p_character_id;
END;
$$;

-- =====================================
-- 7. CRIAR FUNÇÃO PARA COMPARAÇÃO DE EQUIPAMENTOS
-- =====================================

CREATE OR REPLACE FUNCTION compare_equipment_stats(
    p_character_id UUID,
    p_new_equipment_id UUID,
    p_slot_type TEXT DEFAULT NULL
)
RETURNS TABLE(
    stat_name TEXT,
    current_value NUMERIC,
    new_value NUMERIC,
    difference NUMERIC,
    is_improvement BOOLEAN
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_equipment_id UUID;
    v_current_equipment RECORD;
    v_new_equipment RECORD;
BEGIN
    -- Buscar equipamento atual no slot (se houver)
    IF p_slot_type IS NOT NULL THEN
        SELECT equipment_id INTO v_current_equipment_id
        FROM character_equipment ce
        WHERE ce.character_id = p_character_id 
        AND ce.is_equipped = true
        AND ce.slot_type = p_slot_type;
    END IF;
    
    -- Buscar dados dos equipamentos
    SELECT * INTO v_current_equipment FROM equipment WHERE id = v_current_equipment_id;
    SELECT * INTO v_new_equipment FROM equipment WHERE id = p_new_equipment_id;
    
    -- Retornar comparações para cada stat
    RETURN QUERY VALUES 
        ('Ataque', 
         COALESCE(v_current_equipment.atk_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.atk_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.atk_bonus, 0) - COALESCE(v_current_equipment.atk_bonus, 0),
         COALESCE(v_new_equipment.atk_bonus, 0) > COALESCE(v_current_equipment.atk_bonus, 0)),
        ('Defesa', 
         COALESCE(v_current_equipment.def_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.def_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.def_bonus, 0) - COALESCE(v_current_equipment.def_bonus, 0),
         COALESCE(v_new_equipment.def_bonus, 0) > COALESCE(v_current_equipment.def_bonus, 0)),
        ('Mana', 
         COALESCE(v_current_equipment.mana_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.mana_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.mana_bonus, 0) - COALESCE(v_current_equipment.mana_bonus, 0),
         COALESCE(v_new_equipment.mana_bonus, 0) > COALESCE(v_current_equipment.mana_bonus, 0)),
        ('Velocidade', 
         COALESCE(v_current_equipment.speed_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.speed_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.speed_bonus, 0) - COALESCE(v_current_equipment.speed_bonus, 0),
         COALESCE(v_new_equipment.speed_bonus, 0) > COALESCE(v_current_equipment.speed_bonus, 0)),
        ('HP', 
         COALESCE(v_current_equipment.hp_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.hp_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.hp_bonus, 0) - COALESCE(v_current_equipment.hp_bonus, 0),
         COALESCE(v_new_equipment.hp_bonus, 0) > COALESCE(v_current_equipment.hp_bonus, 0)),
        ('Chance Crítica', 
         COALESCE(v_current_equipment.critical_chance_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.critical_chance_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.critical_chance_bonus, 0) - COALESCE(v_current_equipment.critical_chance_bonus, 0),
         COALESCE(v_new_equipment.critical_chance_bonus, 0) > COALESCE(v_current_equipment.critical_chance_bonus, 0)),
        ('Dano Crítico', 
         COALESCE(v_current_equipment.critical_damage_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.critical_damage_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.critical_damage_bonus, 0) - COALESCE(v_current_equipment.critical_damage_bonus, 0),
         COALESCE(v_new_equipment.critical_damage_bonus, 0) > COALESCE(v_current_equipment.critical_damage_bonus, 0)),
        ('Duplo Ataque', 
         COALESCE(v_current_equipment.double_attack_chance_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0) - COALESCE(v_current_equipment.double_attack_chance_bonus, 0),
         COALESCE(v_new_equipment.double_attack_chance_bonus, 0) > COALESCE(v_current_equipment.double_attack_chance_bonus, 0)),
        ('Dano Mágico', 
         COALESCE(v_current_equipment.magic_damage_bonus, 0)::NUMERIC, 
         COALESCE(v_new_equipment.magic_damage_bonus, 0)::NUMERIC,
         COALESCE(v_new_equipment.magic_damage_bonus, 0) - COALESCE(v_current_equipment.magic_damage_bonus, 0),
         COALESCE(v_new_equipment.magic_damage_bonus, 0) > COALESCE(v_current_equipment.magic_damage_bonus, 0));
END;
$$;

-- =====================================
-- 8. RECALCULAR TODOS OS PERSONAGENS COM NOVOS BÔNUS
-- =====================================

-- Função para recalcular todos os personagens com o novo sistema
CREATE OR REPLACE FUNCTION recalculate_all_characters_with_equipment()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_character_record RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR v_character_record IN SELECT id FROM characters WHERE is_alive = true
    LOOP
        BEGIN
            PERFORM recalculate_character_stats_with_equipment(v_character_record.id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Erro ao recalcular personagem %: %', v_character_record.id, SQLERRM;
        END;
    END LOOP;
    
    RETURN v_count;
END;
$$;

-- Aplicar recálculo a todos os personagens
SELECT recalculate_all_characters_with_equipment();

-- =====================================
-- 9. COMENTÁRIOS E ÍNDICES
-- =====================================

COMMENT ON COLUMN equipment.hp_bonus IS 'Bônus de HP fornecido pelo equipamento';
COMMENT ON COLUMN equipment.critical_chance_bonus IS 'Bônus de chance crítica em %';
COMMENT ON COLUMN equipment.critical_damage_bonus IS 'Bônus de dano crítico em %';
COMMENT ON COLUMN equipment.double_attack_chance_bonus IS 'Bônus de chance de duplo ataque em %';
COMMENT ON COLUMN equipment.magic_damage_bonus IS 'Bônus de dano mágico em %';

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_equipment_hp_bonus ON equipment(hp_bonus);
CREATE INDEX IF NOT EXISTS idx_equipment_critical_bonuses ON equipment(critical_chance_bonus, critical_damage_bonus);
CREATE INDEX IF NOT EXISTS idx_equipment_magic_bonus ON equipment(magic_damage_bonus);

-- Confirmar aplicação
SELECT 'Rebalanceamento de equipamentos aplicado com sucesso!' as status; 