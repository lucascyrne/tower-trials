import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Plus } from 'lucide-react';
import { type AttributeModification } from '@/resources/game/models/spell.model';

interface StatDisplayProps {
  value: number;
  baseValue?: number;
  equipmentBonus?: number;
  modifications?: AttributeModification[];
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function StatDisplay({
  value,
  baseValue,
  equipmentBonus = 0,
  modifications = [],
  size = 'md',
  showTooltip = false,
  label,
  icon,
  className = '',
}: StatDisplayProps) {
  // CRÍTICO: Garantir que o valor seja válido, senão usar 0
  const safeValue = isNaN(value) || value === undefined || value === null ? 0 : value;
  const safeBaseValue =
    isNaN(baseValue || 0) || baseValue === undefined || baseValue === null ? 0 : baseValue || 0;
  const safeEquipmentBonus =
    isNaN(equipmentBonus) || equipmentBonus === undefined ? 0 : equipmentBonus;

  // Calcular modificações totais das magias
  const magicModifications = modifications.reduce((total, mod) => {
    if (mod.type === 'flat') {
      return total + (isNaN(mod.value) ? 0 : mod.value);
    } else {
      // Para percentual, aplicar sobre o valor base
      const baseForPercentage = safeBaseValue || safeValue;
      return total + baseForPercentage * ((isNaN(mod.value) ? 0 : mod.value) / 100);
    }
  }, 0);

  // Verificar se há modificações ativas
  const hasModifications = modifications.length > 0;
  //const totalModifications = safeEquipmentBonus + magicModifications;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const content = (
    <div className={`inline-flex items-center gap-1 ${sizeClasses[size]} ${className}`}>
      {icon && <span className="inline-flex">{icon}</span>}
      <span
        className={`font-bold transition-all duration-300 ${
          hasModifications
            ? 'text-purple-400 animate-pulse drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
            : safeEquipmentBonus > 0
              ? 'text-green-400'
              : ''
        }`}
      >
        {Math.round(safeValue)}
      </span>

      {/* Indicador visual de modificações mágicas */}
      {hasModifications && (
        <div className="inline-flex items-center">
          <div className="w-1 h-1 bg-purple-400 rounded-full animate-pulse" />
          <div className="ml-1 text-purple-300 text-xs animate-bounce">
            {magicModifications > 0 ? '+' : ''}
            {Math.round(magicModifications)}
          </div>
        </div>
      )}

      {label && <span className="text-muted-foreground ml-1">{label}</span>}
    </div>
  );

  if (!showTooltip) {
    return content;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent className="max-w-xs p-3">
          <div className="space-y-2">
            <div className="font-semibold text-sm">Detalhes da Estatística</div>

            {baseValue !== undefined && !isNaN(safeBaseValue) && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Base:</span>
                <span>{Math.round(safeBaseValue)}</span>
              </div>
            )}

            {safeEquipmentBonus > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Equipamentos:</span>
                <span className="text-green-400 flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  {Math.round(safeEquipmentBonus)}
                </span>
              </div>
            )}

            {/* Modificações mágicas detalhadas */}
            {modifications.length > 0 && (
              <div className="space-y-1">
                <div className="text-xs font-medium text-purple-400 border-t border-border pt-2">
                  Efeitos Mágicos:
                </div>
                {modifications.map((mod, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-purple-300 flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                      {mod.source_spell}
                    </span>
                    <span className="text-purple-400 flex items-center gap-1">
                      {mod.value > 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      {mod.value > 0 ? '+' : ''}
                      {mod.value}
                      {mod.type === 'percentage' ? '%' : ''}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between text-xs pt-1 border-t border-purple-500/20">
                  <span className="text-purple-300">Total Mágico:</span>
                  <span className="text-purple-400 font-medium">
                    {magicModifications > 0 ? '+' : ''}
                    {Math.round(magicModifications)}
                  </span>
                </div>
              </div>
            )}

            <div className="flex justify-between text-xs font-medium pt-2 border-t border-border">
              <span>Total:</span>
              <span className={`${hasModifications ? 'text-purple-400' : 'text-foreground'}`}>
                {Math.round(safeValue)}
              </span>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  baseValue?: number;
  equipmentBonus?: number;
  icon?: React.ReactNode;
  color?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatCard({
  label,
  value,
  baseValue,
  equipmentBonus,
  icon,
  color = 'text-foreground',
  showTooltip = true,
  size = 'md',
}: StatCardProps) {
  // CRÍTICO: Verificar valores válidos e tratar NaN
  const safeValue = isNaN(value) || value === undefined || value === null ? 0 : value;
  const safeBaseValue =
    isNaN(baseValue || 0) || baseValue === undefined || baseValue === null ? 0 : baseValue || 0;
  const safeEquipmentBonus =
    isNaN(equipmentBonus || 0) || equipmentBonus === undefined ? 0 : equipmentBonus || 0;

  // CRÍTICO: Só mostrar breakdown se há bônus real de equipamentos
  const hasEquipmentBonus = safeEquipmentBonus > 0;

  return (
    <div
      className={`bg-card p-3 rounded-lg border ${hasEquipmentBonus ? 'border-green-500/20 bg-green-500/5' : ''}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>
      <div
        className={
          size === 'lg'
            ? 'text-2xl font-bold'
            : size === 'md'
              ? 'text-xl font-bold'
              : 'text-lg font-bold'
        }
      >
        {hasEquipmentBonus && baseValue !== undefined ? (
          <StatDisplay
            value={safeValue}
            baseValue={safeBaseValue}
            equipmentBonus={safeEquipmentBonus}
            className={color}
            showTooltip={showTooltip}
            size={size}
          />
        ) : (
          <span className={color}>{Math.round(safeValue)}</span>
        )}
      </div>
      {hasEquipmentBonus && baseValue !== undefined && showTooltip && (
        <div className="text-xs text-muted-foreground mt-1">
          Base: {Math.round(safeBaseValue)} + Equipamentos: +{Math.round(safeEquipmentBonus)}
        </div>
      )}
      {(!hasEquipmentBonus || baseValue === undefined) && showTooltip && (
        <div className="text-xs text-muted-foreground mt-1">Valor total calculado</div>
      )}
    </div>
  );
}
