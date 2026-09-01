import React, { useState, useEffect } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, Eye, SlidersHorizontal } from 'lucide-react'
import { apiBackend } from '../servicios/apiBackend'
import { ModalDetalleComparendo } from './ModalDetalleComparendo'

export function TablaComparendos({ busquedaExterna = '', alLimpiarBusquedaExterna }) {
  const [comparendos, setComparendos] = useState([])
  const [totalRegistros, setTotalRegistros] = useState(0)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [paginaActual, setPaginaActual] = useState(1)
  
  // Paginación por defecto en 5
  const [limitePorPagina, setLimitePorPagina] = useState(5)
  const [limitePersonalizado, setLimitePersonalizado] = useState('')
  const [mostrarInputPersonalizado, setMostrarInputPersonalizado] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroDescuento, setFiltroDescuento] = useState('todos')
  const [cargando, setCargando] = useState(false)
  const [comparendoSeleccionado, setComparendoSeleccionado] = useState(null)

  // Escuchar búsquedas externas desde las alertas del encabezado
  useEffect(() => {
    if (busquedaExterna) {
      setBusqueda(busquedaExterna)
      setFiltroEstado('todos')
      setFiltroDescuento('todos')
      setPaginaActual(1)
      
      setCargando(true)
      apiBackend.obtenerComparendos({
        pagina: 1,
        limite: limitePorPagina,
        busqueda: busquedaExterna,
        estado_simit: 'todos',
        filtro_descuento: 'todos'
      }).then(res => {
        if (res.exitoso) {
          setComparendos(res.comparendos || [])
          setTotalRegistros(res.total_registros || 0)
          setTotalPaginas(res.total_paginas || 1)
          if (res.comparendos && res.comparendos.length > 0) {
            setComparendoSeleccionado(res.comparendos[0])
          }
        }
      }).catch(e => {
        console.error('Error al aplicar búsqueda de alerta:', e)
      }).finally(() => {
        setCargando(false)
      })
    }
  }, [busquedaExterna])

  const cargarDatos = async () => {
    setCargando(true)
    try {
      const res = await apiBackend.obtenerComparendos({
        pagina: paginaActual,
        limite: limitePorPagina,
        busqueda,
        estado_simit: filtroEstado,
        filtro_descuento: filtroDescuento
      })
      if (res.exitoso) {
        setComparendos(res.comparendos || [])
        setTotalRegistros(res.total_registros || 0)
        setTotalPaginas(res.total_paginas || 1)
      }
    } catch (e) {
      console.error('Error cargando comparendos:', e)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [paginaActual, limitePorPagina, filtroEstado, filtroDescuento])

  const manejarBusqueda = (e) => {
    e.preventDefault()
    setPaginaActual(1)
    cargarDatos()
  }

  const cambiarLimite = (nuevoLimite) => {
    if (nuevoLimite === 'personalizado') {
      setMostrarInputPersonalizado(true)
    } else {
      setMostrarInputPersonalizado(false)
      setLimitePorPagina(Number(nuevoLimite))
      setPaginaActual(1)
    }
  }

  const aplicarLimitePersonalizado = (e) => {
    e.preventDefault()
    const valor = parseInt(limitePersonalizado, 10)
    if (valor && valor > 0 && valor <= 100) {
      setLimitePorPagina(valor)
      setPaginaActual(1)
    }
  }

  return (
    <section className="seccion-tabla">
      <div className="tabla-herramientas">
        {/* Buscador */}
        <form onSubmit={manejarBusqueda} className="buscador-contenedor">
          <Search size={18} color="var(--texto-secundario)" />
          <input
            type="text"
            className="buscador-input"
            placeholder="Buscar por placa, NIT, comparendo, secretaría..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </form>

        {/* Filtros */}
        <div className="filtros-contenedor">
          <select 
            className="select-filtro"
            value={filtroEstado}
            onChange={(e) => { setFiltroEstado(e.target.value); setPaginaActual(1); }}
          >
            <option value="todos">Todos los Estados</option>
            <option value="Activo">Solo Activos (Vigentes)</option>
            <option value="No activo">Inactivos / Pagados</option>
          </select>

          <select 
            className="select-filtro"
            value={filtroDescuento}
            onChange={(e) => { setFiltroDescuento(e.target.value); setPaginaActual(1); }}
          >
            <option value="todos">Todos los Descuentos</option>
            <option value="50">Con 50% Vigente</option>
            <option value="25">Con 25% Vigente</option>
            <option value="sin_descuento">Sin Descuento</option>
          </select>
        </div>
      </div>

      {/* Tabla Original con Datos Reales */}
      <div className="tabla-envoltorio">
        <table className="tabla-datos">
          <thead>
            <tr>
              <th>Placa</th>
              <th>N° Comparendo</th>
              <th>Secretaría</th>
              <th>Fecha Infracción</th>
              <th>Código</th>
              <th>Valor Total</th>
              <th>Descuento Legal</th>
              <th>Valor a Pagar</th>
              <th>Estado</th>
              <th style={{ textAlign: 'center' }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem' }}>
                  Cargando comparendos de la flota...
                </td>
              </tr>
            ) : comparendos.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--texto-atenuado)' }}>
                  No se encontraron comparendos con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              comparendos.map((c) => (
                <tr key={c.id} onClick={() => setComparendoSeleccionado(c)} style={{ cursor: 'pointer' }}>
                  <td>
                    <span className="placa-badge">{c.placa}</span>
                  </td>
                  <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>
                    {c.numero_comparendo}
                  </td>
                  <td>{c.secretaria}</td>
                  <td>{c.fecha_infraccion}</td>
                  <td>
                    <strong style={{ color: 'var(--color-primario)' }}>{c.codigo_infraccion}</strong>
                  </td>
                  <td>
                    ${Number(c.valor_total || 0).toLocaleString('es-CO')}
                  </td>
                  <td>
                    <span className={`chip-descuento ${
                      c.etiqueta_descuento?.includes('50') ? 'd50' : 
                      c.etiqueta_descuento?.includes('25') ? 'd25' : 'sin'
                    }`}>
                      {c.etiqueta_descuento}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: c.ahorro_disponible > 0 ? 'var(--color-exito)' : 'inherit' }}>
                    ${Number(c.valor_a_pagar || 0).toLocaleString('es-CO')}
                  </td>
                  <td>
                    <span className={`chip-estado ${c.estado_simit === 'Activo' ? 'activo' : 'inactivo'}`}>
                      {c.estado_simit}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="boton-icono" 
                      style={{ width: '32px', height: '32px', margin: '0 auto' }}
                      onClick={(e) => { e.stopPropagation(); setComparendoSeleccionado(c); }}
                      title="Ver detalle legal"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación Configurable */}
      <div className="tabla-paginacion">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>
            Mostrando <strong>{comparendos.length}</strong> de <strong>{totalRegistros}</strong> registros
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)' }}>Ver por página:</span>
            <select
              className="select-filtro"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
              value={mostrarInputPersonalizado ? 'personalizado' : limitePorPagina}
              onChange={(e) => cambiarLimite(e.target.value)}
            >
              <option value="5">5 registros (Predeterminado)</option>
              <option value="10">10 registros</option>
              <option value="20">20 registros</option>
              <option value="50">50 registros</option>
              <option value="personalizado">Personalizado...</option>
            </select>

            {mostrarInputPersonalizado && (
              <form onSubmit={aplicarLimitePersonalizado} style={{ display: 'flex', gap: '0.25rem' }}>
                <input
                  type="number"
                  min="1"
                  max="100"
                  placeholder="Cant."
                  className="campo-input"
                  style={{ width: '65px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                  value={limitePersonalizado}
                  onChange={(e) => setLimitePersonalizado(e.target.value)}
                />
                <button type="submit" className="boton-secundario" style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>
                  OK
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="paginacion-controles">
          <button 
            className="boton-paginacion"
            disabled={paginaActual <= 1}
            onClick={() => setPaginaActual(p => Math.max(1, p - 1))}
          >
            <ChevronLeft size={16} /> Anterior
          </button>

          <span style={{ fontWeight: 600, padding: '0 0.5rem' }}>
            Página {paginaActual} de {totalPaginas}
          </span>

          <button 
            className="boton-paginacion"
            disabled={paginaActual >= totalPaginas}
            onClick={() => setPaginaActual(p => Math.min(totalPaginas, p + 1))}
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Modal de Detalle */}
      {comparendoSeleccionado && (
        <ModalDetalleComparendo
          comparendo={comparendoSeleccionado}
          alCerrar={() => setComparendoSeleccionado(null)}
        />
      )}
    </section>
  )
}
