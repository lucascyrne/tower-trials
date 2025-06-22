-- Migração: Expandir Sistema de Equipamentos
-- Adiciona novos tipos de equipamentos: ring, necklace, amulet
-- Reorganiza acessórios existentes e adiciona novos equipamentos

-- =====================================
-- 1. NOTA: VALORES DO ENUM JÁ ADICIONADOS
-- =====================================

-- Os novos valores do enum (ring, necklace, amulet) foram adicionados
-- na migração 20241222000005_add_equipment_enum_values.sql

-- =====================================
-- 2. REORGANIZAR EQUIPAMENTOS EXISTENTES
-- =====================================

-- Converter acessórios existentes baseado no nome para anéis
UPDATE equipment 
SET type = 'ring'::equipment_type
WHERE type = 'accessory' 
AND (
  name ILIKE '%anel%' OR 
  name ILIKE '%ring%'
);

-- Converter acessórios existentes baseado no nome para colares
UPDATE equipment 
SET type = 'necklace'::equipment_type
WHERE type = 'accessory' 
AND (
  name ILIKE '%colar%' OR
  name ILIKE '%necklace%' OR
  name ILIKE '%corrente%' OR
  name ILIKE '%chain%' OR
  name ILIKE '%torque%'
);

-- Converter o restante dos acessórios para amuletos
UPDATE equipment 
SET type = 'amulet'::equipment_type
WHERE type = 'accessory';

-- =====================================
-- 3. ADICIONAR NOVOS EQUIPAMENTOS
-- =====================================

INSERT INTO equipment (name, description, type, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, price, is_unlocked) VALUES

-- =====================================
-- ANÉIS - EARLY GAME (Nível 1-8)
-- =====================================
('Anel de Ferro', 'Um anel simples feito de ferro', 'ring', 'common', 1, 1, 1, 0, 1, 5, 0.5, 0, 0, 0, 50, true),
('Anel de Bronze', 'Anel resistente com leve brilho', 'ring', 'common', 2, 1, 0, 3, 0, 0, 0, 0, 0, 0.5, 60, true),
('Anel de Prata', 'Anel de prata com gravações simples', 'ring', 'common', 3, 2, 0, 5, 1, 0, 1.0, 1, 0, 0, 80, true),
('Anel Rúnico', 'Anel gravado with runas menores', 'ring', 'uncommon', 5, 1, 1, 8, 0, 5, 0.5, 0, 0, 1.5, 150, true),
('Anel do Aventureiro', 'Anel usado por aventureiros experientes', 'ring', 'uncommon', 6, 3, 0, 0, 3, 10, 1.5, 2, 0.5, 0, 180, true),
('Anel da Velocidade', 'Concede leveza aos movimentos', 'ring', 'uncommon', 7, 0, 0, 0, 5, 0, 0, 0, 1.0, 0, 200, true),
('Anel de Cristal', 'Anel com um pequeno cristal mágico', 'ring', 'uncommon', 8, 2, 1, 12, 1, 8, 1.0, 1, 0, 2.0, 220, true),

-- =====================================
-- ANÉIS - MID GAME (Nível 9-15)
-- =====================================
('Anel Encantado', 'Anel imbuído com magia elemental', 'ring', 'rare', 9, 4, 0, 15, 2, 0, 2.0, 3, 0, 3.0, 350, true),
('Anel de Ouro', 'Anel de ouro puro com gemas menores', 'ring', 'rare', 10, 3, 2, 10, 1, 15, 1.5, 2, 0.5, 1.0, 400, true),
('Anel do Berserker', 'Anel que desperta a fúria interior', 'ring', 'rare', 11, 6, 0, 0, 0, 0, 3.0, 8, 1.5, 0, 450, true),
('Anel Élfico', 'Anel delicado forjado pelos elfos', 'ring', 'rare', 12, 2, 1, 20, 4, 10, 2.5, 3, 1.0, 4.0, 500, true),
('Anel do Sábio', 'Aumenta a sabedoria e conexão mágica', 'ring', 'rare', 13, 1, 3, 25, 0, 20, 0.5, 0, 0, 5.0, 550, true),
('Anel de Platina', 'Anel raro de platina com runas complexas', 'ring', 'rare', 14, 5, 3, 15, 3, 18, 2.5, 4, 1.0, 2.5, 600, true),
('Anel Dracônico', 'Forjado com escamas de dragão menor', 'ring', 'rare', 15, 7, 2, 18, 2, 25, 3.0, 6, 1.5, 3.0, 700, false),

-- =====================================
-- ANÉIS - LATE GAME (Nível 16+)
-- =====================================
('Anel do Poder', 'Anel que amplifica todas as habilidades', 'ring', 'epic', 16, 8, 5, 30, 5, 35, 4.0, 8, 2.0, 6.0, 1200, false),
('Anel do Vazio', 'Canaliza energia do vazio cósmico', 'ring', 'epic', 18, 6, 3, 40, 3, 25, 3.5, 5, 1.0, 8.0, 1500, false),
('Anel do Destino', 'Influencia o destino do portador', 'ring', 'legendary', 20, 12, 8, 50, 8, 50, 6.0, 15, 3.0, 10.0, 3000, false),

-- =====================================
-- COLARES - EARLY GAME (Nível 1-8)
-- =====================================
('Colar de Couro', 'Colar simples de couro com pingente de madeira', 'necklace', 'common', 1, 0, 2, 2, 0, 8, 0, 0, 0, 0, 70, true),
('Corrente de Bronze', 'Corrente resistente de bronze', 'necklace', 'common', 2, 2, 1, 0, 1, 5, 0.5, 1, 0, 0, 90, true),
('Colar de Pérolas', 'Colar delicado com pequenas pérolas', 'necklace', 'common', 3, 0, 1, 8, 2, 10, 0, 0, 0, 1.0, 120, true),
('Corrente de Prata', 'Corrente brilhante de prata pura', 'necklace', 'uncommon', 5, 3, 2, 12, 1, 15, 1.0, 2, 0, 1.5, 200, true),
('Colar Rúnico', 'Colar com pingente gravado em runas', 'necklace', 'uncommon', 6, 2, 3, 15, 0, 20, 0.5, 1, 0, 2.5, 250, true),
('Corrente do Guerreiro', 'Usada por guerreiros veteranos', 'necklace', 'uncommon', 7, 5, 1, 5, 2, 12, 1.5, 3, 0.5, 0, 280, true),
('Colar de Cristal', 'Pingente de cristal que pulsa com energia', 'necklace', 'uncommon', 8, 1, 2, 20, 1, 18, 1.0, 1, 0, 3.0, 320, true),

-- =====================================
-- COLARES - MID GAME (Nível 9-15)
-- =====================================
('Corrente Encantada', 'Corrente imbuída com proteção mágica', 'necklace', 'rare', 9, 4, 5, 18, 2, 25, 1.5, 2, 0, 3.5, 450, true),
('Colar de Ouro', 'Colar luxuoso de ouro com gemas', 'necklace', 'rare', 10, 3, 3, 25, 3, 30, 2.0, 4, 0.5, 2.0, 500, true),
('Torque Bárbaro', 'Colar tribal que aumenta a ferocidade', 'necklace', 'rare', 11, 8, 2, 0, 1, 20, 2.5, 6, 1.0, 0, 550, true),
('Colar Élfico', 'Colar delicado com magia natural', 'necklace', 'rare', 12, 2, 4, 35, 4, 25, 1.5, 2, 0, 5.0, 600, true),
('Colar do Sábio', 'Focado em aumentar poder mágico', 'necklace', 'rare', 13, 1, 4, 40, 1, 35, 1.0, 1, 0, 6.0, 650, true),
('Corrente de Platina', 'Corrente rara com proteções avançadas', 'necklace', 'rare', 14, 5, 6, 30, 3, 40, 2.0, 3, 0.5, 4.0, 750, true),
('Colar Dracônico', 'Pingente feito de escama de dragão', 'necklace', 'rare', 15, 7, 5, 28, 4, 35, 2.5, 5, 1.0, 4.5, 850, false),

-- =====================================
-- COLARES - LATE GAME (Nível 16+)
-- =====================================
('Torque dos Titãs', 'Colar forjado pelos antigos titãs', 'necklace', 'epic', 16, 10, 8, 45, 5, 60, 3.0, 6, 1.5, 7.0, 1400, false),
('Colar do Vazio', 'Canaliza energias de outras dimensões', 'necklace', 'epic', 18, 8, 6, 60, 4, 50, 2.5, 4, 1.0, 10.0, 1800, false),
('Corrente do Destino', 'Liga o portador ao tecido do destino', 'necklace', 'legendary', 20, 15, 12, 80, 8, 80, 5.0, 10, 2.5, 15.0, 4000, false),

-- =====================================
-- AMULETOS - EARLY GAME (Nível 1-8)
-- =====================================
('Amuleto de Madeira', 'Pequeno amuleto entalhado em madeira', 'amulet', 'common', 1, 1, 0, 3, 1, 3, 0, 0, 0, 0.5, 60, true),
('Medalha de Bronze', 'Medalha comemorativa de bronze', 'amulet', 'common', 2, 1, 2, 0, 0, 8, 0, 1, 0, 0, 80, true),
('Talismã da Sorte', 'Pequeno talismã que atrai boa sorte', 'amulet', 'common', 3, 0, 1, 5, 2, 5, 1.0, 0, 0.5, 0, 100, true),
('Broche de Prata', 'Broche elegante de prata', 'amulet', 'uncommon', 5, 2, 1, 10, 1, 10, 1.0, 2, 0, 1.0, 180, true),
('Medalha do Valor', 'Medalha concedida por bravura', 'amulet', 'uncommon', 6, 4, 2, 5, 1, 15, 1.5, 2, 0.5, 0, 220, true),
('Amuleto Rúnico', 'Amuleto gravado com runas de proteção', 'amulet', 'uncommon', 7, 1, 4, 12, 0, 20, 0.5, 1, 0, 2.0, 260, true),
('Talismã Encantado', 'Talismã com pequeno encantamento', 'amulet', 'uncommon', 8, 2, 2, 15, 2, 12, 1.5, 2, 0, 2.5, 300, true),

-- =====================================
-- AMULETOS - MID GAME (Nível 9-15)
-- =====================================
('Broche de Ouro', 'Broche luxuoso com gemas incrustadas', 'amulet', 'rare', 9, 3, 3, 20, 2, 25, 2.0, 3, 0.5, 3.0, 420, true),
('Medalha dos Heróis', 'Concedida apenas aos mais valentes', 'amulet', 'rare', 10, 6, 2, 15, 3, 20, 2.5, 4, 1.0, 1.5, 480, true),
('Amuleto Élfico', 'Amuleto abençoado pelos elfos', 'amulet', 'rare', 11, 2, 3, 30, 4, 30, 1.5, 2, 0, 4.5, 520, true),
('Talismã do Poder', 'Amplifica as habilidades naturais', 'amulet', 'rare', 12, 4, 4, 25, 3, 25, 2.0, 3, 0.5, 3.5, 580, true),
('Broche Dracônico', 'Broche forjado com materiais dracônicos', 'amulet', 'rare', 13, 5, 3, 22, 2, 30, 2.5, 4, 1.0, 4.0, 620, true),
('Medalha Imperial', 'Medalha do antigo império', 'amulet', 'rare', 14, 4, 5, 28, 3, 35, 2.0, 3, 0.5, 4.5, 700, true),
('Amuleto dos Anciões', 'Carrega a sabedoria dos antigos', 'amulet', 'rare', 15, 3, 6, 35, 2, 40, 1.5, 2, 0, 6.0, 800, false),

-- =====================================
-- AMULETOS - LATE GAME (Nível 16+)
-- =====================================
('Símbolo dos Titãs', 'Símbolo sagrado dos antigos titãs', 'amulet', 'epic', 16, 8, 7, 50, 5, 55, 3.0, 5, 1.5, 8.0, 1300, false),
('Amuleto do Vazio', 'Conecta com energias primordiais', 'amulet', 'epic', 18, 6, 8, 65, 4, 60, 2.5, 4, 1.0, 12.0, 1700, false),
('Emblema do Destino', 'Marca daqueles que controlam o destino', 'amulet', 'legendary', 20, 12, 12, 75, 8, 75, 4.0, 8, 2.0, 18.0, 3500, false);

-- =====================================
-- 4. FUNÇÃO PARA CALCULAR BÔNUS COM NOVOS SLOTS
-- =====================================

-- Função atualizada para calcular bônus de equipamentos com novos slots
CREATE OR REPLACE FUNCTION calculate_equipment_bonuses_enhanced_v2(p_character_id UUID)
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
    accessories_count INTEGER,
    has_set_bonus BOOLEAN
) AS $$
BEGIN
    -- Inicializar valores
    total_atk_bonus := 0;
    total_def_bonus := 0;
    total_mana_bonus := 0;
    total_speed_bonus := 0;
    total_hp_bonus := 0;
    total_critical_chance_bonus := 0;
    total_critical_damage_bonus := 0;
    total_double_attack_chance_bonus := 0;
    total_magic_damage_bonus := 0;
    accessories_count := 0;
    has_set_bonus := false;

    -- Calcular bônus de todos os equipamentos incluindo acessórios
    SELECT 
        COALESCE(SUM(CASE WHEN ce.slot_type = 'main_hand' THEN e.atk_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type = 'weapon' THEN FLOOR(e.atk_bonus * 0.8) ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type != 'weapon' THEN e.atk_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type IN ('armor', 'ring_1', 'ring_2', 'necklace', 'amulet') THEN e.atk_bonus ELSE 0 END), 0),
        
        COALESCE(SUM(CASE WHEN ce.slot_type = 'main_hand' THEN e.def_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type = 'weapon' THEN FLOOR(e.def_bonus * 0.8) ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type = 'off_hand' AND e.type != 'weapon' THEN e.def_bonus ELSE 0 END), 0) +
        COALESCE(SUM(CASE WHEN ce.slot_type IN ('armor', 'ring_1', 'ring_2', 'necklace', 'amulet') THEN e.def_bonus ELSE 0 END), 0),
        
        COALESCE(SUM(e.mana_bonus), 0),
        COALESCE(SUM(e.speed_bonus), 0),
        COALESCE(SUM(e.hp_bonus), 0),
        COALESCE(SUM(e.critical_chance_bonus), 0),
        COALESCE(SUM(e.critical_damage_bonus), 0),
        COALESCE(SUM(e.double_attack_chance_bonus), 0),
        COALESCE(SUM(e.magic_damage_bonus), 0),
        
        COUNT(CASE WHEN ce.slot_type IN ('ring_1', 'ring_2', 'necklace', 'amulet') THEN 1 END)
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
        accessories_count
    FROM character_equipment ce
    JOIN equipment e ON ce.equipment_id = e.id
    WHERE ce.character_id = p_character_id AND ce.is_equipped = true;

    -- Aplicar bônus de conjunto
    IF accessories_count >= 4 THEN
        total_atk_bonus := FLOOR(total_atk_bonus * 1.1);
        total_def_bonus := FLOOR(total_def_bonus * 1.1);
        total_critical_chance_bonus := total_critical_chance_bonus * 1.15;
        has_set_bonus := true;
    ELSIF accessories_count >= 3 THEN
        total_critical_chance_bonus := total_critical_chance_bonus * 1.1;
        total_speed_bonus := FLOOR(total_speed_bonus * 1.05);
        has_set_bonus := true;
    ELSIF accessories_count >= 2 THEN
        total_critical_damage_bonus := total_critical_damage_bonus * 1.05;
        has_set_bonus := true;
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
        accessories_count,
        has_set_bonus;
END;
$$ LANGUAGE plpgsql; 