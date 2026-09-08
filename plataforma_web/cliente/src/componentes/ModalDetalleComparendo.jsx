import React, { useState, useEffect } from 'react'
import {
  X,
  MapPin,
  Calendar,
  Clock,
  FileText,
  Scale,
  AlertCircle,
  Tag,
  Copy,
  Check,
  DollarSign,
  FileSpreadsheet,
  Info
} from 'lucide-react'

/**
 * Componente ModalDetalleComparendo (Diseño Ejecutivo 2 Columnas)
 * Distribución optimizada para aprovechar el espacio horizontal, garantizando que
 * los números SIMIT de 20 dígitos se muestren de forma continua en una sola línea.
 */
export function ModalDetalleComparendo({ comparendo, alCerrar }) {
  const [copiadoComparendo, setCopiadoComparendo] = useState(false)
  const [copiadoResolucion, setCopiadoResolucion] = useState(false)

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const manejarTeclaEscape = (e) => {
      if (e.key === 'Escape') {
        alCerrar()
      }
    }
    window.addEventListener('keydown', manejarTeclaEscape)
    return () => window.removeEventListener('keydown', manejarTeclaEscape)
  }, [alCerrar])

  if (!comparendo) return null

  const copiarAlPortapapeles = (texto, tipo) => {
    if (!texto || texto === 'N/A' || texto === 'Sin resolución') return
    navigator.clipboard.writeText(texto)
    if (tipo === 'comparendo') {
      setCopiadoComparendo(true)
      setTimeout(() => setCopiadoComparendo(false), 2000)
    } else {
      setCopiadoResolucion(true)
      setTimeout(() => setCopiadoResolucion(false), 2000)
    }
  }

  const formatoMoneda = (val) => {
    return `$ ${Math.round(Number(val || 0)).toLocaleString('es-CO')}`
  }

  const formatearFecha = (fechaStr) => {
    if (!fechaStr) return ''
    if (fechaStr === 'En proceso de notificación' || fechaStr === 'N/A' || fechaStr === 'Sin notificar') {
      return fechaStr
    }
    const parteFecha = fechaStr.split('T')[0].split(' ')[0].trim()
    const partesGuion = parteFecha.split('-')
    if (partesGuion.length === 3) {
      if (partesGuion[0].length === 4) {
        return `${partesGuion[2].padStart(2, '0')}/${partesGuion[1].padStart(2, '0')}/${partesGuion[0]}`
      }
      return `${partesGuion[0].padStart(2, '0')}/${partesGuion[1].padStart(2, '0')}/${partesGuion[2]}`
    }
    const partesBarra = parteFecha.split('/')
    if (partesBarra.length === 3 && partesBarra[0].length === 4) {
      return `${partesBarra[2].padStart(2, '0')}/${partesBarra[1].padStart(2, '0')}/${partesBarra[0]}`
    }
    return parteFecha.replace(/-/g, '/')
  }

  const formatearFechaHora = (fechaStr) => {
    if (!fechaStr || fechaStr === 'N/A' || fechaStr === 'Sin notificar') return fechaStr || ''

    let horaStr = ''
    let parteFecha = fechaStr.trim()

    if (parteFecha.includes('T')) {
      const partes = parteFecha.split('T')
      parteFecha = partes[0]
      if (partes[1]) {
        horaStr = partes[1].substring(0, 5)
      }
    } else if (parteFecha.includes(' ')) {
      const partes = parteFecha.split(' ')
      parteFecha = partes[0]
      if (partes[1]) {
        horaStr = partes[1].substring(0, 5)
      }
    }

    const fechaFormateada = formatearFecha(parteFecha)
    return horaStr ? `${fechaFormateada} ${horaStr}` : fechaFormateada
  }


  const esPendienteNotif = !comparendo.fecha_notificacion ||
    comparendo.fecha_notificacion === 'En proceso de notificación' ||
    comparendo.fecha_notificacion === 'N/A'

  const esPagado = comparendo.estado_simit === 'Pagado' || comparendo.estado_simit !== 'Activo'

  // Cálculo de intereses de mora (provistos por SIMIT o diferencia sobre el valor nominal)
  const interesesMora = Number(comparendo.intereses || 0) > 0
    ? Number(comparendo.intereses)
    : Math.max(0, Number(comparendo.valor_a_pagar || comparendo.valor_total || 0) - Number(comparendo.valor_nominal || 0))


  return (
    <div className="modal-fondo" onClick={alCerrar}>
      <div
        className="modal-caja-detalle-infraccion"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-modal-infraccion"
      >
        {/* Cabecera Corporativa con Placa, Infracción y Estado */}
        <div className="modal-detalle-cabecera">
          <div className="modal-detalle-titulo-contenedor">
            <span className="placa-badge" style={{ fontSize: '1.1rem', padding: '0.35rem 0.85rem' }}>
              {comparendo.placa}
            </span>

            <div className="modal-detalle-titulos">
              <h3 id="titulo-modal-infraccion">Detalle de Infracción</h3>
              <span>Expediente digital SIMIT</span>
            </div>

            {/* Infracción y Estado en la misma cabecera para liberar espacio */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
              <span
                style={{
                  background: 'rgba(2, 132, 199, 0.1)',
                  color: 'var(--color-primario)',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(2, 132, 199, 0.25)'
                }}
              >
                Infracción {comparendo.codigo_infraccion || 'N/A'}
              </span>

              <span className={`chip-estado ${comparendo.estado_simit === 'Activo' ? 'activo' : 'inactivo'}`}>
                {comparendo.estado_simit === 'Activo' ? 'Activo' : 'Pagado'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="boton-icono"
            onClick={alCerrar}
            aria-label="Cerrar modal"
            style={{ width: '34px', height: '34px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Cuerpo del Modal con Distribución Optimizada */}
        <div className="modal-detalle-cuerpo">
          {/* Barra Horizontal Superior: Números de 20 dígitos en 1 sola línea */}
          <div className="modal-franja-identificadores">
            <div className="modal-id-item">
              <span className="modal-id-etiqueta">
                <FileText size={13} color="var(--color-primario)" /> N° Comparendo
              </span>
              <div className="modal-id-valor-contenedor">
                <span className="modal-id-valor">
                  {comparendo.numero_comparendo || 'N/A'}
                </span>
                {comparendo.numero_comparendo && (
                  <button
                    type="button"
                    className="boton-copiar-id"
                    onClick={() => copiarAlPortapapeles(comparendo.numero_comparendo, 'comparendo')}
                    title="Copiar número de comparendo"
                  >
                    {copiadoComparendo ? <Check size={12} color="var(--color-exito)" /> : <Copy size={12} />}
                    {copiadoComparendo ? 'Copiado' : 'Copiar'}
                  </button>
                )}
              </div>
            </div>

            <div className="modal-id-item">
              <span className="modal-id-etiqueta">
                <Scale size={13} color="var(--color-primario)" /> N° Resolución
              </span>
              <div className="modal-id-valor-contenedor">
                <span className="modal-id-valor" style={{ color: comparendo.numero_resolucion ? 'var(--texto-principal)' : 'var(--texto-atenuado)' }}>
                  {comparendo.numero_resolucion || 'Sin resolución emitida'}
                </span>
                {comparendo.numero_resolucion && (
                  <button
                    type="button"
                    className="boton-copiar-id"
                    onClick={() => copiarAlPortapapeles(comparendo.numero_resolucion, 'resolucion')}
                    title="Copiar número de resolución"
                  >
                    {copiadoResolucion ? <Check size={12} color="var(--color-exito)" /> : <Copy size={12} />}
                    {copiadoResolucion ? 'Copiado' : 'Copiar'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Módulos en 2 Columnas Paralelas */}
          <div className="modal-grilla-dos-columnas">
            {/* Columna Izquierda: Ubicación y Notificación */}
            <div className="modal-tarjeta-modulo">
              <div className="modal-tarjeta-modulo-cabecera">
                <MapPin size={15} color="var(--color-primario)" />
                <span>Ubicación y Fechas</span>
              </div>

              <div className="modal-lista-datos">
                <div className="modal-dato-fila">
                  <span className="etiqueta">Secretaría de Tránsito</span>
                  <span className="valor" style={{ fontWeight: 600 }}>
                    {comparendo.secretaria || 'No especificada'}
                  </span>
                </div>

                {comparendo.direccion && (
                  <div className="modal-dato-fila">
                    <span className="etiqueta">Dirección del Hecho</span>
                    <span className="valor">
                      {comparendo.direccion}
                    </span>
                  </div>
                )}

                <div className="modal-dato-fila">
                  <span className="etiqueta">Fecha de Infracción</span>
                  <span className="valor" style={{ fontWeight: 600 }}>
                    {formatearFechaHora(comparendo.fecha_infraccion)}
                  </span>
                </div>

                <div className="modal-dato-fila">
                  <span className="etiqueta">Fecha Notificación</span>
                  <div className="valor">
                    {esPendienteNotif ? (
                      <span style={{
                        color: '#d97706',
                        fontWeight: 600,
                        background: 'rgba(245, 158, 11, 0.12)',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        display: 'inline-block'
                      }}>
                        ⏳ En proceso de notificación
                      </span>
                    ) : (
                      <span style={{ fontWeight: 600 }}>
                        {formatearFecha(comparendo.fecha_notificacion)}
                      </span>
                    )}
                  </div>
                </div>

                {comparendo.fecha_resolucion && 
                 comparendo.fecha_resolucion !== 'N/A' && 
                 comparendo.fecha_resolucion !== 'null' && 
                 comparendo.fecha_resolucion !== 'None' && (
                  <div className="modal-dato-fila">
                    <span className="etiqueta">Fecha Resolución</span>
                    <span className="valor" style={{ fontWeight: 600 }}>
                      {formatearFecha(comparendo.fecha_resolucion)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Columna Derecha: Liquidación y Descuentos Legales */}
            <div className="modal-tarjeta-modulo">
              <div className="modal-tarjeta-modulo-cabecera">
                <Tag size={15} color="var(--color-primario)" />
                <span>Liquidación y Beneficios</span>
              </div>

              <div className="modal-resumen-financiero">
                <div className="modal-fila-precio">
                  <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario)', fontWeight: 600 }}>
                    Valor Nominal SIMIT:
                  </span>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                    {formatoMoneda(comparendo.valor_nominal || comparendo.valor_total)}
                  </span>
                </div>

                {!esPagado && interesesMora > 0 && (
                  <div className="modal-fila-precio">
                    <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario)', fontWeight: 600 }}>
                      Intereses de Mora:
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#dc2626' }}>
                      + {formatoMoneda(interesesMora)}
                    </span>
                  </div>
                )}

                <div className="modal-fila-precio destacada">
                  <div>
                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
                      {esPagado ? 'Total Pagado' : 'Total a Pagar Hoy'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#059669' }}>
                      {esPagado
                        ? (comparendo.ahorro_disponible > 0 
                            ? `Beneficio aplicado: ${comparendo.etiqueta_descuento?.replace('Vigente', '').trim()}`
                            : 'Paz y Salvo SIMIT')
                        : (comparendo.etiqueta_descuento ? `Beneficio: ${comparendo.etiqueta_descuento}` : 'Tarifa Plena')}
                    </span>
                  </div>
                  <span className="monto">
                    {formatoMoneda(comparendo.valor_a_pagar || comparendo.valor_total)}
                  </span>
                </div>

                {/* Banner condicional: Comparendo Pagado vs Ahorro Activo vs Intereses de Mora vs Tarifa Plena */}
                {esPagado ? (
                  <div className="banner-comparendo-pagado">
                    <strong style={{ color: '#059669', display: 'block', marginBottom: '2px' }}>
                      {comparendo.ahorro_disponible > 0
                        ? `✅ Ahorro obtenido: ${formatoMoneda(comparendo.ahorro_disponible)}`
                        : '✅ Comparendo Pagado (Paz y Salvo)'}
                    </strong>
                    <span>
                      {comparendo.ahorro_disponible > 0
                        ? 'Obligación cancelada ante el SIMIT con beneficio de ley. Paz y salvo confirmado.'
                        : 'Obligación cancelada en su totalidad ante el SIMIT sin saldo pendiente.'}
                    </span>
                  </div>
                ) : comparendo.ahorro_disponible > 0 ? (
                  <div className="banner-beneficio-legal">
                    <strong style={{ color: 'var(--color-exito)', display: 'block', marginBottom: '2px' }}>
                      🟢 Ahorro activo: {formatoMoneda(comparendo.ahorro_disponible)}
                    </strong>
                    <span>
                      {esPendienteNotif || comparendo.fecha_limite_descuento === 'Pendiente Notificación'
                        ? 'Términos no iniciados (11 días hábiles de ley al ser notificado).'
                        : `Vigente hasta el ${formatearFecha(comparendo.fecha_limite_descuento)}.`}
                    </span>
                  </div>
                ) : interesesMora > 0 ? (
                  <div className="banner-intereses-mora">
                    <strong style={{ color: '#dc2626', display: 'block', marginBottom: '2px' }}>
                      🔴 Intereses de mora: + {formatoMoneda(interesesMora)}
                    </strong>
                    <span>
                      Recargo acumulado por vencimiento de los términos legales de pago en el SIMIT.
                    </span>
                  </div>
                ) : (
                  <div className="banner-sin-descuento">
                    <strong style={{ color: 'var(--texto-principal)', display: 'block', marginBottom: '2px' }}>
                      ⏱️ Tarifa plena sin descuento
                    </strong>
                    <span>
                      Plazo de beneficios de ley vencido. Sin intereses de mora causados hasta la fecha.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fila Inferior: Descripción Oficial de la Infracción (Ancho Completo) */}
          {comparendo.descripcion_infraccion && (
            <div className="modal-caja-descripcion">
              <Info size={16} color="var(--color-primario)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p>
                <strong style={{ color: 'var(--texto-principal)' }}>Descripción legal ({comparendo.codigo_infraccion}): </strong>
                {comparendo.descripcion_infraccion}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

