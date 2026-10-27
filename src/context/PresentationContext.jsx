import { createContext, useContext, useState, useEffect } from 'react'

const PresentationContext = createContext({
  presentationMode: false,
  togglePresentationMode: () => {}
})

const STORAGE_KEY = 'covepa_presentation_mode'

export function PresentationProvider({ children }) {
  const [presentationMode, setPresentationMode] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, presentationMode ? 'true' : 'false')
    } catch (err) {
      console.warn('Error guardando modo presentación en localStorage:', err)
    }

    if (presentationMode) {
      document.body.classList.add('presentation-mode-active')
    } else {
      document.body.classList.remove('presentation-mode-active')
    }
  }, [presentationMode])

  const togglePresentationMode = () => {
    setPresentationMode(prev => !prev)
  }

  return (
    <PresentationContext.Provider value={{ presentationMode, togglePresentationMode }}>
      {children}
    </PresentationContext.Provider>
  )
}

export function usePresentationMode() {
  const context = useContext(PresentationContext)
  if (!context) {
    throw new Error('usePresentationMode debe usarse dentro de un PresentationProvider')
  }
  return context
}
