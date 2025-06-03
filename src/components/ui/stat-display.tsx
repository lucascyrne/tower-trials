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
  const hasBonus = equipmentBonus && equipmentBonus > 0;
  const calculatedBaseValue = baseValue ?? (hasBonus ? value - equipmentBonus : value);
  
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

  if (!hasBonus) {
    return (
      <span className={`${sizeClasses[size]} ${className}`}>
        {value}
      </span>
    );
  }

  return (
    <span 
      className={`${sizeClasses[size]} ${className} ${showTooltip ? 'cursor-help' : ''}`}
      title={showTooltip ? `Base: ${calculatedBaseValue} + Equipamentos: ${equipmentBonus} = Total: ${value}` : undefined}
    >
      {calculatedBaseValue}
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
  const hasBonus = equipmentBonus && equipmentBonus > 0;
  
  return (
    <div className={`bg-card p-3 rounded-lg border ${hasBonus ? 'border-green-500/20 bg-green-500/5' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className={`text-sm font-medium ${color}`}>{label}</span>
      </div>
      <div className={size === 'lg' ? 'text-2xl font-bold' : size === 'md' ? 'text-xl font-bold' : 'text-lg font-bold'}>
        <StatDisplay 
          value={value}
          baseValue={baseValue}
          equipmentBonus={equipmentBonus}
          className={color}
          showTooltip={showTooltip}
          size={size}
        />
      </div>
      {hasBonus && showTooltip && (
        <div className="text-xs text-muted-foreground mt-1">
          Base: {baseValue ?? (value - equipmentBonus!)} + Equipamentos: {equipmentBonus}
        </div>
      )}
    </div>
  );
} 