import { useState } from 'react';
import { type Consumable } from '@/models/consumable.model';
import { getConsumableImagePath, getConsumableIcon } from '@/utils/consumable-utils';

// Import direto das imagens de consumíveis para garantir que funcionem em produção
import smallHealthPotion from '@/assets/icons/consumables/small_health_potion.png';
import smallManaPotion from '@/assets/icons/consumables/small_mana_potion.png';
import mediumHealthPotion from '@/assets/icons/consumables/medium_health_potion.png';
import mediumManaPotion from '@/assets/icons/consumables/medium_mana_potion.png';
import largeManaPotion from '@/assets/icons/consumables/large_mana_potion.png';
import strengthElixir from '@/assets/icons/consumables/strength_elixir.png';
import defenseElixir from '@/assets/icons/consumables/defense_elixir.png';
import antidote from '@/assets/icons/consumables/antidote.png';

interface ConsumableImageProps {
  consumable: Consumable;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  sm: 'h-6 w-6',      // 24px
  md: 'h-8 w-8',      // 32px
  lg: 'h-12 w-12',    // 48px
  xl: 'h-16 w-16',    // 64px
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
  // Prioridade: match exato > match por tipo e tamanho > fallback
  const getConsumableImageSrc = (consumable: Consumable): string => {
    const normalizedName = consumable.name.toLowerCase().trim();

    // IMPORTANTE: Mapa de nomes exatos para imagens (prioridade máxima)
    // CADA ITEM DIFERENTE DEVE TER APENAS UMA IMAGEM OU NENHUMA
    // NÃO reutilize imagens para múltiplos items diferentes - isso é um erro crítico!
    const exactMatches: Record<string, string> = {
      // 🔴 Poções de Vida (3 tipos, cada uma com sua imagem)
      'poção de vida pequena': smallHealthPotion,
      'pequena poção de vida': smallHealthPotion,
      'small health potion': smallHealthPotion,
      'poção de hp pequena': smallHealthPotion,
      
      'poção de vida média': mediumHealthPotion,
      'média poção de vida': mediumHealthPotion,
      'medium health potion': mediumHealthPotion,
      'poção de hp média': mediumHealthPotion,
      
      'poção de vida grande': largeManaPotion, // Nota: usa large_mana_potion.png (único arquivo grande)
      'grande poção de vida': largeManaPotion,
      'large health potion': largeManaPotion,
      'poção de hp grande': largeManaPotion,

      // 🔵 Poções de Mana (3 tipos, cada uma com sua imagem)
      'poção de mana pequena': smallManaPotion,
      'pequena poção de mana': smallManaPotion,
      'small mana potion': smallManaPotion,
      'poção de mp pequena': smallManaPotion,
      
      'poção de mana média': mediumManaPotion,
      'média poção de mana': mediumManaPotion,
      'medium mana potion': mediumManaPotion,
      'poção de mp média': mediumManaPotion,
      
      'poção de mana grande': largeManaPotion,
      'grande poção de mana': largeManaPotion,
      'large mana potion': largeManaPotion,
      'poção de mp grande': largeManaPotion,

      // ⚡ Elixires (2 tipos, cada um com sua imagem)
      'elixir de força': strengthElixir,
      'strength elixir': strengthElixir,
      
      'elixir de defesa': defenseElixir,
      'defense elixir': defenseElixir,

      // 🧪 Antídoto (1 tipo)
      'antídoto': antidote,
      'antidote': antidote,
    };

    // Se encontrar match exato, usar
    if (exactMatches[normalizedName]) {
      return exactMatches[normalizedName];
    }

    // Fallback com lógica fuzzy baseada em tipo e tamanho (menos específico)
    if (normalizedName.includes('elixir')) {
      if (normalizedName.includes('força') || normalizedName.includes('strength')) {
        return strengthElixir;
      }
      if (normalizedName.includes('defesa') || normalizedName.includes('defense')) {
        return defenseElixir;
      }
    }

    if (normalizedName.includes('antídoto') || normalizedName.includes('antidote')) {
      return antidote;
    }

    // Poções de Vida
    if (normalizedName.includes('vida') || normalizedName.includes('health') || normalizedName.includes('hp')) {
      if (normalizedName.includes('grande') || normalizedName.includes('large')) {
        return largeManaPotion;
      }
      if (normalizedName.includes('média') || normalizedName.includes('medium')) {
        return mediumHealthPotion;
      }
      return smallHealthPotion;
    }

    // Poções de Mana
    if (normalizedName.includes('mana') || normalizedName.includes('mp')) {
      if (normalizedName.includes('grande') || normalizedName.includes('large')) {
        return largeManaPotion;
      }
      if (normalizedName.includes('média') || normalizedName.includes('medium')) {
        return mediumManaPotion;
      }
      return smallManaPotion;
    }

    // Fallback final para o sistema antigo
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
