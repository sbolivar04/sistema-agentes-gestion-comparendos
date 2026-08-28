import React from 'react'
import { AlertTriangle, Clock, ShieldCheck, Sparkles, AlertCircle, ArrowRight } from 'lucide-react'

export function PanelAlertas({ alertas = {}, alSeleccionarComparendo }) {
  const listaVencimientos = alertas.alertas_vencimiento || []
  const listaNuevos = alertas.comparendos_nuevos || []

  if (listaVencimientos.length === 0 && listaNuevos.length === 0) {
    return null
  }

  return (
    <section className="seccion-alertas">
      <div className="seccion-alertas-cabecera">
        <div className="seccion-alertas-titulo">
          <AlertCircle size={22} color="var(--color-alerta-amarillo)" />
          <h3>Alertas Operativas y Semáforo de Descuentos</h3>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.8rem' }}>
          {alertas.total_rojas > 0 && (
            <span className="chip-descuento sin" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <AlertTriangle size={12} /> {alertas.total_rojas} Críticas (&le; 4 días hábiles)
            </span>
          )}
          {alertas.total_amarillas > 0 && (
            <span className="chip-descuento d25" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Clock size={12} /> {alertas.total_amarillas} Precaución (5-8 días hábiles)
            </span>
          )}
        </div>
      </div>

      <div className="lista-alertas">
        {/* Alertas de Vencimiento */}
        {listaVencimientos.map((alerta) => {
          const esRojo = alerta.nivel_alerta === 'ROJO'
          return (
            <div 
              key={alerta.id} 
              className={`item-alerta ${esRojo ? 'rojo' : 'amarillo'}`}
              onClick={() => alSeleccionarComparendo && alSeleccionarComparendo(alerta)}
              style={{ cursor: 'pointer' }}
            >
              {esRojo ? (
                <AlertTriangle size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              ) : (
                <Clock size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              )}
              
              <div className="alerta-contenido" style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4>Placa: {alerta.placa}</h4>
                  <span className="placa-badge" style={{ fontSize: '0.7rem' }}>
                    Desc. {alerta.tipo_descuento}
                  </span>
                </div>
                
                <p>
                  <strong>{alerta.mensaje_urgencia}</strong> • Vence el {alerta.fecha_limite}
                </p>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.35rem' }}>
                  <span className="alerta-ahorro">
                    Ahorro en juego: ${Number(alerta.ahorro_en_juego || 0).toLocaleString('es-CO')} COP
                  </span>
                  <span style={{ fontSize: '0.75rem', textDecoration: 'underline', display: 'flex', alignItems: 'center' }}>
                    Ver detalle <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            </div>
          )
        })}

        {/* Notificación de Nuevos Comparendos */}
        {listaNuevos.slice(0, 2).map((nuevo) => (
          <div key={`nuevo-${nuevo.id}`} className="item-alerta verde">
            <Sparkles size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div className="alerta-contenido">
              <h4>Nuevo Comparendo Detectado: {nuevo.placa}</h4>
              <p>{nuevo.secretaria} • Código {nuevo.codigo_infraccion}</p>
              <span className="alerta-ahorro" style={{ color: '#065f46' }}>
                Total: ${Number(nuevo.valor_total || 0).toLocaleString('es-CO')} COP
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
