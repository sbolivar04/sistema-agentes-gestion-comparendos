import React from 'react'
import { Wallet, PiggyBank, FileText, Clock, AlertTriangle, Flame, ShieldAlert, CheckCircle } from 'lucide-react'
import { EtiquetaTooltip } from './EtiquetaTooltip'

export function TarjetasKPI({ metricas = {}, alertas = {}, onFiltrarPlacas, onFiltrarEstado }) {
  const formatoMoneda = (val) => {
    return `$ ${Math.round(Number(val || 0)).toLocaleString('es-CO')}`
  }

  const totalComparendos = metricas.total_comparendos ?? 0
  const totalActivos = metricas.total_activos ?? (totalComparendos - (metricas.total_inactivos ?? 0)) ?? 0
  const totalInactivos = metricas.total_inactivos ?? 0

  const manejarFiltroActivo = () => {
    if (onFiltrarEstado) {
      onFiltrarEstado('Activo')
    }
  }

  const manejarFiltroPagado = () => {
    if (onFiltrarEstado) {
      onFiltrarEstado('No activo')
    }
  }

  // Totales de comparendos con descuento
  const totalCon50 = metricas.con_descuento_50 ?? 0
  const totalCon25 = metricas.con_descuento_25 ?? 0

  // Desglose de alertas de vencimiento
  const listaVencimientos = alertas?.alertas_vencimiento || []

  // 50%: Multa más próxima y placas en riesgo (<= 5 días hábiles)
  const vencimientos50 = listaVencimientos.filter(
    (a) => a.tipo_descuento === '50%' && a.dias_habiles_restantes !== undefined
  )
  const minDias50 = vencimientos50.length > 0 
    ? Math.min(...vencimientos50.map((a) => a.dias_habiles_restantes)) 
    : null
  const comparendosRiesgo50 = vencimientos50.filter((a) => a.dias_habiles_restantes <= 8)
  const placasRiesgo50 = [...new Set(comparendosRiesgo50.map((a) => a.placa))]
  const criticosRojos = alertas?.total_en_riesgo_50 ?? comparendosRiesgo50.length

  // 25%: Multa más próxima y placas en riesgo (<= 8 días hábiles)
  const vencimientos25 = listaVencimientos.filter(
    (a) => a.tipo_descuento === '25%' && a.dias_habiles_restantes !== undefined
  )
  const minDias25 = vencimientos25.length > 0 
    ? Math.min(...vencimientos25.map((a) => a.dias_habiles_restantes)) 
    : null
  const comparendosRiesgo25 = vencimientos25.filter((a) => a.dias_habiles_restantes <= 8)
  const placasRiesgo25 = [...new Set(comparendosRiesgo25.map((a) => a.placa))]
  const totalRiesgo25 = alertas?.total_en_riesgo_25 ?? comparendosRiesgo25.length

  const manejarFiltro50 = () => {
    if (criticosRojos === 0 || placasRiesgo50.length === 0) return
    if (onFiltrarPlacas) {
      onFiltrarPlacas(placasRiesgo50.join(', '))
    }
  }

  const manejarFiltro25 = () => {
    if (totalRiesgo25 === 0 || placasRiesgo25.length === 0) return
    if (onFiltrarPlacas) {
      onFiltrarPlacas(placasRiesgo25.join(', '))
    }
  }

  // Métricas financieras desagregadas: Activos vs Consolidado Total Flota
  const ahorroActivo = metricas.ahorro_potencial_activo ?? 0
  const ahorroTotal = metricas.ahorro_potencial_total ?? metricas.total_ahorro_potencial ?? 0
  const ahorroInactivo = metricas.ahorro_potencial_inactivo ?? (ahorroTotal - ahorroActivo)

  const deudaActiva = metricas.deuda_nominal_activa ?? 0
  const deudaTotal = metricas.deuda_nominal_total ?? metricas.monto_total ?? 0
  const deudaInactiva = metricas.deuda_nominal_inactiva ?? (deudaTotal - deudaActiva)

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
          {totalComparendos} <span className="tarjeta-kpi-subtexto">{totalComparendos === 1 ? 'comparendo' : 'comparendos'}</span>
        </div>
        <div className="tarjeta-kpi-chips-fila">
          <EtiquetaTooltip texto="Filtrar en tabla: Solo comparendos activos">
            <button
              type="button"
              className="chip-estado activo"
              onClick={manejarFiltroActivo}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.71rem',
                padding: '0.2rem 0.55rem',
                fontWeight: 700,
                transition: 'all 0.15s ease'
              }}
            >
              {totalActivos} Activos
            </button>
          </EtiquetaTooltip>

          <EtiquetaTooltip texto="Filtrar en tabla: Solo comparendos pagados">
            <button
              type="button"
              className="chip-estado inactivo"
              onClick={manejarFiltroPagado}
              style={{
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.71rem',
                padding: '0.2rem 0.55rem',
                fontWeight: 700,
                transition: 'all 0.15s ease'
              }}
            >
              {totalInactivos} Pagados
            </button>
          </EtiquetaTooltip>
        </div>
      </div>

      {/* 2. Alerta Crítica: Descuento 50% */}
      <div className="tarjeta-kpi peligro">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: 'var(--color-peligro-rojo)' }}>
            Descuento 50%
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-peligro-rojo)', background: 'var(--color-peligro-rojo-suave)' }}>
            <Flame size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {totalCon50} <span className="tarjeta-kpi-subtexto">{totalCon50 === 1 ? 'comparendo' : 'comparendos'}</span>
        </div>
        <div className="tarjeta-kpi-chips-fila" style={{ flexWrap: 'nowrap', gap: '0.45rem', alignItems: 'center' }}>
          <EtiquetaTooltip texto={criticosRojos > 0 ? `Filtrar en tabla: ${placasRiesgo50.join(', ')}` : 'Sin comparendos en riesgo'}>
            <button 
              type="button"
              className="chip-estado" 
              onClick={manejarFiltro50}
              style={{ 
                background: 'var(--color-peligro-rojo-suave)', 
                color: 'var(--color-peligro-rojo)', 
                fontWeight: 700, 
                fontSize: '0.71rem', 
                padding: '0.2rem 0.45rem', 
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: criticosRojos > 0 ? 'pointer' : 'default',
                opacity: criticosRojos > 0 ? 1 : 0.85
              }}
            >
              {criticosRojos} en riesgo
            </button>
          </EtiquetaTooltip>
          <span style={{ color: 'var(--color-peligro-rojo)', fontWeight: 600, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <Clock size={12} />
            {minDias50 !== null ? `Vence en ${minDias50} días` : 'Sin vencer'}
          </span>
        </div>
      </div>

      {/* 3. Alerta Preventiva: Descuento 25% */}
      <div className="tarjeta-kpi alerta advertencia">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: '#b45309' }}>
            Descuento 25%
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: '#b45309', background: 'var(--color-alerta-amarillo-suave)' }}>
            <AlertTriangle size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {totalCon25} <span className="tarjeta-kpi-subtexto">{totalCon25 === 1 ? 'comparendo' : 'comparendos'}</span>
        </div>
        <div className="tarjeta-kpi-chips-fila" style={{ flexWrap: 'nowrap', gap: '0.45rem', alignItems: 'center' }}>
          <EtiquetaTooltip texto={totalRiesgo25 > 0 ? `Filtrar en tabla: ${placasRiesgo25.join(', ')}` : 'Sin comparendos en riesgo'}>
            <button 
              type="button"
              className="chip-estado" 
              onClick={manejarFiltro25}
              style={{ 
                background: 'var(--color-alerta-amarillo-suave)', 
                color: '#b45309', 
                fontWeight: 700, 
                fontSize: '0.71rem', 
                padding: '0.2rem 0.45rem', 
                whiteSpace: 'nowrap',
                border: 'none',
                cursor: totalRiesgo25 > 0 ? 'pointer' : 'default',
                opacity: totalRiesgo25 > 0 ? 1 : 0.85
              }}
            >
              {totalRiesgo25} en riesgo
            </button>
          </EtiquetaTooltip>
          <span style={{ color: '#92400e', fontWeight: 600, fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
            <Clock size={12} />
            {minDias25 !== null ? `Vence en ${minDias25} días` : 'Sin vencer'}
          </span>
        </div>
      </div>

      {/* 4. Ahorro Global */}
      <div className="tarjeta-kpi exito">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo" style={{ color: 'var(--color-exito)' }}>
            Ahorro Global
          </span>
          <div className="tarjeta-kpi-icono" style={{ color: 'var(--color-exito)', background: 'var(--color-exito-suave)' }}>
            <PiggyBank size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor" style={{ color: 'var(--color-exito)' }}>
          {formatoMoneda(ahorroActivo)} <span className="tarjeta-kpi-subtexto" style={{ color: 'var(--color-exito)', opacity: 0.9, fontSize: '0.72rem' }}>en descuentos</span>
        </div>
        <div className="tarjeta-kpi-chips-fila">
          <span className="chip-estado inactivo" title="Ahorro consolidado histórico de la flota">
            Total: {formatoMoneda(ahorroTotal)}
          </span>
        </div>
      </div>

      {/* 5. Deuda Pendiente */}
      <div className="tarjeta-kpi">
        <div className="tarjeta-kpi-cabecera">
          <span className="tarjeta-kpi-titulo">Deuda Pendiente</span>
          <div className="tarjeta-kpi-icono">
            <Wallet size={15} />
          </div>
        </div>
        <div className="tarjeta-kpi-valor">
          {formatoMoneda(deudaActiva)} <span className="tarjeta-kpi-subtexto" style={{ fontSize: '0.72rem' }}>activa</span>
        </div>
        <div className="tarjeta-kpi-chips-fila">
          <span className="chip-estado inactivo" title="Deuda acumulada total de la flota">
            Total: {formatoMoneda(deudaTotal)}
          </span>
        </div>
      </div>
    </div>
  )
}
