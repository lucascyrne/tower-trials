'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/resources/auth/auth-hook';
import LoadingSpin from '@/components/ui/loading-sping';

export default function LogoutPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      try {
        await signOut();
        router.push('/auth');
      } catch (error) {
        console.error('Erro ao fazer logout:', error);
        router.push('/auth');
      }
    };

    performLogout();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <LoadingSpin />
      <p className="mt-4 text-gray-600">Saindo...</p>
    </div>
  );
}
