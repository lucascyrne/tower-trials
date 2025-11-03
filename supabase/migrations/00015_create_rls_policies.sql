-- =============================================
-- MIGRATION: RLS Policies (Row Level Security)
-- Version: 2.0
-- Description: Todas as políticas de segurança consolidadas
-- Dependencies: Todas as migrações anteriores (00001-00014)
-- =============================================

-- === USERS ===

CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT USING (true);

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE USING (
        uid = (SELECT auth.uid()) OR auth.role() = 'service_role'
    ) WITH CHECK (
        uid = (SELECT auth.uid()) OR auth.role() = 'service_role'
    );

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE USING (
        uid = (SELECT auth.uid()) OR auth.role() = 'service_role'
    );

-- === CHARACTERS ===

CREATE POLICY "characters_select_policy" ON characters
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "characters_insert_policy" ON characters
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "characters_update_policy" ON characters
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "characters_delete_policy" ON characters
    FOR DELETE TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY "characters_service_role_policy" ON characters
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === MONSTERS ===

CREATE POLICY "monsters_select_policy" ON monsters
    FOR SELECT USING (true);

CREATE POLICY "monsters_service_role_policy" ON monsters
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === EQUIPMENT ===

CREATE POLICY "equipment_select_policy" ON equipment
    FOR SELECT USING (true);

CREATE POLICY "equipment_service_role_policy" ON equipment
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "character_equipment_select_policy" ON character_equipment
    FOR SELECT TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_equipment_insert_policy" ON character_equipment
    FOR INSERT TO authenticated
    WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_equipment_update_policy" ON character_equipment
    FOR UPDATE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_equipment_delete_policy" ON character_equipment
    FOR DELETE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_equipment_service_role_policy" ON character_equipment
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === CONSUMABLES ===

CREATE POLICY "consumables_select_policy" ON consumables
    FOR SELECT USING (true);

CREATE POLICY "consumables_service_role_policy" ON consumables
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "character_consumables_select_policy" ON character_consumables
    FOR SELECT TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_consumables_insert_policy" ON character_consumables
    FOR INSERT TO authenticated
    WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_consumables_update_policy" ON character_consumables
    FOR UPDATE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_consumables_delete_policy" ON character_consumables
    FOR DELETE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_consumables_service_role_policy" ON character_consumables
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === POTION SLOTS ===

CREATE POLICY "potion_slots_select_policy" ON potion_slots
    FOR SELECT TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "potion_slots_insert_policy" ON potion_slots
    FOR INSERT TO authenticated
    WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "potion_slots_update_policy" ON potion_slots
    FOR UPDATE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "potion_slots_delete_policy" ON potion_slots
    FOR DELETE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "potion_slots_service_role_policy" ON potion_slots
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === SPELLS ===

CREATE POLICY "spells_select_policy" ON spells
    FOR SELECT USING (true);

CREATE POLICY "spells_service_role_policy" ON spells
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "spell_slots_select_policy" ON spell_slots
    FOR SELECT TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "spell_slots_insert_policy" ON spell_slots
    FOR INSERT TO authenticated
    WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "spell_slots_update_policy" ON spell_slots
    FOR UPDATE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "spell_slots_delete_policy" ON spell_slots
    FOR DELETE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "spell_slots_service_role_policy" ON spell_slots
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === DROPS ===

CREATE POLICY "monster_drops_select_policy" ON monster_drops
    FOR SELECT USING (true);

CREATE POLICY "monster_drops_service_role_policy" ON monster_drops
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "monster_possible_drops_select_policy" ON monster_possible_drops
    FOR SELECT USING (true);

CREATE POLICY "monster_possible_drops_service_role_policy" ON monster_possible_drops
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "character_drops_select_policy" ON character_drops
    FOR SELECT TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_drops_insert_policy" ON character_drops
    FOR INSERT TO authenticated
    WITH CHECK (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_drops_update_policy" ON character_drops
    FOR UPDATE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_drops_delete_policy" ON character_drops
    FOR DELETE TO authenticated
    USING (character_id IN (SELECT id FROM characters WHERE user_id = auth.uid()));

CREATE POLICY "character_drops_service_role_policy" ON character_drops
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === CRAFTING ===

CREATE POLICY "crafting_recipes_select_policy" ON crafting_recipes
    FOR SELECT USING (true);

CREATE POLICY "crafting_recipes_service_role_policy" ON crafting_recipes
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "crafting_ingredients_select_policy" ON crafting_ingredients
    FOR SELECT USING (true);

CREATE POLICY "crafting_ingredients_service_role_policy" ON crafting_ingredients
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === RANKING ===

CREATE POLICY "game_rankings_select_policy" ON game_rankings
    FOR SELECT USING (true);

CREATE POLICY "game_rankings_insert_policy" ON game_rankings
    FOR INSERT TO authenticated
    WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "game_rankings_update_policy" ON game_rankings
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "game_rankings_service_role_policy" ON game_rankings
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "game_progress_select_policy" ON game_progress
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "game_progress_insert_policy" ON game_progress
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "game_progress_update_policy" ON game_progress
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "game_progress_delete_policy" ON game_progress
    FOR DELETE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "game_progress_service_role_policy" ON game_progress
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === SPECIAL EVENTS ===

CREATE POLICY "special_events_select_policy" ON special_events
    FOR SELECT USING (true);

CREATE POLICY "special_events_service_role_policy" ON special_events
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "floors_select_policy" ON floors
    FOR SELECT USING (true);

CREATE POLICY "floors_service_role_policy" ON floors
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- === DEAD CHARACTERS ===

CREATE POLICY "dead_characters_select_policy" ON dead_characters
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "dead_characters_insert_policy" ON dead_characters
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "dead_characters_service_role_policy" ON dead_characters
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

