import React from 'react'
import { useTema } from '../contexto/ContextoTema'
import { 
  Car, 
  BarChart3, 
  ChevronLeft, 
  ChevronRight, 
  ShieldCheck,
  Sliders
} from 'lucide-react'

export function PanelLateral({ 
  vistaActual = 'inicio', 
  alCambiarVista, 
  colapsado = true, 
  alAlternarColapso,
  totalComparendos = 14,
  alertasConfiguracion = 0
}) {
  const { esOscuro } = useTema()

  const elementosMenu = [
    {
      id: 'inicio',
      titulo: 'Control y Seguimiento',
      icono: Car,
      conteo: totalComparendos,
      activo: vistaActual === 'inicio'
    },
    {
      id: 'metricas',
      titulo: 'Métricas & Dashboard',
      icono: BarChart3,
      activo: vistaActual === 'metricas'
    },
    {
      id: 'configuracion',
      titulo: 'Configuración de Consultas',
      icono: Sliders,
      conteo: alertasConfiguracion > 0 ? '!' : undefined,
      esAlerta: alertasConfiguracion > 0,
      activo: vistaActual === 'configuracion'
    }
  ]

  return (
    <aside className={`panel-lateral ${colapsado ? 'colapsado' : 'expandido'}`}>
      {/* Cabecera: Al hacer clic en el logo se contrae o expande */}
      <div className="panel-lateral-cabecera">
        <div 
          className="panel-logo-caja" 
          onClick={alAlternarColapso}
          title={colapsado ? "Clic para expandir menú" : "Clic para contraer menú"}
          role="button"
          tabIndex={0}
        >
          <img 
            src="/logo-fscr.png" 
            alt="Logo FSCR" 
            className="panel-logo-imagen" 
          />
        </div>

        {!colapsado && (
          <div className="panel-logo-texto-grupo">
            <div className="panel-logo-texto" onClick={alAlternarColapso} style={{ cursor: 'pointer' }}>
              <span className="panel-logo-titulo">FSCR S.A.S.</span>
              <span className="panel-logo-subtitulo">
                <ShieldCheck size={14} className="icono-escudo-subtitulo" />
                <span>Control Comparendos</span>
              </span>
            </div>
            {/* Botón chevron superior para colapsar */}
            <button 
              className="panel-toggle-superior-btn"
              onClick={alAlternarColapso}
              title="Contraer menú"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Menú con SOLO 2 Hojas: Control y Seguimiento + Métricas & Dashboard */}
      <nav className="panel-lateral-nav">
        {elementosMenu.map((item) => {
          const Icono = item.icono
          return (
            <button
              key={item.id}
              className={`panel-item-btn ${item.activo ? 'activo' : ''}`}
              onClick={() => alCambiarVista && alCambiarVista(item.id)}
            >
              <div className="panel-item-izq">
                <Icono size={18} className="panel-item-icono" />
                {!colapsado && (
                  <span className="panel-item-etiqueta">{item.titulo}</span>
                )}
              </div>

              {!colapsado && item.conteo !== undefined && (
                <span 
                  className="panel-item-badge-conteo" 
                  style={item.esAlerta ? { backgroundColor: '#f59e0b', color: '#fff', fontWeight: '800', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' } : {}}
                >
                  {item.conteo}
                </span>
              )}

              {/* Etiqueta / Tooltip Flotante al pasar el cursor cuando está contraído */}
              {colapsado && (
                <div className="panel-tooltip-flotante">
                  <span>{item.titulo}</span>
                  {item.conteo !== undefined && (
                    <span 
                      className="panel-tooltip-conteo"
                      style={item.esAlerta ? { backgroundColor: '#f59e0b', color: '#fff' } : {}}
                    >
                      {item.conteo}
                    </span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </nav>

      {/* Pie de Panel: Contraer menú idéntico a la imagen */}
      <div className="panel-lateral-pie">
        <button 
          className="panel-toggle-inferior-btn"
          onClick={alAlternarColapso}
          title={colapsado ? 'Expandir menú' : 'Contraer menú'}
        >
          {colapsado ? (
            <ChevronRight size={18} />
          ) : (
            <>
              <ChevronLeft size={16} />
              <span>Contraer menú</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
