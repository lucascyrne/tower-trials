# Mapeamento de Dados para Reset

## Preservar

- `users`: identidade, papeis e flags de conta.
- `characters`: progressao principal do jogador.
- `character_equipment`: estado de equipamentos equipados.
- `character_drops` / inventario persistente: itens relevantes.
- progresso essencial em `game_progress` (quando aplicavel ao design atual).

## Regenerar/Descartar

- logs de atividade transitorios.
- caches derivados.
- dados de teste e fixtures nao oficiais.

## Ordem de importacao recomendada

1. `users`
2. `characters`
3. inventario/equipamentos
4. progresso complementar
5. reconciliacao final de integridade (FKs e constraints)
