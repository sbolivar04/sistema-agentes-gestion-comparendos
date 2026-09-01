import React, { useState } from 'react'
import { ProveedorTema } from './contexto/ContextoTema'
import { ProveedorAutenticacion, useAutenticacion } from './contexto/ContextoAutenticacion'
import { PaginaLogin } from './paginas/PaginaLogin'
import { PaginaInicio } from './paginas/PaginaInicio'
import { PaginaDashboard } from './paginas/PaginaDashboard'
import { PanelLateral } from './componentes/PanelLateral'
import './estilos/corporativo.css'

function ContenidoApp() {
  const { usuario } = useAutenticacion()
  const [vistaActual, setVistaActual] = useState('inicio')
  const [sidebarColapsado, setSidebarColapsado] = useState(false)

  if (!usuario) {
    return <PaginaLogin />
  }

  return (
    <div className="layout-con-panel-lateral">
      {/* Panel Lateral con solo las 2 hojas: Seguimiento y Métricas (Dashboard) */}
      <PanelLateral 
        vistaActual={vistaActual}
        alCambiarVista={(nuevaVista) => setVistaActual(nuevaVista)}
        colapsado={sidebarColapsado}
        alAlternarColapso={() => setSidebarColapsado(!sidebarColapsado)}
      />

      {/* Contenedor Principal de la Vista Activa */}
      <main className="contenedor-vista-activa">
        {vistaActual === 'inicio' && <PaginaInicio />}
        {vistaActual === 'metricas' && <PaginaDashboard />}
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
