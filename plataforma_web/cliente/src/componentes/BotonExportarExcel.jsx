import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, FileSpreadsheet, ChevronDown, Check, Loader2, TableProperties, Layers } from 'lucide-react'

/**
 * Componente BotonExportarExcel
 * Permite descargar la información de comparendos en formato Excel (.xlsx).
 * Ofrece dos modalidades:
 * 1. Exporte Resumen (gestión operativa y liquidación)
 * 2. Exporte Detallado (auditoría técnica y jurídica completa)
 */
export function BotonExportarExcel({
  busqueda = '',
  filtroEstado = 'todos',
  filtroDescuento = 'todos',
  totalRegistros = 0,
  deshabilitado = false
}) {
  const [estaAbierto, setEstaAbierto] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [tipoDescargando, setTipoDescargando] = useState(null)
  const [estiloPosicion, setEstiloPosicion] = useState({})

  const refBoton = useRef(null)
  const refMenu = useRef(null)

  const actualizarPosicion = () => {
    if (!refBoton.current) return
    const rect = refBoton.current.getBoundingClientRect()

    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      setEstaAbierto(false)
      return
    }

    const anchoMenu = 310
    const margen = 12

    let left = rect.right - anchoMenu
    if (left < margen) left = margen

    setEstiloPosicion({
      position: 'fixed',
      top: `${rect.bottom + 6}px`,
      left: `${left}px`,
      width: `${anchoMenu}px`,
      zIndex: 1000000
    })
  }

  useEffect(() => {
    if (!estaAbierto) return

    actualizarPosicion()

    const manejarScroll = () => actualizarPosicion()
    const manejarClickAfuera = (e) => {
      if (
        refBoton.current && !refBoton.current.contains(e.target) &&
        refMenu.current && !refMenu.current.contains(e.target)
      ) {
        setEstaAbierto(false)
      }
    }

    const manejarKeyDown = (e) => {
      if (e.key === 'Escape') setEstaAbierto(false)
    }

    window.addEventListener('scroll', manejarScroll, true)
    window.addEventListener('resize', manejarScroll)
    document.addEventListener('mousedown', manejarClickAfuera)
    document.addEventListener('keydown', manejarKeyDown)

    return () => {
      window.removeEventListener('scroll', manejarScroll, true)
      window.removeEventListener('resize', manejarScroll)
      document.removeEventListener('mousedown', manejarClickAfuera)
      document.removeEventListener('keydown', manejarKeyDown)
    }
  }, [estaAbierto])

  const ejecutarDescarga = (tipo) => {
    setEstaAbierto(false)
    setDescargando(true)
    setTipoDescargando(tipo)

    try {
      const parametros = new URLSearchParams()
      if (busqueda && busqueda.trim()) {
        parametros.append('busqueda', busqueda.trim())
      }
      if (filtroEstado && filtroEstado !== 'todos') {
        parametros.append('estado_simit', filtroEstado)
      }
      if (filtroDescuento && filtroDescuento !== 'todos') {
        parametros.append('filtro_descuento', filtroDescuento)
      }

      const queryString = parametros.toString()
      const url = `/api/comparendos/exportar/${tipo}${queryString ? `?${queryString}` : ''}`

      // Crear enlace de descarga automático
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.setAttribute('download', '')
      document.body.appendChild(enlace)
      enlace.click()
      document.body.removeChild(enlace)
    } catch (err) {
      console.error('Error al solicitar exporte Excel:', err)
    } finally {
      setTimeout(() => {
        setDescargando(false)
        setTipoDescargando(null)
      }, 1800)
    }
  }

  return (
    <div className="boton-exportar-excel-contenedor" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={refBoton}
        type="button"
        className={`boton-exportar-excel ${estaAbierto ? 'activo' : ''} ${descargando ? 'cargando' : ''}`}
        onClick={() => !deshabilitado && !descargando && setEstaAbierto(!estaAbierto)}
        disabled={deshabilitado || totalRegistros === 0}
        title={totalRegistros === 0 ? 'No hay registros para exportar' : 'Exportar comparendos a Excel (.xlsx)'}
      >
        {descargando ? (
          <Loader2 size={15} className="icono-girando" style={{ color: '#10b981' }} />
        ) : (
          <FileSpreadsheet size={15} style={{ color: '#10b981' }} />
        )}
        <span className="texto-boton-exportar">
          {descargando ? 'Generando...' : 'Excel'}
        </span>
        <ChevronDown size={13} className={`chevron-exportar ${estaAbierto ? 'rotado' : ''}`} />
      </button>

      {estaAbierto &&
        createPortal(
          <div ref={refMenu} className="menu-exportar-excel" style={estiloPosicion}>
            <div className="menu-exportar-encabezado">
              <span>FORMATOS DISPONIBLES (.XLSX)</span>
              <span className="conteo-registros-export">{totalRegistros} reg.</span>
            </div>

            <button
              type="button"
              className="opcion-exportar"
              onClick={() => ejecutarDescarga('resumen')}
            >
              <div className="opcion-exportar-icono-wrap icono-resumen">
                <TableProperties size={18} />
              </div>
              <div className="opcion-exportar-contenido">
                <div className="opcion-exportar-titulo-linea">
                  <span className="opcion-exportar-titulo">Exporte Resumen</span>
                  <span className="badge-exportar badge-verde">Recomendado</span>
                </div>
                <p className="opcion-exportar-desc">
                  Columnas clave de gestión operativa, descuentos de ley y liquidación.
                </p>
              </div>
            </button>

            <button
              type="button"
              className="opcion-exportar"
              onClick={() => ejecutarDescarga('detallado')}
            >
              <div className="opcion-exportar-icono-wrap icono-detallado">
                <Layers size={18} />
              </div>
              <div className="opcion-exportar-contenido">
                <div className="opcion-exportar-titulo-linea">
                  <span className="opcion-exportar-titulo">Exporte Detallado</span>
                  <span className="badge-exportar badge-azul">Auditoría</span>
                </div>
                <p className="opcion-exportar-desc">
                  Información técnica y jurídica completa con direcciones y fuentes.
                </p>
              </div>
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
