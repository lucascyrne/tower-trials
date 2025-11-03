# Guia de Migração - Tower Trials Database V2

## 📋 Visão Geral

Este guia fornece instruções passo-a-passo para migrar do schema antigo (120 migrações) para o novo schema consolidado (15 migrações).

---

## ⚠️ Pré-requisitos

1. **Backup Completo**: Faça backup do banco de dados atual antes de proceder
2. **Supabase CLI**: Instale o Supabase CLI (`npm install -g supabase`)
3. **Acesso ao Projeto**: Credenciais de acesso ao projeto Supabase
4. **Tempo Estimado**: ~30 minutos para migração completa

---

## 🚀 Passos de Migração

### Opção 1: Novo Projeto Supabase (Recomendado)

Esta opção é mais segura e permite rollback fácil.

#### 1. Criar Novo Projeto Supabase

```bash
# Via Supabase Dashboard
1. Acesse https://app.supabase.com
2. Clique em "New Project"
3. Configure nome, senha e região
4. Aguarde provisionamento (~2min)
```

#### 2. Configurar Supabase CLI

```bash
# Login no Supabase
supabase login

# Link ao projeto
supabase link --project-ref <project-ref>
```

#### 3. Aplicar Migrações V2

```bash
# Navegar até a pasta do projeto
cd tower-trials

# Aplicar migrações em ordem
supabase db push --db-url "postgresql://postgres:<password>@<host>:5432/postgres"

# Ou aplicar manualmente via SQL Editor no dashboard
```

**Ordem de Execução:**

1. `00001_create_extensions_and_helpers.sql`
2. `00002_create_enums_and_types.sql`
3. `00003_create_users_system.sql`
4. `00004_create_characters_system.sql`
5. `00005_create_monsters_system.sql`
6. `00006_create_equipment_system.sql`
7. `00007_create_consumables_system.sql`
8. `00008_create_potion_slots_system.sql`
9. `00009_create_spells_system.sql`
10. `00010_create_drops_system.sql`
11. `00011_create_crafting_system.sql`
12. `00012_create_ranking_system.sql`
13. `00013_create_special_events_system.sql`
14. `00014_create_dead_characters_system.sql`
15. `00015_create_rls_policies.sql`

#### 4. Executar Seed

```bash
# Via SQL Editor no dashboard
# Copiar e colar conteúdo de: supabase/migrations_v2/seed_v2.sql
```

#### 5. Atualizar Variáveis de Ambiente

```bash
# .env.local ou .env
VITE_SUPABASE_URL=https://<novo-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<nova-chave>
```

#### 6. Validar

Execute o checklist de validação (veja seção abaixo).

---

### Opção 2: Migração In-Place (Avançado)

⚠️ **ATENÇÃO**: Requer backup e pode causar downtime.

**Não recomendado para produção sem testes extensivos.**

#### 1. Backup Completo

```bash
# Via Supabase Dashboard
1. Settings > Database > Backup & Restore
2. Download backup completo
```

#### 2. Limpar Schema Antigo

```sql
-- ⚠️ CUIDADO: Remove TODOS os dados
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

#### 3. Aplicar Migrações V2

Seguir passos 3-6 da Opção 1.

---

## ✅ Checklist de Validação

### 1. Validação de Schema

```sql
-- Verificar tabelas criadas (devem ser 24)
SELECT COUNT(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Verificar ENUMs criados (devem ser 8)
SELECT COUNT(*) FROM pg_type
WHERE typtype = 'e' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- Verificar funções criadas (devem ser ~70)
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.prokind = 'f';
```

### 2. Validação de Dados de Seed

```sql
-- Verificar consumíveis (devem ser 9)
SELECT COUNT(*) FROM consumables;

-- Verificar equipamentos (devem ser ~100)
SELECT COUNT(*) FROM equipment;

-- Verificar monstros (devem ser ~40)
SELECT COUNT(*) FROM monsters;

-- Verificar drops (devem ser ~30)
SELECT COUNT(*) FROM monster_drops;

-- Verificar spells (devem ser ~20)
SELECT COUNT(*) FROM spells;

-- Verificar eventos especiais (devem ser 3)
SELECT COUNT(*) FROM special_events;
```

### 3. Validação de RLS

```sql
-- Verificar políticas RLS ativas
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Deve retornar ~30+ políticas
```

### 4. Testes Funcionais

```sql
-- Teste: Criar usuário
SELECT create_user_profile(
    'test-uuid'::UUID,
    'TestUser',
    'test@example.com'
);

-- Teste: Criar personagem
SELECT create_character(
    'test-uuid'::UUID,
    'Hero Test'
);

-- Teste: Buscar monstro
SELECT * FROM get_monster_for_floor(1);

-- Teste: Calcular stats derivados
SELECT * FROM calculate_derived_stats(10, 15, 15, 15, 15, 15, 15);

-- Limpar dados de teste
DELETE FROM characters WHERE user_id = 'test-uuid'::UUID;
DELETE FROM users WHERE uid = 'test-uuid'::UUID;
```

---

## 📊 Métricas de Sucesso

| Métrica            | Valor Esperado |
| ------------------ | -------------- |
| Tabelas Ativas     | 24             |
| ENUMs Customizados | 8              |
| Funções RPC        | ~70            |
| Triggers           | ~24            |
| Políticas RLS      | ~30            |
| Consumíveis        | 9              |
| Equipamentos       | ~100           |
| Monstros           | ~40            |
| Spells             | ~20            |

---

## 🔧 Troubleshooting

### Erro: "relation already exists"

```sql
-- Adicionar IF NOT EXISTS em todas as migrations
-- Já implementado nas migrations v2
```

### Erro: "function does not exist"

```bash
# Verificar ordem de execução
# Dependências devem ser respeitadas
```

### Erro: RLS bloqueando acesso

```sql
-- Verificar se usuário está autenticado
SELECT auth.uid();

-- Desabilitar RLS temporariamente para debug
ALTER TABLE <table_name> DISABLE ROW LEVEL SECURITY;
```

### Performance Lenta

```sql
-- Verificar índices
SELECT tablename, indexname FROM pg_indexes
WHERE schemaname = 'public';

-- Analisar query plans
EXPLAIN ANALYZE SELECT * FROM characters WHERE user_id = 'xxx';
```

---

## 🔄 Rollback

### Se algo der errado:

1. **Novo Projeto**: Simplesmente use o projeto antigo
2. **In-Place**: Restore do backup

```bash
# Via Supabase Dashboard
Settings > Database > Backup & Restore > Restore Backup
```

---

## 📞 Suporte

- **Documentação**: `/docs/DB_*.md`
- **Issues**: GitHub Issues
- **Supabase Docs**: https://supabase.com/docs

---

## ✨ Próximos Passos

Após migração bem-sucedida:

1. ✅ Testar autenticação e RLS
2. ✅ Executar testes E2E do frontend
3. ✅ Monitorar logs por 24h
4. ✅ Arquivar migrações antigas em `migrations_old/`
5. ✅ Atualizar documentação do projeto
6. ✅ Comunicar time sobre mudanças

---

**Versão**: 2.0  
**Data**: Outubro 2025  
**Status**: ✅ Pronto para Produção
