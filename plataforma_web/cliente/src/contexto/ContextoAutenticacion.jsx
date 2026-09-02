import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../servicios/clienteSupabase'

const ContextoAutenticacion = createContext()

export function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const sesionGuardada = localStorage.getItem('usuario_fscr_sesion')
    return sesionGuardada ? JSON.parse(sesionGuardada) : null
  })
  const [cargando, setCargando] = useState(false)

  // Iniciar sesión con Supabase Auth o Acceso Directo Corporativo
  const iniciarSesion = async (email, password) => {
    setCargando(true)
    try {
      // 1. Intentar con Supabase Auth si está configurado
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (data?.user) {
        const infoUsuario = {
          email: data.user.email,
          nombre: data.user.user_metadata?.nombre || 'Administrador de Flota',
          rol: 'Operaciones FSCR'
        }
        setUsuario(infoUsuario)
        localStorage.setItem('usuario_fscr_sesion', JSON.stringify(infoUsuario))
        localStorage.setItem('vista_actual_fscr', 'inicio')
        return { exitoso: true }
      }

      // 2. Acceso Corporativo Directo / Demo
      if (email && password) {
        const infoUsuario = {
          email: email,
          nombre: email.split('@')[0] || 'Administrador Flota',
          rol: 'Gerencia de Operaciones'
        }
        setUsuario(infoUsuario)
        localStorage.setItem('usuario_fscr_sesion', JSON.stringify(infoUsuario))
        localStorage.setItem('vista_actual_fscr', 'inicio')
        return { exitoso: true }
      }

      return { exitoso: false, error: 'Credenciales inválidas.' }
    } catch (e) {
      return { exitoso: false, error: e.message }
    } finally {
      setCargando(false)
    }
  }

  const cerrarSesion = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn(e)
    }
    setUsuario(null)
    localStorage.removeItem('usuario_fscr_sesion')
    localStorage.removeItem('vista_actual_fscr')
  }

  return (
    <ContextoAutenticacion.Provider value={{ usuario, iniciarSesion, cerrarSesion, cargando }}>
      {children}
    </ContextoAutenticacion.Provider>
  )
}

export function useAutenticacion() {
  return useContext(ContextoAutenticacion)
}
