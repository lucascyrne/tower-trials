# Checklist Pos-Baseline

## Integridade de schema

- [ ] Todas as tabelas criticas existem com constraints finais.
- [ ] Indices essenciais criados.
- [ ] Funcoes RPC criticas compilam sem erro.

## Seguranca

- [ ] RLS habilitado em tabelas expostas.
- [ ] Policies minimas para `authenticated` (e leitura de catálogo só onde o produto exigir); sem dependência de políticas “para service_role”.
- [ ] `PUBLIC` sem grants indevidos em objetos sensiveis.
- [ ] Funcoes `SECURITY DEFINER` com `search_path` fixo.

## Funcional

- [ ] Autenticacao e refresh de sessao no SSR funcionando.
- [ ] Fluxo de batalha, XP e level-up validado.
- [ ] Distribuicao de atributos consistente (2 por nivel + bonus em multiplos de 5).

## Go-live

- [ ] Sem bloqueadores de seguranca.
- [ ] Sem regressao funcional critica.
- [ ] Snapshot/rollback documentado e testado.
