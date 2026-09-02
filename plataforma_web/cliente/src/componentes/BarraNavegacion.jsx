import React, { useState } from 'react'
import { useTema } from '../contexto/ContextoTema'
import { useAutenticacion } from '../contexto/ContextoAutenticacion'
import { 
  Sun, Moon, Bell, Power, RefreshCw, ChevronDown, Clock
} from 'lucide-react'
import { EtiquetaTooltip } from './EtiquetaTooltip'

export function BarraNavegacion({ alertas = {}, ultimaSincronizacion, alSincronizar, cargandoSincronizacion, alAbrirChat }) {
  const { alternarTema, esOscuro } = useTema()
  const { usuario, cerrarSesion } = useAutenticacion()
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false)
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false)
  const [mostrarModalLogout, setMostrarModalLogout] = useState(false)

  const totalAlertas = (alertas.total_rojas || 0) + (alertas.total_amarillas || 0) + (alertas.total_nuevos_recientes || 0) + (alertas.total_alertas_configuracion || 0)

  return (
    <header className="barra-navegacion">
      {/* Información Institucional FSCR en barra superior */}
      <div className="barra-marca-contenedor">
        <h1 className="barra-marca-titulo">FSCR Ingeniería S.A.S.</h1>
        <span className="barra-subtitulo-gestion">GESTIÓN INTELIGENTE DE COMPARENDOS SIMIT</span>
      </div>

      <div className="nav-acciones">
        {/* Fecha y Hora de Última Sincronización SIMIT Real (Horario Colombia UTC-5) */}
        <EtiquetaTooltip texto="Estado de sincronización con la plataforma SIMIT (Horario Colombia)">
          <div className="badge-sincronizacion-top">
            <Clock size={13} className={`icono-sincro-reloj ${cargandoSincronizacion ? 'spin-animation' : ''}`} />
            <span>
              {cargandoSincronizacion ? 'Sincronizando...' : `Sincronizado: ${ultimaSincronizacion || 'Actualizando...'}`}
            </span>
          </div>
        </EtiquetaTooltip>

        {/* Botón Sincronizar SIMIT */}
        <EtiquetaTooltip texto="Sincronizar comparendos SIMIT en vivo">
          <button 
            className="boton-secundario" 
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}
            onClick={alSincronizar}
            disabled={cargandoSincronizacion}
          >
            <RefreshCw size={14} className={cargandoSincronizacion ? 'spin-animation' : ''} />
            <span>{cargandoSincronizacion ? 'Sincronizando...' : 'Actualizar SIMIT'}</span>
          </button>
        </EtiquetaTooltip>

        {/* Campana de Notificaciones y Alertas */}
        <div style={{ position: 'relative' }}>
          <EtiquetaTooltip texto="Notificación">
            <button 
              className="boton-icono" 
              onClick={() => setMostrarNotificaciones(!mostrarNotificaciones)}
            >
              <Bell size={17} />
              {totalAlertas > 0 && (
                <span className="badge-notificacion">{totalAlertas}</span>
              )}
            </button>
          </EtiquetaTooltip>

          {/* Menú Desplegable de Notificaciones */}
          {mostrarNotificaciones && (
            <div className="menu-desplegable-notificaciones">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Alertas del Sistema</h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--texto-secundario)' }}>{totalAlertas} pendientes</span>
              </div>

              {totalAlertas === 0 ? (
                <p style={{ fontSize: '0.8rem', color: 'var(--texto-atenuado)', textAlign: 'center', padding: '1rem' }}>
                  No hay alertas urgentes pendientes en este momento.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Alertas de Configuración de Entidades */}
                  {alertas.alertas_configuracion?.map((item) => (
                    <div 
                      key={`config-${item.id}`}
                      style={{
                        padding: '0.65rem',
                        borderRadius: 'var(--radio-md)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        border: '1px solid #f59e0b',
                        fontSize: '0.78rem'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#b45309' }}>
                        <span>⚠️ Configurar Tipo Documento</span>
                        <span>{item.criterio_busqueda}</span>
                      </div>
                      <p style={{ marginTop: '0.2rem', color: '#92400e', margin: 0 }}>
                        {item.nombre_entidad} requiere definir si es NIT o Cédula.
                      </p>
                    </div>
                  ))}

                  {/* Alertas de Vencimiento de Comparendos */}
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
                      <p style={{ marginTop: '0.2rem', color: alerta.nivel_alerta === 'ROJO' ? '#991b1b' : '#92400e', margin: 0 }}>
                        {alerta.mensaje_urgencia}. Ahorro: ${alerta.ahorro_en_juego.toLocaleString('es-CO')} COP
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Switch Blanco / Oscuro */}
        <EtiquetaTooltip texto={esOscuro ? 'Cambiar a Modo Blanco' : 'Cambiar a Modo Oscuro'}>
          <button 
            className="boton-icono" 
            onClick={alternarTema}
          >
            {esOscuro ? <Sun size={17} /> : <Moon size={17} />}
          </button>
        </EtiquetaTooltip>

        {/* =========================================================================
            PERFIL CORPORATIVO CON MENÚ DESPLEGABLE (DROPDOWN)
           ========================================================================= */}
        <div style={{ position: 'relative' }}>
          <div 
            className="perfil-usuario-capsula"
            onClick={() => setMenuPerfilAbierto(!menuPerfilAbierto)}
          >
            <div className="avatar-usuario-contenedor">
              <div className="avatar-usuario-circulo">
                {usuario?.nombre ? usuario.nombre.substring(0, 2).toUpperCase() : 'OP'}
              </div>
              <span className="avatar-punto-activo" title="Sesión activa"></span>
            </div>

            <div className="info-usuario-texto">
              <span className="nombre-usuario-texto">
                {usuario?.nombre ? (usuario.nombre.charAt(0).toUpperCase() + usuario.nombre.slice(1)) : 'Operaciones'}
              </span>
              <span className="rol-usuario-badge">
                {usuario?.rol || 'Gerencia de Operaciones'}
              </span>
            </div>

            <ChevronDown 
              size={15} 
              className="chevron-perfil" 
              style={{ transform: menuPerfilAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} 
            />
          </div>

          {/* Menú flotante del Dropdown */}
          {menuPerfilAbierto && (
            <div className="menu-desplegable-perfil">
              <div className="menu-perfil-cabecera">
                <strong>{usuario?.nombre || 'Operaciones FSCR'}</strong>
                <span>{usuario?.email || 'operaciones@fscr.com.co'}</span>
              </div>
              <div className="separador-menu"></div>
              <button 
                className="menu-item-accion salir" 
                onClick={() => {
                  setMenuPerfilAbierto(false)
                  setMostrarModalLogout(true)
                }}
              >
                <Power size={15} />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          MODAL DE CONFIRMACIÓN (FORMATO VERTICAL CON MARCO AZUL Y PADDINGS COMPACTOS)
         ========================================================================= */}
      {mostrarModalLogout && (
        <div className="modal-fondo" onClick={() => setMostrarModalLogout(false)}>
          <div 
            className="modal-caja-logout" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Logo Oficial de FSCR en Tarjeta Blanca con Borde Azul */}
            <div className="modal-logout-logo-contenedor">
              <div className="modal-logout-logo-caja-blanca">
                <img 
                  src="/logo-fscr.png" 
                  alt="FSCR Ingeniería S.A.S." 
                  className="modal-logout-logo" 
                />
              </div>
            </div>

            <div className="modal-logout-cuerpo">
              <h2 className="modal-logout-titulo">¿Cerrar sesión de FSCR?</h2>

              <p className="modal-logout-mensaje">
                Estás a punto de salir de la plataforma de control de comparendos. Para ingresar nuevamente tendrás que autenticarte.
              </p>
            </div>

            {/* Los 2 botones en UNA SOLA LÍNEA */}
            <div className="modal-logout-acciones">
              <button 
                className="boton-secundario"
                onClick={() => setMostrarModalLogout(false)}
              >
                Cancelar
              </button>
              <button 
                className="boton-peligro-confirmar"
                onClick={cerrarSesion}
              >
                <Power size={15} />
                <span>Confirmar y Salir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
