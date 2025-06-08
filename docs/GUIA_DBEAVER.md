# 🗃️ Conectando DBeaver ao Supabase Local - Tower Trials

## 🎯 Visão Geral

Este guia mostra como conectar o DBeaver ao banco PostgreSQL local do Supabase para facilitar o desenvolvimento e debugging.

## 🚀 Pré-requisitos

1. **DBeaver instalado** (Community Edition é suficiente)
2. **Supabase local rodando**: `npm run db:start`
3. **Ambiente LOCAL configurado**: `npm run env:local`

## 🔧 Configuração Passo a Passo

### **1. Verificar se Supabase está Rodando**

```bash
# Verificar status
npm run db:status

# Se não estiver rodando:
npm run db:start
```

### **2. Obter Informações de Conexão**

```bash
# Ver todas as configurações locais
supabase status
```

**Saída esperada:**
```
supabase local development setup is running.

         API URL: http://127.0.0.1:54321
     GraphQL URL: http://127.0.0.1:54321/graphql/v1
  S3 Storage URL: http://127.0.0.1:54321/storage/v1/s3
          DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
      Studio URL: http://127.0.0.1:54323
    Inbucket URL: http://127.0.0.1:54324
      JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
        anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   S3 Access Key: 625729a08b95bf1b7ff351a663f3a23c
   S3 Secret Key: 850181e4652dd023b7a98c58ae0d2d34bd487ee0cc3254aed6eda37307425907
       S3 Region: local
```

### **3. Configurar Nova Conexão no DBeaver**

#### **Passo 1: Criar Nova Conexão**
1. Abrir DBeaver
2. Clicar em **"Nova Conexão"** (ícone de plug)
3. Selecionar **PostgreSQL**
4. Clicar **"Próximo"**

#### **Passo 2: Configurar Parâmetros**

**Aba "Main":**
```
Server Host: 127.0.0.1
Port: 54322
Database: postgres
Username: postgres
Password: postgres
```

**Aba "PostgreSQL":**
```
Show template databases: ✅ (marcado)
Show databases metadata: ✅ (marcado)
```

#### **Passo 3: Configurações Avançadas**

**Aba "Connection settings":**
```
Connection name: Tower Trials - Local Supabase
Connection folder: Supabase
```

**Aba "Driver properties":**
```
ssl: false
sslmode: disable
```

### **4. Testar Conexão**

1. Clicar em **"Test Connection"**
2. Se aparecer erro de SSL, ir para **Driver Properties** e definir:
   - `ssl = false`
   - `sslmode = disable`
3. Clicar **"OK"** para salvar

## 📊 Explorando o Banco

### **Schemas Importantes**

```sql
-- Schema principal (tabelas do jogo)
public.*

-- Schema de autenticação do Supabase
auth.*

-- Schema de armazenamento
storage.*

-- Schema de real-time
realtime.*
```

### **Tabelas Principais do Jogo**

```sql
-- Usuários e personagens
SELECT * FROM characters LIMIT 10;

-- Sessões de jogo
SELECT * FROM game_sessions LIMIT 10;

-- Histórico de batalhas
SELECT * FROM battle_logs LIMIT 10;
```

### **Queries Úteis para Desenvolvimento**

```sql
-- Ver todos os personagens com suas defesas
SELECT 
    id,
    name,
    level,
    defense_cooldown,
    is_defending,
    hp,
    max_hp
FROM characters;

-- Verificar sessões ativas
SELECT 
    id,
    character_id,
    current_floor,
    is_active,
    created_at
FROM game_sessions 
WHERE is_active = true;

-- Histórico de ações de defesa
SELECT 
    gs.id,
    c.name as character_name,
    gs.current_floor,
    gs.last_action,
    gs.updated_at
FROM game_sessions gs
JOIN characters c ON gs.character_id = c.id
WHERE gs.last_action = 'defend'
ORDER BY gs.updated_at DESC;
```

## 🛠️ Funcionalidades Úteis

### **1. Debugging de Dados**

```sql
-- Verificar estado da defesa
SELECT name, defense_cooldown, is_defending 
FROM characters 
WHERE user_id = 'SEU_USER_ID';

-- Simular cooldown
UPDATE characters 
SET defense_cooldown = 0 
WHERE id = 'SEU_CHARACTER_ID';
```

### **2. Criar Dados de Teste**

```sql
-- Criar personagem para testes
INSERT INTO characters (
    user_id, name, level, hp, max_hp, 
    atk, def, speed, defense_cooldown, is_defending
) VALUES (
    'SEU_USER_ID', 'Teste Defense', 10, 100, 100,
    25, 15, 12, 0, false
);
```

### **3. Verificar Migrações**

```sql
-- Ver histórico de migrações aplicadas
SELECT * FROM supabase_migrations.schema_migrations;

-- Ver estrutura da tabela characters
\d characters
```

## ⚡ Scripts Rápidos

### **Reset de Cooldowns**
```sql
UPDATE characters SET defense_cooldown = 0, is_defending = false;
```

### **Ver Estatísticas do Jogo**
```sql
SELECT 
    COUNT(*) as total_characters,
    AVG(level) as avg_level,
    MAX(floor) as highest_floor,
    COUNT(CASE WHEN is_defending THEN 1 END) as defending_now
FROM characters;
```

### **Logs de Erro**
```sql
-- Se você tiver tabela de logs
SELECT * FROM logs 
WHERE level = 'ERROR' 
ORDER BY created_at DESC 
LIMIT 20;
```

## 🔄 Workflow de Desenvolvimento

### **1. Desenvolvimento com DBeaver**
```bash
# 1. Iniciar ambiente local
npm run local

# 2. Conectar DBeaver
# 3. Fazer mudanças/testes no banco
# 4. Criar migrações baseadas nas mudanças
# 5. Aplicar migrações
npm run migrate:local
```

### **2. Sincronização com Código**

Sempre que fizer mudanças manuais no DBeaver:

1. **Documente a mudança** em uma migração
2. **Teste a migração** em ambiente limpo
3. **Aplique no DEV** quando estiver pronto

## ⚠️ Cuidados Importantes

### **❌ NÃO Faça no DBeaver**
- Mudanças diretas em produção
- Alterações de schema sem migração correspondente
- Delete em massa sem backup

### **✅ Use DBeaver Para**
- Debugging de dados
- Análise de performance
- Verificação de integridade
- Prototipagem de queries
- Inspeção de estruturas

## 🔍 Troubleshooting

### **Erro: "Connection refused"**
```bash
# Verificar se Supabase está rodando
npm run db:status

# Se não estiver:
npm run db:start
```

### **Erro: "SSL connection"**
- Vá para **Driver Properties**
- Defina `ssl = false`
- Defina `sslmode = disable`

### **Erro: "Authentication failed"**
- Confirme usuário: `postgres`
- Confirme senha: `postgres`
- Confirme porta: `54322`

### **Tabelas não aparecem**
- Verifique se está no schema `public`
- Marque "Show template databases"
- Refresh da conexão (F5)

## 🎯 Benefícios

✅ **Debugging visual** de dados  
✅ **Queries complexas** com facilidade  
✅ **Análise de performance** de consultas  
✅ **Backup/restore** manual quando necessário  
✅ **Exploração** da estrutura do banco  
✅ **Prototipagem** de novas features  

Agora você tem acesso completo ao banco local para desenvolvimento! 🎉 