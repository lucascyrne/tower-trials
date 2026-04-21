# RLS and Security Hardening Checklist

## Tabelas expostas

- Confirmar `ENABLE ROW LEVEL SECURITY` em todas as tabelas de `public` usadas pelo app.
- Confirmar políticas mínimas alinhadas ao modelo atual:
  - **Sessão autenticada** (`authenticated`): leitura/escrita apenas do próprio `auth.uid()` nas tabelas de progresso.
  - **Leitura de catálogo** (dados públicos do jogo: monstros, receitas, equipamentos base, etc.): políticas explícitas só onde o produto realmente permitir acesso sem login; caso contrário, negar por padrão.
- **Não** planejar políticas RLS dedicadas a `service_role`: o client privilegiado do Supabase ignora RLS; o controle é **grants** + uso **somente no servidor**.

O browser usa `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (chave publicável). Não manter variáveis nem runbooks centrados em “anon key” legada.

## Funções privilegiadas

- `SECURITY DEFINER` apenas quando necessário.
- `SET search_path` explícito nas funções privilegiadas.
- Validação de input/range em funções de progressão.
- Bloqueio de writes sensíveis fora das RPCs seguras.

## Grants/Revokes

- `REVOKE ALL ... FROM PUBLIC` em funções e objetos sensíveis.
- `GRANT EXECUTE` somente para roles necessárias (`authenticated` e, quando aplicável, escopo mínimo para operações internas).
- Remover grants amplos herdados de migrações antigas.

## Segredos e superfície de ataque

- `SUPABASE_SERVICE_ROLE_KEY` apenas server-side (client admin do Supabase, nunca em componente cliente).
- Nenhuma variável sensível em `NEXT_PUBLIC_*`.
- Nenhum client component importando boundary admin (`@/utils/supabase/admin`).

## Testes de segurança (obrigatórios)

- Usuário A não consegue ler/escrever dados de B.
- Updates diretos em tabelas sensíveis bloqueados por RLS.
- RPCs seguras rejeitam payload inválido e fonte não autorizada.
