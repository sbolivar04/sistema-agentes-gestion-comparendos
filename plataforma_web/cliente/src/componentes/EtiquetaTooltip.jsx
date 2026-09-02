import React, { useState, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Componente estandarizado para etiquetas flotantes (tooltips) al pasar el cursor.
 * Incluye auto-detección inteligente de bordes (auto-flip) y renderizado con React Portal
 * para garantizar visibilidad total sin desbordamientos ni cortes de pantalla.
 * 
 * @param {string} texto - Texto o mensaje que se mostrará en el tooltip.
 * @param {string} posicion - 'arriba' | 'abajo' | 'izquierda' | 'derecha' (por defecto 'arriba').
 * @param {React.ReactNode} children - Elemento sobre el cual se activa el hover.
 */
export function EtiquetaTooltip({ texto, posicion = 'arriba', children, className = '' }) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })
  const [posicionEfectiva, setPosicionEfectiva] = useState(posicion)
  const disparadorRef = useRef(null)

  const actualizarPosicion = () => {
    if (!disparadorRef.current) return
    const rect = disparadorRef.current.getBoundingClientRect()
    
    let pos = posicion
    const espacioArribaRequerido = 45
    const espacioAbajoRequerido = 45

    // Auto-flip vertical: si no cabe arriba, baja; si no cabe abajo, sube
    if (pos === 'arriba' && rect.top < espacioArribaRequerido) {
      pos = 'abajo'
    } else if (pos === 'abajo' && (rect.bottom + espacioAbajoRequerido > window.innerHeight)) {
      pos = 'arriba'
    }

    // Auto-flip horizontal: si no cabe a los lados
    if (pos === 'izquierda' && rect.left < 90) {
      pos = 'derecha'
    } else if (pos === 'derecha' && (rect.right + 90 > window.innerWidth)) {
      pos = 'izquierda'
    }

    setPosicionEfectiva(pos)

    let top = 0
    let left = 0

    if (pos === 'arriba') {
      top = rect.top - 8
      left = rect.left + rect.width / 2
    } else if (pos === 'abajo') {
      top = rect.bottom + 8
      left = rect.left + rect.width / 2
    } else if (pos === 'izquierda') {
      top = rect.top + rect.height / 2
      left = rect.left - 8
    } else if (pos === 'derecha') {
      top = rect.top + rect.height / 2
      left = rect.right + 8
    }

    // Evitar que el tooltip se salga de los márgenes laterales del viewport (mitad de 250px + margen)
    const limiteMargen = 140
    if (left < limiteMargen) {
      left = limiteMargen
    } else if (left > window.innerWidth - limiteMargen) {
      left = window.innerWidth - limiteMargen
    }

    setCoords({ top, left })
  }

  const manejarMouseEnter = () => {
    actualizarPosicion()
    setVisible(true)
  }

  const manejarMouseLeave = () => {
    setVisible(false)
  }

  if (!texto) return children

  const getTransform = () => {
    switch (posicionEfectiva) {
      case 'abajo':
        return 'translate(-50%, 0)'
      case 'izquierda':
        return 'translate(-100%, -50%)'
      case 'derecha':
        return 'translate(0, -50%)'
      case 'arriba':
      default:
        return 'translate(-50%, -100%)'
    }
  }

  return (
    <div 
      ref={disparadorRef}
      className={`etiqueta-tooltip-contenedor ${className}`}
      onMouseEnter={manejarMouseEnter}
      onMouseLeave={manejarMouseLeave}
      onFocus={manejarMouseEnter}
      onBlur={manejarMouseLeave}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div 
          className={`etiqueta-tooltip-globo fija posicion-${posicionEfectiva}`} 
          style={{
            position: 'fixed',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            transform: getTransform(),
            pointerEvents: 'none',
            zIndex: 999999
          }}
          role="tooltip"
        >
          <span>{texto}</span>
          <div className="etiqueta-tooltip-flecha" />
        </div>,
        document.body
      )}
    </div>
  )
}
