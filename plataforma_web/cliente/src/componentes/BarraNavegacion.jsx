import React, { useState, useEffect, useRef } from 'react'
import { useTema } from '../contexto/ContextoTema'
import { useAutenticacion } from '../contexto/ContextoAutenticacion'
import { 
  Sun, Moon, Bell, Power, RefreshCw, ChevronDown, Clock,
  AlertTriangle, Flame, Sparkles, CheckCircle2, ChevronRight, Settings, SlidersHorizontal, ArrowRight, CheckCheck,
  RotateCcw, FlaskConical, FileCheck
} from 'lucide-react'
import { EtiquetaTooltip } from './EtiquetaTooltip'

export function BarraNavegacion({ 
  alertas = {}, 
  ultimaSincronizacion, 
  alSincronizar, 
  cargandoSincronizacion, 
  alAbrirChat,
  alAbrirDetalle,
  alSeleccionarPlaca,
  alNavegarAConfiguracion
}) {
  const { alternarTema, esOscuro } = useTema()
  const { usuario, cerrarSesion } = useAutenticacion()
  const [mostrarNotificaciones, setMostrarNotificaciones] = useState(false)
  const [menuPerfilAbierto, setMenuPerfilAbierto] = useState(false)
  const [mostrarModalLogout, setMostrarModalLogout] = useState(false)
  
  const [pestanaActivaA, setPestanaActivaA] = useState('todas') // 'todas' | 'urgentes'
  const notificacionesRef = useRef(null)
  const perfilRef = useRef(null)

  // Control de notificaciones leídas (persistido en localStorage del navegador)
  const [leidas, setLeidas] = useState(() => {
    try {
      const guardadas = localStorage.getItem('fscr_notificaciones_leidas')
      return guardadas ? JSON.parse(guardadas) : []
    } catch (e) {
      return []
    }
  })

  // Orden persistente y estable de las notificaciones
  const [ordenClaves, setOrdenClaves] = useState(() => {
    try {
      const guardado = localStorage.getItem('fscr_notificaciones_orden')
      return guardado ? JSON.parse(guardado) : []
    } catch (e) {
      return []
    }
  })

  const marcarComoLeida = (clave) => {
    if (!clave) return
    setLeidas((prev) => {
      if (prev.includes(clave)) return prev
      const nuevas = [...prev, clave]
      try {
        localStorage.setItem('fscr_notificaciones_leidas', JSON.stringify(nuevas))
      } catch (e) {}
      return nuevas
    })
  }

  // Cerrar menús desplegables al hacer clic en cualquier parte exterior o presionar Escape
  useEffect(() => {
    const manejarClicAfuera = (e) => {
      if (notificacionesRef.current && !notificacionesRef.current.contains(e.target)) {
        setMostrarNotificaciones(false)
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur()
        }
      }
      if (perfilRef.current && !perfilRef.current.contains(e.target)) {
        setMenuPerfilAbierto(false)
      }
    }

    const manejarTeclaEscape = (e) => {
      if (e.key === 'Escape') {
        setMostrarNotificaciones(false)
        setMenuPerfilAbierto(false)
      }
    }

    if (mostrarNotificaciones || menuPerfilAbierto) {
      document.addEventListener('mousedown', manejarClicAfuera)
      document.addEventListener('keydown', manejarTeclaEscape)
    }
    return () => {
      document.removeEventListener('mousedown', manejarClicAfuera)
      document.removeEventListener('keydown', manejarTeclaEscape)
    }
  }, [mostrarNotificaciones, menuPerfilAbierto])

  /* =========================================================================
     BLOQUE PROVISIONAL DE PRUEBAS / QA (ELIMINABLE A PETICIÓN)
     Permite probar fuera de notificaciones los 3 escenarios:
     1. Éxito total (0 errores)
     2. Fallo en 1 entidad (Parcial)
     3. Fallo en varias / todas las entidades (Caída SIMIT)
     ========================================================================= */
  const [escenarioPrueba, setEscenarioPrueba] = useState('reales')

  const SYNC_CASOS = {
    exito: [
      {
        id: 'demo-sync-ok-1',
        tipo_notificacion: 'sync_ok',
        nivel_alerta: 'VERDE',
        titulo: 'Sincronización SIMIT exitosa',
        empresa: 'Flota Corporativa FSCR',
        criterio: '3/3 entidades al día',
        mensaje: 'Extracción completada sin novedades. Se consultaron las 3 entidades activas correctamente.',
        fecha: 'Hoy – 4:37 PM',
        es_error: false
      }
    ],
    un_error: [
      {
        id: 'demo-sync-err-1',
        tipo_notificacion: 'sync_error',
        nivel_alerta: 'ROJO',
        titulo: 'Fallo en consulta SIMIT: Maste Servicios Integrales S A S',
        empresa: 'Maste Servicios Integrales S A S',
        criterio: '9005285051',
        tipo_consulta: 'NIT',
        mensaje: 'No se pudo completar la consulta de esta entidad en el SIMIT. Puedes reintentar la extracción.',
        fecha: 'Hace 3 min',
        es_error: true
      }
    ],
    varios_errores: [
      {
        id: 'demo-sync-err-1',
        tipo_notificacion: 'sync_error',
        nivel_alerta: 'ROJO',
        titulo: 'Fallo en consulta SIMIT: FSCR Ingeniería S.A.S',
        empresa: 'FSCR Ingeniería S.A.S',
        criterio: '900160091',
        tipo_consulta: 'NIT',
        mensaje: 'No se pudo completar la consulta en el SIMIT. Puedes reintentar la extracción.',
        fecha: 'Hace 5 min',
        es_error: true
      },
      {
        id: 'demo-sync-err-2',
        tipo_notificacion: 'sync_error',
        nivel_alerta: 'ROJO',
        titulo: 'Fallo en consulta SIMIT: Servicios y Apoyo Total S.A.S.',
        empresa: 'Servicios y Apoyo Total S.A.S.',
        criterio: '901818414',
        tipo_consulta: 'NIT',
        mensaje: 'No se pudo completar la consulta en el SIMIT. Puedes reintentar la extracción.',
        fecha: 'Hace 5 min',
        es_error: true
      },
      {
        id: 'demo-sync-err-3',
        tipo_notificacion: 'sync_error',
        nivel_alerta: 'ROJO',
        titulo: 'Fallo en consulta SIMIT: Maste Servicios Integrales S A S',
        empresa: 'Maste Servicios Integrales S A S',
        criterio: '9005285051',
        tipo_consulta: 'NIT',
        mensaje: 'No se pudo completar la consulta en el SIMIT. Puedes reintentar la extracción.',
        fecha: 'Hace 5 min',
        es_error: true
      }
    ]
  }

  const NOTIFICACIONES_DEMO = {
    alertas_vencimiento: [
      {
        id: 'demo-urgente-1',
        placa: 'WBC123',
        numero_comparendo: '08001000000034567891',
        codigo_infraccion: 'C02',
        secretaria: 'Tránsito Barranquilla',
        nivel_alerta: 'ROJO',
        tipo_descuento: '50%',
        fecha_limite: '2026-09-05',
        dias_habiles_restantes: 2,
        valor_nominal: 650000,
        valor_a_pagar: 325000,
        ahorro_en_juego: 325000,
        estado_simit: 'Activo',
        direccion: 'Calle 72 con Cra 43',
        descripcion_infraccion: 'Estacionar un vehículo en sitios prohibidos'
      },
      {
        id: 'demo-precaucion-2',
        placa: 'XYZ789',
        numero_comparendo: '11001000000098765432',
        codigo_infraccion: 'C29',
        secretaria: 'Movilidad Bogotá',
        nivel_alerta: 'AMARILLO',
        tipo_descuento: '50%',
        fecha_limite: '2026-09-10',
        dias_habiles_restantes: 6,
        valor_nominal: 580000,
        valor_a_pagar: 290000,
        ahorro_en_juego: 290000,
        estado_simit: 'Activo',
        direccion: 'Autopista Norte Cl 127',
        descripcion_infraccion: 'Conducir a velocidad superior a la máxima permitida'
      },
      {
        id: 'demo-vigente-3',
        placa: 'KLR982',
        numero_comparendo: '47001000000012345678',
        codigo_infraccion: 'C35',
        secretaria: 'Tránsito Santa Marta',
        nivel_alerta: 'VERDE',
        tipo_descuento: '25%',
        fecha_limite: '2026-09-22',
        dias_habiles_restantes: 12,
        valor_nominal: 633000,
        valor_a_pagar: 474750,
        ahorro_en_juego: 158250,
        estado_simit: 'Activo',
        direccion: 'Av. Libertador Cra 19',
        descripcion_infraccion: 'No realizar la revisión técnico-mecánica'
      }
    ],
    comparendos_nuevos: [
      {
        id: 'demo-nuevo-4',
        placa: 'TRK456',
        numero_comparendo: '05001000000055443322',
        codigo_infraccion: 'D02',
        secretaria: 'Tránsito Medellín',
        fecha_descarga: '2026-09-02 14:30',
        valor_total: 1300000,
        estado_simit: 'Activo',
        direccion: 'Cra 65 con Cl 80',
        descripcion_infraccion: 'Conducir sin portar los seguros ordenados por la ley'
      }
    ],
    comparendos_pagados: [
      {
        id: 'demo-pagado-5',
        placa: 'MNO654',
        numero_comparendo: '08001000000077889900',
        codigo_infraccion: 'C14',
        secretaria: 'Tránsito Puerto Colombia',
        valor_total: 650000,
        estado_simit: 'No activo',
        fecha_actualizacion: '2026-09-02',
        direccion: 'Vía al Mar Km 7',
        descripcion_infraccion: 'Transitar por sitios restringidos o en horas prohibidas (Pico y Placa)'
      }
    ],
    alertas_configuracion: [
      {
        id: 'demo-config-6',
        nombre_entidad: 'TRANSPORTES DEL CARIBE S.A.S.',
        criterio_busqueda: '900876543-1',
        tipo_documento: 'Pendiente',
        mensaje: 'Requiere definir si corresponde a NIT o Cédula para consultar sus comparendos en el SIMIT.'
      }
    ]
  }

  const reiniciarNotificacionesNoLeidas = () => {
    setLeidas([])
    setOrdenClaves([])
    try {
      localStorage.removeItem('fscr_notificaciones_leidas')
      localStorage.removeItem('fscr_notificaciones_orden')
    } catch (e) {}
  }

  const cambiarEscenarioPrueba = (nuevoEscenario) => {
    setEscenarioPrueba(nuevoEscenario)
    reiniciarNotificacionesNoLeidas()
  }

  const esModoPrueba = escenarioPrueba !== 'reales'
  const fuenteAlertas = esModoPrueba ? NOTIFICACIONES_DEMO : alertas
  const alertasVencimiento = fuenteAlertas.alertas_vencimiento || []
  const comparendosNuevos = fuenteAlertas.comparendos_nuevos || []
  const comparendosPagados = fuenteAlertas.comparendos_pagados || []
  const alertasConfig = fuenteAlertas.alertas_configuracion || []
  const alertasSync = esModoPrueba 
    ? (SYNC_CASOS[escenarioPrueba] || [])
    : (alertas.notificaciones_sincronizacion || [])

  // Lista de todas las claves únicas para cálculo de pendientes
  const todasLasClaves = [
    ...alertasVencimiento.map(a => `venc-${a.id}`),
    ...comparendosNuevos.map(n => `nuevo-${n.id}`),
    ...comparendosPagados.map(p => `pagado-${p.id}`),
    ...alertasConfig.map(c => `config-${c.id}`),
    ...alertasSync.map(s => `sync-${s.id}`)
  ]

  const marcarTodasComoLeidas = () => {
    const conjuntoActualizado = Array.from(new Set([...leidas, ...todasLasClaves]))
    setLeidas(conjuntoActualizado)
    try {
      localStorage.setItem('fscr_notificaciones_leidas', JSON.stringify(conjuntoActualizado))
    } catch (e) {}
  }

  const totalAlertas = todasLasClaves.length

  // Conteo dinámico de no leídas
  const totalNoLeidas = todasLasClaves.filter(c => !leidas.includes(c)).length

  // Detección de comparendos urgentes no leídos (<= 4 días hábiles restantes o semáforo ROJO o fallo de sync)
  const listaUrgentes = alertasVencimiento.filter(
    (a) => a.nivel_alerta === 'ROJO' || (a.dias_habiles_restantes !== undefined && a.dias_habiles_restantes <= 4)
  )
  const syncErrores = alertasSync.filter(s => s.es_error)
  const urgentesNoLeidas = listaUrgentes.filter(a => !leidas.includes(`venc-${a.id}`)).length
  const syncErroresNoLeidos = syncErrores.filter(s => !leidas.includes(`sync-${s.id}`)).length
  const tieneUrgentes = urgentesNoLeidas > 0 || syncErroresNoLeidos > 0

  const manejarAbrirDetalle = (item, clave) => {
    if (clave) {
      marcarComoLeida(clave)
    }
    if (alAbrirDetalle) {
      alAbrirDetalle(item)
    } else if (alSeleccionarPlaca) {
      alSeleccionarPlaca(typeof item === 'string' ? item : item.placa)
    }
    setMostrarNotificaciones(false)
  }

  // Construcción unificada y estructurada de todas las notificaciones para ordenamiento global
  const itemsSync = alertasSync.map(s => ({
    id: `sync-${s.id}`,
    clave: `sync-${s.id}`,
    tipo: 'sync',
    esLeida: leidas.includes(`sync-${s.id}`),
    esUrgente: Boolean(s.es_error),
    ordenCategoria: 1,
    datos: s
  }))

  const itemsNuevos = comparendosNuevos.slice(0, 10).map(n => ({
    id: `nuevo-${n.id}`,
    clave: `nuevo-${n.id}`,
    tipo: 'nuevo',
    esLeida: leidas.includes(`nuevo-${n.id}`),
    esUrgente: false,
    ordenCategoria: 2,
    datos: n
  }))

  const itemsPagados = comparendosPagados.map(p => ({
    id: `pagado-${p.id}`,
    clave: `pagado-${p.id}`,
    tipo: 'pagado',
    esLeida: leidas.includes(`pagado-${p.id}`),
    esUrgente: false,
    ordenCategoria: 3,
    datos: p
  }))

  const itemsVenc = alertasVencimiento.map(v => {
    const esUrgente = v.nivel_alerta === 'ROJO' || (v.dias_habiles_restantes !== undefined && v.dias_habiles_restantes <= 4)
    const esPrecaucion = v.nivel_alerta === 'AMARILLO' || (v.dias_habiles_restantes > 4 && v.dias_habiles_restantes <= 8)
    const prioridadVenc = esUrgente ? 1 : (esPrecaucion ? 2 : 3)
    return {
      id: `venc-${v.id}`,
      clave: `venc-${v.id}`,
      tipo: 'vencimiento',
      esLeida: leidas.includes(`venc-${v.id}`),
      esUrgente,
      ordenCategoria: 4,
      prioridadInterna: prioridadVenc,
      datos: v
    }
  })

  const itemsConfig = alertasConfig.map(c => ({
    id: `config-${c.id}`,
    clave: `config-${c.id}`,
    tipo: 'config',
    esLeida: leidas.includes(`config-${c.id}`),
    esUrgente: false,
    ordenCategoria: 5,
    datos: c
  }))

  const todasLasNotificaciones = [
    ...itemsSync,
    ...itemsNuevos,
    ...itemsPagados,
    ...itemsVenc,
    ...itemsConfig
  ]

  // Sincronización y mantenimiento del orden persistente:
  // 1. Las no leídas se colocan de primero y se organizan por tipo de notificación.
  // 2. Las leídas se preservan en su posición y NUNCA se reorganizan.
  // 3. Al marcar como leída, la notificación permanece fija en su posición sin moverse jamás.
  useEffect(() => {
    if (todasLasClaves.length === 0) return

    setOrdenClaves((prevOrden) => {
      const clavesValidas = (prevOrden || []).filter((c) => todasLasClaves.includes(c))
      const nuevasClaves = todasLasClaves.filter((c) => !clavesValidas.includes(c))

      // Inicialización o si no hay orden previo
      if (clavesValidas.length === 0) {
        const noLeidasOrdenadas = todasLasNotificaciones
          .filter((n) => !leidas.includes(n.clave))
          .sort((a, b) => {
            if (a.ordenCategoria !== b.ordenCategoria) {
              return a.ordenCategoria - b.ordenCategoria
            }
            if (a.tipo === 'vencimiento' && b.tipo === 'vencimiento') {
              return (a.prioridadInterna || 3) - (b.prioridadInterna || 3)
            }
            return 0
          })
          .map((n) => n.clave)

        const leidasOrdenadas = todasLasNotificaciones
          .filter((n) => leidas.includes(n.clave))
          .sort((a, b) => a.ordenCategoria - b.ordenCategoria)
          .map((n) => n.clave)

        const nuevoOrden = [...noLeidasOrdenadas, ...leidasOrdenadas]
        try {
          localStorage.setItem('fscr_notificaciones_orden', JSON.stringify(nuevoOrden))
        } catch (e) {}
        return nuevoOrden
      }

      // Si llegaron nuevas alertas desde backend:
      if (nuevasClaves.length > 0) {
        const nuevasNoLeidas = todasLasNotificaciones
          .filter((n) => nuevasClaves.includes(n.clave) && !leidas.includes(n.clave))
          .sort((a, b) => {
            if (a.ordenCategoria !== b.ordenCategoria) {
              return a.ordenCategoria - b.ordenCategoria
            }
            if (a.tipo === 'vencimiento' && b.tipo === 'vencimiento') {
              return (a.prioridadInterna || 3) - (b.prioridadInterna || 3)
            }
            return 0
          })
          .map((n) => n.clave)

        const nuevasLeidas = nuevasClaves.filter((c) => !nuevasNoLeidas.includes(c))
        const nuevoOrden = [...nuevasNoLeidas, ...clavesValidas, ...nuevasLeidas]
        try {
          localStorage.setItem('fscr_notificaciones_orden', JSON.stringify(nuevoOrden))
        } catch (e) {}
        return nuevoOrden
      }

      // Si se eliminó alguna clave
      if (clavesValidas.length !== (prevOrden || []).length) {
        try {
          localStorage.setItem('fscr_notificaciones_orden', JSON.stringify(clavesValidas))
        } catch (e) {}
        return clavesValidas
      }

      return prevOrden
    })
  }, [todasLasClaves.join(','), escenarioPrueba])

  // Mapeo indexado por clave
  const mapaPorClave = new Map(todasLasNotificaciones.map(n => [n.clave, n]))

  // Determinar claves en orden respetando ordenClaves
  const clavesAUsar = (ordenClaves && ordenClaves.length > 0)
    ? [
        ...ordenClaves.filter(c => mapaPorClave.has(c)),
        ...todasLasClaves.filter(c => !ordenClaves.includes(c))
      ]
    : [
        // Orden inicial determinista: no leídas arriba por categoría, luego leídas
        ...todasLasNotificaciones
          .filter(n => !leidas.includes(n.clave))
          .sort((a, b) => {
            if (a.ordenCategoria !== b.ordenCategoria) return a.ordenCategoria - b.ordenCategoria
            if (a.tipo === 'vencimiento' && b.tipo === 'vencimiento') return (a.prioridadInterna || 3) - (b.prioridadInterna || 3)
            return 0
          })
          .map(n => n.clave),
        ...todasLasNotificaciones
          .filter(n => leidas.includes(n.clave))
          .sort((a, b) => a.ordenCategoria - b.ordenCategoria)
          .map(n => n.clave)
      ]

  const listaOrdenada = clavesAUsar.map(c => mapaPorClave.get(c)).filter(Boolean)

  // Filtrado por pestaña activa ('todas' o 'urgentes')
  const notificacionesFiltradas = listaOrdenada.filter(item => {
    if (pestanaActivaA === 'urgentes') {
      return item.esUrgente
    }
    return true
  })

  return (
    <>
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
            <Clock size={13} className={`icono-sincro-reloj ${cargandoSincronizacion ? 'icono-latido' : ''}`} />
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
            onClick={() => alSincronizar && alSincronizar()}
            disabled={cargandoSincronizacion}
          >
            <RefreshCw size={14} className={cargandoSincronizacion ? 'spin-animation' : ''} />
            <span>{cargandoSincronizacion ? 'Sincronizando...' : 'Actualizar SIMIT'}</span>
          </button>
        </EtiquetaTooltip>

        {/* =====================================================================
            CAMPANA DE NOTIFICACIONES MINIMALISTA CON CONTROL DE LEÍDAS
           ===================================================================== */}
        <div style={{ position: 'relative' }} ref={notificacionesRef}>
          <EtiquetaTooltip texto={mostrarNotificaciones ? '' : (tieneUrgentes ? `${totalNoLeidas} no leídas (${urgentesNoLeidas} urgentes)` : `${totalNoLeidas} notificaciones no leídas`)}>
            <button 
              className={`boton-icono boton-notif-a ${tieneUrgentes ? 'tiene-alerta-urgente' : ''}`} 
              onClick={() => {
                const nuevoEstado = !mostrarNotificaciones
                setMostrarNotificaciones(nuevoEstado)
                if (nuevoEstado) setMenuPerfilAbierto(false)
              }}
              aria-label="Notificaciones"
            >
              <Bell size={17} />
              {totalNoLeidas > 0 && (
                <span className={`badge-notificacion ${tieneUrgentes ? 'badge-urgente-rojo' : ''}`}>
                  {totalNoLeidas}
                </span>
              )}
            </button>
          </EtiquetaTooltip>

          {/* Menú Desplegable de Notificaciones Ultra-Compacto */}
          {mostrarNotificaciones && (
            <div className="menu-desplegable-notificaciones panel-compacto">
              {/* Cabecera Compacta con Pestañas Integradas y Contador de No Leídas */}
              <div className="cabecera-panel-notif-compacta">
                <div className="cabecera-info-izq">
                  <Bell size={15} className="icono-cabecera-a" />
                  <h4>Notificaciones</h4>
                  {totalNoLeidas > 0 ? (
                    <span className="badge-conteo-no-leidas">
                      {totalNoLeidas === 1 ? '1 nueva' : `${totalNoLeidas} nuevas`}
                    </span>
                  ) : (
                    <span className="badge-al-dia">Al día</span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
                  {totalNoLeidas > 0 && (
                    <EtiquetaTooltip texto="Marcar todas como leídas" posicion="abajo">
                      <button 
                        className="btn-marcar-todo-leido"
                        onClick={marcarTodasComoLeidas}
                      >
                        Leídas
                      </button>
                    </EtiquetaTooltip>
                  )}
                  {/* Filtros integrados en la cabecera */}
                  <div className="pestanas-filtro-inline">
                    <button 
                      className={`btn-pestana-inline ${pestanaActivaA === 'todas' ? 'activa' : ''}`}
                      onClick={() => setPestanaActivaA('todas')}
                    >
                      Todas ({todasLasClaves.length})
                    </button>
                    <button 
                      className={`btn-pestana-inline ${pestanaActivaA === 'urgentes' ? 'activa' : ''}`}
                      onClick={() => setPestanaActivaA('urgentes')}
                    >
                      {tieneUrgentes && <span className="mini-punto-rojo"></span>}
                      Urgentes ({listaUrgentes.length + syncErrores.length})
                    </button>
                  </div>
                </div>
              </div>

              {/* Cuerpo de la Lista de Notificaciones Compactas */}
              <div className="cuerpo-scroll-notificaciones-compacto">
                {totalAlertas === 0 ? (
                  <div className="estado-vacio-notificaciones-compacto">
                    <CheckCircle2 size={24} className="icono-vacio-verde" />
                    <p className="texto-vacio-sub">Sin alertas pendientes en la flota vehicular.</p>
                  </div>
                ) : (
                  <div className="lista-notificaciones-compacta">
                    {notificacionesFiltradas.length === 0 ? (
                      <div className="estado-vacio-notificaciones-compacto">
                        <CheckCircle2 size={24} className="icono-vacio-verde" />
                        <p className="texto-vacio-sub">
                          {pestanaActivaA === 'urgentes' ? 'Sin alertas urgentes en la flota.' : 'Sin alertas en la flota vehicular.'}
                        </p>
                      </div>
                    ) : (
                      notificacionesFiltradas.map((item) => {
                        const { clave, esLeida, tipo, datos } = item

                        // 1. Notificación de Sincronización SIMIT
                        if (tipo === 'sync') {
                          const sync = datos
                          const esError = sync.es_error

                          return (
                            <div 
                              key={clave} 
                              className={`tarjeta-notif-compacta ${esLeida ? 'leida' : 'no-leida'} ${esError ? 'borde-sync-error' : 'borde-sync-ok'}`}
                              onClick={() => marcarComoLeida(clave)}
                            >
                              <div className="notif-c-fila-1">
                                <div className="notif-c-izq">
                                  {!esLeida && (
                                    <EtiquetaTooltip texto="Alerta nueva sin leer">
                                      <span className="punto-no-leida" />
                                    </EtiquetaTooltip>
                                  )}
                                  {esError ? (
                                    <EtiquetaTooltip texto="Falló la consulta en el SIMIT">
                                      <span className="tag-estado-compacto sync-error">
                                        <AlertTriangle size={10} /> Fallo SIMIT
                                      </span>
                                    </EtiquetaTooltip>
                                  ) : (
                                    <EtiquetaTooltip texto="Consulta completada con éxito">
                                      <span className="tag-estado-compacto sync-ok">
                                        <CheckCircle2 size={10} /> Sincronizado
                                      </span>
                                    </EtiquetaTooltip>
                                  )}
                                  <span className="entidad-nombre-c">
                                    {sync.empresa}
                                  </span>
                                </div>
                                <span className="doc-entidad-c">
                                  {sync.tipo_consulta === 'PLACA'
                                    ? (sync.criterio?.toString().startsWith('Placa') ? sync.criterio : `Placa ${sync.criterio}`)
                                    : (sync.criterio?.toString().startsWith('NIT') || sync.criterio?.toString().includes('entidades') || sync.criterio?.toString().includes('/')
                                        ? sync.criterio
                                        : `NIT ${sync.criterio}`)}
                                </span>
                              </div>

                              <div className="notif-c-fila-2">
                                <EtiquetaTooltip texto={sync.mensaje} className="tooltip-detalle-notif" posicion="arriba" soloSiTruncado soloEnPuntos>
                                  <span className="notif-c-detalle">
                                    {sync.mensaje}
                                  </span>
                                </EtiquetaTooltip>
                                {esError ? (
                                  <EtiquetaTooltip texto="Volver a intentar la consulta en el SIMIT">
                                    <span 
                                      className="enlace-ver-c reintentar"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        marcarComoLeida(clave)
                                        setMostrarNotificaciones(false)
                                        if (alSincronizar) {
                                          const criterioLimpio = (sync.criterio || '').toString().replace(/^(NIT|Placa)\s*/i, '').trim()
                                          alSincronizar(criterioLimpio, sync.tipo_consulta || 'NIT', sync.empresa)
                                        }
                                      }}
                                    >
                                      Reintentar <RefreshCw size={10} />
                                    </span>
                                  </EtiquetaTooltip>
                                ) : (
                                  <span className="fecha-sync-c">
                                    {sync.fecha}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        }

                        // 2. Comparendos Nuevos SIMIT
                        if (tipo === 'nuevo') {
                          const nuevo = datos
                          return (
                            <div 
                              key={clave} 
                              className={`tarjeta-notif-compacta ${esLeida ? 'leida' : 'no-leida'} borde-nuevo`}
                              onClick={() => marcarComoLeida(clave)}
                            >
                              <div className="notif-c-fila-1">
                                <div className="notif-c-izq">
                                  {!esLeida && (
                                    <EtiquetaTooltip texto="Nuevo comparendo no leído">
                                      <span className="punto-no-leida" />
                                    </EtiquetaTooltip>
                                  )}
                                  <span className="tag-estado-compacto nuevo">
                                    <Sparkles size={10} /> Nuevo SIMIT
                                  </span>
                                  <span className="placa-texto-c">{nuevo.placa}</span>
                                  {nuevo.tipo_descuento && (
                                    <span className="chip-desc-c">Desc. {nuevo.tipo_descuento}</span>
                                  )}
                                </div>
                                <span className="monto-nuevo-c">
                                  ${Math.round(Number(nuevo.valor_total || 0)).toLocaleString('es-CO')}
                                </span>
                              </div>
                              <div className="notif-c-fila-2">
                                <EtiquetaTooltip 
                                  texto={`${nuevo.secretaria} • Infracción ${nuevo.codigo_infraccion}${nuevo.fecha_limite_descuento ? ` • Vence desc. ${nuevo.fecha_limite_descuento}` : (nuevo.tipo_descuento ? ` • Desc. ${nuevo.tipo_descuento} (Sin notificar)` : '')}`}
                                  className="tooltip-detalle-notif"
                                  posicion="arriba"
                                  soloSiTruncado
                                  soloEnPuntos
                                >
                                  <span className="notif-c-detalle">
                                    {nuevo.secretaria} • Infracción {nuevo.codigo_infraccion}
                                    {nuevo.fecha_limite_descuento ? ` • Vence desc. ${nuevo.fecha_limite_descuento}` : (nuevo.tipo_descuento ? ` • Desc. ${nuevo.tipo_descuento} (Sin notificar)` : '')}
                                  </span>
                                </EtiquetaTooltip>
                                <span 
                                  className="enlace-ver-c"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    manejarAbrirDetalle(nuevo, clave)
                                  }}
                                >
                                  {esLeida ? 'Revisar' : 'Inspeccionar'} <ChevronRight size={11} />
                                </span>
                              </div>
                            </div>
                          )
                        }

                        // 3. Alertas de Vencimiento de Descuentos
                        if (tipo === 'vencimiento') {
                          const alerta = datos
                          const esUrgente = item.esUrgente
                          const esPrecaucion = alerta.nivel_alerta === 'AMARILLO' || (alerta.dias_habiles_restantes > 4 && alerta.dias_habiles_restantes <= 8)

                          return (
                            <div 
                              key={clave} 
                              className={`tarjeta-notif-compacta ${esLeida ? 'leida' : 'no-leida'} ${esUrgente ? 'borde-urgente' : (esPrecaucion ? 'borde-precaucion' : 'borde-vigente')}`}
                              onClick={() => marcarComoLeida(clave)}
                            >
                              <div className="notif-c-fila-1">
                                <div className="notif-c-izq">
                                  {!esLeida && (
                                    <EtiquetaTooltip texto="Alerta nueva sin leer">
                                      <span className="punto-no-leida" />
                                    </EtiquetaTooltip>
                                  )}
                                  {esUrgente ? (
                                    <span className="tag-estado-compacto urgente">
                                      <AlertTriangle size={10} /> Urgente • {alerta.dias_habiles_restantes}d
                                    </span>
                                  ) : esPrecaucion ? (
                                    <span className="tag-estado-compacto precaucion">
                                      <Clock size={10} /> Precaución • {alerta.dias_habiles_restantes}d
                                    </span>
                                  ) : (
                                    <span className="tag-estado-compacto vigente">
                                      <CheckCircle2 size={10} /> Vigente • {alerta.dias_habiles_restantes}d
                                    </span>
                                  )}
                                  <span className="placa-texto-c">{alerta.placa}</span>
                                  <span className="chip-desc-c">Desc. {alerta.tipo_descuento}</span>
                                </div>

                                <span className="monto-ahorro-c">
                                  Ahorro: ${Math.round(Number(alerta.ahorro_en_juego || 0)).toLocaleString('es-CO')}
                                </span>
                              </div>

                              <div className="notif-c-fila-2">
                                <EtiquetaTooltip 
                                  texto={`${alerta.secretaria || 'SIMIT'} • Vence el ${alerta.fecha_limite}`}
                                  className="tooltip-detalle-notif"
                                  posicion="arriba"
                                  soloSiTruncado
                                  soloEnPuntos
                                >
                                  <span className="notif-c-detalle">
                                    {alerta.secretaria || 'SIMIT'} • Vence el ${alerta.fecha_limite}
                                  </span>
                                </EtiquetaTooltip>
                                <span 
                                  className="enlace-ver-c"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    manejarAbrirDetalle(alerta, clave)
                                  }}
                                >
                                  {esLeida ? 'Revisar' : 'Inspeccionar'} <ChevronRight size={11} />
                                </span>
                              </div>
                            </div>
                          )
                        }

                        // 4. Alertas de Configuración
                        if (tipo === 'config') {
                          const configItem = datos
                          return (
                            <div 
                              key={clave} 
                              className={`tarjeta-notif-compacta ${esLeida ? 'leida' : 'no-leida'} borde-config`}
                              onClick={() => {
                                marcarComoLeida(clave)
                                setMostrarNotificaciones(false)
                                if (alNavegarAConfiguracion) {
                                  alNavegarAConfiguracion()
                                }
                              }}
                            >
                              <div className="notif-c-fila-1">
                                <div className="notif-c-izq">
                                  {!esLeida && (
                                    <EtiquetaTooltip texto="Alerta nueva sin leer">
                                      <span className="punto-no-leida" />
                                    </EtiquetaTooltip>
                                  )}
                                  <span className="tag-estado-compacto config">
                                    <Settings size={10} /> Configurar
                                  </span>
                                  <span className="entidad-nombre-c">{configItem.nombre_entidad}</span>
                                </div>
                                <span className="doc-entidad-c">{configItem.criterio_busqueda}</span>
                              </div>
                              <div className="notif-c-fila-2">
                                <EtiquetaTooltip 
                                  texto="Requiere definir si es NIT o Cédula para SIMIT"
                                  className="tooltip-detalle-notif"
                                  posicion="arriba"
                                  soloSiTruncado
                                  soloEnPuntos
                                >
                                  <span className="notif-c-detalle">
                                    Requiere definir si es NIT o Cédula para SIMIT
                                  </span>
                                </EtiquetaTooltip>
                                <span className="enlace-ver-c">
                                  Configurar <ChevronRight size={11} />
                                </span>
                              </div>
                            </div>
                          )
                        }

                        // 5. Comparendos Pagados / Retirados
                        if (tipo === 'pagado') {
                          const pagado = datos
                          return (
                            <div 
                              key={clave} 
                              className={`tarjeta-notif-compacta ${esLeida ? 'leida' : 'no-leida'} borde-pagado-pizarra`}
                              onClick={() => marcarComoLeida(clave)}
                            >
                              <div className="notif-c-fila-1">
                                <div className="notif-c-izq">
                                  {!esLeida && (
                                    <EtiquetaTooltip texto="Alerta nueva sin leer">
                                      <span className="punto-no-leida" />
                                    </EtiquetaTooltip>
                                  )}
                                  <span className="tag-estado-compacto pagado-pizarra">
                                    <FileCheck size={10} /> Retirado SIMIT
                                  </span>
                                  <span className="placa-texto-c">{pagado.placa}</span>
                                  <span className="chip-desc-c pagado-pizarra">Paz y Salvo</span>
                                </div>
                                <span className="monto-pagado-pizarra">
                                  Saldado: ${Math.round(Number(pagado.valor_total || 0)).toLocaleString('es-CO')}
                                </span>
                              </div>
                              <div className="notif-c-fila-2">
                                <EtiquetaTooltip 
                                  texto={`Comparendo ${pagado.numero_comparendo || ''} en ${pagado.secretaria || 'SIMIT'} • Pago confirmado y retirado de SIMIT`}
                                  className="tooltip-detalle-notif"
                                  posicion="arriba"
                                  soloSiTruncado
                                  soloEnPuntos
                                >
                                  <span className="notif-c-detalle">
                                    {pagado.secretaria || 'SIMIT'} • Pago confirmado en SIMIT
                                  </span>
                                </EtiquetaTooltip>
                                <span 
                                  className="enlace-ver-c"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    manejarAbrirDetalle(pagado, clave)
                                  }}
                                >
                                  {esLeida ? 'Revisar' : 'Inspeccionar'} <ChevronRight size={11} />
                                </span>
                              </div>
                            </div>
                          )
                        }

                        return null
                      })
                    )}
                  </div>
                )}
              </div>

              {/* =========================================================================
                  BARRA DE CONTROL PROVISIONAL PARA PRUEBAS (ELIMINABLE A PETICIÓN)
                 ========================================================================= */}
              <div className="barra-pruebas-notificaciones-provisional">
                <div className="grupo-botones-pruebas">
                  <EtiquetaTooltip texto="Reinicia todas las notificaciones como no leídas" posicion="arriba">
                    <button 
                      className="btn-accion-prueba" 
                      onClick={reiniciarNotificacionesNoLeidas}
                    >
                      <RotateCcw size={11} /> Reiniciar No Leídas
                    </button>
                  </EtiquetaTooltip>
                  <EtiquetaTooltip texto="Alterna entre datos reales y de prueba" posicion="arriba">
                    <button 
                      className={`btn-accion-prueba ${esModoPrueba ? 'activo' : ''}`}
                      onClick={() => {
                        const nuevoEscenario = esModoPrueba ? 'reales' : 'un_error'
                        cambiarEscenarioPrueba(nuevoEscenario)
                      }}
                    >
                      <FlaskConical size={11} /> {esModoPrueba ? 'Ver Reales' : 'Cargar Demo (6 Tipos)'}
                    </button>
                  </EtiquetaTooltip>
                </div>
              </div>

              {/* Pie de Página */}
              <div className="pie-panel-notif-compacto">
                <span>Semáforo de Ley 769 / 2161 (Días hábiles Colombia)</span>
              </div>
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
        <div style={{ position: 'relative' }} ref={perfilRef}>
          <div 
            className="perfil-usuario-capsula"
            onClick={() => {
              const nuevoEstado = !menuPerfilAbierto
              setMenuPerfilAbierto(nuevoEstado)
              if (nuevoEstado) setMostrarNotificaciones(false)
            }}
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
    </>
  )
}

