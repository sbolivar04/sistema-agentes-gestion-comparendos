import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileSpreadsheet, ChevronDown, Loader2, TableProperties } from 'lucide-react'

/**
 * Componente BotonExportarExcel
 * Botón desplegable modular preparado para escalar con nuevos formatos en el futuro.
 * Actualmente ofrece el reporte oficial consolidado en formato Excel (.xlsx).
 */
export function BotonExportarExcel({
  deshabilitado = false
}) {
  const [estaAbierto, setEstaAbierto] = useState(false)
  const [descargando, setDescargando] = useState(false)
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

  const ejecutarDescarga = () => {
    setEstaAbierto(false)
    setDescargando(true)

    try {
      const url = '/api/comparendos/exportar/excel'

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
      }, 1500)
    }
  }

  return (
    <div className="boton-exportar-excel-contenedor" style={{ position: 'relative', display: 'inline-block' }}>
      <button
        ref={refBoton}
        type="button"
        className={`boton-exportar-excel ${estaAbierto ? 'activo' : ''} ${descargando ? 'cargando' : ''}`}
        onClick={() => !deshabilitado && !descargando && setEstaAbierto(!estaAbierto)}
        disabled={deshabilitado}
        title="Exportar comparendos a Excel (.xlsx)"
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
            </div>

            <button
              type="button"
              className="opcion-exportar"
              onClick={ejecutarDescarga}
            >
              <div className="opcion-exportar-icono-wrap icono-resumen">
                <TableProperties size={18} />
              </div>
              <div className="opcion-exportar-contenido">
                <div className="opcion-exportar-titulo-linea">
                  <span className="opcion-exportar-titulo">Exporte Comparendos</span>
                  <span className="badge-exportar badge-verde">Oficial</span>
                </div>
                <p className="opcion-exportar-desc">
                  Consolidado completo con fotodetección, valor base, fechas y liquidación.
                </p>
              </div>
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
