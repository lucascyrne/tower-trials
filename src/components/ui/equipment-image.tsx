import { useState } from 'react';
import type { Equipment } from '@/resources/equipment/equipment.model';
import { AssetManager } from '@/utils/asset-utils';

// Import direto de ícones de equipamentos para garantir funcionamento em produção
import ironSword from '@/assets/icons/weapons/iron_sword.png';
import steelSword from '@/assets/icons/weapons/steel_sword.png';
import woodenStaff from '@/assets/icons/weapons/wooden_staff.png';
import oakStaff from '@/assets/icons/weapons/oak_staff.png';
import bronzeDagger from '@/assets/icons/weapons/bronze_dagger.png';
import battleAxe from '@/assets/icons/weapons/battle_axe.png';
import leatherArmor from '@/assets/icons/armors/leather_armor.png';
import chainmailArmor from '@/assets/icons/armors/chainmail_armor.png';
import scaleArmor from '@/assets/icons/armors/scale_armor.png';
import apprenticeRobe from '@/assets/icons/armors/apprentice_robe.png';
import occultistCloak from '@/assets/icons/armors/occultist_cloak.png';
import lightVestments from '@/assets/icons/armors/light_vestments.png';
import swiftBoots from '@/assets/icons/armors/swift_boots.png';
import strengthRing from '@/assets/icons/accessories/strength_ring.png';
import manaRing from '@/assets/icons/accessories/mana_ring.png';
import protectionAmulet from '@/assets/icons/accessories/protection_amulet.png';
import arcaneAmulet from '@/assets/icons/accessories/arcane_amulet.png';
import defensiveBracers from '@/assets/icons/accessories/defensive_bracers.png';

interface EquipmentImageProps {
  equipment: Equipment;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showFallback?: boolean;
}

const sizeClasses = {
  sm: 'h-6 w-6', // 24px
  md: 'h-8 w-8', // 32px
  lg: 'h-12 w-12', // 48px
  xl: 'h-16 w-16', // 64px
};

// IMPORTANTE: Este mapa contém APENAS items que têm suas imagens reais específicas.
// Items sem imagens caem automaticamente para AssetManager.getEquipmentIcon() (fallback).
// NÃO reutilize imagens para múltiplos items - isso é um erro crítico!
const EQUIPMENT_ASSET_MAP: Record<string, string> = {
  // ⚔️ ESPADAS COM IMAGENS REAIS (apenas items que têm arquivo .png específico)
  'espada de ferro': ironSword,
  'iron sword': ironSword,
  'espada de aço': steelSword,
  'steel sword': steelSword,

  // 🏹 CAJADOS/VARINHAS COM IMAGENS REAIS
  'varinha de madeira': woodenStaff,
  'wooden staff': woodenStaff,
  'cajado de carvalho': oakStaff,
  'oak staff': oakStaff,

  // 🗡️ ADAGAS COM IMAGENS REAIS
  'adaga de bronze': bronzeDagger,
  'bronze dagger': bronzeDagger,

  // 🪓 MACHADOS COM IMAGENS REAIS
  'machado de ferro': battleAxe,
  'machado de batalha': battleAxe,
  'battle axe': battleAxe,

  // 🛡️ ARMADURAS - PEITO COM IMAGENS REAIS (apenas base, sem variações)
  'armadura de couro': leatherArmor,
  'leather armor': leatherArmor,
  'armadura de malha': chainmailArmor,
  'chainmail armor': chainmailArmor,
  'armadura de escamas': scaleArmor,
  'scale armor': scaleArmor,

  // 👗 ROUPAS COM IMAGENS REAIS
  'túnica de aprendiz': apprenticeRobe,
  'apprentice robe': apprenticeRobe,
  'manto do ocultista': occultistCloak,
  'occultist cloak': occultistCloak,
  'vestes leves': lightVestments,
  'light vestments': lightVestments,

  // 👢 BOTAS COM IMAGENS REAIS (apenas base, sem variações)
  'botas velozes': swiftBoots,
  'swift boots': swiftBoots,

  // 💍 ANÉIS COM IMAGENS REAIS
  'anel de mana': manaRing,
  'mana ring': manaRing,
  'anel de força': strengthRing,
  'strength ring': strengthRing,

  // 📿 AMULETOS COM IMAGENS REAIS
  'amuleto de proteção': protectionAmulet,
  'protection amulet': protectionAmulet,
  'amuleto arcano': arcaneAmulet,
  'arcane amulet': arcaneAmulet,

  // 🔗 ACESSÓRIOS COM IMAGENS REAIS
  'braceletes de defesa': defensiveBracers,
  'defensive bracers': defensiveBracers,
};

export function EquipmentImage({
  equipment,
  size = 'md',
  className = '',
  showFallback = true,
}: EquipmentImageProps) {
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Função para obter imagem com fallback para imports diretos
  const getEquipmentImageSrc = (equipment: Equipment): string => {
    const normalizedName = equipment.name.toLowerCase().trim();

    // Mapear nomes conhecidos para imports diretos
    if (EQUIPMENT_ASSET_MAP[normalizedName]) {
      return EQUIPMENT_ASSET_MAP[normalizedName];
    }

    // Fallback para o sistema de path completo
    return AssetManager.getEquipmentIcon(equipment);
  };

  const imagePath = getEquipmentImageSrc(equipment);
  const fallbackEmoji = equipment.type === 'weapon' ? '⚔️' : '🛡️';

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
        title={`${equipment.name} (fallback)`}
      >
        <span className="text-sm">{fallbackEmoji}</span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} relative`}>
      {isLoading && <div className="absolute inset-0 bg-slate-700/50 animate-pulse rounded" />}
      <img
        src={imagePath}
        alt={equipment.name}
        className={`${baseClasses} object-contain ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-200`}
        onLoad={handleImageLoad}
        onError={handleImageError}
        loading="lazy"
      />
    </div>
  );
}
