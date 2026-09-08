import React, { useState } from 'react'
import { ProveedorTema } from './contexto/ContextoTema'
import { ProveedorAutenticacion, useAutenticacion } from './contexto/ContextoAutenticacion'
import { ProveedorFlota, useFlota } from './contexto/ContextoFlota'
import { PaginaLogin } from './paginas/PaginaLogin'
import { PaginaInicio } from './paginas/PaginaInicio'
import { PaginaConfiguracion } from './paginas/PaginaConfiguracion'
import { PanelLateral } from './componentes/PanelLateral'
import './estilos/corporativo.css'

function ContenidoApp() {
  const { usuario } = useAutenticacion()
  const { metricas } = useFlota()
  const [vistaActual, setVistaActual] = useState(() => {
    const vistaGuardada = localStorage.getItem('vista_actual_fscr')
    return (vistaGuardada && vistaGuardada !== 'metricas') ? vistaGuardada : 'inicio'
  })
  const [sidebarColapsado, setSidebarColapsado] = useState(true)

  const cambiarVista = (nuevaVista) => {
    setVistaActual(nuevaVista)
    localStorage.setItem('vista_actual_fscr', nuevaVista)
  }

  if (!usuario) {
    return <PaginaLogin />
  }

  return (
    <div className="layout-con-panel-lateral">
      {/* Panel Lateral con las 2 hojas: Control y Seguimiento y Configuración */}
      <PanelLateral 
        vistaActual={vistaActual}
        alCambiarVista={cambiarVista}
        colapsado={sidebarColapsado}
        alAlternarColapso={() => setSidebarColapsado(!sidebarColapsado)}
        totalComparendos={metricas.total_activos ?? 5}
      />

      {/* Contenedor Principal de la Vista Activa */}
      <main className="contenedor-vista-activa">
        {vistaActual === 'inicio' && (
          <PaginaInicio 
            alNavegarAConfiguracion={() => cambiarVista('configuracion')}
          />
        )}
        {vistaActual === 'configuracion' && <PaginaConfiguracion />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ProveedorTema>
      <ProveedorAutenticacion>
        <ProveedorFlota>
          <ContenidoApp />
        </ProveedorFlota>
      </ProveedorAutenticacion>
    </ProveedorTema>
  )
}
