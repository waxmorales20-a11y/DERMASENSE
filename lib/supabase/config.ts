/**
 * Helper de detección de disponibilidad de Supabase.
 * Permite que la aplicación degrade elegantemente si el proyecto de Supabase
 * aún no tiene variables de entorno configuradas o no está disponible.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return false;
  if (url.includes('placeholder') || url.includes('your-project')) return false;
  if (anonKey.includes('placeholder') || anonKey === 'eyJhbGciOi...') return false;

  return true;
}

export function getSupabaseEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  };
}
