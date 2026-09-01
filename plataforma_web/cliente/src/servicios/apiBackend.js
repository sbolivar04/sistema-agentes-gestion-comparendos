/**
 * Servicio de conexión con la API Backend de FastAPI
 */

const API_BASE = '/api'

export const apiBackend = {
  async obtenerKPIs() {
    const res = await fetch(`${API_BASE}/kpis`)
    return await res.json()
  },

  async obtenerEstadisticas() {
    const res = await fetch(`${API_BASE}/estadisticas`)
    return await res.json()
  },

  async obtenerAlertas() {
    const res = await fetch(`${API_BASE}/alertas`)
    return await res.json()
  },

  async obtenerComparendos({ pagina = 1, limite = 5, busqueda = '', estado_simit = 'todos', filtro_descuento = 'todos' }) {
    const params = new URLSearchParams({
      pagina,
      limite,
      busqueda,
      estado_simit,
      filtro_descuento
    })
    const res = await fetch(`${API_BASE}/comparendos?${params.toString()}`)
    return await res.json()
  },

  async enviarMensajeChat(mensaje) {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje })
    })
    return await res.json()
  },

  async reiniciarChat() {
    const res = await fetch(`${API_BASE}/chat/reiniciar`, { method: 'POST' })
    return await res.json()
  },

  async lanzarExtraccion(criterio = '', tipo_consulta = 'NIT') {
    const res = await fetch(`${API_BASE}/extraccion/lanzar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ criterio, tipo_consulta })
    })
    return await res.json()
  },

  async obtenerEstadoExtraccion() {
    const res = await fetch(`${API_BASE}/extraccion/estado`)
    return await res.json()
  }
}
