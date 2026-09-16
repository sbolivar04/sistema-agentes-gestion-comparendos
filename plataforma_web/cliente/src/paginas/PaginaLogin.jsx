import React, { useState } from 'react'
import { useAutenticacion } from '../contexto/ContextoAutenticacion'
import { ShieldCheck, LogIn, Lock, Mail, AlertCircle, Sun, Moon, Users } from 'lucide-react'
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
      setError(res.error || 'Error al iniciar sesión. Verifica tus credenciales.')
    }
  }

  const ingresarConCredenciales = async (correoSeleccionado, contrasenaSeleccionada) => {
    setError('')
    setEmail(correoSeleccionado)
    setPassword(contrasenaSeleccionada)
    const res = await iniciarSesion(correoSeleccionado, contrasenaSeleccionada)
    if (!res.exitoso) {
      setError(res.error || 'Error al iniciar sesión. Verifica tus credenciales.')
    }
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
        <div className="login-logo-contenedor">
          <img 
            src="/logo-fscr.png" 
            alt="FSCR Ingeniería S.A.S." 
            className="login-logo" 
          />
        </div>
        
        <h2 style={{ fontFamily: 'var(--fuente-titulos)', fontSize: '1.25rem', fontWeight: '700', color: 'var(--texto-principal)', marginTop: '0.1rem' }}>
          Centro de Control Inteligente SIMIT
        </h2>
        <p style={{ color: 'var(--texto-secundario)', fontSize: '0.8rem', marginTop: '0.15rem', marginBottom: '0.65rem' }}>
          Gestión preventiva y seguimiento legal de flota
        </p>

        {error && (
          <div style={{
            background: 'var(--color-peligro-rojo-suave)',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            padding: '0.6rem 0.75rem',
            borderRadius: 'var(--radio-md)',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem'
          }}>
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="login-formulario">
          <div className="campo-grupo">
            <label>Correo Electrónico</label>
            <input
              type="email"
              className="campo-input"
              placeholder="usuario@fscr.com.co"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
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
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem', padding: '0.75rem', fontSize: '0.9rem' }}
            disabled={cargando}
          >
            <LogIn size={17} />
            {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Accesos rápidos corporativos por rol */}
        <div style={{ marginTop: '1.15rem', paddingTop: '0.85rem', borderTop: '1px solid var(--borde-tarjeta, #e2e8f0)' }}>
          <p style={{ fontSize: '0.7rem', color: 'var(--texto-terciario, #94a3b8)', marginBottom: '0.55rem', textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Acceso Rápido por Rol
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <button
              type="button"
              className="boton-secundario"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.5rem', justifyContent: 'center', gap: '0.35rem' }}
              onClick={() => ingresarConCredenciales('admin@fscr.com.co', 'AdminFSCR2026*')}
              disabled={cargando}
              title="Ingresar como Administrador (Samir Bolívar)"
            >
              <ShieldCheck size={14} style={{ color: 'var(--color-primario, #2563eb)' }} />
              <span>Administrador</span>
            </button>
            <button
              type="button"
              className="boton-secundario"
              style={{ fontSize: '0.75rem', padding: '0.45rem 0.5rem', justifyContent: 'center', gap: '0.35rem' }}
              onClick={() => ingresarConCredenciales('operaciones@fscr.com.co', 'FSCR2026*')}
              disabled={cargando}
              title="Ingresar como Operaciones FSCR"
            >
              <Users size={14} style={{ color: 'var(--color-exito-verde, #16a34a)' }} />
              <span>Operaciones</span>
            </button>
          </div>
        </div>

        <p className="login-pie">
          FSCR Ingeniería S.A.S. • Control de Operaciones
        </p>
      </div>
    </div>
  )
}
