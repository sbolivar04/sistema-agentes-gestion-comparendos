import React, { useState, useEffect, useMemo, useRef } from 'react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { TarjetasKPI } from '../componentes/TarjetasKPI'
import { TablaComparendos } from '../componentes/TablaComparendos'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
import { EtiquetaTooltip } from '../componentes/EtiquetaTooltip'
import { ModalDetalleComparendo } from '../componentes/ModalDetalleComparendo'
import { useFlota } from '../contexto/ContextoFlota'
import {
  MessageSquare, CheckCircle2, Sparkles, Clock, ArrowRight,
  ChevronLeft, ChevronRight, CheckCheck, RefreshCw, AlertTriangle, ShieldCheck,
  FlaskConical, X
} from 'lucide-react'

export function PaginaInicio({ alNavegarAConfiguracion }) {
  const {
    metricas,
    alertas,
    comparendos,
    versionComparendos,
    sincronizando,
    mensajeSync,
    tipoMensajeSync,
    limpiarMensajeSync,
    sincronizarSimit
  } = useFlota()

  const [chatAbierto, setChatAbierto] = useState(false)
  const [indiceRotativo, setIndiceRotativo] = useState(0)
  const [modoDemoBanner, setModoDemoBanner] = useState(false)
  const [busquedaAlerta, setBusquedaAlerta] = useState('')
  const [versionBusquedaAlerta, setVersionBusquedaAlerta] = useState(0)
  const [filtroEstadoAlerta, setFiltroEstadoAlerta] = useState('Activo')
  const [versionFiltroEstadoAlerta, setVersionFiltroEstadoAlerta] = useState(0)
  const [comparendoModal, setComparendoModal] = useState(null)

  // Lista de alertas operativas dinámicas calculadas desde el contexto global (alertas reales del sistema)
  const listaAlertas = useMemo(() => {
    const items = []

    // 1. Alertas de vencimiento de descuentos (Semáforo de riesgo operativo)
    if (alertas?.alertas_vencimiento && Array.isArray(alertas.alertas_vencimiento)) {
      alertas.alertas_vencimiento.forEach((item) => {
        let colorClase = 'tarjeta-alerta-verde'
        let icono = ShieldCheck
        if (item.nivel_alerta === 'ROJO') {
          colorClase = 'tarjeta-alerta-roja'
          icono = AlertTriangle
        } else if (item.nivel_alerta === 'AMARILLO') {
          colorClase = 'tarjeta-alerta-amarilla'
          icono = Clock
        }

        const diasTexto = item.dias_habiles_restantes === 1
          ? '1 día hábil'
          : `${item.dias_habiles_restantes} días hábiles`

        const ahorroFormateado = item.ahorro_en_juego
          ? `$${Number(item.ahorro_en_juego).toLocaleString('es-CO')}`
          : '$0'

        items.push({
          id: item.id || `venc-${item.numero_comparendo}`,
          tipo: 'descuento',
          icono,
          colorClase,
          placa: item.placa,
          badge: `Desc. ${item.tipo_descuento || '25%'}`,
          texto: `Vence en ${diasTexto} • Ahorro en juego: ${ahorroFormateado}`,
          btnTexto: 'Verificar',
          datosOriginales: item
        })
      })
    }

    // 2. Comparendos Nuevos ingresados en SIMIT recientemente
    if (alertas?.comparendos_nuevos && Array.isArray(alertas.comparendos_nuevos)) {
      alertas.comparendos_nuevos.forEach((item) => {
        const valorFormateado = item.valor_total
          ? `$${Number(item.valor_total).toLocaleString('es-CO')}`
          : ''
        const detalleInfraccion = [
          item.secretaria,
          item.codigo_infraccion ? `Código ${item.codigo_infraccion}` : '',
          valorFormateado ? `Total: ${valorFormateado}` : ''
        ].filter(Boolean).join(' • ')

        items.push({
          id: item.id || `nuevo-${item.numero_comparendo}`,
          tipo: 'nuevo',
          icono: Sparkles,
          colorClase: 'tarjeta-alerta-azul',
          placa: item.placa,
          badge: 'Nuevo SIMIT',
          texto: detalleInfraccion || 'Nuevo comparendo reportado en SIMIT',
          btnTexto: 'Verificar',
          datosOriginales: item
        })
      })
    }

    // 3. Comparendos Pagados / Inactivos retirados de SIMIT recientemente
    if (alertas?.comparendos_pagados && Array.isArray(alertas.comparendos_pagados)) {
      alertas.comparendos_pagados.forEach((item) => {
        const detalle = [
          item.secretaria,
          'Comparendo Pagado/Inactivo en SIMIT'
        ].filter(Boolean).join(' • ')

        items.push({
          id: item.id || `pagado-${item.numero_comparendo}`,
          tipo: 'pagado',
          icono: CheckCheck,
          colorClase: 'tarjeta-alerta-gris',
          placa: item.placa,
          badge: 'Pagado',
          texto: detalle,
          btnTexto: 'Ver Estado',
          datosOriginales: item
        })
      })
    }

    // 4. Fallback si no hay ninguna alerta activa: flota totalmente al día
    if (items.length === 0) {
      items.push({
        id: 'sin-alertas',
        tipo: 'informativa',
        icono: CheckCircle2,
        colorClase: 'tarjeta-alerta-verde',
        placa: 'FSCR',
        badge: 'Al Día',
        texto: 'Flota al Día • Sin alertas de vencimiento pendientes',
        btnTexto: 'Ver Todo',
        esInformativa: true
      })
    }

    return items
  }, [alertas])

  // Catálogo demostrativo de todas las variantes posibles que este cuadro de alertas puede adoptar
  const ALERTAS_DEMO_COMPLETAS = [
    {
      id: 'demo-rojo-50',
      tipo: 'descuento',
      icono: AlertTriangle,
      colorClase: 'tarjeta-alerta-roja',
      placa: 'WBC123',
      badge: 'Desc. 50%',
      texto: '¡En riesgo 50%! Vence en 2 días hábiles • Ahorro en juego: $325.000',
      btnTexto: 'Verificar',
      datosOriginales: {
        id: 991,
        placa: 'WBC123',
        numero_comparendo: '08001000000034567891',
        codigo_infraccion: 'C02',
        secretaria: 'Tránsito Barranquilla',
        nivel_alerta: 'ROJO',
        tipo_descuento: '50%',
        fecha_limite: '2026-09-08',
        dias_habiles_restantes: 2,
        valor_nominal: 650000,
        valor_a_pagar: 325000,
        ahorro_en_juego: 325000,
        estado_simit: 'Activo',
        descripcion_infraccion: 'Estacionar un vehículo en sitios prohibidos'
      }
    },
    {
      id: 'demo-rojo-25',
      tipo: 'descuento',
      icono: AlertTriangle,
      colorClase: 'tarjeta-alerta-roja',
      placa: 'HKL456',
      badge: 'Desc. 25%',
      texto: '¡Urgente 25%! Vence en 3 días hábiles • Ahorro en juego: $158.250',
      btnTexto: 'Verificar',
      datosOriginales: {
        id: 992,
        placa: 'HKL456',
        numero_comparendo: '11001000000088776655',
        codigo_infraccion: 'C35',
        secretaria: 'Movilidad Bogotá',
        nivel_alerta: 'ROJO',
        tipo_descuento: '25%',
        fecha_limite: '2026-09-09',
        dias_habiles_restantes: 3,
        valor_nominal: 633000,
        valor_a_pagar: 474750,
        ahorro_en_juego: 158250,
        estado_simit: 'Activo',
        descripcion_infraccion: 'No realizar la revisión técnico-mecánica en el plazo legal'
      }
    },
    {
      id: 'demo-amarillo-25',
      tipo: 'descuento',
      icono: Clock,
      colorClase: 'tarjeta-alerta-amarilla',
      placa: 'WNQ706',
      badge: 'Desc. 25%',
      texto: 'En riesgo 25%: Vence en 7 días hábiles • Ahorro en juego: $158.276',
      btnTexto: 'Verificar',
      datosOriginales: {
        id: 14,
        placa: 'WNQ706',
        numero_comparendo: '13683001000056047336',
        codigo_infraccion: 'C35',
        secretaria: 'Bolívar (Dept) (13000000)',
        nivel_alerta: 'AMARILLO',
        tipo_descuento: '25%',
        fecha_limite: '2026-09-15',
        dias_habiles_restantes: 7,
        valor_nominal: 633105,
        valor_a_pagar: 474829,
        ahorro_en_juego: 158276,
        estado_simit: 'Activo',
        descripcion_infraccion: 'No realizar la revisión técnico-mecánica'
      }
    },
    {
      id: 'demo-verde-50',
      tipo: 'descuento',
      icono: ShieldCheck,
      colorClase: 'tarjeta-alerta-verde',
      placa: 'WEO146',
      badge: 'Desc. 50%',
      texto: 'Vigente 50%: 12 días hábiles • Ahorro en juego: $633.111',
      btnTexto: 'Verificar',
      datosOriginales: {
        id: 16,
        placa: 'WEO146',
        numero_comparendo: '25175000000057426027',
        codigo_infraccion: 'C29',
        secretaria: 'Chía (25175000)',
        nivel_alerta: 'VERDE',
        tipo_descuento: '50%',
        fecha_limite: '2026-09-22',
        dias_habiles_restantes: 12,
        valor_nominal: 1266222,
        valor_a_pagar: 633111,
        ahorro_en_juego: 633111,
        estado_simit: 'Activo',
        descripcion_infraccion: 'Conducir a velocidad superior a la máxima permitida'
      }
    },
    {
      id: 'demo-nuevo-simit',
      tipo: 'nuevo',
      icono: Sparkles,
      colorClase: 'tarjeta-alerta-azul',
      placa: 'TRK456',
      badge: 'Nuevo SIMIT',
      texto: 'Tránsito Medellín • Código D02 • Total: $1.300.000',
      btnTexto: 'Verificar',
      datosOriginales: {
        id: 995,
        placa: 'TRK456',
        numero_comparendo: '05001000000055443322',
        codigo_infraccion: 'D02',
        secretaria: 'Tránsito Medellín',
        fecha_descarga: '2026-09-06 14:30',
        valor_total: 1300000,
        estado_simit: 'Activo',
        descripcion_infraccion: 'Conducir sin portar los seguros ordenados por la ley'
      }
    },
    {
      id: 'demo-pagado-pazysalvo',
      tipo: 'pagado',
      icono: CheckCheck,
      colorClase: 'tarjeta-alerta-gris',
      placa: 'KLR982',
      badge: 'Pagado',
      texto: 'Tránsito Barranquilla • Comparendo Pagado/Inactivo en SIMIT',
      btnTexto: 'Ver Estado',
      datosOriginales: {
        id: 996,
        placa: 'KLR982',
        numero_comparendo: '08001000000077889900',
        codigo_infraccion: 'C14',
        secretaria: 'Tránsito Barranquilla',
        valor_total: 650000,
        estado_simit: 'No activo',
        fecha_actualizacion: '2026-09-06',
        descripcion_infraccion: 'Transitar por sitios restringidos o en horas prohibidas'
      }
    },
    {
      id: 'demo-flota-al-dia',
      tipo: 'informativa',
      icono: CheckCircle2,
      colorClase: 'tarjeta-alerta-verde',
      placa: 'FSCR',
      badge: 'Al Día',
      texto: 'Flota al Día • Sin alertas de vencimiento pendientes ni comparendos recientes',
      btnTexto: 'Ver Todo',
      esInformativa: true
    }
  ]

  // Si el usuario activa el modo demo, se muestran todas las 7 variantes posibles del banner
  const listaAlertasEfectiva = modoDemoBanner ? ALERTAS_DEMO_COMPLETAS : listaAlertas

  // Auto-rotación del banner de alertas: ejecuta exactamente 2 ciclos completos (cada alerta se visualiza 2 veces)
  // Al llegar al inicio del 3er ciclo, la rotación automática se detiene y permanece estática para evitar marear al usuario.
  const transicionesRotadasRef = useRef(0)

  // Si cambia el modo demo o el número de alertas, reiniciar índice a 0 y contador de ciclos a 0
  useEffect(() => {
    transicionesRotadasRef.current = 0
    setIndiceRotativo(0)
  }, [modoDemoBanner, listaAlertasEfectiva.length])

  useEffect(() => {
    if (listaAlertasEfectiva.length <= 1) return

    // Cada alerta se muestra 2 veces (2 ciclos completos = 2 * totalAlertas transiciones)
    const maxTransiciones = listaAlertasEfectiva.length * 2

    const timer = setInterval(() => {
      transicionesRotadasRef.current += 1
      
      setIndiceRotativo((prev) => (prev + 1) % listaAlertasEfectiva.length)

      // Una vez completados los 2 ciclos, detener el temporizador
      if (transicionesRotadasRef.current >= maxTransiciones) {
        clearInterval(timer)
      }
    }, 4500)

    return () => clearInterval(timer)
  }, [listaAlertasEfectiva.length, modoDemoBanner])

  // Abrir ventana emergente con el detalle de la infracción de inmediato, sin filtrar la tabla ni hacer peticiones innecesarias
  const manejarAbrirDetalleComparendo = (item) => {
    const placa = item?.placa || (typeof item === 'string' ? item : '')
    const numeroComparendo = item?.numero_comparendo || ''
    if (!placa && !numeroComparendo) return

    // Si ya es un objeto completo con detalles (desde la tabla o modal), usarlo directamente
    if (item && typeof item === 'object' && item.numero_comparendo && item.secretaria) {
      setComparendoModal(item)
      return
    }

    // Buscar en la lista de comparendos en memoria global (cero llamadas de red)
    const encontrado = comparendos.find(c =>
      (numeroComparendo && c.numero_comparendo === numeroComparendo) ||
      (placa && c.placa === placa)
    )

    if (encontrado) {
      setComparendoModal(encontrado)
      return
    }

    // Si viene desde una alerta básica sin todos los campos, usar los datos que tenga
    if (item && typeof item === 'object') {
      setComparendoModal({
        ...item,
        valor_nominal: item.valor_nominal || item.valor_total || 0,
        valor_a_pagar: item.valor_a_pagar || item.valor_total || 0,
        ahorro_disponible: item.ahorro_en_juego || item.ahorro_disponible || 0,
        etiqueta_descuento: item.tipo_descuento ? `Desc. ${item.tipo_descuento}` : (item.etiqueta_descuento || ''),
        estado_simit: item.estado_simit || (item.fecha_actualizacion ? 'No activo' : 'Activo')
      })
    }
  }

  const manejarVerificarAlerta = (itemOPlaca) => {
    manejarAbrirDetalleComparendo(itemOPlaca)
  }

  const totalAlertas = listaAlertasEfectiva.length
  const indiceActual = totalAlertas > 0 ? (indiceRotativo % totalAlertas) : 0
  const alertaActual = listaAlertasEfectiva[indiceActual] || listaAlertasEfectiva[0]

  return (
    <div className="app-contenedor">
      {/* Barra de Navegación Corporativa FSCR con Sincronización Real */}
      <BarraNavegacion
        alertas={alertas}
        ultimaSincronizacion={metricas.ultima_sincronizacion}
        alSincronizar={sincronizarSimit}
        cargandoSincronizacion={sincronizando}
        alAbrirChat={() => setChatAbierto(true)}
        alAbrirDetalle={manejarAbrirDetalleComparendo}
        alNavegarAConfiguracion={alNavegarAConfiguracion}
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
                    onClick={() => setIndiceRotativo((indiceActual - 1 + totalAlertas) % totalAlertas)}
                  >
                    <ChevronLeft size={13} />
                  </button>
                </EtiquetaTooltip>
                <span className="alerta-fila-conteo">{indiceActual + 1}/{totalAlertas}</span>
                <EtiquetaTooltip texto="Alerta siguiente">
                  <button
                    className="alerta-fila-btn-flecha"
                    onClick={() => setIndiceRotativo((indiceActual + 1) % totalAlertas)}
                  >
                    <ChevronRight size={13} />
                  </button>
                </EtiquetaTooltip>
              </div>

              {/* Botón para alternar y ver todas las alertas demo posibles en este cuadro */}
              <EtiquetaTooltip texto={modoDemoBanner ? "Volver a las alertas reales de la flota" : "Probar las 7 posibles alertas demo de este cuadro (Rojo crítico, Amarillo preventivo, Verde vigente, Nuevo SIMIT azul, Pagado gris, Al Día)"}>
                <button
                  className={`alerta-fila-btn-modo-demo ${modoDemoBanner ? 'activo' : ''}`}
                  onClick={() => {
                    setModoDemoBanner(!modoDemoBanner)
                    setIndiceRotativo(0)
                  }}
                  aria-label="Alternar alertas demo del cuadro"
                >
                  <FlaskConical size={12} />
                  <span>{modoDemoBanner ? 'Ver Reales' : 'Probar Alertas'}</span>
                </button>
              </EtiquetaTooltip>

              {/* Tarjeta de alerta activa en 1 línea */}
              <div
                className={`alerta-fila-caja-activa ${alertaActual.colorClase}`}
                onClick={() => {
                  if (!alertaActual.esInformativa) {
                    manejarVerificarAlerta(alertaActual.datosOriginales || alertaActual.placa)
                  }
                }}
                style={{ cursor: alertaActual.esInformativa ? 'default' : 'pointer' }}
              >
                <div className="alerta-fila-lado-izq">
                  {alertaActual.tipo !== 'nuevo' && (
                    <alertaActual.icono size={14} className="alerta-fila-icono" />
                  )}
                  <span className="alerta-fila-placa">{alertaActual.placa}</span>
                  <span className={`alerta-fila-badge badge-${alertaActual.tipo || 'default'}`}>
                    {alertaActual.tipo === 'nuevo' && <Sparkles size={11} strokeWidth={2.4} />}
                    {alertaActual.badge}
                  </span>
                  <EtiquetaTooltip
                    texto={`${alertaActual.placa ? `${alertaActual.placa} • ` : ''}${alertaActual.badge ? `[${alertaActual.badge}] ` : ''}${alertaActual.texto}`}
                    className="alerta-fila-texto-tooltip"
                    posicion="arriba"
                    soloSiTruncado
                    soloEnPuntos
                  >
                    <span className="alerta-fila-texto">{alertaActual.texto}</span>
                  </EtiquetaTooltip>
                </div>

                {!alertaActual.esInformativa && (
                  <button
                    className="alerta-fila-btn-accion"
                    onClick={(e) => {
                      e.stopPropagation()
                      manejarVerificarAlerta(alertaActual.datosOriginales || alertaActual.placa)
                    }}
                    title={`Ver información de ${alertaActual.placa}`}
                  >
                    <span>{alertaActual.btnTexto}</span>
                    <ArrowRight size={11} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Notificación de Sincronización */}
        {mensajeSync && (
          <div style={{
            background: tipoMensajeSync === 'error'
              ? 'var(--color-peligro-suave)'
              : tipoMensajeSync === 'advertencia'
                ? '#fef3c7'
                : tipoMensajeSync === 'info'
                  ? 'var(--azul-suave)'
                  : 'var(--color-exito-suave)',
            border: `1px solid ${
              tipoMensajeSync === 'error'
                ? '#fca5a5'
                : tipoMensajeSync === 'advertencia'
                  ? '#fcd34d'
                  : tipoMensajeSync === 'info'
                    ? '#93c5fd'
                    : '#6ee7b7'
            }`,
            color: tipoMensajeSync === 'error'
              ? 'var(--color-peligro-rojo)'
              : tipoMensajeSync === 'advertencia'
                ? '#92400e'
                : tipoMensajeSync === 'info'
                  ? 'var(--azul-primario)'
                  : '#065f46',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radio-md)',
            marginBottom: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {tipoMensajeSync === 'error' ? (
                <AlertTriangle size={18} />
              ) : tipoMensajeSync === 'advertencia' ? (
                <AlertTriangle size={18} color="#b45309" />
              ) : tipoMensajeSync === 'info' ? (
                <RefreshCw size={18} className="spin-animation" />
              ) : (
                <CheckCircle2 size={18} color="#059669" />
              )}
              <span>{mensajeSync}</span>
            </div>
            {!sincronizando && (
              <button
                onClick={limpiarMensajeSync}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit',
                  opacity: 0.7
                }}
                title="Cerrar notificación"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* 1. Tarjetas KPI de seguimiento diario */}
        <TarjetasKPI 
          metricas={metricas} 
          alertas={alertas} 
          onFiltrarPlacas={(placas) => {
            setFiltroEstadoAlerta('Activo')
            setBusquedaAlerta(placas)
            setVersionBusquedaAlerta(Date.now())
          }} 
          onFiltrarEstado={(estado) => {
            setBusquedaAlerta('')
            setVersionBusquedaAlerta(0)
            setFiltroEstadoAlerta(estado)
            setVersionFiltroEstadoAlerta(Date.now())
          }}
        />

        {/* 2. Tabla de Comparendos */}
        <TablaComparendos 
          key={versionComparendos} 
          busquedaExterna={busquedaAlerta} 
          versionBusquedaExterna={versionBusquedaAlerta}
          filtroEstadoExterno={filtroEstadoAlerta}
          versionFiltroEstadoExterno={versionFiltroEstadoAlerta}
          alLimpiarBusquedaExterna={() => {
            setBusquedaAlerta('')
            setVersionBusquedaAlerta(0)
          }} 
        />
      </main>

      {/* Botón Flotante para Asistente IA (solo visible cuando el chat está cerrado) */}
      {!chatAbierto && (
        <EtiquetaTooltip texto="Hablar con Cuatrojos (Asistente IA)" posicion="izquierda">
          <button
            className="chat-flotante-boton"
            onClick={() => setChatAbierto(true)}
            aria-label="Abrir Asistente IA"
          >
            <MessageSquare size={26} />
          </button>
        </EtiquetaTooltip>
      )}

      {/* Ventana de Chat Flotante */}
      <ChatAgenteIA
        abierto={chatAbierto}
        alCerrar={() => setChatAbierto(false)}
      />

      {/* Modal Emergente de Detalle de Comparendo (activado directamente sin tocar ni filtrar la tabla) */}
      {comparendoModal && (
        <ModalDetalleComparendo
          comparendo={comparendoModal}
          alCerrar={() => setComparendoModal(null)}
        />
      )}
    </div>
  )
}
