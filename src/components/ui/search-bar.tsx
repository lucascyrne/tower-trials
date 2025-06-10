import { Search } from 'lucide-react';
import { Input } from './input';

interface SearchBarProps {
  placeholder?: string;
  onChange: (value: string) => void;
}

export function SearchBar({ placeholder = 'Buscar...', onChange }: SearchBarProps) {
  return (
    <div className="relative w-full">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
        <Search className="w-4 h-4 text-neutral-500" />
      </div>
      <Input
        type="search"
        className="pl-10 w-full"
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
