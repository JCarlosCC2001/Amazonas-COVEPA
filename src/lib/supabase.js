// Cliente Supabase — Base de datos PROPIA (lectura y escritura)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase (proyecto propio): variables de entorno no configuradas.')
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// Helper para detectar expiración de sesión y limpiar credenciales inválidas
export function handleSupabaseAuthError(error) {
  if (error && (error.message?.includes('JWT expired') || error.message?.includes('invalid claim') || error.code === '401')) {
    console.warn('⚠️ Token de sesión expirado. Cerrando sesión limpia...')
    supabase.auth.signOut().finally(() => {
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    })
    return true
  }
  return false
}
