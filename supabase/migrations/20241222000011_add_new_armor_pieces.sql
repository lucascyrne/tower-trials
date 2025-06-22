-- =====================================
-- MIGRAÇÃO: Adicionar Novos Equipamentos de Armadura
-- Data: 2024-12-22
-- Descrição: Adiciona variedade de peitorais, capacetes, perneiras e botas
-- =====================================

INSERT INTO equipment (name, description, type, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, critical_resistance_bonus, price, is_unlocked) VALUES

-- =====================================
-- PEITORAIS - EARLY GAME (Nível 1-8)
-- =====================================
('Túnica de Linho', 'Túnica simples feita de linho', 'chest', 'common', 1, 0, 3, 0, 0, 15, 0, 0, 0, 0, 0, 80, true),
('Gibão de Couro', 'Proteção básica de couro curtido', 'chest', 'common', 2, 0, 5, 0, 0, 20, 0, 0, 0, 0, 0, 120, true),
('Couraça de Bronze', 'Armadura leve de bronze polido', 'chest', 'common', 3, 0, 8, 0, 0, 25, 0, 0, 0, 0, 0.5, 180, true),
('Armadura de Couro Cravejado', 'Couro reforçado com rebites metálicos', 'chest', 'uncommon', 5, 1, 12, 0, 0, 35, 0, 0, 0, 0, 1.0, 300, true),
('Cota de Malha', 'Armadura flexível de anéis entrelaçados', 'chest', 'uncommon', 6, 0, 15, 0, -1, 40, 0, 0, 0, 0, 1.5, 400, true),
('Armadura de Ferro', 'Armadura sólida de ferro forjado', 'chest', 'uncommon', 7, 0, 18, 0, -2, 50, 0, 0, 0, 0, 2.0, 500, true),
('Couraça Élfica', 'Armadura leve élfica com encantamentos', 'chest', 'uncommon', 8, 1, 14, 8, 1, 45, 0.5, 0, 0, 1.0, 1.0, 600, true),

-- =====================================
-- PEITORAIS - MID GAME (Nível 9-15)
-- =====================================
('Armadura de Aço', 'Armadura pesada de aço temperado', 'chest', 'rare', 9, 0, 22, 0, -3, 60, 0, 0, 0, 0, 2.5, 800, true),
('Manto do Mago', 'Manto imbuído com proteções mágicas', 'chest', 'rare', 10, 0, 10, 25, 2, 35, 1.0, 0, 0, 3.0, 1.5, 900, true),
('Armadura de Placas', 'Armadura completa de placas articuladas', 'chest', 'rare', 11, 0, 28, 0, -4, 80, 0, 0, 0, 0, 3.5, 1100, true),
('Couraça Dracônica', 'Feita com escamas de dragão menor', 'chest', 'rare', 12, 2, 25, 10, 0, 70, 1.0, 0, 0, 2.0, 3.0, 1300, true),
('Armadura Sombria', 'Armadura forjada nas trevas profundas', 'chest', 'rare', 13, 3, 24, 0, 1, 65, 1.5, 2, 0, 0, 2.5, 1500, true),
('Peitoral dos Guardiões', 'Usado pelos guardiões antigos', 'chest', 'rare', 14, 1, 30, 15, -1, 85, 0.5, 0, 0, 1.5, 4.0, 1700, true),
('Armadura Mithril', 'Leve como seda, resistente como aço', 'chest', 'rare', 15, 2, 26, 20, 3, 75, 2.0, 1, 0, 2.5, 3.5, 2000, false),

-- =====================================
-- PEITORAIS - LATE GAME (Nível 16+)
-- =====================================
('Armadura dos Titãs', 'Forjada pelos próprios titãs', 'chest', 'epic', 16, 3, 35, 30, -2, 100, 1.5, 0, 0, 3.0, 5.0, 2800, false),
('Couraça do Vazio', 'Absorve energia das outras dimensões', 'chest', 'epic', 18, 4, 32, 40, 1, 90, 2.0, 3, 0, 5.0, 4.5, 3500, false),
('Armadura do Destino', 'Proteção divina para os escolhidos', 'chest', 'legendary', 20, 6, 45, 50, 2, 150, 3.0, 5, 0, 8.0, 8.0, 6000, false),

-- =====================================
-- CAPACETES - EARLY GAME (Nível 1-8)
-- =====================================
('Chapéu de Feltro', 'Chapéu simples de feltro marrom', 'helmet', 'common', 1, 0, 1, 5, 0, 5, 0, 0, 0, 0.5, 0.5, 60, true),
('Capuz de Couro', 'Capuz básico de couro curtido', 'helmet', 'common', 2, 0, 2, 8, 0, 8, 0, 0, 0, 0, 1.0, 90, true),
('Elmo de Bronze', 'Elmo simples de bronze polido', 'helmet', 'common', 3, 0, 4, 10, 0, 12, 0, 0, 0, 0, 1.5, 140, true),
('Tiara de Prata', 'Tiara delicada com gemas menores', 'helmet', 'uncommon', 5, 0, 3, 18, 1, 10, 0.5, 0, 0, 2.0, 1.0, 250, true),
('Elmo de Ferro', 'Elmo resistente de ferro forjado', 'helmet', 'uncommon', 6, 0, 6, 12, 0, 20, 0, 0, 0, 0, 2.5, 320, true),
('Capuz Encantado', 'Capuz com runas de proteção', 'helmet', 'uncommon', 7, 0, 4, 22, 1, 15, 0.5, 0, 0, 2.5, 2.0, 400, true),
('Coroa Menor', 'Pequena coroa com poder mágico', 'helmet', 'uncommon', 8, 0, 5, 25, 1, 18, 1.0, 0, 0, 3.0, 1.5, 480, true),

-- =====================================
-- CAPACETES - MID GAME (Nível 9-15)
-- =====================================
('Elmo de Aço', 'Elmo pesado de aço temperado', 'helmet', 'rare', 9, 0, 8, 30, 0, 25, 0, 0, 0, 1.0, 3.5, 650, true),
('Tiara Élfica', 'Tiara com cristais élficos puros', 'helmet', 'rare', 10, 0, 5, 40, 2, 20, 1.5, 0, 0, 5.0, 2.0, 750, true),
('Elmo com Plumas', 'Elmo decorado com plumas mágicas', 'helmet', 'rare', 11, 1, 7, 35, 1, 30, 1.0, 1, 0, 3.0, 3.0, 850, true),
('Coroa de Ouro', 'Coroa real com gemas preciosas', 'helmet', 'rare', 12, 0, 6, 45, 2, 25, 2.0, 0, 0, 6.0, 2.5, 1000, true),
('Elmo Dracônico', 'Forjado com chifres de dragão', 'helmet', 'rare', 13, 2, 9, 38, 0, 35, 1.5, 2, 0, 4.0, 4.0, 1200, true),
('Capuz das Sombras', 'Oculta o portador nas trevas', 'helmet', 'rare', 14, 1, 6, 50, 3, 20, 2.5, 0, 0.5, 7.0, 3.0, 1400, true),
('Elmo dos Anciões', 'Carrega a sabedoria milenar', 'helmet', 'rare', 15, 0, 10, 55, 1, 40, 1.0, 0, 0, 8.0, 5.0, 1600, false),

-- =====================================
-- CAPACETES - LATE GAME (Nível 16+)
-- =====================================
('Coroa dos Titãs', 'Coroa forjada em eras antigas', 'helmet', 'epic', 16, 2, 12, 70, 2, 50, 2.5, 3, 0, 10.0, 6.0, 2200, false),
('Elmo do Vazio', 'Canaliza energias cósmicas', 'helmet', 'epic', 18, 3, 10, 90, 3, 45, 3.0, 2, 0.5, 15.0, 5.5, 2800, false),
('Diadema do Destino', 'Conecta com o tecido da realidade', 'helmet', 'legendary', 20, 4, 15, 120, 5, 80, 4.0, 5, 1.0, 25.0, 10.0, 5000, false),

-- =====================================
-- PERNEIRAS - EARLY GAME (Nível 1-8)
-- =====================================
('Calça de Linho', 'Calça simples e confortável', 'legs', 'common', 1, 0, 1, 0, 2, 8, 0, 0, 0, 0, 0, 50, true),
('Calça de Couro', 'Calça resistente de couro', 'legs', 'common', 2, 0, 2, 0, 3, 12, 0, 0, 0, 0, 0, 80, true),
('Perneiras de Bronze', 'Proteção básica para as pernas', 'legs', 'common', 3, 0, 3, 0, 4, 15, 0, 0, 0, 0, 0.5, 120, true),
('Calça Reforçada', 'Calça com proteções de metal', 'legs', 'uncommon', 5, 0, 5, 0, 6, 22, 0, 0, 0, 0, 1.0, 200, true),
('Saia de Batalha', 'Saia de couro para mobilidade', 'legs', 'uncommon', 6, 0, 4, 3, 8, 20, 0.5, 0, 0, 0, 0.5, 260, true),
('Perneiras de Ferro', 'Perneiras sólidas de ferro', 'legs', 'uncommon', 7, 0, 7, 0, 5, 30, 0, 0, 0, 0, 1.5, 320, true),
('Calça Élfica', 'Leve e flexível com encantamentos', 'legs', 'uncommon', 8, 0, 5, 5, 10, 25, 0.5, 0, 0, 1.0, 1.0, 380, true),

-- =====================================
-- PERNEIRAS - MID GAME (Nível 9-15)
-- =====================================
('Perneiras de Aço', 'Proteção pesada de aço', 'legs', 'rare', 9, 0, 9, 0, 7, 40, 0, 0, 0, 0, 2.0, 500, true),
('Saia Mágica', 'Saia com runas de velocidade', 'legs', 'rare', 10, 0, 6, 8, 14, 32, 1.0, 0, 0.5, 2.0, 1.5, 600, true),
('Calça de Placas', 'Calça articulada de placas', 'legs', 'rare', 11, 0, 11, 0, 6, 50, 0, 0, 0, 0, 2.5, 700, true),
('Perneiras Dracônicas', 'Feitas com couro de dragão', 'legs', 'rare', 12, 1, 10, 5, 12, 45, 1.0, 0, 0.5, 1.5, 2.0, 850, true),
('Calça Sombria', 'Permite movimento furtivo', 'legs', 'rare', 13, 0, 8, 0, 16, 35, 1.5, 0, 1.0, 0, 1.5, 1000, true),
('Perneiras dos Guardiões', 'Usadas pelos guardiões antigos', 'legs', 'rare', 14, 0, 12, 8, 10, 55, 0.5, 0, 0, 1.0, 3.0, 1200, true),
('Calça Mithril', 'Leve e extremamente resistente', 'legs', 'rare', 15, 1, 10, 10, 18, 50, 1.5, 0, 1.0, 2.0, 2.5, 1400, false),

-- =====================================
-- PERNEIRAS - LATE GAME (Nível 16+)
-- =====================================
('Perneiras dos Titãs', 'Forjadas em eras passadas', 'legs', 'epic', 16, 1, 15, 15, 20, 70, 2.0, 0, 1.5, 3.0, 4.0, 1800, false),
('Calça do Vazio', 'Manipula o espaço-tempo', 'legs', 'epic', 18, 2, 12, 20, 25, 60, 2.5, 0, 2.0, 5.0, 3.5, 2300, false),
('Perneiras do Destino', 'Concedem movimento sobre-humano', 'legs', 'legendary', 20, 3, 18, 30, 35, 100, 3.0, 0, 3.0, 8.0, 6.0, 4000, false),

-- =====================================
-- BOTAS - EARLY GAME (Nível 1-8)
-- =====================================
('Sandálias de Couro', 'Sandálias simples e confortáveis', 'boots', 'common', 1, 0, 0, 0, 3, 5, 0, 0, 0.1, 0, 0, 40, true),
('Sapatos de Feltro', 'Sapatos macios para caminhada', 'boots', 'common', 2, 0, 1, 0, 4, 8, 0, 0, 0.2, 0, 0, 70, true),
('Botas de Couro', 'Botas resistentes de couro curtido', 'boots', 'common', 3, 0, 2, 0, 6, 12, 0, 0, 0.3, 0, 0.5, 110, true),
('Botas Reforçadas', 'Botas com sola de metal', 'boots', 'uncommon', 5, 0, 3, 0, 8, 15, 0.5, 0, 0.5, 0, 1.0, 180, true),
('Sapatilhas Élficas', 'Permitem movimento silencioso', 'boots', 'uncommon', 6, 0, 2, 3, 12, 12, 1.0, 0, 0.8, 0.5, 0.5, 240, true),
('Botas de Ferro', 'Botas pesadas mas protetivas', 'boots', 'uncommon', 7, 0, 5, 0, 7, 25, 0, 0, 0.3, 0, 2.0, 300, true),
('Botas Encantadas', 'Botas com runas de velocidade', 'boots', 'uncommon', 8, 0, 3, 5, 14, 18, 0.5, 0, 1.0, 1.0, 1.0, 360, true),

-- =====================================
-- BOTAS - MID GAME (Nível 9-15)
-- =====================================
('Botas de Aço', 'Botas pesadas de aço temperado', 'boots', 'rare', 9, 0, 6, 0, 10, 30, 0, 0, 0.5, 0, 2.5, 480, true),
('Botas Voadoras', 'Permitem levitação por instantes', 'boots', 'rare', 10, 0, 4, 8, 18, 20, 1.5, 0, 1.5, 2.0, 1.0, 580, true),
('Botas de Velocidade', 'Multiplicam a velocidade natural', 'boots', 'rare', 11, 0, 5, 0, 22, 25, 1.0, 0, 2.0, 0, 1.5, 680, true),
('Botas Dracônicas', 'Feitas com escamas resistentes', 'boots', 'rare', 12, 1, 6, 5, 16, 35, 1.5, 1, 1.2, 1.5, 2.0, 800, true),
('Botas Sombrias', 'Concedem passos fantasmagóricos', 'boots', 'rare', 13, 0, 4, 0, 25, 20, 2.0, 0, 2.5, 0, 1.0, 950, true),
('Botas dos Guardiões', 'Nunca se desgastam', 'boots', 'rare', 14, 0, 7, 10, 20, 40, 1.0, 0, 1.8, 1.0, 3.0, 1100, true),
('Botas Mithril', 'Leves como o ar, fortes como pedra', 'boots', 'rare', 15, 1, 6, 12, 28, 30, 2.0, 1, 2.2, 2.5, 2.0, 1300, false),

-- =====================================
-- BOTAS - LATE GAME (Nível 16+)
-- =====================================
('Botas dos Titãs', 'Podem esmagar montanhas', 'boots', 'epic', 16, 2, 9, 15, 30, 50, 2.5, 2, 3.0, 3.0, 4.0, 1700, false),
('Botas do Vazio', 'Permitem andar entre dimensões', 'boots', 'epic', 18, 3, 7, 20, 40, 45, 3.0, 3, 4.0, 5.0, 3.0, 2200, false),
('Botas do Destino', 'Levam sempre ao destino certo', 'boots', 'legendary', 20, 4, 12, 25, 50, 70, 4.0, 5, 5.0, 8.0, 6.0, 3800, false);

-- =====================================
-- ATUALIZAR FUNÇÃO DE BÔNUS PARA NOVOS SLOTS
-- =====================================

-- Atualizar função para calcular bônus considerando os novos tipos
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses_armor_expansion(p_character_id UUID)
RETURNS TABLE (
    total_atk_bonus INTEGER,
    total_def_bonus INTEGER,
    total_mana_bonus INTEGER,
    total_speed_bonus INTEGER,
    total_hp_bonus INTEGER,
    total_critical_chance_bonus NUMERIC,
    total_critical_damage_bonus NUMERIC,
    total_double_attack_chance_bonus NUMERIC,
    total_magic_damage_bonus NUMERIC,
    total_critical_resistance_bonus NUMERIC,
    armor_pieces_count INTEGER,
    has_full_armor_set BOOLEAN
) AS $$
BEGIN
    -- Calcular bônus de todos os equipamentos incluindo novos tipos de armadura
    SELECT 
        COALESCE(SUM(CASE WHEN ce.slot_type = 'main_hand' THEN e.atk_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type = 'weapon' THEN FLOOR(e.atk_bonus * 0.8) ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type != 'weapon' THEN e.atk_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type IN ('chest', 'helmet', 'legs', 'boots', 'ring_1', 'ring_2', 'necklace', 'amulet') THEN e.atk_bonus ELSE 0 END), 0),
        
        COALESCE(SUM(CASE WHEN ce.slot_type = 'main_hand' THEN e.def_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type = 'weapon' THEN FLOOR(e.def_bonus * 0.8) ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type != 'weapon' THEN e.def_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type IN ('chest', 'helmet', 'legs', 'boots', 'ring_1', 'ring_2', 'necklace', 'amulet') THEN e.def_bonus ELSE 0 END), 0),
        
        COALESCE(SUM(e.mana_bonus), 0),
        COALESCE(SUM(e.speed_bonus), 0),
        COALESCE(SUM(e.hp_bonus), 0),
        COALESCE(SUM(e.critical_chance_bonus), 0),
        COALESCE(SUM(e.critical_damage_bonus), 0),
        COALESCE(SUM(e.double_attack_chance_bonus), 0),
        COALESCE(SUM(e.magic_damage_bonus), 0),
        COALESCE(SUM(e.critical_resistance_bonus), 0),
        
        COUNT(CASE WHEN ce.slot_type IN ('chest', 'helmet', 'legs', 'boots') THEN 1 END)
    INTO 
        total_atk_bonus,
        total_def_bonus,
        total_mana_bonus,
        total_speed_bonus,
        total_hp_bonus,
        total_critical_chance_bonus,
        total_critical_damage_bonus,
        total_double_attack_chance_bonus,
        total_magic_damage_bonus,
        total_critical_resistance_bonus,
        armor_pieces_count
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id AND ce.is_equipped = true;

    -- Verificar se tem set completo de armadura (4 peças)
    has_full_armor_set := armor_pieces_count >= 4;

    -- Aplicar bônus de conjunto de armadura completa
    IF has_full_armor_set THEN
        total_def_bonus := FLOOR(total_def_bonus * 1.2);  -- +20% defesa
        total_hp_bonus := FLOOR(total_hp_bonus * 1.15);   -- +15% HP
        total_critical_resistance_bonus := total_critical_resistance_bonus * 1.25; -- +25% resistência crítica
    ELSIF armor_pieces_count >= 3 THEN
        total_def_bonus := FLOOR(total_def_bonus * 1.1);  -- +10% defesa
        total_critical_resistance_bonus := total_critical_resistance_bonus * 1.15; -- +15% resistência crítica
    ELSIF armor_pieces_count >= 2 THEN
        total_hp_bonus := FLOOR(total_hp_bonus * 1.05);   -- +5% HP
    END IF;

    RETURN QUERY SELECT 
        total_atk_bonus,
        total_def_bonus,
        total_mana_bonus,
        total_speed_bonus,
        total_hp_bonus,
        total_critical_chance_bonus,
        total_critical_damage_bonus,
        total_double_attack_chance_bonus,
        total_magic_damage_bonus,
        total_critical_resistance_bonus,
        armor_pieces_count,
        has_full_armor_set;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_chest_count INTEGER;
    v_helmet_count INTEGER;
    v_legs_count INTEGER;
    v_boots_count INTEGER;
BEGIN
    -- Contar novos equipamentos por tipo
    SELECT COUNT(*) INTO v_chest_count FROM equipment WHERE type = 'chest';
    SELECT COUNT(*) INTO v_helmet_count FROM equipment WHERE type = 'helmet';
    SELECT COUNT(*) INTO v_legs_count FROM equipment WHERE type = 'legs';
    SELECT COUNT(*) INTO v_boots_count FROM equipment WHERE type = 'boots';
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== NOVOS EQUIPAMENTOS DE ARMADURA ADICIONADOS ===';
    RAISE NOTICE 'Peitorais (chest): % equipamentos', v_chest_count;
    RAISE NOTICE 'Capacetes (helmet): % equipamentos', v_helmet_count;
    RAISE NOTICE 'Perneiras (legs): % equipamentos', v_legs_count;
    RAISE NOTICE 'Botas (boots): % equipamentos', v_boots_count;
    RAISE NOTICE 'Sistema de bônus de conjunto implementado';
    RAISE NOTICE 'Função de cálculo atualizada';
    RAISE NOTICE '===============================================';
END $$; 