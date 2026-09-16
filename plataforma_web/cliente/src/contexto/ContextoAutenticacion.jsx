import React, { createContext, useContext, useState, useEffect } from 'react'
import { apiBackend } from '../servicios/apiBackend'
import { supabase } from '../servicios/clienteSupabase'

const ContextoAutenticacion = createContext()

export function ProveedorAutenticacion({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const sesionGuardada = localStorage.getItem('usuario_fscr_sesion')
    return sesionGuardada ? JSON.parse(sesionGuardada) : null
  })
  const [cargando, setCargando] = useState(false)

  // Iniciar sesión con validación real en PostgreSQL Supabase (tabla comparendos_fscr.usuarios)
  const iniciarSesion = async (email, password) => {
    setCargando(true)
    try {
      const res = await apiBackend.iniciarSesion(email.trim(), password.trim())

      if (res && res.exitoso && res.usuario) {
        const infoUsuario = {
          id: res.usuario.id,
          email: res.usuario.email,
          nombre: res.usuario.nombre,
          rol: res.usuario.rol
        }
        setUsuario(infoUsuario)
        localStorage.setItem('usuario_fscr_sesion', JSON.stringify(infoUsuario))
        localStorage.setItem('vista_actual_fscr', 'inicio')
        return { exitoso: true }
      }

      return {
        exitoso: false,
        error: res?.error || 'Credenciales inválidas o usuario inactivo.'
      }
    } catch (e) {
      console.error('Error al iniciar sesión:', e)
      return { exitoso: false, error: 'Error de comunicación con el servidor de autenticación.' }
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
