import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured, getSupabaseEnv } from './config';

/**
 * Cliente de Supabase para componentes de cliente en el navegador.
 * Si las variables de entorno no están configuradas, retorna null de forma segura
 * para permitir la degradación elegante a modo invitado/local.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const { url, anonKey } = getSupabaseEnv();
  return createBrowserClient(url, anonKey);
}
