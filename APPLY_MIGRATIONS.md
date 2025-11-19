# ⚡ Guia Rápido: Aplicar Migrações

## 🔴 Erro Que Você Está Recebendo

```
PGRST203: Could not choose the best candidate function between:
  - public.create_character(p_user_id => uuid, p_name => character varying)
  - public.create_character(p_user_id => uuid, p_name => text)
```

**Causa:** Duas versões conflitantes da mesma função no banco

---

## ✅ SOLUÇÃO: 3 Passos

### PASSO 1: Limpeza

1. Abra Supabase Dashboard
2. Vá para **SQL Editor**
3. **Copie TUDO** de: `scripts/sql/cleanup_duplicate_functions.sql`
4. **Cole** no editor
5. **Clique em "Run"**
6. Aguarde a mensagem de sucesso

### PASSO 2: Primeira Migração

1. **Copie TUDO** de: `scripts/sql/fix_character_progression_filters.sql`
2. **Cole** no editor (limpar o anterior)
3. **Clique em "Run"**
4. Aguarde a mensagem de sucesso

### PASSO 3: Segunda Migração (FINAL)

1. **Copie TUDO** de: `scripts/sql/fix_create_character_validation.sql` **(VERSÃO FINAL CORRIGIDA)**
2. **Cole** no editor (limpar o anterior)
3. **Clique em "Run"**
4. Aguarde a mensagem de sucesso

⚠️ **ATUALIZAÇÕES NO ARQUIVO:**

- Corrige `max_character_slots` → `available_slots`
- Remove inserção de `critical_chance` e `critical_damage` (colunas derivadas)
- Mantém apenas colunas reais da tabela

---

## 🚀 Pronto!

Agora teste:

1. Criar 3 personagens
2. Matar todos os 3
3. **Tentar criar novo** → Deve funcionar ✅ (Sem erros 300, 400 ou 42703)

---

## ⚠️ Importante

- **Não pule nenhum passo**
- **Ordem importa:** Limpeza → Progressão → Criação
- **Espere cada um terminar antes de ir para o próximo**
- Se der erro em limpeza, tudo bem, significa que já estava limpo

---

## 🐛 Se Ainda Houver Erro

1. Verificar em Supabase Dashboard → Logs
2. Procurar por "create_character"
3. Confirmar que apenas uma versão existe
4. Reexecutar o passo 3 da migração

---

## 📋 Checklist Final

- [ ] Passo 1 (Limpeza) executado
- [ ] Passo 2 (Progressão) executado
- [ ] Passo 3 (Criação) executado
- [ ] Frontend fazer deploy
- [ ] Testar criar personagem após matar tudo
- [ ] ✅ Funciona!
