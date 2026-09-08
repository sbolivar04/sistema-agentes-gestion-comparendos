import React, { useState, useEffect, useRef } from 'react'
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
export function EtiquetaTooltip({ 
  texto, 
  posicion = 'arriba', 
  children, 
  className = '', 
  soloSiTruncado = false,
  soloEnPuntos = false
}) {
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0, flechaOffset: '50%' })
  const [posicionEfectiva, setPosicionEfectiva] = useState(posicion)
  const disparadorRef = useRef(null)
  const globoRef = useRef(null)

  const estaElementoTruncado = () => {
    if (!disparadorRef.current) return false
    const esTruncado = (el) => el && (el.scrollWidth > el.clientWidth + 1)
    if (esTruncado(disparadorRef.current)) return true
    const hijos = disparadorRef.current.querySelectorAll('*')
    for (const hijo of hijos) {
      if (esTruncado(hijo)) return true
    }
    return false
  }

  const actualizarPosicion = (puntoReferencia = null) => {
    if (!disparadorRef.current) return
    const rect = disparadorRef.current.getBoundingClientRect()
    const targetCenterX = puntoReferencia ? puntoReferencia.x : (rect.left + rect.width / 2)
    
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
    let left = targetCenterX

    if (pos === 'arriba') {
      top = rect.top - 8
    } else if (pos === 'abajo') {
      top = rect.bottom + 8
    } else if (pos === 'izquierda') {
      top = rect.top + rect.height / 2
      left = rect.left - 8
    } else if (pos === 'derecha') {
      top = rect.top + rect.height / 2
      left = rect.right + 8
    }

    let flechaOffset = '50%'

    // Para posiciones verticales (arriba/abajo), mantener el globo dentro de la pantalla
    // y anclar la flecha exactamente al centro del elemento disparador
    if (pos === 'arriba' || pos === 'abajo') {
      const anchoEstimado = Math.min(300, Math.max(60, (String(texto).length * 7.5) + 24))
      const mitadAncho = anchoEstimado / 2
      const margenPantalla = 12

      const minLeft = mitadAncho + margenPantalla
      const maxLeft = window.innerWidth - mitadAncho - margenPantalla
      const leftAjustado = Math.max(minLeft, Math.min(targetCenterX, maxLeft))
      left = leftAjustado

      const deltaX = targetCenterX - leftAjustado
      const flechaPx = Math.max(12, Math.min(anchoEstimado - 12, mitadAncho + deltaX))
      flechaOffset = `${flechaPx}px`
    }

    setCoords({ top, left, flechaOffset })
  }

  // Refinar posición con las dimensiones reales del globo una vez montado
  useEffect(() => {
    if (visible && globoRef.current && disparadorRef.current) {
      const rectGlobo = globoRef.current.getBoundingClientRect()
      const rectDisparador = disparadorRef.current.getBoundingClientRect()
      const anchoReal = rectGlobo.width
      const mitadAncho = anchoReal / 2
      const targetCenterX = rectDisparador.left + rectDisparador.width / 2
      const margenPantalla = 12

      if (posicionEfectiva === 'arriba' || posicionEfectiva === 'abajo') {
        const minLeft = mitadAncho + margenPantalla
        const maxLeft = window.innerWidth - mitadAncho - margenPantalla
        const leftAjustado = Math.max(minLeft, Math.min(targetCenterX, maxLeft))
        const deltaX = targetCenterX - leftAjustado
        const flechaPx = Math.max(12, Math.min(anchoReal - 12, mitadAncho + deltaX))

        setCoords(prev => ({
          ...prev,
          left: leftAjustado,
          flechaOffset: `${flechaPx}px`
        }))
      }
    }
  }, [visible, posicionEfectiva])

  // Ocultar tooltip inmediatamente si el usuario hace clic, hace scroll o cambia de ventana (Alt+Tab / blur)
  useEffect(() => {
    const alInteractuar = () => {
      setVisible(false)
    }
    const alPerderFocoVentana = () => {
      setVisible(false)
    }
    window.addEventListener('mousedown', alInteractuar)
    window.addEventListener('scroll', alInteractuar, true)
    window.addEventListener('blur', alPerderFocoVentana)
    return () => {
      window.removeEventListener('mousedown', alInteractuar)
      window.removeEventListener('scroll', alInteractuar, true)
      window.removeEventListener('blur', alPerderFocoVentana)
    }
  }, [])

  // Si el texto se vacía o cambia a falsy, resetear visibilidad
  useEffect(() => {
    if (!texto) {
      setVisible(false)
    }
  }, [texto])

  const manejarMouseEnter = (e) => {
    if (!texto) return

    // Si es exclusivo para los 3 puntos, no activar aquí, sino esperar a onMouseMove sobre los puntos
    if (soloEnPuntos) {
      manejarMouseMove(e)
      return
    }

    // Si se activa soloSiTruncado, verificar si el texto realmente desborda con puntos suspensivos
    if (soloSiTruncado && !estaElementoTruncado()) {
      return // El texto es visible por completo: no mostrar tooltip
    }

    actualizarPosicion()
    setVisible(true)
  }

  const manejarMouseMove = (e) => {
    if (!texto) return

    if (soloEnPuntos) {
      if (!disparadorRef.current) return
      
      const truncado = estaElementoTruncado()
      if (!truncado) {
        if (visible) setVisible(false)
        if (disparadorRef.current) disparadorRef.current.style.cursor = 'default'
        return
      }

      const rect = disparadorRef.current.getBoundingClientRect()
      // Zona de detección exclusiva de los 3 puntos al borde derecho (34px)
      const anchoZonaPuntos = 34
      const dentroDePuntos = e.clientX >= (rect.right - anchoZonaPuntos) && e.clientX <= (rect.right + 4)

      if (dentroDePuntos) {
        disparadorRef.current.style.cursor = 'help'
        actualizarPosicion({ x: rect.right - 15 })
        if (!visible) setVisible(true)
      } else {
        disparadorRef.current.style.cursor = 'default'
        if (visible) setVisible(false)
      }
    }
  }

  const manejarMouseLeave = () => {
    if (disparadorRef.current) {
      disparadorRef.current.style.cursor = 'default'
    }
    setVisible(false)
  }

  const manejarMouseDown = () => {
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
      onMouseMove={manejarMouseMove}
      onMouseLeave={manejarMouseLeave}
      onMouseDown={manejarMouseDown}
      onClick={manejarMouseDown}
    >
      {children}
      {visible && typeof document !== 'undefined' && createPortal(
        <div 
          ref={globoRef}
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
          <div 
            className="etiqueta-tooltip-flecha" 
            style={
              posicionEfectiva === 'arriba' || posicionEfectiva === 'abajo'
                ? { left: coords.flechaOffset }
                : {}
            }
          />
        </div>,
        document.body
      )}
    </div>
  )
}
