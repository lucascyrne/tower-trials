-- =====================================
-- MIGRAÇÃO: Adicionar Escudos ao Jogo
-- Data: 2024-12-22
-- Descrição: Adiciona escudos específicos para early e mid game
-- =====================================

-- Esta migração adiciona:
-- 1. Escudos early game (níveis 1-8) 
-- 2. Escudos mid game (níveis 9-15)
-- 3. Escudos late game (níveis 16+)
-- 4. Foco em defesa, HP e resistências
-- 5. Compatibilidade com slot off_hand

-- =====================================
-- 1. ESCUDOS EARLY GAME (NÍVEIS 1-8)
-- =====================================

INSERT INTO equipment (name, description, type, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, price, is_unlocked) VALUES

-- NÍVEL 1-2 - Escudos básicos
('Broquel de Madeira', 'Escudo pequeno e leve feito de madeira resistente', 'armor', 'common', 1, 0, 4, 0, -1, 12, 0, 0, 0, 0, 80, true),
('Escudo de Couro', 'Escudo básico de couro curtido com rebites', 'armor', 'common', 2, 0, 6, 0, -1, 18, 0, 0, 0, 0, 120, true),

-- NÍVEL 3-4 - Escudos de bronze
('Escudo de Bronze', 'Escudo circular de bronze polido', 'armor', 'common', 3, 0, 8, 0, -2, 25, 0, 0, 0, 0, 180, true),
('Broquel Reforçado', 'Broquel com bordas metálicas para maior resistência', 'armor', 'common', 4, 1, 10, 0, -1, 30, 0.5, 0, 0, 0, 220, true),

-- NÍVEL 5-6 - Escudos de ferro
('Escudo de Ferro', 'Escudo sólido de ferro forjado com brasão', 'armor', 'uncommon', 5, 0, 14, 0, -3, 40, 0, 0, 0, 0, 350, true),
('Escudo do Soldado', 'Escudo padrão usado por soldados regulares', 'armor', 'uncommon', 6, 1, 16, 0, -2, 45, 1.0, 0, 0, 0, 420, true),

-- NÍVEL 7-8 - Escudos avançados early game
('Escudo de Aço', 'Escudo pesado de aço temperado', 'armor', 'uncommon', 7, 0, 20, 0, -4, 55, 0, 0, 0, 0, 500, true),
('Escudo Rúnico', 'Escudo gravado com runas de proteção', 'armor', 'uncommon', 8, 1, 18, 8, -2, 50, 1.0, 0, 0, 2.0, 580, true),

-- =====================================
-- 2. ESCUDOS MID GAME (NÍVEIS 9-15)
-- =====================================

-- NÍVEL 9-10 - Escudos raros iniciais
('Escudo do Cavaleiro', 'Escudo nobre usado por cavaleiros', 'armor', 'rare', 9, 2, 24, 5, -3, 65, 1.5, 0, 0, 1.0, 750, true),
('Escudo Élfico', 'Escudo leve élfico com encantamentos naturais', 'armor', 'rare', 10, 1, 20, 15, 0, 55, 2.0, 0, 0, 4.0, 850, true),

-- NÍVEL 11-12 - Escudos especializados
('Escudo do Guardião', 'Escudo usado pelos guardiões antigos', 'armor', 'rare', 11, 2, 28, 10, -4, 80, 1.0, 0, 0, 2.0, 950, true),
('Escudo de Cristal', 'Escudo translúcido que absorve magia', 'armor', 'rare', 12, 0, 22, 25, -1, 60, 1.5, 0, 0, 6.0, 1100, true),

-- NÍVEL 13-14 - Escudos raros avançados
('Escudo Dracônico', 'Forjado com escamas de dragão menor', 'armor', 'rare', 13, 3, 32, 12, -2, 90, 2.0, 2, 0, 3.0, 1300, true),
('Escudo das Tempestades', 'Canaliza o poder dos raios e ventos', 'armor', 'rare', 14, 2, 30, 20, 1, 85, 2.5, 0, 0, 5.0, 1500, true),

-- NÍVEL 15 - Escudo raro final
('Escudo dos Ancestrais', 'Abençoado pelos espíritos ancestrais', 'armor', 'rare', 15, 3, 35, 18, -1, 100, 2.0, 1, 0, 4.0, 1700, false),

-- =====================================
-- 3. ESCUDOS LATE GAME (NÍVEIS 16+)
-- =====================================

-- NÍVEL 16-17 - Escudos épicos
('Escudo dos Titãs', 'Forjado pelos próprios titãs em eras passadas', 'armor', 'epic', 16, 5, 42, 25, -3, 120, 3.0, 3, 0, 6.0, 2500, false),
('Escudo do Vazio', 'Absorve energia de outras dimensões', 'armor', 'epic', 17, 4, 38, 35, 0, 110, 2.5, 2, 0, 8.0, 2800, false),

-- NÍVEL 18-19 - Escudos épicos avançados
('Aegis Menor', 'Versão menor do lendário Aegis', 'armor', 'epic', 18, 6, 45, 30, -2, 140, 3.5, 4, 0, 7.0, 3200, false),
('Escudo Celestial', 'Imbuído com poder divino', 'armor', 'epic', 19, 5, 48, 40, 1, 150, 3.0, 3, 0, 10.0, 3600, false),

-- NÍVEL 20+ - Escudos lendários
('Aegis Primordial', 'O escudo lendário que protege contra tudo', 'armor', 'legendary', 20, 10, 60, 50, 0, 200, 5.0, 8, 0, 15.0, 6000, false),
('Escudo do Destino', 'Escudo que altera o curso do destino', 'armor', 'legendary', 22, 8, 55, 60, 2, 180, 4.0, 5, 0, 20.0, 7000, false);

-- =====================================
-- 4. ATUALIZAR FUNÇÃO DE EQUIPAMENTOS PARA ESCUDOS
-- =====================================

-- Atualizar função para reconhecer escudos adequadamente
CREATE OR REPLACE FUNCTION is_shield(equipment_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN equipment_name ILIKE '%escudo%' 
        OR equipment_name ILIKE '%shield%' 
        OR equipment_name ILIKE '%broquel%'
        OR equipment_name ILIKE '%aegis%';
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 5. FUNÇÃO PARA CALCULAR BÔNUS DE ESCUDO
-- =====================================

CREATE OR REPLACE FUNCTION calculate_shield_bonus(p_character_id UUID)
RETURNS TABLE (
    shield_def_bonus INTEGER,
    shield_hp_bonus INTEGER,
    shield_magic_resistance NUMERIC,
    has_shield BOOLEAN
) AS $$
BEGIN
    -- Verificar se tem escudo equipado na off_hand
    SELECT 
        COALESCE(e.def_bonus, 0),
        COALESCE(e.hp_bonus, 0),
        COALESCE(e.magic_damage_bonus, 0),
        true
    INTO 
        shield_def_bonus,
        shield_hp_bonus,
        shield_magic_resistance,
        has_shield
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id 
    AND ce.is_equipped = true 
    AND ce.slot_type = 'off_hand'
    AND e.type = 'armor'
    AND is_shield(e.name)
    LIMIT 1;

    -- Se não tem escudo, retornar valores zerados
    IF shield_def_bonus IS NULL THEN
        shield_def_bonus := 0;
        shield_hp_bonus := 0;
        shield_magic_resistance := 0;
        has_shield := false;
    END IF;

    RETURN QUERY SELECT 
        shield_def_bonus,
        shield_hp_bonus,
        shield_magic_resistance,
        has_shield;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 6. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_shields_count INTEGER;
    v_early_shields INTEGER;
    v_mid_shields INTEGER;
    v_late_shields INTEGER;
BEGIN
    -- Contar escudos adicionados
    SELECT COUNT(*) INTO v_shields_count 
    FROM equipment 
    WHERE type = 'armor' 
    AND is_shield(name);
    
    -- Contar por faixas de nível
    SELECT COUNT(*) INTO v_early_shields 
    FROM equipment 
    WHERE type = 'armor' 
    AND is_shield(name)
    AND level_requirement BETWEEN 1 AND 8;
    
    SELECT COUNT(*) INTO v_mid_shields 
    FROM equipment 
    WHERE type = 'armor' 
    AND is_shield(name)
    AND level_requirement BETWEEN 9 AND 15;
    
    SELECT COUNT(*) INTO v_late_shields 
    FROM equipment 
    WHERE type = 'armor' 
    AND is_shield(name)
    AND level_requirement >= 16;
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== ESCUDOS ADICIONADOS AO JOGO ===';
    RAISE NOTICE 'Total de escudos: %', v_shields_count;
    RAISE NOTICE 'Escudos early game (1-8): %', v_early_shields;
    RAISE NOTICE 'Escudos mid game (9-15): %', v_mid_shields;
    RAISE NOTICE 'Escudos late game (16+): %', v_late_shields;
    RAISE NOTICE 'Foco em defesa, HP e resistência mágica';
    RAISE NOTICE 'Compatível com slot off_hand';
    RAISE NOTICE 'Funções auxiliares criadas';
    RAISE NOTICE '===============================================';
END $$; 