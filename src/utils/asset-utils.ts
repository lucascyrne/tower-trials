import { type Consumable } from '@/resources/game/models/consumable.model';
import { type Equipment } from '@/resources/game/models/equipment.model';

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
  | 'basic-staff'
  | 'magic-staff'
  | 'wooden-bow'
  | 'leather-armor'
  | 'iron-armor'
  | 'steel-armor';

export type MonsterAssetType = 'goblin' | 'wolf' | 'skeleton' | 'orc' | 'troll' | 'dragon';

export type RarityColor = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

// Configurações base dos assets
const ASSET_BASE_PATH = '/src/assets';

/**
 * Classe principal para gerenciamento de assets
 */
export class AssetManager {
  private static iconCache = new Map<string, string>();

  /**
   * Obter ícone de consumível baseado no tipo e descrição
   */
  static getConsumableIcon(consumable: Consumable): string {
    const cacheKey = `consumable-${consumable.id}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    let iconPath: string;

    if (consumable.type === 'potion') {
      if (consumable.description.includes('HP') || consumable.description.includes('Vida')) {
        if (consumable.effect_value <= 30) {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-small.png`;
        } else if (consumable.effect_value <= 60) {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-medium.png`;
        } else {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-large.png`;
        }
      } else if (consumable.description.includes('Mana')) {
        if (consumable.effect_value <= 15) {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/mana-potion-small.png`;
        } else if (consumable.effect_value <= 30) {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/mana-potion-medium.png`;
        } else {
          iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/mana-potion-large.png`;
        }
      } else {
        iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-small.png`;
      }
    } else if (consumable.type === 'buff') {
      if (consumable.description.includes('Força') || consumable.description.includes('ataque')) {
        iconPath = `${ASSET_BASE_PATH}/icons/consumables/elixirs/strength-elixir.png`;
      } else if (consumable.description.includes('Defesa')) {
        iconPath = `${ASSET_BASE_PATH}/icons/consumables/elixirs/defense-elixir.png`;
      } else {
        iconPath = `${ASSET_BASE_PATH}/icons/consumables/elixirs/strength-elixir.png`;
      }
    } else if (consumable.type === 'antidote') {
      iconPath = `${ASSET_BASE_PATH}/icons/consumables/antidotes/antidote.png`;
    } else {
      iconPath = `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-small.png`;
    }

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
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
    const basePath = `${ASSET_BASE_PATH}/icons/equipment`;

    switch (equipment.type) {
      case 'weapon':
        if (
          equipment.name.toLowerCase().includes('espada') ||
          equipment.name.toLowerCase().includes('sword')
        ) {
          if (equipment.level_requirement <= 5) {
            iconPath = `${basePath}/weapons/swords/wooden-sword.png`;
          } else if (equipment.level_requirement <= 15) {
            iconPath = `${basePath}/weapons/swords/iron-sword.png`;
          } else {
            iconPath = `${basePath}/weapons/swords/steel-sword.png`;
          }
        } else if (
          equipment.name.toLowerCase().includes('cajado') ||
          equipment.name.toLowerCase().includes('staff')
        ) {
          iconPath =
            equipment.level_requirement <= 10
              ? `${basePath}/weapons/staffs/basic-staff.png`
              : `${basePath}/weapons/staffs/magic-staff.png`;
        } else if (
          equipment.name.toLowerCase().includes('arco') ||
          equipment.name.toLowerCase().includes('bow')
        ) {
          iconPath = `${basePath}/weapons/bows/wooden-bow.png`;
        } else {
          iconPath = `${basePath}/weapons/swords/iron-sword.png`;
        }
        break;

      case 'armor':
        if (equipment.level_requirement <= 5) {
          iconPath = `${basePath}/armor/chest/leather-armor.png`;
        } else if (equipment.level_requirement <= 15) {
          iconPath = `${basePath}/armor/chest/iron-armor.png`;
        } else {
          iconPath = `${basePath}/armor/chest/steel-armor.png`;
        }
        break;

      case 'accessory':
        if (
          equipment.name.toLowerCase().includes('anel') ||
          equipment.name.toLowerCase().includes('ring')
        ) {
          iconPath = `${basePath}/accessories/rings/basic-ring.png`;
        } else if (
          equipment.name.toLowerCase().includes('amuleto') ||
          equipment.name.toLowerCase().includes('amulet')
        ) {
          iconPath = `${basePath}/accessories/amulets/basic-amulet.png`;
        } else {
          iconPath = `${basePath}/accessories/trinkets/basic-trinket.png`;
        }
        break;

      default:
        iconPath = `${basePath}/weapons/swords/iron-sword.png`;
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
   * Obter frame de animação de personagem
   */
  static getCharacterAnimationFrame(
    character: string,
    animation: string,
    frameNumber: number
  ): string {
    const cacheKey = `character-${character}-${animation}-${frameNumber}`;

    if (this.iconCache.has(cacheKey)) {
      return this.iconCache.get(cacheKey)!;
    }

    const frameStr = frameNumber.toString().padStart(2, '0');
    const iconPath = `${ASSET_BASE_PATH}/characters/${character}/${animation}/${character}-${animation}-${frameStr}.png`;

    this.iconCache.set(cacheKey, iconPath);
    return iconPath;
  }

  /**
   * Limpar cache de assets
   */
  static clearCache(): void {
    this.iconCache.clear();
  }

  /**
   * Pré-carregar assets críticos
   */
  static async preloadCriticalAssets(): Promise<void> {
    const criticalAssets = [
      // Poções básicas
      `${ASSET_BASE_PATH}/icons/consumables/potions/health-potion-small.png`,
      `${ASSET_BASE_PATH}/icons/consumables/potions/mana-potion-small.png`,

      // Equipamentos básicos
      `${ASSET_BASE_PATH}/icons/equipment/weapons/swords/wooden-sword.png`,
      `${ASSET_BASE_PATH}/icons/equipment/armor/chest/leather-armor.png`,

      // UI essencial
      `${ASSET_BASE_PATH}/icons/ui/buttons/primary-button.png`,
      `${ASSET_BASE_PATH}/icons/ui/frames/inventory-frame.png`,
    ];

    const loadPromises = criticalAssets.map(assetPath => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load ${assetPath}`));
        img.src = assetPath;
      });
    });

    try {
      await Promise.all(loadPromises);
      console.log('✅ Critical assets preloaded successfully');
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
