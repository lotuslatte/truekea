import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useAuth } from '@/features/auth/AuthProvider';

// Los visitantes pueden mirar; para actuar (ofertar, publicar, chatear) se les
// invita a crear cuenta. Envuelve cualquier acción protegida con esto.
export function useRequireAuth() {
  const { session, profile } = useAuth();
  const router = useRouter();

  const isAuthenticated = !!session && !!profile;

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isAuthenticated) {
        action();
      } else {
        router.push('/unete');
      }
    },
    [isAuthenticated, router],
  );

  return { isAuthenticated, requireAuth };
}
