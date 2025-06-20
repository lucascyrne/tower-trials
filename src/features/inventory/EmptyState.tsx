import React from 'react';
import { Card } from '@/components/ui/card';
import { Package, Zap, Sparkles, type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  type: 'equipment' | 'consumables' | 'drops';
  hasFilters?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, hasFilters = false }) => {
  const getConfig = (): { icon: LucideIcon; title: string; subtitle: string } => {
    switch (type) {
      case 'equipment':
        return {
          icon: Package,
          title: hasFilters
            ? 'Nenhum equipamento encontrado com os filtros aplicados'
            : 'Nenhum equipamento no inventário',
          subtitle: hasFilters
            ? 'Tente ajustar os filtros de busca'
            : 'Derrote inimigos para obter equipamentos',
        };
      case 'consumables':
        return {
          icon: Zap,
          title: 'Nenhum consumível no inventário',
          subtitle: 'Consumíveis podem ser comprados na loja ou encontrados em batalhas',
        };
      case 'drops':
        return {
          icon: Sparkles,
          title: 'Nenhum material no inventário',
          subtitle: 'Derrote monstros para obter materiais valiosos',
        };
    }
  };

  const { icon: Icon, title, subtitle } = getConfig();

  return (
    <Card className="p-8 bg-card/95 text-center">
      <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <p className="text-lg font-medium text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground mt-2">{subtitle}</p>
    </Card>
  );
};
