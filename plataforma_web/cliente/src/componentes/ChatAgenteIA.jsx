import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Bot, User, Trash2, Sparkles, AlertCircle, Maximize2, Minimize2, Loader2, CheckCircle2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import { apiBackend } from '../servicios/apiBackend'
import { useFlota } from '../contexto/ContextoFlota'

export function ChatAgenteIA({ abierto, alCerrar }) {
  const { cargarTodo } = useFlota()
  const [mensajes, setMensajes] = useState([
    {
      rol: 'agente',
      texto: '¡Ajá! Soy **Cuatrojos**, la asistente de flota de FSCR Ingeniería. Tengo estos cuatro ojos bien abiertos en el SIMIT para que no se nos pase ningún descuento ni nos cobren de más. ¿Qué carro o placa revisamos hoy?'
    }
  ])
  const [inputTexto, setInputTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const [maximizado, setMaximizado] = useState(false)
  const [syncEnCurso, setSyncEnCurso] = useState(null)
  const finMensajesRef = useRef(null)
  const syncIntervaloRef = useRef(null)
  const estaMonitoreandoRef = useRef(false)

  const procesarTextoMarkdown = (texto) => {
    if (!texto) return ''
    return texto.replace(/^[ \t]*[•·][ \t]+/gm, '- ')
  }

  const desplazarseAlFinal = () => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (abierto) {
      desplazarseAlFinal()
    }
  }, [mensajes, syncEnCurso, abierto])

  useEffect(() => {
    const manejarTeclaEscape = (e) => {
      if (e.key === 'Escape' && abierto && alCerrar) {
        alCerrar()
      }
    }
    window.addEventListener('keydown', manejarTeclaEscape)
    return () => window.removeEventListener('keydown', manejarTeclaEscape)
  }, [abierto, alCerrar])

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (syncIntervaloRef.current) {
        clearInterval(syncIntervaloRef.current)
      }
    }
  }, [])

  // Monitoreo en vivo del estado de consulta en SIMIT
  const iniciarSeguimientoSync = (detalles) => {
    if (estaMonitoreandoRef.current) {
      return
    }
    estaMonitoreandoRef.current = true

    if (syncIntervaloRef.current) {
      clearInterval(syncIntervaloRef.current)
      syncIntervaloRef.current = null
    }

    const etiquetaEntidad = detalles?.criterio ? `para ${detalles.criterio}` : 'para toda la flota'
    setSyncEnCurso({
      activo: true,
      mensaje: `Estoy consultando en el SIMIT ${etiquetaEntidad}... Conectando con el portal oficial.`
    })

    let intentos = 0
    syncIntervaloRef.current = setInterval(async () => {
      intentos++
      try {
        const estadoRes = await apiBackend.obtenerEstadoExtraccion()
        if (estadoRes) {
          if (estadoRes.en_progreso) {
            setSyncEnCurso({
              activo: true,
              mensaje: estadoRes.mensaje || `Estoy consultando en el SIMIT ${etiquetaEntidad}... ya casi termino la consulta.`
            })
          } else {
            // Concluyó la consulta
            estaMonitoreandoRef.current = false
            if (syncIntervaloRef.current) {
              clearInterval(syncIntervaloRef.current)
              syncIntervaloRef.current = null
            }
            setSyncEnCurso(null)

            if (estadoRes.conclusion === 'success' || estadoRes.estado === 'completado') {
              setMensajes(prev => [...prev, {
                rol: 'agente',
                texto: `¡Listo el pollo! La consulta en el SIMIT fue exitosa y la información ${detalles?.criterio ? `de **${detalles.criterio}**` : 'de toda la flota'} ya quedó 100% actualizada en el sistema.`
              }])
              if (cargarTodo) cargarTodo(true)
            } else if (estadoRes.conclusion === 'failure') {
              let msgFallo = 'Hubo un inconveniente al consultar el portal del SIMIT. El portal presentó demoras o no respondió a tiempo. Si deseas, podemos volver a intentarlo en unos instantes.'
              if (estadoRes.mensaje && !estadoRes.mensaje.includes('urlopen') && !estadoRes.mensaje.includes('timed out') && !estadoRes.mensaje.includes('Error al verificar')) {
                msgFallo = estadoRes.mensaje
              }
              setMensajes(prev => [...prev, {
                rol: 'agente',
                texto: msgFallo
              }])
            } else if (estadoRes.estado === 'parcial') {
              setMensajes(prev => [...prev, {
                rol: 'agente',
                texto: estadoRes.mensaje || 'La sincronización en el SIMIT finalizó de manera parcial.'
              }])
              if (cargarTodo) cargarTodo(true)
            }
          }
        }
      } catch (err) {
        console.warn('Verificación temporal de extracción diferida:', err)
      }

      // Límite de seguridad: 80 intentos (aprox. 4 minutos)
      if (intentos > 80) {
        estaMonitoreandoRef.current = false
        if (syncIntervaloRef.current) {
          clearInterval(syncIntervaloRef.current)
          syncIntervaloRef.current = null
        }
        setSyncEnCurso(null)
      }
    }, 3500)
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (!inputTexto.trim() || cargando) return

    const mensajeUsuario = inputTexto.trim()
    setInputTexto('')
    
    // Agregar mensaje del usuario
    setMensajes(prev => [...prev, { rol: 'usuario', texto: mensajeUsuario }])
    setCargando(true)

    try {
      const res = await apiBackend.enviarMensajeChat(mensajeUsuario)
      if (res.exitoso) {
        setMensajes(prev => [...prev, { rol: 'agente', texto: res.respuesta }])
        
        // Si el orquestador activó una actualización en el SIMIT, iniciar el monitoreo en vivo
        if (res.extraccion_iniciada) {
          iniciarSeguimientoSync(res.detalles_extraccion)
        }
      } else {
        setMensajes(prev => [...prev, { 
          rol: 'agente', 
          texto: res.error || 'Ocurrió un error al procesar tu consulta con el asistente.' 
        }])
      }
    } catch (err) {
      setMensajes(prev => [...prev, { 
        rol: 'agente', 
        texto: 'Error de conexión con el servidor. Verifica que el backend esté en ejecución.' 
      }])
    } finally {
      setCargando(false)
    }
  }

  const reiniciarConversacion = async () => {
    if (syncIntervaloRef.current) {
      clearInterval(syncIntervaloRef.current)
      syncIntervaloRef.current = null
    }
    setSyncEnCurso(null)
    await apiBackend.reiniciarChat()
    setMensajes([
      {
        rol: 'agente',
        texto: '¡Listo! Historial reiniciado. Aquí sigo con los cuatro ojos bien puestos en el SIMIT. ¿Qué revisamos ahora?'
      }
    ])
  }

  if (!abierto) return null

  return (
    <>
      {maximizado && (
        <div 
          className="chat-backdrop-maximizado" 
          onClick={() => setMaximizado(false)} 
          title="Haz clic para restaurar"
        />
      )}
      <div className={`chat-ventana ${maximizado ? 'maximizado' : ''}`}>
        {/* Cabecera del Chat */}
        <div className="chat-cabecera">
          <div className="chat-cabecera-info">
            <div style={{
              background: 'rgba(255,255,255,0.2)',
              borderRadius: '50%',
              width: '34px',
              height: '34px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={20} color="white" />
            </div>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Cuatrojos • Asistente de Flota</h4>
              <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>FSCR Ingeniería</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.35rem' }}>
            <button 
              className="boton-icono" 
              style={{ width: '32px', height: '32px', background: 'transparent', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              onClick={reiniciarConversacion}
              title="Reiniciar chat"
            >
              <Trash2 size={15} />
            </button>
            <button 
              className="boton-icono" 
              style={{ width: '32px', height: '32px', background: 'transparent', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              onClick={() => setMaximizado(!maximizado)}
              title={maximizado ? "Restaurar tamaño normal" : "Maximizar ventana"}
            >
              {maximizado ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button 
              className="boton-icono" 
              style={{ width: '32px', height: '32px', background: 'transparent', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              onClick={alCerrar}
              title="Cerrar ventana"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Lista de Mensajes */}
        <div className="chat-mensajes">
          {mensajes.map((m, idx) => (
            <div key={idx} className={`mensaje-burbuja ${m.rol}`}>
              {m.rol === 'agente' ? (
                <div className="mensaje-markdown-agente">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="contenedor-tabla-chat">
                          <table {...props} />
                        </div>
                      )
                    }}
                  >
                    {procesarTextoMarkdown(m.texto)}
                  </ReactMarkdown>
                </div>
              ) : (
                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.texto}
                </div>
              )}
            </div>
          ))}
        {cargando && (
          <div className="mensaje-burbuja agente" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--color-primario)" style={{ animation: 'spin 1.5s linear infinite' }} />
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)' }}>Consultando datos y analizando...</span>
          </div>
        )}

        {syncEnCurso && syncEnCurso.activo && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            margin: '0.6rem 0',
            padding: '0.65rem 0.85rem',
            borderRadius: '10px',
            background: 'rgba(37, 99, 235, 0.08)',
            border: '1px solid rgba(37, 99, 235, 0.25)',
            color: 'var(--texto-principal)'
          }}>
            <Loader2 size={18} color="#2563eb" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.74rem', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                Consulta en Vivo en SIMIT
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)' }}>{syncEnCurso.mensaje}</div>
            </div>
          </div>
        )}
        <div ref={finMensajesRef} />
      </div>

      {/* Input de Mensaje */}
      <form onSubmit={manejarEnvio} className="chat-input-contenedor">
        <input
          type="text"
          className="chat-input"
          placeholder="Pregúntale a Cuatrojos (ej. ¿cómo está la flota? o placa WEO146)..."
          value={inputTexto}
          onChange={(e) => setInputTexto(e.target.value)}
          disabled={cargando}
        />
        <button 
          type="submit" 
          className="boton-primario" 
          style={{ padding: '0.65rem 1rem' }}
          disabled={cargando || !inputTexto.trim()}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
    </>
  )
}
