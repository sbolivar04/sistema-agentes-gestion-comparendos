import React, { useState } from 'react'
import { ProveedorTema } from './contexto/ContextoTema'
import { ProveedorAutenticacion, useAutenticacion } from './contexto/ContextoAutenticacion'
import { PaginaLogin } from './paginas/PaginaLogin'
import { PaginaInicio } from './paginas/PaginaInicio'
import { PaginaDashboard } from './paginas/PaginaDashboard'
import { PaginaConfiguracion } from './paginas/PaginaConfiguracion'
import { PanelLateral } from './componentes/PanelLateral'
import './estilos/corporativo.css'

function ContenidoApp() {
  const { usuario } = useAutenticacion()
  const [vistaActual, setVistaActual] = useState(() => {
    return localStorage.getItem('vista_actual_fscr') || 'inicio'
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
      {/* Panel Lateral con las 3 hojas: Seguimiento, Métricas y Configuración */}
      <PanelLateral 
        vistaActual={vistaActual}
        alCambiarVista={cambiarVista}
        colapsado={sidebarColapsado}
        alAlternarColapso={() => setSidebarColapsado(!sidebarColapsado)}
      />

      {/* Contenedor Principal de la Vista Activa */}
      <main className="contenedor-vista-activa">
        {vistaActual === 'inicio' && (
          <PaginaInicio alNavegarAConfiguracion={() => cambiarVista('configuracion')} />
        )}
        {vistaActual === 'metricas' && <PaginaDashboard />}
        {vistaActual === 'configuracion' && <PaginaConfiguracion />}
      </main>
    </div>
  )
}

export default function App() {
  return (
    <ProveedorTema>
      <ProveedorAutenticacion>
        <ContenidoApp />
      </ProveedorAutenticacion>
    </ProveedorTema>
  )
}
