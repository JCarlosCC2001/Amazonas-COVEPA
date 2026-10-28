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

// Cliente Supabase — Base de Datos Aplicativo (Control Fotos)
// URL: https://byywikicdvmmmndhkooe.supabase.co
export const supabaseAplicativo = supabase

// Cliente Supabase — Base de datos EXTERNA (Amazonas-SELNET)
const supabaseExtUrl = import.meta.env.VITE_SUPABASE_EXT_URL
const supabaseExtKey = import.meta.env.VITE_SUPABASE_EXT_ANON_KEY

if (!supabaseExtUrl || !supabaseExtKey) {
  console.warn('⚠️ Supabase (base externa): variables de entorno no configuradas.')
}

export const supabaseExt = createClient(supabaseExtUrl || '', supabaseExtKey || '', {
  auth: {
    persistSession: false
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
