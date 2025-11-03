# Correção: Erro "Ambiguous Column Reference" em Slots de Poção

## Problema

```
POST https://bkqzntlkkbepzvoesqxh.supabase.co/rest/v1/rpc/get_character_potion_slots 400 (Bad Request)
column reference "slot_position" is ambiguous
```

## Causa Raiz

A função RPC `get_character_potion_slots` estava incompleta/faltando e a função `consume_potion_from_slot` não existia.

## Solução

Uma nova migração `00016_fix_slot_functions.sql` foi criada com:

1. **Função `get_character_potion_slots` corrigida**: Todas as colunas estão sendo selecionadas com prefixo de alias de tabela (ps., c., cc.)

2. **Nova função `consume_potion_from_slot`**: Wrapper que:
   - Valida a posição do slot (1-3)
   - Obtém o consumable_id do slot
   - Chama a função `consume_potion` existente
   - Limpa o slot automaticamente se não há mais consumíveis

## Como Aplicar

### Opção 1: Via Supabase CLI

```bash
cd tower-trials
npx supabase db push
```

### Opção 2: Via Supabase Dashboard

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Vá para SQL Editor
3. Cole o conteúdo de `supabase/migrations/00016_fix_slot_functions.sql`
4. Execute

### Opção 3: Via Script Shell (Local)

```bash
psql -h localhost -U postgres -d postgres -f supabase/migrations/00016_fix_slot_functions.sql
```

## Verificação

Após aplicar a migração, teste no console do navegador:

```javascript
const { data, error } = await supabase.rpc('get_character_potion_slots', {
  p_character_id: 'UUID_DO_PERSONAGEM',
});
console.log(data, error);
```

Se retornar os slots sem erro, a correção foi bem-sucedida!

