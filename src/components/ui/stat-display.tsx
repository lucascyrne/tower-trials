import React from 'react';

interface StatDisplayProps {
  value: number;
  baseValue?: number;
  equipmentBonus?: number;
  className?: string;
  showTooltip?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function StatDisplay({ 
  value, 
  baseValue, 
  equipmentBonus, 
  className = '', 
  showTooltip = false,
  size = 'md' 
}: StatDisplayProps) {
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg font-bold'
  };

  const bonusClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  // CRÍTICO: Só mostrar breakdown se há valores válidos para equipmentBonus e baseValue
  const hasValidBonus = equipmentBonus !== undefined && equipmentBonus > 0;
  const hasValidBase = baseValue !== undefined && baseValue !== null;

  if (!hasValidBonus || !hasValidBase) {
    return (
      <span className={`${sizeClasses[size]} ${className}`}>
        {value}
      </span>
    );
  }

  return (
    <span 
      className={`${sizeClasses[size]} ${className} ${showTooltip ? 'cursor-help' : ''}`}
      title={showTooltip ? `Base: ${baseValue} + Equipamentos: ${equipmentBonus} = Total: ${value}` : undefined}
    >
      {baseValue}
      <span className={`text-green-400 ml-1 ${bonusClasses[size]}`}>
        (+{equipmentBonus})
      </span>
    </span>
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
  size = 'md'
}: StatCardProps) {
  // CRÍTICO: Só mostrar breakdown se há bônus real de equipamentos
  const hasEquipmentBonus = equipmentBonus !== undefined && equipmentBonus > 0;
  
  return (
    <div className={`bg-card p-3 rounded-lg border ${hasEquipmentBonus ? 'border-green-500/20 bg-green-500/5' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>
      <div className={size === 'lg' ? 'text-2xl font-bold' : size === 'md' ? 'text-xl font-bold' : 'text-lg font-bold'}>
        {hasEquipmentBonus && baseValue !== undefined ? (
          <StatDisplay 
            value={value}
            baseValue={baseValue}
            equipmentBonus={equipmentBonus}
            className={color}
            showTooltip={showTooltip}
            size={size}
          />
        ) : (
          <span className={color}>
            {value}
          </span>
        )}
      </div>
      {hasEquipmentBonus && baseValue !== undefined && showTooltip && (
        <div className="text-xs text-muted-foreground mt-1">
          Base: {baseValue} + Equipamentos: +{equipmentBonus}
        </div>
      )}
      {(!hasEquipmentBonus || baseValue === undefined) && showTooltip && (
        <div className="text-xs text-muted-foreground mt-1">
          Valor total calculado
        </div>
      )}
    </div>
  );
} 