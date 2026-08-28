import React from 'react'
import { DollarSign, TrendingDown, PiggyBank, FileText, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

export function TarjetasKPI({ metricas = {} }) {
  const formatoMoneda = (val) => {
    return `$ ${Number(val || 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`
  }

  return (
    <div className="grilla-kpis">
      {/* 1. Deuda Nominal Bruta */}
      <div className="tarjeta-kpi">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Deuda Nominal Bruta</span>
          <div className="tarjeta-kpi-icono">
            <DollarSign size={20} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {formatoMoneda(metricas.deuda_nominal_total)}
        </div>
        <div className="tarjeta-kpi-detalle">
          <span>Total acumulado sin descuentos en SIMIT</span>
        </div>
      </div>

      {/* 2. Deuda Optimizada */}
      <div className="tarjeta-kpi exito">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Deuda Optimizada</span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-exito)', background: 'var(--color-exito-suave)' }}>
            <TrendingDown size={20} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-exito)' }}>
          {formatoMoneda(metricas.deuda_optimizada_total)}
        </div>
        <div className="tarjeta-kpi-detalle">
          <span>Pagando con los descuentos del 50% y 25%</span>
        </div>
      </div>

      {/* 3. Ahorro Potencial Total */}
      <div className="tarjeta-kpi exito">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Ahorro Disponible</span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-exito)', background: 'var(--color-exito-suave)' }}>
            <PiggyBank size={20} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-exito)' }}>
          {formatoMoneda(metricas.ahorro_potencial_total)}
        </div>
        <div className="tarjeta-kpi-detalle">
          <span style={{ fontWeight: 600, color: 'var(--color-exito)' }}>
            Dinero que la empresa ahorra pagando a tiempo
          </span>
        </div>
      </div>

      {/* 4. Total de Comparendos y Estado */}
      <div className="tarjeta-kpi">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Comparendos Flota</span>
          <div className="tarjeta-kpi-icono">
            <FileText size={20} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {metricas.total_comparendos || 0}
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
          <span className="chip-estado activo">
            {metricas.total_activos || 0} Activos
          </span>
          <span className="chip-estado inactivo">
            {metricas.total_inactivos || 0} Inactivos / Pagados
          </span>
        </div>
      </div>

      {/* 5. Desglose de Descuentos Vigentes */}
      <div className="tarjeta-kpi alerta">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Descuentos Vigentes</span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-alerta-amarillo)', background: 'var(--color-alerta-amarillo-suave)' }}>
            <Clock size={20} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
          <span className="chip-descuento d50">
            50%: {metricas.con_descuento_50 || 0} multas
          </span>
          <span className="chip-descuento d25">
            25%: {metricas.con_descuento_25 || 0} multas
          </span>
          <span className="chip-descuento sin">
            Sin Desc: {metricas.sin_descuento || 0} multas
          </span>
        </div>
        <div className="tarjeta-kpi-detalle" style={{ marginTop: '0.6rem' }}>
          <span>Términos legales según Ley 769 y 1843</span>
        </div>
      </div>
    </div>
  )
}
