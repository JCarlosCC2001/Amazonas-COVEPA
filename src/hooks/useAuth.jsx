import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setSession(null)
          setUser(null)
          setLoading(false)
          return
        }

        // Validar si el token ya expiró
        const now = Math.floor(Date.now() / 1000)
        if (session.expires_at && session.expires_at <= now) {
          console.warn('⚠️ Token de sesión expirado. Intentando refrescar...')
          const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
          
          if (refreshErr || !refreshData.session) {
            console.warn('❌ No se pudo refrescar la sesión. Redirigiendo a inicio de sesión.')
            await supabase.auth.signOut()
            setSession(null)
            setUser(null)
          } else {
            setSession(refreshData.session)
            setUser(refreshData.session.user ?? null)
          }
        } else {
          setSession(session)
          setUser(session?.user ?? null)
        }
      } catch (err) {
        console.error('Error inicializando autenticación:', err)
        setSession(null)
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null)
        setUser(null)
      } else if (newSession) {
        setSession(newSession)
        setUser(newSession.user ?? null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    return { error }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
