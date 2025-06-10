import { Plus } from 'lucide-react';
import { Button } from './button';

interface UnitListItem {
  id: string;
  name: string;
}

interface UnitListProps {
  items: UnitListItem[];
  onAdd: () => void;
  type: 'unit' | 'worker';
}

export function UnitList({ items, onAdd, type }: UnitListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {items.map(item => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 rounded-md text-sm"
          >
            <div className="w-6 h-6 bg-neutral-300 rounded-full flex items-center justify-center">
              <span className="text-xs">{item.id.slice(-2)}</span>
            </div>
            <span>{item.name}</span>
          </div>
        ))}
        <Button variant="outline" size="sm" className="flex items-center gap-1" onClick={onAdd}>
          <Plus className="h-3.5 w-3.5" />
          <span>Adicionar {type === 'unit' ? 'unidade' : 'funcionário'}</span>
        </Button>
      </div>
    </div>
  );
}
