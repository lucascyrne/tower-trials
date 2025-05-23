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

-- Inserir consumíveis com preços balanceados para escassez controlada
INSERT INTO consumables (name, description, type, effect_value, price, craftable)
VALUES
    -- POÇÕES DE VIDA (progressão de escassez)
    ('Poção de Vida Pequena', 'Recupera 20 HP instantaneamente', 'potion', 20, 50, false), -- Acessível mas não barata
    ('Poção de Vida Média', 'Recupera 50 HP instantaneamente', 'potion', 50, 150, true),   -- 3x mais cara que pequena
    ('Poção de Vida Grande', 'Recupera 100 HP instantaneamente', 'potion', 100, 400, true), -- Muito cara para mid-game
    
    -- POÇÕES DE MANA (progressão similar)
    ('Poção de Mana Pequena', 'Recupera 10 Mana instantaneamente', 'potion', 10, 45, false), -- Levemente mais barata que vida
    ('Poção de Mana Média', 'Recupera 25 Mana instantaneamente', 'potion', 25, 135, true),   -- Proporcional à vida
    ('Poção de Mana Grande', 'Recupera 50 Mana instantaneamente', 'potion', 50, 350, true),  -- Cara mas menos que vida grande
    
    -- UTILITÁRIOS (preços moderados mas importantes)
    ('Antídoto', 'Remove todos os efeitos negativos', 'antidote', 0, 120, true), -- Caro pois é muito útil
    
    -- ELIXIRES (não vendidos na loja - apenas craftáveis)
    ('Elixir de Força', 'Aumenta o ataque em 8 por 3 turnos', 'buff', 8, 0, true), -- Não vendido na loja
    ('Elixir de Defesa', 'Aumenta a defesa em 8 por 3 turnos', 'buff', 8, 0, true); -- Não vendido na loja

-- =====================================
-- EQUIPAMENTOS
-- =====================================

-- Inserir equipamentos iniciais (com is_unlocked configurado adequadamente)
INSERT INTO equipment (name, description, type, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, price, is_unlocked) VALUES
    -- Equipamentos Comuns (Nível 1-3) - TODOS DESBLOQUEADOS
    ('Espada de Ferro', 'Uma espada básica mas confiável', 'weapon', 'common', 1, 5, 0, 0, 1, 150, true),
    ('Adaga de Bronze', 'Pequena e rápida, boa para iniciantes', 'weapon', 'common', 1, 3, 0, 0, 3, 120, true),
    ('Varinha de Madeira', 'Canaliza magia básica', 'weapon', 'common', 1, 2, 0, 5, 0, 140, true),
    ('Armadura de Couro', 'Proteção básica de couro resistente', 'armor', 'common', 1, 0, 5, 0, 2, 150, true),
    ('Túnica de Aprendiz', 'Vestimenta leve com encantamentos básicos', 'armor', 'common', 1, 0, 3, 5, 1, 130, true),
    ('Vestes Leves', 'Roupas leves que não atrapalham movimentos', 'armor', 'common', 1, 0, 2, 0, 5, 120, true),
    ('Anel de Mana', 'Um anel que aumenta o poder mágico', 'accessory', 'common', 1, 0, 0, 10, 0, 160, true),
    ('Amuleto de Proteção', 'Oferece uma leve proteção mágica', 'accessory', 'common', 1, 0, 3, 3, 0, 150, true),
    ('Botas Velozes', 'Botas que melhoram levemente a agilidade', 'accessory', 'common', 1, 0, 0, 0, 5, 140, true),

    -- Equipamentos Incomuns (Nível 5-8) - TODOS DESBLOQUEADOS PARA EARLY-MID GAME
    ('Espada de Aço', 'Uma espada bem forjada', 'weapon', 'uncommon', 5, 12, 0, 0, 2, 350, true),
    ('Machado de Batalha', 'Arma pesada com boa capacidade de dano', 'weapon', 'uncommon', 5, 15, 0, 0, -1, 380, true),
    ('Cajado de Carvalho', 'Canaliza magia com eficiência', 'weapon', 'uncommon', 5, 8, 0, 10, 0, 360, true),
    ('Armadura de Malha', 'Armadura reforçada com anéis de metal', 'armor', 'uncommon', 5, 0, 12, 0, 0, 350, true),
    ('Manto do Ocultista', 'Manto tecido com fios especiais para magia', 'armor', 'uncommon', 5, 0, 8, 12, 0, 370, true),
    ('Armadura de Escamas', 'Proteção feita de escamas de répteis', 'armor', 'uncommon', 5, 0, 10, 0, 3, 330, true),
    ('Amuleto Arcano', 'Amplifica o poder mágico', 'accessory', 'uncommon', 5, 0, 0, 20, 0, 390, true),
    ('Anel de Força', 'Aumenta o poder físico do usuário', 'accessory', 'uncommon', 5, 8, 0, 0, 0, 380, true),
    ('Braceletes de Defesa', 'Oferecem proteção adicional', 'accessory', 'uncommon', 5, 0, 8, 0, 3, 360, true),

    -- Equipamentos Raros (Nível 10-13) - ALGUNS DESBLOQUEADOS PARA MID-GAME
    ('Lâmina do Dragão', 'Forjada com escamas de dragão', 'weapon', 'rare', 10, 25, 0, 0, 3, 800, true),
    ('Arco Élficos', 'Arco reforçado com madeira élfica', 'weapon', 'rare', 10, 20, 0, 5, 10, 780, true),
    ('Cetro Arcano', 'Poderosa arma mágica', 'weapon', 'rare', 10, 15, 0, 25, 0, 850, true),
    ('Armadura de Placas', 'Proteção completa de metal', 'armor', 'rare', 10, 0, 25, 0, -2, 800, true),
    ('Manto Elemental', 'Manto imbuído com magia elemental', 'armor', 'rare', 10, 5, 15, 15, 0, 830, true),
    ('Armadura Dracônica', 'Feita de escamas de dragão', 'armor', 'rare', 10, 5, 20, 0, 5, 850, false), -- Bloqueado
    ('Coroa da Sabedoria', 'Aumenta significativamente o poder mágico', 'accessory', 'rare', 10, 5, 5, 30, 0, 900, true),
    ('Amuleto do Guardião', 'Oferece grande proteção', 'accessory', 'rare', 10, 0, 20, 10, 0, 880, true),
    ('Botas Aladas', 'Botas encantadas que aumentam a velocidade', 'accessory', 'rare', 10, 0, 0, 0, 25, 850, false), -- Bloqueado

    -- Equipamentos Épicos (Nível 15-18) - MAIORIA BLOQUEADA
    ('Espada do Abismo', 'Lâmina forjada nas profundezas do abismo', 'weapon', 'epic', 15, 40, 0, 10, 5, 1800, false),
    ('Martelo de Titã', 'Arma massiva com poder devastador', 'weapon', 'epic', 15, 50, 0, 0, -5, 1900, false),
    ('Bastão de Necromante', 'Capaz de canalizar energia necrótica', 'weapon', 'epic', 15, 30, 0, 40, 0, 2000, false),
    ('Armadura de Mithril', 'Forjada com o raro metal mithril', 'armor', 'epic', 15, 5, 40, 0, 5, 1800, false),
    ('Vestes do Arquimago', 'Vestes imbuídas com magia arcana', 'armor', 'epic', 15, 10, 25, 35, 0, 1900, false),
    ('Pele de Behemoth', 'Armadura feita da pele de uma criatura lendária', 'armor', 'epic', 15, 10, 35, 0, 10, 2000, false),
    ('Olho de Observador', 'Amuleto feito do olho de uma criatura mística', 'accessory', 'epic', 15, 15, 15, 25, 5, 2100, false),
    ('Coração Petrificado', 'Concede resistência sobrenatural', 'accessory', 'epic', 15, 0, 35, 15, 0, 2000, false),
    ('Asas Fantasmagóricas', 'Aumentam drasticamente a mobilidade', 'accessory', 'epic', 15, 10, 0, 10, 35, 1900, false),

    -- Equipamentos Lendários (Nível 20) - TODOS BLOQUEADOS
    ('Excalibur', 'A lendária espada do rei', 'weapon', 'legendary', 20, 80, 20, 20, 20, 5000, false),
    ('Mjolnir', 'Martelo forjado por deuses', 'weapon', 'legendary', 20, 100, 0, 0, 10, 5000, false),
    ('Cajado de Merlin', 'O lendário cajado do maior mago', 'weapon', 'legendary', 20, 50, 10, 80, 10, 5000, false),
    ('Armadura Divina', 'Forjada nos céus, esta armadura é quase impenetrável', 'armor', 'legendary', 20, 20, 80, 20, 0, 5000, false),
    ('Manto Celestial', 'Manto tecido com a própria luz das estrelas', 'armor', 'legendary', 20, 20, 50, 70, 10, 5000, false),
    ('Pele de Leviatã', 'Armadura feita da pele do lendário leviatã', 'armor', 'legendary', 20, 30, 70, 0, 30, 5000, false),
    ('Anel do Poder Supremo', 'Um anel para todos dominar', 'accessory', 'legendary', 20, 40, 40, 40, 0, 5000, false),
    ('Amuleto do Tempo', 'Permite manipular o fluxo do tempo', 'accessory', 'legendary', 20, 20, 20, 20, 60, 5000, false),
    ('Coração de Fênix', 'Concede poder de regeneração lendário', 'accessory', 'legendary', 20, 30, 30, 50, 20, 5000, false);

-- =====================================
-- MONSTROS
-- =====================================

-- Inserir os monstros
INSERT INTO monsters (name, hp, atk, def, mana, speed, behavior, min_floor, reward_xp, reward_gold) VALUES
-- Monstros Iniciais (Andares 1-5)
('Slime Verde', 50, 10, 5, 0, 8, 'balanced', 1, 20, 10),
('Slime Azul', 55, 12, 4, 0, 9, 'aggressive', 1, 22, 12),
('Rato Gigante', 45, 15, 3, 0, 15, 'aggressive', 1, 25, 15),
('Goblin', 60, 12, 8, 20, 12, 'balanced', 2, 30, 20),
('Kobold', 55, 18, 5, 30, 14, 'aggressive', 3, 35, 25),
('Esqueleto', 70, 14, 10, 0, 10, 'defensive', 4, 40, 30),
('Lobo Selvagem', 65, 20, 6, 0, 16, 'aggressive', 4, 42, 28),
('Aranha Venenosa', 60, 16, 7, 15, 17, 'balanced', 5, 45, 32),

-- Monstros Intermediários (Andares 6-10)
('Orc', 100, 25, 15, 0, 11, 'aggressive', 6, 60, 40),
('Zumbi', 120, 20, 20, 0, 8, 'defensive', 7, 70, 45),
('Harpia', 90, 30, 10, 40, 18, 'aggressive', 8, 80, 50),
('Golem de Pedra', 150, 15, 30, 0, 7, 'defensive', 9, 90, 55),
('Mago Corrompido', 80, 40, 5, 100, 13, 'balanced', 10, 100, 60),
('Lobo Alpha', 110, 35, 12, 0, 18, 'aggressive', 6, 65, 42),
('Basilisco', 130, 20, 25, 30, 12, 'defensive', 7, 75, 47),
('Morcego Vampírico', 85, 30, 8, 20, 19, 'aggressive', 8, 78, 48),
('Armadura Animada', 140, 25, 35, 0, 8, 'defensive', 9, 88, 53),
('Druida Corrompido', 90, 35, 15, 120, 14, 'balanced', 10, 95, 58),

-- Monstros Avançados (Andares 11-15)
('Ogro', 200, 40, 25, 0, 9, 'aggressive', 11, 150, 70),
('Quimera', 180, 45, 20, 60, 16, 'balanced', 12, 170, 75),
('Hidra', 250, 35, 30, 80, 12, 'defensive', 13, 190, 80),
('Dragão Jovem', 300, 50, 40, 120, 20, 'aggressive', 14, 220, 90),
('Lich', 220, 60, 20, 200, 15, 'balanced', 15, 250, 100),
('Troll da Montanha', 230, 50, 30, 0, 9, 'aggressive', 11, 160, 72),
('Elemental de Fogo', 190, 55, 15, 150, 17, 'balanced', 12, 180, 78),
('Elemental de Gelo', 200, 45, 25, 160, 15, 'balanced', 13, 195, 82),
('Golem de Cristal', 280, 35, 50, 0, 8, 'defensive', 14, 210, 88),
('Necromante', 200, 70, 15, 250, 14, 'balanced', 15, 260, 105),

-- Monstros End-Game (Andares 16-20)
('Dragão Adulto', 400, 70, 50, 150, 22, 'aggressive', 16, 300, 120),
('Titã de Pedra', 500, 50, 70, 0, 8, 'defensive', 17, 330, 130),
('Demônio Alado', 350, 80, 40, 200, 25, 'aggressive', 18, 360, 140),
('Golem Ancestral', 600, 60, 90, 0, 7, 'defensive', 19, 390, 150),
('Dragão Ancião', 700, 100, 80, 300, 26, 'balanced', 20, 500, 200),
('Imp', 320, 75, 35, 150, 28, 'aggressive', 16, 280, 115),
('Golem de Lava', 450, 60, 60, 100, 10, 'defensive', 17, 320, 125),
('Cavaleiro da Morte', 380, 85, 45, 180, 18, 'aggressive', 18, 350, 135),
('Wyrm Glacial', 550, 70, 65, 200, 20, 'balanced', 19, 380, 145),
('Dragão Elemental', 750, 110, 70, 350, 30, 'balanced', 20, 550, 250);

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
    ('Bola de Fogo', 'Lança uma bola de fogo que causa dano ao inimigo', 'damage', 20, 2, 1, 30, 1),
    ('Cura Menor', 'Recupera uma pequena quantidade de HP', 'heal', 15, 3, 2, 25, 1),
    ('Veneno', 'Envenena o inimigo causando dano ao longo do tempo', 'dot', 25, 4, 3, 10, 3),
    ('Bênção', 'Aumenta temporariamente a defesa', 'buff', 30, 5, 4, 15, 2),
    ('Maldição', 'Reduz temporariamente o ataque do inimigo', 'debuff', 35, 5, 5, 20, 2),
    ('Regeneração', 'Recupera HP ao longo do tempo', 'hot', 40, 6, 6, 15, 3),
    ('Explosão Arcana', 'Causa uma grande quantidade de dano', 'damage', 50, 8, 8, 80, 1),
    ('Cura Maior', 'Recupera uma grande quantidade de HP', 'heal', 45, 7, 7, 60, 1);

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