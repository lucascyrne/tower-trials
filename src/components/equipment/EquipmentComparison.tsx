import React, { useEffect, useState } from 'react';
import { type Equipment, type EquipmentComparison as EquipmentComparisonType, compareEquipment } from '@/resources/game/models/equipment.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { FaArrowUp, FaArrowDown, FaEquals, FaSpinner } from 'react-icons/fa';

interface EquipmentComparisonProps {
  characterId: string;
  newEquipment: Equipment;
  slotType?: string;
  currentEquipment?: Equipment | null;
  showTitle?: boolean;
  compact?: boolean;
}

export const EquipmentComparison: React.FC<EquipmentComparisonProps> = ({
  characterId,
  newEquipment,
  slotType,
  currentEquipment,
  showTitle = true,
  compact = false
}) => {
  const [comparisons, setComparisons] = useState<EquipmentComparisonType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparison = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Se temos o equipamento atual, usar comparação local
        if (currentEquipment !== undefined) {
          const localComparisons = compareEquipment(currentEquipment, newEquipment);
          setComparisons(localComparisons);
        } else {
          // Caso contrário, usar o service que faz RPC call
          const response = await EquipmentService.compareEquipmentStats(
            characterId,
            newEquipment.id,
            slotType
          );

          if (response.success && response.data) {
            const formattedComparisons: EquipmentComparisonType[] = response.data.map(item => ({
              stat_name: item.stat_name,
              current_value: item.current_value,
              new_value: item.new_value,
              difference: item.difference,
              is_improvement: item.is_improvement
            }));
            setComparisons(formattedComparisons);
          } else {
            setError(response.error || 'Erro ao comparar equipamentos');
          }
        }
      } catch (err) {
        console.error('Erro ao carregar comparação:', err);
        setError('Erro ao carregar comparação');
      } finally {
        setIsLoading(false);
      }
    };

    loadComparison();
  }, [characterId, newEquipment.id, slotType, currentEquipment]);

  const getChangeIcon = (isImprovement: boolean, difference: number) => {
    if (difference === 0) return <FaEquals className="text-gray-400" />;
    return isImprovement ? (
      <FaArrowUp className="text-green-500" />
    ) : (
      <FaArrowDown className="text-red-500" />
    );
  };

  const getChangeText = (difference: number, isImprovement: boolean) => {
    if (difference === 0) return '';
    const sign = isImprovement ? '+' : '';
    return `${sign}${difference.toFixed(difference % 1 === 0 ? 0 : 2)}`;
  };

  const getChangeColor = (isImprovement: boolean, difference: number) => {
    if (difference === 0) return 'text-gray-400';
    return isImprovement ? 'text-green-500' : 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} border rounded-lg bg-gray-50`}>
        <div className="flex items-center justify-center space-x-2">
          <FaSpinner className="animate-spin text-blue-500" />
          <span className="text-sm text-gray-600">Carregando comparação...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} border rounded-lg bg-red-50 border-red-200`}>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div className={`${compact ? 'p-2' : 'p-4'} border rounded-lg bg-gray-50`}>
        <p className="text-sm text-gray-600">
          {currentEquipment === null ? 'Nenhum equipamento equipado atualmente' : 'Nenhuma mudança nos atributos'}
        </p>
      </div>
    );
  }

  return (
    <div className={`${compact ? 'p-2' : 'p-4'} border rounded-lg bg-white`}>
      {showTitle && (
        <h4 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-gray-800 mb-2`}>
          Comparação de Atributos
        </h4>
      )}
      
      <div className="space-y-1">
        {comparisons.map((comparison, index) => (
          <div
            key={index}
            className={`flex items-center justify-between ${compact ? 'text-xs' : 'text-sm'} py-1`}
          >
            <span className="text-gray-700 font-medium">
              {comparison.stat_name}:
            </span>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">
                {comparison.current_value.toFixed(comparison.current_value % 1 === 0 ? 0 : 2)}
              </span>
              
              <div className="flex items-center space-x-1">
                {getChangeIcon(comparison.is_improvement, comparison.difference)}
                <span className={getChangeColor(comparison.is_improvement, comparison.difference)}>
                  {getChangeText(comparison.difference, comparison.is_improvement)}
                </span>
              </div>
              
              <span className="text-gray-800 font-semibold">
                {comparison.new_value.toFixed(comparison.new_value % 1 === 0 ? 0 : 2)}
              </span>
            </div>
          </div>
        ))}
      </div>
      
      {!compact && (
        <div className="mt-3 pt-2 border-t border-gray-200">
          <div className="flex items-center space-x-4 text-xs text-gray-500">
            <div className="flex items-center space-x-1">
              <FaArrowUp className="text-green-500" />
              <span>Melhoria</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaArrowDown className="text-red-500" />
              <span>Redução</span>
            </div>
            <div className="flex items-center space-x-1">
              <FaEquals className="text-gray-400" />
              <span>Sem mudança</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 