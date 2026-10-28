import { createContext } from 'react'

/**
 * Contexto de Autenticación de Amazonas-COVEPA.
 * Aislado en su propio módulo sin dependencias de servicios para garantizar
 * estabilidad singleton absoluta y evitar invalidaciones de referencia durante
 * recargas en caliente (HMR) en desarrollo.
 */
export const AuthContext = createContext(null)
