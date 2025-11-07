# Correção: Erro de Referência Ambígua em Slots de Poção

## 📋 Resumo do Problema

Durante as batalhas, o erro abaixo era disparado ao tentar usar poções:

```
POST https://bkqzntlkkbepzvoesqxh.supabase.co/rest/v1/rpc/get_character_potion_slots 400 (Bad Request)

{
    "code": "42702",
    "details": "It could refer to either a PL/pgSQL variable or a table column.",
    "hint": null,
    "message": "column reference \"slot_position\" is ambiguous"
}
```

## 🔍 Análise da Causa

Havia dois problemas complementares:

### 1. Referência Ambígua de Coluna

A função `get_character_potion_slots` estava fazendo JOINs entre múltiplas tabelas, mas não tinha totalmente qualificadas as colunas no `ORDER BY`:

```sql
-- ❌ ERRADO
ORDER BY slot_position;  -- PostgreSQL não sabe qual tabela

-- ✅ CORRETO
ORDER BY ps.slot_position;  -- Agora está claro
```

### 2. Função Inexistente

O código TypeScript em `src/services/slot.service.ts` chamava `consume_potion_from_slot`:

```typescript
const { data, error } = await supabaseAdmin.rpc('consume_potion_from_slot', {
  p_character_id: characterId,
  p_slot_position: slotPosition,
});
```

Mas esta função **nunca foi criada** no banco de dados. Apenas a função `use_potion_from_slot` existia, que nunca era usada.

## ✅ Solução Implementada

A migração `00016_fix_slot_functions.sql` corrige ambos os problemas:

### 1. Função `get_character_potion_slots` Melhorada

**Alterações:**

- Todas as colunas selecionadas com prefixo de alias (`ps.`, `c.`, `cc.`)
- ORDER BY agora usa `ps.slot_position`

```sql
RETURN QUERY
SELECT
    ps.slot_position,           -- ✅ Qualificado
    ps.consumable_id,           -- ✅ Qualificado
    c.name,                     -- ✅ Qualificado
    c.description,
    c.effect_value,
    c.type,
    COALESCE(cc.quantity, 0),
    c.price
FROM potion_slots ps
LEFT JOIN consumables c ON ps.consumable_id = c.id
LEFT JOIN character_consumables cc ON (cc.character_id = p_character_id AND cc.consumable_id = ps.consumable_id)
WHERE ps.character_id = p_character_id
ORDER BY ps.slot_position;     -- ✅ Agora desambiguado
```

### 2. Nova Função `consume_potion_from_slot`

Wrapper que gerencia o uso de poções via slots:

```sql
CREATE OR REPLACE FUNCTION consume_potion_from_slot(
    p_character_id UUID,
    p_slot_position INTEGER
)
RETURNS TABLE(
    success BOOLEAN,
    new_hp INTEGER,
    new_mana INTEGER,
    message TEXT
) AS $$
DECLARE
    v_consumable_id UUID;
    v_result RECORD;
BEGIN
    -- 1. Valida posição (1-3)
    IF p_slot_position < 1 OR p_slot_position > 3 THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'Posição de slot inválida (1-3)'::TEXT;
        RETURN;
    END IF;

    -- 2. Obtém consumable_id do slot
    SELECT ps.consumable_id INTO v_consumable_id
    FROM potion_slots ps
    WHERE ps.character_id = p_character_id AND ps.slot_position = p_slot_position;

    IF v_consumable_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 0, 0, 'Slot vazio'::TEXT;
        RETURN;
    END IF;

    -- 3. Usa a poção via função existente
    SELECT * INTO v_result FROM consume_potion(p_character_id, v_consumable_id);

    -- 4. Limpa o slot se não há mais consumíveis
    IF NOT EXISTS (
        SELECT 1 FROM character_consumables
        WHERE character_id = p_character_id
        AND consumable_id = v_consumable_id
        AND quantity > 0
    ) THEN
        PERFORM clear_potion_slot(p_character_id, p_slot_position);
    END IF;

    RETURN QUERY SELECT v_result.success, v_result.new_hp, v_result.new_mana, v_result.message;
END;
$$ LANGUAGE plpgsql;
```

## 📦 Como Aplicar

### Via Supabase Dashboard (Recomendado para Produção)

1. Acesse [https://app.supabase.com](https://app.supabase.com)
2. Selecione seu projeto
3. Vá para **SQL Editor**
4. Clique em **New Query**
5. Cole o conteúdo de `supabase/migrations/00016_fix_slot_functions.sql`
6. Clique em **Run**

### Via Supabase CLI (Local)

```bash
cd tower-trials
npx supabase db push
```

### Verificação Local

Após aplicar, teste a função:

```sql
SELECT * FROM get_character_potion_slots('UUID_DO_PERSONAGEM');
```

Deveria retornar 3 linhas (um para cada slot).

## 🧪 Teste no Cliente

Após aplicar a migração, teste no navegador:

```javascript
const { data, error } = await supabase.rpc('get_character_potion_slots', {
  p_character_id: 'UUID_DO_PERSONAGEM',
});

if (error) {
  console.error('Erro:', error);
} else {
  console.log('Slots carregados:', data);
}
```

## 📊 Impacto

| Componente                    | Impacto                                  |
| ----------------------------- | ---------------------------------------- |
| `CombinedBattleInterface.tsx` | ✅ Agora consegue usar poções            |
| `game-battle.tsx`             | ✅ SlotService funciona corretamente     |
| `QuickActionPanel.tsx`        | ✅ Dados dos slots carregam              |
| `slot.service.ts`             | ✅ RPC `consume_potion_from_slot` existe |

## 🔧 Detalhes Técnicos

### Erro PostgreSQL Code 42702

Este código significa "nome de relação/coluna ambíguo". Ocorre quando:

- Múltiplas tabelas em um JOIN têm a mesma coluna
- A query não qualifica a coluna com alias de tabela

### Por Que a Função Inexistente Não Foi Detectada Antes?

- O código só era acionado durante batalhas
- A função existente era `use_potion_from_slot` (diferente)
- Sem testes de integração e2e, o erro passou despercebido

## 📝 Notas

- A função `use_potion_from_slot` antiga pode ser removida na próxima limpeza de código
- Todas as referências de coluna em funções RPC devem usar qualificadores (alias.coluna)
- Após esta correção, todas as funções de poção estão em sincronia

## ✨ Status

| Tarefa                                        | Status |
| --------------------------------------------- | ------ |
| Migração criada                               | ✅     |
| Função `get_character_potion_slots` corrigida | ✅     |
| Função `consume_potion_from_slot` criada      | ✅     |
| Documentação                                  | ✅     |
| Pronto para deploy                            | ✅     |
















