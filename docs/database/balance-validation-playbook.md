# Balance Validation Playbook (pre-reset)

Objetivo: validar mudanças de balanceamento antes do reset definitivo do banco.

## Escopo de validação

- Progressão: XP/level-up/pontos de atributo.
- Combate: dano físico/mágico, crítico, defesa, turnos.
- Economia: gold, drops, crafting, loja.
- Curva de dificuldade: floors iniciais, medianos e boss.
- Magias: custo de mana, cooldown, valor de efeito, desbloqueio por nível.

## Cenários mínimos (amostra fixa)

- **S1**: personagem nível 1 com equipamento básico (andar 1-3).
- **S2**: personagem nível 10 com build híbrida (andar 10-15).
- **S3**: personagem nível 20 focado em magia (andar 20-30).
- **S4**: personagem nível 20 focado físico (andar 20-30).
- **S5**: boss floor com build defensiva e ofensiva.

## Alavancas por marco (lista curta)

Para cada janela de tuning, escolher **uma** alavanca principal por marco e medir de novo S1–S5.

| Marco | Alavanca | Onde |
|--------|-----------|------|
| Dificuldade por era | `scale_monster_stats_with_floor` (tier `POWER(2.56, …)`, pisos HP/ATK/DEF, boss ×1.62) | SQL migração `20260421000005_monster_scaling_and_user_characters_highest_floor.sql` + `get_monster_for_floor` |
| Picos de recompensa | Multiplicadores `FloorType` (boss/elite/event) | `GameService.calculateFloorRewards` |
| Ritmo de nível | `calculate_xp_next_level` (base 100, razão **1.56**) | SQL migração `20260421000004_balance_xp_and_derived_stats.sql` |
| Stats derivados (persistidos) | `calculate_derived_stats` (12 ints: nível, atributos, masteries) | SQL migração `20260421000004_balance_xp_and_derived_stats.sql` |
| Dano físico / duplo / crítico / fuga | Fórmulas e clamps no cliente | `GameService.calculateDamage`, fuga em `game.service.ts` |
| Magia vs físico | `calculateScaledSpellDamage` / mitigação | `spell-combat.ts` + `GameService.applyMagicalDamageMitigation` |
| Sustain económico | `reward_gold`, drops (`processMonsterDrops`) | SQL + TS |
| Velocidade de combate | Iniciativa e turnos extras | `GameService.calculateInitiative` / `calculateExtraTurns` |

Stats de personagem em combate seguem colunas persistidas em `characters` (recalculadas por `calculate_derived_stats`); validar UI e batalha com a mesma fonte.

## Métricas de aceitação

- Taxa de vitória por cenário dentro da faixa alvo definida pelo design.
- Tempo médio de batalha sem outliers extremos.
- Ganho de XP e gold sem spikes anômalos.
- Atribuição de pontos por level-up consistente com regra oficial.
- Custo/benefício de poções e spells sem dominância absoluta de uma opção.

## Procedimento

1. Aplicar baseline draft em ambiente de homologação.
2. Aplicar seeds base + crafting + spells (com limpeza de spells antes do override).
3. Rodar cenários S1-S5 e registrar resultados.
4. Comparar com faixa alvo de design.
5. Ajustar SQL e, quando aplicável, fórmulas de combate no cliente (`game.service`, `spell-combat`); repetir.

## Resultado esperado

- Nenhuma regressão crítica no loop principal.
- Curva de progressão previsível e sem exploração óbvia.
- Build diversity viável sem mono-estratégia dominante.
