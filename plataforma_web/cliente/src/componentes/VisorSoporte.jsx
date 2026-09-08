import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FileText,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react'
import { EtiquetaTooltip } from './EtiquetaTooltip'

/**
 * Componente VisorSoporte
 * Modal tipo Lightbox Ultra-Premium para previsualizar, inspeccionar y descargar soportes cargados.
 * Incluye zoom con rueda de ratón, rotación 90°, arrastre panorámico (pan) y renderizado de alta fidelidad.
 *
 * @param {Object} soporte - Objeto del soporte ({ nombre, url, tipo, tamano, fechaCarga })
 * @param {Function} alCerrar - Función para cerrar el visor
 */
export function VisorSoporte({ soporte, alCerrar }) {
  const [escalaZoom, setEscalaZoom] = useState(1)
  const [rotacion, setRotacion] = useState(0)
  const [posicionPan, setPosicionPan] = useState({ x: 0, y: 0 })
  const [arrastrando, setArrastrando] = useState(false)
  const [puntoInicio, setPuntoInicio] = useState({ x: 0, y: 0 })
  const contenedorCanvasRef = useRef(null)

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const manejarTeclaEscape = (e) => {
      if (e.key === 'Escape') {
        alCerrar()
      }
    }
    window.addEventListener('keydown', manejarTeclaEscape)
    return () => window.removeEventListener('keydown', manejarTeclaEscape)
  }, [alCerrar])

  // Soporte de zoom con rueda de ratón en el área de la imagen
  useEffect(() => {
    const contenedor = contenedorCanvasRef.current
    if (!contenedor) return

    const alHacerRueda = (e) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 0.15 : -0.15
      setEscalaZoom(prev => Math.min(Math.max(Number((prev + factor).toFixed(2)), 0.25), 4))
    }

    contenedor.addEventListener('wheel', alHacerRueda, { passive: false })
    return () => contenedor.removeEventListener('wheel', alHacerRueda)
  }, [])

  if (!soporte) return null

  const esPdf = soporte.tipo === 'pdf' || soporte.nombre?.toLowerCase().endsWith('.pdf')
  const esImagen = soporte.tipo === 'imagen' ||
    soporte.nombre?.toLowerCase().endsWith('.png') ||
    soporte.nombre?.toLowerCase().endsWith('.jpg') ||
    soporte.nombre?.toLowerCase().endsWith('.jpeg') ||
    soporte.nombre?.toLowerCase().endsWith('.webp')

  const aumentarZoom = () => setEscalaZoom(prev => Math.min(Number((prev + 0.25).toFixed(2)), 4))
  const reducirZoom = () => setEscalaZoom(prev => Math.max(Number((prev - 0.25).toFixed(2)), 0.25))
  const rotar = () => setRotacion(prev => (prev + 90) % 360)

  const restablecerVista = () => {
    setEscalaZoom(1)
    setRotacion(0)
    setPosicionPan({ x: 0, y: 0 })
  }

  const iniciarArrastre = (e) => {
    if (escalaZoom <= 1) return
    setArrastrando(true)
    setPuntoInicio({
      x: e.clientX - posicionPan.x,
      y: e.clientY - posicionPan.y
    })
  }

  const moverArrastre = (e) => {
    if (!arrastrando) return
    setPosicionPan({
      x: e.clientX - puntoInicio.x,
      y: e.clientY - puntoInicio.y
    })
  }

  const finalizarArrastre = () => setArrastrando(false)

  const manejarDescarga = () => {
    if (!soporte.url) return
    const enlace = document.createElement('a')
    enlace.href = soporte.url
    enlace.download = soporte.nombre || 'soporte_comparendo'
    document.body.appendChild(enlace)
    enlace.click()
    document.body.removeChild(enlace)
  }

  return (
    <div className="modal-fondo visor-soporte-fondo" onClick={alCerrar}>
      <div
        className="visor-soporte-contenedor"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Visor de ${soporte.nombre}`}
      >
        {/* Barra superior de herramientas y datos del archivo */}
        <div className="visor-soporte-barra-superior">
          <div className="visor-soporte-info-archivo">
            <div className="visor-soporte-icono-tipo">
              {esPdf ? (
                <FileText size={20} />
              ) : (
                <ImageIcon size={20} />
              )}
            </div>

            <div className="visor-soporte-nombres">
              <span className="visor-soporte-titulo">
                {soporte.nombre}
              </span>
              <div className="visor-soporte-meta-fila">
                {soporte.tamano && (
                  <span className="visor-soporte-chip-tamano">{soporte.tamano}</span>
                )}
                <span className="visor-soporte-separador-punto">•</span>
                <span className="visor-soporte-fecha">{soporte.fechaCarga || 'Soporte digital adjunto'}</span>
                <span className="visor-soporte-separador-punto">•</span>
                <span className="visor-soporte-chip-formato">
                  {esPdf ? 'PDF Oficial' : 'Imagen Alta Resolución'}
                </span>
              </div>
            </div>
          </div>

          <div className="visor-soporte-herramientas">
            {esImagen && (
              <>
                <div className="visor-grupo-zoom">
                  <EtiquetaTooltip texto="Reducir zoom (-)" posicion="abajo">
                    <button
                      type="button"
                      className="visor-control-btn"
                      onClick={reducirZoom}
                    >
                      <ZoomOut size={15} />
                    </button>
                  </EtiquetaTooltip>

                  <EtiquetaTooltip texto="Restablecer zoom al 100%" posicion="abajo">
                    <button
                      type="button"
                      className="visor-zoom-porcentaje-btn"
                      onClick={restablecerVista}
                    >
                      {Math.round(escalaZoom * 100)}%
                    </button>
                  </EtiquetaTooltip>

                  <EtiquetaTooltip texto="Aumentar zoom (+)" posicion="abajo">
                    <button
                      type="button"
                      className="visor-control-btn"
                      onClick={aumentarZoom}
                    >
                      <ZoomIn size={15} />
                    </button>
                  </EtiquetaTooltip>
                </div>

                <EtiquetaTooltip texto="Rotar 90°" posicion="abajo">
                  <button
                    type="button"
                    className="visor-control-btn"
                    onClick={rotar}
                  >
                    <RotateCw size={15} />
                  </button>
                </EtiquetaTooltip>

                <EtiquetaTooltip texto="Restablecer vista original" posicion="abajo">
                  <button
                    type="button"
                    className="visor-control-btn"
                    onClick={restablecerVista}
                  >
                    <RefreshCw size={15} />
                  </button>
                </EtiquetaTooltip>

                <div className="visor-separador-vertical" />
              </>
            )}

            <button
              type="button"
              className="visor-btn-descargar-premium"
              onClick={manejarDescarga}
            >
              <Download size={14} />
              <span>Descargar</span>
            </button>

            <button
              type="button"
              className="visor-btn-cerrar-premium"
              onClick={alCerrar}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Área central de visualización del soporte */}
        <div
          ref={contenedorCanvasRef}
          className="visor-soporte-area-contenido"
          onMouseDown={iniciarArrastre}
          onMouseMove={moverArrastre}
          onMouseUp={finalizarArrastre}
          onMouseLeave={finalizarArrastre}
          style={{
            cursor: esImagen && escalaZoom > 1 ? (arrastrando ? 'grabbing' : 'grab') : 'default'
          }}
        >
          {esImagen && (
            <div className="visor-canvas-viewport">
              <img
                src={soporte.url}
                alt={soporte.nombre}
                className="visor-soporte-imagen-premium"
                style={{
                  transform: `translate(${posicionPan.x}px, ${posicionPan.y}px) scale(${escalaZoom}) rotate(${rotacion}deg)`,
                  transition: arrastrando ? 'none' : 'transform 0.18s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                draggable={false}
              />
            </div>
          )}

          {esPdf && (
            <div className="visor-soporte-pdf-contenedor">
              {soporte.url.startsWith('blob:') || soporte.url.startsWith('http') || soporte.url.startsWith('data:') ? (
                <iframe
                  src={soporte.url}
                  title={soporte.nombre}
                  className="visor-soporte-iframe"
                />
              ) : (
                <div className="visor-pdf-placeholder">
                  <FileText size={52} color="var(--color-primario)" />
                  <h4>Vista previa de documento PDF</h4>
                  <p>{soporte.nombre}</p>
                  <button
                    type="button"
                    className="boton-primario"
                    onClick={manejarDescarga}
                    style={{ marginTop: '0.75rem' }}
                  >
                    <Download size={15} /> Descargar documento
                  </button>
                </div>
              )}
            </div>
          )}

          {!esImagen && !esPdf && (
            <div className="visor-soporte-placeholder-generico">
              <FileText size={52} color="var(--color-primario)" />
              <h4>Archivo no previsualizable directamente</h4>
              <p>{soporte.nombre}</p>
              <button
                type="button"
                className="boton-primario"
                onClick={manejarDescarga}
                style={{ marginTop: '0.75rem' }}
              >
                <Download size={15} /> Descargar archivo
              </button>
            </div>
          )}

          {/* Barra flotante de estado y atajos */}
          {esImagen && (
            <div className="visor-soporte-barra-flotante-pie">
              <span>Zoom: <strong>{Math.round(escalaZoom * 100)}%</strong></span>
              <span>•</span>
              <span>Rotación: <strong>{rotacion}°</strong></span>
              <span>•</span>
              <span className="visor-pie-tip">Rueda del ratón para zoom • Arrastra para mover</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
