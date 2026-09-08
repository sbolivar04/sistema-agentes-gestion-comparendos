import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Componente Reutilizable: SelectorDesplegable
 * Diseñado con estética corporativa premium para reemplazar listas <select> nativas.
 * Renderiza el menú flotante en un portal del DOM para sobresalir sobre cualquier contenedor.
 *
 * Propiedades:
 * - valor: Valor actualmente seleccionado.
 * - alCambiar: Función callback (nuevoValor) => void.
 * - opciones: Lista de opciones [{ valor, etiqueta, descripcion, badge, claseBadge, colorIndicador, icono }].
 * - icono: Icono principal de Lucide para el botón disparador (opcional).
 * - placeholder: Texto cuando no hay nada seleccionado (predeterminado: 'Seleccionar...').
 * - anchoMinimo: Ancho mínimo CSS (predeterminado: 'auto').
 * - posicionAlineacion: 'izquierda' o 'derecha' (predeterminado: 'izquierda').
 * - direccion: 'abajo' o 'arriba' (predeterminado: 'abajo').
 * - tamano: 'normal' o 'compacto'.
 * - deshabilitado: Booleano para desactivar el componente.
 * - className: Clases CSS adicionales.
 */
export function SelectorDesplegable({
  valor,
  alCambiar,
  opciones = [],
  icono: IconoGeneral = null,
  placeholder = 'Seleccionar...',
  anchoMinimo = 'auto',
  posicionAlineacion = 'izquierda',
  direccion = 'abajo',
  tamano = 'normal',
  deshabilitado = false,
  className = ''
}) {
  const [estaAbierto, setEstaAbierto] = useState(false)
  const [estiloPosicion, setEstiloPosicion] = useState({})
  const referenciaContenedor = useRef(null)
  const referenciaMenu = useRef(null)

  // Normalizar opciones en caso de que se pasen valores primitivos (strings o números)
  const opcionesNormalizadas = opciones.map((opc) => {
    if (typeof opc === 'object' && opc !== null) {
      return opc
    }
    return { valor: opc, etiqueta: String(opc) }
  })

  // Obtener la opción actualmente seleccionada
  const opcionSeleccionada = opcionesNormalizadas.find((opc) => String(opc.valor) === String(valor)) || null

  // Calcular la posición flotante fija para sobresalir sobre cualquier modal o tarjeta
  const actualizarPosicion = () => {
    if (!referenciaContenedor.current) return
    const rect = referenciaContenedor.current.getBoundingClientRect()

    // Si el elemento fue desplazado fuera de la pantalla visible, cerrar
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setEstaAbierto(false)
      return
    }

    const anchoBoton = rect.width
    const anchoMenuCalculado = Math.max(anchoBoton, 220)

    const nuevosEstilos = {
      position: 'fixed',
      minWidth: `${anchoMenuCalculado}px`,
      maxWidth: 'min(92vw, 420px)',
      zIndex: 1000000
    }

    // Orientación vertical
    if (direccion === 'arriba') {
      nuevosEstilos.bottom = `${Math.max(8, window.innerHeight - rect.top + 6)}px`
      nuevosEstilos.top = 'auto'
    } else {
      nuevosEstilos.top = `${rect.bottom + 6}px`
      nuevosEstilos.bottom = 'auto'
    }

    // Orientación horizontal
    if (posicionAlineacion === 'derecha') {
      nuevosEstilos.right = `${Math.max(8, window.innerWidth - rect.right)}px`
      nuevosEstilos.left = 'auto'
    } else {
      if (rect.left + anchoMenuCalculado > window.innerWidth - 12) {
        nuevosEstilos.right = '12px'
        nuevosEstilos.left = 'auto'
      } else {
        nuevosEstilos.left = `${Math.max(8, rect.left)}px`
        nuevosEstilos.right = 'auto'
      }
    }

    setEstiloPosicion(nuevosEstilos)
  }

  // Recalcular posición cuando cambia el estado de apertura y con scroll/redimensionamiento
  useEffect(() => {
    if (!estaAbierto) return

    actualizarPosicion()

    const manejarScrollOResize = () => {
      actualizarPosicion()
    }

    window.addEventListener('resize', manejarScrollOResize)
    // El flag capture=true garantiza capturar eventos de scroll de modales o contenedores internos
    window.addEventListener('scroll', manejarScrollOResize, true)

    return () => {
      window.removeEventListener('resize', manejarScrollOResize)
      window.removeEventListener('scroll', manejarScrollOResize, true)
    }
  }, [estaAbierto, direccion, posicionAlineacion])

  // Cerrar al hacer clic fuera del componente o presionar la tecla Escape
  useEffect(() => {
    function manejarClicFuera(evento) {
      const clicEnContenedor = referenciaContenedor.current && referenciaContenedor.current.contains(evento.target)
      const clicEnMenu = referenciaMenu.current && referenciaMenu.current.contains(evento.target)

      if (!clicEnContenedor && !clicEnMenu) {
        setEstaAbierto(false)
      }
    }

    function manejarTeclaEscape(evento) {
      if (evento.key === 'Escape') {
        setEstaAbierto(false)
      }
    }

    if (estaAbierto) {
      document.addEventListener('mousedown', manejarClicFuera)
      document.addEventListener('keydown', manejarTeclaEscape)
    }

    return () => {
      document.removeEventListener('mousedown', manejarClicFuera)
      document.removeEventListener('keydown', manejarTeclaEscape)
    }
  }, [estaAbierto])

  const alternarDesplegable = () => {
    if (!deshabilitado) {
      setEstaAbierto((estadoPrevio) => !estadoPrevio)
    }
  }

  const seleccionarOpcion = (nuevaOpcion) => {
    if (String(nuevaOpcion.valor) !== String(valor)) {
      alCambiar(nuevaOpcion.valor)
    }
    setEstaAbierto(false)
  }

  return (
    <div
      className={`selector-desplegable-contenedor ${estaAbierto ? 'abierto' : ''} ${tamano === 'compacto' ? 'compacto' : ''} ${className} ${deshabilitado ? 'deshabilitado' : ''}`}
      ref={referenciaContenedor}
      style={{ minWidth: anchoMinimo }}
    >
      <button
        type="button"
        className={`selector-desplegable-boton ${estaAbierto ? 'activo' : ''}`}
        onClick={alternarDesplegable}
        disabled={deshabilitado}
        aria-haspopup="listbox"
        aria-expanded={estaAbierto}
      >
        <div className="selector-desplegable-valor-actual">
          {/* Icono general o Icono específico de la opción */}
          {opcionSeleccionada?.icono ? (
            <opcionSeleccionada.icono size={15} className="selector-icono-opcion" />
          ) : IconoGeneral ? (
            <IconoGeneral size={15} className="selector-icono-general" />
          ) : null}

          {/* Indicador de estado (punto de color opcional) */}
          {opcionSeleccionada?.colorIndicador && (
            <span
              className="selector-punto-indicador"
              style={{ backgroundColor: opcionSeleccionada.colorIndicador }}
            />
          )}

          <span className="selector-texto-etiqueta">
            {opcionSeleccionada ? opcionSeleccionada.etiqueta : placeholder}
          </span>
        </div>

        <ChevronDown
          size={16}
          className={`selector-flecha-chevron ${estaAbierto ? 'rotada' : ''}`}
        />
      </button>

      {/* Renderizado mediante Portal en document.body para sobresalir sobre cualquier tarjeta o modal */}
      {estaAbierto && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={referenciaMenu}
            className={`selector-desplegable-menu alineacion-${posicionAlineacion} ${direccion === 'arriba' ? 'direccion-arriba' : ''}`}
            style={estiloPosicion}
            role="listbox"
          >
            {opcionesNormalizadas.map((opcion) => {
              const esSeleccionada = String(opcion.valor) === String(valor)

              return (
                <button
                  key={String(opcion.valor)}
                  type="button"
                  className={`selector-desplegable-opcion ${esSeleccionada ? 'seleccionada' : ''}`}
                  onClick={() => seleccionarOpcion(opcion)}
                  role="option"
                  aria-selected={esSeleccionada}
                >
                  <div className="selector-opcion-contenido-izq">
                    {/* Punto de color o icono */}
                    {opcion.colorIndicador && (
                      <span
                        className="selector-punto-indicador"
                        style={{ backgroundColor: opcion.colorIndicador }}
                      />
                    )}

                    {opcion.icono && (
                      <opcion.icono size={15} className="selector-icono-opcion" />
                    )}

                    <span className="selector-opcion-texto">
                      {opcion.etiqueta}
                    </span>
                  </div>

                  <div className="selector-opcion-contenido-der">
                    {/* Badge opcional */}
                    {opcion.badge && (
                      <span
                        className={`selector-opcion-badge ${opcion.claseBadge || ''}`}
                        style={opcion.estiloBadge || {}}
                      >
                        {opcion.badge}
                      </span>
                    )}

                    {/* Icono de verificación para la opción activa */}
                    {esSeleccionada && (
                      <Check size={15} className="selector-icono-check" />
                    )}
                  </div>
                </button>
              )
            })}
          </div>,
          document.body
        )}
    </div>
  )
}
