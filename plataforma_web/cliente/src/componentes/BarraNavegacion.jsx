import React, { useState } from 'react'
import { useTema } from '../contexto/ContextoTema'
import { useAutenticacion } from '../contexto/ContextoAutenticacion'
import { 
  Sun, Moon, Bell, LogOut, RefreshCw, User, CheckCircle2, 
  AlertTriangle, Clock, ShieldAlert, Sparkles 
} from 'lucide-react'

export function BarraNavegacion({ alertas = {}, alSincronizar, cargandoSincronizacion, alAbrirChat }) {
  const { alternarTema, esOscuro } = useTema()
  const { usuario, cerrarSesion } = useAutenticacion()
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false)

  const totalAlertas = (alertas.total_rojas || 0) + (alertas.total_amarillas || 0) + (alertas.total_nuevos_recientes || 0)

  return (
    <header className="barra-navegacion">
      <div className="logo-contenedor">
        <img src="/logo-fscr.png" alt="FSCR Ingeniería Logo" className="logo-img" />
        <div className="logo-texto">
          <h1>FSCR Ingeniería S.A.S.</h1>
          <p>Gestión Inteligente de Comparendos SIMIT</p>
        </div>
      </div>

      <div className="nav-acciones">
        {/* Botón Abrir Asistente IA */}
        <button 
          className="boton-primario" 
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
          onClick={alAbrirChat}
          title="Consultar al Agente Inteligente"
        >
          <Sparkles size={16} />
          <span>Asistente IA</span>
        </button>

        {/* Botón Sincronizar SIMIT */}
        <button 
          className="boton-secundario" 
          style={{ padding: '0.5rem 0.9rem', fontSize: '0.8rem' }}
          onClick={alSincronizar}
          disabled={cargandoSincronizacion}
          title="Sincronizar SIMIT en vivo"
        >
          <RefreshCw size={15} className={cargandoSincronizacion ? 'spin-animation' : ''} />
          <span>{cargandoSincronizacion ? 'Sincronizando...' : 'Actualizar SIMIT'}</span>
        </button>

        {/* Campana de Notificaciones y Alertas */}
        <div style={{ position: 'relative' }}>
          <button 
            className="boton-icono" 
            onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
            title="Centro de Alertas de Vencimiento"
          >
            <Bell size={18} />
            {totalAlertas > 0 && (
              <span className="badge-notificacion">{totalAlertas}</span>
            )}
          </button>

          {/* Menú Desplegable de Notificaciones */}
          {mostrarNotificaciones && (
            <div style={{
              position: 'absolute',
              top: '50px',
              right: 0,
              width: '360px',
              background: 'var(--fondo-tarjeta)',
              border: '1px solid var(--borde-tarjeta)',
              borderRadius: 'var(--radio-lg)',
              boxShadow: 'var(--sombra-lg)',
              padding: '1rem',
              zIndex: 100,
              maxHeight: '420px',
              overflowY: 'auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Alertas de Flota</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)' }}>{totalAlertas} pendientes</span>
              </div>

              {totalAlertas === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--texto-atenuado)', textAlign: 'center', padding: '1rem' }}>
                  No hay alertas urgentes pendientes en este momento.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {alertas.alertas_vencimiento?.slice(0, 5).map((alerta) => (
                    <div 
                      key={alerta.id}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 'var(--radio-md)',
                        background: alerta.nivel_alerta === 'ROJO' ? 'var(--color-peligro-rojo-suave)' : 'var(--color-alerta-amarillo-suave)',
                        border: `1px solid ${alerta.nivel_alerta === 'ROJO' ? '#fca5a5' : '#fcd34d'}`,
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>Placa: {alerta.placa} ({alerta.tipo_descuento})</span>
                        <span>{alerta.dias_habiles_restantes} días hábiles</span>
                      </div>
                      <p style={{ marginTop: '0.2rem', color: alerta.nivel_alerta === 'ROJO' ? '#991b1b' : '#92400e' }}>
                        {alerta.mensaje_urgencia}. Ahorro: ${alerta.ahorro_en_juego.toLocaleString('es-CO')} COP
                      </p>
                    </div>
                  ))}

                  {alertas.comparendos_nuevos?.slice(0, 3).map((nuevo) => (
                    <div 
                      key={`nuevo-${nuevo.id}`}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 'var(--radio-md)',
                        background: 'var(--fondo-elevado)',
                        border: '1px solid var(--borde-tarjeta)',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>Nuevo Comparendo: {nuevo.placa}</span>
                        <span style={{ color: 'var(--color-primario)' }}>${nuevo.valor_total.toLocaleString('es-CO')}</span>
                      </div>
                      <p style={{ color: 'var(--texto-secundario)', marginTop: '0.2rem' }}>
                        {nuevo.secretaria} • {nuevo.codigo_infraccion}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Switch Blanco / Oscuro */}
        <button 
          className="boton-icono" 
          onClick={alternarTema}
          title={esOscuro ? 'Cambiar a Modo Blanco' : 'Cambiar a Modo Oscuro'}
        >
          {esOscuro ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Perfil y Salir */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderLeft: '1px solid var(--borde-tarjeta)', paddingLeft: '0.75rem' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
              {usuario?.nombre || 'Usuario Flota'}
            </p>
            <p style={{ fontSize: '0.7rem', color: 'var(--texto-atenuado)' }}>
              {usuario?.rol || 'FSCR'}
            </p>
          </div>
          <button 
            className="boton-icono" 
            onClick={cerrarSesion}
            title="Cerrar Sesión"
          >
            <LogOut size={16} color="var(--color-peligro-rojo)" />
          </button>
        </div>
      </div>
    </header>
  )
}
