import type { Consumable } from '@/resources/consumable/consumable.model';
import type { Equipment } from '@/resources/equipment/equipment.model';

// Tipos para organização de assets
export type AssetCategory =
  | 'icons'
  | 'characters'
  | 'monsters'
  | 'environments'
  | 'effects'
  | 'audio';

export type ConsumableAssetType =
  | 'health-potion-small'
  | 'health-potion-medium'
  | 'health-potion-large'
  | 'mana-potion-small'
  | 'mana-potion-medium'
  | 'mana-potion-large'
  | 'strength-elixir'
  | 'defense-elixir'
  | 'antidote';

export type EquipmentAssetType =
  | 'wooden-sword'
  | 'iron-sword'
  | 'steel-sword'
  | 'oak-staff'
  | 'wooden-staff'
  | 'leather-armor'
  | 'chainmail-armor'
  | 'scale-armor'
  | 'apprentice-robe'
  | 'occultist-cloak'
  | 'light-vestments'
  | 'bronze-dagger'
  | 'battle-axe'
  | 'swift-boots'
  | 'strength-ring'
  | 'mana-ring'
  | 'protection-amulet'
  | 'arcane-amulet'
  | 'defensive-bracers';

export type MonsterAssetType = 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'troll' | 'dragon';

export type RarityColor = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Configurações base dos assets
// Função para obter o caminho base correto baseado no ambiente
const getAssetBasePath = () => {
  // Em produção (site deployado), usar /assets
  // Em desenvolvimento, Vite resolve imports de src/assets automaticamente
  if (import.meta.env.PROD) {
    return '/assets';
  }
  // Em desenvolvimento, usar caminho direto para src/assets
  return '/src/assets';
};

const ASSET_BASE_PATH = getAssetBasePath();

// Mapeamento de consumíveis para assets baseado em nome/tipo
const CONSUMABLE_ASSET_MAP: Record<string, string> = {
  // Poções de vida (por nome)
  'poção de vida pequena': 'small_health_potion.png',
  'pequena poção de vida': 'small_health_potion.png',
  'small health potion': 'small_health_potion.png',
  'poção de hp pequena': 'small_health_potion.png',

  'poção de vida média': 'medium_health_potion.png',
  'média poção de vida': 'medium_health_potion.png',
  'medium health potion': 'medium_health_potion.png',
  'poção de hp média': 'medium_health_potion.png',

  'poção de vida grande': 'large_mana_potion.png',
  'grande poção de vida': 'large_mana_potion.png',
  'large health potion': 'large_mana_potion.png',
  'poção de hp grande': 'large_mana_potion.png',

  // Poções de mana (por nome)
  'poção de mana pequena': 'small_mana_potion.png',
  'pequena poção de mana': 'small_mana_potion.png',
  'small mana potion': 'small_mana_potion.png',
  'poção de mp pequena': 'small_mana_potion.png',

  'poção de mana média': 'medium_mana_potion.png',
  'média poção de mana': 'medium_mana_potion.png',
  'medium mana potion': 'medium_mana_potion.png',
  'poção de mp média': 'medium_mana_potion.png',

  'poção de mana grande': 'large_mana_potion.png',
  'grande poção de mana': 'large_mana_potion.png',
  'large mana potion': 'large_mana_potion.png',
  'poção de mp grande': 'large_mana_potion.png',

  // Elixires
  'elixir de força': 'strength_elixir.png',
  'strength elixir': 'strength_elixir.png',

  'elixir de defesa': 'defense_elixir.png',
  'defense elixir': 'defense_elixir.png',

  // Antídoto
  antídoto: 'antidote.png',
  antidote: 'antidote.png',

  // Fallbacks por tipo e valor de efeito
  potion_hp_small: 'small_health_potion.png',
  potion_hp_medium: 'medium_health_potion.png',
  potion_hp_large: 'large_mana_potion.png',
  potion_mana_small: 'small_mana_potion.png',
  potion_mana_medium: 'medium_mana_potion.png',
  potion_mana_large: 'large_mana_potion.png',
};

// Cache para imagens pré-carregadas de animações
interface PreloadedImage {
  element: HTMLImageElement;
  loaded: boolean;
  path: string;
}

/**
 * Classe principal para gerenciamento de assets
 */
export class AssetManager {
  private static iconCache = new Map<string, string>();
  private static preloadedAnimations = new Map<string, Map<number, PreloadedImage>>();
  private static loadingPromises = new Map<string, Promise<void>>();

  /**
   * Obter ícone de consumível baseado no tipo, nome e valor do efeito
   */
  static getConsumableIcon(consumable: Consumable): string {
    const cacheKey = `consumable-${consumable.id}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    let iconPath: string;

    // Primeiro, tentar mapear por nome exato (normalizado)
    const normalizedName = consumable.name.toLowerCase().trim();
    if (CONSUMABLE_ASSET_MAP[normalizedName]) {
      iconPath = `${ASSET_BASE_PATH}/icons/consumables/${CONSUMABLE_ASSET_MAP[normalizedName]}`;
    } else {
      // Fallback para lógica baseada em tipo e descrição
      iconPath = this.getConsumableIconByType(consumable);
    }

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter ícone de consumível baseado em tipo e descrição (fallback)
   */
  private static getConsumableIconByType(consumable: Consumable): string {
    const basePath = `${ASSET_BASE_PATH}/icons/consumables`;

    if (consumable.type === 'potion') {
      if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
        // Mapear por valor do efeito
        if (consumable.effect_value <= 30) {
          return `${basePath}/small_health_potion.png`;
        } else if (consumable.effect_value <= 60) {
          return `${basePath}/medium_health_potion.png`;
        } else {
          return `${basePath}/large_mana_potion.png`;
        }
      } else if (consumable.description.includes('Mana')) {
        // Mapear por valor do efeito
        if (consumable.effect_value <= 15) {
          return `${basePath}/small_mana_potion.png`;
        } else if (consumable.effect_value <= 30) {
          return `${basePath}/medium_mana_potion.png`;
        } else {
          return `${basePath}/large_mana_potion.png`;
        }
      } else {
        return `${basePath}/small_health_potion.png`;
      }
    } else if (consumable.type === 'buff' || consumable.type === 'elixir') {
      if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
        return `${basePath}/strength_elixir.png`;
      } else if (consumable.description.includes('Defesa')) {
        return `${basePath}/defense_elixir.png`;
      } else {
        return `${basePath}/strength_elixir.png`;
      }
    } else if (consumable.type === 'antidote') {
      return `${basePath}/antidote.png`;
    } else {
      return `${basePath}/small_health_potion.png`;
    }
  }

  /**
   * Adicionar mapeamento personalizado de consumível
   */
  static addConsumableMapping(nameOrKey: string, filename: string): void {
    CONSUMABLE_ASSET_MAP[nameOrKey.toLowerCase().trim()] = filename;
  }

  /**
   * Pré-carregar uma animação completa de personagem
   */
  static async preloadCharacterAnimation(
    character: string,
    animation: string,
    frameCount: number = 3
  ): Promise<void> {
    const animationKey = `${character}-${animation}`;

    // Se já está sendo carregado, aguardar
    if (this.loadingPromises.has(animationKey)) {
      await this.loadingPromises.get(animationKey);
      return;
    }

    // Se já foi carregado, retornar
    if (this.preloadedAnimations.has(animationKey)) {
      return;
    }

    // Criar promise de carregamento
    const loadPromise = this.loadAnimationFrames(character, animation, frameCount);
    this.loadingPromises.set(animationKey, loadPromise);

    try {
      await loadPromise;
    } finally {
      this.loadingPromises.delete(animationKey);
    }
  }

  /**
   * Carregar todos os frames de uma animação
   */
  private static async loadAnimationFrames(
    character: string,
    animation: string,
    frameCount: number
  ): Promise<void> {
    const animationKey = `${character}-${animation}`;
    const frameMap = new Map<number, PreloadedImage>();

    const loadPromises = [];

    for (let frame = 1; frame <= frameCount; frame++) {
      const frameStr = frame.toString().padStart(2, '0');
      const imagePath = `${ASSET_BASE_PATH}/characters/${character}/${animation}/${character}-${animation}-${frameStr}.png`;

      const preloadedImage: PreloadedImage = {
        element: new Image(),
        loaded: false,
        path: imagePath,
      };

      frameMap.set(frame, preloadedImage);

      // Criar promise para carregamento desta imagem
      const loadPromise = new Promise<void>(resolve => {
        preloadedImage.element.onload = () => {
          preloadedImage.loaded = true;
          resolve();
        };

        preloadedImage.element.onerror = () => {
          console.warn(
            `[AssetManager] Falha ao carregar frame ${frame} da animação ${animationKey}`
          );
          // Não rejeitar para permitir que outras imagens carreguem
          resolve();
        };

        // Definir src por último para iniciar carregamento
        preloadedImage.element.src = imagePath;
      });

      loadPromises.push(loadPromise);
    }

    // Aguardar todas as imagens carregarem
    await Promise.all(loadPromises);

    // Armazenar no cache
    this.preloadedAnimations.set(animationKey, frameMap);

    console.log(
      `✅ [AssetManager] Animação ${animationKey} pré-carregada com ${frameCount} frames`
    );
  }

  /**
   * Obter frame de animação de personagem (otimizado)
   */
  static getCharacterAnimationFrame(
    character: string,
    animation: string,
    frameNumber: number
  ): string {
    const frameStr = frameNumber.toString().padStart(2, '0');
    const iconPath = `${ASSET_BASE_PATH}/characters/${character}/${animation}/${character}-${animation}-${frameStr}.png`;

    const cacheKey = `character-${character}-${animation}-${frameNumber}`;
    this.iconCache.set(cacheKey, iconPath);

    return iconPath;
  }

  /**
   * Obter elemento de imagem pré-carregado (para animações fluidas)
   */
  static getPreloadedAnimationFrame(
    character: string,
    animation: string,
    frameNumber: number
  ): HTMLImageElement | null {
    const animationKey = `${character}-${animation}`;
    const frameMap = this.preloadedAnimations.get(animationKey);

    if (!frameMap) {
      return null;
    }

    const preloadedImage = frameMap.get(frameNumber);
    return preloadedImage?.loaded ? preloadedImage.element : null;
  }

  /**
   * Verificar se uma animação está pré-carregada
   */
  static isAnimationPreloaded(character: string, animation: string): boolean {
    const animationKey = `${character}-${animation}`;
    return this.preloadedAnimations.has(animationKey);
  }

  /**
   * Obter ícone de equipamento baseado no tipo e nível
   */
  static getEquipmentIcon(equipment: Equipment): string {
    const cacheKey = `equipment-${equipment.id}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    let iconPath: string;
    const basePath = `${ASSET_BASE_PATH}/icons`;

    switch (equipment.type) {
      case 'weapon':
        if (
          equipment.name.toLowerCase().includes('espada') ||
          equipment.name.toLowerCase().includes('sword')
        ) {
          if (equipment.level_requirement <= 5) {
            iconPath = `${basePath}/weapons/iron_sword.png`;
          } else if (equipment.level_requirement <= 15) {
            iconPath = `${basePath}/weapons/steel_sword.png`;
          } else {
            iconPath = `${basePath}/weapons/steel_sword.png`;
          }
        } else if (
          equipment.name.toLowerCase().includes('cajado') ||
          equipment.name.toLowerCase().includes('varinha') ||
          equipment.name.toLowerCase().includes('staff')
        ) {
          iconPath =
            equipment.level_requirement <= 10
              ? `${basePath}/weapons/wooden_staff.png`
              : `${basePath}/weapons/oak_staff.png`;
        } else if (
          equipment.name.toLowerCase().includes('arco') ||
          equipment.name.toLowerCase().includes('bow')
        ) {
          iconPath = `${basePath}/weapons/wooden_staff.png`;
        } else if (
          equipment.name.toLowerCase().includes('adaga') ||
          equipment.name.toLowerCase().includes('dagger')
        ) {
          iconPath = `${basePath}/weapons/bronze_dagger.png`;
        } else if (
          equipment.name.toLowerCase().includes('machado') ||
          equipment.name.toLowerCase().includes('axe')
        ) {
          iconPath = `${basePath}/weapons/battle_axe.png`;
        } else {
          iconPath = `${basePath}/weapons/iron_sword.png`;
        }
        break;

      case 'chest':
      case 'armor':
        if (equipment.level_requirement <= 5) {
          iconPath = `${basePath}/armors/leather_armor.png`;
        } else if (equipment.level_requirement <= 15) {
          iconPath = `${basePath}/armors/chainmail_armor.png`;
        } else {
          iconPath = `${basePath}/armors/scale_armor.png`;
        }
        break;

      case 'ring':
        iconPath = equipment.name.toLowerCase().includes('força')
          ? `${basePath}/accessories/strength_ring.png`
          : `${basePath}/accessories/mana_ring.png`;
        break;

      case 'necklace':
        iconPath = `${basePath}/accessories/protection_amulet.png`;
        break;

      case 'amulet':
        iconPath = `${basePath}/accessories/arcane_amulet.png`;
        break;

      case 'boots':
        iconPath = `${basePath}/armors/swift_boots.png`;
        break;

      case 'helmet':
      case 'legs':
        iconPath = `${basePath}/accessories/defensive_bracers.png`;
        break;

      default:
        iconPath = `${basePath}/weapons/iron_sword.png`;
    }

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter ícone de material baseado na raridade
   */
  static getMaterialIcon(rarity: RarityColor, materialName: string): string {
    const cacheKey = `material-${rarity}-${materialName}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const iconPath = `${ASSET_BASE_PATH}/icons/materials/${rarity}/${materialName.toLowerCase().replace(/\s+/g, '-')}.png`;
    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter retrato de monstro
   */
  static getMonsterPortrait(monsterName: string, floor: number): string {
    const cacheKey = `monster-portrait-${monsterName}-${floor}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const sanitizedName = monsterName.toLowerCase().replace(/\s+/g, '-');
    const iconPath = `${ASSET_BASE_PATH}/monsters/portraits/floor-${floor}/${sanitizedName}.png`;

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter background do ambiente
   */
  static getEnvironmentBackground(location: 'tower' | 'hub' | 'menu', variant: string): string {
    const cacheKey = `bg-${location}-${variant}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const iconPath = `${ASSET_BASE_PATH}/environments/backgrounds/${location}/${variant}-bg.png`;
    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter ícone de status/efeito
   */
  static getStatusIcon(effectType: 'buff' | 'debuff' | 'dot' | 'hot', effectName: string): string {
    const cacheKey = `status-${effectType}-${effectName}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const sanitizedName = effectName.toLowerCase().replace(/\s+/g, '-');
    const iconPath = `${ASSET_BASE_PATH}/icons/status/${effectType}s/${sanitizedName}.png`;

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Obter ícone de UI
   */
  static getUIIcon(
    category: 'buttons' | 'borders' | 'frames' | 'cursors',
    iconName: string
  ): string {
    const cacheKey = `ui-${category}-${iconName}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const iconPath = `${ASSET_BASE_PATH}/icons/ui/${category}/${iconName}.png`;
    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Limpar cache de assets
   */
  static clearCache(): void {
    this.iconCache.clear();
    this.preloadedAnimations.clear();
    this.loadingPromises.clear();
  }

  /**
   * Pré-carregar assets críticos
   */
  static async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      // Poções básicas
      `${ASSET_BASE_PATH}/icons/consumables/small_health_potion.png`,
      `${ASSET_BASE_PATH}/icons/consumables/small_mana_potion.png`,
      `${ASSET_BASE_PATH}/icons/consumables/medium_health_potion.png`,
      `${ASSET_BASE_PATH}/icons/consumables/medium_mana_potion.png`,

      // Equipamentos básicos
      `${ASSET_BASE_PATH}/icons/weapons/iron_sword.png`,
      `${ASSET_BASE_PATH}/icons/armors/leather_armor.png`,
      `${ASSET_BASE_PATH}/icons/weapons/wooden_staff.png`,

      // Acessórios básicos
      `${ASSET_BASE_PATH}/icons/accessories/strength_ring.png`,
      `${ASSET_BASE_PATH}/icons/accessories/protection_amulet.png`,
    ];

    const loadPromises = criticalAssets.map(assetPath => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${assetPath}`));
        img.src = assetPath;
      });
    });

    // Pré-carregar animações críticas
    const animationPromises = [
      this.preloadCharacterAnimation('thief', 'idle', 3),
      // Adicionar mais animações conforme necessário
    ];

    try {
      await Promise.all([...loadPromises, ...animationPromises]);
      console.log('✅ Critical assets and animations preloaded successfully');
    } catch (error) {
      console.warn('⚠️ Some critical assets failed to load:', error);
    }
  }

  /**
   * Verificar se um asset existe
   */
  static async assetExists(assetPath: string): Promise<boolean> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = assetPath;
    });
  }

  /**
   * Obter fallback de asset caso o principal não exista
   */
  static getFallbackAsset(category: AssetCategory): string {
    const fallbacks = {
      icons: `${ASSET_BASE_PATH}/icons/ui/placeholder.png`,
      characters: `${ASSET_BASE_PATH}/characters/player/portraits/default.png`,
      monsters: `${ASSET_BASE_PATH}/monsters/portraits/placeholder.png`,
      environments: `${ASSET_BASE_PATH}/environments/backgrounds/default-bg.png`,
      effects: `${ASSET_BASE_PATH}/effects/placeholder.png`,
      audio: '',
    };

    return fallbacks[category];
  }
}

/**
 * Hook para usar assets em componentes React
 */
export function useAsset(assetPath: string, fallbackCategory: AssetCategory) {
  const [loadedAsset, setLoadedAsset] = useState<string>(assetPath);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAsset = async () => {
      setIsLoading(true);
      setHasError(false);

      try {
        const exists = await AssetManager.assetExists(assetPath);

        if (isMounted) {
          if (exists) {
            setLoadedAsset(assetPath);
          } else {
            setLoadedAsset(AssetManager.getFallbackAsset(fallbackCategory));
            setHasError(true);
          }
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setLoadedAsset(AssetManager.getFallbackAsset(fallbackCategory));
          setHasError(true);
          setIsLoading(false);
        }
      }
    };

    loadAsset();

    return () => {
      isMounted = false;
    };
  }, [assetPath, fallbackCategory]);

  return { asset: loadedAsset, isLoading, hasError };
}

// Importação necessária para o hook
import { useState, useEffect } from 'react';
