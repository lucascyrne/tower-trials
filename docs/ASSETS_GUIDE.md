# 🎨 Guia de Assets - Tower Trials

Este guia explica como organizar, criar e usar assets no jogo Tower Trials.

## 📁 Estrutura de Pastas

```
src/assets/
├── 📁 icons/                    # Ícones do jogo (32x32px)
│   ├── consumables/            # Poções, elixires, antídotos
│   ├── equipment/              # Armas, armaduras, acessórios
│   ├── materials/              # Drops de monstros por raridade
│   ├── ui/                     # Elementos de interface
│   └── status/                 # Efeitos, buffs, debuffs
├── 📁 characters/              # Personagens e classes
│   ├── player/                 # Retratos e sprites do jogador
│   └── classes/                # Sprites específicos por classe
├── 📁 monsters/                # Monstros organizados por andar
│   ├── portraits/              # Retratos (64x64px)
│   ├── sprites/                # Sprites para animações
│   └── animations/             # Sequências de animação
├── 📁 environments/            # Cenários e backgrounds
│   ├── backgrounds/            # Fundos de tela
│   ├── tiles/                  # Tiles para construção de mapas
│   └── parallax/               # Camadas de parallax
├── 📁 effects/                 # Efeitos visuais
│   ├── magic/                  # Efeitos mágicos
│   ├── combat/                 # Efeitos de combate
│   └── particles/              # Partículas diversas
└── 📁 audio/                   # Áudio (opcional na estrutura)
    ├── sfx/                    # Efeitos sonoros
    └── music/                  # Música ambiente
```

## 🎯 Especificações Técnicas

### Formatos de Arquivo

- **Imagens**: PNG (com suporte à transparência)
- **Áudio**: MP3 ou OGG
- **Paleta**: Consistente em todo o jogo (pixel art)

### Resoluções Recomendadas

- **Ícones de UI**: 32x32px
- **Ícones de itens**: 32x32px
- **Retratos de personagens**: 64x64px
- **Retratos de monstros**: 64x64px
- **Backgrounds**: 1920x1080px (ou proporção 16:9)
- **Sprites**: Variável conforme necessidade

### Convenções de Nomenclatura

```
[categoria]-[tipo]-[variação].[formato]

Exemplos:
✅ health-potion-small.png
✅ iron-sword-tier2.png
✅ goblin-portrait-angry.png
✅ floor-3-background-cave.png

❌ HealthPotionSmall.png
❌ IronSword_T2.png
❌ goblin.jpg
```

## 🛠️ Como Usar o AssetManager

### 1. Importar o Sistema

```typescript
import { AssetManager } from '@/utils/asset-utils';
import { ConsumableIcon, EquipmentIcon } from '@/components/ui/AssetImage';
```

### 2. Usar em Componentes

#### Ícones de Consumíveis

```tsx
// Automático baseado no tipo e descrição
<ConsumableIcon consumable={potion} size="md" className="rounded-lg" />;

// Manual
const iconPath = AssetManager.getConsumableIcon(potion);
```

#### Ícones de Equipamentos

```tsx
<EquipmentIcon equipment={sword} size="lg" className="border-2 border-gold" />
```

#### Retratos de Monstros

```tsx
<MonsterPortrait monsterName="Goblin Guerreiro" floor={3} size="xl" />
```

#### Backgrounds

```tsx
<EnvironmentBackground location="tower" variant="floor-5" className="min-h-screen">
  <div>Conteúdo sobre o background</div>
</EnvironmentBackground>
```

#### Animações de Personagens

```tsx
// Componente especializado para animações
<CharacterAnimation
  character="thief"
  animation="idle"
  frameNumber={currentFrame}
  size="lg"
  className="object-contain"
/>;

// Exemplo de uso com estado para animação
const [currentFrame, setCurrentFrame] = useState(1);

useEffect(() => {
  const interval = setInterval(() => {
    setCurrentFrame(prev => (prev % 3) + 1);
  }, 600);
  return () => clearInterval(interval);
}, []);
```

### 3. Pré-carregar Assets Críticos

```typescript
// No início da aplicação
await AssetManager.preloadCriticalAssets();
```

## 🎨 Criando Assets no Voidless.dev

### 1. Configurações Recomendadas

- **Estilo**: Pixel Art
- **Resolução**: 32x32px para ícones
- **Paleta**: Limitada e consistente
- **Transparência**: Ativa (formato PNG)

### 2. Guia por Categoria

#### Consumíveis

- **Poções de Vida**: Tons de vermelho/rosa

  - Pequena: Frasco pequeno, líquido vermelho claro
  - Média: Frasco médio, líquido vermelho médio
  - Grande: Frasco grande, líquido vermelho escuro

- **Poções de Mana**: Tons de azul

  - Pequena: Frasco pequeno, líquido azul claro
  - Média: Frasco médio, líquido azul médio
  - Grande: Frasco grande, líquido azul escuro

- **Elixires**: Tons dourados/amarelos
  - Força: Frasco com símbolos de ataque
  - Defesa: Frasco com símbolos de escudo

#### Equipamentos

- **Espadas**:

  - Madeira: Marrom claro, cabo simples
  - Ferro: Cinza metálico, guarda básica
  - Aço: Prata brilhante, detalhes ornamentais

- **Armaduras**:
  - Couro: Marrom, textura rústica
  - Ferro: Cinza, placas metálicas
  - Aço: Prata, brilho metálico

#### Monstros

- **Goblin**: Verde, baixo, orelhas pontudas
- **Lobo**: Cinza/marrom, feroz
- **Esqueleto**: Branco/amarelado, ossos visíveis

## 📋 Lista de Assets Prioritários

### Consumíveis (Alta Prioridade)

- [ ] `health-potion-small.png`
- [ ] `health-potion-medium.png`
- [ ] `health-potion-large.png`
- [ ] `mana-potion-small.png`
- [ ] `mana-potion-medium.png`
- [ ] `mana-potion-large.png`
- [ ] `strength-elixir.png`
- [ ] `defense-elixir.png`
- [ ] `antidote.png`

### Equipamentos (Média Prioridade)

- [ ] `wooden-sword.png`
- [ ] `iron-sword.png`
- [ ] `steel-sword.png`
- [ ] `basic-staff.png`
- [ ] `magic-staff.png`
- [ ] `leather-armor.png`
- [ ] `iron-armor.png`

### Monstros (Média Prioridade)

- [ ] `goblin.png` (Floor 1)
- [ ] `wolf.png` (Floor 1)
- [ ] `skeleton.png` (Floor 2)

### Materiais (Baixa Prioridade)

- [ ] `goblin-fang.png` (common)
- [ ] `wolf-pelt.png` (common)
- [ ] `iron-ore.png` (uncommon)
- [ ] `magic-crystal.png` (rare)

### UI (Baixa Prioridade)

- [ ] `placeholder.png`
- [ ] `primary-button.png`
- [ ] `inventory-frame.png`

## 🔄 Workflow de Adição de Assets

1. **Criar o asset** no Voidless.dev seguindo as especificações
2. **Baixar em PNG** na resolução correta
3. **Renomear** seguindo as convenções
4. **Colocar na pasta correta** da estrutura
5. **Testar** usando o AssetManager
6. **Atualizar** este guia se necessário

## 🐛 Troubleshooting

### Asset não aparece

1. Verificar se o caminho está correto
2. Confirmar se o arquivo existe na pasta
3. Verificar se o nome segue as convenções
4. Limpar cache: `AssetManager.clearCache()`

### Fallback sendo usado

1. O arquivo pode não existir
2. Erro de nomenclatura
3. Caminho incorreto no AssetManager

### Performance

- Use `loading="lazy"` para assets não críticos
- Pré-carregue apenas assets essenciais
- Considere usar sprites sheets para animações

## 📝 Exemplos de Uso Avançado

### Custom Hook para Assets

```typescript
const useConsumableAsset = (consumable: Consumable) => {
  const iconPath = AssetManager.getConsumableIcon(consumable);
  return useAsset(iconPath, 'icons');
};
```

### Componente com Loading

```tsx
const ItemIcon = ({ item }) => {
  const { asset, isLoading } = useAsset(item.iconPath, 'icons');

  if (isLoading) {
    return <Skeleton className="w-8 h-8" />;
  }

  return <img src={asset} alt={item.name} />;
};
```

---

**Dica**: Mantenha sempre um backup dos assets originais e versionados para facilitar atualizações futuras!
