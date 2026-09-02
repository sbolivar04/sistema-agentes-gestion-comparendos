import React, { useState, useEffect } from 'react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { TarjetasKPI } from '../componentes/TarjetasKPI'
import { PanelAlertas } from '../componentes/PanelAlertas'
import { GraficasTemporales } from '../componentes/GraficasTemporales'
import { TablaComparendos } from '../componentes/TablaComparendos'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
import { EtiquetaTooltip } from '../componentes/EtiquetaTooltip'
import { apiBackend } from '../servicios/apiBackend'
import { MessageSquare, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react'

export function PaginaDashboard() {
  const [metricas, setMetricas] = useState({})
  const [alertas, setAlertas] = useState({})
  const [estadisticas, setEstadisticas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState('')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [versionTabla, setVersionTabla] = useState(0)

  const cargarDatosDashboard = async () => {
    try {
      const [resKPIs, resAlertas, resStats] = await Promise.all([
        apiBackend.obtenerKPIs(),
        apiBackend.obtenerAlertas(),
        apiBackend.obtenerEstadisticas()
      ])

      if (resKPIs.exitoso) setMetricas(resKPIs)
      if (resAlertas.exitoso) setAlertas(resAlertas)
      if (resStats.exitoso) setEstadisticas(resStats)
    } catch (e) {
      console.error('Error cargando dashboard:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatosDashboard()

    // Polling en tiempo real cada 30 segundos
    const intervalo = setInterval(() => {
      cargarDatosDashboard()
    }, 30000)

    // Recargar inmediatamente al volver a la pestaña
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarDatosDashboard()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [])

  const sincronizarSimit = async () => {
    setSincronizando(true)
    setMensajeSync('El agente está iniciando la consulta de comparendos en el SIMIT...')
    try {
      const res = await apiBackend.lanzarExtraccion()
      if (!res.exitoso) {
        setMensajeSync(res.mensaje || 'No fue posible iniciar la consulta en este momento.')
        setSincronizando(false)
        setTimeout(() => setMensajeSync(''), 5000)
        return
      }

      setMensajeSync('El agente está verificando el estado de la flota en el SIMIT en vivo...')

      // Esperar 4 segundos antes de iniciar el monitoreo para que comience la consulta
      await new Promise(resolve => setTimeout(resolve, 4000))

      const tiempoInicio = Date.now()
      const intervaloEstado = setInterval(async () => {
        try {
          // Timeout de seguridad a los 3.5 minutos
          if (Date.now() - tiempoInicio > 210000) {
            clearInterval(intervaloEstado)
            setSincronizando(false)
            setMensajeSync('La consulta está tomando un poco más de tiempo de lo habitual. En breve verás los datos actualizados.')
            setTimeout(() => setMensajeSync(''), 6000)
            return
          }

          const estado = await apiBackend.obtenerEstadoExtraccion()
          if (estado && !estado.en_progreso) {
            clearInterval(intervaloEstado)
            setSincronizando(false)
            if (estado.conclusion === 'success') {
              setMensajeSync('¡Sincronización completada! Los comparendos de la flota se han actualizado correctamente.')
              await cargarDatosDashboard()
              setVersionTabla(v => v + 1)
            } else {
              setMensajeSync('La consulta ha finalizado. Los datos disponibles ya están actualizados.')
              await cargarDatosDashboard()
            }
            setTimeout(() => setMensajeSync(''), 6000)
          }
        } catch (err) {
          console.error('Error al monitorear el estado del agente:', err)
        }
      }, 4000)

    } catch (e) {
      setMensajeSync('No fue posible comunicarse con el servicio en este momento. Inténtalo de nuevo.')
      setSincronizando(false)
      setTimeout(() => setMensajeSync(''), 5000)
    }
  }

  return (
    <div className="app-contenedor">
      <BarraNavegacion 
        alertas={alertas}
        ultimaSincronizacion={metricas.ultima_sincronizacion}
        alSincronizar={sincronizarSimit}
        cargandoSincronizacion={sincronizando}
        alAbrirChat={() => setChatAbierto(true)}
      />

      <main className="contenido-principal">
        {/* Cabecera del Dashboard 100% Estandarizada */}
        <div className="encabezado-dashboard-con-alertas">
          <div className="encabezado-titulos-izquierda">
            <h2>Panel Ejecutivo de Flota Vehicular</h2>
            <p>Control financiero, liquidación de descuentos y auditoría legal en tiempo real</p>
          </div>

          <div className="encabezado-alertas-derecha">
            <EtiquetaTooltip texto="Consultar análisis o dudas legales con el Agente de IA">
              <button 
                className="boton-primario"
                onClick={() => setChatAbierto(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Sparkles size={16} />
                <span>Consultar con Asistente IA</span>
              </button>
            </EtiquetaTooltip>
          </div>
        </div>

        {/* Notificación de Sincronización */}
        {mensajeSync && (
          <div style={{
            background: 'var(--color-exito-suave)',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radio-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            <CheckCircle2 size={18} />
            <span>{mensajeSync}</span>
          </div>
        )}

        {/* 1. Tarjetas KPI */}
        <TarjetasKPI metricas={metricas} alertas={alertas} />

        {/* 2. Panel de Alertas Inteligentes (Semáforo de Descuentos) */}
        <PanelAlertas alertas={alertas} />

        {/* 3. Gráficas Temporales */}
        <GraficasTemporales estadisticas={estadisticas} />

        {/* 4. Tabla de Comparendos con Paginación Configurable */}
        <TablaComparendos key={versionTabla} />
      </main>

      {/* Botón Flotante para Asistente IA */}
      <EtiquetaTooltip texto="Abrir Asistente IA" posicion="izquierda">
        <button 
          className="chat-flotante-boton"
          onClick={() => setChatAbierto(!chatAbierto)}
        >
          <MessageSquare size={26} />
        </button>
      </EtiquetaTooltip>

      {/* Ventana de Chat Flotante */}
      <ChatAgenteIA 
        abierto={chatAbierto}
        alCerrar={() => setChatAbierto(false)}
      />
    </div>
  )
}
