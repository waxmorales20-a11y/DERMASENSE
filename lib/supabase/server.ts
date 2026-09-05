import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseConfigured, getSupabaseEnv } from './config';

/**
 * Cliente de Supabase para Server Components, Server Actions y Route Handlers.
 * En Next.js 15/16, cookies() es asíncrono y debe esperarse con await.
 */
export async function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Si se llama desde un Server Component puro que no puede mutar cookies,
          // se ignora de forma segura.
        }
      },
    },
  });
}
