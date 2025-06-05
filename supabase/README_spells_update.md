# 🧙‍♂️ Atualização do Sistema de Magias e Atributos

Este guia explica como executar corretamente os scripts para atualizar o sistema de magias com escalamento de atributos.

## 📋 Ordem de Execução

### 1. **clean_spells.sql** (EXECUTAR PRIMEIRO)
```sql
-- No SQL Editor do Supabase, execute:
```
- ✅ Remove todas as magias existentes
- ✅ Limpa associações de personagens (character_spell_slots)
- ✅ Reseta a sequência de IDs
- ✅ Verifica se a limpeza foi bem-sucedida

### 2. **spells.sql** (EXECUTAR SEGUNDO)
```sql
-- No SQL Editor do Supabase, execute:
```
- ✅ Insere 79 magias atualizadas
- ✅ Inclui novas magias para builds corpo-a-corpo
- ✅ Todas com descrições de escalamento completas
- ✅ Gera relatórios de verificação

## ⚠️ IMPORTANTE

### Backup Recomendado
Antes de executar os scripts, considere fazer backup:
```sql
-- Backup das magias atuais (opcional)
CREATE TABLE spells_backup AS SELECT * FROM spells;
CREATE TABLE character_spell_slots_backup AS SELECT * FROM character_spell_slots;
```

### Verificação Pós-Execução
Após executar ambos os scripts, verifique:
```sql
-- Verificar total de magias inseridas
SELECT COUNT(*) as total_magias FROM spells;

-- Verificar distribuição por tipo
SELECT effect_type, COUNT(*) FROM spells GROUP BY effect_type;

-- Verificar magias para builds físicas
SELECT name, description FROM spells 
WHERE description ILIKE '%força%' OR description ILIKE '%destreza%' OR description ILIKE '%vitalidade%'
ORDER BY unlocked_at_level;
```

## 🎯 O Que Foi Implementado

### Sistema de Escalamento
- **Dano Mágico**: Base + Int(+10%) + Wis(+5%) + Magic_Mastery(+15%)
- **Cura**: Base + Wis(+12%) + Magic_Mastery(+10%)
- **Crítico**: Luck(+0.5%) + Dex(+0.3%) + Weapon_Skill(+0.2%)
- **Dano Crítico**: 150% + Luck(+1%) + Str(+0.5%) + Weapon_Skill(+3%)

### Novas Magias por Build
- **🗡️ Guerreiros**: 16 magias focadas em Força/Vitalidade
- **🏃 Assassinos**: 12 magias focadas em Destreza/Sorte
- **🧙 Magos**: 25 magias focadas em Int/Sabedoria
- **🎯 Híbridas**: 26 magias que combinam atributos

### Distribuição por Nível
- **Early (1-15)**: 15 magias variadas
- **Mid (16-35)**: 21 magias especializadas
- **High (36-50)**: 43 magias supremas

## 🚀 Resultado Final
Todas as builds agora têm magias viáveis que escalam com seus atributos primários, criando diversidade real no sistema de progressão. 