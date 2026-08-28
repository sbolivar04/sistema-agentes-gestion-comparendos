import React, { useState, useEffect } from 'react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { TarjetasKPI } from '../componentes/TarjetasKPI'
import { PanelAlertas } from '../componentes/PanelAlertas'
import { GraficasTemporales } from '../componentes/GraficasTemporales'
import { TablaComparendos } from '../componentes/TablaComparendos'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
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
  }, [])

  const sincronizarSimit = async () => {
    setSincronizando(true)
    setMensajeSync('Iniciando extracción en vivo desde SIMIT...')
    try {
      const res = await apiBackend.lanzarExtraccion()
      if (res.exitoso) {
        setMensajeSync('¡Extracción completada con éxito!')
        await cargarDatosDashboard()
      } else {
        setMensajeSync(res.mensaje || 'Error durante la extracción.')
      }
    } catch (e) {
      setMensajeSync('Error de comunicación con el servidor.')
    } finally {
      setSincronizando(false)
      setTimeout(() => setMensajeSync(''), 5000)
    }
  }

  return (
    <div className="app-contenedor">
      <BarraNavegacion 
        alertas={alertas}
        alSincronizar={sincronizarSimit}
        cargandoSincronizacion={sincronizando}
        alAbrirChat={() => setChatAbierto(true)}
      />

      <main className="contenido-principal">
        {/* Cabecera del Dashboard */}
        <div className="encabezado-dashboard">
          <div>
            <h2>Panel Ejecutivo de Flota Vehicular</h2>
            <p>Control financiero, liquidación de descuentos y auditoría legal en tiempo real</p>
          </div>

          <div className="botones-cabecera">
            <button 
              className="boton-primario"
              onClick={() => setChatAbierto(true)}
            >
              <Sparkles size={18} />
              <span>Consultar con Asistente IA</span>
            </button>
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
        <TarjetasKPI metricas={metricas} />

        {/* 2. Panel de Alertas Inteligentes (Semáforo de Descuentos) */}
        <PanelAlertas alertas={alertas} />

        {/* 3. Gráficas Temporales */}
        <GraficasTemporales estadisticas={estadisticas} />

        {/* 4. Tabla de Comparendos con Paginación Configurable */}
        <TablaComparendos />
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
