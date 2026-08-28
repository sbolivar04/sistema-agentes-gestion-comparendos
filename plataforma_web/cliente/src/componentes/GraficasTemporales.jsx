import React, { useState } from 'react'
import 'chart.js/auto'
import { Bar, Doughnut, Line } from 'react-chartjs-2'
import { BarChart3, PieChart, Calendar } from 'lucide-react'
import { useTema } from '../contexto/ContextoTema'

export function GraficasTemporales({ estadisticas = {} }) {
  const [vistaTemporal, setVistaTemporal] = useState('mes') // 'mes' | 'semana' | 'dia'
  const { esOscuro } = useTema()

  const colorTexto = esOscuro ? '#94a3b8' : '#64748b'
  const colorBorde = esOscuro ? '#334155' : '#e2e8f0'

  // Datos para la serie temporal
  const datosFiltrados = vistaTemporal === 'mes' 
    ? (estadisticas.por_mes || []) 
    : (estadisticas.por_dia || [])

  const etiquetas = datosFiltrados.map(d => d.periodo)
  const cantidades = datosFiltrados.map(d => d.cantidad)
  const montos = datosFiltrados.map(d => d.monto / 1000000) // en Millones COP

  const dataBarras = {
    labels: etiquetas.length > 0 ? etiquetas : ['Sin datos'],
    datasets: [
      {
        label: 'Cantidad de Infracciones',
        data: cantidades.length > 0 ? cantidades : [0],
        backgroundColor: '#0284c7',
        borderRadius: 6,
        yAxisID: 'y'
      },
      {
        label: 'Monto Total (Millones COP)',
        data: montos.length > 0 ? montos : [0],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        type: 'line',
        fill: true,
        tension: 0.35,
        yAxisID: 'y1'
      }
    ]
  }

  const opcionesBarras = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: colorTexto, font: { family: 'Inter', size: 12 } }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || ''
            if (context.dataset.type === 'line') {
              return `${label}: $ ${Number(context.raw * 1000000).toLocaleString('es-CO')} COP`
            }
            return `${label}: ${context.raw} comparendos`
          }
        }
      }
    },
    scales: {
      x: {
        grid: { color: colorBorde },
        ticks: { color: colorTexto }
      },
      y: {
        type: 'linear',
        display: true,
        position: 'left',
        grid: { color: colorBorde },
        ticks: { color: colorTexto, precision: 0 },
        title: { display: true, text: 'N° Infracciones', color: colorTexto }
      },
      y1: {
        type: 'linear',
        display: true,
        position: 'right',
        grid: { drawOnChartArea: false },
        ticks: { color: colorTexto },
        title: { display: true, text: 'Millones COP', color: colorTexto }
      }
    }
  }

  // Datos para la distribución por Secretaría
  const secretarias = (estadisticas.por_secretaria || []).slice(0, 5)
  const dataDoughnut = {
    labels: secretarias.map(s => s.secretaria),
    datasets: [
      {
        data: secretarias.map(s => s.cantidad),
        backgroundColor: [
          '#0284c7',
          '#38bdf8',
          '#0369a1',
          '#64748b',
          '#94a3b8'
        ],
        borderWidth: 2,
        borderColor: esOscuro ? '#111827' : '#ffffff'
      }
    ]
  }

  const opcionesDoughnut = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: colorTexto, font: { family: 'Inter', size: 11 } }
      }
    }
  }

  return (
    <section className="seccion-graficas">
      {/* Gráfica 1: Comportamiento Temporal */}
      <div className="tarjeta-grafica">
        <div className="tarjeta-grafica-cabecera">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} color="var(--color-primario)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Comportamiento Temporal de Comparendos</h3>
          </div>

          <div className="pestañas-grafica">
            <button 
              className={`boton-pestaña ${vistaTemporal === 'mes' ? 'activa' : ''}`}
              onClick={() => setVistaTemporal('mes')}
            >
              Por Mes
            </button>
            <button 
              className={`boton-pestaña ${vistaTemporal === 'dia' ? 'activa' : ''}`}
              onClick={() => setVistaTemporal('dia')}
            >
              Por Día
            </button>
          </div>
        </div>

        <div style={{ height: '280px', position: 'relative' }}>
          <Bar data={dataBarras} options={opcionesBarras} />
        </div>
      </div>

      {/* Gráfica 2: Distribución por Secretaría */}
      <div className="tarjeta-grafica">
        <div className="tarjeta-grafica-cabecera">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <PieChart size={20} color="var(--color-primario)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Top Secretarías</h3>
          </div>
        </div>

        <div style={{ height: '280px', position: 'relative' }}>
          {secretarias.length > 0 ? (
            <Doughnut data={dataDoughnut} options={opcionesDoughnut} />
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--texto-atenuado)', paddingTop: '100px' }}>
              No hay datos registrados
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
