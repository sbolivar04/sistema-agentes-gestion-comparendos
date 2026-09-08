import React, { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'

/**
 * Componente Reutilizable: ModalConfirmacion
 * Modal corporativo para confirmación de acciones críticas (eliminar, pausar, desvincular, etc.)
 * 
 * @param {boolean} abierto - Controla la visibilidad del modal
 * @param {function} alCerrar - Callback al cancelar o cerrar el modal
 * @param {function} alConfirmar - Callback al presionar el botón de confirmación
 * @param {string} titulo - Título principal del modal
 * @param {string|React.ReactNode} mensaje - Explicación detallada en lenguaje natural
 * @param {string} [textoConfirmar='Confirmar'] - Texto del botón de acción
 * @param {string} [textoCancelar='Cancelar'] - Texto del botón secundario
 * @param {'peligro'|'advertencia'|'info'|'exito'} [tipo='peligro'] - Define colores y tono visual
 * @param {object} [detalle] - Información clave a resaltar { etiqueta, valor, subvalor }
 * @param {boolean} [cargando=false] - Muestra spinner de carga y deshabilita acciones
 */
export function ModalConfirmacion({
  abierto,
  alCerrar,
  alConfirmar,
  titulo = '¿Confirmar acción?',
  mensaje = 'Esta acción no se puede deshacer.',
  textoConfirmar = 'Confirmar',
  textoCancelar = 'Cancelar',
  tipo = 'peligro',
  detalle = null,
  cargando = false
}) {
  const [hoverConfirmar, setHoverConfirmar] = useState(false)

  // Manejo de tecla Escape para cerrar
  useEffect(() => {
    const manejarEscape = (e) => {
      if (e.key === 'Escape' && abierto && !cargando) {
        alCerrar()
      }
    }
    window.addEventListener('keydown', manejarEscape)
    return () => window.removeEventListener('keydown', manejarEscape)
  }, [abierto, cargando, alCerrar])

  if (!abierto) return null

  // Configuración de paleta según el tipo (Premium look)
  const configuracionTipo = {
    peligro: {
      fondo: '#ef4444',
      fondoHover: '#dc2626',
      sombra: 'rgba(239, 68, 68, 0.35)'
    },
    advertencia: {
      fondo: '#f59e0b',
      fondoHover: '#d97706',
      sombra: 'rgba(245, 158, 11, 0.35)'
    },
    info: {
      fondo: 'var(--color-primario, #0284c7)',
      fondoHover: 'var(--color-primario-oscuro, #0369a1)',
      sombra: 'rgba(2, 132, 199, 0.35)'
    },
    exito: {
      fondo: '#10b981',
      fondoHover: '#059669',
      sombra: 'rgba(16, 185, 129, 0.35)'
    }
  }

  const config = configuracionTipo[tipo] || configuracionTipo.peligro

  return (
    <div 
      className="modal-fondo" 
      onClick={!cargando ? alCerrar : undefined}
      style={{ animation: 'aparecerModal 0.2s ease-out forwards' }}
    >
      <div 
        className="modal-caja-confirmacion" 
        onClick={(e) => e.stopPropagation()}
        style={{ padding: '2rem 1.75rem 1.75rem' }}
      >
        {/* Botón Cerrar (X) superior */}
        <button 
          className="modal-confirmacion-btn-cerrar" 
          onClick={alCerrar}
          disabled={cargando}
          title="Cerrar ventana"
        >
          <X size={18} />
        </button>

        {/* Cuerpo del Mensaje */}
        <div className="modal-confirmacion-cuerpo">
          <h3 className="modal-confirmacion-titulo">{titulo}</h3>
          
          <div className="modal-confirmacion-mensaje">
            {mensaje}
          </div>

          {/* Tarjeta de Detalle Opcional */}
          {detalle && (
            <div className="modal-confirmacion-detalle">
              {detalle.etiqueta && (
                <span className="modal-confirmacion-detalle-etiqueta">
                  {detalle.etiqueta}
                </span>
              )}
              {detalle.valor && (
                <span className="modal-confirmacion-detalle-valor">
                  {detalle.valor}
                </span>
              )}
              {detalle.subvalor && (
                <span className="modal-confirmacion-detalle-subvalor">
                  {detalle.subvalor}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Botones de Acción en una sola fila */}
        <div className="modal-confirmacion-acciones">
          <button 
            type="button"
            className="modal-btn-premium-cancelar"
            onClick={alCerrar}
            disabled={cargando}
          >
            {textoCancelar}
          </button>

          <button 
            type="button"
            className="modal-btn-premium-confirmar"
            onClick={alConfirmar}
            onMouseEnter={() => setHoverConfirmar(true)}
            onMouseLeave={() => setHoverConfirmar(false)}
            disabled={cargando}
            style={{
              backgroundColor: hoverConfirmar ? config.fondoHover : config.fondo,
              boxShadow: hoverConfirmar ? `0 6px 16px ${config.sombra}` : `0 4px 10px ${config.sombra}`,
              transform: hoverConfirmar ? 'translateY(-2px)' : 'translateY(0)'
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Procesando...</span>
              </>
            ) : (
              <span>{textoConfirmar}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
