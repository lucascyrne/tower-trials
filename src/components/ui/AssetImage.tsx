import React from 'react';
import { AssetManager, useAsset, type AssetCategory } from '@/utils/asset-utils';

interface AssetImageProps {
  src: string;
  alt: string;
  fallbackCategory: AssetCategory;
  className?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  loading?: 'lazy' | 'eager';
  onError?: () => void;
  onLoad?: () => void;
}

const sizeClasses = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

/**
 * Componente para exibir assets com fallback automático
 */
export const AssetImage: React.FC<AssetImageProps> = ({
  src,
  alt,
  fallbackCategory,
  className = '',
  size = 'md',
  loading = 'lazy',
  onError,
  onLoad,
}) => {
  const { asset, isLoading, hasError } = useAsset(src, fallbackCategory);

  const handleError = () => {
    onError?.();
  };

  const handleLoad = () => {
    onLoad?.();
  };

  if (isLoading) {
    return (
      <div
        className={`${sizeClasses[size]} ${className} bg-slate-700 animate-pulse rounded`}
        aria-label="Carregando asset..."
      />
    );
  }

  return (
    <img
      src={asset}
      alt={alt}
      className={`${sizeClasses[size]} ${className} object-cover`}
      loading={loading}
      onError={handleError}
      onLoad={handleLoad}
      data-error={hasError}
    />
  );
};

/**
 * Componente específico para ícones de consumíveis
 */
interface ConsumableIconProps {
  consumable: import('@/models/consumable.model').Consumable;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const ConsumableIcon: React.FC<ConsumableIconProps> = ({
  consumable,
  size = 'md',
  className = '',
}) => {
  const iconPath = AssetManager.getConsumableIcon(consumable);

  return (
    <AssetImage
      src={iconPath}
      alt={consumable.name}
      fallbackCategory="icons"
      size={size}
      className={className}
    />
  );
};

/**
 * Componente específico para ícones de equipamentos
 */
interface EquipmentIconProps {
  equipment: import('@/models/equipment.model').Equipment;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const EquipmentIcon: React.FC<EquipmentIconProps> = ({
  equipment,
  size = 'md',
  className = '',
}) => {
  const iconPath = AssetManager.getEquipmentIcon(equipment);

  return (
    <AssetImage
      src={iconPath}
      alt={equipment.name}
      fallbackCategory="icons"
      size={size}
      className={className}
    />
  );
};

/**
 * Componente específico para retratos de monstros
 */
interface MonsterPortraitProps {
  monsterName: string;
  floor: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const MonsterPortrait: React.FC<MonsterPortraitProps> = ({
  monsterName,
  floor,
  size = 'lg',
  className = '',
}) => {
  const portraitPath = AssetManager.getMonsterPortrait(monsterName, floor);

  return (
    <AssetImage
      src={portraitPath}
      alt={monsterName}
      fallbackCategory="monsters"
      size={size}
      className={className}
    />
  );
};

/**
 * Componente para backgrounds de ambiente
 */
interface EnvironmentBackgroundProps {
  location: 'tower' | 'hub' | 'menu';
  variant: string;
  className?: string;
  children?: React.ReactNode;
}

export const EnvironmentBackground: React.FC<EnvironmentBackgroundProps> = ({
  location,
  variant,
  className = '',
  children,
}) => {
  const backgroundPath = AssetManager.getEnvironmentBackground(location, variant);
  const { asset, isLoading } = useAsset(backgroundPath, 'environments');

  if (isLoading) {
    return <div className={`bg-slate-800 animate-pulse ${className}`}>{children}</div>;
  }

  return (
    <div
      className={`bg-cover bg-center bg-no-repeat ${className}`}
      style={{ backgroundImage: `url(${asset})` }}
    >
      {children}
    </div>
  );
};

/**
 * Componente específico para animações de personagens
 */
interface CharacterAnimationProps {
  character: string;
  animation: string;
  frameNumber: number;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const CharacterAnimation: React.FC<CharacterAnimationProps> = ({
  character,
  animation,
  frameNumber,
  size = 'md',
  className = '',
}) => {
  const animationPath = AssetManager.getCharacterAnimationFrame(character, animation, frameNumber);

  return (
    <AssetImage
      src={animationPath}
      alt={`${character} ${animation} animation`}
      fallbackCategory="characters"
      size={size}
      className={className}
    />
  );
};
