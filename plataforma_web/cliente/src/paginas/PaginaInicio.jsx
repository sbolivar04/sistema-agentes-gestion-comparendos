import React, { useState, useEffect } from 'react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { TarjetasKPI } from '../componentes/TarjetasKPI'
import { TablaComparendos } from '../componentes/TablaComparendos'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
import { EtiquetaTooltip } from '../componentes/EtiquetaTooltip'
import { apiBackend } from '../servicios/apiBackend'
import { 
  MessageSquare, CheckCircle2, Sparkles, Clock, ArrowRight, 
  ChevronLeft, ChevronRight, CheckCheck
} from 'lucide-react'

export function PaginaInicio({ alNavegarAConfiguracion }) {
  const [metricas, setMetricas] = useState({
    total_comparendos: 0,
    monto_total: 0,
    total_ahorro_potencial: 0,
    alertas_activas: 0,
    total_descuento_50: 0,
    total_descuento_25: 0,
    total_sin_descuento: 0,
    ultima_sincronizacion: ''
  })
  const [alertas, setAlertas] = useState({
    alertas_vencimiento: [],
    comparendos_nuevos: [],
    comparendos_pagados: [],
    alertas_configuracion: [],
    total_alertas_configuracion: 0
  })
  const [chatAbierto, setChatAbierto] = useState(false)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState('')
  const [indiceRotativo, setIndiceRotativo] = useState(0)
  const [versionTabla, setVersionTabla] = useState(0)

  // Cargar datos reales de backend
  const cargarDatos = async () => {
    try {
      const resKPIs = await apiBackend.obtenerKPIs()
      if (resKPIs) {
        setMetricas({
          total_comparendos: resKPIs.total_comparendos || 0,
          monto_total: resKPIs.monto_total || 0,
          total_ahorro_potencial: resKPIs.total_ahorro_potencial || 0,
          alertas_activas: resKPIs.total_alertas_activas || 0,
          total_descuento_50: resKPIs.total_descuento_50 || 0,
          total_descuento_25: resKPIs.total_descuento_25 || 0,
          total_sin_descuento: resKPIs.total_sin_descuento || 0,
          ultima_sincronizacion: resKPIs.ultima_sincronizacion || ''
        })
      }

      const resAlertas = await apiBackend.obtenerAlertas()
      if (resAlertas) {
        setAlertas(resAlertas)
      }
    } catch (e) {
      console.error('Error al cargar datos de backend:', e)
    }
  }

  // Refrescar al montar y cada 30 segundos
  useEffect(() => {
    cargarDatos()
    const intervalo = setInterval(cargarDatos, 30000)

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarDatos()
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
    setMensajeSync('Iniciando agente de extracción...')
    
    try {
      const res = await apiBackend.lanzarExtraccion('', 'NIT')
      if (res && res.exitoso) {
        setMensajeSync('El agente se está ejecutando y consultando las entidades...')
        
        let intentos = 0
        const intervalPoll = setInterval(async () => {
          intentos++
          try {
            const estadoRes = await apiBackend.obtenerEstadoExtraccion()
            if (estadoRes && estadoRes.estado) {
              if (estadoRes.estado === 'completado') {
                clearInterval(intervalPoll)
                setSincronizando(false)
                setMensajeSync('El agente finalizó la extracción y los datos quedaron actualizados.')
                cargarDatos()
                setVersionTabla(v => v + 1)
                setTimeout(() => setMensajeSync(''), 6000)
              } else if (estadoRes.estado === 'error') {
                clearInterval(intervalPoll)
                setSincronizando(false)
                setMensajeSync('El agente reportó una novedad durante la ejecución.')
                setTimeout(() => setMensajeSync(''), 6000)
              } else {
                setMensajeSync(estadoRes.mensaje || 'El agente continúa extrayendo información...')
              }
            }
          } catch (err) {
            console.error('Error consultando estado del agente:', err)
          }

          if (intentos > 40) {
            clearInterval(intervalPoll)
            setSincronizando(false)
            setMensajeSync('El agente sigue procesando. Los datos se actualizarán automáticamente.')
            setTimeout(() => setMensajeSync(''), 6000)
          }
        }, 3000)
      } else {
        setSincronizando(false)
        setMensajeSync(res?.mensaje || 'No fue posible iniciar el agente.')
        setTimeout(() => setMensajeSync(''), 5000)
      }
    } catch (e) {
      console.error('Error al sincronizar:', e)
      setSincronizando(false)
      setMensajeSync('No fue posible comunicarse con el servicio en este momento. Inténtalo de nuevo.')
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
                <EtiquetaTooltip texto="Alerta anterior">
                  <button 
                    className="alerta-fila-btn-flecha"
                    onClick={() => setIndiceRotativo((indiceRotativo - 1 + listaAlertas.length) % listaAlertas.length)}
                  >
                    <ChevronLeft size={13} />
                  </button>
                </EtiquetaTooltip>
                <span className="alerta-fila-conteo">{indiceRotativo + 1}/{listaAlertas.length}</span>
                <EtiquetaTooltip texto="Alerta siguiente">
                  <button 
                    className="alerta-fila-btn-flecha"
                    onClick={() => setIndiceRotativo((indiceRotativo + 1) % listaAlertas.length)}
                  >
                    <ChevronRight size={13} />
                  </button>
                </EtiquetaTooltip>
              </div>

              {/* Tarjeta de alerta activa en 1 línea */}
              <div 
                className={`alerta-fila-caja-activa ${alertaActual.colorClase}`}
                onClick={() => manejarVerificarAlerta(alertaActual.placa)}
                style={{ cursor: 'pointer' }}
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
