import { NextRequest, NextResponse } from 'next/server';
import { createServerClientHelper } from '@/lib/supabase';
import { SupabaseClient } from '@supabase/supabase-js';

const publicRoutes = ['/auth', '/logout', '/403', '/404', '/game', '/game/play', '/game/ranking'];
const adminRoutes = ['/(authenticated)/(tabs)/usuarios'];

/**
 * @param supabaseClient Supabase client
 * @returns User role
 * @throws Error if the request fails
 */
async function getUserRole(supabaseClient: SupabaseClient): Promise<string> {
  const { data, error } = await supabaseClient.from('users').select('role').single();

  if (error) {
    throw new Error('Failed to fetch user role');
  }

  return data.role as string;
}

export async function middleware(req: NextRequest) {
  // Extract the path of the requested page
  const pathname = req.nextUrl.pathname;

  // Permitir acesso público para as rotas do jogo e outras rotas públicas
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next(); // Allow request to proceed
  }

  // Criar cliente Supabase no servidor
  const supabase = createServerClientHelper({
    get: (name) => req.cookies.get(name)
  });

  // Verificar se o usuário está autenticado
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Se não houver sessão, redirecionar para auth
  if (!session) {
    if (pathname !== '/auth') {
      return NextResponse.redirect(new URL('/auth', req.url));
    }
    return NextResponse.next(); // Already on /auth, allow to proceed
  }

  // Verificar acesso à área de administrador
  const isAdminRoute = adminRoutes.some((route) => pathname.includes(route));
  if (isAdminRoute) {
    try {
      const role = await getUserRole(supabase);
      if (role === 'ADMIN') {
        return NextResponse.next();
      }
    } catch (error) {
      console.error('Failed to get user role', error);
      if (pathname !== '/logout') {
        return NextResponse.redirect(new URL('/auth', req.url));
      }
    }

    return NextResponse.redirect(new URL('/403', req.url));
  }

  // Permitir a requisição se não houver restrições
  return NextResponse.next();
}

// Middleware configuration
export const config = {
  matcher: ['/(authenticated)/(tabs)/usuarios/:path*', '/auth/:path*', '/logout', '/403', '/404', '/game/:path*'],
};
