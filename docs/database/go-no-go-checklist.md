# Go/No-Go Checklist

## Técnica

- `post_bootstrap_smoke.sql` sem faltas de função/tabela.
- `post_seed_integrity_checks.sql` sem duplicidade/órfãos/ranges inválidos.
- Build/lint do app sem regressão de integração Supabase.

## Funcional

- Login + refresh SSR.
- Criação de personagem.
- Fluxo de batalha completo com vitória e derrota.
- Persistência de XP/gold/floor.
- Distribuição de atributos.
- Ranking e cemitério.

## Segurança

- RLS ativo em tabelas expostas.
- Grants/revokes coerentes por role.
- RPCs seguras operando com políticas finais.
- Sem segredo em `NEXT_PUBLIC_*`.

## Decisão

- **GO**: todos os itens acima verdes.
- **NO-GO**: qualquer falha crítica de segurança/progressão.
