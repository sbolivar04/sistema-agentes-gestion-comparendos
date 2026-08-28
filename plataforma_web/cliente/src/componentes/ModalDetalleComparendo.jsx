import React from 'react'
import { X, ShieldAlert, Calendar, DollarSign, MapPin, FileText, CheckCircle } from 'lucide-react'

export function ModalDetalleComparendo({ comparendo, alCerrar }) {
  if (!comparendo) return null

  const formatoMoneda = (val) => {
    return `$ ${Number(val || 0).toLocaleString('es-CO')} COP`
  }

  return (
    <div className="modal-fondo" onClick={alCerrar}>
      <div className="modal-caja" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--borde-tarjeta)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="placa-badge" style={{ fontSize: '1.1rem' }}>
              {comparendo.placa}
            </span>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Detalle de Infracción</h3>
          </div>
          <button className="boton-icono" onClick={alCerrar}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', fontSize: '0.9rem' }}>
          {/* Información General */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: 'var(--fondo-elevado)', padding: '1rem', borderRadius: 'var(--radio-md)' }}>
            <div>
              <p style={{ color: 'var(--texto-atenuado)', fontSize: '0.75rem' }}>N° Comparendo</p>
              <p style={{ fontWeight: 600 }}>{comparendo.numero_comparendo || 'N/A'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--texto-atenuado)', fontSize: '0.75rem' }}>N° Resolución</p>
              <p style={{ fontWeight: 600 }}>{comparendo.numero_resolucion || 'Sin resolución'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--texto-atenuado)', fontSize: '0.75rem' }}>Código Infracción</p>
              <p style={{ fontWeight: 700, color: 'var(--color-primario)' }}>{comparendo.codigo_infraccion || 'N/A'}</p>
            </div>
            <div>
              <p style={{ color: 'var(--texto-atenuado)', fontSize: '0.75rem' }}>Estado SIMIT</p>
              <span className={`chip-estado ${comparendo.estado_simit === 'Activo' ? 'activo' : 'inactivo'}`}>
                {comparendo.estado_simit}
              </span>
            </div>
          </div>

          {/* Fechas y Secretaría */}
          <div>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--texto-secundario)' }}>
              Ubicación y Fechas
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', color: 'var(--texto-principal)' }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MapPin size={15} color="var(--color-primario)" />
                <strong>Secretaría:</strong> {comparendo.secretaria || 'No especificada'}
              </p>
              {comparendo.direccion && (
                <p style={{ fontSize: '0.85rem', color: 'var(--texto-secundario)', paddingLeft: '1.4rem' }}>
                  Dirección: {comparendo.direccion}
                </p>
              )}
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Calendar size={15} color="var(--color-primario)" />
                <strong>Fecha Infracción:</strong> {comparendo.fecha_infraccion}
              </p>
            </div>
          </div>

          {/* Liquidación Financiera */}
          <div style={{ borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--texto-secundario)' }}>
              Liquidación y Descuentos Legales (Ley 769/2002)
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'var(--fondo-elevado)', padding: '0.75rem', borderRadius: 'var(--radio-md)' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>Valor Nominal</p>
                <p style={{ fontWeight: 700 }}>{formatoMoneda(comparendo.valor_nominal || comparendo.valor_total)}</p>
              </div>
              <div style={{ background: 'var(--color-exito-suave)', padding: '0.75rem', borderRadius: 'var(--radio-md)', color: '#065f46' }}>
                <p style={{ fontSize: '0.75rem' }}>Valor a Pagar Hoy</p>
                <p style={{ fontWeight: 700, fontSize: '1.05rem' }}>{formatoMoneda(comparendo.valor_a_pagar)}</p>
              </div>
            </div>

            {comparendo.ahorro_disponible > 0 && (
              <p style={{ marginTop: '0.5rem', color: 'var(--color-exito)', fontWeight: 600, fontSize: '0.85rem' }}>
                🟢 Ahorro aplicable: {formatoMoneda(comparendo.ahorro_disponible)} ({comparendo.etiqueta_descuento})
              </p>
            )}
          </div>

          {comparendo.descripcion_infraccion && (
            <div style={{ borderTop: '1px solid var(--borde-tarjeta)', paddingTop: '0.75rem' }}>
              <p style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)', lineHeight: 1.4 }}>
                <strong>Descripción:</strong> {comparendo.descripcion_infraccion}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
