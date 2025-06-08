import { Link } from '@tanstack/react-router';
import { type LucideIcon } from 'lucide-react';

interface NavButtonProps {
  href: string;
  icon: LucideIcon;
  label: string;
}

export function NavButton({ href, icon: Icon, label }: NavButtonProps) {
  return (
    <Link
      to={href}
      className="flex flex-col items-center justify-center gap-2 p-6 bg-white rounded-lg hover:bg-neutral-50 transition-colors border border-neutral-200"
    >
      <Icon className="w-6 h-6" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
  );
} 