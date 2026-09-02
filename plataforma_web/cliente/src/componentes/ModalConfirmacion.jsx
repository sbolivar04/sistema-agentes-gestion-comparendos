import React, { useEffect } from 'react'
import { AlertTriangle, Trash2, HelpCircle, CheckCircle, Info, Loader2, X } from 'lucide-react'

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
 * @param {React.ReactNode} [icono] - Icono personalizado de lucide-react
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
  icono = null,
  detalle = null,
  cargando = false
}) {
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

  // Configuración de paleta según el tipo
  const configuracionTipo = {
    peligro: {
      fondoIcono: 'rgba(239, 68, 68, 0.12)',
      bordeIcono: 'rgba(239, 68, 68, 0.3)',
      colorIcono: '#dc2626',
      colorBoton: 'var(--color-peligro-rojo)',
      fondoBoton: '#dc2626',
      iconoDefecto: Trash2
    },
    advertencia: {
      fondoIcono: 'rgba(245, 158, 11, 0.12)',
      bordeIcono: 'rgba(245, 158, 11, 0.3)',
      colorIcono: '#d97706',
      colorBoton: '#d97706',
      fondoBoton: '#d97706',
      iconoDefecto: AlertTriangle
    },
    info: {
      fondoIcono: 'rgba(2, 132, 199, 0.12)',
      bordeIcono: 'rgba(2, 132, 199, 0.3)',
      colorIcono: 'var(--azul-primario)',
      colorBoton: 'var(--azul-primario)',
      fondoBoton: 'var(--azul-primario)',
      iconoDefecto: Info
    },
    exito: {
      fondoIcono: 'rgba(16, 185, 129, 0.12)',
      bordeIcono: 'rgba(16, 185, 129, 0.3)',
      colorIcono: '#059669',
      colorBoton: '#059669',
      fondoBoton: '#059669',
      iconoDefecto: CheckCircle
    }
  }

  const config = configuracionTipo[tipo] || configuracionTipo.peligro
  const IconoComponente = icono || config.iconoDefecto

  return (
    <div 
      className="modal-fondo" 
      onClick={!cargando ? alCerrar : undefined}
      style={{ animation: 'aparecerModal 0.2s ease-out forwards' }}
    >
      <div 
        className="modal-caja-confirmacion" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Botón Cerrar (X) superior */}
        <button 
          className="modal-confirmacion-btn-cerrar" 
          onClick={alCerrar}
          disabled={cargando}
          title="Cerrar ventana"
        >
          <X size={16} />
        </button>

        {/* Icono central estilizado */}
        <div 
          className="modal-confirmacion-icono-circulo"
          style={{
            backgroundColor: config.fondoIcono,
            borderColor: config.bordeIcono,
            color: config.colorIcono
          }}
        >
          <IconoComponente size={26} />
        </div>

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
            className="boton-secundario"
            onClick={alCerrar}
            disabled={cargando}
            style={{ flex: 1, padding: '0.65rem 1rem', fontSize: '0.86rem', fontWeight: 600 }}
          >
            {textoCancelar}
          </button>

          <button 
            type="button"
            className={tipo === 'peligro' ? 'boton-peligro-confirmar' : 'boton-primario'}
            onClick={alConfirmar}
            disabled={cargando}
            style={{
              flex: 1.2,
              padding: '0.65rem 1.1rem',
              fontSize: '0.86rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.45rem',
              backgroundColor: config.fondoBoton,
              borderColor: config.fondoBoton
            }}
          >
            {cargando ? (
              <>
                <Loader2 size={16} className="spin-animation" />
                <span>Procesando...</span>
              </>
            ) : (
              <>
                <IconoComponente size={15} />
                <span>{textoConfirmar}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
