'use client';

import {
  Menu,
  User,
  Trophy,
  Scroll,
  LogOut,
  Swords,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import { useTheme } from 'next-themes';

const getMenuItemsByRole = (role?: string) => {
  const baseItems = [
    {
      href: '/game',
      icon: Swords,
      label: 'Jogar',
    },
    {
      href: '/ranking',
      icon: Trophy,
      label: 'Ranking',
    },
    {
      href: '/guia',
      icon: Scroll,
      label: 'Guia',
    },
  ];

  switch (role) {
    case 'ADMIN':
      return [
        ...baseItems,
        {
          href: '/admin',
          icon: User,
          label: 'Admin',
        },
      ];
    default:
      return baseItems;
  }
};

interface HeaderProps {
  userName: string;
}

export function Header({ userName }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const menuItems = getMenuItemsByRole(user?.role);

  return (
    <header className="flex w-full flex-col bg-gradient-to-b from-background/90 to-background/70 border-b border-border">
      {/* Barra superior com usuário e botão do menu */}
      <div className="flex w-full items-center justify-between px-4 py-3">
        <Link href="/" className="group">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 group-hover:from-purple-500 group-hover:to-pink-700 transition-colors">
            Tower Trials
          </h1>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-sm">{userName}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-primary transition-colors"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Link href="/perfil">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
              <User className="h-5 w-5" />
            </Button>
          </Link>
          <Link href="/logout">
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors">
              <LogOut className="h-5 w-5" />
            </Button>
          </Link>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary transition-colors lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] bg-background border-r border-border p-0">
              <SheetHeader className="border-b border-border p-4">
                <SheetTitle>Menu Principal</SheetTitle>
              </SheetHeader>
              <div className="flex flex-col py-2">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent ${
                        isActive ? 'bg-accent text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  );
                })}
                
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent text-muted-foreground"
                >
                  {theme === 'dark' ? (
                    <>
                      <Sun className="h-5 w-5" />
                      <span className="text-sm font-medium">Modo Claro</span>
                    </>
                  ) : (
                    <>
                      <Moon className="h-5 w-5" />
                      <span className="text-sm font-medium">Modo Escuro</span>
                    </>
                  )}
                </button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Navegação desktop */}
      <nav className="hidden border-t border-border lg:block">
        <div className="flex items-center justify-center gap-1 px-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-md px-4 py-3 transition-colors hover:bg-accent ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
