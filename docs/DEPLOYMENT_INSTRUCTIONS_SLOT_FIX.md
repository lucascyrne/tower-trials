# 📋 Instruções de Deploy: Correção de Ambiguidade de Slots

## 🎯 Objetivo

Aplicar as correções para o erro PostgreSQL 42702 (`column reference "slot_position" is ambiguous`) que estava impedindo o uso de slots de poção.

## 📦 Arquivos Modificados/Criados

### Novas Migrações SQL

- ✅ `supabase/migrations/00016_fix_slot_functions.sql` (atualizada)
- ✅ `supabase/migrations/00017_fix_use_potion_from_slot.sql` (criada)
- ✅ `supabase/migrations/00018_fix_spell_slots_ambiguity.sql` (criada)

### Documentação

- 📖 `MIGRATION_SLOT_AMBIGUITY_FIX.md` (detalhado)
- 📖 `SLOT_AMBIGUITY_FIX_SUMMARY.md` (resumo executivo)
- 🔧 `scripts/apply-slot-fixes.sh` (script de aplicação)

## 🚀 Procedimento de Deploy

### Fase 1: Ambiente Local

#### 1.1 Sincronizar com Repositório

```bash
git pull origin main  # ou sua branch
```

#### 1.2 Verificar Migrações

```bash
ls -la supabase/migrations/000{16,17,18}*

# Deve exibir:
# 00016_fix_slot_functions.sql
# 00017_fix_use_potion_from_slot.sql
# 00018_fix_spell_slots_ambiguity.sql
```

#### 1.3 Aplicar Migrações Localmente

```bash
cd C:\Projects\workspace\tower-trials

# Iniciar Supabase local (se estiver usando)
supabase start

# Aplicar migrações
supabase migration up

# Ou via script
chmod +x scripts/apply-slot-fixes.sh
./scripts/apply-slot-fixes.sh
```

### Fase 2: Banco de Dados Remoto (Produção)

#### 2.1 Fazer Push das Migrações

```bash
supabase db push --linked
```

**Importante:** Deve informar qual projeto remoto está linkado:

```bash
supabase projects list
supabase link --project-ref SEU_PROJECT_ID
```

#### 2.2 Verificar Status

```bash
supabase migration list --linked
```

Deve exibir as 3 migrações com status de sucesso.

### Fase 3: Testes

#### 3.1 Teste Local

```sql
-- No DBeaver, execute:
SELECT * FROM get_character_potion_slots('um-uuid-de-caractere-valido');

-- Deve retornar 3 linhas com slots vazios
```

#### 3.2 Teste Remoto (via Supabase Dashboard)

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard)
2. Navegar até seu projeto
3. SQL Editor
4. Executar teste acima com um UUID válido

#### 3.3 Teste em Produção (Frontend)

1. Fazer login no jogo
2. Selecionar um personagem
3. Ir para a tela de batalha
4. Verificar se os slots de poção aparecem sem erro 400

## ⚠️ Pontos de Atenção

### 1. Mudança de Contrato de API

As seguintes funções mudaram seu tipo de retorno:

```typescript
// ANTES
set_potion_slot() => VOID
clear_potion_slot() => VOID
set_spell_slot() => VOID

// DEPOIS
set_potion_slot() => TABLE(success BOOLEAN, error TEXT, message TEXT)
clear_potion_slot() => TABLE(success BOOLEAN, error TEXT, message TEXT)
set_spell_slot() => TABLE(success BOOLEAN, error TEXT, message TEXT)
```

**Status:** ✅ O código do frontend (`slot.service.ts`) já está preparado para isso!

### 2. Reversão de Mudanças (Se Necessário)

Se algo der errado, você pode reverter para a versão anterior:

```bash
# Reverter última migração
supabase migration down

# Ou resetar completamente
supabase db reset  # ⚠️ CUIDADO: Apaga todos os dados!
```

### 3. Validação de Dados

Nenhuma migração modifica dados existentes, apenas corrige as funções SQL.

## 📊 Checklist de Deploy

- [ ] Todas as 3 migrações estão presentes em `supabase/migrations/`
- [ ] Ambiente local testado com sucesso
- [ ] Banco remoto linkado corretamente
- [ ] Migrações fizeram push sem erros
- [ ] Teste de RPC executado com sucesso
- [ ] Frontend testado e funcionando
- [ ] Documentação revisada

## 🆘 Troubleshooting

### Erro: "Cannot find migration files"

```bash
# Certifique-se de estar no diretório correto
pwd
# Deve exibir: C:\Projects\workspace\tower-trials

# Verifique se os arquivos existem
test -f supabase/migrations/00016_fix_slot_functions.sql && echo "✅ Migração 16 existe"
test -f supabase/migrations/00017_fix_use_potion_from_slot.sql && echo "✅ Migração 17 existe"
test -f supabase/migrations/00018_fix_spell_slots_ambiguity.sql && echo "✅ Migração 18 existe"
```

### Erro: "Project not linked"

```bash
# Listar projetos disponíveis
supabase projects list

# Fazer link com seu projeto
supabase link --project-ref SEU_PROJECT_REF
```

### Erro: "42702 column reference is ambiguous" ainda aparece

1. Verifique se a migração 00016 foi realmente aplicada
2. Reinicie a conexão do Supabase
3. Limpe o cache do navegador (F12 > Application > Clear Site Data)

### Poções não funcionam após deploy

1. Verifique o console do navegador (F12) para erros
2. Verifique os logs do Supabase
3. Confirme que `slot.service.ts` está tratando a nova resposta corretamente

## 📞 Suporte

Para mais detalhes técnicos, consulte:

- `MIGRATION_SLOT_AMBIGUITY_FIX.md` - Documentação técnica completa
- `SLOT_AMBIGUITY_FIX_SUMMARY.md` - Resumo executivo
- `src/services/slot.service.ts` - Código do serviço de slots

## ✅ Conclusão

Após completar este procedimento:

✨ O erro PostgreSQL 42702 será completamente eliminado  
✨ Os slots de poção e magia funcionarão normalmente  
✨ O tratamento de erros será mais robusto  
✨ A manutenção futura será mais fácil

---

**Data:** 2025-10-29  
**Versão:** 1.0  
**Status:** Pronto para Deploy
