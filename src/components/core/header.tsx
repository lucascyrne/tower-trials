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
import { PWAInstallButton } from '../PWAInstallButton';
import { Button } from '../ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '../ui/sheet';
import { useAuth } from '@/resources/auth/auth-hook';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useTheme } from '@/hooks/use-theme';

const getMenuItemsByRole = (role?: string, isInGamePages?: boolean) => {
  const baseItems = [
    // Só mostrar "Jogar" se não estiver nas páginas de jogo
    ...(isInGamePages ? [] : [{
      href: '/game',
      icon: Swords,
      label: 'Jogar',
    }]),
    {
      href: '/game/ranking',
      icon: Trophy,
      label: 'Ranking',
    },
    {
      href: '/game/guide',
      icon: Scroll,
      label: 'Guia',
    },
  ];

  switch (role) {
    case 'ADMIN':
      return [
        ...baseItems,
        {
          href: '/users',
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
  const location = useLocation();
  const navigate = useNavigate();
  const pathname = location.pathname;
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  
  // Verificar se está nas páginas de jogo
  const isInGamePages = pathname.startsWith('/game/play/');
  const menuItems = getMenuItemsByRole(user?.role, isInGamePages);

  const handleNavigation = (href: string) => {
    navigate({ to: href });
  };

  return (
    <header className="flex w-full flex-col bg-gradient-to-b from-background/90 to-background/70 border-b border-border">
      {/* Barra superior com usuário e botão do menu */}
      <div className="flex w-full items-center justify-between px-4 py-3">
        <button onClick={() => handleNavigation('/game')} className="group">
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600 group-hover:from-purple-500 group-hover:to-pink-700 transition-colors">
            Tower Trials
          </h1>
        </button>

                <div className="flex items-center gap-3">
          <PWAInstallButton />
          
          <div className="hidden sm:flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            <span className="text-sm">{userName}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="text-muted-foreground hover:text-primary transition-colors"
            title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-5 w-5" />
            ) : (
              <Moon className="h-5 w-5" />
            )}
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={() => handleNavigation('/profile')}
          >
              <User className="h-5 w-5" />
            </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-muted-foreground hover:text-primary transition-colors"
            onClick={() => handleNavigation('/logout')}
          >
              <LogOut className="h-5 w-5" />
            </Button>
          
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
                    <button
                      key={item.href}
                      onClick={() => handleNavigation(item.href)}
                      className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent text-left ${
                        isActive ? 'bg-accent text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}
                
                <button
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent text-muted-foreground text-left"
                >
                  {resolvedTheme === 'dark' ? (
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
              <button
                key={item.href}
                onClick={() => handleNavigation(item.href)}
                className={`flex items-center gap-2 rounded-md px-4 py-3 transition-colors hover:bg-accent ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
