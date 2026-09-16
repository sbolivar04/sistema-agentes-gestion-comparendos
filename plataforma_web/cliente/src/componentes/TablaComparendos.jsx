import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, SlidersHorizontal, X, Percent, FolderKanban, CheckCircle2, Sparkles, Tag } from 'lucide-react'
import { apiBackend } from '../servicios/apiBackend'
import { useFlota } from '../contexto/ContextoFlota'
import { ModalDetalleComparendo } from './ModalDetalleComparendo'
import { ModalGestionOperativa } from './ModalGestionOperativa'
import { EtiquetaTooltip } from './EtiquetaTooltip'
import { SelectorDesplegable } from './SelectorDesplegable'
import { BotonExportarExcel } from './BotonExportarExcel'

export function TablaComparendos({
  busquedaExterna = '',
  versionBusquedaExterna = 0,
  alLimpiarBusquedaExterna,
  filtroEstadoExterno = null,
  versionFiltroEstadoExterno = 0
}) {
  const { comparendos: todosComparendos, cargandoComparendos: cargando, cargarComparendos, cargarKPIs } = useFlota()
  const [paginaActual, setPaginaActual] = useState(1)

  // Paginación por defecto en 5
  const [limitePorPagina, setLimitePorPagina] = useState(5)
  const [limitePersonalizado, setLimitePersonalizado] = useState('')
  const [mostrarInputPersonalizado, setMostrarInputPersonalizado] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('Activo')
  const [filtroDescuento, setFiltroDescuento] = useState('todos')
  const [filtroSubestado, setFiltroSubestado] = useState('todos')
  const [comparendoSeleccionado, setComparendoSeleccionado] = useState(null)
  const [comparendoGestion, setComparendoGestion] = useState(null)

  // Mapa de gestiones operativas sincronizadas directamente desde Supabase PostgreSQL
  const [mapaGestiones, setMapaGestiones] = useState({})

  // Versión reactiva para refrescar de inmediato el micro-indicador del botón al guardar en el modal
  const [versionGestion, setVersionGestion] = useState(0)

  // Limpieza inicial de cualquier dato residual de prueba anterior en localStorage
  useEffect(() => {
    try {
      const llavesABorrar = []
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i)
        if (k && k.startsWith('gestion_operativa_')) {
          llavesABorrar.push(k)
        }
      }
      llavesABorrar.forEach(k => localStorage.removeItem(k))
    } catch (e) {
      console.warn('Error al limpiar localStorage residual:', e)
    }
  }, [])

  // Cargar mapa de gestiones operativas desde Supabase
  useEffect(() => {
    let activo = true
    apiBackend.obtenerMapaGestiones()
      .then((res) => {
        if (activo && res?.exitoso && res.gestiones) {
          setMapaGestiones(res.gestiones)
        }
      })
      .catch((err) => {
        console.warn('Error al cargar mapa de gestiones desde Supabase:', err)
      })
    return () => { activo = false }
  }, [versionGestion])

  // Obtener subestado operativo y color del micro-indicador para el botón de gestión
  const obtenerSubestadoGestion = (c) => {
    if (!c?.id) {
      return {
        colorCodigo: 'gris',
        etiqueta: 'Sin gestión',
        tooltip: 'Gestión operativa • Sin gestión iniciada'
      }
    }

    try {
      // Única fuente de verdad: registro sincronizado desde Supabase PostgreSQL
      const datos = mapaGestiones[c.id]

      if (!datos) {
        if (c.estado_simit === 'No activo' || c.estado_simit === 'Pagado') {
          return {
            colorCodigo: 'verde',
            etiqueta: 'Paz y Salvo SIMIT',
            tooltip: 'Gestión operativa • Paz y Salvo oficial SIMIT'
          }
        }
        return {
          colorCodigo: 'gris',
          etiqueta: 'Sin gestión',
          tooltip: 'Gestión operativa • Sin gestión iniciada'
        }
      }

      // Verificación estricta de Paso 1 completo:
      // Requiere nombre, cédula, asignación de pago y ambos soportes obligatorios (correo y autorización firmada)
      const paso1Completo = Boolean(
        (datos.paso1Completo === true || datos.paso1_completo === true) || (
          (datos.responsableNombre || datos.responsable_nombre)?.trim()?.length > 0 &&
          String(datos.responsableDocumento || datos.responsable_documento || '').replace(/\D/g, '').length > 0 &&
          (datos.distribucionPago || datos.distribucion_pago) &&
          (datos.soporteCorreo || datos.soporte_correo || datos.tiene_soporte_correo) &&
          (datos.soporteFirma || datos.soporte_firma || datos.tiene_soporte_firma)
        )
      )

      // Verificación de Paso 2 completo:
      // Requiere Paso 1 completo + valor pagado registrado + fecha de pago + factura/recibo oficial adjunto
      const paso2Completo = Boolean(
        paso1Completo && (
          (datos.paso2Completo === true || datos.paso2_completo === true) || (
            (datos.valorPagado || datos.valor_pagado) && 
            Number(String(datos.valorPagado || datos.valor_pagado).replace(/\D/g, '')) > 0 &&
            (datos.fechaPago || datos.fecha_pago) &&
            (datos.soporteFactura || datos.soporte_factura || datos.tiene_soporte_factura)
          )
        )
      )

      // Verificación de Paso 3 completo (Descargue SIMIT / Paz y Salvo)
      const paso3Completo = Boolean(
        datos.confirmadoDescargueSimit ||
        datos.confirmado_descargue_simit ||
        datos.subestadoCodigo === 'descargado_paz_y_salvo' ||
        datos.subestado_codigo === 'descargado_paz_y_salvo' ||
        c.estado_simit === 'No activo' ||
        c.estado_simit === 'Pagado'
      )

      const faseActualNum = Number(datos.faseActual || datos.fase_actual || 1)
      const subestadoCod = datos.subestadoCodigo || datos.subestado_codigo || 'sin_gestion'
      const nombreResp = (datos.responsableNombre || datos.responsable_nombre || '').trim()
      const docResp = String(datos.responsableDocumento || datos.responsable_documento || '').replace(/\D/g, '').trim()
      const distPago = datos.distribucionPago || datos.distribucion_pago
      const tieneSoporte1 = Boolean(
        datos.soporteCorreo || datos.soporte_correo || datos.tiene_soporte_correo ||
        datos.soporteFirma || datos.soporte_firma || datos.tiene_soporte_firma
      )

      // Verificación de si ha iniciado o digitado cualquier información del Paso 1
      const tieneAlgoPaso1 = Boolean(
        nombreResp.length > 0 ||
        docResp.length > 0 ||
        (distPago && String(distPago).trim().length > 0) ||
        (datos.observacionesAsignacion && String(datos.observacionesAsignacion).trim().length > 0) ||
        (datos.observaciones_asignacion && String(datos.observaciones_asignacion).trim().length > 0) ||
        tieneSoporte1 ||
        subestadoCod === 'revision_aprobacion'
      )

      // 1. VERDE: Paz y Salvo Oficial (Cuando pasa a estado No activo o Pagado en SIMIT)
      if (c.estado_simit === 'No activo' || c.estado_simit === 'Pagado' || paso3Completo) {
        return {
          colorCodigo: 'verde',
          etiqueta: 'Paz y Salvo • Descargado SIMIT',
          tooltip: 'Gestión operativa • Paz y Salvo oficial SIMIT (Descargado en SIMIT)'
        }
      }

      // 2. NARANJA: Paso 3 activo (Comparendo pagado físicamente, en espera de descargue SIMIT)
      if (faseActualNum === 3 || subestadoCod === 'pagado_esperando_descargue') {
        return {
          colorCodigo: 'naranja',
          etiqueta: 'Pagado • Esperando Descargue SIMIT',
          tooltip: 'Gestión operativa • Pagado (Esperando descargue SIMIT)'
        }
      }

      // 3. AMARILLO: Paso 2 activo o Paso 1 completado (En trámite de pago)
      if (faseActualNum === 2 || paso1Completo) {
        const valNum = datos.valorPagado || datos.valor_pagado
        const montoTexto = (datos.fechaPago || datos.fecha_pago) && valNum 
          ? ` ($${Number(String(valNum).replace(/\D/g, '')).toLocaleString('es-CO')})` 
          : ''
        return {
          colorCodigo: 'amarillo',
          etiqueta: 'Fase 2: En Trámite de Pago',
          tooltip: `Gestión operativa • En trámite de pago${montoTexto}`
        }
      }

      // 4. AZUL: Paso 1 iniciado o en progreso (incompleto)
      if (tieneAlgoPaso1) {
        let detalleFase1 = 'En asignación de conductor'
        if (nombreResp && tieneSoporte1) {
          detalleFase1 = `En revisión de firmas (${nombreResp.split(' ')[0]})`
        } else if (nombreResp) {
          detalleFase1 = `En asignación (${nombreResp.split(' ')[0]})`
        } else if (distPago) {
          detalleFase1 = 'En asignación de responsabilidad'
        }

        return {
          colorCodigo: 'azul',
          etiqueta: 'Fase 1: Asignación y Firmas',
          tooltip: `Gestión operativa • ${detalleFase1} (Paso 1)`
        }
      }

      // 5. GRIS: Sin gestión iniciada
      return {
        colorCodigo: 'gris',
        etiqueta: 'Sin gestión',
        tooltip: 'Gestión operativa • Sin gestión iniciada'
      }
    } catch (e) {
      return {
        colorCodigo: 'gris',
        etiqueta: 'Sin gestión',
        tooltip: 'Gestión operativa • Sin gestión iniciada'
      }
    }
  }

  // Formatear fechas a formato DD/MM/YYYY con separador '/'
  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return ''
    if (fechaStr === 'En proceso de notificación' || fechaStr === 'N/A' || fechaStr === 'Sin notificar') {
      return fechaStr
    }
    const parteFecha = fechaStr.split('T')[0].split(' ')[0].trim()
    const partesGuion = parteFecha.split('-')
    if (partesGuion.length === 3) {
      if (partesGuion[0].length === 4) {
        // YYYY-MM-DD -> DD/MM/YYYY
        return `${partesGuion[2].padStart(2, '0')}/${partesGuion[1].padStart(2, '0')}/${partesGuion[0]}`
      }
      // DD-MM-YYYY -> DD/MM/YYYY
      return `${partesGuion[0].padStart(2, '0')}/${partesGuion[1].padStart(2, '0')}/${partesGuion[2]}`
    }
    const partesBarra = parteFecha.split('/')
    if (partesBarra.length === 3 && partesBarra[0].length === 4) {
      // YYYY/MM/DD -> DD/MM/YYYY
      return `${partesBarra[2].padStart(2, '0')}/${partesBarra[1].padStart(2, '0')}/${partesBarra[0]}`
    }
    return parteFecha.replace(/-/g, '/')
  }

  // Generar texto descriptivo de vigencia para el tooltip de la columna Descuento
  const obtenerTextoTooltipDescuento = (c) => {
    if (c.estado_simit !== 'Activo') {
      if (c.etiqueta_descuento?.includes('50')) {
        return 'Comparendo pagado con 50% de descuento legal • Paz y salvo'
      }
      if (c.etiqueta_descuento?.includes('25')) {
        return 'Comparendo pagado con 25% de descuento legal • Paz y salvo'
      }
      return 'Comparendo pagado a tarifa plena • Paz y salvo'
    }
    if (c.fecha_limite_descuento === 'Pendiente Notificación' || c.etiqueta_descuento?.includes('Sin Notificar')) {
      return 'Términos no iniciados (11 días hábiles de ley al ser notificado)'
    }
    if (!c.fecha_limite_descuento || c.fecha_limite_descuento === 'Vencido' || c.etiqueta_descuento === 'Sin Descuento') {
      return 'Plazo de descuento vencido • Tarifa plena'
    }
    return `Descuento vigente hasta el ${formatearFecha(c.fecha_limite_descuento)}`
  }

  // Renderizar el valor a pagar con el distintivo definitivo "✓ Real pagado" (Opción 3 elegida)
  const renderizarDistintivoPagoReal = (valor, esReal) => {
    const textoValor = `$${Math.round(Number(valor || 0)).toLocaleString('es-CO')}`
    if (!esReal) {
      return textoValor
    }

    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.25 }}>
        <span>{textoValor}</span>
        <span style={{
          fontSize: '0.67rem',
          fontWeight: 600,
          color: '#059669',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          marginTop: '2px'
        }}>
          ✓ Real pagado
        </span>
      </div>
    )
  }

  // Asegurar carga de comparendos al montar (usa caché global en memoria si ya existen)
  useEffect(() => {
    cargarComparendos(false)
  }, [cargarComparendos])

  // Escuchar búsquedas externas desde las alertas o tarjetas KPI (ej. botón "en riesgo")
  useEffect(() => {
    if (versionBusquedaExterna > 0 && busquedaExterna) {
      setBusqueda(busquedaExterna)
      setFiltroEstado('Activo')
      setFiltroDescuento('todos')
      setFiltroSubestado('todos')
      setPaginaActual(1)
    }
  }, [busquedaExterna, versionBusquedaExterna])

  // Escuchar filtrado directo por estado (Activos / Pagados) desde las tarjetas KPI
  useEffect(() => {
    if (versionFiltroEstadoExterno > 0 && filtroEstadoExterno) {
      setFiltroEstado(filtroEstadoExterno)
      setBusqueda('')
      setFiltroDescuento('todos')
      setFiltroSubestado('todos')
      setPaginaActual(1)
    }
  }, [filtroEstadoExterno, versionFiltroEstadoExterno])

  // Filtrado reactivo en memoria exactamente idéntico al de PaginaConfiguracion.jsx:
  // Se ejecuta instantáneamente al escribir o cambiar filtros sin llamadas a red ni parpadeos de carga
  const comparendosFiltrados = useMemo(() => {
    return todosComparendos.filter((c) => {
      // 1. Coincidencia por texto (placa, comparendo, infracción, secretaría, NIT/empresa, resolución)
      if (busqueda && busqueda.trim()) {
        const termino = busqueda.toLowerCase().trim()
        const partes = termino.split(',').map(p => p.trim()).filter(Boolean)
        if (partes.length > 1) {
          const coincidePlacas = partes.some(p => c.placa?.toLowerCase().includes(p))
          if (!coincidePlacas) return false
        } else {
          const coincideTexto = (
            c.placa?.toLowerCase().includes(termino) ||
            c.numero_comparendo?.toLowerCase().includes(termino) ||
            c.codigo_infraccion?.toLowerCase().includes(termino) ||
            c.secretaria?.toLowerCase().includes(termino) ||
            c.criterio_busqueda?.toLowerCase().includes(termino) ||
            c.descripcion_infraccion?.toLowerCase().includes(termino) ||
            c.numero_resolucion?.toLowerCase().includes(termino)
          )
          if (!coincideTexto) return false
        }
      }

      // 2. Coincidencia por Estado SIMIT
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'No activo') {
          if (c.estado_simit !== 'No activo' && c.estado_simit !== 'Pagado') return false
        } else if (c.estado_simit !== filtroEstado) {
          return false
        }
      }

      // 3. Coincidencia por Descuentos
      if (filtroDescuento === '50') {
        const tiene50 = Boolean(c.aplica_descuento_50 || c.etiqueta_descuento?.includes('50'))
        if (!tiene50) return false
      } else if (filtroDescuento === '25') {
        const tiene25 = Boolean(c.aplica_descuento_25 || c.etiqueta_descuento?.includes('25'))
        if (!tiene25) return false
      } else if (filtroDescuento === 'sin_descuento') {
        const tieneAlguno = Boolean(c.aplica_descuento_50 || c.aplica_descuento_25 || c.etiqueta_descuento?.includes('50') || c.etiqueta_descuento?.includes('25'))
        if (tieneAlguno) return false
      }

      // 4. Coincidencia por Subestado Operativo (semáforo / localStorage)
      if (filtroSubestado !== 'todos') {
        if (obtenerSubestadoGestion(c).colorCodigo !== filtroSubestado) return false
      }

      return true
    })
  }, [todosComparendos, busqueda, filtroEstado, filtroDescuento, filtroSubestado, versionGestion])

  // Cálculos de paginación sobre el resultado filtrado en memoria
  const totalRegistros = comparendosFiltrados.length
  const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limitePorPagina))
  const indiceInicio = (paginaActual - 1) * limitePorPagina
  const indiceFin = indiceInicio + limitePorPagina
  const comparendosPaginados = comparendosFiltrados.slice(indiceInicio, indiceFin)

  const cambiarLimite = (nuevoLimite) => {
    if (nuevoLimite === 'personalizado') {
      setMostrarInputPersonalizado(true)
    } else {
      setMostrarInputPersonalizado(false)
      setLimitePorPagina(Number(nuevoLimite))
      setPaginaActual(1)
    }
  }

  const aplicarLimitePersonalizado = (e) => {
    e.preventDefault()
    const valor = parseInt(limitePersonalizado, 10)
    if (valor && valor > 0 && valor <= 100) {
      setLimitePorPagina(valor)
      setPaginaActual(1)
    }
  }

  return (
    <section className="seccion-tabla seccion-tabla-comparendos">
      <div className="tabla-herramientas">
        {/* Buscador */}
        <form onSubmit={(e) => e.preventDefault()} className="buscador-contenedor">
          <Search size={18} color="var(--texto-secundario)" />
          <input
            type="text"
            className="buscador-input"
            placeholder="Buscar por placa, NIT, comparendo, secretaría..."
            value={busqueda}
            onChange={(e) => {
              const val = e.target.value
              setBusqueda(val)
              setPaginaActual(1)
              if (!val && alLimpiarBusquedaExterna) {
                alLimpiarBusquedaExterna()
              }
            }}
          />
          {busqueda && (
            <EtiquetaTooltip texto="Limpiar búsqueda" posicion="arriba">
              <button
                type="button"
                onClick={() => {
                  setBusqueda('')
                  setPaginaActual(1)
                  if (alLimpiarBusquedaExterna) alLimpiarBusquedaExterna()
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--texto-secundario)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 0.4rem'
                }}
                aria-label="Limpiar búsqueda"
              >
                <X size={16} />
              </button>
            </EtiquetaTooltip>
          )}
        </form>

        {/* Filtros Corporativos */}
        <div className="filtros-contenedor">
          <SelectorDesplegable
            valor={filtroEstado}
            alCambiar={(nuevoEstado) => {
              setFiltroEstado(nuevoEstado)
              setPaginaActual(1)
            }}
            opciones={[
              {
                valor: 'todos',
                etiqueta: 'Todos los Estados'
              },
              {
                valor: 'Activo',
                etiqueta: 'Activos'
              },
              {
                valor: 'No activo',
                etiqueta: 'Pagados'
              }
            ]}
            anchoMinimo="120px"
          />

          <SelectorDesplegable
            valor={filtroDescuento}
            alCambiar={(nuevoDescuento) => {
              setFiltroDescuento(nuevoDescuento)
              setPaginaActual(1)
            }}
            opciones={[
              {
                valor: 'todos',
                etiqueta: 'Todos los Descuentos'
              },
              {
                valor: '50',
                etiqueta: 'Con 50% Vigente',
                badge: '50%',
                claseBadge: 'selector-badge-verde'
              },
              {
                valor: '25',
                etiqueta: 'Con 25% Vigente',
                badge: '25%',
                claseBadge: 'selector-badge-ambar'
              },
              {
                valor: 'sin_descuento',
                etiqueta: 'Sin Descuento',
                badge: '0%',
                claseBadge: 'selector-badge-neutro'
              }
            ]}
            icono={Percent}
            anchoMinimo="155px"
          />

          <SelectorDesplegable
            valor={filtroSubestado}
            alCambiar={(nuevoSubestado) => {
              setFiltroSubestado(nuevoSubestado)
              setPaginaActual(1)
            }}
            opciones={[
              {
                valor: 'todos',
                etiqueta: 'Todos los Subestados',
                icono: FolderKanban
              },
              {
                valor: 'gris',
                etiqueta: 'Sin Gestión',
                colorIndicador: '#94a3b8'
              },
              {
                valor: 'azul',
                etiqueta: 'Fase 1: Asignación y Firmas',
                colorIndicador: '#2563eb'
              },
              {
                valor: 'amarillo',
                etiqueta: 'Fase 2: En Trámite de Pago',
                colorIndicador: '#f59e0b'
              },
              {
                valor: 'naranja',
                etiqueta: 'Fase 3: Esperando Descargue SIMIT',
                colorIndicador: '#ea580c'
              },
              {
                valor: 'verde',
                etiqueta: 'Paz y Salvo • Descargado SIMIT',
                colorIndicador: '#10b981'
              }
            ]}
            icono={FolderKanban}
            anchoMinimo={filtroSubestado === 'todos' ? '150px' : '180px'}
            posicionAlineacion="derecha"
          />

          <BotonExportarExcel deshabilitado={cargando} />
        </div>
      </div>

      {/* Tabla Original con Datos Reales */}
      <div className="tabla-envoltorio">
        <table className="tabla-datos">
          <thead>
            <tr>
              <th>Placa</th>
              <th>N° Comparendo</th>
              <th>Infracción</th>
              <th>Notificación</th>
              <th>Código</th>
              <th>Total</th>
              <th>Descuento</th>
              <th>A Pagar</th>
              <th>Estado</th>
              <th style={{ textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                  Cargando comparendos...
                </td>
              </tr>
            ) : comparendosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--texto-atenuado)' }}>
                  No se encontraron comparendos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              comparendosPaginados.map((c) => {
                const subestadoInfo = obtenerSubestadoGestion(c)

                // Prevalencia reactiva del valor real pagado en la gestión operativa (Paso 2)
                const gestionFila = mapaGestiones[c.id]
                const valPagadoGestion = gestionFila?.valor_pagado ?? gestionFila?.valorPagado
                const tienePagoReal = (valPagadoGestion !== undefined && valPagadoGestion !== null && Number(String(valPagadoGestion).replace(/\D/g, '')) > 0) || Boolean(c.es_valor_real_pagado)
                const esRealVisual = tienePagoReal

                const valorAPagarFinal = (valPagadoGestion !== undefined && valPagadoGestion !== null && Number(String(valPagadoGestion).replace(/\D/g, '')) > 0)
                  ? Number(String(valPagadoGestion).replace(/\D/g, ''))
                  : (c.valor_a_pagar || 0)

                const valorSimitBase = Number(c.valor_total_simit ?? c.valor_total ?? 0)

                // Alternativa 2:
                // Si el valor pagado real supera el valor total nominal de SIMIT,
                // el valor total se ajusta al valor pagado para reflejar el total efectivo (con mora/recargo)
                const tieneRecargo = tienePagoReal && valorAPagarFinal > valorSimitBase
                const valorTotalFinal = tieneRecargo ? valorAPagarFinal : Number(c.valor_total || valorSimitBase)
                const recargoMora = tieneRecargo ? (valorAPagarFinal - valorSimitBase) : (c.recargo_mora || 0)

                const ahorroDisponibleFinal = tienePagoReal
                  ? Math.max(0, valorTotalFinal - valorAPagarFinal)
                  : (c.ahorro_disponible || 0)

                const comparendoEnriquecido = {
                  ...c,
                  valor_total: valorTotalFinal,
                  valor_total_simit: valorSimitBase,
                  tiene_recargo_pago: tieneRecargo,
                  recargo_mora: recargoMora,
                  valor_a_pagar: valorAPagarFinal,
                  ahorro_disponible: ahorroDisponibleFinal,
                  es_valor_real_pagado: tienePagoReal
                }

                return (
                  <tr key={c.id} onClick={() => setComparendoSeleccionado(comparendoEnriquecido)} style={{ cursor: 'pointer' }}>
                    <td>
                      <span className="placa-badge">{c.placa}</span>
                    </td>
                    <td style={{ fontSize: '0.78rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                      {c.numero_comparendo}
                    </td>
                    <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }} title={c.fecha_infraccion}>
                      {formatearFecha(c.fecha_infraccion)}
                    </td>
                    <td>
                      {c.fecha_notificacion === 'En proceso de notificación' ? (
                        <span
                          title="La secretaría de tránsito aún no ha notificado formalmente a la empresa. Los días de descuento no han empezado a correr."
                          style={{ fontSize: '0.72rem', color: '#d97706', fontWeight: 600, background: 'rgba(245, 158, 11, 0.12)', padding: '0.15rem 0.45rem', borderRadius: '4px', whiteSpace: 'nowrap' }}
                        >
                          ⏳ En proceso
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{formatearFecha(c.fecha_notificacion)}</span>
                      )}
                    </td>
                    <td>
                      <EtiquetaTooltip texto={c.descripcion_infraccion || `Infracción código ${c.codigo_infraccion}`}>
                        <strong
                          style={{
                              color: 'var(--color-primario)',
                            cursor: 'help',
                            display: 'inline-block',
                            textDecoration: 'underline dotted',
                            textUnderlineOffset: '3px'
                          }}
                        >
                          {c.codigo_infraccion}
                        </strong>
                      </EtiquetaTooltip>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {tieneRecargo ? (
                        <EtiquetaTooltip
                          texto={`Total ajustado con recargo/mora de +$${recargoMora.toLocaleString('es-CO')} sobre la base SIMIT ($${valorSimitBase.toLocaleString('es-CO')})`}
                          posicion="arriba"
                        >
                          <span style={{ cursor: 'help', borderBottom: '1px dotted var(--texto-secundario)' }}>
                            ${Math.round(valorTotalFinal).toLocaleString('es-CO')}
                          </span>
                        </EtiquetaTooltip>
                      ) : (
                        `$${Math.round(valorTotalFinal).toLocaleString('es-CO')}`
                      )}
                    </td>
                    <td>
                      <EtiquetaTooltip texto={obtenerTextoTooltipDescuento(c)} posicion="arriba">
                        <span className={`chip-descuento ${c.etiqueta_descuento?.includes('Sin Notificar') ? 'd50-pendiente' :
                          c.etiqueta_descuento?.includes('50') ? 'd50' :
                            c.etiqueta_descuento?.includes('25') ? 'd25' : 'sin'
                          }`} style={{ whiteSpace: 'nowrap', cursor: 'help' }}>
                          {c.etiqueta_descuento}
                        </span>
                      </EtiquetaTooltip>
                    </td>
                    <td style={{ fontWeight: 700, color: ahorroDisponibleFinal > 0 ? 'var(--color-exito)' : 'inherit', whiteSpace: 'nowrap' }}>
                      {renderizarDistintivoPagoReal(valorAPagarFinal, esRealVisual)}
                    </td>
                    <td>
                      <span className={`chip-estado ${c.estado_simit === 'Activo' ? 'activo' : 'inactivo'}`}>
                        {c.estado_simit === 'Activo' ? 'Activo' : 'Pagado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}>
                        <EtiquetaTooltip texto={subestadoInfo.tooltip} posicion="arriba">
                          <button
                            className="boton-icono boton-icono-gestion"
                            style={{ width: '32px', height: '32px' }}
                            onClick={(e) => { e.stopPropagation(); setComparendoGestion(comparendoEnriquecido); }}
                            aria-label={subestadoInfo.tooltip}
                          >
                            <FolderKanban size={15} />
                            <span
                              className={`indicador-punto-subestado punto-${subestadoInfo.colorCodigo}`}
                              aria-hidden="true"
                            />
                          </button>
                        </EtiquetaTooltip>
                        <EtiquetaTooltip texto="Ver detalle legal" posicion="arriba">
                          <button
                            className="boton-icono"
                            style={{ width: '32px', height: '32px' }}
                            onClick={(e) => { e.stopPropagation(); setComparendoSeleccionado(comparendoEnriquecido); }}
                            aria-label="Ver detalle legal"
                          >
                            <Eye size={15} />
                          </button>
                        </EtiquetaTooltip>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación Configurable */}
      <div className="tabla-paginacion">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>
            Mostrando <strong>{comparendosPaginados.length}</strong> de <strong>{totalRegistros}</strong> registros
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)' }}>Ver por página:</span>
            <SelectorDesplegable
              valor={mostrarInputPersonalizado ? 'personalizado' : String(limitePorPagina)}
              alCambiar={(nuevoValor) => cambiarLimite(nuevoValor)}
              opciones={[
                { valor: '5', etiqueta: '5 registros (Predeterminado)' },
                { valor: '10', etiqueta: '10 registros' },
                { valor: '20', etiqueta: '20 registros' },
                { valor: '50', etiqueta: '50 registros' },
                { valor: 'personalizado', etiqueta: 'Personalizado...' }
              ]}
              direccion="arriba"
              tamano="compacto"
              anchoMinimo="205px"
            />

            {mostrarInputPersonalizado && (
              <form onSubmit={aplicarLimitePersonalizado} style={{ display: 'flex', gap: '0.25rem' }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Cant."
                  className="campo-input"
                  style={{ width: '65px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  value={limitePersonalizado}
                  onChange={(e) => setLimitePersonalizado(e.target.value)}
                />
                <button type="submit" className="boton-secundario" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  OK
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="paginacion-controles">
          <button
            className="boton-paginacion"
            disabled={paginaActual <= 1}
            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <span style={{ fontWeight: 600, padding: '0 0.5rem' }}>
            Página {paginaActual} de {totalPaginas}
          </span>

          <button
            className="boton-paginacion"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Modal de Detalle */}
      {comparendoSeleccionado && (
        <ModalDetalleComparendo
          comparendo={comparendoSeleccionado}
          alCerrar={() => setComparendoSeleccionado(null)}
        />
      )}

      {/* Modal de Gestión Operativa (Flujo de Pago y Soportes) */}
      {comparendoGestion && (
        <ModalGestionOperativa
          comparendo={comparendoGestion}
          gestionInicial={mapaGestiones[comparendoGestion.id]}
          alCerrar={() => setComparendoGestion(null)}
          alActualizarGestion={(comparendoId, nuevaGestion) => {
            setVersionGestion(v => v + 1)
            if (comparendoId && nuevaGestion) {
              setMapaGestiones(prev => ({
                ...prev,
                [comparendoId]: nuevaGestion
              }))
            }
            // Refrescar KPIs ejecutivos (Ahorro en Descuento y Deuda Pendiente) de inmediato
            if (cargarKPIs) {
              cargarKPIs()
            }
          }}
        />
      )}
    </section>
  )
}
