# Estrutura de Assets - Tower Trials

## Recomendação: Assets Locais vs Object Storage

Optamos por **assets locais** ao invés do object storage do Supabase pelos seguintes motivos:

### Vantagens dos Assets Locais:

- ✅ **Performance Superior**: Servidos diretamente pelo CDN/servidor web
- ✅ **Simplicidade**: Sem complexidade de upload/download
- ✅ **Versionamento**: Assets versionados junto com o código
- ✅ **Cache Otimizado**: Melhor aproveitamento do cache do navegador
- ✅ **Build Optimization**: Assets podem ser otimizados no processo de build

### Estrutura de Diretórios Recomendada:

```
src/assets/
├── icons/
│   ├── consumables/
│   │   ├── small_health_potion.png
│   │   ├── small_mana_potion.png
│   │   ├── health-potion-medium.png
│   │   ├── health-potion-large.png
│   │   ├── mana-potion-medium.png
│   │   ├── mana-potion-large.png
│   │   ├── strength-elixir.png
│   │   ├── defense-elixir.png
│   │   └── antidote.png
│   ├── equipment/
│   │   ├── weapons/
│   │   │   ├── swords/
│   │   │   ├── staffs/
│   │   │   └── bows/
│   │   ├── armor/
│   │   │   └── chest/
│   │   └── accessories/
│   │       ├── rings/
│   │       ├── amulets/
│   │       └── trinkets/
│   ├── materials/
│   │   ├── common/
│   │   ├── uncommon/
│   │   ├── rare/
│   │   ├── epic/
│   │   └── legendary/
│   ├── status/
│   │   ├── buffs/
│   │   ├── debuffs/
│   │   ├── dots/
│   │   └── hots/
│   └── ui/
│       ├── buttons/
│       ├── borders/
│       ├── frames/
│       └── cursors/
├── characters/
│   └── [character-name]/
│       ├── portraits/
│       └── animations/
├── monsters/
│   └── portraits/
│       └── floor-[number]/
├── environments/
│   └── backgrounds/
│       ├── tower/
│       ├── hub/
│       └── menu/
└── effects/
    ├── spell-effects/
    ├── damage-numbers/
    └── particles/
```

## Sistema de Mapeamento

### Consumíveis

O `AssetManager` mapeia consumíveis usando duas estratégias:

1. **Mapeamento por Nome** (prioridade):

   ```typescript
   const CONSUMABLE_ASSET_MAP = {
     'poção de vida pequena': 'small_health_potion.png',
     'pequena poção de vida': 'small_health_potion.png',
     'poção de mana pequena': 'small_mana_potion.png',
     // ...
   };
   ```

2. **Mapeamento por Tipo e Valor** (fallback):
   - Baseado no `type`, `description` e `effect_value`
   - Permite mapeamento automático para novos itens

### Uso nos Componentes

```typescript
import { ConsumableImage } from '@/components/ui/consumable-image';

// Uso básico
<ConsumableImage consumable={item.consumable} size="md" />

// Com customização
<ConsumableImage
  consumable={item.consumable}
  size="lg"
  className="border border-slate-600"
  showFallback={true}
/>
```

### Adicionando Novos Assets

1. **Adicionar arquivo na estrutura apropriada**:

   ```
   src/assets/icons/consumables/new_potion.png
   ```

2. **Mapear no AssetManager** (se necessário):

   ```typescript
   AssetManager.addConsumableMapping('nome da poção', 'new_potion.png');
   ```

3. **Usar nos componentes**:

   ```typescript
   import { getConsumableImagePath } from '@/utils/consumable-utils';

   const imagePath = getConsumableImagePath(consumable);
   ```

## Convenções de Nomenclatura

### Arquivos:

- **Formato**: Sempre PNG
- **Nome**: snake_case (ex: `small_health_potion.png`)
- **Tamanho**: Múltiplos comuns (32x32, 64x64, 128x128)
- **Transparência**: Usar quando apropriado

### Mapeamento:

- **Chaves**: lowercase, sem acentos
- **Flexibilidade**: Múltiplas variações do mesmo nome
- **Fallbacks**: Sempre definir fallbacks por tipo

## Performance

### Cache:

- Assets são cacheados automaticamente pelo `AssetManager`
- Cache pode ser limpo com `AssetManager.clearCache()`

### Preload:

```typescript
// Pré-carregar assets críticos
await AssetManager.preloadCriticalAssets();
```

### Lazy Loading:

- Componentes usam `loading="lazy"` por padrão
- Estados de loading são tratados automaticamente

## Fallbacks

### Estratégia de Fallback:

1. **Imagem específica** (via mapeamento)
2. **Imagem por tipo** (lógica automática)
3. **Emoji/ícone** (último recurso)

### Exemplo:

```typescript
// Se small_health_potion.png não existir:
// 1. Tenta health-potion-small.png
// 2. Tenta fallback por tipo (potion + HP)
// 3. Mostra emoji ❤️
```

## Migração de Sistemas Existentes

### De Emojis para Imagens:

```typescript
// Antes (deprecated)
import { getConsumableIcon } from '@/utils/consumable-utils';
const icon = getConsumableIcon(consumable); // Retorna emoji

// Depois (recomendado)
import { getConsumableImagePath } from '@/utils/consumable-utils';
const imagePath = getConsumableImagePath(consumable); // Retorna path

// Ou melhor ainda
import { ConsumableImage } from '@/components/ui/consumable-image';
<ConsumableImage consumable={consumable} size="md" />
```

## Escalabilidade

### Para Novos Tipos de Assets:

1. Adicionar tipo ao `AssetCategory`
2. Criar métodos específicos no `AssetManager`
3. Definir estrutura de diretórios
4. Criar componentes reutilizáveis (como `ConsumableImage`)

### Exemplo para Equipamentos:

```typescript
// Futura implementação
<EquipmentImage equipment={item} size="lg" />
<MonsterPortrait monster={enemy} floor={currentFloor} />
<EnvironmentBackground location="tower" variant="floor-1" />
```

## Animações Otimizadas

### Problema Resolvido: Glitches e Transições Bruscas

O sistema agora inclui componentes otimizados para animações fluidas:

#### `OptimizedCharacterAnimation`

- **Pré-carregamento**: Todas as imagens da animação são carregadas antes da exibição
- **Canvas Rendering**: Usa `<canvas>` para renderização instantânea
- **Transições Suaves**: Elimina glitches visuais entre frames
- **Fallback Inteligente**: Degrada graciosamente se o pré-carregamento falhar

```typescript
import { OptimizedCharacterAnimation } from '@/components/ui/optimized-character-animation';

<OptimizedCharacterAnimation
  character="thief"
  animation="idle"
  frameNumber={currentFrame}
  size="xl"
  transitionDuration={150}
  onFrameChange={(frame) => console.log(`Frame: ${frame}`)}
/>
```

#### Pré-carregamento de Animações

```typescript
// Pré-carregar manualmente
await AssetManager.preloadCharacterAnimation('thief', 'idle', 3);

// Verificar se está pré-carregado
const isReady = AssetManager.isAnimationPreloaded('thief', 'idle');

// Usar hook para gerenciar pré-carregamento
import { useAssetPreloader } from '@/hooks/use-asset-preloader';

const { isLoading, progress, hasLoaded } = useAssetPreloader({
  preloadCritical: true,
  preloadAnimations: [
    { character: 'thief', animation: 'idle', frameCount: 3 },
    { character: 'warrior', animation: 'attack', frameCount: 4 },
  ],
  onProgress: progress => console.log(`${progress}% carregado`),
});
```

### Benefícios das Otimizações:

- ✅ **Zero Glitches**: Transições perfeitamente suaves
- ✅ **Performance**: Renderização instantânea com canvas
- ✅ **Preload Inteligente**: Assets carregados antes do uso
- ✅ **Fallback Robusto**: Funciona mesmo se algumas imagens falharem
- ✅ **Developer Experience**: Hooks e componentes fáceis de usar
