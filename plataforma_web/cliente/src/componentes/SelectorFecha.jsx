import React, { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  RotateCcw,
  X,
  ChevronDown
} from 'lucide-react'

// Nombres oficiales en español
const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']

/**
 * Desglosa de forma determinista una fecha en formato YYYY-MM-DD
 * evitando desfases de zonas horarias UTC.
 */
function desglosarFechaISO(strFecha) {
  if (!strFecha || typeof strFecha !== 'string') return null
  const partes = strFecha.split('-')
  if (partes.length !== 3) return null
  const ano = parseInt(partes[0], 10)
  const mes = parseInt(partes[1], 10) - 1
  const dia = parseInt(partes[2], 10)
  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return null
  return { ano, mes, dia }
}

/**
 * Convierte año, mes (0-11) y día (1-31) a cadena ISO YYYY-MM-DD.
 */
function formatearAFechaISO(ano, mes, dia) {
  const m = String(mes + 1).padStart(2, '0')
  const d = String(dia).padStart(2, '0')
  return `${ano}-${m}-${d}`
}

/**
 * Formato visual amigable para Colombia: DD/MM/AAAA
 */
function formatearFechaAmigable(strFecha) {
  const desglosada = desglosarFechaISO(strFecha)
  if (!desglosada) return ''
  const d = String(desglosada.dia).padStart(2, '0')
  const m = String(desglosada.mes + 1).padStart(2, '0')
  return `${d}/${m}/${desglosada.ano}`
}

/**
 * Obtiene la fecha actual del sistema local en YYYY-MM-DD.
 */
function obtenerFechaHoyISO() {
  const hoy = new Date()
  return formatearAFechaISO(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())
}

/**
 * Componente Reutilizable: SelectorFecha
 * Calendario corporativo premium con portal flotante, estética ejecutiva
 * y soporte completo para modo claro y modo oscuro.
 */
export function SelectorFecha({
  valor,
  alCambiar,
  placeholder = 'Seleccionar fecha...',
  deshabilitado = false,
  bloquearFuturo = true,
  fechaMaxima = null,
  anchoMinimo = '100%',
  className = '',
  id = 'selector-fecha'
}) {
  const [estaAbierto, setEstaAbierto] = useState(false)
  const [estiloPosicion, setEstiloPosicion] = useState({})

  // Estado del mes y año que se está explorando actualmente en el calendario
  const fechaHoy = obtenerFechaHoyISO()
  const fechaHoyDesglosada = desglosarFechaISO(fechaHoy)
  const fechaSeleccionadaDesglosada = desglosarFechaISO(valor)

  const [mesVista, setMesVista] = useState(
    fechaSeleccionadaDesglosada ? fechaSeleccionadaDesglosada.mes : fechaHoyDesglosada.mes
  )
  const [anoVista, setAnoVista] = useState(
    fechaSeleccionadaDesglosada ? fechaSeleccionadaDesglosada.ano : fechaHoyDesglosada.ano
  )

  // Fecha tope para limitar la selección (por defecto hoy si bloquearFuturo es true)
  const fechaTope = fechaMaxima || (bloquearFuturo ? fechaHoy : null)
  const fechaTopeDesglosada = fechaTope ? desglosarFechaISO(fechaTope) : null

  // Verifica si una fecha específica supera el límite permitido
  const esFechaPosterior = (ano, mes, dia) => {
    if (!fechaTope) return false
    const fechaComp = formatearAFechaISO(ano, mes, dia)
    return fechaComp > fechaTope
  }

  // Restricción para evitar avanzar a meses o años futuros
  const noPuedeAvanzarMes = Boolean(
    fechaTopeDesglosada &&
    (anoVista > fechaTopeDesglosada.ano ||
      (anoVista === fechaTopeDesglosada.ano && mesVista >= fechaTopeDesglosada.mes))
  )
  const noPuedeAvanzarAno = Boolean(
    fechaTopeDesglosada && anoVista >= fechaTopeDesglosada.ano
  )

  const referenciaContenedor = useRef(null)
  const referenciaMenu = useRef(null)

  // Sincronizar vista si el valor externo cambia y el calendario está abierto
  useEffect(() => {
    if (valor) {
      const desglosada = desglosarFechaISO(valor)
      if (desglosada) {
        setMesVista(desglosada.mes)
        setAnoVista(desglosada.ano)
      }
    }
  }, [valor])

  // Calcular posición flotante del calendario en pantalla con apertura inteligente hacia arriba o abajo
  const calcularEstilosPosicion = () => {
    if (!referenciaContenedor.current) return null
    const rect = referenciaContenedor.current.getBoundingClientRect()

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      return null
    }

    const anchoCalendario = 276
    const altoCalendario = referenciaMenu.current ? referenciaMenu.current.offsetHeight : 270
    const espacioAbajo = window.innerHeight - rect.bottom
    const espacioArriba = rect.top

    const nuevosEstilos = {
      position: 'fixed',
      width: `${anchoCalendario}px`,
      zIndex: 1000000
    }

    // Si el espacio abajo es menor que la altura del calendario y arriba hay más espacio, abrir hacia ARRIBA
    const abrirHaciaArriba = espacioAbajo < altoCalendario && espacioArriba > espacioAbajo

    if (abrirHaciaArriba) {
      nuevosEstilos.bottom = `${Math.max(10, window.innerHeight - rect.top + 6)}px`
      nuevosEstilos.top = 'auto'
      if (espacioArriba < altoCalendario) {
        nuevosEstilos.maxHeight = `${Math.max(180, espacioArriba - 16)}px`
      }
    } else {
      nuevosEstilos.top = `${rect.bottom + 6}px`
      nuevosEstilos.bottom = 'auto'
      if (espacioAbajo < altoCalendario) {
        nuevosEstilos.maxHeight = `${Math.max(180, espacioAbajo - 16)}px`
      }
    }

    // Orientación horizontal: alinear al campo sin desbordar los bordes de la ventana
    if (rect.left + anchoCalendario > window.innerWidth - 16) {
      nuevosEstilos.right = '16px'
      nuevosEstilos.left = 'auto'
    } else {
      nuevosEstilos.left = `${Math.max(16, rect.left)}px`
      nuevosEstilos.right = 'auto'
    }

    return nuevosEstilos
  }

  const actualizarPosicion = () => {
    const estilos = calcularEstilosPosicion()
    if (estilos) {
      setEstiloPosicion(estilos)
    } else if (estaAbierto) {
      setEstaAbierto(false)
    }
  }

  // Alternar apertura calculando la posición exacta inmediatamente para evitar layout shifts
  const alternarCalendario = () => {
    if (deshabilitado) return
    if (!estaAbierto) {
      const estilos = calcularEstilosPosicion()
      if (estilos) {
        setEstiloPosicion(estilos)
      }
      setEstaAbierto(true)
    } else {
      setEstaAbierto(false)
    }
  }

  // Eventos de scroll y resize sincronizados antes del pintado para máxima fluidez
  useLayoutEffect(() => {
    if (!estaAbierto) return

    actualizarPosicion()

    const manejarScrollOResize = (evento) => {
      // Ignorar scrolls generados internamente dentro del propio calendario flotante
      if (evento && referenciaMenu.current && referenciaMenu.current.contains(evento.target)) {
        return
      }
      actualizarPosicion()
    }

    window.addEventListener('resize', manejarScrollOResize)
    window.addEventListener('scroll', manejarScrollOResize, true)

    return () => {
      window.removeEventListener('resize', manejarScrollOResize)
      window.removeEventListener('scroll', manejarScrollOResize, true)
    }
  }, [estaAbierto])

  // Cerrar al hacer clic fuera o presionar Escape
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

  // Navegación de meses
  const irMesAnterior = (e) => {
    e.stopPropagation()
    if (mesVista === 0) {
      setMesVista(11)
      setAnoVista((a) => a - 1)
    } else {
      setMesVista((m) => m - 1)
    }
  }

  const irMesSiguiente = (e) => {
    e.stopPropagation()
    if (noPuedeAvanzarMes) return
    if (mesVista === 11) {
      setMesVista(0)
      setAnoVista((a) => a + 1)
    } else {
      setMesVista((m) => m + 1)
    }
  }

  const irAnoAnterior = (e) => {
    e.stopPropagation()
    setAnoVista((a) => a - 1)
  }

  const irAnoSiguiente = (e) => {
    e.stopPropagation()
    if (noPuedeAvanzarAno) return
    setAnoVista((a) => a + 1)
  }

  const seleccionarFecha = (dia) => {
    if (esFechaPosterior(anoVista, mesVista, dia)) return
    const fechaISO = formatearAFechaISO(anoVista, mesVista, dia)
    alCambiar(fechaISO)
    setEstaAbierto(false)
  }

  const seleccionarHoy = (e) => {
    e.stopPropagation()
    alCambiar(fechaHoy)
    setMesVista(fechaHoyDesglosada.mes)
    setAnoVista(fechaHoyDesglosada.ano)
    setEstaAbierto(false)
  }

  const limpiarFecha = (e) => {
    e.stopPropagation()
    alCambiar('')
    setEstaAbierto(false)
  }

  // Generar la cuadrícula de días para el mes/año en vista
  const primerDiaSemana = new Date(anoVista, mesVista, 1).getDay()
  // Ajustar para que la semana empiece en Lunes (0=Lunes ... 6=Domingo)
  const offsetLunes = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1

  const diasEnMesActual = new Date(anoVista, mesVista + 1, 0).getDate()
  const diasEnMesAnterior = new Date(anoVista, mesVista, 0).getDate()

  // Días del mes anterior para rellenar
  const diasMesAnterior = []
  for (let i = offsetLunes - 1; i >= 0; i--) {
    diasMesAnterior.push(diasEnMesAnterior - i)
  }

  // Días del mes actual
  const diasMesActual = []
  for (let d = 1; d <= diasEnMesActual; d++) {
    diasMesActual.push(d)
  }

  // Días del mes siguiente para completar 35 o 42 casillas (filas exactas)
  const totalCasillas = diasMesAnterior.length + diasMesActual.length
  const casillasSiguientes = totalCasillas <= 35 ? 35 - totalCasillas : 42 - totalCasillas
  const diasMesSiguiente = []
  for (let s = 1; s <= casillasSiguientes; s++) {
    diasMesSiguiente.push(s)
  }

  const esMismoDia = (dia) => {
    if (!fechaSeleccionadaDesglosada) return false
    return (
      fechaSeleccionadaDesglosada.dia === dia &&
      fechaSeleccionadaDesglosada.mes === mesVista &&
      fechaSeleccionadaDesglosada.ano === anoVista
    )
  }

  const esHoy = (dia) => {
    return (
      fechaHoyDesglosada.dia === dia &&
      fechaHoyDesglosada.mes === mesVista &&
      fechaHoyDesglosada.ano === anoVista
    )
  }

  return (
    <div 
      className={`selector-fecha-contenedor ${className}`} 
      ref={referenciaContenedor}
      style={{ width: anchoMinimo }}
    >
      {/* Botón Disparador del Calendario */}
      <button
        id={id}
        type="button"
        className={`selector-fecha-boton ${estaAbierto ? 'abierto' : ''} ${valor ? 'con-valor' : ''}`}
        onClick={alternarCalendario}
        disabled={deshabilitado}
        aria-haspopup="dialog"
        aria-expanded={estaAbierto}
      >
        <div className="selector-fecha-boton-izq">
          <Calendar size={14} className="selector-fecha-icono-calendario" />
          <span className={`selector-fecha-texto-valor ${!valor ? 'placeholder' : ''}`}>
            {valor ? formatearFechaAmigable(valor) : placeholder}
          </span>
        </div>

        <div className="selector-fecha-boton-der">
          {valor && !deshabilitado ? (
            <span 
              className="selector-fecha-boton-limpiar" 
              onClick={limpiarFecha}
              title="Borrar fecha"
              role="button"
              tabIndex={0}
            >
              <X size={13} />
            </span>
          ) : (
            <ChevronDown size={14} className={`selector-fecha-chevron ${estaAbierto ? 'girado' : ''}`} />
          )}
        </div>
      </button>

      {/* Calendario Flotante con Portal */}
      {estaAbierto && createPortal(
        <div 
          className="selector-fecha-popover" 
          ref={referenciaMenu}
          style={estiloPosicion}
          role="dialog"
          aria-label="Calendario de selección de fecha"
        >
          {/* Cabecera del Calendario */}
          <div className="selector-fecha-cabecera">
            <div className="selector-fecha-controles-nav">
              <button 
                type="button" 
                className="selector-fecha-nav-btn" 
                onClick={irAnoAnterior}
                title="Año anterior"
              >
                <ChevronsLeft size={14} />
              </button>
              <button 
                type="button" 
                className="selector-fecha-nav-btn" 
                onClick={irMesAnterior}
                title="Mes anterior"
              >
                <ChevronLeft size={14} />
              </button>
            </div>

            <div className="selector-fecha-titulo-mes">
              <span className="selector-fecha-nombre-mes">{NOMBRES_MESES[mesVista]}</span>
              <span className="selector-fecha-nombre-ano">{anoVista}</span>
            </div>

            <div className="selector-fecha-controles-nav">
              <button 
                type="button" 
                className="selector-fecha-nav-btn" 
                onClick={irMesSiguiente}
                disabled={noPuedeAvanzarMes}
                title={noPuedeAvanzarMes ? "Meses futuros no disponibles" : "Mes siguiente"}
              >
                <ChevronRight size={14} />
              </button>
              <button 
                type="button" 
                className="selector-fecha-nav-btn" 
                onClick={irAnoSiguiente}
                disabled={noPuedeAvanzarAno}
                title={noPuedeAvanzarAno ? "Años futuros no disponibles" : "Año siguiente"}
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>

          {/* Días de la semana */}
          <div className="selector-fecha-semana-fila">
            {DIAS_SEMANA.map((d, idx) => (
              <span key={idx} className="selector-fecha-dia-semana-celda">
                {d}
              </span>
            ))}
          </div>

          {/* Cuadrícula de días */}
          <div className="selector-fecha-cuadricula-dias">
            {/* Días del mes previo */}
            {diasMesAnterior.map((dia, idx) => (
              <button
                key={`ant_${idx}`}
                type="button"
                className="selector-fecha-dia-celda otro-mes"
                onClick={() => {
                  irMesAnterior({ stopPropagation: () => {} })
                }}
                tabIndex={-1}
              >
                {dia}
              </button>
            ))}

            {/* Días del mes actual */}
            {diasMesActual.map((dia) => {
              const seleccionado = esMismoDia(dia)
              const hoy = esHoy(dia)
              const deshabilitadoPorFuturo = esFechaPosterior(anoVista, mesVista, dia)
              return (
                <button
                  key={`act_${dia}`}
                  type="button"
                  className={`selector-fecha-dia-celda mes-actual ${seleccionado ? 'seleccionado' : ''} ${hoy ? 'es-hoy' : ''} ${deshabilitadoPorFuturo ? 'deshabilitado-futuro' : ''}`}
                  disabled={deshabilitadoPorFuturo}
                  onClick={() => !deshabilitadoPorFuturo && seleccionarFecha(dia)}
                  title={deshabilitadoPorFuturo ? "No se permiten fechas posteriores a hoy" : undefined}
                >
                  <span className="selector-fecha-numero-dia">{dia}</span>
                  {hoy && !seleccionado && <span className="selector-fecha-punto-hoy" />}
                </button>
              )
            })}

            {/* Días del mes siguiente */}
            {diasMesSiguiente.map((dia, idx) => {
              const mesSig = mesVista === 11 ? 0 : mesVista + 1
              const anoSig = mesVista === 11 ? anoVista + 1 : anoVista
              const deshabilitadoPorFuturo = esFechaPosterior(anoSig, mesSig, dia)
              return (
                <button
                  key={`sig_${idx}`}
                  type="button"
                  className={`selector-fecha-dia-celda otro-mes ${deshabilitadoPorFuturo ? 'deshabilitado-futuro' : ''}`}
                  disabled={deshabilitadoPorFuturo}
                  onClick={() => {
                    if (!deshabilitadoPorFuturo) irMesSiguiente({ stopPropagation: () => {} })
                  }}
                  tabIndex={-1}
                  title={deshabilitadoPorFuturo ? "No se permiten fechas posteriores a hoy" : undefined}
                >
                  {dia}
                </button>
              )
            })}
          </div>

          {/* Pie del Calendario con Accesos Rápidos */}
          <div className="selector-fecha-pie">
            <button 
              type="button" 
              className="selector-fecha-pie-btn hoy"
              onClick={seleccionarHoy}
            >
              <RotateCcw size={12} />
              <span>Hoy</span>
            </button>

            {valor && (
              <button 
                type="button" 
                className="selector-fecha-pie-btn limpiar"
                onClick={limpiarFecha}
              >
                <X size={12} />
                <span>Borrar</span>
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
