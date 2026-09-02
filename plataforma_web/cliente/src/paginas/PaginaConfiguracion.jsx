import React, { useState, useEffect } from 'react'
import { 
  Building2, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders, 
  Mail, 
  Calendar, 
  RefreshCw, 
  ShieldCheck, 
  X, 
  FileText, 
  Clock,
  Sparkles,
  MessageSquare,
  Users,
  CalendarClock
} from 'lucide-react'
import { BarraNavegacion } from '../componentes/BarraNavegacion'
import { ChatAgenteIA } from '../componentes/ChatAgenteIA'
import { EtiquetaTooltip } from '../componentes/EtiquetaTooltip'
import { apiBackend } from '../servicios/apiBackend'

export function PaginaConfiguracion() {
  const [entidades, setEntidades] = useState([])
  const [metricas, setMetricas] = useState({})
  const [alertas, setAlertas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [mensajeSync, setMensajeSync] = useState('')
  const [tipoMensajeSync, setTipoMensajeSync] = useState('info') // 'info' | 'exito' | 'error'
  const [chatAbierto, setChatAbierto] = useState(false)

  // Filtros de búsqueda
  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [mensajeFeedback, setMensajeFeedback] = useState({ tipo: '', texto: '' })

  // Estado del Modal (Crear / Editar Entidad)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [modoModal, setModoModal] = useState('crear') // 'crear' | 'editar'
  const [entidadFormulario, setEntidadFormulario] = useState({
    id: null,
    nombre_entidad: '',
    criterio_busqueda: '',
    tipo_documento: 'NIT',
    activo: true
  })
  const [guardando, setGuardando] = useState(false)

  // Estado de Programación Cron del Agente (cron.job)
  const [programacion, setProgramacion] = useState({
    hora_24h: '07:00',
    hora_12h: '07:00 AM',
    hora_colombia: '07:00 AM',
    hora_corta: '07:00',
    periodo: 'AM',
    schedule_cron: '0 12 * * *',
    activo: true
  })
  const [modalHorarioAbierto, setModalHorarioAbierto] = useState(false)
  const [horaSeleccionada, setHoraSeleccionada] = useState('07:00')
  const [guardandoHorario, setGuardandoHorario] = useState(false)

  // Cargar datos reales
  const cargarDatos = async () => {
    try {
      const [resEntidades, resKPIs, resAlertas, resProg] = await Promise.all([
        apiBackend.obtenerEntidades(),
        apiBackend.obtenerKPIs(),
        apiBackend.obtenerAlertas(),
        apiBackend.obtenerProgramacion()
      ])

      if (resEntidades && resEntidades.exitoso) {
        setEntidades(resEntidades.entidades || [])
      }
      if (resKPIs && resKPIs.exitoso) {
        setMetricas(resKPIs)
      }
      if (resAlertas && resAlertas.exitoso) {
        setAlertas(resAlertas)
      }
      if (resProg && resProg.exitoso) {
        setProgramacion(resProg)
        setHoraSeleccionada(resProg.hora_24h || '07:00')
      }
    } catch (e) {
      console.error('Error al cargar datos de configuración:', e)
      mostrarFeedback('error', 'No fue posible cargar la información de las entidades.')
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const mostrarFeedback = (tipo, texto) => {
    setMensajeFeedback({ tipo, texto })
    setTimeout(() => {
      setMensajeFeedback({ tipo: '', texto: '' })
    }, 4500)
  }

  const sincronizarSimit = async () => {
    setSincronizando(true)
    setTipoMensajeSync('info')
    setMensajeSync('Iniciando agente de extracción...')
    
    try {
      const res = await apiBackend.lanzarExtraccion('', 'NIT')
      if (res && res.exitoso) {
        setMensajeSync('El agente se está ejecutando y consultando las entidades...')
        
        let intentos = 0
        const intervalPoll = setInterval(async () => {
          intentos++
          try {
            const estadoRes = await apiBackend.obtenerEstadoExtraccion()
            if (estadoRes) {
              if (estadoRes.conclusion === 'success' || estadoRes.estado === 'completado') {
                clearInterval(intervalPoll)
                setSincronizando(false)
                setTipoMensajeSync('exito')
                setMensajeSync('El agente finalizó la extracción y los datos quedaron actualizados.')
                cargarDatos()
                setTimeout(() => setMensajeSync(''), 7000)
              } else if (estadoRes.conclusion === 'failure' || estadoRes.estado === 'error') {
                clearInterval(intervalPoll)
                setSincronizando(false)
                setTipoMensajeSync('error')
                setMensajeSync(estadoRes.mensaje || 'El agente reportó un inconveniente al consultar SIMIT. No fue posible completar la extracción.')
                setTimeout(() => setMensajeSync(''), 9000)
              } else if (estadoRes.en_progreso) {
                setTipoMensajeSync('info')
                setMensajeSync(estadoRes.mensaje || 'El agente continúa extrayendo información...')
              }
            }
          } catch (err) {
            console.error('Error consultando estado del agente:', err)
          }

          if (intentos > 40) {
            clearInterval(intervalPoll)
            setSincronizando(false)
            setTipoMensajeSync('info')
            setMensajeSync('El agente sigue procesando. Los datos se actualizarán automáticamente.')
            setTimeout(() => setMensajeSync(''), 6000)
          }
        }, 3000)
      } else {
        setSincronizando(false)
        setTipoMensajeSync('error')
        setMensajeSync(res?.mensaje || 'No fue posible iniciar el agente.')
        setTimeout(() => setMensajeSync(''), 6000)
      }
    } catch (e) {
      console.error('Error al sincronizar:', e)
      setSincronizando(false)
      setTipoMensajeSync('error')
      setMensajeSync('No fue posible comunicarse con el servicio en este momento.')
      setTimeout(() => setMensajeSync(''), 6000)
    }
  }

  // Abrir Modal para Crear
  const abrirModalCrear = () => {
    setModoModal('crear')
    setEntidadFormulario({
      id: null,
      nombre_entidad: '',
      criterio_busqueda: '',
      tipo_documento: 'NIT',
      activo: true
    })
    setModalAbierto(true)
  }

  // Abrir Modal para Editar
  const abrirModalEditar = (entidad) => {
    setModoModal('editar')
    setEntidadFormulario({
      id: entidad.id,
      nombre_entidad: entidad.nombre_entidad,
      criterio_busqueda: entidad.criterio_busqueda,
      tipo_documento: entidad.tipo_documento || 'NIT',
      activo: entidad.activo
    })
    setModalAbierto(true)
  }

  // Guardar Entidad (Crear o Actualizar)
  const guardarEntidad = async (e) => {
    e.preventDefault()
    if (!entidadFormulario.nombre_entidad.trim() || !entidadFormulario.criterio_busqueda.trim()) {
      mostrarFeedback('error', 'Por favor completa el nombre y número de documento.')
      return
    }

    setGuardando(true)
    try {
      if (modoModal === 'crear') {
        const res = await apiBackend.crearEntidad({
          nombre_entidad: entidadFormulario.nombre_entidad.trim(),
          criterio_busqueda: entidadFormulario.criterio_busqueda.trim().replace(/-/g, ''),
          tipo_documento: entidadFormulario.tipo_documento,
          activo: entidadFormulario.activo
        })
        if (res && res.exitoso) {
          mostrarFeedback('exito', `Entidad "${entidadFormulario.nombre_entidad}" agregada correctamente.`)
          setModalAbierto(false)
          await cargarDatos()
        } else {
          mostrarFeedback('error', res?.detail || 'Error al crear entidad.')
        }
      } else {
        const res = await apiBackend.actualizarEntidad(entidadFormulario.id, {
          nombre_entidad: entidadFormulario.nombre_entidad.trim(),
          criterio_busqueda: entidadFormulario.criterio_busqueda.trim().replace(/-/g, ''),
          tipo_documento: entidadFormulario.tipo_documento,
          activo: entidadFormulario.activo
        })
        if (res && res.exitoso) {
          mostrarFeedback('exito', `Entidad "${entidadFormulario.nombre_entidad}" actualizada correctamente.`)
          setModalAbierto(false)
          await cargarDatos()
        } else {
          mostrarFeedback('error', res?.detail || 'Error al actualizar entidad.')
        }
      }
    } catch (err) {
      console.error('Error al guardar:', err)
      mostrarFeedback('error', 'Error de comunicación con el servidor.')
    } finally {
      setGuardando(false)
    }
  }

  // Alternar Estado Activo / Pausado
  const alternarEstadoActivo = async (entidad) => {
    try {
      const nuevoEstado = !entidad.activo
      const res = await apiBackend.actualizarEntidad(entidad.id, { activo: nuevoEstado })
      if (res && res.exitoso) {
        setEntidades(entidades.map(e => e.id === entidad.id ? { ...e, activo: nuevoEstado } : e))
        mostrarFeedback('exito', `Estado de ${entidad.nombre_entidad} actualizado.`)
      }
    } catch (err) {
      mostrarFeedback('error', 'No fue posible cambiar el estado.')
    }
  }

  // Resolver Desambiguación Rápida
  const resolverTipoRapido = async (entidadId, tipoElegido) => {
    try {
      const res = await apiBackend.resolverTipoEntidad(entidadId, tipoElegido)
      if (res && res.exitoso) {
        mostrarFeedback('exito', `Tipo asignado como ${tipoElegido} exitosamente.`)
        await cargarDatos()
      }
    } catch (err) {
      mostrarFeedback('error', 'Error al resolver el tipo de documento.')
    }
  }

  // Guardar Horario Programado del Agente (cron.job)
  const guardarHorarioProgramado = async (e) => {
    e.preventDefault()
    setGuardandoHorario(true)
    try {
      const res = await apiBackend.actualizarProgramacion({
        hora_colombia: horaSeleccionada,
        activo: true
      })
      if (res && res.exitoso) {
        mostrarFeedback('exito', `Hora de consulta diaria actualizada a las ${res.hora_12h}.`)
        setModalHorarioAbierto(false)
        await cargarDatos()
      } else {
        mostrarFeedback('error', res?.detail || 'No fue posible actualizar la hora de consulta.')
      }
    } catch (err) {
      console.error('Error al guardar horario:', err)
      mostrarFeedback('error', 'Ocurrió un error al guardar la nueva hora.')
    } finally {
      setGuardandoHorario(false)
    }
  }

  // Eliminar Entidad
  const eliminarEntidad = async (entidad) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar la entidad "${entidad.nombre_entidad}"? Ya no será consultada por el agente.`)) {
      return
    }

    try {
      const res = await apiBackend.eliminarEntidad(entidad.id)
      if (res && res.exitoso) {
        mostrarFeedback('exito', `Entidad "${entidad.nombre_entidad}" eliminada correctamente.`)
        await cargarDatos()
      }
    } catch (err) {
      mostrarFeedback('error', 'No fue posible eliminar la entidad.')
    }
  }

  // Filtrar entidades
  const entidadesFiltradas = entidades.filter(e => {
    const termino = busqueda.toLowerCase().trim()
    const coincideTexto = (
      e.nombre_entidad?.toLowerCase().includes(termino) ||
      e.criterio_busqueda?.toLowerCase().includes(termino)
    )

    const coincideEstado = (
      filtroEstado === 'todos' ||
      (filtroEstado === 'activos' && e.activo) ||
      (filtroEstado === 'pausados' && !e.activo)
    )

    const coincideTipo = (
      filtroTipo === 'todos' ||
      e.tipo_documento === filtroTipo
    )

    return coincideTexto && coincideEstado && coincideTipo
  })

  const totalActivas = entidades.filter(e => e.activo).length
  const totalPausadas = entidades.filter(e => !e.activo).length
  const totalNits = entidades.filter(e => e.tipo_documento === 'NIT').length
  const totalCedulas = entidades.filter(e => e.tipo_documento === 'Cédula').length
  const entidadesConAlerta = entidades.filter(e => e.requiere_desambiguacion || e.tipo_documento === 'Pendiente' || e.tipo_documento === 'Sin especificar')

  return (
    <div className="app-contenedor">
      {/* Barra de Navegación Corporativa FSCR con Sincronización Real */}
      <BarraNavegacion 
        alertas={alertas}
        ultimaSincronizacion={metricas.ultima_sincronizacion}
        alSincronizar={sincronizarSimit}
        cargandoSincronizacion={sincronizando}
        alAbrirChat={() => setChatAbierto(true)}
      />

      <main className="contenido-principal">
        {/* Encabezado Principal 100% Estandarizado con PaginaInicio */}
        <div className="encabezado-dashboard-con-alertas">
          <div className="encabezado-titulos-izquierda">
            <h2>Configuración de Consultas y Entidades</h2>
            <p>Control de empresas, números de documento y programación de consultas SIMIT</p>
          </div>

          <div className="encabezado-alertas-derecha">
            <EtiquetaTooltip texto="Registrar una nueva empresa o cédula para consulta en lote">
              <button 
                className="boton-primario"
                onClick={abrirModalCrear}
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}
              >
                <Plus size={16} />
                <span>Nueva Entidad</span>
              </button>
            </EtiquetaTooltip>
          </div>
        </div>

        {/* Notificación de Sincronización */}
        {mensajeSync && (
          <div style={{
            background: tipoMensajeSync === 'error' 
              ? 'var(--color-peligro-suave)' 
              : tipoMensajeSync === 'info' 
              ? 'var(--azul-suave)' 
              : 'var(--color-exito-suave)',
            border: `1px solid ${tipoMensajeSync === 'error' ? '#fca5a5' : tipoMensajeSync === 'info' ? '#93c5fd' : '#6ee7b7'}`,
            color: tipoMensajeSync === 'error' 
              ? 'var(--color-peligro-rojo)' 
              : tipoMensajeSync === 'info' 
              ? 'var(--azul-primario)' 
              : '#065f46',
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radio-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600
          }}>
            {tipoMensajeSync === 'error' ? (
              <AlertTriangle size={18} />
            ) : tipoMensajeSync === 'info' ? (
              <RefreshCw size={18} className="spin-animation" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            <span>{mensajeSync}</span>
          </div>
        )}

        {/* Mensajes de Feedback Globales */}
        {mensajeFeedback.texto && (
          <div style={{
            padding: '0.75rem 1.25rem',
            borderRadius: 'var(--radio-md)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            backgroundColor: mensajeFeedback.tipo === 'exito' ? 'var(--color-exito-suave)' : 'var(--color-peligro-rojo-suave)',
            color: mensajeFeedback.tipo === 'exito' ? '#065f46' : '#991b1b',
            border: `1px solid ${mensajeFeedback.tipo === 'exito' ? '#6ee7b7' : '#fca5a5'}`
          }}>
            {mensajeFeedback.tipo === 'exito' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            <span>{mensajeFeedback.texto}</span>
          </div>
        )}

        {/* 1. Tarjetas KPI de Configuración (Mismo diseño y estructura de TarjetasKPI) */}
        <div className="grilla-kpis">
          {/* Tarjeta 1: Total Entidades */}
          <div className="tarjeta-kpi">
            <div className="tarjeta-kpi-cabecera">
              <span className="tarjeta-kpi-titulo">Total Entidades</span>
              <div className="tarjeta-kpi-icono">
                <Building2 size={15} />
              </div>
            </div>
            <div className="tarjeta-kpi-valor">
              {entidades.length} <span className="tarjeta-kpi-subtexto">titulares</span>
            </div>
            <div className="tarjeta-kpi-chips-fila">
              <span className="chip-estado activo">
                {totalActivas} Activas
              </span>
              <span className="chip-estado inactivo">
                {totalPausadas} Pausadas
              </span>
            </div>
          </div>

          {/* Tarjeta 2: Consultas Activas en Lote */}
          <div className="tarjeta-kpi">
            <div className="tarjeta-kpi-cabecera">
              <span className="tarjeta-kpi-titulo">Consultas Activas</span>
              <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-exito)', background: 'var(--color-exito-suave)' }}>
                <ShieldCheck size={15} />
              </div>
            </div>
            <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-exito)' }}>
              {totalActivas} <span className="tarjeta-kpi-subtexto" style={{ color: 'var(--color-exito)' }}>en lote</span>
            </div>
            <div className="tarjeta-kpi-detalle" style={{ color: '#065f46', fontWeight: 600 }}>
              <CheckCircle2 size={12} />
              <span>Extracción automática habilitada</span>
            </div>
          </div>

          {/* Tarjeta 3: Estado de Ambigüedades / Alertas */}
          <div className={`tarjeta-kpi ${entidadesConAlerta.length > 0 ? 'peligro' : ''}`}>
            <div className="tarjeta-kpi-cabecera">
              <span className="tarjeta-kpi-titulo" style={{ color: entidadesConAlerta.length > 0 ? 'var(--color-peligro-rojo)' : 'var(--texto-secundario)' }}>
                Estado Configuración
              </span>
              <div className="tarjeta-kpi-icono" style={{ 
                color: entidadesConAlerta.length > 0 ? 'var(--color-peligro-rojo)' : 'var(--azul-primario)',
                background: entidadesConAlerta.length > 0 ? 'var(--color-peligro-rojo-suave)' : 'var(--azul-suave)'
              }}>
                <AlertTriangle size={15} />
              </div>
            </div>
            <div className="tarjeta-kpi-valor" style={{ color: entidadesConAlerta.length > 0 ? 'var(--color-peligro-rojo)' : 'var(--texto-principal)' }}>
              {entidadesConAlerta.length} <span className="tarjeta-kpi-subtexto" style={{ color: entidadesConAlerta.length > 0 ? 'var(--color-peligro-rojo)' : 'var(--texto-atenuado)' }}>
                {entidadesConAlerta.length === 1 ? 'en revisión' : 'en revisión'}
              </span>
            </div>
            <div className="tarjeta-kpi-detalle" style={{ color: entidadesConAlerta.length > 0 ? '#991b1b' : 'var(--texto-secundario)', fontWeight: 600 }}>
              <span>{entidadesConAlerta.length > 0 ? 'Requiere definir NIT o Cédula' : '100% Sin ambigüedades'}</span>
            </div>
          </div>

          {/* Tarjeta 4: Distribución de Documentos */}
          <div className="tarjeta-kpi">
            <div className="tarjeta-kpi-cabecera">
              <span className="tarjeta-kpi-titulo">Tipos de Documento</span>
              <div className="tarjeta-kpi-icono">
                <Sliders size={15} />
              </div>
            </div>
            <div className="tarjeta-kpi-valor">
              {totalNits} <span className="tarjeta-kpi-subtexto">NITs</span>
            </div>
            <div className="tarjeta-kpi-chips-fila">
              <span className="chip-estado" style={{ background: 'var(--azul-suave)', color: 'var(--color-primario)' }}>
                {totalCedulas} Cédulas
              </span>
              <span className="chip-estado" style={{ background: 'var(--fondo-elevado)', color: 'var(--texto-atenuado)' }}>
                {entidades.length} Total
              </span>
            </div>
          </div>

          {/* Tarjeta 5: Programación del Agente Extractor (Conectado a cron.job en Supabase) */}
          <div className="tarjeta-kpi">
            <div className="tarjeta-kpi-cabecera">
              <span className="tarjeta-kpi-titulo">Programación Agente</span>
              <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-primario)', background: 'var(--azul-suave)' }}>
                <CalendarClock size={15} />
              </div>
            </div>
            <div className="tarjeta-kpi-valor" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span>Diaria</span>
              <span className="tarjeta-kpi-subtexto">{programacion.hora_12h || '07:00 AM'}</span>
              <EtiquetaTooltip texto="Editar hora de consulta diaria">
                <button 
                  className="boton-icono"
                  style={{ width: '22px', height: '22px', padding: 0, marginLeft: '0.1rem' }}
                  onClick={() => setModalHorarioAbierto(true)}
                >
                  <Edit2 size={12} />
                </button>
              </EtiquetaTooltip>
            </div>
            <div className="tarjeta-kpi-chips-fila">
              <span className="chip-estado activo">
                Modo Lote
              </span>
              <span className="chip-estado inactivo">
                Autónomo
              </span>
            </div>
          </div>
        </div>

        {/* BANNER DE ALERTAS DE DESAMBIGUACIÓN PENDIENTES */}
        {entidadesConAlerta.length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-alerta-amarillo-suave)',
            border: '1px solid #fcd34d',
            borderRadius: 'var(--radio-lg)',
            padding: '1.25rem 1.5rem',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.8rem' }}>
              <AlertTriangle size={22} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 0.35rem 0', fontSize: '0.98rem', fontWeight: 700, color: '#92400e' }}>
                  Atención: Se requiere definir el tipo de documento para {entidadesConAlerta.length} {entidadesConAlerta.length === 1 ? 'entidad' : 'entidades'}
                </h3>
                <p style={{ margin: '0 0 0.85rem 0', fontSize: '0.86rem', color: '#78350f' }}>
                  El agente identificó que el portal SIMIT encontró varios tipos de documento para estos números. Selecciona la opción correcta para habilitar su consulta automática:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {entidadesConAlerta.map(item => (
                    <div key={item.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.8rem',
                      padding: '0.65rem 1rem',
                      backgroundColor: 'var(--fondo-tarjeta)',
                      borderRadius: 'var(--radio-md)',
                      border: '1px solid var(--borde-tarjeta)'
                    }}>
                      <div>
                        <strong style={{ fontSize: '0.9rem', color: 'var(--texto-principal)' }}>{item.nombre_entidad}</strong>
                        <span style={{ fontSize: '0.82rem', color: 'var(--texto-secundario)', marginLeft: '0.5rem' }}>
                          (Documento: {item.criterio_busqueda})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--texto-secundario)' }}>Definir como:</span>
                        <button 
                          onClick={() => resolverTipoRapido(item.id, 'NIT')}
                          className="boton-primario"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            borderRadius: 'var(--radio-sm)'
                          }}
                        >
                          Es un NIT (Empresa)
                        </button>
                        <button 
                          onClick={() => resolverTipoRapido(item.id, 'Cédula')}
                          className="boton-secundario"
                          style={{
                            padding: '0.35rem 0.75rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            borderRadius: 'var(--radio-sm)'
                          }}
                        >
                          Es Cédula
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. TABLA DE ENTIDADES (Idéntica en estructura a TablaComparendos.jsx) */}
        <section className="seccion-tabla">
          <div className="tabla-herramientas">
            {/* Buscador */}
            <div className="buscador-contenedor">
              <Search size={18} color="var(--texto-secundario)" />
              <input 
                type="text"
                className="buscador-input"
                placeholder="Buscar por empresa, NIT o cédula..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>

            {/* Filtros */}
            <div className="filtros-contenedor">
              <select 
                className="select-filtro"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
              >
                <option value="todos">Todos los Estados</option>
                <option value="activos">Solo Activos (En consulta)</option>
                <option value="pausados">Pausados</option>
              </select>

              <select 
                className="select-filtro"
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
              >
                <option value="todos">Todos los Tipos</option>
                <option value="NIT">NIT (Empresas)</option>
                <option value="Cédula">Cédula de Ciudadanía</option>
                <option value="Pendiente">Pendiente de Definir</option>
              </select>
            </div>
          </div>

          {/* Tabla con Estilos Corporativos Oficiales */}
          <div className="tabla-envoltorio">
            <table className="tabla-datos">
              <thead>
                <tr>
                  <th>EMPRESA / TITULAR</th>
                  <th>N° IDENTIFICACIÓN</th>
                  <th>TIPO DE DOCUMENTO</th>
                  <th style={{ textAlign: 'center' }}>ESTADO DE CONSULTA</th>
                  <th style={{ textAlign: 'center' }}>ACCIONES</th>
                </tr>
              </thead>
              <tbody>
                {cargando ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>
                      Cargando entidades desde Supabase...
                    </td>
                  </tr>
                ) : entidadesFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '2rem', color: 'var(--texto-atenuado)' }}>
                      No se encontraron entidades con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  entidadesFiltradas.map((entidad) => {
                    const tieneAlerta = entidad.requiere_desambiguacion || entidad.tipo_documento === 'Pendiente'
                    return (
                      <tr 
                        key={entidad.id}
                        style={{ 
                          backgroundColor: tieneAlerta ? 'var(--color-alerta-amarillo-suave)' : 'transparent'
                        }}
                      >
                        {/* Nombre de la Entidad */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 600 }}>
                            <Building2 size={16} style={{ color: 'var(--azul-primario)' }} />
                            <span>{entidad.nombre_entidad}</span>
                            {tieneAlerta && (
                              <EtiquetaTooltip texto="Requiere definir si es NIT o Cédula en el SIMIT">
                                <span 
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    padding: '0.15rem 0.45rem',
                                    borderRadius: 'var(--radio-sm)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                    color: '#b45309',
                                    cursor: 'help'
                                  }}
                                >
                                  <AlertTriangle size={12} />
                                  Requiere Atención
                                </span>
                              </EtiquetaTooltip>
                            )}
                          </div>
                        </td>

                        {/* Documento con Placa Badge Style */}
                        <td>
                          <span className="placa-badge" style={{ fontFamily: 'var(--fuente-titulos)' }}>
                            {entidad.criterio_busqueda}
                          </span>
                        </td>

                        {/* Tipo de Documento */}
                        <td>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.25rem 0.65rem',
                            borderRadius: 'var(--radio-sm)',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            backgroundColor: entidad.tipo_documento === 'NIT' ? 'var(--azul-suave)' : entidad.tipo_documento === 'Cédula' ? 'var(--color-exito-suave)' : 'var(--color-alerta-amarillo-suave)',
                            color: entidad.tipo_documento === 'NIT' ? 'var(--color-primario)' : entidad.tipo_documento === 'Cédula' ? 'var(--color-exito)' : '#d97706'
                          }}>
                            {entidad.tipo_documento || 'Sin especificar'}
                          </span>
                        </td>

                        {/* Estado Activo / Inactivo */}
                        <td style={{ textAlign: 'center' }}>
                          <EtiquetaTooltip texto={entidad.activo ? "Consulta activa: El agente la incluye en extracciones" : "Consulta pausada: No se consulta"}>
                            <button
                              onClick={() => alternarEstadoActivo(entidad)}
                              style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.3rem 0.75rem',
                                borderRadius: '20px',
                                backgroundColor: entidad.activo ? 'var(--color-exito-suave)' : 'var(--fondo-elevado)',
                                color: entidad.activo ? 'var(--color-exito)' : 'var(--texto-atenuado)',
                                fontWeight: 700,
                                fontSize: '0.8rem'
                              }}
                            >
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entidad.activo ? 'var(--color-exito)' : 'var(--texto-atenuado)' }}></span>
                              {entidad.activo ? 'Activo' : 'Pausado'}
                            </button>
                          </EtiquetaTooltip>
                        </td>

                        {/* Acciones */}
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                            <EtiquetaTooltip texto="Editar datos de la entidad">
                              <button
                                onClick={() => abrirModalEditar(entidad)}
                                className="boton-icono"
                                style={{ width: '32px', height: '32px' }}
                              >
                                <Edit2 size={14} />
                              </button>
                            </EtiquetaTooltip>
                            
                            <EtiquetaTooltip texto="Eliminar entidad">
                              <button
                                onClick={() => eliminarEntidad(entidad)}
                                className="boton-icono"
                                style={{ width: '32px', height: '32px', color: 'var(--color-peligro-rojo)', background: 'var(--color-peligro-rojo-suave)', borderColor: '#fca5a5' }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </EtiquetaTooltip>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* 3. SECCIÓN FUTURA: PROGRAMACIÓN Y ENVÍO DE REPORTES POR CORREO */}
        <div style={{ 
          marginTop: '2rem',
          padding: '1.5rem 1.75rem', 
          borderRadius: 'var(--radio-lg)',
          border: '1px dashed var(--borde-tarjeta)',
          backgroundColor: 'var(--fondo-tarjeta)',
          boxShadow: 'var(--sombra-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                <Mail size={18} style={{ color: 'var(--azul-primario)' }} />
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--texto-principal)' }}>
                  Programación de Reportes Automáticos y Envío por Correo
                </h3>
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.55rem',
                  borderRadius: 'var(--radio-sm)',
                  backgroundColor: 'var(--azul-suave)',
                  color: 'var(--azul-primario)',
                  textTransform: 'uppercase'
                }}>
                  Próximamente
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--texto-secundario)', maxWidth: '700px' }}>
                En esta sección podrás programar la frecuencia de envíos automáticos (diario, semanal o mensual), configurar los correos electrónicos de los responsables de flota y recibir resúmenes ejecutivos con alertas de descuentos próximos a vencer.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', opacity: 0.7 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radio-md)', border: '1px solid var(--borde-tarjeta)', background: 'var(--fondo-elevado)' }}>
                <Calendar size={14} /> Frecuencia de Envío
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem', fontWeight: 600, padding: '0.4rem 0.8rem', borderRadius: 'var(--radio-md)', border: '1px solid var(--borde-tarjeta)', background: 'var(--fondo-elevado)' }}>
                <Mail size={14} /> Destinatarios
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL PARA CREAR / EDITAR ENTIDAD */}
      {modalAbierto && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '480px',
            borderRadius: 'var(--radio-lg)',
            padding: '1.75rem',
            backgroundColor: 'var(--fondo-tarjeta)',
            border: '1px solid var(--borde-tarjeta)',
            boxShadow: 'var(--sombra-lg)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={20} style={{ color: 'var(--azul-primario)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--texto-principal)' }}>
                  {modoModal === 'crear' ? 'Registrar Nueva Entidad' : 'Editar Entidad'}
                </h2>
              </div>
              <button 
                onClick={() => setModalAbierto(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-secundario)' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardarEntidad}>
              {/* Nombre de la Empresa */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--texto-principal)' }}>
                  Nombre de la Empresa o Titular *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: FSCR Ingeniería S.A.S"
                  value={entidadFormulario.nombre_entidad}
                  onChange={(e) => setEntidadFormulario({ ...entidadFormulario, nombre_entidad: e.target.value })}
                  className="campo-input"
                />
              </div>

              {/* Número de Identificación */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--texto-principal)' }}>
                  Número de Documento / NIT (sin guiones) *
                </label>
                <input 
                  type="text"
                  required
                  placeholder="Ej: 900160091"
                  value={entidadFormulario.criterio_busqueda}
                  onChange={(e) => setEntidadFormulario({ ...entidadFormulario, criterio_busqueda: e.target.value })}
                  className="campo-input"
                />
              </div>

              {/* Tipo de Documento */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--texto-principal)' }}>
                  Tipo de Documento para SIMIT *
                </label>
                <select
                  value={entidadFormulario.tipo_documento}
                  onChange={(e) => setEntidadFormulario({ ...entidadFormulario, tipo_documento: e.target.value })}
                  className="select-filtro"
                  style={{ width: '100%' }}
                >
                  <option value="NIT">NIT (Persona Jurídica / Empresa)</option>
                  <option value="Cédula">Cédula de Ciudadanía (Persona Natural)</option>
                  <option value="Pendiente">Pendiente por definir</option>
                </select>
                <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.75rem', color: 'var(--texto-atenuado)' }}>
                  El agente usará este tipo cuando el SIMIT pregunte si es NIT o Cédula.
                </p>
              </div>

              {/* Switch de Estado Activo */}
              <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', borderRadius: 'var(--radio-md)', backgroundColor: 'var(--fondo-elevado)', border: '1px solid var(--borde-tarjeta)' }}>
                <div>
                  <span style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--texto-principal)' }}>
                    Activo para consulta automática
                  </span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--texto-secundario)' }}>
                    Si está activo, el agente lo incluirá en cada extracción en lote.
                  </span>
                </div>
                <input 
                  type="checkbox"
                  checked={entidadFormulario.activo}
                  onChange={(e) => setEntidadFormulario({ ...entidadFormulario, activo: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
              </div>

              {/* Botones del Modal */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="boton-secundario"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="boton-primario"
                >
                  {guardando && <RefreshCw size={16} className="spin-animation" />}
                  <span>{modoModal === 'crear' ? 'Guardar Entidad' : 'Actualizar'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL PARA CONFIGURAR HORARIO DE CONSULTA DIARIA */}
      {modalHorarioAbierto && (
        <div className="modal-superposicion" onClick={() => setModalHorarioAbierto(false)}>
          <div className="modal-tarjeta" style={{ maxWidth: '490px', overflowY: 'visible' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-cabecera" style={{ padding: '0.85rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CalendarClock size={18} style={{ color: 'var(--color-primario)' }} />
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                  Hora de Consulta Diaria
                </h3>
              </div>
              <button 
                className="boton-icono"
                onClick={() => setModalHorarioAbierto(false)}
                style={{ width: '26px', height: '26px' }}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={guardarHorarioProgramado} style={{ padding: '0.9rem 1.25rem 1.15rem' }}>
              <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.82rem', color: 'var(--texto-secundario)', lineHeight: 1.4 }}>
                Elige la hora en la que el sistema revisará todos los días el estado de las multas y comparendos de la flota.
              </p>

              {/* Selector de Hora */}
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', color: 'var(--texto-principal)' }}>
                  Hora de consulta *
                </label>
                <input 
                  type="time"
                  required
                  value={horaSeleccionada}
                  onChange={(e) => setHoraSeleccionada(e.target.value)}
                  className="buscador-input"
                  style={{ width: '100%', fontSize: '1rem', fontWeight: 700, padding: '0.45rem 0.75rem' }}
                />
              </div>

              {/* Botones de Selección Rápida */}
              <div style={{ marginBottom: '0.85rem' }}>
                <span style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: 'var(--texto-secundario)', marginBottom: '0.35rem' }}>
                  Horarios sugeridos:
                </span>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  {['05:00', '06:00', '07:00', '08:00', '12:00', '18:00'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHoraSeleccionada(h)}
                      className={horaSeleccionada === h ? 'boton-primario' : 'boton-secundario'}
                      style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', borderRadius: 'var(--radio-sm)' }}
                    >
                      {h === '12:00' ? '12:00 PM' : h === '18:00' ? '06:00 PM' : `${h} AM`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tarjeta Informativa en Lenguaje Natural */}
              <div style={{
                backgroundColor: 'var(--fondo-elevado)',
                border: '1px solid var(--borde-tarjeta)',
                borderRadius: 'var(--radio-md)',
                padding: '0.55rem 0.8rem',
                marginBottom: '1rem',
                fontSize: '0.78rem',
                color: 'var(--texto-secundario)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--texto-principal)', marginBottom: '0.15rem' }}>
                  <ShieldCheck size={13} style={{ color: 'var(--color-exito)' }} />
                  <span>Actualización automática</span>
                </div>
                <span>El agente iniciará de forma autónoma todos los días a esta hora para mantener la información siempre al día.</span>
              </div>

              {/* Botones de Acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem' }}>
                <button
                  type="button"
                  onClick={() => setModalHorarioAbierto(false)}
                  className="boton-secundario"
                  style={{ padding: '0.45rem 0.9rem', fontSize: '0.85rem' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoHorario}
                  className="boton-primario"
                  style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
                >
                  {guardandoHorario && <RefreshCw size={14} className="spin-animation" />}
                  <span>Guardar Horario</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Botón Flotante para Asistente IA */}
      <EtiquetaTooltip texto="Abrir Asistente IA" posicion="izquierda">
        <button 
          className="chat-flotante-boton"
          onClick={() => setChatAbierto(!chatAbierto)}
        >
          <MessageSquare size={26} />
        </button>
      </EtiquetaTooltip>

      {/* Ventana de Chat Flotante */}
      <ChatAgenteIA 
        abierto={chatAbierto}
        alCerrar={() => setChatAbierto(false)}
      />
    </div>
  )
}
