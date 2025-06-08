-- Script para atualizar todas as magias com escalamento correto e adicionar novas magias
-- Execute este script no SQL Editor do Supabase
-- IMPORTANTE: Execute clean_spells.sql ANTES deste script

-- Inserir TODAS as magias com descrições atualizadas e novas magias para builds corpo-a-corpo
INSERT INTO spells (name, description, effect_type, mana_cost, cooldown, unlocked_at_level, effect_value, duration) VALUES
    -- ==========================================
    -- EARLY LEVEL SPELLS (1-15) - Mix de builds
    -- ==========================================
    
    -- Magias Mágicas (Intelligence/Wisdom)
    ('Bola de Fogo', 'Dispara uma bola de fogo que causa dano moderado. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 20, 2, 1, 30, 1),
    ('Cura Menor', 'Cura básica que restaura uma quantidade moderada de HP. Escala com Sabedoria (+12%) e Maestria Mágica (+10%).', 'heal'::spell_effect_type, 15, 3, 2, 25, 1),
    ('Raio Congelante', 'Projétil de gelo que causa dano e reduz velocidade. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 35, 3, 7, 45, 1),
    
    -- Magias Físicas (Strength/Dexterity/Vitality)
    ('Fúria do Guerreiro', 'Canaliza a raiva interior para aumentar temporariamente o ataque. Escala com Força (+8%) e Maestria com Armas (+5%).', 'buff'::spell_effect_type, 25, 4, 3, 20, 3),
    ('Reflexos de Combate', 'Aguça os sentidos para aumentar velocidade e chance crítica. Escala com Destreza (+10%) e Sorte (+5%).', 'buff'::spell_effect_type, 30, 5, 4, 15, 2),
    ('Vigor Bárbaro', 'Fortalece o corpo para resistir mais dano. Escala com Vitalidade (+12%) e Maestria de Defesa (+8%).', 'buff'::spell_effect_type, 35, 6, 5, 25, 4),
    ('Golpe Devastador', 'Concentra toda a força em um ataque poderoso. Escala com Força (+15%) e Maestria com Armas (+10%).', 'damage'::spell_effect_type, 40, 4, 6, 50, 1),
    
    -- Magias Híbridas e Utilitárias
    ('Veneno', 'Envenena o inimigo causando dano ao longo do tempo. Escala com Inteligência (+8%) e Maestria Mágica (+12%).', 'dot'::spell_effect_type, 25, 4, 8, 10, 3),
    ('Escudo Arcano', 'Escudo mágico que aumenta defesa temporariamente. Escala com Sabedoria (+5%) e Maestria Mágica (+15%).', 'buff'::spell_effect_type, 30, 5, 9, 15, 2),
    ('Regeneração Menor', 'Regeneração contínua que cura HP ao longo de vários turnos. Escala com Sabedoria (+12%) e Maestria Mágica (+10%).', 'hot'::spell_effect_type, 40, 6, 10, 15, 3),
    ('Dança da Lâmina', 'Técnica de combate que combina velocidade e precisão. Escala com Destreza (+12%) e Força (+8%).', 'damage'::spell_effect_type, 35, 3, 11, 40, 1),
    ('Pele de Ferro', 'Endurece a pele temporariamente aumentando defesa. Escala com Vitalidade (+10%) e Força (+5%).', 'buff'::spell_effect_type, 45, 7, 12, 30, 3),
    ('Agilidade Felina', 'Aumenta drasticamente a velocidade e esquiva. Escala com Destreza (+15%) e Sorte (+8%).', 'buff'::spell_effect_type, 50, 6, 13, 25, 2),
    ('Sede de Sangue', 'Aumenta ataque mas reduz defesa temporariamente. Escala com Força (+12%) e reduz com Sabedoria (-5%).', 'buff'::spell_effect_type, 40, 5, 14, 35, 3),
    ('Rajada de Vento', 'Ataque rápido de ar comprimido. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 30, 2, 15, 35, 1),
    
    -- ==========================================
    -- MID LEVEL SPELLS (16-35) - Especializações
    -- ==========================================
    
    -- Magias Mágicas Avançadas
    ('Meteoro', 'Meteoro devastador que causa dano massivo. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 80, 6, 16, 120, 1),
    ('Cura Maior', 'Cura poderosa que restaura uma grande quantidade de HP. Escala com Sabedoria (+12%) e Maestria Mágica (+10%).', 'heal'::spell_effect_type, 75, 5, 17, 100, 1),
    ('Tempestade de Gelo', 'Tempestade de gelo devastadora. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 100, 7, 22, 90, 1),
    ('Explosão Arcana', 'Grande explosão de energia mágica. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 120, 8, 30, 140, 1),
    
    -- Magias Físicas Avançadas
    ('Fúria Berserker', 'Entra em fúria bárbara aumentando massivamente o ataque. Escala com Força (+15%) e Vitalidade (+8%).', 'buff'::spell_effect_type, 70, 8, 18, 50, 4),
    ('Técnica Mortal', 'Técnica de combate letal que garante crítico. Escala com Destreza (+20%) e Força (+10%).', 'damage'::spell_effect_type, 85, 6, 19, 80, 1),
    ('Resistência Titânica', 'Torna-se temporariamente resistente a todo tipo de dano. Escala com Vitalidade (+15%) e Sabedoria (+8%).', 'buff'::spell_effect_type, 90, 10, 20, 60, 5),
    ('Combo Devastador', 'Sequência de ataques rápidos e precisos. Escala com Força (+12%), Destreza (+12%) e Maestria com Armas (+8%).', 'damage'::spell_effect_type, 95, 7, 21, 110, 1),
    ('Regeneração Guerreira', 'Cura baseada na resistência física do corpo. Escala com Vitalidade (+15%) e Força (+8%).', 'heal'::spell_effect_type, 80, 6, 23, 90, 1),
    ('Instinto Assassino', 'Aguça todos os sentidos para combate letal. Escala com Destreza (+15%), Sorte (+10%) e reduz com Sabedoria (-3%).', 'buff'::spell_effect_type, 75, 8, 24, 40, 3),
    ('Pancada Sísmica', 'Golpe tão poderoso que abala o chão. Escala com Força (+18%) e Vitalidade (+7%).', 'damage'::spell_effect_type, 110, 9, 25, 130, 1),
    ('Esquiva Fantasma', 'Torna-se temporariamente difícil de acertar. Escala com Destreza (+18%) e Sorte (+12%).', 'buff'::spell_effect_type, 85, 7, 26, 45, 3),
    ('Vigor Primitivo', 'Desperta a força ancestral do corpo. Escala com Vitalidade (+20%) e Força (+10%).', 'buff'::spell_effect_type, 100, 12, 27, 55, 5),
    ('Lâmina do Vento', 'Corte invisível que atravessa armaduras. Escala com Destreza (+15%) e Inteligência (+8%).', 'damage'::spell_effect_type, 90, 6, 28, 100, 1),
    
    -- Magias Híbridas Avançadas
    ('Praga Tóxica', 'Veneno potente que se espalha. Escala com Inteligência (+8%) e Maestria Mágica (+12%).', 'dot'::spell_effect_type, 70, 7, 29, 25, 5),
    ('Fortificação', 'Aumenta drasticamente a defesa. Escala com Sabedoria (+10%) e Maestria Mágica (+15%).', 'buff'::spell_effect_type, 85, 8, 31, 40, 4),
    ('Vampirismo', 'Cura baseada no dano causado. Escala com Força (+10%) e Inteligência (+8%).', 'heal'::spell_effect_type, 90, 6, 32, 40, 1),
    ('Barreira Temporal', 'Proteção que absorve dano. Escala com Sabedoria (+12%) e Maestria Mágica (+15%).', 'buff'::spell_effect_type, 110, 9, 33, 60, 5),
    ('Drenar Vida', 'Absorve HP do inimigo. Escala com Inteligência (+10%) e Sabedoria (+8%).', 'debuff'::spell_effect_type, 85, 6, 34, 35, 1),
    ('Cometa Destruidor', 'Ataque de fogo devastador. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 150, 10, 35, 180, 1),
    
    -- ==========================================
    -- HIGH LEVEL SPELLS (36-50) - Poderes Supremos
    -- ==========================================
    
    -- Magias Mágicas Supremas
    ('Apocalipse', 'Invoca o fim dos tempos. Escala com Inteligência (+10%), Sabedoria (+5%) e Maestria Mágica (+15%).', 'damage'::spell_effect_type, 200, 12, 36, 250, 1),
    ('Cura Divina', 'Restauração completa da divindade. Escala com Sabedoria (+15%) e Maestria Mágica (+12%).', 'heal'::spell_effect_type, 180, 10, 37, 200, 1),
    ('Supernova', 'Explosão estelar devastadora. Escala com Inteligência (+12%), Sabedoria (+8%) e Maestria Mágica (+20%).', 'damage'::spell_effect_type, 280, 15, 42, 320, 1),
    ('Tormenta Cósmica', 'Tempestade do espaço sideral. Escala com Inteligência (+12%), Sabedoria (+8%) e Maestria Mágica (+20%).', 'damage'::spell_effect_type, 400, 20, 47, 380, 1),
    
    -- Magias Físicas Supremas
    ('Fúria dos Titãs', 'Canaliza a força dos antigos titãs. Escala com Força (+25%) e Vitalidade (+15%).', 'buff'::spell_effect_type, 250, 20, 38, 80, 6),
    ('Técnica do Deus da Guerra', 'Domínio supremo do combate corpo-a-corpo. Escala com Força (+20%), Destreza (+20%) e Maestria com Armas (+15%).', 'damage'::spell_effect_type, 300, 18, 39, 350, 1),
    ('Imortalidade Guerreira', 'Transcende os limites mortais temporariamente. Escala com Vitalidade (+30%) e Força (+15%).', 'buff'::spell_effect_type, 350, 25, 40, 100, 8),
    ('Velocidade da Luz', 'Move-se na velocidade da luz. Escala com Destreza (+30%) e Sorte (+20%).', 'buff'::spell_effect_type, 280, 15, 41, 90, 4),
    ('Punho que Quebra Mundos', 'Soco capaz de destroçar a própria realidade. Escala com Força (+30%) e Vitalidade (+20%).', 'damage'::spell_effect_type, 400, 25, 43, 450, 1),
    ('Dança da Morte Eterna', 'Técnica de combate que transcende vida e morte. Escala com Destreza (+25%), Força (+20%) e Sorte (+15%).', 'damage'::spell_effect_type, 350, 20, 44, 400, 1),
    ('Espírito Inquebrável', 'Vontade que supera qualquer adversidade. Escala com Vitalidade (+35%) e Sabedoria (+15%).', 'buff'::spell_effect_type, 320, 30, 45, 120, 10),
    ('Reflexos Divinos', 'Reflexos que beiram a onisciência. Escala com Destreza (+35%) e Inteligência (+15%).', 'buff'::spell_effect_type, 300, 25, 46, 110, 6),
    
    -- Magias Híbridas Supremas
    ('Invencibilidade', 'Torna-se temporariamente indestrutível. Escala com todos os atributos (+5% cada).', 'buff'::spell_effect_type, 250, 20, 48, 90, 3),
    ('Transcendência', 'Eleva-se além dos mortais. Escala com todos os atributos (+8% cada).', 'buff'::spell_effect_type, 350, 30, 49, 100, 6),
    ('Criação e Destruição', 'O poder supremo da existência. Escala com todos os atributos (+10% cada).', 'damage'::spell_effect_type, 500, 30, 50, 500, 1),
    
    -- ==========================================
    -- MAGIAS ADICIONAIS PARA BUILDS ESPECÍFICAS
    -- ==========================================
    
    -- Magias Debuff/Utilitárias com escalamento
    ('Fraqueza', 'Reduz temporariamente o ataque do inimigo. Escala com Inteligência (+8%) e Maestria Mágica (+12%).', 'debuff'::spell_effect_type, 35, 5, 51, 20, 2),
    ('Chamas Persistentes', 'Queima o inimigo ao longo do tempo. Escala com Inteligência (+8%) e Maestria Mágica (+12%).', 'dot'::spell_effect_type, 45, 5, 52, 15, 4),
    ('Benção da Força', 'Aumenta temporariamente o ataque aliado. Escala com Sabedoria (+10%) e Maestria Mágica (+8%).', 'buff'::spell_effect_type, 55, 6, 53, 25, 3),
    ('Maldição da Lentidão', 'Reduz a velocidade do inimigo. Escala com Inteligência (+8%) e Maestria Mágica (+12%).', 'debuff'::spell_effect_type, 40, 4, 54, 15, 3),
    ('Armadura Mística', 'Cria uma barreira mágica defensiva. Escala com Sabedoria (+10%) e Maestria Mágica (+15%).', 'buff'::spell_effect_type, 60, 7, 55, 30, 4),
    ('Drenar Energia', 'Rouba mana do inimigo e restaura a sua. Escala com Inteligência (+10%) e Maestria Mágica (+12%).', 'debuff'::spell_effect_type, 45, 5, 56, 20, 1),
    ('Terror', 'Reduz todos os atributos do inimigo. Escala com Inteligência (+8%) e Maestria Mágica (+15%).', 'debuff'::spell_effect_type, 90, 6, 57, 30, 3),
    ('Silêncio Arcano', 'Impede o uso de magias. Escala com Inteligência (+10%) e Maestria Mágica (+15%).', 'debuff'::spell_effect_type, 80, 7, 58, 0, 2),
    ('Aniquilação', 'Remove todas as defesas inimigas. Escala com Inteligência (+12%) e Maestria Mágica (+18%).', 'debuff'::spell_effect_type, 200, 15, 59, 80, 4),
    ('Vazio Absoluto', 'Remove a existência do inimigo. Escala com Inteligência (+15%) e Maestria Mágica (+20%).', 'debuff'::spell_effect_type, 320, 25, 60, 100, 5);

-- Verificar quantas magias foram inseridas
SELECT 
    COUNT(*) as total_spells,
    COUNT(CASE WHEN unlocked_at_level <= 15 THEN 1 END) as early_level_spells,
    COUNT(CASE WHEN unlocked_at_level BETWEEN 16 AND 35 THEN 1 END) as mid_level_spells,
    COUNT(CASE WHEN unlocked_at_level >= 36 THEN 1 END) as high_level_spells
FROM spells;

-- Verificar distribuição por tipo de efeito
SELECT 
    effect_type,
    COUNT(*) as spell_count,
    AVG(mana_cost) as avg_mana_cost,
    AVG(effect_value) as avg_effect_value
FROM spells 
GROUP BY effect_type 
ORDER BY effect_type;

-- Exibir algumas magias de exemplo para cada tipo de build
(SELECT 'Magias Mágicas (INT/WIS)' as build_type, name, description, unlocked_at_level, mana_cost, effect_value
FROM spells 
WHERE description ILIKE '%inteligência%' OR description ILIKE '%sabedoria%' OR description ILIKE '%maestria mágica%'
ORDER BY unlocked_at_level
LIMIT 5)

UNION ALL

(SELECT 'Magias Físicas (STR/DEX/VIT)' as build_type, name, description, unlocked_at_level, mana_cost, effect_value
FROM spells 
WHERE description ILIKE '%força%' OR description ILIKE '%destreza%' OR description ILIKE '%vitalidade%'
ORDER BY unlocked_at_level
LIMIT 5)

UNION ALL

(SELECT 'Magias Híbridas' as build_type, name, description, unlocked_at_level, mana_cost, effect_value
FROM spells 
WHERE description ILIKE '%todos os atributos%'
ORDER BY unlocked_at_level
LIMIT 3)

ORDER BY build_type, unlocked_at_level; 