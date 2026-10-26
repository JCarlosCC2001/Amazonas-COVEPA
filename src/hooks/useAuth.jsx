import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [personalMember, setPersonalMember] = useState(null)
  const [loading, setLoading] = useState(true)

  // Cargar perfil y datos vinculados de personal
  const loadUserProfile = async (authUser) => {
    if (!authUser) {
      setProfile(null)
      setPersonalMember(null)
      return
    }

    try {
      const userEmail = (authUser.email || '').toLowerCase().trim()
      const isMasterAdmin = userEmail === 'jcarloscc1101@gmail.com'

      // 1. Consultar tabla perfiles_usuario
      let { data: prof, error: profErr } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle()

      // 2. Si no existe perfil en la tabla, lo autoinicializamos
      if (!prof) {
        const defaultRole = isMasterAdmin ? 'admin' : 'tecnico'

        // Buscar si su correo coincide con la tabla personal para autoenlazar
        let personalId = null
        try {
          const { data: pFound } = await supabase
            .from('personal')
            .select('id')
            .ilike('email', userEmail)
            .maybeSingle()
          if (pFound) personalId = pFound.id
        } catch {
          // Si falla consulta a personal, continuar
        }

        const newProfile = {
          id: authUser.id,
          email: userEmail,
          rol: defaultRole,
          id_personal: personalId,
          activo: true
        }

        try {
          const { data: inserted, error: insErr } = await supabase
            .from('perfiles_usuario')
            .upsert(newProfile)
            .select()
            .maybeSingle()

          if (!insErr && inserted) {
            prof = inserted
          } else {
            prof = newProfile
          }
        } catch {
          prof = newProfile
        }
      } else if (isMasterAdmin && prof.rol !== 'admin') {
        // Garantizar que la cuenta administradora maestra tenga rol 'admin'
        try {
          await supabase
            .from('perfiles_usuario')
            .update({ rol: 'admin', updated_at: new Date().toISOString() })
            .eq('id', authUser.id)
          prof.rol = 'admin'
        } catch {
          prof.rol = 'admin'
        }
      }

      setProfile(prof)

      // 3. Cargar registro de personal correspondiente
      if (prof?.id_personal) {
        const { data: pData } = await supabase
          .from('personal')
          .select('*')
          .eq('id', prof.id_personal)
          .maybeSingle()
        if (pData) setPersonalMember(pData)
      } else {
        const { data: pByEmail } = await supabase
          .from('personal')
          .select('*')
          .ilike('email', userEmail)
          .maybeSingle()
        if (pByEmail) setPersonalMember(pByEmail)
      }
    } catch (err) {
      console.warn('Error cargando perfil de usuario:', err)
    }
  }

  useEffect(() => {
    async function initAuth() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error || !session) {
          setSession(null)
          setUser(null)
          setProfile(null)
          setPersonalMember(null)
          setLoading(false)
          return
        }

        // Validar si el token ya expiró
        const now = Math.floor(Date.now() / 1000)
        let activeUser = session?.user ?? null

        if (session.expires_at && session.expires_at <= now) {
          console.warn('⚠️ Token de sesión expirado. Intentando refrescar...')
          const { data: refreshData, error: refreshErr } = await supabase.auth.refreshSession()
          
          if (refreshErr || !refreshData.session) {
            console.warn('❌ No se pudo refrescar la sesión. Redirigiendo a inicio de sesión.')
            await supabase.auth.signOut()
            setSession(null)
            setUser(null)
            setProfile(null)
            setPersonalMember(null)
            activeUser = null
          } else {
            setSession(refreshData.session)
            activeUser = refreshData.session.user ?? null
            setUser(activeUser)
          }
        } else {
          setSession(session)
          setUser(activeUser)
        }

        if (activeUser) {
          await loadUserProfile(activeUser)
        }
      } catch (err) {
        console.error('Error inicializando autenticación:', err)
        setSession(null)
        setUser(null)
        setProfile(null)
        setPersonalMember(null)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        setSession(null)
        setUser(null)
        setProfile(null)
        setPersonalMember(null)
      } else if (newSession) {
        setSession(newSession)
        const currentUser = newSession.user ?? null
        setUser(currentUser)
        if (currentUser) {
          await loadUserProfile(currentUser)
        }
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (data?.user) {
      await loadUserProfile(data.user)
    }
    return { data, error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setProfile(null)
    setPersonalMember(null)
    return { error }
  }

  // Actualizar contraseña de forma nativa para el usuario autenticado
  const updatePassword = async (newPassword) => {
    if (!newPassword || newPassword.length < 6) {
      return { data: null, error: new Error('La contraseña debe tener al menos 6 caracteres.') }
    }
    const { data, error } = await supabase.auth.updateUser({
      password: newPassword
    })
    return { data, error }
  }

  const isAdmin = Boolean(
    profile?.rol === 'admin' || 
    (user?.email && user.email.toLowerCase().trim() === 'jcarloscc1101@gmail.com')
  )

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      personalMember, 
      isAdmin, 
      loading, 
      signIn, 
      signOut, 
      updatePassword,
      refreshProfile: () => loadUserProfile(user)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
