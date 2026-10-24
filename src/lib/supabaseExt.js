// Cliente Supabase — Base de datos EXTERNA (SOLO LECTURA)
import { createClient } from '@supabase/supabase-js'

const supabaseExtUrl = import.meta.env.VITE_SUPABASE_EXT_URL
const supabaseExtAnonKey = import.meta.env.VITE_SUPABASE_EXT_ANON_KEY

if (!supabaseExtUrl || !supabaseExtAnonKey) {
  console.warn('⚠️ Supabase (proyecto externo): variables de entorno no configuradas.')
}

// Este cliente es de solo lectura — no usar para inserts/updates/deletes
export const supabaseExt = createClient(supabaseExtUrl || '', supabaseExtAnonKey || '')
