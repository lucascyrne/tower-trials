import { useState } from 'react';
import { type Consumable } from '@/models/consumable.model';
import { getConsumableImagePath, getConsumableIcon } from '@/utils/consumable-utils';

// Import direto das imagens de consumíveis para garantir que funcionem em produção
import smallHealthPotion from '@/assets/icons/consumables/small_health_potion.png';
import smallManaPotion from '@/assets/icons/consumables/small_mana_potion.png';

interface ConsumableImageProps {
  consumable: Consumable;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function ConsumableImage({
  consumable,
  size = 'md',
  className = '',
  showFallback = true,
}: ConsumableImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Função para obter imagem com fallback para imports diretos
  const getConsumableImageSrc = (consumable: Consumable): string => {
    const normalizedName = consumable.name.toLowerCase().trim();

    // Mapear nomes conhecidos para imports diretos
    if (
      normalizedName.includes('vida') ||
      normalizedName.includes('hp') ||
      normalizedName.includes('health')
    ) {
      return smallHealthPotion;
    }
    if (normalizedName.includes('mana') || normalizedName.includes('mp')) {
      return smallManaPotion;
    }

    // Fallback para o sistema antigo
    return getConsumableImagePath(consumable);
  };

  const imagePath = getConsumableImageSrc(consumable);
  const fallbackIcon = getConsumableIcon(consumable);

  const handleImageLoad = () => {
    setIsLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setImageError(true);
  };

  const baseClasses = `${sizeClasses[size]} ${className}`;

  if (imageError && showFallback) {
    // Fallback para emoji quando a imagem não carrega
    return (
      <div
        className={`${baseClasses} flex items-center justify-center text-slate-500`}
        title={`${consumable.name} (fallback)`}
      >
        <span className="text-sm">{fallbackIcon}</span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} relative`}>
      {isLoading && <div className="absolute inset-0 bg-slate-700/50 animate-pulse rounded" />}
      <img
        src={imagePath}
        alt={consumable.name}
        className={`${baseClasses} object-contain ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
}
