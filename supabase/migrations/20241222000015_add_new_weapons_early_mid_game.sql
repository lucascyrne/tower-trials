-- =====================================
-- MIGRAÇÃO: NOVAS ARMAS EARLY E MID GAME
-- Data: 2024-12-22
-- Descrição: Adiciona novas armas para preencher gaps de progressão nos níveis 2-4, 6-9, 11-14
-- =====================================

-- Esta migração adiciona:
-- 1. Armas níveis 2-4 para early game suave
-- 2. Armas níveis 6-9 para mid-early game
-- 3. Armas níveis 11-14 para mid-game
-- 4. Variedade de tipos de arma (espadas, machados, cajados, adagas, maças)
-- 5. Stats balanceados com progressão linear

-- =====================================
-- 1. ARMAS EARLY GAME (NÍVEIS 2-4)
-- =====================================

INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, hp_bonus, critical_chance_bonus, critical_damage_bonus, double_attack_chance_bonus, magic_damage_bonus, price, is_unlocked) VALUES

-- NÍVEL 2 - Transição suave do nível 1
('Espada Afiada', 'Espada básica com lâmina bem afiada', 'weapon', 'sword', 'common', 2, 10, 0, 0, 2, 0, 1.5, 4, 0, 0, 150, true),
('Adaga de Ferro', 'Adaga rápida feita de ferro puro', 'weapon', 'dagger', 'common', 2, 8, 0, 0, 4, 0, 2.5, 6, 1.5, 0, 140, true),
('Bastão de Madeira', 'Bastão simples mas eficaz para magos', 'weapon', 'staff', 'common', 2, 6, 0, 8, 1, 0, 0.5, 2, 0, 10, 130, true),
('Machado Leve', 'Machado menor mas mais ágil', 'weapon', 'axe', 'common', 2, 12, 0, 0, 1, 0, 2.0, 9, 0, 0, 160, true),
('Martelo Pequeno', 'Martelo compacto para iniciantes', 'weapon', 'blunt', 'common', 2, 14, 0, 0, -1, 0, 1.0, 12, 0, 0, 145, true),

-- NÍVEL 3 - Progressão continuada
('Lâmina Polida', 'Espada com lâmina perfeitamente polida', 'weapon', 'sword', 'common', 3, 12, 0, 0, 3, 0, 2.0, 5, 0, 0, 180, true),
('Punhal Curvado', 'Adaga com lâmina curva para cortes precisos', 'weapon', 'dagger', 'common', 3, 10, 0, 0, 5, 0, 3.0, 7, 2.0, 0, 170, true),
('Varinha Encantada', 'Varinha com pequenos encantamentos', 'weapon', 'staff', 'common', 3, 7, 0, 10, 2, 0, 1.0, 3, 0, 12, 165, true),
('Machado de Bronze', 'Machado resistente de bronze', 'weapon', 'axe', 'common', 3, 14, 0, 0, 0, 0, 2.5, 11, 0, 0, 190, true),
('Maza de Guerra', 'Maza pesada para combate', 'weapon', 'blunt', 'common', 3, 16, 0, 0, -1, 0, 1.5, 14, 0, 0, 175, true),

-- NÍVEL 4 - Preparação para uncommon
('Espada Temperada', 'Espada com lâmina temperada ao fogo', 'weapon', 'sword', 'common', 4, 14, 0, 0, 3, 0, 2.5, 6, 0, 0, 220, true),
('Adaga Serrilhada', 'Adaga com lâmina serrilhada mortal', 'weapon', 'dagger', 'common', 4, 12, 0, 0, 6, 0, 3.5, 8, 2.5, 0, 210, true),
('Cetro Menor', 'Cetro básico com cristal pequeno', 'weapon', 'staff', 'common', 4, 9, 0, 12, 2, 0, 1.5, 4, 0, 14, 200, true),
('Machado Pesado', 'Machado com cabeça dupla', 'weapon', 'axe', 'common', 4, 16, 0, 0, -1, 0, 3.0, 13, 0, 0, 230, true),
('Martelo de Ferro', 'Martelo sólido de ferro forjado', 'weapon', 'blunt', 'common', 4, 18, 0, 0, -2, 0, 2.0, 16, 0, 0, 215, true),

-- =====================================
-- 2. ARMAS MID-EARLY GAME (NÍVEIS 6-9)
-- =====================================

-- NÍVEL 6 - Entre uncommon básico e avançado
('Espada do Soldado', 'Espada padrão usada por soldados', 'weapon', 'sword', 'uncommon', 6, 20, 0, 0, 4, 0, 3.0, 8, 0, 0, 450, true),
('Adaga Venenosa', 'Adaga com lâmina tratada com veneno', 'weapon', 'dagger', 'uncommon', 6, 17, 0, 0, 7, 0, 4.5, 10, 3.0, 2, 430, true),
('Bastão de Cristal', 'Bastão com cristal mágico incrustado', 'weapon', 'staff', 'uncommon', 6, 14, 0, 18, 3, 0, 2.0, 5, 0, 20, 420, true),
('Machado Bárbaro', 'Machado tribal com lâmina larga', 'weapon', 'axe', 'uncommon', 6, 24, 0, 0, -1, 0, 3.5, 15, 0, 0, 460, true),
('Martelo de Batalha', 'Martelo usado em grandes batalhas', 'weapon', 'blunt', 'uncommon', 6, 22, 0, 0, -2, 0, 2.5, 18, 0, 0, 440, true),

-- NÍVEL 7 - Progressão intermediária
('Lâmina Élfica Menor', 'Espada élfica de qualidade inferior', 'weapon', 'sword', 'uncommon', 7, 22, 0, 2, 5, 0, 3.5, 9, 1.0, 5, 520, true),
('Stiletto', 'Adaga fina e mortal para ataques precisos', 'weapon', 'dagger', 'uncommon', 7, 19, 0, 0, 8, 0, 5.0, 11, 3.5, 0, 500, true),
('Cajado de Prata', 'Cajado ornamentado com detalhes em prata', 'weapon', 'staff', 'uncommon', 7, 16, 0, 20, 4, 0, 2.5, 6, 0, 22, 490, true),
('Machado Duplo', 'Machado com duas lâminas afiadas', 'weapon', 'axe', 'uncommon', 7, 26, 0, 0, -1, 0, 4.0, 17, 0, 0, 530, true),
('Maça Cravejada', 'Maça com cravos de ferro', 'weapon', 'blunt', 'uncommon', 7, 24, 0, 0, -2, 0, 3.0, 20, 0, 0, 510, true),

-- NÍVEL 8 - Preparação para rare
('Espada do Cavaleiro', 'Espada nobre usada por cavaleiros', 'weapon', 'sword', 'uncommon', 8, 24, 1, 3, 5, 5, 4.0, 10, 1.5, 3, 600, true),
('Adaga da Lua', 'Adaga que brilha com luz lunar', 'weapon', 'dagger', 'uncommon', 8, 21, 0, 5, 9, 0, 5.5, 12, 4.0, 8, 580, true),
('Bastão do Sábio', 'Bastão usado por sábios e eruditos', 'weapon', 'staff', 'uncommon', 8, 18, 0, 22, 4, 0, 3.0, 7, 0, 25, 570, true),
('Machado do Executor', 'Machado temido usado por executores', 'weapon', 'axe', 'uncommon', 8, 28, 0, 0, -2, 0, 4.5, 19, 0, 0, 610, true),
('Martelo do Forjador', 'Martelo usado por mestres ferreiros', 'weapon', 'blunt', 'uncommon', 8, 26, 0, 0, -1, 0, 3.5, 22, 0, 0, 590, true),

-- NÍVEL 9 - Transição para rare
('Espada Encantada', 'Espada com leves encantamentos mágicos', 'weapon', 'sword', 'uncommon', 9, 26, 1, 5, 6, 8, 4.5, 11, 2.0, 8, 680, true),
('Adaga das Sombras', 'Adaga que se move como as sombras', 'weapon', 'dagger', 'uncommon', 9, 23, 0, 3, 10, 0, 6.0, 13, 4.5, 5, 660, true),
('Cetro de Energia', 'Cetro que pulsa com energia mágica', 'weapon', 'staff', 'uncommon', 9, 20, 0, 25, 5, 0, 3.5, 8, 0, 28, 650, true),
('Machado Sangrento', 'Machado que se torna mais forte com sangue', 'weapon', 'axe', 'uncommon', 9, 30, 0, 0, -1, 0, 5.0, 21, 0, 0, 690, true),
('Martelo do Trovão', 'Martelo que ecoa como trovão', 'weapon', 'blunt', 'uncommon', 9, 28, 0, 0, -1, 0, 4.0, 24, 0, 3, 670, true),

-- =====================================
-- 3. ARMAS MID GAME (NÍVEIS 11-14)
-- =====================================

-- NÍVEL 11 - Início do mid game
('Lâmina do Vento', 'Espada leve como o vento', 'weapon', 'sword', 'rare', 11, 37, 0, 5, 8, 10, 5.0, 16, 2.5, 5, 1000, true),
('Adaga Viper', 'Adaga mortal como uma víbora', 'weapon', 'dagger', 'rare', 11, 30, 0, 3, 12, 0, 7.0, 14, 5.0, 3, 950, true),
('Bastão da Tempestade', 'Bastão que controla ventos e raios', 'weapon', 'staff', 'rare', 11, 24, 0, 30, 6, 0, 4.0, 9, 0, 38, 980, true),
('Machado do Berserker', 'Machado que desperta fúria interior', 'weapon', 'axe', 'rare', 11, 40, 0, 0, -2, 0, 5.5, 23, 0, 0, 1020, true),
('Martelo dos Ancestrais', 'Martelo abençoado pelos ancestrais', 'weapon', 'blunt', 'rare', 11, 44, 0, 0, -3, 0, 4.5, 27, 0, 8, 1010, true),

-- NÍVEL 12 - Mid game consolidado
('Espada do Paladino', 'Espada sagrada de um paladino', 'weapon', 'sword', 'rare', 12, 39, 2, 8, 7, 15, 5.5, 17, 3.0, 12, 1150, true),
('Adaga do Assassino', 'Adaga preferida por assassinos profissionais', 'weapon', 'dagger', 'rare', 12, 32, 0, 5, 13, 0, 7.5, 15, 5.5, 5, 1100, true),
('Cajado do Arquimago', 'Cajado usado por arquimagos', 'weapon', 'staff', 'rare', 12, 26, 0, 35, 7, 0, 4.5, 10, 0, 42, 1130, true),
('Machado Tribal', 'Machado sagrado de uma tribo antiga', 'weapon', 'axe', 'rare', 12, 42, 0, 0, -1, 0, 6.0, 25, 0, 5, 1170, true),
('Martelo Sagrado', 'Martelo abençoado por divindades', 'weapon', 'blunt', 'rare', 12, 46, 1, 5, -2, 10, 5.0, 29, 0, 15, 1160, true),

-- NÍVEL 13 - Preparação para epic
('Espada Flamejante Menor', 'Espada com chamas menores', 'weapon', 'sword', 'rare', 13, 41, 1, 10, 8, 12, 6.0, 18, 3.5, 18, 1300, true),
('Adaga do Caos', 'Adaga imbuída com energia caótica', 'weapon', 'dagger', 'rare', 13, 34, 0, 8, 14, 0, 8.0, 16, 6.0, 10, 1250, true),
('Bastão Cristalino', 'Bastão feito de cristal puro', 'weapon', 'staff', 'rare', 13, 28, 0, 40, 8, 0, 5.0, 11, 0, 45, 1280, true),
('Machado Demoníaco', 'Machado com poder demoníaco', 'weapon', 'axe', 'rare', 13, 44, 0, 0, -1, 0, 6.5, 27, 0, 8, 1320, true),
('Martelo da Justiça', 'Martelo que pune os injustos', 'weapon', 'blunt', 'rare', 13, 48, 2, 8, -2, 15, 5.5, 31, 0, 20, 1310, true),

-- NÍVEL 14 - Transição para epic
('Lâmina Espectral', 'Espada que existe entre dimensões', 'weapon', 'sword', 'rare', 14, 43, 2, 12, 9, 15, 6.5, 19, 4.0, 22, 1450, true),
('Adaga do Vazio', 'Adaga que corta através do vazio', 'weapon', 'dagger', 'rare', 14, 36, 0, 10, 15, 0, 8.5, 17, 6.5, 15, 1400, true),
('Cetro Real', 'Cetro usado pela realeza mágica', 'weapon', 'staff', 'rare', 14, 30, 1, 45, 9, 5, 5.5, 12, 0, 48, 1430, true),
('Machado do Apocalipse', 'Machado que anuncia o fim', 'weapon', 'axe', 'rare', 14, 46, 0, 0, -1, 0, 7.0, 29, 0, 12, 1470, true),
('Martelo Cósmico', 'Martelo forjado com materiais cósmicos', 'weapon', 'blunt', 'rare', 14, 50, 2, 10, -2, 20, 6.0, 33, 0, 25, 1460, true);

-- =====================================
-- 4. LOG DE CONCLUSÃO
-- =====================================

DO $$
DECLARE
    v_new_weapons_count INTEGER;
    v_level_2_count INTEGER;
    v_level_6_9_count INTEGER;
    v_level_11_14_count INTEGER;
BEGIN
    -- Contar novas armas adicionadas
    SELECT COUNT(*) INTO v_new_weapons_count 
    FROM equipment 
    WHERE type = 'weapon' 
    AND level_requirement IN (2, 3, 4, 6, 7, 8, 9, 11, 12, 13, 14)
    AND name IN (
        'Espada Afiada', 'Adaga de Ferro', 'Bastão de Madeira', 'Machado Leve', 'Martelo Pequeno',
        'Lâmina Polida', 'Punhal Curvado', 'Varinha Encantada', 'Machado de Bronze', 'Maza de Guerra',
        'Espada Temperada', 'Adaga Serrilhada', 'Cetro Menor', 'Machado Pesado', 'Martelo de Ferro',
        'Espada do Soldado', 'Adaga Venenosa', 'Bastão de Cristal', 'Machado Bárbaro', 'Martelo de Batalha',
        'Lâmina Élfica Menor', 'Stiletto', 'Cajado de Prata', 'Machado Duplo', 'Maça Cravejada',
        'Espada do Cavaleiro', 'Adaga da Lua', 'Bastão do Sábio', 'Machado do Executor', 'Martelo do Forjador',
        'Espada Encantada', 'Adaga das Sombras', 'Cetro de Energia', 'Machado Sangrento', 'Martelo do Trovão',
        'Lâmina do Vento', 'Adaga Viper', 'Bastão da Tempestade', 'Machado do Berserker', 'Martelo dos Ancestrais',
        'Espada do Paladino', 'Adaga do Assassino', 'Cajado do Arquimago', 'Machado Tribal', 'Martelo Sagrado',
        'Espada Flamejante Menor', 'Adaga do Caos', 'Bastão Cristalino', 'Machado Demoníaco', 'Martelo da Justiça',
        'Lâmina Espectral', 'Adaga do Vazio', 'Cetro Real', 'Machado do Apocalipse', 'Martelo Cósmico'
    );
    
    -- Contar por faixas de nível
    SELECT COUNT(*) INTO v_level_2_count FROM equipment WHERE type = 'weapon' AND level_requirement IN (2, 3, 4);
    SELECT COUNT(*) INTO v_level_6_9_count FROM equipment WHERE type = 'weapon' AND level_requirement IN (6, 7, 8, 9);
    SELECT COUNT(*) INTO v_level_11_14_count FROM equipment WHERE type = 'weapon' AND level_requirement IN (11, 12, 13, 14);
    
    RAISE NOTICE '===============================================';
    RAISE NOTICE '=== NOVAS ARMAS EARLY E MID GAME ADICIONADAS ===';
    RAISE NOTICE 'Total de novas armas: %', v_new_weapons_count;
    RAISE NOTICE 'Armas níveis 2-4: %', v_level_2_count;
    RAISE NOTICE 'Armas níveis 6-9: %', v_level_6_9_count;
    RAISE NOTICE 'Armas níveis 11-14: %', v_level_11_14_count;
    RAISE NOTICE 'Progressão suave preenchida';
    RAISE NOTICE 'Variedade de tipos: espadas, adagas, cajados, machados, martelos';
    RAISE NOTICE 'Stats balanceados com monstros rebalanceados';
    RAISE NOTICE '===============================================';
END $$; 