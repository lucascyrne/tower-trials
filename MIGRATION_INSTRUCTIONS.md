# Aplicar Migrações do Ranking Dinâmico

## Opção 1: Via Supabase CLI (Recomendado)
```bash
# Aplicar migrações localmente primeiro
supabase db reset

# Aplicar no banco remoto
supabase db push
```

## Opção 2: Via SQL Direto
Execute o arquivo `scripts/apply-ranking-migrations.sql` diretamente no banco de dados remoto através do painel do Supabase.

## Verificação
Após aplicar as migrações, execute:
```sql
-- Verificar funções criadas
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name LIKE 'get_dynamic_%';

-- Verificar índices criados  
SELECT indexname FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_characters_ranking_%';
```

## Teste Rápido
```sql
-- Testar ranking dinâmico
SELECT * FROM get_dynamic_ranking_by_highest_floor(5, 'all');
SELECT * FROM get_dynamic_ranking_by_level(5, 'all');
SELECT * FROM get_dynamic_ranking_by_gold(5, 'all');
``` 