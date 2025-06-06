# Funções do Banco de Dados - Versão Final

Este documento lista as funções mantidas após a limpeza de redundâncias realizada em `20241205000007_cleanup_redundant_functions.sql`.

## 1. Sistema de Personagens

### Criação e Gestão
- `create_character(UUID, VARCHAR)` - Criar novo personagem
- `delete_character(UUID)` - Deletar personagem
- `get_user_characters(UUID)` - Listar personagens do usuário
- `get_character(UUID)` - Obter dados de um personagem específico

### Cálculo de Stats
- `calculate_derived_stats(level, str, dex, int, wis, vit, luck)` - **PRINCIPAL** - Calcula stats derivados dos atributos
- `calculate_final_character_stats(UUID)` - Calcula stats finais incluindo equipamentos
- `get_character_full_stats(UUID)` - Retorna stats completos do personagem
- `get_character_detailed_stats(UUID)` - Stats detalhados com breakdown
- `recalculate_character_stats(UUID)` - Recalcula e atualiza stats no banco

### Progressão e XP
- `secure_grant_xp(UUID, INTEGER)` - **SEGURA** - Conceder XP
- `secure_grant_gold(UUID, INTEGER)` - **SEGURA** - Conceder ouro
- `secure_advance_floor(UUID, INTEGER)` - **SEGURA** - Avançar andar
- `update_character_stats(UUID, xp, gold, hp, mana, floor)` - Atualizar múltiplos stats
- `distribute_attribute_points(UUID, str, dex, int, wis, vit, luck)` - Distribuir pontos de atributo

### Atributos e Habilidades
- `add_skill_xp(UUID, VARCHAR, INTEGER)` - Adicionar XP de habilidade específica
- `grant_attribute_points_on_levelup(UUID, INTEGER)` - Conceder pontos ao subir nível

## 2. Sistema de Monstros

### Obtenção de Monstros
- `get_monster_for_floor(INTEGER)` - **PRINCIPAL** - Obter monstro para andar (com sistema de ciclos)
- `scale_monster_stats_balanced(monster_record, floor)` - Escalar stats de monstro de forma balanceada

### Sistema de Ciclos
- `calculate_monster_tier(INTEGER)` - Calcular tier baseado no andar
- `calculate_cycle_position(INTEGER)` - Calcular posição no ciclo
- `get_cycle_info(INTEGER)` - Informações do ciclo atual

## 3. Sistema de Ranking

### Rankings Globais
- `get_dynamic_ranking_by_highest_floor(limit, offset)` - Ranking por andar mais alto
- `get_dynamic_ranking_by_level(limit, offset)` - Ranking por nível
- `get_dynamic_ranking_by_gold(limit, offset)` - Ranking por ouro

### Rankings do Usuário
- `get_dynamic_user_ranking_history(UUID, limit, offset)` - Histórico do usuário
- `get_dynamic_user_stats(UUID)` - Estatísticas do usuário
- `save_ranking_entry_on_death(UUID, VARCHAR, INTEGER, INTEGER, INTEGER, BOOLEAN)` - Salvar entrada ao morrer

## 4. Sistema de Equipamentos

### Gestão de Equipamentos
- `calculate_equipment_bonuses(UUID)` - Calcular bônus totais dos equipamentos
- `toggle_equipment(UUID, UUID, BOOLEAN, VARCHAR)` - Equipar/desequipar item
- `can_equip_item(UUID, UUID)` - Verificar se pode equipar
- `get_equipped_slots(UUID)` - Obter equipamentos equipados por slot

### Compra/Venda
- `buy_equipment(UUID, UUID, INTEGER)` - Comprar equipamento
- `sell_equipment(UUID, UUID)` - Vender equipamento

### Crafting de Equipamentos
- `check_can_craft_equipment(UUID, UUID)` - Verificar se pode craftar equipamento
- `craft_equipment(UUID, UUID)` - Craftar equipamento

## 5. Sistema de Consumíveis

### Gestão de Consumíveis
- `buy_consumable(UUID, UUID, INTEGER)` - Comprar consumível
- `use_consumable(UUID, UUID)` - Usar consumível

### Slots de Poções
- `set_potion_slot(UUID, INTEGER, UUID)` - Configurar slot de poção
- `clear_potion_slot(UUID, INTEGER)` - Limpar slot de poção
- `get_character_potion_slots(UUID)` - Obter slots de poção
- `use_potion_from_slot(UUID, INTEGER)` - Usar poção de slot específico
- `consume_potion_from_slot(UUID, INTEGER)` - **SEGURA** - Consumir poção do slot

## 6. Sistema de Magias

### Gestão de Magias
- `get_available_spells(INTEGER)` - Obter magias disponíveis por nível
- `get_character_available_spells(UUID)` - Magias disponíveis para personagem
- `set_character_spells(UUID, UUID, UUID, UUID)` - Configurar magias do personagem
- `get_character_spell_stats(UUID)` - Stats de magia do personagem

### Cálculos de Magia
- `calculate_scaled_spell_damage(UUID, UUID)` - Calcular dano de magia
- `calculate_scaled_spell_healing(UUID, UUID)` - Calcular cura de magia

## 7. Sistema de Drops e Crafting

### Drops de Monstros
- `get_monster_drops(UUID)` - Obter drops possíveis de monstro
- `secure_process_combat_drops(UUID, UUID)` - **SEGURA** - Processar drops de combate

### Crafting de Consumíveis
- `check_can_craft(UUID, UUID)` - Verificar se pode craftar
- `craft_item(UUID, UUID)` - Craftar item

## 8. Sistema de Andares

### Gestão de Andares
- `get_floor_data(INTEGER)` - Obter dados do andar
- `get_unlocked_checkpoints(INTEGER)` - Obter checkpoints desbloqueados
- `get_character_highest_floor(UUID)` - Andar mais alto do personagem
- `get_character_unlocked_checkpoints(UUID)` - Checkpoints do personagem

## 9. Eventos Especiais

### Processamento de Eventos
- `get_special_event_for_floor(INTEGER)` - Obter evento especial para andar
- `process_special_event(UUID, UUID)` - Processar evento especial

## 10. Sistema de Cura Automática

### Cura por Tempo
- `calculate_auto_heal(UUID, TIMESTAMP)` - Calcular cura automática
- `update_character_last_activity(UUID, TIMESTAMP)` - Atualizar última atividade

## 11. Sistema de Morte

### Gestão de Mortes
- `kill_character(UUID, INTEGER, INTEGER)` - Matar personagem e salvar dados
- `get_cemetery_stats(UUID)` - Estatísticas do cemitério

## 12. Sistema de Usuários

### Gestão de Usuários
- `create_user_profile(UUID, VARCHAR, VARCHAR)` - Criar perfil de usuário
- `update_user_character_progression(UUID)` - Atualizar progressão do usuário
- `calculate_available_character_slots(UUID)` - Calcular slots disponíveis
- `get_user_character_progression(UUID)` - Obter progressão do usuário

## 13. Funções de Validação

### Validações
- `validate_character_name(VARCHAR)` - Validar nome de personagem
- `check_character_limit(UUID)` - Verificar limite de personagens

## 14. Funções de Atividade

### Monitoramento
- `update_character_activity(UUID)` - Atualizar atividade do personagem

---

## Funções Removidas na Limpeza

As seguintes funções foram removidas por serem redundantes ou obsoletas:
- `calculate_character_derived_stats` (substituída por `calculate_derived_stats`)
- `calculate_derived_stats_with_weapon` (funcionalidade integrada)
- `get_monster_for_floor_cyclic` (integrada em `get_monster_for_floor`)
- `scale_monster_stats` e `scale_monster_stats_with_floor` (substituídas por `scale_monster_stats_balanced`)
- Múltiplas funções de teste e debug
- Funções de ranking antigas (anteriores ao sistema dinâmico)
- Funções de manutenção temporárias

## Convenções

- **PRINCIPAL**: Função principal para a funcionalidade
- **SEGURA**: Função com validações de segurança e SECURITY DEFINER
- Funções com `secure_` são sempre preferíveis para operações críticas
- Funções `get_dynamic_` são as versões mais recentes do sistema de ranking 