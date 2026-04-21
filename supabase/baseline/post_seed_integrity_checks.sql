-- ============================================================
-- POST-SEED INTEGRITY CHECKS
-- Execute apos: seed.sql -> seed_craftable_equipment.sql ->
-- clean_spells.sql -> spells.sql
-- ============================================================

-- 1) Contagens minimas de catalogos
SELECT 'consumables' AS table_name, COUNT(*) AS total FROM consumables
UNION ALL
SELECT 'equipment', COUNT(*) FROM equipment
UNION ALL
SELECT 'monsters', COUNT(*) FROM monsters
UNION ALL
SELECT 'monster_drops', COUNT(*) FROM monster_drops
UNION ALL
SELECT 'spells', COUNT(*) FROM spells;

-- 2) Duplicidades por nome
SELECT name, COUNT(*) AS total
FROM spells
GROUP BY name
HAVING COUNT(*) > 1;

SELECT name, COUNT(*) AS total
FROM equipment
GROUP BY name
HAVING COUNT(*) > 1;

SELECT name, COUNT(*) AS total
FROM consumables
GROUP BY name
HAVING COUNT(*) > 1;

SELECT name, COUNT(*) AS total
FROM monster_drops
GROUP BY name
HAVING COUNT(*) > 1;

-- 3) Orfaos em crafting de consumiveis
SELECT cr.id AS recipe_id, cr.result_id
FROM crafting_recipes cr
LEFT JOIN consumables c ON c.id = cr.result_id
WHERE c.id IS NULL;

SELECT ci.id AS ingredient_id, ci.item_id
FROM crafting_ingredients ci
LEFT JOIN monster_drops md ON md.id = ci.item_id
WHERE ci.item_type = 'monster_drop' AND md.id IS NULL;

-- 4) Orfaos em crafting de equipment
SELECT ecr.id AS recipe_id, ecr.result_equipment_id
FROM equipment_crafting_recipes ecr
LEFT JOIN equipment e ON e.id = ecr.result_equipment_id
WHERE e.id IS NULL;

-- 5) Ranges invalidos
SELECT *
FROM monster_possible_drops
WHERE drop_chance < 0 OR drop_chance > 1 OR min_quantity > max_quantity;

SELECT *
FROM spells
WHERE mana_cost < 0 OR cooldown < 0 OR duration < 0 OR unlocked_at_level < 1;
