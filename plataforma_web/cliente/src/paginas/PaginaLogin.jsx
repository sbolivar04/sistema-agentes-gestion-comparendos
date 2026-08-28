import React, { useState } from 'react'
import { useAutenticacion } from '../contexto/ContextoAutenticacion'
import { ShieldCheck, LogIn, Lock, Mail, AlertCircle, Sun, Moon } from 'lucide-react'
import { useTema } from '../contexto/ContextoTema'

export function PaginaLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const { iniciarSesion, cargando } = useAutenticacion()
  const { alternarTema, esOscuro } = useTema()

  const manejarEnvio = async (e) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Por favor ingresa tu correo y contraseña.')
      return
    }

    const res = await iniciarSesion(email, password)
    if (!res.exitoso) {
      setError(res.error || 'Error al iniciar sesión. Verifica tus datos.')
    }
  }

  const accesoRapido = async () => {
    setEmail('operaciones@fscr.com.co')
    setPassword('FSCR2026*')
    await iniciarSesion('operaciones@fscr.com.co', 'FSCR2026*')
  }

  return (
    <div className="login-contenedor">
      <button 
        className="boton-icono" 
        style={{ position: 'absolute', top: '1.5rem', right: '1.5rem' }}
        onClick={alternarTema}
        title={esOscuro ? 'Cambiar a Modo Blanco' : 'Cambiar a Modo Oscuro'}
      >
        {esOscuro ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="login-tarjeta">
        <img src="/logo-fscr.png" alt="FSCR Ingeniería Logo" className="login-logo" />
        
        <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontSize: '1.5rem', fontWeight: '700' }}>
          Sistema Inteligente de Comparendos
        </h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
          Gestión preventiva y seguimiento legal de flota vehicular en Colombia (SIMIT)
        </p>

        {error && (
          <div style={{
            background: 'var(--color-peligro-rojo-suave)',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '0.75rem',
            borderRadius: 'var(--radio-md)',
            marginTop: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem'
          }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="login-formulario">
          <div className="campo-grupo">
            <label>Correo Electrónico Corporativo</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type="email"
                className="campo-input"
                placeholder="ejemplo@fscr.com.co"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="campo-grupo">
            <label>Contraseña</label>
            <input
              type="password"
              className="campo-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button 
            type="submit" 
            className="boton-primario" 
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
            disabled={cargando}
          >
            <LogIn size={18} />
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>

          <button
            type="button"
            className="boton-secundario"
            style={{ width: '100%', justifyContent: 'center', fontSize: '0.85rem' }}
            onClick={accesoRapido}
          >
            <ShieldCheck size={16} color="var(--color-primario)" />
            Ingreso Rápido de Demostración
          </button>
        </form>

        <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)', marginTop: '2rem' }}>
          FSCR Ingeniería S.A.S. • Control de Operaciones y Flota
        </p>
      </div>
    </div>
  )
}
