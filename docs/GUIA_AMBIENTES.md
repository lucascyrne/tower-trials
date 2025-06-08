# 🏗️ Guia de Ambientes de Desenvolvimento - Tower Trials

## 📖 Visão Geral

Este projeto agora suporta 3 ambientes distintos para desenvolvimento e produção:

- **🐳 LOCAL**: Banco Supabase local via Docker (desenvolvimento isolado)
- **🌐 DEV**: Banco Supabase remoto para desenvolvimento/testes
- **🚀 PROD**: Banco Supabase remoto para produção

## 🎯 Objetivos Alcançados

✅ **Separação completa** entre ambientes LOCAL/DEV/PROD  
✅ **Preservação de dados** de usuários durante desenvolvimento  
✅ **Banco local** para desenvolvimento sem riscos  
✅ **Configuração automática** via scripts  
✅ **Interface visual** para identificar ambiente ativo  
✅ **Compatibilidade** com Git Bash e sistemas Unix

## 🚀 Como Usar

### **Opção 1: Desenvolvimento Local (Recomendado)**
```bash
# Configurar ambiente e iniciar tudo de uma vez
npm run local

# Ou passo a passo:
npm run env:local    # Configura .env para LOCAL
npm run db:start     # Inicia Supabase via Docker
npm run dev          # Inicia a aplicação
```

### **Opção 2: Desenvolvimento Remoto**
```bash
# Usar banco remoto (quando necessário)
npm run dev-remote

# Ou passo a passo:
npm run env:dev      # Configura .env para DEV (remoto)
npm run dev          # Inicia a aplicação
```

## 🔧 Scripts Disponíveis

### **Gerenciamento de Ambiente**
```bash
npm run env:local    # Configura para ambiente LOCAL (Docker)
npm run env:dev      # Configura para ambiente DEV (remoto)
```

### **Banco de Dados Local**
```bash
npm run db:start     # Inicia Supabase local
npm run db:stop      # Para Supabase local
npm run db:reset     # Reseta banco local (sem afetar remoto!)
npm run db:push      # Aplica migrações ao banco local
npm run db:status    # Mostra status dos serviços
npm run db:config    # Mostra configurações para DBeaver
npm run db:fix       # Diagnóstica e resolve problemas de porta
npm run db:fix-force # Força resolução de conflitos de porta
```

### **Migrações Seguras**
```bash
npm run migrate:local # Aplica migrações no ambiente LOCAL
npm run migrate:dev   # Aplica migrações no ambiente DEV (com confirmação)
```

### **Workflows Completos**
```bash
npm run local        # LOCAL: env + db + dev
npm run dev-remote   # DEV: env + dev (remoto)
```

## 📁 Estrutura de Configuração

### **Ambientes**
```
🐳 LOCAL (Docker)     → http://127.0.0.1:54321
🌐 DEV (Remoto)       → https://rpagdztnwtyjatslrjay.supabase.co
🚀 PROD (Remoto)      → https://rpagdztnwtyjatslrjay.supabase.co
```

### **Arquivos de Configuração**
```
├── .env                     # Configuração ativa
├── .env.backup.YYYYMMDD     # Backups automáticos
├── scripts/
│   ├── setup-local-env.sh   # Script para LOCAL
│   ├── setup-dev-env.sh     # Script para DEV
│   ├── apply-migrations.sh  # Aplicar migrações seguras
│   ├── fix-docker-ports.sh  # Resolver problemas de porta
│   ├── get-db-config.sh     # Mostrar configurações do banco
│   └── reset-db.sh          # Reset seguro do banco remoto
└── src/
    ├── config/env.ts        # Configuração tipada de ambiente
    ├── lib/supabase.ts      # Cliente inteligente do Supabase
    └── components/core/EnvironmentIndicator.tsx
```

## 🔄 Workflow Recomendado

### **Desenvolvimento Diário**
1. **Use ambiente LOCAL** para desenvolvimento normal
2. **Banco local** para testes e experimentos
3. **Dados preservados** no ambiente remoto

### **Testes de Integração**
1. **Use ambiente DEV** quando necessário testar com dados reais
2. **Evite operações destrutivas** no ambiente DEV

### **Deploy/Produção**
1. **Ambiente PROD** é automaticamente usado em produção
2. **Dados de usuários** sempre preservados

## 🎨 Interface Visual

### **Indicador de Ambiente**
- **🐳 LOCAL**: Badge azul no canto superior direito
- **🌐 DEV**: Badge amarelo no canto superior direito
- **🚀 PROD**: Sem badge (produção)

### **Console Logs**
Em ambientes não-produção, o console mostra:
```
🏗️ Supabase conectado ao ambiente: LOCAL
📡 URL: http://127.0.0.1:54321
```

## ⚠️ Cuidados Importantes

### **❌ NÃO FAÇA**
- `supabase db reset --linked` (apaga dados remotos!)
- Rodar comandos destrutivos em ambiente DEV sem necessidade
- Alterar dados de produção manualmente

### **✅ FAÇA**
- Use `npm run db:reset` apenas em LOCAL
- Mantenha migrações versionadas
- Teste localmente antes de aplicar mudanças

## 🐛 Solução de Problemas

### **Problema: Supabase local não inicia**
```bash
npm run db:stop
npm run db:start
```

### **Problema: Portas ocupadas**
```bash
npm run db:fix        # Diagnóstico
npm run db:fix-force  # Força liberação de portas
```

### **Problema: Ambiente incorreto**
```bash
npm run env:local  # ou env:dev
# Reinicie a aplicação
```

### **Problema: Dados corrompidos localmente**
```bash
npm run db:reset  # Seguro - apenas dados locais
```

### **Problema: Erro de conexão**
1. Verifique o arquivo `.env`
2. Confirme que o Supabase local está rodando (`npm run db:status`)
3. Verifique as portas (54321 para API, 54323 para Studio)

## 🛠️ Compatibilidade

### **Sistemas Suportados**
- ✅ **Windows** (Git Bash, WSL, PowerShell)
- ✅ **macOS** (Terminal, zsh, bash)
- ✅ **Linux** (bash, zsh, sh)

### **Dependências**
- Node.js e npm
- Docker Desktop
- Supabase CLI
- Git Bash (recomendado no Windows)

## 📋 Checklist de Desenvolvimento

### **Antes de Começar**
- [ ] Definir ambiente (LOCAL ou DEV)
- [ ] Executar script de configuração
- [ ] Verificar indicador visual
- [ ] Confirmar conexão com banco

### **Durante Desenvolvimento**
- [ ] Usar ambiente LOCAL para mudanças experimentais
- [ ] Aplicar migrações primeiro localmente
- [ ] Testar funcionalidades completamente

### **Antes de Commit**
- [ ] Testar em ambiente DEV se necessário
- [ ] Verificar se migrações estão corretas
- [ ] Confirmar que não há dados hardcoded

Este sistema garante que você nunca mais perca dados de usuários durante o desenvolvimento! 🎉 