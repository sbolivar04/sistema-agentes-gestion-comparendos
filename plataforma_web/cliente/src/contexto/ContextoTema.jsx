import React, { createContext, useContext, useState, useEffect } from 'react'

const ContextoTema = createContext()

export function ProveedorTema({ children }) {
  // Por defecto en Blanco / Claro como lo solicitó el usuario
  const [tema, setTema] = useState(() => {
    return localStorage.getItem('tema_preferido') || 'claro'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-tema', tema)
    localStorage.setItem('tema_preferido', tema)
  }, [tema])

  const alternarTema = () => {
    setTema(prev => (prev === 'claro' ? 'oscuro' : 'claro'))
  }

  return (
    <ContextoTema.Provider value={{ tema, alternarTema, esOscuro: tema === 'oscuro' }}>
      {children}
    </ContextoTema.Provider>
  )
}

export function useTema() {
  return useContext(ContextoTema)
}
