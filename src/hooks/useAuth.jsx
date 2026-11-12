import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import { supabase, supabaseExt } from '../lib/supabase'
import { mapExternalPerson } from '../services/personalService'

export { AuthContext }

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

      // 1. Consultar tabla perfiles_usuario en base local (por ID de Auth o por Email)
      let { data: prof, error: profErr } = await supabase
        .from('perfiles_usuario')
        .select('*')
        .or(`id.eq.${authUser.id},email.eq.${userEmail}`)
        .maybeSingle()

      // Si existe registrado por email pero con un ID provisional, sincronizar con el ID real de auth
      if (prof && prof.id !== authUser.id) {
        try {
          await supabase
            .from('perfiles_usuario')
            .update({ id: authUser.id, updated_at: new Date().toISOString() })
            .eq('email', userEmail)
          prof.id = authUser.id
        } catch {
          // No crítico si RLS bloquea update directo
        }
      }

      if (profErr) {
        // Si hay restricción RLS (403), asignar perfil en memoria sin intentar upsert redundante
        prof = {
          id: authUser.id,
          email: userEmail,
          rol: isMasterAdmin ? 'admin' : 'tecnico',
          id_personal: null,
          activo: true
        }
      } else if (!prof) {
        const defaultRole = isMasterAdmin ? 'admin' : 'tecnico'

        // Buscar si su correo coincide con la tabla personal externa para autoenlazar
        let personalId = null
        try {
          const { data: pExt } = await supabaseExt
            .from('personal')
            .select('id_personal')
            .ilike('email', userEmail)
            .maybeSingle()
          if (pExt) {
            personalId = pExt.id_personal
          }
        } catch {
          // Si falla consulta a personal externa, continuar
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

      // 3. Cargar registro de personal correspondiente desde la BD externa
      if (prof?.id_personal) {
        let pFound = null
        try {
          const { data: pExt } = await supabaseExt
            .from('personal')
            .select('*')
            .eq('id_personal', prof.id_personal)
            .maybeSingle()
          pFound = pExt
        } catch {
          // Error no crítico de red
        }

        if (pFound) setPersonalMember(mapExternalPerson(pFound))
      } else {
        let pFound = null
        try {
          const { data: pExtByEmail } = await supabaseExt
            .from('personal')
            .select('*')
            .ilike('email', userEmail)
            .maybeSingle()
          pFound = pExtByEmail
        } catch {
          // Error no crítico de red
        }

        if (pFound) setPersonalMember(mapExternalPerson(pFound))
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

  const rawRol = (profile?.rol || '').toLowerCase().trim()
  const isMasterAdmin = Boolean(user?.email && user.email.toLowerCase().trim() === 'jcarloscc1101@gmail.com')
  const isAdmin = Boolean(rawRol === 'admin' || isMasterAdmin)
  const isSupervisor = Boolean(rawRol === 'supervisor')
  const isCoordinador = Boolean(rawRol === 'coordinador')
  const isAsistenteCalidad = Boolean(rawRol === 'asistente_calidad')
  const isInvitado = Boolean(rawRol === 'invitado')
  const isTecnico = Boolean(rawRol === 'tecnico' || (!isAdmin && !isSupervisor && !isCoordinador && !isAsistenteCalidad && !isInvitado))
  const rol = isAdmin ? 'admin' : (rawRol || 'tecnico')

  // Modo Solo Lectura estricto (para rol invitado)
  const isReadOnly = Boolean(isInvitado)

  // Permisos de negocio granulares
  // 1. Demoras y tiempos: editable para admin, supervisor y coordinador. Solo lectura para asistente_calidad, tecnico e invitado.
  const canEditDemoras = Boolean(!isReadOnly && (isAdmin || isSupervisor || isCoordinador))

  // 2. Gestión de Personal (crear/editar/eliminar personal o reasignar cuadrillas): exclusivo de admin y supervisor
  const canEditPersonal = Boolean(!isReadOnly && (isAdmin || isSupervisor))

  // 3. Edición de observaciones (estado, revisor, fecha, comentarios): bloqueado para invitado
  const canEditObservaciones = Boolean(!isReadOnly)

  // 4. Edición de programación (crear, editar o eliminar programación): exclusivo de admin, supervisor y coordinador
  const canEditProgramacion = Boolean(!isReadOnly && (isAdmin || isSupervisor || isCoordinador))

  // 5. Reglas de acceso a rutas:
  // - asistente_calidad NO accede a '/reportes'
  // - invitado NO accede a '/reportes' ni a '/kmz' (Centro de Descargas)
  const canAccessRoute = (path) => {
    if (!path) return true
    const cleanSegment = path.toLowerCase().replace(/^\//, '').split('?')[0].split('/')[0]
    if (isAsistenteCalidad) {
      if (cleanSegment === 'reportes') {
        return false
      }
    }
    if (isInvitado) {
      if (cleanSegment === 'reportes' || cleanSegment === 'kmz') {
        return false
      }
    }
    return true
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      profile, 
      personalMember, 
      isAdmin,
      isSupervisor,
      isCoordinador,
      isAsistenteCalidad,
      isInvitado,
      isTecnico,
      isReadOnly,
      canEditDemoras,
      canEditPersonal,
      canEditObservaciones,
      canEditProgramacion,
      canAccessRoute,
      rol,
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
  if (!ctx) {
    // Si ocurre durante recarga en caliente (HMR) o transición de Providers,
    // proveer un fallback seguro para evitar que la aplicación crashee.
    return {
      user: null,
      session: null,
      profile: null,
      personalMember: null,
      isAdmin: false,
      isSupervisor: false,
      isCoordinador: false,
      isAsistenteCalidad: false,
      isInvitado: false,
      isTecnico: true,
      isReadOnly: false,
      canEditDemoras: false,
      canEditPersonal: false,
      canEditObservaciones: false,
      canEditProgramacion: false,
      canAccessRoute: () => true,
      rol: 'tecnico',
      loading: true,
      signIn: async () => ({ error: new Error('Auth no disponible') }),
      signOut: async () => {},
      updatePassword: async () => ({ error: new Error('Auth no disponible') }),
      refreshProfile: async () => {}
    }
  }
  return ctx
}
