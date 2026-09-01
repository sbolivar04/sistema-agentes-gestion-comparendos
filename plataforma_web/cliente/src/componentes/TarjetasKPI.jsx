import React from 'react'
import { DollarSign, PiggyBank, FileText, Clock, AlertTriangle, Flame, ShieldAlert, CheckCircle } from 'lucide-react'

export function TarjetasKPI({ metricas = {}, alertas = {} }) {
  const formatoMoneda = (val) => {
    return `$ ${Number(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }

  const totalComparendos = metricas.total_comparendos || 0
  const totalActivos = metricas.total_activos || 0
  const totalInactivos = metricas.total_inactivos || 0

  // Alertas de vencimiento de descuentos
  const criticosRojos = alertas.total_rojas ?? metricas.con_descuento_50 ?? 0
  const alertasAmarillas = alertas.total_amarillas ?? metricas.con_descuento_25 ?? 0
  const ahorroDisponible = metricas.ahorro_potencial_total || 0
  const deudaNominal = metricas.deuda_nominal_total || 0

  return (
    <div className="grilla-kpis">
      {/* 1. Total Comparendos & Estado Activo / Inactivo */}
      <div className="tarjeta-kpi">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Total Comparendos</span>
          <div className="tarjeta-kpi-icono">
            <FileText size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {totalComparendos} <span className="tarjeta-kpi-subtexto">multas</span>
        </div>
        <div className="tarjeta-kpi-chips-fila">
          <span className="chip-estado activo">
            {totalActivos} Activos
          </span>
          <span className="chip-estado inactivo">
            {totalInactivos} Pagados
          </span>
        </div>
      </div>

      {/* 2. Alerta Crítica: Descuento 50% por perderse (≤ 4 días hábiles) */}
      <div className="tarjeta-kpi peligro">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: 'var(--color-peligro-rojo)' }}>
            Críticos: Desc. 50%
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-peligro-rojo)', background: 'var(--color-peligro-rojo-suave)' }}>
            <Flame size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-peligro-rojo)' }}>
          {criticosRojos} <span className="tarjeta-kpi-subtexto" style={{ color: 'var(--color-peligro-rojo)' }}>en riesgo</span>
        </div>
        <div className="tarjeta-kpi-detalle" style={{ color: '#991b1b', fontWeight: 600 }}>
          <AlertTriangle size={12} />
          <span>Vencen en ≤ 4 días hábiles</span>
        </div>
      </div>

      {/* 3. Alerta Preventiva: Descuento 25% por perderse (5-8 días hábiles) */}
      <div className="tarjeta-kpi alerta">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: 'var(--color-alerta-amarillo)' }}>
            Alerta: Desc. 25%
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-alerta-amarillo)', background: 'var(--color-alerta-amarillo-suave)' }}>
            <Clock size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-alerta-amarillo)' }}>
          {alertasAmarillas} <span className="tarjeta-kpi-subtexto" style={{ color: 'var(--color-alerta-amarillo)' }}>en seguimiento</span>
        </div>
        <div className="tarjeta-kpi-detalle" style={{ color: '#92400e', fontWeight: 600 }}>
          <Clock size={12} />
          <span>Vencen en 5 a 8 días hábiles</span>
        </div>
      </div>

      {/* 4. Ahorro Potencial en Juego Hoy */}
      <div className="tarjeta-kpi exito">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: 'var(--color-exito)' }}>
            Ahorro en Juego
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-exito)', background: 'var(--color-exito-suave)' }}>
            <PiggyBank size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-exito)' }}>
          {formatoMoneda(ahorroDisponible)}
        </div>
        <div className="tarjeta-kpi-detalle" style={{ color: 'var(--color-exito)', fontWeight: 600 }}>
          <CheckCircle size={12} />
          <span>Descuentos vigentes hoy</span>
        </div>
      </div>

      {/* 5. Deuda Nominal Total */}
      <div className="tarjeta-kpi">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Deuda Nominal Bruta</span>
          <div className="tarjeta-kpi-icono">
            <DollarSign size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {formatoMoneda(deudaNominal)}
        </div>
        <div className="tarjeta-kpi-detalle">
          <span>Acumulado sin descuentos</span>
        </div>
      </div>
    </div>
  )
}
