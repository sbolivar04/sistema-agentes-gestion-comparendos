import React, { useState, useEffect } from 'react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { TarjetasKPI } from '../componentes/TarjetasKPI'
import { TablaComparendos } from '../componentes/TablaComparendos'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
import { apiBackend } from '../servicios/apiBackend'
import { 
  MessageSquare, CheckCircle2, Sparkles, Clock, ArrowRight, 
  ChevronLeft, ChevronRight, CheckCheck
} from 'lucide-react'

export function PaginaInicio() {
  const [metricas, setMetricas] = useState({})
  const [alertas, setAlertas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState('')
  const [chatAbierto, setChatAbierto] = useState(false)
  const [indiceRotativo, setIndiceRotativo] = useState(0)
  const [versionTabla, setVersionTabla] = useState(0)

  const cargarDatosInicio = async () => {
    try {
      const [resKPIs, resAlertas] = await Promise.all([
        apiBackend.obtenerKPIs(),
        apiBackend.obtenerAlertas()
      ])

      if (resKPIs.exitoso) setMetricas(resKPIs)
      if (resAlertas.exitoso) setAlertas(resAlertas)
    } catch (e) {
      console.error('Error cargando datos de inicio:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatosInicio()

    // Polling en tiempo real cada 30 segundos
    const intervalo = setInterval(() => {
      cargarDatosInicio()
    }, 30000)

    // Recargar inmediatamente al volver a la pestaña
    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarDatosInicio()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [])

  // Lista de alertas operativas en formato 1 línea
  const listaAlertas = [
    {
      tipo: 'descuento',
      icono: Clock,
      colorClase: 'tarjeta-alerta-amarilla',
      placa: 'WNQ706',
      badge: 'Desc. 25%',
      texto: 'Vence en 11 días hábiles • Ahorro en juego: $158.276 COP',
      btnTexto: 'Verificar'
    },
    {
      tipo: 'nuevo',
      icono: Sparkles,
      colorClase: 'tarjeta-alerta-verde',
      placa: 'WGV086',
      badge: 'Nuevo SIMIT',
      texto: 'Zona Bananera • Código D02 • Total: $1.294.632 COP',
      btnTexto: 'Verificar'
    },
    {
      tipo: 'pagado',
      icono: CheckCheck,
      colorClase: 'tarjeta-alerta-azul',
      placa: 'KLR982',
      badge: 'Pagado',
      texto: 'Barranquilla • Comparendo Pagado/Inactivo en SIMIT',
      btnTexto: 'Ver Estado'
    }
  ]

  // Auto-rotación del banner de alertas: 6 cambios automáticos y luego se detiene
  useEffect(() => {
    let cambiosRealizados = 0
    const totalCiclo = 6 // 6 cambios automáticos

    const timer = setInterval(() => {
      cambiosRealizados += 1
      setIndiceRotativo((prev) => (prev + 1) % listaAlertas.length)

      // Una vez cumplidos los 6 cambios, se detiene
      if (cambiosRealizados >= totalCiclo) {
        clearInterval(timer)
      }
    }, 4500)

    return () => clearInterval(timer)
  }, [listaAlertas.length])

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
              await cargarDatosInicio()
              setVersionTabla(v => v + 1)
            } else {
              setMensajeSync('La consulta ha finalizado. Los datos disponibles ya están actualizados.')
              await cargarDatosInicio()
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

  const [busquedaAlerta, setBusquedaAlerta] = useState('')

  const manejarVerificarAlerta = (placa) => {
    setBusquedaAlerta(placa)
    setTimeout(() => {
      document.querySelector('.seccion-tabla')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const alertaActual = listaAlertas[indiceRotativo]

  return (
    <div className="app-contenedor">
      {/* Barra de Navegación Corporativa FSCR con Sincronización Real */}
      <BarraNavegacion 
        alertas={alertas}
        ultimaSincronizacion={metricas.ultima_sincronizacion}
        alSincronizar={sincronizarSimit}
        cargandoSincronizacion={sincronizando}
        alAbrirChat={() => setChatAbierto(true)}
      />

      <main className="contenido-principal">
        {/* =========================================================================
            ENCABEZADO PRINCIPAL CON ALERTAS RÁPIDAS EN 1 FILA (BANNER ROTATIVO)
           ========================================================================= */}
        <div className="encabezado-dashboard-con-alertas">
          <div className="encabezado-titulos-izquierda">
            <h2>Control y Seguimiento de Flota Vehicular</h2>
            <p>Control financiero, liquidación de descuentos y auditoría legal en tiempo real</p>
          </div>

          <div className="encabezado-alertas-derecha">
            <div className="alerta-fila-rotativa-contenedor">
              {/* Controles de navegación manual compactos */}
              <div className="alerta-fila-controles">
                <button 
                  className="alerta-fila-btn-flecha"
                  onClick={() => setIndiceRotativo((indiceRotativo - 1 + listaAlertas.length) % listaAlertas.length)}
                  title="Alerta anterior"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="alerta-fila-conteo">{indiceRotativo + 1}/{listaAlertas.length}</span>
                <button 
                  className="alerta-fila-btn-flecha"
                  onClick={() => setIndiceRotativo((indiceRotativo + 1) % listaAlertas.length)}
                  title="Alerta siguiente"
                >
                  <ChevronRight size={13} />
                </button>
              </div>

              {/* Tarjeta de alerta activa en 1 línea */}
              <div 
                className={`alerta-fila-caja-activa ${alertaActual.colorClase}`}
                onClick={() => manejarVerificarAlerta(alertaActual.placa)}
                style={{ cursor: 'pointer' }}
                title={`Haga clic para filtrar y ver detalle de ${alertaActual.placa}`}
              >
                <div className="alerta-fila-lado-izq">
                  <alertaActual.icono size={14} className="alerta-fila-icono" />
                  <span className="alerta-fila-placa">{alertaActual.placa}</span>
                  <span className="alerta-fila-badge">{alertaActual.badge}</span>
                  <span className="alerta-fila-texto">{alertaActual.texto}</span>
                </div>

                <button 
                  className="alerta-fila-btn-accion" 
                  onClick={(e) => {
                    e.stopPropagation()
                    manejarVerificarAlerta(alertaActual.placa)
                  }}
                  title={`Ver información de ${alertaActual.placa}`}
                >
                  <span>{alertaActual.btnTexto}</span>
                  <ArrowRight size={11} />
                </button>
              </div>
            </div>
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
            marginBottom: '1.25rem',
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

        {/* 1. Tarjetas KPI de seguimiento diario */}
        <TarjetasKPI metricas={metricas} alertas={alertas} />

        {/* 2. Tabla de Comparendos */}
        <TablaComparendos key={versionTabla} busquedaExterna={busquedaAlerta} />
      </main>

      {/* Botón Flotante para Asistente IA */}
      <button 
        className="chat-flotante-boton"
        onClick={() => setChatAbierto(!chatAbierto)}
        title="Abrir Asistente IA"
      >
        <MessageSquare size={26} />
      </button>

      {/* Ventana de Chat Flotante */}
      <ChatAgenteIA 
        abierto={chatAbierto}
        alCerrar={() => setChatAbierto(false)}
      />
    </div>
  )
}
