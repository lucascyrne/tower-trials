# Guia: zerar o banco e aplicar migrações novas

Documento relacionado (seeds e checks): [`reset-and-seed-runbook.md`](reset-and-seed-runbook.md).

## O que o reset faz

O comando **`supabase db reset`** (local ou `--linked`) **apaga o schema público aplicável**, **reexecuta todas as migrações** em `supabase/migrations/` em ordem e, em seguida, executa o seed configurado no `supabase/config.toml` (normalmente `supabase/seed.sql`). Não é necessário apagar tabelas à mão.

## Pré-requisitos

- [Supabase CLI](https://supabase.com/docs/guides/cli) instalada (`npx supabase --version`).
- Na raiz do repositório (`tower-trials-next`).
- **Projeto local**: Docker em execução se usar `supabase start`.
- **Projeto ligado ao cloud**: `supabase link` já feito com o ref do projeto.

## Passo a passo — ambiente local

1. Iniciar stack local (se ainda não estiver rodando):
   ```bash
   npx supabase start
   ```
2. Reset completo + migrações:
   ```bash
   npx supabase db reset
   ```
   Ou, equivalente ao script do repo (Git Bash / WSL):
   ```bash
   ./scripts/reset-db.sh local --confirm
   ```
3. Aplicar seeds extras na ordem indicada em [`reset-and-seed-runbook.md`](reset-and-seed-runbook.md) (SQL Editor ou CLI `psql`), se o `config.toml` não cobrir tudo.
4. (Opcional) Rodar `supabase/baseline/post_seed_integrity_checks.sql` e `post_bootstrap_smoke.sql`.

## Passo a passo — projeto remoto (linked)

1. Confirmar link: `npx supabase projects list` / variáveis do projeto.
2. **Cuidado:** isto destrói dados no projeto ligado.
   ```bash
   npx supabase db reset --linked
   ```
   Ou: `./scripts/reset-db.sh linked --confirm`
3. Mesma sequência de seeds e checks do runbook.

## Windows (PowerShell)

O script `reset-db.sh` precisa de **Git Bash** ou **WSL**. Em PowerShell puro, use diretamente:

```powershell
npx supabase db reset
# ou remoto:
npx supabase db reset --linked
```

## Depois do reset

- Subir a app apontando para a URL/chave do ambiente que você resetou.
- Se algo falhar na aplicação das migrações, o CLI mostra o erro no ficheiro SQL correspondente; corrija a migração e volte a correr `db reset`.
