# Torre de Documentação de Arquitetura

> **Central de Documentação Técnica - Tower Trials**  
> Última atualização: 2025-01-20

## 🎯 Início Rápido

Bem-vindo à documentação técnica do Tower Trials! Este é seu ponto de entrada para entender a arquitetura, padrões e boas práticas do projeto.

### Para Novos Desenvolvedores

1. **Comece aqui:** [ARCHITECTURE.md](./ARCHITECTURE.md) - Entenda a estrutura geral
2. **Padrões de código:** [CODE_STANDARDS.md](./CODE_STANDARDS.md) - Aprenda as convenções
3. **Fluxo de dados:** [DEPENDENCIES_MAP.md](./DEPENDENCIES_MAP.md) - Veja como tudo se conecta

### Para Refatorações

1. **Guia de refatoração:** [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Plano priorizado
2. **Problemas conhecidos:** Ver seção de problemas críticos abaixo

---

## 📚 Documentos Principais

### [ARCHITECTURE.md](./ARCHITECTURE.md)

**Documentação completa da arquitetura atual**

- ✅ Visão geral do sistema
- ✅ Stack tecnológico detalhado
- ✅ Estrutura de pastas e organização
- ✅ Padrões de arquitetura estabelecidos
- ✅ Gerenciamento de estado (Zustand)
- ✅ Convenções e boas práticas
- ⚠️ Problemas conhecidos documentados

**Quando ler:** Ao entrar no projeto ou precisar entender decisões arquiteturais.

---

### [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md)

**Guia passo-a-passo de refatoração priorizada**

- 📊 Matriz de impacto vs esforço
- 🔴 **Fase 1:** Correções críticas (P1, P2, P3)
- 🟡 **Fase 2:** Refatorações estruturais (P4, P5, P6)
- 🟢 **Fase 3:** Otimizações (P7, P8)
- ✅ Checklists de validação
- 📈 Métricas de sucesso

**Quando ler:** Antes de iniciar qualquer refatoração significativa.

---

### [CODE_STANDARDS.md](./CODE_STANDARDS.md)

**Padrões e convenções de código estabelecidas**

- 📝 Nomenclatura (arquivos, variáveis, funções)
- 🏗️ Estrutura de arquivos e imports
- 🔒 TypeScript best practices
- ⚛️ React e componentes
- 🗄️ Zustand stores patterns
- 🔧 Services patterns
- 🪝 Custom hooks patterns
- 🚨 Tratamento de erros
- ⚡ Performance e otimizações
- 📖 Documentação e comentários
- 🔀 Git e commits

**Quando ler:** Antes de escrever qualquer código novo ou ao fazer code review.

---

### [DEPENDENCIES_MAP.md](./DEPENDENCIES_MAP.md)

**Mapa completo de dependências e fluxo de dados**

- 🗺️ Grafo de dependências entre camadas
- 🔄 Fluxos de dados principais (autenticação, batalha, progressão)
- 🗃️ Stores e suas responsabilidades
- 🔧 Services e integrações
- 🏗️ Features e isolamento
- ⚠️ Dependências circulares (problemas)
- 💾 Sistema de cache em múltiplas camadas

**Quando ler:** Ao implementar novos fluxos ou debugar problemas de estado.

---

## 🚨 Problemas Críticos Identificados

### 🔴 P1: Services Acessando Stores Diretamente

**Impacto:** ALTO  
**Esforço:** Médio (3-5 dias)

```typescript
// ❌ PROBLEMA
export class CharacterService {
  static async doSomething() {
    const store = useCharacterStore.getState(); // ❌ Acoplamento
  }
}
```

**Status:** 📋 Planejado  
**Detalhes:** [REFACTORING_GUIDE.md - Fase 1](./REFACTORING_GUIDE.md#p1-remover-acesso-direto-a-stores-dos-services-)

---

### 🟠 P2: Duplicação de `performAction`

**Impacto:** MÉDIO  
**Esforço:** Baixo (1-2 dias)

Lógica duplicada em:

- `useBattleStore.tsx` (implementação completa)
- `useGameStore.tsx` (implementação simplificada)

**Status:** 📋 Planejado  
**Detalhes:** [REFACTORING_GUIDE.md - Fase 1](./REFACTORING_GUIDE.md#p2-consolidar-performaction-)

---

### 🟡 P3: Cache em 3 Camadas Não Sincronizadas

**Impacto:** MÉDIO  
**Esforço:** Médio (2-3 dias)

Camadas atuais:

1. `CharacterCacheService` (em memória)
2. `useCharacterStore` (Zustand + localStorage)
3. Cache de requisições pendentes

**Status:** 📋 Planejado  
**Detalhes:** [REFACTORING_GUIDE.md - Fase 1](./REFACTORING_GUIDE.md#p3-unificar-sistema-de-cache-)

---

## 📊 Métricas da Base de Código

### Estado Atual

| Métrica                 | Valor       | Status                       |
| ----------------------- | ----------- | ---------------------------- |
| Total de Services       | 25          | ⚠️ Alguns muito grandes      |
| Services > 1000 linhas  | 5           | 🔴 Precisa refatoração       |
| Stores Zustand          | 9           | ✅ Bem organizados           |
| Custom Hooks            | 12          | ✅ Quantidade adequada       |
| Features isoladas       | 7           | ✅ Boa separação             |
| Componentes UI base     | 43          | ✅ Sistema de design robusto |
| Dependências circulares | 1 conhecida | ⚠️ Services ↔ Stores        |
| Camadas de cache        | 3           | ⚠️ Precisa unificação        |

### Metas Pós-Refatoração

| Métrica                   | Meta        | Prazo Estimado |
| ------------------------- | ----------- | -------------- |
| Services > 800 linhas     | 0           | 2-3 semanas    |
| Dependências circulares   | 0           | 1-2 semanas    |
| Camadas de cache          | 1 (Zustand) | 1 semana       |
| Acesso stores em services | 0           | 1-2 semanas    |
| Coverage de testes        | > 60%       | 1-2 meses      |

---

## 🏗️ Arquitetura em Resumo

### Camadas da Aplicação

```
┌─────────────────────────────────────┐
│  PRESENTATION (Components/Features) │  ← React Components
└──────────────┬──────────────────────┘
               ↓ use hooks
┌─────────────────────────────────────┐
│  STATE (Zustand Stores + Hooks)     │  ← Estado Global
└──────────────┬──────────────────────┘
               ↓ call services
┌─────────────────────────────────────┐
│  BUSINESS LOGIC (Services)          │  ← Lógica de Negócio
└──────────────┬──────────────────────┘
               ↓ API calls
┌─────────────────────────────────────┐
│  DATA ACCESS (Supabase)             │  ← Backend
└─────────────────────────────────────┘
```

### Stack Tecnológico Core

- **Frontend:** React 19 + TypeScript 5.8
- **Build:** Vite 6
- **Roteamento:** TanStack Router 1.120
- **Estado:** Zustand 5 + Immer
- **Backend:** Supabase (PostgreSQL)
- **UI:** Tailwind CSS 4 + shadcn/ui
- **PWA:** Service Worker + Manifest

---

## 🎯 Princípios de Design

### 1. Separação de Responsabilidades

✅ **Componentes** → Apenas UI e eventos  
✅ **Hooks** → Lógica reutilizável e acesso a stores  
✅ **Stores** → Estado global e orquestração  
✅ **Services** → Lógica de negócio e API

### 2. Type Safety First

✅ TypeScript estrito em toda a aplicação  
✅ Interfaces claras para comunicação entre camadas  
✅ Type guards para validação de dados externos

### 3. Performance por Padrão

✅ Lazy loading de rotas  
✅ Seletores granulares (Zustand)  
✅ Memoização estratégica (useMemo, React.memo)  
✅ Code splitting automático (Vite)

### 4. Features Isoladas

✅ Cada feature é auto-contida  
✅ Comunicação via stores/services  
✅ Sem imports diretos entre features

---

## 📖 Guias Específicos

### Documentos Técnicos Adicionais

#### Correções de Bugs Específicos

- [SOLUTION_BATTLE_LOOP_FIX.md](./SOLUTION_BATTLE_LOOP_FIX.md) - Correção do loop de inicialização
- [AUDITORIA_CICLOS_ESTADO.md](./AUDITORIA_CICLOS_ESTADO.md) - Auditoria de re-renders
- [AUDITORIA_USEEFFECT_SETSTATE.md](./AUDITORIA_USEEFFECT_SETSTATE.md) - Problemas de useEffect

#### Sistema de Jogo

- [BALANCING.md](./BALANCING.md) - Balanceamento de stats
- [MAGIC_DAMAGE_REBALANCE.md](./MAGIC_DAMAGE_REBALANCE.md) - Sistema de dano mágico
- [COMPREHENSIVE_STATS_REBALANCE.md](./COMPREHENSIVE_STATS_REBALANCE.md) - Rebalanceamento completo

#### Sistemas Específicos

- [POTION_SYSTEM_UPDATES.md](./POTION_SYSTEM_UPDATES.md) - Sistema de poções
- [README_spells_update.md](./README_spells_update.md) - Sistema de magias
- [README-CHARACTER-ARCHITECTURE.md](./README-CHARACTER-ARCHITECTURE.md) - Arquitetura de personagens

#### Guias de Desenvolvimento

- [react-spa-patterns.md](./react-spa-patterns.md) - Padrões React SPA
- [PWA_GUIDE.md](./PWA_GUIDE.md) - Guia PWA
- [ASSETS_GUIDE.md](./ASSETS_GUIDE.md) - Gerenciamento de assets

#### Migrações e Mudanças

- [game-stores-migration.md](./game-stores-migration.md) - Migração para Zustand
- [zustand-migration-summary.md](./zustand-migration-summary.md) - Sumário da migração
- [battle-store-migration.md](./battle-store-migration.md) - Migração do battle store

---

## 🚀 Começando

### Setup do Ambiente de Desenvolvimento

```bash
# 1. Instalar dependências
pnpm install

# 2. Configurar ambiente local
npm run env:local

# 3. Iniciar Supabase local
npm run db:start

# 4. Rodar em desenvolvimento
npm run dev
```

### Workflow de Desenvolvimento

```bash
# 1. Criar branch para feature/fix
git checkout -b feature/nome-da-feature

# 2. Desenvolver seguindo CODE_STANDARDS.md
# 3. Testar localmente
npm run lint
npm run type-check

# 4. Formatar código
npm run format

# 5. Commit seguindo padrões
git commit -m "feat(scope): descrição"

# 6. Criar PR
```

---

## 🔍 Troubleshooting

### Problemas Comuns

#### Build falha com erro de tipos

```bash
# Limpar cache e rebuildar
rm -rf node_modules .vite dist
pnpm install
npm run build
```

#### Service Worker causando problemas

```bash
# Desregistrar service worker
npm run sw:unregister
```

#### Estado inconsistente

```bash
# Limpar localStorage
# No console do navegador:
localStorage.clear()
```

---

## 📞 Suporte e Contato

### Recursos

- **Documentação Principal:** Este diretório (`docs/`)
- **Issues:** GitHub Issues para bugs e features
- **Discussões:** GitHub Discussions para questões gerais

### Contribuindo

1. Leia [CODE_STANDARDS.md](./CODE_STANDARDS.md)
2. Siga [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) para mudanças grandes
3. Mantenha documentação atualizada
4. Adicione testes quando possível

---

## 📅 Roadmap de Refatoração

### ✅ Fase 0: Documentação (CONCLUÍDA)

- ✅ ARCHITECTURE.md
- ✅ REFACTORING_GUIDE.md
- ✅ CODE_STANDARDS.md
- ✅ DEPENDENCIES_MAP.md

### 📋 Fase 1: Correções Críticas (1-2 semanas)

- [ ] P1: Remover acesso direto a stores dos services
- [ ] P2: Consolidar `performAction`
- [ ] P3: Unificar sistema de cache

### 📋 Fase 2: Refatorações Estruturais (2-3 semanas)

- [ ] P4: Quebrar services grandes (5 arquivos)
- [ ] P5: Reorganizar lógica de batalha
- [ ] P6: Otimizar hooks agregadores

### 📋 Fase 3: Otimizações (1-2 semanas)

- [ ] P7: Consolidar validações
- [ ] P8: Padronizar conversões
- [ ] Testes unitários (cobertura mínima)

---

## 🎓 Aprendizado Contínuo

### Para Dominar a Base de Código

1. **Semana 1-2:** Leia toda a documentação de arquitetura
2. **Semana 3-4:** Implemente features pequenas seguindo os padrões
3. **Semana 5-6:** Participe de refatorações (com supervisão)
4. **Semana 7+:** Contribua com melhorias arquiteturais

### Recursos Externos Recomendados

- [Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [React Best Practices](https://react.dev)
- [Zustand Documentation](https://zustand.docs.pmnd.rs)
- [TanStack Router](https://tanstack.com/router)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)

---

**Mantido por:** Equipe Tower Trials  
**Última revisão:** 2025-01-20  
**Próxima revisão:** Após conclusão da Fase 1 de refatoração
