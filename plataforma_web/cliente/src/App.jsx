import React from 'react'
import { ProveedorTema } from './contexto/ContextoTema'
import { ProveedorAutenticacion, useAutenticacion } from './contexto/ContextoAutenticacion'
import { PaginaLogin } from './paginas/PaginaLogin'
import { PaginaDashboard } from './paginas/PaginaDashboard'
import './estilos/corporativo.css'

function ContenidoApp() {
  const { usuario } = useAutenticacion()
  return usuario ? <PaginaDashboard /> : <PaginaLogin />
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
