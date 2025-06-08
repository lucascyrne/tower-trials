-- Script para adicionar equipamentos craftáveis únicos e poderosos
-- Estes equipamentos são mais fortes que os da loja e requerem drops específicos

-- =====================================
-- EQUIPAMENTOS CRAFTÁVEIS ÚNICOS
-- =====================================

-- Inserir equipamentos craftáveis que são superiores aos da loja
-- Nota: Preço define o valor teórico para venda, mas estes itens não aparecem na loja (is_unlocked = false, craftable = true)
INSERT INTO equipment (name, description, type, weapon_subtype, rarity, level_requirement, atk_bonus, def_bonus, mana_bonus, speed_bonus, price, is_unlocked, craftable) VALUES
    -- ARMAS CRAFTÁVEIS MÍTICAS (Nível 12-15) - Superiores aos raros da loja
    ('Lâmina do Vazio', 'Forjada com essência de Lich e escamas de dragão. Corta através das dimensões.', 'weapon', 'sword', 'epic', 12, 45, 5, 15, 8, 2500, false, true),
    ('Mjolnir Menor', 'Versão menor do lendário martelo, forjada com núcleos de titã.', 'weapon', 'blunt', 'epic', 14, 55, 0, 0, -2, 3000, false, true),
    ('Cajado do Necromante', 'Bastão imbuído com energia necrótica pura.', 'weapon', 'staff', 'epic', 13, 35, 0, 60, 3, 2800, false, true),
    ('Garras Sombrias', 'Adagas gêmeas forjadas com cristais glaciais e essência demoníaca.', 'weapon', 'dagger', 'epic', 15, 40, 0, 20, 20, 2700, false, true),
    ('Machado Vulcânico', 'Machado forjado com pedras de lava e coração de demônio.', 'weapon', 'axe', 'epic', 14, 50, 0, 10, 5, 2900, false, true),
    
    -- ARMADURAS CRAFTÁVEIS MÍTICAS (Nível 12-15) - Superiores às raras da loja
    ('Armadura do Leviatã', 'Forjada com escamas de hidra e núcleos ancestrais.', 'armor', NULL, 'epic', 12, 10, 50, 15, 8, 3200, false, true),
    ('Vestes do Arquinecromante', 'Robes tecidas com energia necrótica e cristais glaciais.', 'armor', NULL, 'epic', 13, 15, 35, 50, 5, 3000, false, true),
    ('Couraça Dracônica', 'Armadura feita com escamas de dragão adulto e núcleos de pedra.', 'armor', NULL, 'epic', 14, 20, 45, 25, 10, 3100, false, true),
    
    -- ACESSÓRIOS CRAFTÁVEIS MÍTICOS (Nível 12-15) - Superiores aos raros da loja
    ('Anel dos Elementos', 'Anel forjado com essências elementais puras.', 'accessory', NULL, 'epic', 12, 15, 15, 40, 15, 2200, false, true),
    ('Amuleto do Vazio', 'Amuleto que canaliza o poder do vazio cósmico.', 'accessory', NULL, 'epic', 13, 25, 20, 35, 10, 2400, false, true),
    ('Botas do Vendaval', 'Botas encantadas com espíritos do vento.', 'accessory', NULL, 'epic', 14, 10, 5, 15, 40, 2300, false, true),
    ('Coroa da Supremacia', 'Coroa dos antigos reis, forjada com lágrimas de dragão.', 'accessory', NULL, 'epic', 15, 30, 25, 60, 20, 2600, false, true),
    
    -- EQUIPAMENTOS LENDÁRIOS CRAFTÁVEIS (Nível 18+) - End Game
    ('Excalibur Sombria', 'A versão corrompida da lendária Excalibur.', 'weapon', 'sword', 'legendary', 18, 100, 30, 30, 30, 10000, false, true),
    ('Aegis Primordial', 'Escudo lendário que protege contra todo tipo de dano.', 'armor', NULL, 'legendary', 18, 30, 100, 50, 20, 12000, false, true),
    ('Anel do Destino', 'Forjado pelos deuses para controlar o destino mortal.', 'accessory', NULL, 'legendary', 20, 50, 50, 80, 50, 15000, false, true);

-- =====================================
-- RECEITAS DE EQUIPAMENTOS CRAFTÁVEIS
-- =====================================

-- Inserir receitas para os equipamentos craftáveis
INSERT INTO equipment_crafting_recipes (result_equipment_id, name, description)
VALUES 
    -- Armas Míticas
    ((SELECT id FROM equipment WHERE name = 'Lâmina do Vazio'), 'Receita: Lâmina do Vazio', 'Requer essência de Lich e materiais dracônicos'),
    ((SELECT id FROM equipment WHERE name = 'Mjolnir Menor'), 'Receita: Mjolnir Menor', 'Versão craftável do lendário martelo'),
    ((SELECT id FROM equipment WHERE name = 'Cajado do Necromante'), 'Receita: Cajado do Necromante', 'Bastão com poder necrótico supremo'),
    ((SELECT id FROM equipment WHERE name = 'Garras Sombrias'), 'Receita: Garras Sombrias', 'Adagas gêmeas das sombras'),
    ((SELECT id FROM equipment WHERE name = 'Machado Vulcânico'), 'Receita: Machado Vulcânico', 'Machado forjado no fogo dos vulcões'),
    
    -- Armaduras Míticas
    ((SELECT id FROM equipment WHERE name = 'Armadura do Leviatã'), 'Receita: Armadura do Leviatã', 'Armadura das profundezas abissais'),
    ((SELECT id FROM equipment WHERE name = 'Vestes do Arquinecromante'), 'Receita: Vestes do Arquinecromante', 'Robes do mestre das artes sombrias'),
    ((SELECT id FROM equipment WHERE name = 'Couraça Dracônica'), 'Receita: Couraça Dracônica', 'Armadura feita de escamas de dragão'),
    
    -- Acessórios Míticos
    ((SELECT id FROM equipment WHERE name = 'Anel dos Elementos'), 'Receita: Anel dos Elementos', 'Anel que controla todos os elementos'),
    ((SELECT id FROM equipment WHERE name = 'Amuleto do Vazio'), 'Receita: Amuleto do Vazio', 'Amuleto que canaliza energia cósmica'),
    ((SELECT id FROM equipment WHERE name = 'Botas do Vendaval'), 'Receita: Botas do Vendaval', 'Botas que concedem velocidade sobrenatural'),
    ((SELECT id FROM equipment WHERE name = 'Coroa da Supremacia'), 'Receita: Coroa da Supremacia', 'Coroa dos antigos reis dragão'),
    
    -- Equipamentos Lendários
    ((SELECT id FROM equipment WHERE name = 'Excalibur Sombria'), 'Receita: Excalibur Sombria', 'A versão corrompida da espada lendária'),
    ((SELECT id FROM equipment WHERE name = 'Aegis Primordial'), 'Receita: Aegis Primordial', 'Escudo dos primordiais'),
    ((SELECT id FROM equipment WHERE name = 'Anel do Destino'), 'Receita: Anel do Destino', 'Anel que controla o destino');

-- =====================================
-- INGREDIENTES DAS RECEITAS
-- =====================================

-- Ingredientes para receitas de armas míticas
INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Lâmina do Vazio (Essência de Lich + Escama de Dragão Jovem + Lâmina do Dragão [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina do Vazio'),
     (SELECT id FROM monster_drops WHERE name = 'Essência de Lich'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina do Vazio'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Jovem'), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Lâmina do Vazio'),
     (SELECT id FROM equipment WHERE name = 'Lâmina do Dragão'), 'equipment', 1),
     
    -- Mjolnir Menor (Núcleo de Pedra + Núcleo Ancestral + Martelo de Guerra [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Mjolnir Menor'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Mjolnir Menor'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Mjolnir Menor'),
     (SELECT id FROM equipment WHERE name = 'Martelo de Guerra'), 'equipment', 1),
     
    -- Cajado do Necromante (Vial de Energia Necrótica + Essência de Lich + Cetro Arcano [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cajado do Necromante'),
     (SELECT id FROM monster_drops WHERE name = 'Vial de Energia Necrótica'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cajado do Necromante'),
     (SELECT id FROM monster_drops WHERE name = 'Essência de Lich'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Cajado do Necromante'),
     (SELECT id FROM equipment WHERE name = 'Cetro Arcano'), 'equipment', 1),
     
    -- Garras Sombrias (Cristal Glacial + Essência Demoníaca + Adaga Élfica [equipamento base] x2)
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Garras Sombrias'),
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Garras Sombrias'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Demoníaca'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Garras Sombrias'),
     (SELECT id FROM equipment WHERE name = 'Adaga Élfica'), 'equipment', 2),
     
    -- Machado Vulcânico (Pedra de Lava + Coração de Demônio + Machado de Guerra [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Vulcânico'),
     (SELECT id FROM monster_drops WHERE name = 'Pedra de Lava'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Vulcânico'),
     (SELECT id FROM monster_drops WHERE name = 'Coração de Demônio'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Machado Vulcânico'),
     (SELECT id FROM equipment WHERE name = 'Machado de Guerra'), 'equipment', 1);

-- Ingredientes para receitas de armaduras míticas
INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Armadura do Leviatã (Escama de Hidra + Núcleo Ancestral + Armadura de Placas [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Armadura do Leviatã'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Hidra'), 'monster_drop', 5),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Armadura do Leviatã'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Armadura do Leviatã'),
     (SELECT id FROM equipment WHERE name = 'Armadura de Placas'), 'equipment', 1),
     
    -- Vestes do Arquinecromante (Vial de Energia Necrótica + Cristal Glacial + Manto Elemental [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Vestes do Arquinecromante'),
     (SELECT id FROM monster_drops WHERE name = 'Vial de Energia Necrótica'), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Vestes do Arquinecromante'),
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Vestes do Arquinecromante'),
     (SELECT id FROM equipment WHERE name = 'Manto Elemental'), 'equipment', 1),
     
    -- Couraça Dracônica (Escama de Dragão Adulto + Núcleo de Pedra + Armadura Dracônica [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Couraça Dracônica'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Couraça Dracônica'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo de Pedra'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Couraça Dracônica'),
     (SELECT id FROM equipment WHERE name = 'Armadura Dracônica'), 'equipment', 1);

-- Ingredientes para receitas de acessórios míticos
INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Anel dos Elementos (Essência Elemental + Fragmento de Cristal + Coroa da Sabedoria [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel dos Elementos'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 'monster_drop', 3),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel dos Elementos'),
     (SELECT id FROM monster_drops WHERE name = 'Fragmento de Cristal'), 'monster_drop', 5),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel dos Elementos'),
     (SELECT id FROM equipment WHERE name = 'Coroa da Sabedoria'), 'equipment', 1),
     
    -- Amuleto do Vazio (Essência de Lich + Núcleo Ancestral + Amuleto do Guardião [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Amuleto do Vazio'),
     (SELECT id FROM monster_drops WHERE name = 'Essência de Lich'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Amuleto do Vazio'),
     (SELECT id FROM monster_drops WHERE name = 'Núcleo Ancestral'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Amuleto do Vazio'),
     (SELECT id FROM equipment WHERE name = 'Amuleto do Guardião'), 'equipment', 1),
     
    -- Botas do Vendaval (Cristal Glacial + Essência Elemental + Botas Aladas [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas do Vendaval'),
     (SELECT id FROM monster_drops WHERE name = 'Cristal Glacial'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas do Vendaval'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Botas do Vendaval'),
     (SELECT id FROM equipment WHERE name = 'Botas Aladas'), 'equipment', 1),
     
    -- Coroa da Supremacia (Lágrima de Dragão + Escama de Dragão Adulto + Coroa da Sabedoria [equipamento base])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Coroa da Supremacia'),
     (SELECT id FROM monster_drops WHERE name = 'Lágrima de Dragão'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Coroa da Supremacia'),
     (SELECT id FROM monster_drops WHERE name = 'Escama de Dragão Adulto'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Coroa da Supremacia'),
     (SELECT id FROM equipment WHERE name = 'Coroa da Sabedoria'), 'equipment', 1);

-- Ingredientes para receitas lendárias (End Game)
INSERT INTO equipment_crafting_ingredients (recipe_id, item_id, item_type, quantity)
VALUES
    -- Excalibur Sombria (Lágrima de Dragão + Essência Elemental Pura + Lâmina do Vazio [equipamento mítico])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Excalibur Sombria'),
     (SELECT id FROM monster_drops WHERE name = 'Lágrima de Dragão'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Excalibur Sombria'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental Pura'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Excalibur Sombria'),
     (SELECT id FROM equipment WHERE name = 'Lâmina do Vazio'), 'equipment', 1),
     
    -- Aegis Primordial (Pó de Estrela + Lágrima de Dragão + Armadura do Leviatã [equipamento mítico])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Aegis Primordial'),
     (SELECT id FROM monster_drops WHERE name = 'Pó de Estrela'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Aegis Primordial'),
     (SELECT id FROM monster_drops WHERE name = 'Lágrima de Dragão'), 'monster_drop', 2),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Aegis Primordial'),
     (SELECT id FROM equipment WHERE name = 'Armadura do Leviatã'), 'equipment', 1),
     
    -- Anel do Destino (Essência Elemental Pura + Pó de Estrela + Coroa da Supremacia [equipamento mítico])
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel do Destino'),
     (SELECT id FROM monster_drops WHERE name = 'Essência Elemental Pura'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel do Destino'),
     (SELECT id FROM monster_drops WHERE name = 'Pó de Estrela'), 'monster_drop', 1),
    ((SELECT id FROM equipment_crafting_recipes WHERE name = 'Receita: Anel do Destino'),
     (SELECT id FROM equipment WHERE name = 'Coroa da Supremacia'), 'equipment', 1);

-- =====================================
-- COMENTÁRIOS SOBRE O SISTEMA
-- =====================================

/*
SISTEMA DE PROGRESSÃO DE CRAFTING:

1. EQUIPAMENTOS BASE (Loja): Comuns e Incomuns disponíveis na loja
2. EQUIPAMENTOS RAROS (Loja): Requerem nível e podem ser desbloqueados
3. EQUIPAMENTOS MÍTICOS (Crafting): Superiores aos raros, requerem drops específicos + equipamento base
4. EQUIPAMENTOS LENDÁRIOS (Crafting): End game, requerem drops raríssimos + equipamento mítico

DROPS NECESSÁRIOS POR NÍVEL:
- Andares 1-10: Drops comuns/incomuns para poções e pergaminhos
- Andares 11-15: Drops raros para equipamentos míticos
- Andares 16-20: Drops épicos/lendários para equipamentos lendários

INCENTIVO AO REPLAY:
- Múltiplos drops necessários (ex: 3x Escama de Dragão Jovem)
- Equipamentos base como ingredientes (precisa comprar/encontrar primeiro)
- Drops de alta raridade com baixa chance (5-25%)
- Sistema de upgrading (Raro → Mítico → Lendário)
*/ 