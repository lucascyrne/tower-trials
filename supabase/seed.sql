-- =============================================
-- SEED V2: Dados Iniciais Tower Trials
-- Version: 2.0
-- Description: Dados de teste com balanceamento aplicado (final)
-- Execute após aplicar migrations 00001-00015
-- =============================================

-- Remover dados existentes em ordem adequada para evitar problemas de chaves estrangeiras
DELETE FROM monster_possible_drops;
DELETE FROM crafting_ingredients;
DELETE FROM crafting_recipes;
DELETE FROM character_drops;
DELETE FROM monster_drops;
DELETE FROM characters;
DELETE FROM character_consumables;
DELETE FROM character_equipment;
DELETE FROM consumables;
DELETE FROM equipment;
DELETE FROM monsters;
DELETE FROM special_events;

-- =====================================
-- CONSUMÍVEIS
-- =====================================

-- Inserir consumíveis com preços balanceados para progressão sustentável
INSERT INTO consumables (name, description, type, effect_value, price, craftable)
VALUES
    -- POÇÕES DE VIDA (rebalanceadas para acessibilidade)
    ('Poção de Vida Pequena', 'Recupera 20 HP instantaneamente', 'potion', 20, 15, false), -- Muito mais barata!
    ('Poção de Vida Média', 'Recupera 50 HP instantaneamente', 'potion', 50, 60, true),   -- Mais acessível
    ('Poção de Vida Grande', 'Recupera 100 HP instantaneamente', 'potion', 100, 200, true), -- Preço justo para late game
    
    -- POÇÕES DE MANA (acessíveis e proporcionais)
    ('Poção de Mana Pequena', 'Recupera 10 Mana instantaneamente', 'potion', 10, 12, false), -- Barata para incentivar uso de magias
    ('Poção de Mana Média', 'Recupera 25 Mana instantaneamente', 'potion', 25, 50, true),   -- Proporcional
    ('Poção de Mana Grande', 'Recupera 50 Mana instantaneamente', 'potion', 50, 160, true),  -- Mantém valor
    
    -- UTILITÁRIOS (preços ajustados)
    ('Antídoto', 'Remove todos os efeitos negativos', 'antidote', 0, 40, true), -- Mais barato para ser viável
    ('Elixir de Força', 'Aumenta ataque temporariamente em +15', 'buff', 15, 100, true), -- Preço justo
    ('Elixir de Defesa', 'Aumenta defesa temporariamente em +12', 'buff', 12, 80, true); -- Mais barato que força

-- =====================================
-- EQUIPAMENTOS
-- =====================================

-- Inserir equipamentos iniciais (com is_unlocked configurado adequadamente)
INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, price, is_unlocked) VALUES
    -- Equipamentos Básicos (Nível 1) - TODOS DESBLOQUEADOS e mais baratos
    ('Espada de Ferro', 'Uma espada básica mas confiável', 'weapon', 'sword', 'common', 1, 5, 0, 0, 1, 100, true),   -- Era 150, agora 100
    ('Adaga de Bronze', 'Pequena e rápida, boa para iniciantes', 'weapon', 'dagger', 'common', 1, 3, 0, 0, 3, 80, true),    -- Era 120, agora 80
    ('Varinha de Madeira', 'Canaliza magia básica', 'weapon', 'staff', 'common', 1, 2, 0, 5, 0, 90, true),          -- Era 140, agora 90
    ('Armadura de Couro', 'Proteção básica de couro resistente', 'armor', NULL, 'common', 1, 0, 5, 0, 2, 100, true),   -- Era 150, agora 100
    ('Túnica de Aprendiz', 'Vestimenta leve com encantamentos básicos', 'armor', NULL, 'common', 1, 0, 3, 5, 1, 85, true),     -- Era 130, agora 85
    ('Vestes Leves', 'Roupas leves que não atrapalham movimentos', 'armor', NULL, 'common', 1, 0, 2, 0, 5, 80, true),     -- Era 120, agora 80
    ('Anel de Mana', 'Um anel que aumenta o poder mágico', 'accessory', NULL, 'common', 1, 0, 0, 10, 0, 110, true),     -- Era 160, agora 110
    ('Amuleto de Proteção', 'Oferece uma leve proteção mágica', 'accessory', NULL, 'common', 1, 0, 3, 3, 0, 100, true),  -- Era 150, agora 100
    ('Botas Velozes', 'Botas que melhoram levemente a agilidade', 'accessory', NULL, 'common', 1, 0, 0, 0, 5, 90, true),  -- Era 140, agora 90

    -- Equipamentos Incomuns (Nível 5-8) - TODOS DESBLOQUEADOS PARA EARLY-MID GAME
    ('Espada de Aço', 'Uma espada bem forjada', 'weapon', 'sword', 'uncommon', 5, 12, 0, 0, 2, 350, true),
    ('Machado de Batalha', 'Arma pesada com boa capacidade de dano', 'weapon', 'axe', 'uncommon', 5, 15, 0, 0, -1, 380, true),
    ('Cajado de Carvalho', 'Canaliza magia com eficiência', 'weapon', 'staff', 'uncommon', 5, 8, 0, 10, 0, 360, true),
    ('Armadura de Malha', 'Armadura reforçada com anéis de metal', 'armor', NULL, 'uncommon', 5, 0, 12, 0, 0, 350, true),
    ('Manto do Ocultista', 'Manto tecido com fios especiais para magia', 'armor', NULL, 'uncommon', 5, 0, 8, 12, 0, 370, true),
    ('Armadura de Escamas', 'Proteção feita de escamas de répteis', 'armor', NULL, 'uncommon', 5, 0, 10, 0, 3, 330, true),
    ('Amuleto Arcano', 'Amplifica o poder mágico', 'accessory', NULL, 'uncommon', 5, 0, 0, 20, 0, 390, true),
    ('Anel de Força', 'Aumenta o poder físico do usuário', 'accessory', NULL, 'uncommon', 5, 8, 0, 0, 0, 380, true),
    ('Braceletes de Defesa', 'Oferecem proteção adicional', 'accessory', NULL, 'uncommon', 5, 0, 8, 0, 3, 360, true),

    -- Equipamentos Raros (Nível 10-13) - ALGUNS DESBLOQUEADOS PARA MID-GAME
    ('Lâmina do Dragão', 'Forjada com escamas de dragão', 'weapon', 'sword', 'rare', 10, 25, 0, 0, 3, 800, true),
    ('Adaga Élfica', 'Adaga élfica com lâmina encantada', 'weapon', 'dagger', 'rare', 10, 20, 0, 5, 10, 780, true),
    ('Cetro Arcano', 'Poderosa arma mágica', 'weapon', 'staff', 'rare', 10, 15, 0, 25, 0, 850, true),
    ('Armadura de Placas', 'Proteção completa de metal', 'armor', NULL, 'rare', 10, 0, 25, 0, -2, 800, true),
    ('Manto Elemental', 'Manto imbuído com magia elemental', 'armor', NULL, 'rare', 10, 5, 15, 15, 0, 830, true),
    ('Armadura Dracônica', 'Feita de escamas de dragão', 'armor', NULL, 'rare', 10, 5, 20, 0, 5, 850, false), -- Bloqueado
    ('Coroa da Sabedoria', 'Aumenta significativamente o poder mágico', 'accessory', NULL, 'rare', 10, 5, 5, 30, 0, 900, true),
    ('Amuleto do Guardião', 'Oferece grande proteção', 'accessory', NULL, 'rare', 10, 0, 20, 10, 0, 880, true),
    ('Botas Aladas', 'Botas encantadas que aumentam a velocidade', 'accessory', NULL, 'rare', 10, 0, 0, 0, 25, 850, false), -- Bloqueado

    -- Equipamentos Épicos (Nível 15-18) - MAIORIA BLOQUEADA
    ('Espada do Abismo', 'Lâmina forjada nas profundezas do abismo', 'weapon', 'sword', 'epic', 15, 40, 0, 10, 5, 1800, false),
    ('Martelo de Titã', 'Arma massiva com poder devastador', 'weapon', 'blunt', 'epic', 15, 50, 0, 0, -5, 1900, false),
    ('Bastão de Necromante', 'Capaz de canalizar energia necrótica', 'weapon', 'staff', 'epic', 15, 30, 0, 40, 0, 2000, false),
    ('Armadura de Mithril', 'Forjada com o raro metal mithril', 'armor', NULL, 'epic', 15, 5, 40, 0, 5, 1800, false),
    ('Vestes do Arquimago', 'Vestes imbuídas com magia arcana', 'armor', NULL, 'epic', 15, 10, 25, 35, 0, 1900, false),
    ('Pele de Behemoth', 'Armadura feita da pele de uma criatura lendária', 'armor', NULL, 'epic', 15, 10, 35, 0, 10, 2000, false),
    ('Olho de Observador', 'Amuleto feito do olho de uma criatura mística', 'accessory', NULL, 'epic', 15, 15, 15, 25, 5, 2100, false),
    ('Coração Petrificado', 'Concede resistência sobrenatural', 'accessory', NULL, 'epic', 15, 0, 35, 15, 0, 2000, false),
    ('Asas Fantasmagóricas', 'Aumentam drasticamente a mobilidade', 'accessory', NULL, 'epic', 15, 10, 0, 10, 35, 1900, false),

    -- Equipamentos Lendários (Nível 20) - TODOS BLOQUEADOS
    ('Excalibur', 'A lendária espada do rei', 'weapon', 'sword', 'legendary', 20, 80, 20, 20, 20, 5000, false),
    ('Mjolnir', 'Martelo forjado por deuses', 'weapon', 'blunt', 'legendary', 20, 100, 0, 0, 10, 5000, false),
    ('Cajado de Merlin', 'O lendário cajado do maior mago', 'weapon', 'staff', 'legendary', 20, 50, 10, 80, 10, 5000, false),
    ('Armadura Divina', 'Forjada nos céus, esta armadura é quase impenetrável', 'armor', NULL, 'legendary', 20, 20, 80, 20, 0, 5000, false),
    ('Manto Celestial', 'Manto tecido com a própria luz das estrelas', 'armor', NULL, 'legendary', 20, 20, 50, 70, 10, 5000, false),
    ('Pele de Leviatã', 'Armadura feita da pele do lendário leviatã', 'armor', NULL, 'legendary', 20, 30, 70, 0, 30, 5000, false),
    ('Anel do Poder Supremo', 'Um anel para todos dominar', 'accessory', NULL, 'legendary', 20, 40, 40, 40, 0, 5000, false),
    ('Amuleto do Tempo', 'Permite manipular o fluxo do tempo', 'accessory', NULL, 'legendary', 20, 20, 20, 20, 60, 5000, false),
    ('Coração de Fênix', 'Concede poder de regeneração lendário', 'accessory', NULL, 'legendary', 20, 30, 30, 50, 20, 5000, false),

    -- =====================================
    -- ARMAS ADICIONAIS PARA PROGRESSÃO BALANCEADA
    -- =====================================

    -- MACHADOS - Completando a progressão
    ('Machado de Ferro', 'Um machado simples mas eficaz', 'weapon', 'axe', 'common', 1, 6, 0, 0, 0, 110, true),
    ('Machado de Guerra', 'Machado pesado usado em batalhas', 'weapon', 'axe', 'rare', 10, 28, 0, 0, 2, 820, true),
    ('Machado Devastador', 'Machado gigante com poder destrutivo', 'weapon', 'axe', 'epic', 15, 45, 0, 0, -3, 1850, false),
    ('Machado dos Berserkers', 'Lendário machado que aumenta a fúria em combate', 'weapon', 'axe', 'legendary', 20, 85, 10, 0, 15, 5000, false),

    -- ARMAS DE CONCUSSÃO (MAÇAS/MARTELOS) - Completando a progressão
    ('Clava de Madeira', 'Uma clava simples mas pesada', 'weapon', 'blunt', 'common', 1, 7, 0, 0, -1, 95, true),
    ('Maça de Ferro', 'Maça sólida com cabeça de ferro', 'weapon', 'blunt', 'uncommon', 5, 14, 0, 0, -1, 370, true),
    ('Martelo de Guerra', 'Martelo pesado usado por guerreiros', 'weapon', 'blunt', 'rare', 10, 30, 0, 0, -2, 850, true),
    ('Maça Divina', 'Maça abençoada pelos deuses', 'weapon', 'blunt', 'legendary', 20, 90, 15, 10, 5, 5000, false),

    -- ADAGAS - Completando a progressão  
    ('Punhal Afiado', 'Punhal pequeno mas mortal', 'weapon', 'dagger', 'uncommon', 5, 10, 0, 0, 8, 340, true),
    ('Lâmina Sombria', 'Adaga forjada nas sombras', 'weapon', 'dagger', 'epic', 15, 35, 0, 5, 15, 1750, false),
    ('Fang Lunar', 'Adaga lendária que brilha com luz da lua', 'weapon', 'dagger', 'legendary', 20, 65, 10, 15, 35, 5000, false),

    -- ESPADAS ADICIONAIS - Mais variedade
    ('Espada Curta', 'Espada ágil e manobrável', 'weapon', 'sword', 'uncommon', 5, 11, 0, 0, 5, 345, true),
    ('Espada Élfica', 'Espada élfica com lâmina prateada', 'weapon', 'sword', 'rare', 10, 24, 0, 5, 8, 790, true),
    ('Espada Flamejante', 'Espada imbuída com fogo eterno', 'weapon', 'sword', 'epic', 15, 42, 0, 8, 10, 1820, false),

    -- CAJADOS/VARINHAS ADICIONAIS - Mais variedade mágica
    ('Varinha de Cristal', 'Varinha que amplifica magia básica', 'weapon', 'staff', 'uncommon', 5, 6, 0, 15, 2, 355, true),
    ('Bastão Élfico', 'Bastão feito de madeira sagrada élfica', 'weapon', 'staff', 'rare', 10, 12, 0, 30, 3, 870, true),
    ('Cajado das Tempestades', 'Cajado que controla o poder dos raios', 'weapon', 'staff', 'epic', 15, 28, 0, 45, 5, 2050, false);

-- =====================================
-- MONSTROS
-- =====================================

-- Inserir os monstros
INSERT INTO monsters (name, hp, atk, def, mana, speed, behavior, min_floor, reward_xp, reward_gold) VALUES
-- Monstros Iniciais (Andares 1-5) - Recompensas MUITO AUMENTADAS
('Slime Verde', 50, 10, 5, 0, 8, 'balanced', 1, 35, 30),         -- Era 20/10, agora 35/30 (2 poções!)
('Slime Azul', 55, 12, 4, 0, 9, 'aggressive', 1, 40, 35),       -- Era 22/12, agora 40/35
('Rato Gigante', 45, 15, 3, 0, 15, 'aggressive', 1, 45, 40),    -- Era 25/15, agora 45/40
('Goblin', 60, 12, 8, 20, 12, 'balanced', 2, 55, 50),           -- Era 30/20, agora 55/50 (3+ poções!)
('Kobold', 55, 18, 5, 30, 14, 'aggressive', 3, 65, 60),         -- Era 35/25, agora 65/60
('Esqueleto', 70, 14, 10, 0, 10, 'defensive', 4, 75, 70),       -- Era 40/30, agora 75/70
('Lobo Selvagem', 65, 20, 6, 0, 16, 'aggressive', 4, 80, 75),   -- Era 42/28, agora 80/75
('Aranha Venenosa', 60, 16, 7, 15, 17, 'balanced', 5, 85, 80),  -- Era 45/32, agora 85/80

-- Monstros Intermediários (Andares 6-10) - Escalonamento equilibrado
('Orc', 100, 25, 15, 0, 11, 'aggressive', 6, 110, 100),         -- Era 60/40, agora 110/100
('Zumbi', 120, 20, 20, 0, 8, 'defensive', 7, 125, 115),         -- Era 70/45, agora 125/115
('Harpia', 90, 30, 10, 40, 18, 'aggressive', 8, 140, 130),      -- Era 80/50, agora 140/130
('Golem de Pedra', 150, 15, 30, 0, 7, 'defensive', 9, 155, 145),-- Era 90/55, agora 155/145
('Mago Corrompido', 80, 40, 5, 100, 13, 'balanced', 10, 170, 160), -- Era 100/60, agora 170/160
('Lobo Alpha', 110, 35, 12, 0, 18, 'aggressive', 6, 115, 105),  -- Era 65/42, agora 115/105
('Basilisco', 130, 20, 25, 30, 12, 'defensive', 7, 130, 120),   -- Era 75/47, agora 130/120
('Morcego Vampírico', 85, 30, 8, 20, 19, 'aggressive', 8, 145, 135), -- Era 78/48, agora 145/135
('Armadura Animada', 140, 25, 35, 0, 8, 'defensive', 9, 160, 150), -- Era 88/53, agora 160/150
('Druida Corrompido', 90, 35, 15, 120, 14, 'balanced', 10, 175, 165), -- Era 95/58, agora 175/165

-- Monstros Avançados (Andares 11-15) - Mid-game sustentável
('Ogro', 200, 40, 25, 0, 9, 'aggressive', 11, 220, 200),        -- Era 150/70, agora 220/200
('Quimera', 180, 45, 20, 60, 16, 'balanced', 12, 250, 230),     -- Era 170/75, agora 250/230
('Hidra', 250, 35, 30, 80, 12, 'defensive', 13, 280, 260),      -- Era 190/80, agora 280/260
('Dragão Jovem', 300, 50, 40, 120, 20, 'aggressive', 14, 320, 300), -- Era 220/90, agora 320/300
('Lich', 220, 60, 20, 200, 15, 'balanced', 15, 360, 340),       -- Era 250/100, agora 360/340
('Troll da Montanha', 230, 50, 30, 0, 9, 'aggressive', 11, 230, 210), -- Era 160/72, agora 230/210
('Elemental de Fogo', 190, 55, 15, 150, 17, 'balanced', 12, 260, 240), -- Era 180/78, agora 260/240
('Elemental de Gelo', 200, 45, 25, 160, 15, 'balanced', 13, 290, 270), -- Era 195/82, agora 290/270
('Golem de Cristal', 280, 35, 50, 0, 8, 'defensive', 14, 330, 310), -- Era 210/88, agora 330/310
('Necromante', 200, 70, 15, 250, 14, 'balanced', 15, 370, 350), -- Era 260/105, agora 370/350

-- Monstros End-Game (Andares 16-20) - Recompensas generosas
('Dragão Adulto', 400, 70, 50, 150, 22, 'aggressive', 16, 450, 400),   -- Era 300/120, agora 450/400
('Titã de Pedra', 500, 50, 70, 0, 8, 'defensive', 17, 500, 450),       -- Era 330/130, agora 500/450
('Demônio Alado', 350, 80, 40, 200, 25, 'aggressive', 18, 550, 500),   -- Era 360/140, agora 550/500
('Golem Ancestral', 600, 60, 90, 0, 7, 'defensive', 19, 600, 550),     -- Era 390/150, agora 600/550
('Dragão Ancião', 700, 100, 80, 300, 26, 'balanced', 20, 750, 700),    -- Era 500/200, agora 750/700
('Imp', 320, 75, 35, 150, 28, 'aggressive', 16, 420, 380),             -- Era 280/115, agora 420/380
('Golem de Lava', 450, 60, 60, 100, 10, 'defensive', 17, 480, 430),    -- Era 320/125, agora 480/430
('Cavaleiro da Morte', 380, 85, 45, 180, 18, 'aggressive', 18, 530, 480), -- Era 350/135, agora 530/480
('Wyrm Glacial', 550, 70, 65, 200, 20, 'balanced', 19, 580, 530),      -- Era 380/145, agora 580/530
('Dragão Elemental', 750, 110, 70, 350, 30, 'balanced', 20, 800, 800); -- Era 550/250, agora 800/800

-- =====================================
-- DROPS DE MONSTROS
-- =====================================

-- Inserir drops
INSERT INTO monster_drops (name, description, rarity, value)
VALUES
    -- Drops comuns (nível 1-5)
    ('Olho de Slime', 'Um olho viscoso de slime verde', 'common', 5),
    ('Gosma Azulada', 'Gosma brilhante de slime azul', 'common', 6),
    ('Dente de Rato', 'Dente afiado de rato gigante', 'common', 4),
    ('Garra de Goblin', 'Pequena garra afiada', 'common', 7),
    ('Escama de Kobold', 'Pequena escama resistente', 'common', 8),
    ('Fragmento de Osso', 'Fragmento de osso de esqueleto', 'common', 6),
    ('Presa de Lobo', 'Presa afiada de um lobo selvagem', 'common', 8),
    ('Glândula Venenosa', 'Glândula de veneno de aranha', 'common', 9),
    
    -- Drops incomuns (nível 6-10)
    ('Presa de Orc', 'Presa grande e pontiaguda', 'uncommon', 12),
    ('Carne Putrefata', 'Pedaço de carne de zumbi', 'uncommon', 14),
    ('Pena de Harpia', 'Pena afiada e colorida', 'uncommon', 15),
    ('Fragmento de Pedra', 'Pedaço do corpo de um golem', 'uncommon', 16),
    ('Orbe Mágico', 'Orbe usado por magos corrompidos', 'uncommon', 18),
    ('Garra de Alpha', 'Garra imponente de lobo alpha', 'uncommon', 15),
    ('Escama de Réptil', 'Escama resistente de basilisco', 'uncommon', 15),
    ('Sangue de Morcego', 'Sangue com propriedades mágicas', 'uncommon', 17),
    ('Lascas Metálicas', 'Lasca de armadura animada', 'uncommon', 16),
    ('Amuleto Corrompido', 'Amuleto usado por druidas corrompidos', 'uncommon', 19),
    
    -- Drops raros (nível 11-15)
    ('Dente de Ogro', 'Dente massivo e intimidador', 'rare', 25),
    ('Chifre de Quimera', 'Chifre mágico de uma quimera', 'rare', 30),
    ('Escama de Hidra', 'Escama resistente a magia', 'rare', 35),
    ('Escama de Dragão Jovem', 'Escama brilhante e valiosa', 'rare', 40),
    ('Essência de Lich', 'Energia mágica condensada', 'rare', 45),
    ('Couro de Troll', 'Pele resistente de troll', 'rare', 30),
    ('Essência Elemental', 'Essência pura de um elemental', 'rare', 40),
    ('Cristal de Gelo', 'Cristal formado de gelo puro', 'rare', 38),
    ('Fragmento de Cristal', 'Fragmento de cristal brilhante', 'rare', 42),
    ('Vial de Energia Necrótica', 'Energia escura engarrafada', 'rare', 45),
    
    -- Drops épicos (nível 16-19)
    ('Escama de Dragão Adulto', 'Escama dura como aço', 'epic', 70),
    ('Núcleo de Pedra', 'Centro de energia de um titã', 'epic', 80),
    ('Coração de Demônio', 'Coração pulsante de um demônio', 'epic', 90),
    ('Núcleo Ancestral', 'Relíquia poderosa de um golem', 'epic', 100),
    ('Essência Demoníaca', 'Essência concentrada de imp', 'epic', 75),
    ('Pedra de Lava', 'Pedra que irradia calor intenso', 'epic', 85),
    ('Espada Fantasma', 'Arma espectral de um cavaleiro', 'epic', 95),
    ('Cristal Glacial', 'Cristal que nunca derrete', 'epic', 105),
    
    -- Drops lendários (nível 20)
    ('Lágrima de Dragão', 'Lágrima cristalizada de um dragão ancião', 'legendary', 200),
    ('Pó de Estrela', 'Pó mágico com brilho de estrela', 'legendary', 250),
    ('Essência Elemental Pura', 'Essência concentrada de dragão elemental', 'legendary', 300);

-- Associar drops aos monstros
INSERT INTO monster_possible_drops (monster_id, drop_id, drop_chance, min_quantity, max_quantity)
VALUES
    -- Drops de Monstros Iniciais (Andares 1-5)
    -- Slimes
    ((SELECT id FROM monsters WHERE name = 'Slime Verde'), 
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime'), 0.7, 1, 3),
    ((SELECT id FROM monsters WHERE name = 'Slime Azul'), 
     (SELECT id FROM monster_drops WHERE name = 'Gosma Azulada'), 0.7, 1, 3),
     
    -- Rato Gigante
    ((SELECT id FROM monsters WHERE name = 'Rato Gigante'), 
     (SELECT id FROM monster_drops WHERE name = 'Dente de Rato'), 0.6, 1, 4),
     
    -- Goblin
    ((SELECT id FROM monsters WHERE name = 'Goblin'), 
     (SELECT id FROM monster_drops WHERE name = 'Garra de Goblin'), 0.6, 1, 2),
     
    -- Kobold
    ((SELECT id FROM monsters WHERE name = 'Kobold'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Kobold'), 0.65, 1, 2),
     
    -- Esqueleto
    ((SELECT id FROM monsters WHERE name = 'Esqueleto'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Osso'), 0.7, 2, 4),
     
    -- Lobo Selvagem
    ((SELECT id FROM monsters WHERE name = 'Lobo Selvagem'), 
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo'), 0.6, 1, 2),
     
    -- Aranha Venenosa
    ((SELECT id FROM monsters WHERE name = 'Aranha Venenosa'), 
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa'), 0.5, 1, 2),

    -- Drops de Monstros Intermediários (Andares 6-10)
    -- Orc
    ((SELECT id FROM monsters WHERE name = 'Orc'), 
     (SELECT id FROM monster_drops WHERE name = 'Presa de Orc'), 0.6, 1, 2),
     
    -- Zumbi
    ((SELECT id FROM monsters WHERE name = 'Zumbi'), 
     (SELECT id FROM monster_drops WHERE name = 'Carne Putrefata'), 0.65, 1, 3),
     
    -- Harpia
    ((SELECT id FROM monsters WHERE name = 'Harpia'), 
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia'), 0.6, 2, 4),
     
    -- Golem de Pedra
    ((SELECT id FROM monsters WHERE name = 'Golem de Pedra'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Pedra'), 0.55, 1, 3),
     
    -- Mago Corrompido
    ((SELECT id FROM monsters WHERE name = 'Mago Corrompido'), 
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico'), 0.5, 1, 1),
     
    -- Lobo Alpha
    ((SELECT id FROM monsters WHERE name = 'Lobo Alpha'), 
     (SELECT id FROM monster_drops WHERE name = 'Garra de Alpha'), 0.6, 1, 2),
     
    -- Basilisco
    ((SELECT id FROM monsters WHERE name = 'Basilisco'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 0.65, 2, 4),
     
    -- Morcego Vampírico
    ((SELECT id FROM monsters WHERE name = 'Morcego Vampírico'), 
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego'), 0.55, 1, 2),
     
    -- Armadura Animada
    ((SELECT id FROM monsters WHERE name = 'Armadura Animada'), 
     (SELECT id FROM monster_drops WHERE name = 'Lascas Metálicas'), 0.6, 2, 3),
     
    -- Druida Corrompido
    ((SELECT id FROM monsters WHERE name = 'Druida Corrompido'), 
     (SELECT id FROM monster_drops WHERE name = 'Amuleto Corrompido'), 0.5, 1, 1),

    -- Drops de Monstros Avançados (Andares 11-15)
    -- Ogro
    ((SELECT id FROM monsters WHERE name = 'Ogro'), 
     (SELECT id FROM monster_drops WHERE name = 'Dente de Ogro'), 0.5, 1, 2),
     
    -- Quimera
    ((SELECT id FROM monsters WHERE name = 'Quimera'), 
     (SELECT id FROM monster_drops WHERE name = 'Chifre de Quimera'), 0.45, 1, 1),
     
    -- Hidra
    ((SELECT id FROM monsters WHERE name = 'Hidra'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra'), 0.5, 1, 3),
     
    -- Dragão Jovem
    ((SELECT id FROM monsters WHERE name = 'Dragão Jovem'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Jovem'), 0.4, 1, 2),
     
    -- Lich
    ((SELECT id FROM monsters WHERE name = 'Lich'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência de Lich'), 0.35, 1, 1),
     
    -- Troll da Montanha
    ((SELECT id FROM monsters WHERE name = 'Troll da Montanha'), 
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll'), 0.5, 1, 3),
     
    -- Elementais
    ((SELECT id FROM monsters WHERE name = 'Elemental de Fogo'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 0.4, 1, 2),
    ((SELECT id FROM monsters WHERE name = 'Elemental de Gelo'), 
     (SELECT id FROM monster_drops WHERE name = 'Cristal de Gelo'), 0.4, 1, 2),
     
    -- Golem de Cristal
    ((SELECT id FROM monsters WHERE name = 'Golem de Cristal'), 
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 0.45, 1, 3),
     
    -- Necromante
    ((SELECT id FROM monsters WHERE name = 'Necromante'), 
     (SELECT id FROM monster_drops WHERE name = 'Vial de Energia Necrótica'), 0.35, 1, 1),

    -- Drops de Monstros End-Game (Andares 16-20)
    -- Dragão Adulto
    ((SELECT id FROM monsters WHERE name = 'Dragão Adulto'), 
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 0.35, 1, 2),
     
    -- Titã de Pedra
    ((SELECT id FROM monsters WHERE name = 'Titã de Pedra'), 
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 0.3, 1, 1),
     
    -- Demônio Alado
    ((SELECT id FROM monsters WHERE name = 'Demônio Alado'), 
     (SELECT id FROM monster_drops WHERE name = 'Coração de Demônio'), 0.25, 1, 1),
     
    -- Golem Ancestral
    ((SELECT id FROM monsters WHERE name = 'Golem Ancestral'), 
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 0.25, 1, 1),

    -- Imp
    ((SELECT id FROM monsters WHERE name = 'Imp'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Demoníaca'), 0.3, 1, 1),
     
    -- Golem de Lava
    ((SELECT id FROM monsters WHERE name = 'Golem de Lava'), 
     (SELECT id FROM monster_drops WHERE name = 'Pedra de Lava'), 0.3, 1, 1),
     
    -- Cavaleiro da Morte
    ((SELECT id FROM monsters WHERE name = 'Cavaleiro da Morte'), 
     (SELECT id FROM monster_drops WHERE name = 'Espada Fantasma'), 0.25, 1, 1),
     
    -- Wyrm Glacial
    ((SELECT id FROM monsters WHERE name = 'Wyrm Glacial'), 
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 0.25, 1, 1),
     
    -- Chefes finais com drops lendários (raros)
    ((SELECT id FROM monsters WHERE name = 'Dragão Ancião'), 
     (SELECT id FROM monster_drops WHERE name = 'Lágrima de Dragão'), 0.15, 1, 1),
    ((SELECT id FROM monsters WHERE name = 'Dragão Elemental'), 
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental Pura'), 0.1, 1, 1),
    ((SELECT id FROM monsters WHERE name = 'Dragão Ancião'), 
     (SELECT id FROM monster_drops WHERE name = 'Pó de Estrela'), 0.1, 1, 1);

-- NOTA: Os comandos \ir não são suportados pelo Supabase CLI.
-- Para carregar os outros dados, execute estes comandos após o reset do DB:
-- psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_consumables.sql
-- psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_equipment.sql
-- psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_recipes.sql
-- psql postgresql://postgres:postgres@localhost:54322/postgres -f supabase/seed_spells.sql

-- =====================================
-- MAGIAS
-- =====================================

-- Inserir magias iniciais
INSERT INTO spells (name, description, effect_type, mana_cost, cooldown, unlocked_at_level, effect_value, duration) VALUES
    -- Early Level Spells (1-15)
    ('Bola de Fogo', 'Lança uma bola de fogo que causa dano ao inimigo', 'damage', 20, 2, 1, 30, 1),
    ('Cura Menor', 'Recupera uma pequena quantidade de HP', 'heal', 15, 3, 2, 25, 1),
    ('Veneno', 'Envenena o inimigo causando dano ao longo do tempo', 'dot', 25, 4, 3, 10, 3),
    ('Escudo Arcano', 'Aumenta temporariamente a defesa', 'buff', 30, 5, 4, 15, 2),
    ('Fraqueza', 'Reduz temporariamente o ataque do inimigo', 'debuff', 35, 5, 5, 20, 2),
    ('Regeneração Menor', 'Recupera HP ao longo do tempo', 'hot', 40, 6, 6, 15, 3),
    ('Raio Congelante', 'Congela o inimigo causando dano de gelo', 'damage', 35, 3, 7, 45, 1),
    ('Cura Moderada', 'Recupera uma quantidade moderada de HP', 'heal', 50, 4, 8, 60, 1),
    ('Chamas Persistentes', 'Queima o inimigo ao longo do tempo', 'dot', 45, 5, 9, 15, 4),
    ('Benção da Força', 'Aumenta temporariamente o ataque', 'buff', 55, 6, 10, 25, 3),
    ('Maldição da Lentidão', 'Reduz a velocidade do inimigo', 'debuff', 40, 4, 11, 15, 3),
    ('Rajada de Vento', 'Ataque rápido de ar comprimido', 'damage', 30, 2, 12, 35, 1),
    ('Armadura Mística', 'Cria uma barreira mágica defensiva', 'buff', 60, 7, 13, 30, 4),
    ('Drenar Energia', 'Rouba mana do inimigo e restaura a sua', 'debuff', 45, 5, 14, 20, 1),
    ('Explosão Menor', 'Pequena explosão de energia arcana', 'damage', 55, 4, 15, 65, 1),
    
    -- Mid Level Spells (16-35)
    ('Meteoro', 'Invoca um meteoro causando dano devastador', 'damage', 80, 6, 16, 120, 1),
    ('Cura Maior', 'Recupera uma grande quantidade de HP', 'heal', 75, 5, 17, 100, 1),
    ('Praga Tóxica', 'Veneno potente que se espalha', 'dot', 70, 7, 18, 25, 5),
    ('Fortificação', 'Aumenta drasticamente a defesa', 'buff', 85, 8, 19, 40, 4),
    ('Terror', 'Reduz todos os atributos do inimigo', 'debuff', 90, 6, 20, 30, 3),
    ('Regeneração Maior', 'Cura poderosa ao longo do tempo', 'hot', 95, 8, 21, 30, 4),
    ('Tempestade de Gelo', 'Múltiplos projéteis de gelo', 'damage', 100, 7, 22, 90, 1),
    ('Ressurreição Parcial', 'Restaura HP quando próximo da morte', 'heal', 120, 10, 23, 150, 1),
    ('Corrosão Ácida', 'Ácido que corrói armaduras', 'dot', 85, 6, 24, 20, 4),
    ('Fúria Berserker', 'Aumenta ataque mas reduz defesa', 'buff', 75, 5, 25, 50, 3),
    ('Silêncio Arcano', 'Impede o uso de magias', 'debuff', 80, 7, 26, 0, 2),
    ('Lâminas de Vento', 'Múltiplos cortes de ar', 'damage', 85, 5, 27, 75, 1),
    ('Barreira Temporal', 'Proteção que absorve dano', 'buff', 110, 9, 28, 60, 5),
    ('Vampirismo', 'Cura baseada no dano causado', 'heal', 90, 6, 29, 40, 1),
    ('Explosão Arcana', 'Grande explosão de energia mágica', 'damage', 120, 8, 30, 140, 1),
    ('Invocar Chuva Curativa', 'Chuva que cura ao longo do tempo', 'hot', 100, 10, 31, 25, 6),
    ('Nevasca', 'Tempestade de gelo contínua', 'dot', 95, 7, 32, 18, 5),
    ('Aura de Poder', 'Aumenta todos os atributos', 'buff', 130, 12, 33, 35, 5),
    ('Drenar Vida', 'Absorve HP do inimigo', 'debuff', 85, 6, 34, 35, 1),
    ('Cometa Destruidor', 'Ataque de fogo devastador', 'damage', 150, 10, 35, 180, 1),
    
    -- High Level Spells (36-50)
    ('Apocalipse', 'Invoca o fim dos tempos', 'damage', 200, 12, 36, 250, 1),
    ('Cura Divina', 'Restauração completa da divindade', 'heal', 180, 10, 37, 200, 1),
    ('Maldição Eterna', 'Veneno que nunca acaba', 'dot', 160, 15, 38, 40, 8),
    ('Invencibilidade', 'Torna-se temporariamente indestrutível', 'buff', 250, 20, 39, 90, 3),
    ('Aniquilação', 'Remove todas as defesas inimigas', 'debuff', 200, 15, 40, 80, 4),
    ('Fonte da Juventude', 'Regeneração divina contínua', 'hot', 220, 18, 41, 50, 6),
    ('Supernova', 'Explosão estelar devastadora', 'damage', 280, 15, 42, 320, 1),
    ('Ressurreição Completa', 'Volta da morte com poder total', 'heal', 300, 25, 43, 350, 1),
    ('Praga Dimensional', 'Veneno que atravessa realidades', 'dot', 240, 20, 44, 35, 10),
    ('Transcendência', 'Eleva-se além dos mortais', 'buff', 350, 30, 45, 100, 6),
    ('Vazio Absoluto', 'Remove a existência do inimigo', 'debuff', 320, 25, 46, 100, 5),
    ('Tormenta Cósmica', 'Tempestade do espaço sideral', 'damage', 400, 20, 47, 380, 1),
    ('Benção dos Deuses', 'Poder divino supremo', 'buff', 400, 35, 48, 120, 8),
    ('Dreno Cósmico', 'Absorve a essência universal', 'debuff', 350, 30, 49, 90, 3),
    ('Criação e Destruição', 'O poder supremo da magia', 'damage', 500, 30, 50, 500, 1);

-- =====================================
-- RECEITAS E INGREDIENTES
-- =====================================

-- Inserir receitas principais de consumíveis
INSERT INTO crafting_recipes (result_id, name)
VALUES 
    -- Poções básicas
    ((SELECT id FROM consumables WHERE name = 'Poção de Vida Média'), 'Receita: Poção de Vida Média'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Vida Grande'), 'Receita: Poção de Vida Grande'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Mana Média'), 'Receita: Poção de Mana Média'),
    ((SELECT id FROM consumables WHERE name = 'Poção de Mana Grande'), 'Receita: Poção de Mana Grande'),
    -- Antídoto e Elixires
    ((SELECT id FROM consumables WHERE name = 'Antídoto'), 'Receita: Antídoto'),
    ((SELECT id FROM consumables WHERE name = 'Elixir de Força'), 'Receita: Elixir de Força'),
    ((SELECT id FROM consumables WHERE name = 'Elixir de Defesa'), 'Receita: Elixir de Defesa');

-- Inserir receitas para desbloquear equipamentos na loja (novidade)
INSERT INTO consumables (name, description, type, effect_value, price, craftable)
VALUES
    -- Pergaminhos para desbloquear equipamentos
    ('Pergaminho de Arma Rara', 'Desbloqueia uma arma rara na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Armadura Rara', 'Desbloqueia uma armadura rara na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Acessório Raro', 'Desbloqueia um acessório raro na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Arma Épica', 'Desbloqueia uma arma épica na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Armadura Épica', 'Desbloqueia uma armadura épica na loja quando usado', 'elixir', 0, 0, true),
    ('Pergaminho de Acessório Épico', 'Desbloqueia um acessório épico na loja quando usado', 'elixir', 0, 0, true);

-- Adicionar receitas para desbloquear equipamentos
INSERT INTO crafting_recipes (result_id, name)
VALUES
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Rara'), 'Receita: Pergaminho de Arma Rara'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Rara'), 'Receita: Pergaminho de Armadura Rara'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Raro'), 'Receita: Pergaminho de Acessório Raro'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Arma Épica'), 'Receita: Pergaminho de Arma Épica'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Armadura Épica'), 'Receita: Pergaminho de Armadura Épica'),
    ((SELECT id FROM consumables WHERE name = 'Pergaminho de Acessório Épico'), 'Receita: Pergaminho de Acessório Épico');

-- Ingredientes para as receitas
INSERT INTO crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Poção de Vida Média (Olho de Slime + Poções Pequenas)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Média'),
     (SELECT id FROM monster_drops WHERE name = 'Olho de Slime'), 'monster_drop', 3),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Média'),
     (SELECT id FROM consumables WHERE name = 'Poção de Vida Pequena'), 'consumable', 2),
     
    -- Poção de Vida Grande (Sangue de Morcego + Poções Médias)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Grande'),
     (SELECT id FROM monster_drops WHERE name = 'Sangue de Morcego'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Vida Grande'),
     (SELECT id FROM consumables WHERE name = 'Poção de Vida Média'), 'consumable', 2),
     
    -- Poção de Mana Média (Escama de Réptil + Poções Pequenas)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Média'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 'monster_drop', 3),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Média'),
     (SELECT id FROM consumables WHERE name = 'Poção de Mana Pequena'), 'consumable', 2),
     
    -- Poção de Mana Grande (Fragmento de Cristal + Poções Médias)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Grande'),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Poção de Mana Grande'),
     (SELECT id FROM consumables WHERE name = 'Poção de Mana Média'), 'consumable', 2),
     
    -- Antídoto (Glândula Venenosa + Presa de Lobo)
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Antídoto'),
     (SELECT id FROM monster_drops WHERE name = 'Glândula Venenosa'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Antídoto'),
     (SELECT id FROM monster_drops WHERE name = 'Presa de Lobo'), 'monster_drop', 1),
     
    -- Elixir de Força (Essência Elemental + Escama de Dragão Jovem) - AUMENTO DO BUFF E REDUÇÃO DA DURAÇÃO
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Força'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Força'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Jovem'), 'monster_drop', 1),
     
    -- Elixir de Defesa (Escama de Réptil + Fragmento de Cristal) - AUMENTO DO BUFF E REDUÇÃO DA DURAÇÃO
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Defesa'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Réptil'), 'monster_drop', 2),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Elixir de Defesa'),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 'monster_drop', 1),
     
    -- RECEITAS PARA DESBLOQUEAR EQUIPAMENTOS NA LOJA
    -- Pergaminho de Arma Rara
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Chifre de Quimera'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Pena de Harpia'), 'monster_drop', 3),
     
    -- Pergaminho de Armadura Rara
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Rara'),
     (SELECT id FROM monster_drops WHERE name = 'Couro de Troll'), 'monster_drop', 2),
     
    -- Pergaminho de Acessório Raro
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Raro'),
     (SELECT id FROM monster_drops WHERE name = 'Orbe Mágico'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Raro'),
     (SELECT id FROM monster_drops WHERE name = 'Amuleto Corrompido'), 'monster_drop', 1),
     
    -- Pergaminho de Arma Épica
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Demoníaca'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Arma Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Espada Fantasma'), 'monster_drop', 1),
     
    -- Pergaminho de Armadura Épica
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Pedra de Lava'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Armadura Épica'),
     (SELECT id FROM monster_drops WHERE name = 'Coração de Demônio'), 'monster_drop', 1),
     
    -- Pergaminho de Acessório Épico
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Épico'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 'monster_drop', 1),
    ((SELECT id FROM crafting_recipes WHERE name = 'Receita: Pergaminho de Acessório Épico'),
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 'monster_drop', 1);

-- =====================================
-- EVENTOS ESPECIAIS
-- =====================================

-- Inserir eventos especiais para pisos do tipo "event"
INSERT INTO special_events (name, type, description, hp_restore_percent, mana_restore_percent, gold_reward_min, gold_reward_max, chance_weight, min_floor)
VALUES
    -- FOGUEIRA - Evento mais comum, restaura parcialmente
    ('Fogueira Acolhedora', 'bonfire', 
     'Você encontra uma fogueira acesa. As chamas emanam calor reconfortante, permitindo um breve descanso.', 
     40, 30, 0, 0, 50, 1),
    
    ('Fogueira Mágica', 'bonfire', 
     'Uma fogueira com chamas azuladas emite energia mágica. O descanso aqui é especialmente revigorante.', 
     50, 40, 0, 0, 30, 5),
    
    -- BAÚS DE TESOURO - Recompensas de gold variáveis
    ('Baú Simples', 'treasure_chest', 
     'Um baú de madeira contém algumas moedas deixadas por aventureiros anteriores.', 
     0, 0, 30, 80, 35, 1),
    
    ('Baú Ornamentado', 'treasure_chest', 
     'Um baú decorado com detalhes dourados revela tesouros valiosos.', 
     0, 0, 80, 150, 25, 3),
    
    ('Baú do Tesouro', 'treasure_chest', 
     'Um grande baú reforçado com ferro contém riquezas consideráveis.', 
     0, 0, 150, 300, 20, 7),
    
    ('Baú Ancestral', 'treasure_chest', 
     'Um antigo baú emanando poder mágico guarda fortunas de eras passadas.', 
     0, 0, 250, 500, 10, 12),
    
    -- FONTE MÁGICA - Evento raro, restaura completamente
    ('Fonte Cristalina', 'magic_fountain', 
     'Uma fonte de águas cristalinas brilha com luz própria. Suas águas possuem propriedades curativas extraordinárias.', 
     100, 100, 0, 0, 15, 3),
    
    ('Fonte dos Anciões', 'magic_fountain', 
     'Uma fonte ancestral esculpida em pedra luminosa. Lendas dizem que suas águas podem curar qualquer ferimento.', 
     100, 100, 50, 150, 8, 8),
    
    ('Fonte do Destino', 'magic_fountain', 
     'Uma fonte mística que aparece apenas para os mais dignos. Suas águas concedem renovação completa do corpo e espírito.', 
     100, 100, 100, 200, 5, 15); 