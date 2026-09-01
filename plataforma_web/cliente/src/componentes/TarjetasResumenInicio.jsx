import React from 'react'
import { Car, AlertCircle, AlertTriangle, CheckCircle2, Clock, DollarSign, Flame } from 'lucide-react'

export function TarjetasResumenInicio({ metricas = {}, alertas = {} }) {
  const formatoMoneda = (val) => {
    return `$ ${Number(val || 0).toLocaleString('es-CO')}`
  }

  const totalActivos = metricas.total_activos || metricas.total_comparendos || 0
  const totalCriticos = alertas.total_rojas || metricas.sin_descuento || 0
  const totalAlertas = alertas.total_amarillas || metricas.con_descuento_25 || 0
  const totalOptimizados = metricas.con_descuento_50 || 0
  const ahorroTotal = metricas.ahorro_potencial_total || 0

  return (
    <div className="grilla-resumen-inicio">
      {/* 1. ACTIVOS / DENTRO */}
      <div className="tarjeta-resumen-item azul">
        <div className="tarjeta-resumen-cabecera">
          <span className="tarjeta-resumen-titulo">DENTRO / ACTIVOS</span>
          <div className="tarjeta-resumen-icono azul">
            <Car size={16} />
          </div>
        </div>
        <div className="tarjeta-resumen-cuerpo">
          <span className="tarjeta-resumen-numero">{totalActivos}</span>
          <span className="tarjeta-resumen-etiqueta-sub">vehículos</span>
        </div>
        <div className="tarjeta-resumen-pie">
          <span className="texto-atenuado">Total flota:</span>
          <span className="texto-resaltado">100% activa</span>
        </div>
      </div>

      {/* 2. CRÍTICOS (>5D / ROJOS) */}
      <div className="tarjeta-resumen-item rojo">
        <div className="tarjeta-resumen-cabecera">
          <span className="tarjeta-resumen-titulo rojo">
            <Flame size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-2px' }} />
            CRÍTICOS (&gt;5D)
          </span>
          <div className="tarjeta-resumen-icono rojo">
            <AlertCircle size={16} />
          </div>
        </div>
        <div className="tarjeta-resumen-cuerpo">
          <span className="tarjeta-resumen-numero rojo">{totalCriticos}</span>
          <span className="tarjeta-resumen-etiqueta-sub">urgentes</span>
        </div>
        <div className="tarjeta-resumen-pie">
          <span className="texto-atenuado">Sin justificar:</span>
          <span className="texto-resaltado rojo">{totalCriticos} casos</span>
        </div>
      </div>

      {/* 3. ALERTA (3-5D / AMARILLO) */}
      <div className="tarjeta-resumen-item amarillo">
        <div className="tarjeta-resumen-cabecera">
          <span className="tarjeta-resumen-titulo amarillo">ALERTA (3-5D)</span>
          <div className="tarjeta-resumen-icono amarillo">
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className="tarjeta-resumen-cuerpo">
          <span className="tarjeta-resumen-numero amarillo">{totalAlertas}</span>
          <span className="tarjeta-resumen-etiqueta-sub">preventivos</span>
        </div>
        <div className="tarjeta-resumen-pie">
          <span className="texto-atenuado">Estado:</span>
          <span className="texto-resaltado amarillo">Seguimiento</span>
        </div>
      </div>

      {/* 4. JUSTIFICADOS / CON DESCUENTO */}
      <div className="tarjeta-resumen-item verde">
        <div className="tarjeta-resumen-cabecera">
          <span className="tarjeta-resumen-titulo verde">JUSTIFICADOS / DESC.</span>
          <div className="tarjeta-resumen-icono verde">
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="tarjeta-resumen-cuerpo">
          <span className="tarjeta-resumen-numero verde">{totalOptimizados}</span>
          <span className="tarjeta-resumen-etiqueta-sub">autorizados</span>
        </div>
        <div className="tarjeta-resumen-pie">
          <span className="texto-atenuado">Ahorro disp:</span>
          <span className="texto-resaltado verde">{formatoMoneda(ahorroTotal)}</span>
        </div>
      </div>

      {/* 5. MÁX. DÍAS / DEUDA TOTAL */}
      <div className="tarjeta-resumen-item morado">
        <div className="tarjeta-resumen-cabecera">
          <span className="tarjeta-resumen-titulo morado">MÁX. DÍAS / DEUDA</span>
          <div className="tarjeta-resumen-icono morado">
            <Clock size={16} />
          </div>
        </div>
        <div className="tarjeta-resumen-cuerpo">
          <span className="tarjeta-resumen-numero morado">14</span>
          <span className="tarjeta-resumen-etiqueta-sub">días máx.</span>
        </div>
        <div className="tarjeta-resumen-pie">
          <span className="texto-atenuado">Placa máx:</span>
          <span className="placa-badge-amarilla">KZX-452</span>
        </div>
      </div>
    </div>
  )
}
