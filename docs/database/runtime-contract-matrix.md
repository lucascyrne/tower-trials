# Runtime Contract Matrix

Este documento congela o contrato mínimo entre `src` e banco para orientar o rebaseline.

## RPCs críticas por domínio

### auth/user

- `create_user_profile` -> `src/resources/auth/auth.service.ts` -> alta -> signup cria perfil em `users`.

### game/character/progression

- `get_user_character_progression` -> `src/resources/game/character.service.ts` -> alta -> hub/progressão.
- `check_character_limit` -> `src/resources/game/character.service.ts` -> alta -> criação de personagem.
- `get_user_characters` -> `src/resources/game/character.service.ts` -> alta -> seleção/listagem.
- `get_character_full_stats` -> `src/resources/game/character.service.ts` -> alta -> bootstrap de batalha/hub.
- `get_character` -> `src/resources/game/character.service.ts` -> alta -> dados complementares.
- `create_character` -> `src/resources/game/character.service.ts` -> alta -> onboarding do jogo.
- `delete_character` -> `src/resources/game/character.service.ts` -> alta -> permadeath/remoção.
- `internal_update_character_hp_mana` -> `src/resources/game/character.service.ts` -> alta -> consistência HP/Mana.
- `update_character_activity` -> `src/resources/game/character.service.ts` -> média -> auto-heal/timeouts.
- `distribute_attribute_points` -> `src/resources/game/character.service.ts` -> alta -> progressão.
- `add_skill_xp` -> `src/resources/game/character.service.ts` -> alta -> skills.
- `recalculate_character_stats` -> `src/resources/game/character.service.ts` -> média -> reparo de estado.
- `get_character_unlocked_checkpoints` -> `src/resources/game/character.service.ts` -> alta -> checkpoints.
- `save_ranking_entry_on_death` -> `src/resources/game/character.service.ts` -> média -> ranking histórico.

### game/battle/economy seguras (admin)

- `secure_grant_xp` -> `src/resources/game/infrastructure/supabase/supabase-admin-game.repository.ts` -> crítica -> anti-cheat.
- `secure_grant_gold` -> `src/resources/game/infrastructure/supabase/supabase-admin-game.repository.ts` -> crítica -> anti-cheat.
- `secure_advance_floor` -> `src/resources/game/infrastructure/supabase/supabase-admin-game.repository.ts` -> crítica -> anti-cheat.
- `secure_process_combat_drops` -> `src/resources/game/infrastructure/supabase/supabase-admin-game.repository.ts` -> crítica -> anti-cheat.
- `consume_potion_from_slot` -> `src/resources/game/infrastructure/supabase/supabase-admin-game.repository.ts` -> alta -> consumo seguro.

### game/floor/monster/event

- `get_floor_data` -> `src/resources/game/game.service.ts` -> crítica -> loop principal.
- `get_monster_for_floor` -> `src/resources/game/monster.service.ts` -> crítica -> loop principal.
- `get_special_event_for_floor` -> `src/resources/game/game.service.ts` e `special-event.service.ts` -> alta -> eventos.
- `process_special_event` -> `src/resources/game/special-event.service.ts` -> alta -> progressão/evento.

### game/consumable/crafting

- `buy_consumable` -> `src/resources/game/consumable-service/consumable-inventory.ts` -> alta.
- `use_consumable` -> `src/resources/game/consumable-service/consumable-inventory.ts` -> alta.
- `check_can_craft` -> `src/resources/game/consumable-service/consumable-drops-crafting.ts` -> média.
- `craft_item` -> `src/resources/game/consumable-service/consumable-drops-crafting.ts` -> média.

### game/spells/slots/equipment

- `get_character_potion_slots` / `set_potion_slot` / `clear_potion_slot` -> `slot.service.ts` -> alta.
- `get_character_spell_slots` / `set_spell_slot` -> `slot.service.ts` -> alta.
- `get_character_available_spells` / `set_character_spells` / `get_character_spell_stats` / `get_available_spells` -> `spell-service/spell-repository.ts` -> alta.
- `get_equipped_slots` / `toggle_equipment` / `buy_equipment` / `sell_equipment` / `can_equip_item` / `check_can_craft_equipment` / `craft_equipment` / `compare_equipment_stats` / `calculate_equipment_bonuses_enhanced` -> `equipment.service.ts` -> alta.

### game/cemetery/ranking

- `kill_character` / `get_user_cemetery` / `count_user_cemetery` / `get_cemetery_stats` -> `cemetery.service.ts` -> alta.
- `save_ranking_entry` / `count_ranking_entries` / `get_dynamic_user_ranking_history` / `get_dynamic_user_stats` / `test_ranking_system` / `refresh_all_rankings` -> `ranking.service.ts` -> alta.

## Tabelas diretas usadas por `src/resources/*`

- `users`
- `characters`
- `game_progress`
- `monsters`
- `monster_possible_drops`
- `monster_drops`
- `character_drops`
- `consumables`
- `character_consumables`
- `equipment`
- `character_equipment`
- `equipment_crafting_recipes`
- `equipment_crafting_ingredients`
- `crafting_recipes`
- `crafting_ingredients`
- `special_events`
- `spells`
- `character_spell_slots`

## Testes mínimos por criticidade

- **Crítica**
  - login + sessão SSR
  - carregar personagem e entrar em batalha
  - vitória com XP/gold/drops persistidos
  - avanço de andar persistido
- **Alta**
  - criação/deleção de personagem
  - slots de poção/spell
  - equipamento/crafting principal
  - ranking e cemitério
- **Média**
  - recálculo de stats
  - fallback de eventos/checkpoints
