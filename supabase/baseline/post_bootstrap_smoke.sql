-- ============================================================
-- POST-BOOTSTRAP SMOKE CHECKS (SQL)
-- ============================================================

-- 1) Funcoes criticas de runtime presentes
WITH required_functions(name) AS (
  VALUES
    ('create_user_profile'),
    ('get_user_characters'),
    ('get_character_full_stats'),
    ('get_character'),
    ('create_character'),
    ('delete_character'),
    ('check_character_limit'),
    ('get_user_character_progression'),
    ('internal_update_character_hp_mana'),
    ('update_character_activity'),
    ('distribute_attribute_points'),
    ('add_skill_xp'),
    ('recalculate_character_stats'),
    ('get_character_unlocked_checkpoints'),
    ('secure_grant_xp'),
    ('secure_grant_gold'),
    ('secure_advance_floor'),
    ('secure_process_combat_drops'),
    ('consume_potion_from_slot'),
    ('get_floor_data'),
    ('get_monster_for_floor'),
    ('get_special_event_for_floor'),
    ('process_special_event'),
    ('buy_consumable'),
    ('use_consumable'),
    ('check_can_craft'),
    ('craft_item'),
    ('get_equipped_slots'),
    ('toggle_equipment'),
    ('buy_equipment'),
    ('sell_equipment'),
    ('can_equip_item'),
    ('check_can_craft_equipment'),
    ('craft_equipment'),
    ('compare_equipment_stats'),
    ('calculate_equipment_bonuses_enhanced'),
    ('get_character_potion_slots'),
    ('set_potion_slot'),
    ('clear_potion_slot'),
    ('get_character_spell_slots'),
    ('set_spell_slot'),
    ('get_character_available_spells'),
    ('set_character_spells'),
    ('get_character_spell_stats'),
    ('get_available_spells'),
    ('kill_character'),
    ('get_user_cemetery'),
    ('count_user_cemetery'),
    ('get_cemetery_stats'),
    ('save_ranking_entry'),
    ('count_ranking_entries'),
    ('get_dynamic_user_ranking_history'),
    ('get_dynamic_user_stats'),
    ('save_ranking_entry_on_death')
)
SELECT rf.name AS missing_function
FROM required_functions rf
LEFT JOIN pg_proc p ON p.proname = rf.name
WHERE p.oid IS NULL
ORDER BY rf.name;

-- 2) Tabelas criticas presentes
WITH required_tables(name) AS (
  VALUES
    ('users'),
    ('characters'),
    ('game_progress'),
    ('monsters'),
    ('monster_possible_drops'),
    ('monster_drops'),
    ('character_drops'),
    ('consumables'),
    ('character_consumables'),
    ('equipment'),
    ('character_equipment'),
    ('equipment_crafting_recipes'),
    ('equipment_crafting_ingredients'),
    ('crafting_recipes'),
    ('crafting_ingredients'),
    ('special_events'),
    ('spells'),
    ('character_spell_slots')
)
SELECT rt.name AS missing_table
FROM required_tables rt
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = rt.name
WHERE t.table_name IS NULL
ORDER BY rt.name;
