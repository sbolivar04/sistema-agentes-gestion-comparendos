import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react'
import { apiBackend } from '../servicios/apiBackend'

const ContextoFlota = createContext()

export function ProveedorFlota({ children }) {
  const [metricas, setMetricas] = useState({
    total_comparendos: 0,
    deuda_nominal_total: 0,
    deuda_optimizada_total: 0,
    ahorro_potencial_total: 0,
    total_activos: 5,
    total_inactivos: 0,
    con_descuento_50: 0,
    con_descuento_25: 0,
    sin_descuento: 0,
    ultima_sincronizacion: ''
  })

  const [alertas, setAlertas] = useState({
    alertas_vencimiento: [],
    comparendos_nuevos: [],
    comparendos_pagados: [],
    alertas_configuracion: [],
    total_alertas_configuracion: 0
  })

  // Lista en memoria de comparendos (Caché global para evitar recargas entre pestañas)
  const [comparendos, setComparendos] = useState([])
  const [cargandoComparendos, setCargandoComparendos] = useState(true)
  const [versionComparendos, setVersionComparendos] = useState(0)

  // Estado de Sincronización SIMIT Global
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState('')
  const [tipoMensajeSync, setTipoMensajeSync] = useState('info') // 'info' | 'exito' | 'error' | 'advertencia'
  const intervaloSyncRef = useRef(null)
  const timerLimpiezaRef = useRef(null)

  const limpiarMensajeSync = useCallback(() => {
    if (timerLimpiezaRef.current) {
      clearTimeout(timerLimpiezaRef.current)
      timerLimpiezaRef.current = null
    }
    setMensajeSync('')
  }, [])

  const programarLimpiezaMensaje = useCallback((milisegundos = 15000) => {
    if (timerLimpiezaRef.current) {
      clearTimeout(timerLimpiezaRef.current)
    }
    timerLimpiezaRef.current = setTimeout(() => {
      setMensajeSync('')
      timerLimpiezaRef.current = null
    }, milisegundos)
  }, [])

  // Cargar métricas ejecutivas (KPIs)
  const cargarKPIs = useCallback(async () => {
    try {
      const resKPIs = await apiBackend.obtenerKPIs()
      if (resKPIs && (resKPIs.exitoso || resKPIs.total_comparendos !== undefined)) {
        setMetricas(resKPIs)
      }
    } catch (e) {
      console.error('Error al cargar KPIs de la flota:', e)
    }
  }, [])

  // Cargar alertas inteligentes
  const cargarAlertas = useCallback(async () => {
    try {
      const resAlertas = await apiBackend.obtenerAlertas()
      if (resAlertas) {
        setAlertas(resAlertas)
      }
    } catch (e) {
      console.error('Error al cargar alertas de la flota:', e)
    }
  }, [])

  // Cargar comparendos con política de caché: no vuelve a descargar si ya están cargados en memoria
  const cargarComparendos = useCallback(async (forzar = false) => {
    if (!forzar && comparendos.length > 0) {
      return comparendos
    }

    setCargandoComparendos(true)
    try {
      const res = await apiBackend.obtenerComparendos({
        pagina: 1,
        limite: 1000,
        busqueda: '',
        estado_simit: 'todos',
        filtro_descuento: 'todos'
      })
      if (res && res.exitoso) {
        const lista = res.comparendos || []
        setComparendos(lista)
        setVersionComparendos(v => v + 1)
        return lista
      }
    } catch (e) {
      console.error('Error al cargar comparendos desde Supabase:', e)
    } finally {
      setCargandoComparendos(false)
    }
    return []
  }, [comparendos.length])

  // Cargar todo el conjunto de datos de la flota
  const cargarTodo = useCallback(async (forzar = false) => {
    await Promise.all([
      cargarKPIs(),
      cargarAlertas(),
      cargarComparendos(forzar)
    ])
  }, [cargarKPIs, cargarAlertas, cargarComparendos])

  // Monitoreo recurrente del progreso del robot en GitHub Actions / SIMIT
  const iniciarMonitoreoProgreso = useCallback((criterioLimpio = '', etiquetaDestino = '') => {
    if (intervaloSyncRef.current) {
      clearInterval(intervaloSyncRef.current)
      intervaloSyncRef.current = null
    }

    let intentos = 0
    intervaloSyncRef.current = setInterval(async () => {
      intentos++
      try {
        const estadoRes = await apiBackend.obtenerEstadoExtraccion()
        if (estadoRes) {
          if (estadoRes.conclusion === 'success' || estadoRes.estado === 'completado') {
            if (intervaloSyncRef.current) clearInterval(intervaloSyncRef.current)
            intervaloSyncRef.current = null
            setSincronizando(false)
            setTipoMensajeSync('exito')
            setMensajeSync(criterioLimpio
              ? `¡Consulta completada con éxito para ${etiquetaDestino}!`
              : (estadoRes.mensaje || '¡Extracción completada con éxito! Toda la flota quedó actualizada.')
            )
            // Refrescar comparendos, KPIs y alertas con datos frescos
            await cargarTodo(true)
            programarLimpiezaMensaje(15000)
          } else if (estadoRes.conclusion === 'failure' || estadoRes.estado === 'error') {
            if (intervaloSyncRef.current) clearInterval(intervaloSyncRef.current)
            intervaloSyncRef.current = null
            setSincronizando(false)
            setTipoMensajeSync('error')
            setMensajeSync(criterioLimpio
              ? `Falló la consulta de ${etiquetaDestino} en el SIMIT. Puedes volver a intentarlo.`
              : (estadoRes.mensaje || 'El agente reportó un inconveniente al consultar SIMIT.')
            )
            await cargarKPIs()
            programarLimpiezaMensaje(15000)
          } else if (estadoRes.estado === 'parcial') {
            if (intervaloSyncRef.current) clearInterval(intervaloSyncRef.current)
            intervaloSyncRef.current = null
            setSincronizando(false)
            setTipoMensajeSync('advertencia')
            setMensajeSync(estadoRes.mensaje || 'Extracción completada con advertencias.')
            await cargarTodo(true)
            programarLimpiezaMensaje(15000)
          } else if (estadoRes.en_progreso) {
            setTipoMensajeSync('info')
            setMensajeSync(criterioLimpio
              ? `El agente continúa consultando ${etiquetaDestino}...`
              : (estadoRes.mensaje || 'El agente continúa extrayendo información...')
            )
          }
        }
      } catch (err) {
        console.error('Error consultando estado del agente:', err)
      }

      // 120 intentos a 3 segundos = 360 segundos (6 minutos de margen para el workflow)
      if (intentos > 120) {
        if (intervaloSyncRef.current) clearInterval(intervaloSyncRef.current)
        intervaloSyncRef.current = null
        setSincronizando(false)
        setTipoMensajeSync('info')
        setMensajeSync('El agente sigue procesando en segundo plano. Los datos se actualizarán automáticamente.')
        programarLimpiezaMensaje(10000)
      }
    }, 3000)
  }, [cargarTodo, cargarKPIs, programarLimpiezaMensaje])

  // Carga inicial al montar la aplicación
  useEffect(() => {
    cargarTodo(false)

    // Detectar si hay una sincronización en curso al abrir la app o recargar la pestaña
    apiBackend.obtenerEstadoExtraccion().then(estado => {
      if (estado && estado.en_progreso) {
        setSincronizando(true)
        setTipoMensajeSync('info')
        setMensajeSync(estado.mensaje || 'El agente está consultando la flota en el SIMIT...')
        iniciarMonitoreoProgreso('', '')
      }
    }).catch(() => {})
  }, [cargarTodo, iniciarMonitoreoProgreso])

  // Refresco en segundo plano sólo de KPIs y alertas cuando la pestaña está visible
  useEffect(() => {
    const intervalo = setInterval(() => {
      if (document.visibilityState === 'visible' && !sincronizando) {
        cargarKPIs()
        cargarAlertas()
      }
    }, 45000)

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === 'visible') {
        cargarKPIs()
        cargarAlertas()
      }
    }
    document.addEventListener('visibilitychange', alCambiarVisibilidad)

    return () => {
      clearInterval(intervalo)
      document.removeEventListener('visibilitychange', alCambiarVisibilidad)
    }
  }, [cargarKPIs, cargarAlertas, sincronizando])

  // Limpieza del temporizador de sincronización en caso de desmontaje
  useEffect(() => {
    return () => {
      if (intervaloSyncRef.current) {
        clearInterval(intervaloSyncRef.current)
      }
    }
  }, [])

  // Proceso centralizado de sincronización con SIMIT (GitHub Actions / Supabase)
  const sincronizarSimit = async (criterio = '', tipo_consulta = 'NIT', nombreEntidad = '') => {
    if (sincronizando) return

    limpiarMensajeSync()

    // Sanitizar parámetros para evitar que eventos sintéticos de React u objetos no-string sean procesados
    const criterioLimpio = (typeof criterio === 'string') ? criterio.trim() : ''
    const tipoConsultaLimpio = (typeof tipo_consulta === 'string') ? tipo_consulta.trim() : 'NIT'
    const nombreEntidadLimpio = (typeof nombreEntidad === 'string') ? nombreEntidad.trim() : ''

    setSincronizando(true)
    setTipoMensajeSync('info')
    const etiquetaDestino = nombreEntidadLimpio || (criterioLimpio ? `NIT ${criterioLimpio}` : 'toda la flota')
    setMensajeSync(criterioLimpio ? `Reintentando consulta de ${etiquetaDestino} en SIMIT...` : 'Iniciando agente de extracción para toda la flota...')

    try {
      const res = await apiBackend.lanzarExtraccion(criterioLimpio, tipoConsultaLimpio)
      if (res && res.exitoso) {
        setMensajeSync(criterioLimpio ? `El agente está consultando ${etiquetaDestino} en el SIMIT...` : 'El agente se está ejecutando y consultando las entidades...')
        iniciarMonitoreoProgreso(criterioLimpio, etiquetaDestino)
      } else {
        setSincronizando(false)
        setTipoMensajeSync('error')
        setMensajeSync(res?.mensaje || 'No fue posible iniciar la extracción.')
        programarLimpiezaMensaje(8000)
      }
    } catch (e) {
      setSincronizando(false)
      setTipoMensajeSync('error')
      setMensajeSync('Error de comunicación con el servidor al iniciar la extracción.')
      programarLimpiezaMensaje(8000)
    }
  }

  const valor = {
    metricas,
    alertas,
    comparendos,
    cargandoComparendos,
    versionComparendos,
    sincronizando,
    mensajeSync,
    tipoMensajeSync,
    setMensajeSync,
    limpiarMensajeSync,
    sincronizarSimit,
    cargarTodo,
    cargarKPIs,
    cargarAlertas,
    cargarComparendos
  }

  return (
    <ContextoFlota.Provider value={valor}>
      {children}
    </ContextoFlota.Provider>
  )
}

export function useFlota() {
  const contexto = useContext(ContextoFlota)
  if (!contexto) {
    throw new Error('useFlota debe ser utilizado dentro de un ProveedorFlota')
  }
  return contexto
}
