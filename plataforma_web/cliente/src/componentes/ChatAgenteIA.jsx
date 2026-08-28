import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Bot, User, Trash2, Sparkles, AlertCircle } from 'lucide-react'
import { apiBackend } from '../servicios/apiBackend'

export function ChatAgenteIA({ abierto, alCerrar }) {
  const [mensajes, setMensajes] = useState([
    {
      rol: 'agente',
      texto: '¡Hola! Soy el Asistente Inteligente de Comparendos de FSCR Ingeniería. Puedes preguntarme sobre el estado de la flota, vehículos específicos, fechas límites de descuento o consultas de ahorro.'
    }
  ])
  const [inputTexto, setInputTexto] = useState('')
  const [cargando, setCargando] = useState(false)
  const finMensajesRef = useRef(null)

  const desplazarseAlFinal = () => {
    finMensajesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (abierto) {
      desplazarseAlFinal()
    }
  }, [mensajes, abierto])

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
    await apiBackend.reiniciarChat()
    setMensajes([
      {
        rol: 'agente',
        texto: 'Historial reiniciado. ¿En qué más puedo orientarte hoy con la gestión de la flota?'
      }
    ])
  }

  if (!abierto) return null

  return (
    <div className="chat-ventana">
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
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Asistente IA de Flota</h4>
            <span style={{ fontSize: '0.72rem', opacity: 0.85 }}>Gemini 3.5 Flash Lite • Cero Alucinación</span>
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
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {m.texto}
            </div>
          </div>
        ))}
        {cargando && (
          <div className="mensaje-burbuja agente" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={16} color="var(--color-primario)" className="spin-animation" />
            <span style={{ fontSize: '0.8rem', color: 'var(--texto-secundario)' }}>Consultando datos y analizando...</span>
          </div>
        )}
        <div ref={finMensajesRef} />
      </div>

      {/* Input de Mensaje */}
      <form onSubmit={manejarEnvio} className="chat-input-contenedor">
        <input
          type="text"
          className="chat-input"
          placeholder="Haz una pregunta sobre la flota..."
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
  )
}
