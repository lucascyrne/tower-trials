import { useState } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useTooltipPosition } from '@/hooks/useTooltipPosition';

interface StatTooltipData {
  title: string;
  calculations: Array<{
    label: string;
    value: string | number;
    color: string;
  }>;
  total: {
    label: string;
    value: string | number;
    color: string;
  };
}

interface StatCardWithTooltipProps {
  icon: LucideIcon;
  label: string;
  value: string | number | React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
  tooltipData: StatTooltipData;
}

export function StatCardWithTooltip({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
  borderColor,
  tooltipData,
}: StatCardWithTooltipProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const { elementRef, tooltipPosition, updatePosition } = useTooltipPosition();

  const handleClick = () => {
    if (isMobile) {
      setIsModalOpen(true);
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      updatePosition();
    }
  };

  const TooltipContent = () => (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
      <div className="text-sm font-medium text-slate-200 mb-2">{tooltipData.title}</div>
      <div className="text-xs text-slate-300 font-mono space-y-1">
        {tooltipData.calculations.map((calc, index) => (
          <div key={index} className="flex justify-between">
            <span>{calc.label}</span>
            <span className={calc.color}>{calc.value}</span>
          </div>
        ))}
        <div className="border-t border-slate-600 pt-1 mt-1 flex justify-between font-bold">
          <span>{tooltipData.total.label}</span>
          <span className={tooltipData.total.color}>{tooltipData.total.value}</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div
        ref={elementRef}
        className={`p-3 rounded-lg border ${bgColor} ${borderColor} ${isMobile ? 'cursor-pointer' : 'cursor-help group'} relative`}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        title={isMobile ? `Toque para ver a fórmula de ${label}` : 'Clique para ver a fórmula'}
      >
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className={`text-sm font-medium ${color}`}>{label}</span>
        </div>
        <div className={`text-2xl font-bold ${color}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </div>

        {/* Desktop Tooltip */}
        {!isMobile && (
          <div
            className={`absolute z-50 invisible group-hover:visible min-w-[280px] ${
              tooltipPosition === 'left'
                ? 'right-full mr-2 -top-2' // Tooltip à esquerda
                : tooltipPosition === 'right'
                  ? 'left-full ml-2 -top-2' // Tooltip à direita
                  : 'top-full mt-2 left-1/2 transform -translate-x-1/2' // Tooltip abaixo centralizado
            }`}
          >
            <TooltipContent />
          </div>
        )}
      </div>

      {/* Mobile Modal */}
      {isMobile && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Icon className={`h-5 w-5 ${color}`} />
                Fórmula de {label}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              {tooltipData.calculations.map((calc, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{calc.label}</span>
                  <span className={`font-mono ${calc.color}`}>{calc.value}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>{tooltipData.total.label}</span>
                <span className={`${tooltipData.total.color}`}>{tooltipData.total.value}</span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
