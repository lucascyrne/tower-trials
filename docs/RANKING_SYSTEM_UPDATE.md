# Sistema de Ranking Dinâmico - Tower Trials

## Visão Geral

O sistema de ranking foi completamente reformulado para ser **dinâmico** e **abrangente**, considerando todos os personagens do jogo (vivos e mortos) em tempo real.

## Principais Melhorias

### 🔄 Ranking Dinâmico
- **Antes**: Apenas personagens mortos apareciam no ranking
- **Agora**: Todos os personagens (vivos e mortos) são considerados dinamicamente
- **Benefício**: Rankings sempre atualizados com o progresso atual dos jogadores

### 📊 Três Modalidades de Ranking
1. **Andar Mais Alto**: Baseado no andar mais alto alcançado
2. **Maior Nível**: Baseado no nível do personagem
3. **Mais Rico**: Baseado na quantidade de ouro acumulada

### 🎯 Filtros de Status
- **Todos**: Mostra personagens vivos e mortos
- **Apenas Vivos**: Mostra apenas personagens ativos
- **Apenas Mortos**: Mostra apenas personagens que morreram

### ⚡ Performance Otimizada
- Índices especializados para consultas rápidas
- Funções SQL otimizadas para melhor performance
- Cache inteligente para reduzir carga no banco

## Arquitetura Técnica

### Banco de Dados

#### Novas Funções RPC
```sql
-- Ranking dinâmico por modalidade
get_dynamic_ranking_by_highest_floor(limit, status_filter)
get_dynamic_ranking_by_level(limit, status_filter)
get_dynamic_ranking_by_gold(limit, status_filter)

-- Dados do usuário
get_dynamic_user_ranking_history(user_id, limit)
get_dynamic_user_stats(user_id)
```

#### Índices Otimizados
```sql
-- Para personagens vivos
idx_characters_ranking_floor
idx_characters_ranking_level
idx_characters_ranking_gold
idx_characters_active_ranking

-- Para personagens mortos
idx_game_rankings_dead_users
idx_game_rankings_dead_level
idx_game_rankings_dead_gold
```

### Frontend

#### Componentes Atualizados
- `RankingPage`: Interface principal do ranking
- `RankingTable`: Tabela de exibição dos rankings
- `RankingFilters`: Filtros de modalidade e status
- `UserStats`: Estatísticas do usuário

#### Serviços
- `RankingService`: Atualizado para usar funções dinâmicas
- `GameProvider`: Otimizado para não salvar ranking desnecessariamente

## Como Funciona

### 1. Personagens Vivos
- Dados obtidos diretamente da tabela `characters`
- Sempre refletem o estado atual do personagem
- Atualizados automaticamente conforme o progresso

### 2. Personagens Mortos
- Dados preservados na tabela `game_rankings`
- Mantém histórico de todas as tentativas
- Permite comparação entre diferentes runs

### 3. Lógica de Ranking
```sql
WITH character_stats AS (
    -- União de personagens vivos e mortos
    SELECT ... FROM characters WHERE alive
    UNION ALL
    SELECT ... FROM game_rankings WHERE dead
),
best_per_user AS (
    -- Melhor resultado por usuário
    SELECT DISTINCT ON (user_id) ...
    ORDER BY ranking_criteria DESC
)
SELECT ... ORDER BY ranking_criteria DESC
```

## Migrações Necessárias

### Para Banco Remoto
Execute o script: `scripts/apply-ranking-migrations.sql`

### Arquivos de Migração
1. `20241201000003_dynamic_ranking_system.sql` - Sistema dinâmico
2. `20241201000004_optimize_dynamic_ranking.sql` - Otimizações

## Benefícios para o Usuário

### 🎮 Experiência Melhorada
- Rankings sempre atualizados
- Competição em tempo real
- Visibilidade do progresso atual

### 📈 Motivação Aumentada
- Personagens vivos aparecem no ranking
- Incentivo para continuar progredindo
- Comparação justa entre jogadores

### 🔍 Transparência
- Filtros claros por status
- Histórico completo preservado
- Estatísticas detalhadas

## Compatibilidade

### ✅ Mantido
- Todas as funcionalidades existentes
- Dados históricos preservados
- Interface familiar

### 🆕 Adicionado
- Ranking dinâmico
- Filtros de status
- Performance otimizada
- Estatísticas expandidas

## Monitoramento

### Métricas Importantes
- Tempo de resposta das consultas de ranking
- Número de personagens vivos vs mortos
- Uso dos filtros de status
- Performance dos índices

### Logs
- `[RankingPage]`: Carregamento de dados
- `[RankingService]`: Chamadas de API
- `[GameProvider]`: Atualizações de progresso

## Próximos Passos

1. **Monitorar Performance**: Acompanhar tempos de resposta
2. **Feedback dos Usuários**: Coletar impressões sobre o novo sistema
3. **Otimizações Futuras**: Implementar cache adicional se necessário
4. **Expansão**: Considerar novas modalidades de ranking

---

**Nota**: Este sistema mantém total compatibilidade com dados existentes e não requer reset do banco de dados. 