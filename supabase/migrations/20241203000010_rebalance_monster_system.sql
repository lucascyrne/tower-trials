-- Migração para rebalanceamento completo do sistema de monstros
-- Data: 2024-12-03
-- Versão: 20241203000010

-- =====================================
-- REBALANCEAMENTO DO SISTEMA DE MONSTROS
-- =====================================

-- ANÁLISE DO PROBLEMA:
-- Sistema atual de monstros usa escalamento linear simples
-- Não considera especialização de builds (aggressive, defensive, balanced)
-- Dificuldade inconsistente ao longo dos andares
-- SOLUÇÃO: Sistema especializado similar aos personagens

-- =====================================
-- 1. NOVA FUNÇÃO DE ESCALAMENTO ESPECIALIZADO
-- =====================================

-- Remover função antiga
DROP FUNCTION IF EXISTS get_monster_for_floor(INTEGER) CASCADE;

CREATE OR REPLACE FUNCTION get_monster_for_floor(p_floor INTEGER)
RETURNS TABLE (
    id UUID,
    name VARCHAR,
    hp INTEGER,
    atk INTEGER,
    def INTEGER,
    mana INTEGER,
    speed INTEGER,
    behavior monster_behavior,
    min_floor INTEGER,
    reward_xp INTEGER,
    reward_gold INTEGER,
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
    floor_range INTEGER := 5;
    v_selected_monster RECORD;
    
    -- Variáveis para escalamento logarítmico
    v_floor_modifier NUMERIC;
    v_str_scaling NUMERIC;
    v_dex_scaling NUMERIC;
    v_int_scaling NUMERIC;
    v_wis_scaling NUMERIC;
    v_vit_scaling NUMERIC;
    v_luck_scaling NUMERIC;
    
    -- Stats finais calculados
    v_final_hp INTEGER;
    v_final_atk INTEGER;
    v_final_def INTEGER;
    v_final_mana INTEGER;
    v_final_speed INTEGER;
    v_final_xp INTEGER;
    v_final_gold INTEGER;
BEGIN
    -- Selecionar monstro apropriado para o andar
    SELECT * INTO v_selected_monster
    FROM monsters m
    WHERE m.min_floor <= p_floor 
    AND m.min_floor >= GREATEST(1, p_floor - floor_range)
    ORDER BY RANDOM()
    LIMIT 1;

    -- Se nenhum monstro encontrado no range ideal, pegar o mais próximo
    IF v_selected_monster IS NULL THEN
        SELECT * INTO v_selected_monster
        FROM monsters m
        ORDER BY ABS(m.min_floor - p_floor) ASC
        LIMIT 1;
    END IF;
    
    -- Se ainda não encontrou, erro
    IF v_selected_monster IS NULL THEN
        RAISE EXCEPTION 'Nenhum monstro encontrado para o andar %', p_floor;
    END IF;
    
    -- =====================================
    -- ESCALAMENTO LOGARÍTMICO ESPECIALIZADO
    -- =====================================
    
    -- Modificador baseado na diferença de andar (similar aos personagens)
    v_floor_modifier := GREATEST(1.0, POWER(p_floor::NUMERIC / v_selected_monster.min_floor::NUMERIC, 0.8));
    
    -- Escalamento de atributos baseado no comportamento do monstro
    CASE v_selected_monster.behavior
        WHEN 'aggressive' THEN
            -- Aggressive: Focus em STR e DEX (guerreiro agressivo)
            v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.3);
            v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.25);
            v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.1);
            v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.1);
            v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.2);
            v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            
        WHEN 'defensive' THEN
            -- Defensive: Focus em VIT e WIS (tank especializado)
            v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.1);
            v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.1);
            v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.2);
            v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.3);
            v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.4);
            v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            
        WHEN 'balanced' THEN
            -- Balanced: Crescimento equilibrado mas pode ser mago
            IF v_selected_monster.intelligence > v_selected_monster.strength THEN
                -- Mago balanceado
                v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.2);
                v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.2);
                v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.35);
                v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.25);
                v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.25);
                v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            ELSE
                -- Híbrido físico-mágico
                v_str_scaling := POWER(v_selected_monster.strength * v_floor_modifier, 1.25);
                v_dex_scaling := POWER(v_selected_monster.dexterity * v_floor_modifier, 1.25);
                v_int_scaling := POWER(v_selected_monster.intelligence * v_floor_modifier, 1.25);
                v_wis_scaling := POWER(v_selected_monster.wisdom * v_floor_modifier, 1.25);
                v_vit_scaling := POWER(v_selected_monster.vitality * v_floor_modifier, 1.3);
                v_luck_scaling := v_selected_monster.luck * v_floor_modifier;
            END IF;
    END CASE;
    
    -- =====================================
    -- CALCULAR STATS FINAIS ESPECIALIZADO
    -- =====================================
    
    -- HP: Base menor + VIT scaling (similar aos personagens)
    v_final_hp := 40 + (p_floor * 2) + ROUND(v_vit_scaling * 2.8);
    
    -- ATK: Base menor + STR/INT scaling dependendo do tipo
    IF v_selected_monster.intelligence > v_selected_monster.strength THEN
        -- Monstro mágico: usar INT
        v_final_atk := 8 + p_floor + ROUND(v_int_scaling * 1.2) + ROUND(v_str_scaling * 0.6);
    ELSE
        -- Monstro físico: usar STR
        v_final_atk := 8 + p_floor + ROUND(v_str_scaling * 1.5) + ROUND(v_int_scaling * 0.4);
    END IF;
    
    -- DEF: Base menor + VIT/WIS scaling
    v_final_def := 3 + ROUND(p_floor * 0.8) + ROUND(v_vit_scaling * 0.6) + ROUND(v_wis_scaling * 0.4);
    
    -- MANA: Base + INT/WIS scaling
    v_final_mana := 10 + ROUND(v_int_scaling * 1.5) + ROUND(v_wis_scaling * 0.8);
    
    -- SPEED: Base + DEX scaling
    v_final_speed := 6 + ROUND(p_floor * 0.5) + ROUND(v_dex_scaling * 0.8);
    
    -- =====================================
    -- RECOMPENSAS BALANCEADAS
    -- =====================================
    
    -- XP e Gold crescem com escalamento mais agressivo para compensar dificuldade
    v_final_xp := v_selected_monster.reward_xp + ROUND((p_floor - v_selected_monster.min_floor) * v_selected_monster.reward_xp * 0.25);
    v_final_gold := v_selected_monster.reward_gold + ROUND((p_floor - v_selected_monster.min_floor) * v_selected_monster.reward_gold * 0.30);
    
    -- =====================================
    -- RETORNAR MONSTRO REBALANCEADO
    -- =====================================
    
    RETURN QUERY SELECT
        v_selected_monster.id,
        v_selected_monster.name,
        v_final_hp,
        v_final_atk,
        v_final_def,
        v_final_mana,
        v_final_speed,
        v_selected_monster.behavior,
        v_selected_monster.min_floor,
        v_final_xp,
        v_final_gold,
        
        -- Atributos escalados para referência
        ROUND(v_str_scaling)::INTEGER as strength,
        ROUND(v_dex_scaling)::INTEGER as dexterity,
        ROUND(v_int_scaling)::INTEGER as intelligence,
        ROUND(v_wis_scaling)::INTEGER as wisdom,
        ROUND(v_vit_scaling)::INTEGER as vitality,
        ROUND(v_luck_scaling)::INTEGER as luck,
        
        -- Propriedades de combate escaladas
        LEAST(0.45, v_selected_monster.critical_chance + (p_floor - v_selected_monster.min_floor) * 0.008)::DECIMAL as critical_chance,
        LEAST(3.0, v_selected_monster.critical_damage + (p_floor - v_selected_monster.min_floor) * 0.03)::DECIMAL as critical_damage,
        LEAST(0.85, v_selected_monster.critical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as critical_resistance,
        
        -- Resistências escaladas mais agressivamente (monstros ficam mais resistentes)
        LEAST(0.80, v_selected_monster.physical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as physical_resistance,
        LEAST(0.80, v_selected_monster.magical_resistance + (p_floor - v_selected_monster.min_floor) * 0.012)::DECIMAL as magical_resistance,
        LEAST(0.95, v_selected_monster.debuff_resistance + (p_floor - v_selected_monster.min_floor) * 0.015)::DECIMAL as debuff_resistance,
        
        -- Vulnerabilidades não mudam (características fixas)
        v_selected_monster.physical_vulnerability,
        v_selected_monster.magical_vulnerability,
        v_selected_monster.primary_trait,
        v_selected_monster.secondary_trait,
        v_selected_monster.special_abilities;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 2. ATUALIZAR DADOS BASE DOS MONSTROS
-- =====================================

-- Atualizar monstros existentes para ter builds mais especializadas
-- Bases menores e especializações mais claras

-- Monstros Aggressive: Alta STR/DEX, baixa VIT/WIS
UPDATE monsters SET 
    strength = CASE 
        WHEN behavior = 'aggressive' THEN GREATEST(strength, 15)
        ELSE strength
    END,
    dexterity = CASE 
        WHEN behavior = 'aggressive' THEN GREATEST(dexterity, 12)  
        ELSE dexterity
    END,
    vitality = CASE 
        WHEN behavior = 'aggressive' THEN LEAST(vitality, 10)
        ELSE vitality
    END,
    wisdom = CASE 
        WHEN behavior = 'aggressive' THEN LEAST(wisdom, 8)
        ELSE wisdom
    END
WHERE behavior = 'aggressive';

-- Monstros Defensive: Alta VIT/WIS, baixa STR/DEX
UPDATE monsters SET 
    vitality = CASE 
        WHEN behavior = 'defensive' THEN GREATEST(vitality, 18)
        ELSE vitality
    END,
    wisdom = CASE 
        WHEN behavior = 'defensive' THEN GREATEST(wisdom, 15)
        ELSE wisdom
    END,
    strength = CASE 
        WHEN behavior = 'defensive' THEN LEAST(strength, 12)
        ELSE strength
    END,
    dexterity = CASE 
        WHEN behavior = 'defensive' THEN LEAST(dexterity, 8)
        ELSE dexterity
    END
WHERE behavior = 'defensive';

-- Monstros Balanced: Stats equilibrados mas alguns são magos
UPDATE monsters SET 
    intelligence = CASE 
        WHEN behavior = 'balanced' AND name ILIKE '%mago%' THEN GREATEST(intelligence, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%lich%' THEN GREATEST(intelligence, 20)
        WHEN behavior = 'balanced' AND name ILIKE '%necromante%' THEN GREATEST(intelligence, 18)
        WHEN behavior = 'balanced' AND name ILIKE '%druida%' THEN GREATEST(intelligence, 14)
        WHEN behavior = 'balanced' AND name ILIKE '%elemental%' THEN GREATEST(intelligence, 17)
        WHEN behavior = 'balanced' THEN intelligence
        ELSE intelligence
    END,
    wisdom = CASE 
        WHEN behavior = 'balanced' AND name ILIKE '%mago%' THEN GREATEST(wisdom, 14)
        WHEN behavior = 'balanced' AND name ILIKE '%lich%' THEN GREATEST(wisdom, 18)
        WHEN behavior = 'balanced' AND name ILIKE '%necromante%' THEN GREATEST(wisdom, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%druida%' THEN GREATEST(wisdom, 16)
        WHEN behavior = 'balanced' AND name ILIKE '%elemental%' THEN GREATEST(wisdom, 15)
        WHEN behavior = 'balanced' THEN wisdom
        ELSE wisdom
    END
WHERE behavior = 'balanced';

-- Reduzir stats base para forçar dependência de especialização (similar aos personagens)
UPDATE monsters SET 
    hp = GREATEST(30, ROUND(hp * 0.6)),      -- Reduzir HP base significativamente
    atk = GREATEST(8, ROUND(atk * 0.5)),     -- Reduzir ATK base drasticamente 
    def = GREATEST(3, ROUND(def * 0.4)),     -- Reduzir DEF base drasticamente
    mana = GREATEST(5, ROUND(mana * 0.7)),   -- Reduzir Mana base moderadamente
    speed = GREATEST(6, ROUND(speed * 0.7)); -- Reduzir Speed base moderadamente

-- =====================================
-- 3. AJUSTAR RESISTÊNCIAS PARA DIFICULDADE MÉDIA-DIFÍCIL
-- =====================================

-- Monstros devem ser mais desafiadores
UPDATE monsters SET
    critical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.3, critical_resistance + 0.15)
        WHEN behavior = 'balanced' THEN LEAST(0.2, critical_resistance + 0.10)
        ELSE LEAST(0.1, critical_resistance + 0.05)
    END,
    physical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.25, physical_resistance + 0.15)
        WHEN primary_trait = 'armored' THEN LEAST(0.30, physical_resistance + 0.20)
        ELSE LEAST(0.10, physical_resistance + 0.05)
    END,
    magical_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.20, magical_resistance + 0.10)
        WHEN primary_trait = 'ethereal' THEN LEAST(0.35, magical_resistance + 0.25)
        WHEN name ILIKE '%elemental%' THEN LEAST(0.25, magical_resistance + 0.15)
        ELSE LEAST(0.10, magical_resistance + 0.05)
    END,
    debuff_resistance = CASE 
        WHEN behavior = 'defensive' THEN LEAST(0.40, debuff_resistance + 0.25)
        WHEN min_floor >= 10 THEN LEAST(0.30, debuff_resistance + 0.15)
        ELSE LEAST(0.15, debuff_resistance + 0.10)
    END;

-- =====================================
-- COMENTÁRIOS DO REBALANCEAMENTO
-- =====================================

COMMENT ON FUNCTION get_monster_for_floor(INTEGER) IS 
'Sistema de monstros especializado que usa escalamento logarítmico.
- Comportamentos têm especializações claras (aggressive=STR/DEX, defensive=VIT/WIS, balanced=híbrido/mago)
- Escalamento logarítmico similar aos personagens
- Dificuldade média-difícil com resistências escalantes
- Stats base menores forçam dependência de atributos específicos';

-- Migração concluída com sucesso
-- Sistema de monstros rebalanceado com especialização implementado 