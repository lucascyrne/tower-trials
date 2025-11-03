# Índice Visual da Documentação de Arquitetura

```
📁 Tower Trials - Documentação Técnica
│
├── 🏠 README_ARCHITECTURE.md ← COMECE AQUI
│   ├─→ Visão geral de toda a documentação
│   ├─→ Guia de início rápido
│   ├─→ Problemas críticos em destaque
│   ├─→ Roadmap de refatoração
│   └─→ Links para todos os outros documentos
│
├── 🏗️ ARCHITECTURE.md ← Arquitetura Atual
│   ├── Stack Tecnológico
│   ├── Estrutura de Pastas
│   ├── Padrões de Arquitetura
│   ├── Fluxo de Dados
│   ├── Gerenciamento de Estado (Zustand)
│   ├── Convenções e Boas Práticas
│   └── Problemas Conhecidos
│
├── 🔧 REFACTORING_GUIDE.md ← Plano de Refatoração
│   ├── Matriz de Priorização (Impacto vs Esforço)
│   ├── Fase 1: Correções Críticas (P1, P2, P3)
│   ├── Fase 2: Refatorações Estruturais (P4, P5, P6)
│   ├── Fase 3: Otimizações (P7, P8)
│   ├── Métricas de Sucesso
│   └── Checklists de Validação
│
├── 📝 CODE_STANDARDS.md ← Padrões de Código
│   ├── Filosofia de Código
│   ├── Nomenclatura (arquivos, variáveis, funções)
│   ├── Estrutura de Arquivos
│   ├── TypeScript Best Practices
│   ├── React e Componentes
│   ├── Zustand Stores Patterns
│   ├── Services Patterns
│   ├── Custom Hooks Patterns
│   ├── Tratamento de Erros
│   ├── Performance
│   └── Git e Commits
│
├── 🗺️ DEPENDENCIES_MAP.md ← Mapa de Dependências
│   ├── Grafo de Dependências
│   ├── Fluxos de Dados Principais
│   │   ├─→ Autenticação
│   │   ├─→ Carregamento de Personagem
│   │   ├─→ Batalha (Ataque)
│   │   └─→ Progressão de Andar
│   ├── Stores e Responsabilidades
│   ├── Services e Integrações
│   ├── Features e Isolamento
│   ├── Dependências Circulares
│   └── Sistema de Cache
│
└── 📊 ARCHITECTURE_INDEX.md ← VOCÊ ESTÁ AQUI
    └── Este índice visual
```

---

## 🎯 Navegação por Objetivo

### 🆕 Sou novo no projeto

```
1. README_ARCHITECTURE.md (visão geral)
   ↓
2. ARCHITECTURE.md (entender a estrutura)
   ↓
3. CODE_STANDARDS.md (aprender os padrões)
   ↓
4. DEPENDENCIES_MAP.md (ver como tudo se conecta)
```

### 🔨 Vou fazer uma refatoração

```
1. REFACTORING_GUIDE.md (ver o plano)
   ↓
2. DEPENDENCIES_MAP.md (entender as dependências)
   ↓
3. CODE_STANDARDS.md (seguir os padrões)
   ↓
4. Implementar seguindo o checklist
```

### 🐛 Estou debugando um problema

```
1. DEPENDENCIES_MAP.md (rastrear o fluxo de dados)
   ↓
2. ARCHITECTURE.md (verificar problemas conhecidos)
   ↓
3. Documentos específicos (ex: SOLUTION_BATTLE_LOOP_FIX.md)
```

### 📝 Vou escrever código novo

```
1. CODE_STANDARDS.md (ler os padrões)
   ↓
2. ARCHITECTURE.md (ver a estrutura correta)
   ↓
3. DEPENDENCIES_MAP.md (entender onde se encaixa)
   ↓
4. Escrever código seguindo os padrões
```

---

## 📚 Documentos por Categoria

### Documentação de Arquitetura Principal

| Documento                                          | Quando Ler                          | Tempo de Leitura |
| -------------------------------------------------- | ----------------------------------- | ---------------- |
| [README_ARCHITECTURE.md](./README_ARCHITECTURE.md) | Primeiro contato com a documentação | 10 min           |
| [ARCHITECTURE.md](./ARCHITECTURE.md)               | Entender arquitetura completa       | 30-40 min        |
| [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)     | Antes de refatorar                  | 20-30 min        |
| [CODE_STANDARDS.md](./CODE_STANDARDS.md)           | Antes de escrever código            | 25-35 min        |
| [DEPENDENCIES_MAP.md](./DEPENDENCIES_MAP.md)       | Entender fluxo de dados             | 25-30 min        |

### Documentos de Correções Específicas

| Documento                                                            | Tópico                   | Relevância   |
| -------------------------------------------------------------------- | ------------------------ | ------------ |
| [SOLUTION_BATTLE_LOOP_FIX.md](./SOLUTION_BATTLE_LOOP_FIX.md)         | Loop infinito de batalha | ✅ Resolvido |
| [AUDITORIA_CICLOS_ESTADO.md](./AUDITORIA_CICLOS_ESTADO.md)           | Re-renders excessivos    | ✅ Resolvido |
| [AUDITORIA_USEEFFECT_SETSTATE.md](./AUDITORIA_USEEFFECT_SETSTATE.md) | useEffect + setState     | ✅ Resolvido |

### Documentos de Sistemas do Jogo

| Documento                                                              | Sistema             | Status        |
| ---------------------------------------------------------------------- | ------------------- | ------------- |
| [BALANCING.md](./BALANCING.md)                                         | Balanceamento geral | 📖 Referência |
| [MAGIC_DAMAGE_REBALANCE.md](./MAGIC_DAMAGE_REBALANCE.md)               | Dano mágico         | 📖 Referência |
| [COMPREHENSIVE_STATS_REBALANCE.md](./COMPREHENSIVE_STATS_REBALANCE.md) | Stats completos     | 📖 Referência |
| [POTION_SYSTEM_UPDATES.md](./POTION_SYSTEM_UPDATES.md)                 | Sistema de poções   | 📖 Referência |
| [README_spells_update.md](./README_spells_update.md)                   | Sistema de magias   | 📖 Referência |

### Guias de Desenvolvimento

| Documento                                        | Tópico        | Uso         |
| ------------------------------------------------ | ------------- | ----------- |
| [react-spa-patterns.md](./react-spa-patterns.md) | Padrões React | 📖 Consulta |
| [PWA_GUIDE.md](./PWA_GUIDE.md)                   | PWA           | 📖 Consulta |
| [ASSETS_GUIDE.md](./ASSETS_GUIDE.md)             | Assets        | 📖 Consulta |

### Migrações e Histórico

| Documento                                                      | Migração     | Status       |
| -------------------------------------------------------------- | ------------ | ------------ |
| [game-stores-migration.md](./game-stores-migration.md)         | Para Zustand | ✅ Concluída |
| [zustand-migration-summary.md](./zustand-migration-summary.md) | Sumário      | ✅ Concluída |
| [battle-store-migration.md](./battle-store-migration.md)       | Battle Store | ✅ Concluída |

---

## 🔍 Busca Rápida por Tópico

### Arquitetura e Design

- **Estrutura de pastas** → [ARCHITECTURE.md - Estrutura de Pastas](./ARCHITECTURE.md#estrutura-de-pastas)
- **Fluxo de dados** → [ARCHITECTURE.md - Fluxo de Dados](./ARCHITECTURE.md#fluxo-de-dados)
- **Camadas da aplicação** → [ARCHITECTURE.md - Camadas](./ARCHITECTURE.md#camadas-da-aplicação)
- **Decisões de design** → [ARCHITECTURE.md - Decisões](./ARCHITECTURE.md#decisões-de-design)

### Zustand e Estado

- **Como criar stores** → [CODE_STANDARDS.md - Zustand Stores](./CODE_STANDARDS.md#zustand-stores)
- **Seletores otimizados** → [CODE_STANDARDS.md - Seletores](./CODE_STANDARDS.md#zustand-stores)
- **Middleware** → [ARCHITECTURE.md - Gerenciamento de Estado](./ARCHITECTURE.md#gerenciamento-de-estado)
- **Mapa de stores** → [DEPENDENCIES_MAP.md - Stores](./DEPENDENCIES_MAP.md#stores-e-suas-responsabilidades)

### Services

- **Como criar services** → [CODE_STANDARDS.md - Services](./CODE_STANDARDS.md#services)
- **ServiceResponse pattern** → [CODE_STANDARDS.md - Services](./CODE_STANDARDS.md#services)
- **Mapa de services** → [DEPENDENCIES_MAP.md - Services](./DEPENDENCIES_MAP.md#services-e-integrações)

### React e Componentes

- **Estrutura de componente** → [CODE_STANDARDS.md - React](./CODE_STANDARDS.md#react-e-componentes)
- **Props e eventos** → [CODE_STANDARDS.md - Props](./CODE_STANDARDS.md#props)
- **Hooks customizados** → [CODE_STANDARDS.md - Hooks](./CODE_STANDARDS.md#hooks-customizados)
- **Performance** → [CODE_STANDARDS.md - Performance](./CODE_STANDARDS.md#performance)

### Refatoração

- **Problemas críticos** → [REFACTORING_GUIDE.md - Fase 1](./REFACTORING_GUIDE.md#fase-1-correções-críticas-alta-prioridade)
- **Matriz de priorização** → [REFACTORING_GUIDE.md - Priorização](./REFACTORING_GUIDE.md#priorização-impacto-vs-esforço)
- **Checklists** → [REFACTORING_GUIDE.md - Checklist](./REFACTORING_GUIDE.md#checklist-de-validação)

### Fluxos Específicos

- **Autenticação** → [DEPENDENCIES_MAP.md - Fluxo de Autenticação](./DEPENDENCIES_MAP.md#1-fluxo-de-autenticação)
- **Batalha** → [DEPENDENCIES_MAP.md - Fluxo de Batalha](./DEPENDENCIES_MAP.md#3-fluxo-de-batalha-ataque)
- **Progressão** → [DEPENDENCIES_MAP.md - Fluxo de Progressão](./DEPENDENCIES_MAP.md#4-fluxo-de-progressão-de-andar)

---

## ⚡ Quick Reference

### Comandos Úteis

```bash
# Desenvolvimento
npm run dev                    # Servidor de desenvolvimento
npm run dev:clean              # Dev mode limpo (sem cache)

# Build e Deploy
npm run build                  # Build de produção
npm run preview                # Preview do build

# Qualidade de Código
npm run lint                   # Rodar ESLint
npm run format                 # Formatar com Prettier
npm run type-check             # Verificar tipos TypeScript

# Database (Supabase Local)
npm run db:start               # Iniciar Supabase local
npm run db:stop                # Parar Supabase local
npm run db:reset               # Resetar database local

# Workflows Completos
npm run local                  # Setup + DB + Dev
npm run dev-remote             # Dev com Supabase remoto
```

### Estrutura de Pastas Rápida

```
src/
├── components/    → UI components reutilizáveis
├── features/      → Features por domínio (battle, character, etc)
├── stores/        → Zustand stores (9 stores)
├── services/      → Business logic (25 services)
├── hooks/         → Custom hooks (12 hooks)
├── models/        → TypeScript types/interfaces (8 models)
├── routes/        → TanStack Router routes
├── utils/         → Utilitários puros
└── config/        → Configurações
```

### Padrões de Nomenclatura Rápida

| Tipo       | Padrão                     | Exemplo                |
| ---------- | -------------------------- | ---------------------- |
| Componente | PascalCase.tsx             | `BattleArena.tsx`      |
| Service    | kebab-case.service.ts      | `character.service.ts` |
| Hook       | camelCase.ts (use\*)       | `useCharacter.ts`      |
| Store      | camelCase.tsx (use\*Store) | `useBattleStore.tsx`   |
| Model      | kebab-case.model.ts        | `character.model.ts`   |
| Util       | kebab-case.ts              | `number-utils.ts`      |

---

## 🎯 Próximos Passos

### Para a Equipe

1. ✅ **Ler toda a documentação** - Garantir alinhamento
2. 📋 **Revisar problemas críticos** - Priorizar correções
3. 📋 **Planejar Fase 1** - Alocar recursos
4. 📋 **Implementar refatorações** - Seguir o guia
5. 📋 **Atualizar documentação** - Manter sincronizada

### Para Novos Desenvolvedores

1. ✅ **Setup do ambiente** - Seguir README principal
2. ✅ **Ler documentação de arquitetura** - Começar por aqui
3. ✅ **Explorar código** - Entender a estrutura
4. ✅ **Implementar features pequenas** - Ganhar confiança
5. ✅ **Participar de refatorações** - Aprender com a prática

---

## 📞 Suporte

### Dúvidas sobre Arquitetura?

1. Consulte este índice para encontrar o documento certo
2. Leia a documentação específica
3. Se ainda tiver dúvidas, abra uma discussão no GitHub

### Encontrou um Erro na Documentação?

1. Abra uma issue descrevendo o problema
2. Ou faça um PR com a correção
3. Mantenha a documentação sempre atualizada

---

**Este índice é atualizado automaticamente quando novos documentos são adicionados.**

**Última atualização:** 2025-01-20  
**Mantido por:** Equipe Tower Trials
