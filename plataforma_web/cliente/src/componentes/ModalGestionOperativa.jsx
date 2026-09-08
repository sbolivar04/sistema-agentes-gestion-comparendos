import React, { useState, useEffect } from 'react'
import { 
  X, 
  CheckCircle2, 
  Clock, 
  UploadCloud, 
  FileText, 
  Image as ImageIcon, 
  Eye, 
  Download, 
  Trash2, 
  UserCheck, 
  CreditCard, 
  ShieldCheck, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Save, 
  Building2,
  User,
  Users,
  Briefcase,
  DollarSign,
  Calendar,
  Check,
  Receipt,
  FileCheck2,
  Paperclip,
  Mail,
  Lock
} from 'lucide-react'
import { SelectorDesplegable } from './SelectorDesplegable'
import { SelectorFecha } from './SelectorFecha'
import { VisorSoporte } from './VisorSoporte'
import { EtiquetaTooltip } from './EtiquetaTooltip'

// Opciones corporativas para la distribución de la responsabilidad del pago
const OPCIONES_DISTRIBUCION_PAGO = [
  { valor: '100_conductor', etiqueta: '100% Conductor', icono: User },
  { valor: '50_50', etiqueta: '50% Empresa • 50% Conductor', icono: Users },
  { valor: '100_empresa', etiqueta: '100% Empresa', icono: Building2 },
  { valor: '100_cliente', etiqueta: '100% Cliente', icono: Briefcase }
]

// Opciones de canal de recaudo para el pago
const OPCIONES_CANAL_PAGO = [
  { valor: 'pse_simit', etiqueta: 'Pasarela PSE - Portal SIMIT' },
  { valor: 'banco_occidente', etiqueta: 'Banco de Occidente' },
  { valor: 'banco_popular', etiqueta: 'Banco Popular' },
  { valor: 'banco_bogota', etiqueta: 'Banco de Bogotá' },
  { valor: 'corresponsal', etiqueta: 'Efecty / Baloto / Corresponsal' },
  { valor: 'secretaria_directo', etiqueta: 'Taquilla Directa Secretaría Tránsito' }
]

/**
 * Formatea un número de cédula de ciudadanía aceptando únicamente dígitos numéricos
 * y aplicando separadores de miles con punto (ej. 1.020.450.890).
 */
function formatearDocumentoMiles(valor) {
  if (!valor) return ''
  // Eliminar cualquier carácter que no sea dígito numérico (0-9)
  const soloDigitos = String(valor).replace(/\D/g, '')
  if (!soloDigitos) return ''
  // Aplicar separador de miles con punto
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Formatea un monto en pesos colombianos aceptando únicamente dígitos numéricos
 * y aplicando separadores de miles con punto (ej. 260.000, 1.500.000).
 */
function formatearMonedaMiles(valor) {
  if (!valor && valor !== 0) return ''
  // Extraer únicamente los dígitos numéricos
  const soloDigitos = String(valor).replace(/\D/g, '')
  if (!soloDigitos) return ''
  // Aplicar separador de miles con punto estándar colombiano
  return soloDigitos.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Convierte una fecha en formato YYYY-MM-DD a formato visual colombiano DD/MM/AAAA.
 */
function formatearFechaVisual(strFecha) {
  if (!strFecha || typeof strFecha !== 'string') return 'No registrada'
  if (strFecha.includes('/')) return strFecha
  const partes = strFecha.split('-')
  if (partes.length === 3) {
    const [ano, mes, dia] = partes
    if (ano.length === 4) {
      return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`
    }
  }
  return strFecha
}

/**
 * Componente ModalGestionOperativa
 * Formulario de flujo operacional paso a paso con diseño premium de 2 columnas paralelas.
 */
export function ModalGestionOperativa({ comparendo, alCerrar, alActualizarGestion }) {
  // Fase activa del stepper (1: Asignación, 2: Pago, 3: Descargue SIMIT)
  const [faseActual, setFaseActual] = useState(1)

  // Datos de la Fase 1: Asignación y Autorizaciones
  const [responsableNombre, setResponsableNombre] = useState('')
  const [responsableDocumento, setResponsableDocumento] = useState('')
  const [distribucionPago, setDistribucionPago] = useState('100_conductor')
  const [observacionesAsignacion, setObservacionesAsignacion] = useState('')
  const [soporteCorreo, setSoporteCorreo] = useState(null)
  const [soporteFirma, setSoporteFirma] = useState(null)

  // Datos de la Fase 2: Pago y Facturación
  const [valorPagado, setValorPagado] = useState('')
  const [fechaPago, setFechaPago] = useState('')
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [canalPago, setCanalPago] = useState('pse_simit')
  const [soporteFactura, setSoporteFactura] = useState(null)
  const [soporteCursoVial, setSoporteCursoVial] = useState(null)
  const [observacionesPago, setObservacionesPago] = useState('')

  // Datos de la Fase 3: Descargue SIMIT
  const [confirmadoDescargueSimit, setConfirmadoDescargueSimit] = useState(false)
  const [fechaConfirmacionSimit, setFechaConfirmacionSimit] = useState('')

  // Visor Lightbox y alertas
  const [soporteEnVisor, setSoporteEnVisor] = useState(null)
  const [guardadoExitoso, setGuardadoExitoso] = useState(false)

  // Validación estricta del Paso 1: todos los campos obligatorios (*) y los 2 soportes requeridos cargados
  const fase1Completa = Boolean(
    responsableNombre && 
    responsableNombre.trim().length > 0 && 
    responsableDocumento && 
    responsableDocumento.replace(/\D/g, '').length > 0 && 
    distribucionPago && 
    soporteCorreo && 
    soporteFirma
  )

  // Validación del Paso 2: valor pagado, fecha de pago y soporte de factura/recibo oficial adjunto
  const fase2Completa = Boolean(
    fase1Completa &&
    valorPagado && 
    Number(String(valorPagado).replace(/\D/g, '')) > 0 && 
    fechaPago && 
    soporteFactura
  )

  // Verificación automática de comparendo descargado / paz y salvo oficial en SIMIT
  const esDescargadoSimit = Boolean(
    comparendo?.estado_simit === 'No activo' || 
    comparendo?.estado_simit === 'Pagado' || 
    confirmadoDescargueSimit
  )

  // Inicializar valor a pagar por defecto y cargar datos guardados en localStorage
  useEffect(() => {
    if (!comparendo?.id) return

    // Valor predeterminado si no se ha guardado uno
    if (comparendo.valor_a_pagar) {
      setValorPagado(formatearMonedaMiles(Math.round(Number(comparendo.valor_a_pagar))))
    }

    const claveStorage = `gestion_operativa_${comparendo.id}`
    try {
      const datosGuardados = localStorage.getItem(claveStorage)
      if (datosGuardados) {
        const parsed = JSON.parse(datosGuardados)
        const paso1GuardadoCompleto = Boolean(
          parsed.responsableNombre?.trim() &&
          parsed.responsableDocumento &&
          parsed.distribucionPago &&
          parsed.soporteCorreo &&
          parsed.soporteFirma
        )
        if (parsed.faseActual && paso1GuardadoCompleto) {
          setFaseActual(parsed.faseActual)
        } else {
          setFaseActual(1)
        }
        if (parsed.responsableNombre) setResponsableNombre(parsed.responsableNombre.trim())
        if (parsed.responsableDocumento) setResponsableDocumento(formatearDocumentoMiles(parsed.responsableDocumento))
        if (parsed.distribucionPago) setDistribucionPago(parsed.distribucionPago)
        if (parsed.observacionesAsignacion) setObservacionesAsignacion(parsed.observacionesAsignacion)
        if (parsed.soporteCorreo) setSoporteCorreo(parsed.soporteCorreo)
        if (parsed.soporteFirma) setSoporteFirma(parsed.soporteFirma)
        if (parsed.valorPagado) setValorPagado(formatearMonedaMiles(parsed.valorPagado))
        if (parsed.fechaPago) setFechaPago(parsed.fechaPago)
        if (parsed.numeroComprobante) setNumeroComprobante(parsed.numeroComprobante)
        if (parsed.canalPago) setCanalPago(parsed.canalPago)
        if (parsed.soporteFactura) setSoporteFactura(parsed.soporteFactura)
        if (parsed.soporteCursoVial) setSoporteCursoVial(parsed.soporteCursoVial)
        if (parsed.observacionesPago) setObservacionesPago(parsed.observacionesPago)
        if (parsed.confirmadoDescargueSimit) setConfirmadoDescargueSimit(parsed.confirmadoDescargueSimit)
        if (parsed.fechaConfirmacionSimit) setFechaConfirmacionSimit(parsed.fechaConfirmacionSimit)
      }
    } catch (e) {
      console.warn('Error al leer datos previos de gestión:', e)
    }
  }, [comparendo])

  // Cerrar al presionar Escape si el visor no está abierto
  useEffect(() => {
    const manejarTeclaEscape = (e) => {
      if (e.key === 'Escape' && !soporteEnVisor) {
        alCerrar()
      }
    }
    window.addEventListener('keydown', manejarTeclaEscape)
    return () => window.removeEventListener('keydown', manejarTeclaEscape)
  }, [alCerrar, soporteEnVisor])

  if (!comparendo) return null

  // Procesar carga de archivo a DataURL
  const manejarSubidaArchivo = (e, tipoSoporte) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    const lector = new FileReader()
    lector.onload = () => {
      const nuevoSoporte = {
        id: `soporte_${Date.now()}`,
        nombre: archivo.name,
        tipo: archivo.type.includes('pdf') || archivo.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'imagen',
        tamano: `${(archivo.size / 1024).toFixed(1)} KB`,
        fechaCarga: new Date().toLocaleDateString('es-CO'),
        url: lector.result
      }

      if (tipoSoporte === 'correo') setSoporteCorreo(nuevoSoporte)
      if (tipoSoporte === 'firma') setSoporteFirma(nuevoSoporte)
      if (tipoSoporte === 'factura') setSoporteFactura(nuevoSoporte)
      if (tipoSoporte === 'curso') setSoporteCursoVial(nuevoSoporte)
    }
    lector.readAsDataURL(archivo)
  }

  // Manejar cambio en el número de documento: solo acepta dígitos y aplica separador de miles
  const manejarCambioDocumento = (e) => {
    const documentoFormateado = formatearDocumentoMiles(e.target.value)
    setResponsableDocumento(documentoFormateado)
  }

  // Manejar cambio en el valor pagado: solo acepta dígitos numéricos y aplica separador de miles en pesos
  const manejarCambioValorPagado = (e) => {
    const valorFormateado = formatearMonedaMiles(e.target.value)
    setValorPagado(valorFormateado)
  }

  // Guardar estado actual en localStorage
  const guardarAvance = (nuevaFase = null, simitConfirmado = null, fechaSimit = null) => {
    const faseAGuardar = nuevaFase !== null ? nuevaFase : faseActual
    const esConfirmadoSimit = simitConfirmado !== null ? simitConfirmado : confirmadoDescargueSimit
    const strFechaSimit = fechaSimit !== null ? fechaSimit : fechaConfirmacionSimit
    const claveStorage = `gestion_operativa_${comparendo.id}`

    // Eliminar espacios en blanco al inicio y al final del nombre del responsable
    const nombreLimpio = responsableNombre ? responsableNombre.trim() : ''
    // Asegurar que la cédula contenga únicamente dígitos con separador de miles
    const documentoLimpio = formatearDocumentoMiles(responsableDocumento)
    // Asegurar que el monto contenga separadores de miles estándar
    const valorLimpio = formatearMonedaMiles(valorPagado)

    setResponsableNombre(nombreLimpio)
    setResponsableDocumento(documentoLimpio)
    setValorPagado(valorLimpio)

    // Determinar el subestado operativo actual
    let subestadoCodigo = 'identificacion'
    let subestadoTexto = 'Fase 1: En Asignación de Responsable'

    if (esDescargadoSimit) {
      subestadoCodigo = 'descargado_paz_y_salvo'
      subestadoTexto = 'Paz y Salvo • Descargado SIMIT'
    } else if (faseAGuardar === 3) {
      // El Paso 3 es para indicar que ya se pagó físicamente y se espera el descargue del SIMIT
      subestadoCodigo = 'pagado_esperando_descargue'
      subestadoTexto = 'Pagado • Esperando Descargue SIMIT'
    } else if (faseAGuardar === 2) {
      // En el Paso 2 permanece estrictamente en trámite de pago
      subestadoCodigo = 'pendiente_pago'
      subestadoTexto = 'Fase 2: En Trámite de Pago'
    } else if (nombreLimpio && (soporteCorreo || soporteFirma)) {
      subestadoCodigo = 'revision_aprobacion'
      subestadoTexto = 'Fase 1: En Revisión de Firmas'
    } else if (nombreLimpio || documentoLimpio || distribucionPago) {
      subestadoCodigo = 'identificacion'
      subestadoTexto = 'Fase 1: En Asignación de Responsable'
    }

    const payload = {
      comparendoId: comparendo.id,
      faseActual: faseAGuardar,
      paso1Completo: fase1Completa,
      paso2Completo: fase2Completa,
      subestadoCodigo,
      subestadoTexto,
      responsableNombre: nombreLimpio,
      responsableDocumento: documentoLimpio,
      distribucionPago,
      observacionesAsignacion,
      soporteCorreo,
      soporteFirma,
      valorPagado,
      fechaPago,
      numeroComprobante,
      canalPago,
      soporteFactura,
      soporteCursoVial,
      observacionesPago,
      confirmadoDescargueSimit: esConfirmadoSimit,
      fechaConfirmacionSimit: strFechaSimit,
      ultimaActualizacion: new Date().toISOString()
    }

    try {
      localStorage.setItem(claveStorage, JSON.stringify(payload))
      setGuardadoExitoso(true)
      setTimeout(() => setGuardadoExitoso(false), 2500)
      if (alActualizarGestion) {
        alActualizarGestion(comparendo.id, payload)
      }
    } catch (e) {
      console.error('Error al guardar gestión operativa:', e)
    }
  }

  const navegarAPaso = (pasoDestino) => {
    if (pasoDestino === 1) {
      setFaseActual(1)
      guardarAvance(1)
      return
    }
    if (pasoDestino === 2) {
      if (!fase1Completa) return
      setFaseActual(2)
      guardarAvance(2)
      return
    }
    if (pasoDestino === 3) {
      if (!fase1Completa || !fase2Completa) return
      setFaseActual(3)
      guardarAvance(3)
      return
    }
  }

  const avanzarFase = () => {
    if (faseActual === 1 && !fase1Completa) return
    if (faseActual === 2 && !fase2Completa) return
    const siguiente = Math.min(faseActual + 1, 3)
    setFaseActual(siguiente)
    guardarAvance(siguiente)
  }

  const retrocederFase = () => {
    const anterior = Math.max(faseActual - 1, 1)
    setFaseActual(anterior)
    guardarAvance(anterior)
  }

  const finalizarGestionOperativa = () => {
    guardarAvance(3)
    alCerrar()
  }

  // Obtener etiqueta de subestado actual para el badge superior del modal
  const obtenerBadgeSubestado = () => {
    if (esDescargadoSimit) {
      return {
        texto: 'Paz y Salvo • Descargado SIMIT',
        clase: 'descargado_paz_y_salvo',
        icono: ShieldCheck
      }
    }
    // Paso 3: ya se pagó físicamente en el Paso 2 y se está esperando el descargue oficial en SIMIT
    if (faseActual === 3) {
      return {
        texto: 'Pagado • Esperando Descargue SIMIT',
        clase: 'pagado_esperando_descargue',
        icono: Clock
      }
    }
    // Paso 2: estrictamente en trámite de pago y facturación
    if (faseActual === 2) {
      return {
        texto: 'En Trámite de Pago',
        clase: 'pendiente_pago',
        icono: CreditCard
      }
    }
    // Paso 1: en revisión de firmas o en asignación de responsable
    if (responsableNombre && (soporteCorreo || soporteFirma)) {
      return {
        texto: 'En Revisión de Firmas',
        clase: 'revision_aprobacion',
        icono: UserCheck
      }
    }
    if (responsableNombre || responsableDocumento || distribucionPago) {
      return {
        texto: 'En Asignación',
        clase: 'identificacion',
        icono: AlertCircle
      }
    }
    return {
      texto: 'Pendiente Identificación',
      clase: 'identificacion',
      icono: AlertCircle
    }
  }

  const badgeActual = obtenerBadgeSubestado()
  const IconoBadge = badgeActual.icono

  // Renderizar slot de soporte minimalista y compacto
  const renderizarSlotSoporteMinimalista = ({
    titulo,
    subtitulo,
    icono: IconoSlot,
    esObligatorio = true,
    soporte,
    tipoSoporte,
    alSubir,
    alEliminar
  }) => {
    return (
      <div className={`slot-soporte-minimalista ${soporte ? 'adjuntado' : ''}`}>
        <div className="slot-soporte-izq">
          <div className={`slot-soporte-icono ${soporte ? 'adjuntado' : ''}`}>
            {soporte ? <CheckCircle2 size={16} /> : <IconoSlot size={16} />}
          </div>
          <div className="slot-soporte-textos">
            <div className="slot-soporte-titulo-fila">
              <span className="slot-soporte-titulo">{titulo}</span>
              {esObligatorio ? (
                <EtiquetaTooltip texto="Documento obligatorio para este trámite" posicion="arriba">
                  <span className="badge-requerido-mini">Obligatorio</span>
                </EtiquetaTooltip>
              ) : (
                <EtiquetaTooltip texto="Documento de soporte opcional" posicion="arriba">
                  <span className="badge-opcional-mini">Opcional</span>
                </EtiquetaTooltip>
              )}
            </div>
            <EtiquetaTooltip 
              texto={soporte ? `${soporte.nombre} • ${soporte.tamano}` : subtitulo} 
              posicion="arriba" 
              soloSiTruncado={true}
              className="slot-soporte-tooltip-subtitulo"
            >
              <span className="slot-soporte-subtitulo">
                {soporte ? `${soporte.nombre} • ${soporte.tamano}` : subtitulo}
              </span>
            </EtiquetaTooltip>
          </div>
        </div>

        <div className="slot-soporte-der">
          {soporte ? (
            <div className="slot-soporte-acciones">
              <EtiquetaTooltip texto="Visualizar documento en pantalla completa" posicion="arriba">
                <button 
                  type="button" 
                  className="boton-mini-soporte"
                  onClick={() => setSoporteEnVisor(soporte)}
                >
                  <Eye size={13} />
                  <span>Ver</span>
                </button>
              </EtiquetaTooltip>

              <EtiquetaTooltip texto="Descargar archivo al equipo" posicion="arriba">
                <a 
                  href={soporte.url} 
                  download={soporte.nombre}
                  className="boton-mini-soporte"
                >
                  <Download size={13} />
                </a>
              </EtiquetaTooltip>

              <EtiquetaTooltip texto="Eliminar documento adjunto" posicion="arriba">
                <button 
                  type="button" 
                  className="boton-mini-soporte eliminar"
                  onClick={alEliminar}
                >
                  <Trash2 size={13} />
                </button>
              </EtiquetaTooltip>
            </div>
          ) : (
            <EtiquetaTooltip texto="Adjuntar soporte en formato PDF o Imagen" posicion="arriba">
              <label className="boton-adjuntar-minimalista">
                <input 
                  type="file" 
                  accept="image/*,.pdf" 
                  onChange={(e) => alSubir(e, tipoSoporte)}
                  style={{ display: 'none' }}
                />
                <Paperclip size={13} />
                <span>Adjuntar</span>
              </label>
            </EtiquetaTooltip>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="modal-fondo" onClick={alCerrar}>
        <div 
          className="modal-caja-gestion-operativa" 
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          {/* ============================================================
              CABECERA CORPORATIVA CON PLACA, SUBESTADO Y CIERRE
             ============================================================ */}
          <div className="modal-gestion-cabecera">
            {/* Lado Izquierdo: Placa, Título y Metadatos de Auditoría */}
            <div className="modal-gestion-cabecera-izq">
              <EtiquetaTooltip texto={`Vehículo placa ${comparendo.placa}`} posicion="abajo">
                <span className="placa-badge cabecera-placa-destacada">
                  {comparendo.placa}
                </span>
              </EtiquetaTooltip>

              <div className="modal-gestion-cabecera-titulos">
                <h3 className="modal-gestion-titulo-principal">
                  Gestión Operativa de Comparendo
                </h3>

                <div className="modal-gestion-subtitulo">
                  <span className="meta-dato-cabecera">
                    <span className="meta-etiqueta-cabecera">Comparendo N°</span>
                    <strong className="meta-valor-cabecera mono">{comparendo.numero_comparendo || 'S/N'}</strong>
                  </span>
                  <span className="meta-punto-separador">•</span>
                  <span className="meta-dato-cabecera">
                    <span className="meta-etiqueta-cabecera">Infracción</span>
                    <strong className="meta-valor-cabecera infraccion-chip">{comparendo.codigo_infraccion || 'N/A'}</strong>
                  </span>
                  {comparendo.secretaria && (
                    <>
                      <span className="meta-punto-separador">•</span>
                      <span className="meta-dato-cabecera">
                        <span className="meta-etiqueta-cabecera">Organismo</span>
                        <span className="meta-valor-cabecera">{comparendo.secretaria}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Lado Derecho: Badge de Subestado Operativo y Botón Cerrar */}
            <div className="modal-gestion-cabecera-der">
              <EtiquetaTooltip texto={`Subestado operativo actual: ${badgeActual.texto}`} posicion="abajo">
                <span className={`badge-subestado-operativo ${badgeActual.clase}`}>
                  <IconoBadge size={13} />
                  <span>{badgeActual.texto}</span>
                </span>
              </EtiquetaTooltip>

              <EtiquetaTooltip texto="Cerrar ventana" posicion="abajo">
                <button 
                  type="button" 
                  className="boton-icono cabecera-boton-cerrar" 
                  onClick={alCerrar}
                  aria-label="Cerrar modal"
                >
                  <X size={17} />
                </button>
              </EtiquetaTooltip>
            </div>
          </div>

          {/* ============================================================
              STEPPER INTERACTIVO DE 3 FASES CORPORATIVO
             ============================================================ */}
          <div className="modal-gestion-stepper">
            {/* Paso 1 */}
            <EtiquetaTooltip texto="Paso 1: Asignación de responsable y autorizaciones de descuento" posicion="abajo">
              <button 
                type="button"
                className={`stepper-paso-item ${faseActual === 1 ? 'activo' : ''} ${fase1Completa && faseActual !== 1 ? 'completado' : ''}`}
                onClick={() => navegarAPaso(1)}
              >
                <div className="stepper-icono-circulo">
                  {fase1Completa && faseActual !== 1 ? <Check size={16} /> : '1'}
                </div>
                <div className="stepper-textos">
                  <span className="stepper-paso-numero">Paso 1</span>
                  <span className="stepper-paso-titulo">Asignación y Firmas</span>
                </div>
              </button>
            </EtiquetaTooltip>

            <div className={`stepper-conector ${fase1Completa ? 'completado' : ''}`} />

            {/* Paso 2 */}
            <EtiquetaTooltip 
              texto={
                !fase1Completa 
                  ? "Bloqueado: Complete los campos obligatorios (*) y adjunte los 2 soportes requeridos en el Paso 1" 
                  : "Paso 2: Registro de valor pagado, fecha de pago y soporte de factura"
              } 
              posicion="abajo"
            >
              <button 
                type="button"
                className={`stepper-paso-item ${faseActual === 2 ? 'activo' : ''} ${fase2Completa && faseActual !== 2 ? 'completado' : ''} ${!fase1Completa ? 'bloqueado' : ''}`}
                disabled={!fase1Completa}
                onClick={() => navegarAPaso(2)}
              >
                <div className="stepper-icono-circulo">
                  {!fase1Completa ? <Lock size={12} /> : (fase2Completa && faseActual !== 2 ? <Check size={16} /> : '2')}
                </div>
                <div className="stepper-textos">
                  <span className="stepper-paso-numero">Paso 2</span>
                  <span className="stepper-paso-titulo">Pago y Facturación</span>
                </div>
              </button>
            </EtiquetaTooltip>

            <div className={`stepper-conector ${fase2Completa ? 'completado' : ''}`} />

            {/* Paso 3 */}
            <EtiquetaTooltip 
              texto={
                !fase1Completa 
                  ? "Bloqueado: Debe completar primero el Paso 1" 
                  : (!fase2Completa 
                      ? "Bloqueado: Ingrese el valor pagado, la fecha de pago y adjunte la factura en el Paso 2" 
                      : (esDescargadoSimit
                          ? "Paso 3: Paz y Salvo oficial descargado en SIMIT" 
                          : "Paso 3: Comparendo pagado • Esperando descargue en SIMIT"))
              } 
              posicion="abajo"
            >
              <button 
                type="button"
                className={`stepper-paso-item ${faseActual === 3 ? 'activo' : ''} ${esDescargadoSimit ? 'completado' : ''} ${(!fase1Completa || !fase2Completa) ? 'bloqueado' : ''}`}
                disabled={!fase1Completa || !fase2Completa}
                onClick={() => navegarAPaso(3)}
              >
                <div className="stepper-icono-circulo">
                  {(!fase1Completa || !fase2Completa) ? <Lock size={12} /> : (esDescargadoSimit ? <Check size={16} /> : '3')}
                </div>
                <div className="stepper-textos">
                  <span className="stepper-paso-numero">Paso 3</span>
                  <span className="stepper-paso-titulo">Descargue SIMIT</span>
                </div>
              </button>
            </EtiquetaTooltip>
          </div>

          {/* ============================================================
              CUERPO DEL FORMULARIO CON GRILLA PARALELA DE 2 COLUMNAS
             ============================================================ */}
          <div className="modal-gestion-cuerpo">
            {/* ------------------------------------------------------------
                FASE 1: ASIGNACIÓN Y FIRMAS DE RESPONSABILIDAD
               ------------------------------------------------------------ */}
            {faseActual === 1 && (
              <div className="seccion-formulario-operativo">
                <div className="grid-formulario-2cols-gestion">
                  {/* Columna Izquierda: Formulario de Datos del Responsable */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <UserCheck size={18} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Identificación y Asignación</h4>
                        <p className="subtitulo-cabecera-tarjeta">Responsable de la infracción y asignación del pago</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo">
                      {/* Fila 1: Nombre y Cédula lado a lado */}
                      <div className="grid-campos-2cols">
                        <div className="campo-grupo-corporativo">
                          <label htmlFor="responsable-nombre">
                            <User size={13} />
                            <span>Nombre del Responsable *</span>
                          </label>
                          <input 
                            id="responsable-nombre"
                            type="text"
                            className="campo-input-corporativo"
                            placeholder="Ej. Carlos Andrés Mendoza"
                            value={responsableNombre}
                            onChange={(e) => setResponsableNombre(e.target.value)}
                            onBlur={() => setResponsableNombre(prev => prev.trim())}
                          />
                        </div>

                        <div className="campo-grupo-corporativo">
                          <label htmlFor="responsable-documento">
                            <Briefcase size={13} />
                            <span>N° Cédula de Ciudadanía *</span>
                          </label>
                          <input 
                            id="responsable-documento"
                            type="text"
                            inputMode="numeric"
                            className="campo-input-corporativo"
                            placeholder="Ej. 1.020.450.890"
                            value={responsableDocumento}
                            onChange={manejarCambioDocumento}
                          />
                        </div>
                      </div>

                      {/* Fila 2: Selector de Asignación */}
                      <div className="campo-grupo-corporativo" style={{ marginTop: '0.35rem' }}>
                        <label>
                          <DollarSign size={13} />
                          <span>¿A quién se asigna el pago del comparendo? *</span>
                        </label>
                        <SelectorDesplegable 
                          opciones={OPCIONES_DISTRIBUCION_PAGO}
                          valor={distribucionPago}
                          alCambiar={(val) => setDistribucionPago(val)}
                          anchoMinimo="100%"
                          tamano="compacto"
                        />
                      </div>

                      {/* Fila 3: Observaciones */}
                      <div className="campo-grupo-corporativo" style={{ marginTop: '0.35rem' }}>
                        <label htmlFor="observaciones-asignacion">
                          <span>Observaciones o acuerdos internos (Opcional)</span>
                        </label>
                        <textarea 
                          id="observaciones-asignacion"
                          className="campo-input-corporativo textarea-corporativo"
                          placeholder="Indique acuerdos específicos con nómina, conductor o cliente..."
                          rows={2}
                          value={observacionesAsignacion}
                          onChange={(e) => setObservacionesAsignacion(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Soportes Documentales Minimalistas */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <FileCheck2 size={16} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Autorizaciones y Firmas</h4>
                        <p className="subtitulo-cabecera-tarjeta">Adjunte los documentos requeridos en PDF o imagen</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo lista-soportes-minimalista">
                      {/* Slot 1: Aprobación por Correo */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Aprobación por Correo',
                        subtitulo: 'Captura o PDF del visto bueno de la gerencia',
                        icono: Mail,
                        esObligatorio: true,
                        soporte: soporteCorreo,
                        tipoSoporte: 'correo',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteCorreo(null)
                      })}

                      {/* Slot 2: Descuento en Blanco */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Descuento en Blanco',
                        subtitulo: 'Formato físico firmado por el conductor o responsable',
                        icono: FileText,
                        esObligatorio: true,
                        soporte: soporteFirma,
                        tipoSoporte: 'firma',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteFirma(null)
                      })}

                      <div className="nota-pie-soportes">
                        <span>Formatos admitidos: PDF, JPG, PNG (máximo 10 MB)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------
                FASE 2: REGISTRO DE PAGO, FACTURA Y CURSO VIAL
               ------------------------------------------------------------ */}
            {faseActual === 2 && (
              <div className="seccion-formulario-operativo">
                <div className="grid-formulario-2cols-gestion">
                  {/* Columna Izquierda: Datos del Pago */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <CreditCard size={18} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Registro del Pago</h4>
                        <p className="subtitulo-cabecera-tarjeta">Monto cancelado y fecha de la transacción</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo">
                      {/* Fila única: Valor Pagado y Fecha de Pago */}
                      <div className="grid-campos-2cols">
                        <div className="campo-grupo-corporativo">
                          <label htmlFor="valor-pagado">
                            <DollarSign size={13} />
                            <span>Valor Pagado *</span>
                          </label>
                          <div className="campo-input-moneda-wrapper">
                            <span className="prefijo-moneda-colombia" aria-hidden="true">$</span>
                            <input 
                              id="valor-pagado"
                              type="text"
                              inputMode="numeric"
                              className="campo-input-corporativo campo-input-con-moneda"
                              placeholder="Ej. 260.000"
                              value={valorPagado}
                              onChange={manejarCambioValorPagado}
                            />
                          </div>
                        </div>

                        <div className="campo-grupo-corporativo">
                          <label htmlFor="fecha-pago">
                            <Calendar size={13} />
                            <span>Fecha de Pago *</span>
                          </label>
                          <SelectorFecha 
                            id="fecha-pago"
                            valor={fechaPago}
                            alCambiar={(nuevaFecha) => setFechaPago(nuevaFecha)}
                            placeholder="Seleccionar fecha de pago..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Columna Derecha: Soportes de Factura y Curso Pedagógico Minimalistas */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <FileCheck2 size={16} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Comprobantes Oficiales</h4>
                        <p className="subtitulo-cabecera-tarjeta">Recibo bancario emitido y certificado del curso</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo lista-soportes-minimalista">
                      {/* Slot 1: Factura / Recibo Oficial */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura / Recibo Oficial',
                        subtitulo: 'Comprobante bancario o recibo del organismo de tránsito',
                        icono: Receipt,
                        esObligatorio: true,
                        soporte: soporteFactura,
                        tipoSoporte: 'factura',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteFactura(null)
                      })}

                      {/* Slot 2: Curso Pedagógico CIA */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Certificado de Curso CIA',
                        subtitulo: 'Requerido si se aplicó descuento del 50% o 25%',
                        icono: FileText,
                        esObligatorio: false,
                        soporte: soporteCursoVial,
                        tipoSoporte: 'curso',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteCursoVial(null)
                      })}

                      <div className="nota-pie-soportes">
                        <span>Formatos admitidos: PDF, JPG, PNG (máximo 10 MB)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ------------------------------------------------------------
                FASE 3: VERIFICACIÓN DE DESCARGUE SIMIT Y EXPEDIENTE
               ------------------------------------------------------------ */}
            {faseActual === 3 && (
              <div className="seccion-formulario-operativo">
                {/* Banner Informativo del Subestado en Paso 3 */}
                <div className={`banner-subestado-paso3 ${esDescargadoSimit ? 'descargado' : 'esperando'}`}>
                  <div className="banner-subestado-icono">
                    {esDescargadoSimit ? (
                      <ShieldCheck size={20} color="#059669" />
                    ) : (
                      <Clock size={20} color="#ea580c" />
                    )}
                  </div>
                  <div className="banner-subestado-info">
                    <h4 className="banner-subestado-titulo">
                      {esDescargadoSimit
                        ? 'Paz y Salvo Oficial • Descargado en SIMIT' 
                        : 'Pagado Físicamente • Esperando Descargue SIMIT'}
                    </h4>
                    <p className="banner-subestado-desc">
                      {esDescargadoSimit
                        ? 'El comparendo se encuentra debidamente descargado y registrado como Pagado en la plataforma oficial SIMIT. El vehículo está a paz y salvo.'
                        : 'El comparendo ya fue cancelado físicamente y cuenta con comprobante de pago adjunto. La gestión interna concluye en este paso a la espera de que el organismo de tránsito efectúe el descargue oficial en la plataforma SIMIT.'}
                    </p>
                  </div>
                </div>

                {/* Grilla de Resumen Ejecutivo y Expediente de Soportes */}
                <div className="grid-formulario-2cols-gestion">
                  {/* Resumen de Datos Operativos */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <ShieldCheck size={18} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Resumen del Expediente</h4>
                        <p className="subtitulo-cabecera-tarjeta">Datos consolidados de la gestión operativa</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo">
                      <div className="lista-resumen-expediente">
                        {/* Ítem 1: Responsable Asignado */}
                        <div className="item-resumen-expediente">
                          <div className="item-resumen-icono-caja">
                            <User size={15} />
                          </div>
                          <div className="item-resumen-cuerpo">
                            <span className="item-resumen-etiqueta">Responsable Asignado</span>
                            <div className="item-resumen-valor-principal">
                              <span className="item-resumen-nombre-destacado">
                                {responsableNombre || 'Sin asignar'}
                              </span>
                              {responsableDocumento && (
                                <span className="item-resumen-chip-documento">
                                  C.C. {formatearDocumentoMiles(responsableDocumento)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Ítem 2: Distribución de Pago */}
                        <div className="item-resumen-expediente">
                          <div className="item-resumen-icono-caja">
                            {distribucionPago?.includes('empresa') ? (
                              <Building2 size={15} />
                            ) : distribucionPago?.includes('cliente') ? (
                              <Briefcase size={15} />
                            ) : distribucionPago?.includes('50') ? (
                              <Users size={15} />
                            ) : (
                              <User size={15} />
                            )}
                          </div>
                          <div className="item-resumen-cuerpo">
                            <span className="item-resumen-etiqueta">Distribución Asumida</span>
                            <div className="item-resumen-valor-principal">
                              <span className="item-resumen-badge-distribucion">
                                {OPCIONES_DISTRIBUCION_PAGO.find(o => o.valor === distribucionPago)?.etiqueta || distribucionPago}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Fila Dividida de 2 Columnas: Valor Pagado y Fecha de Pago */}
                        <div className="grid-resumen-dos-valores">
                          {/* Ítem 3: Valor Pagado */}
                          <div className="item-resumen-expediente destacado-monto">
                            <div className="item-resumen-icono-caja exito">
                              <DollarSign size={15} />
                            </div>
                            <div className="item-resumen-cuerpo">
                              <span className="item-resumen-etiqueta">Valor Pagado</span>
                              <div className="item-resumen-monto-valor">
                                ${valorPagado ? formatearMonedaMiles(valorPagado) : '0'}
                              </div>
                            </div>
                          </div>

                          {/* Ítem 4: Fecha de Pago en formato DD/MM/AAAA */}
                          <div className="item-resumen-expediente destacado-fecha">
                            <div className="item-resumen-icono-caja calendario">
                              <Calendar size={15} />
                            </div>
                            <div className="item-resumen-cuerpo">
                              <span className="item-resumen-etiqueta">Fecha de Pago</span>
                              <div className="item-resumen-fecha-valor">
                                {formatearFechaVisual(fechaPago)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ficha Inferior de Referencia Rápida */}
                        <div className="resumen-expediente-footer-meta">
                          <div className="meta-dato-item">
                            <span className="meta-dato-label">Comparendo</span>
                            <span className="meta-dato-val mono">{comparendo.numero_comparendo || 'S/N'}</span>
                          </div>
                          <span className="meta-separador-punto">•</span>
                          <div className="meta-dato-item">
                            <span className="meta-dato-label">Placa</span>
                            <span className="meta-dato-val">{comparendo.placa || 'N/A'}</span>
                          </div>
                          <span className="meta-separador-punto">•</span>
                          <div className="meta-dato-item">
                            <span className="meta-dato-label">Infracción</span>
                            <span className="meta-dato-val">{comparendo.codigo_infraccion || 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expediente Digital de Soportes Minimalista */}
                  <div className="tarjeta-columna-operativa">
                    <div className="tarjeta-columna-cabecera">
                      <div className="icono-cabecera-tarjeta">
                        <FileCheck2 size={18} color="var(--color-primario)" />
                      </div>
                      <div>
                        <h4 className="titulo-cabecera-tarjeta">Expediente Documental</h4>
                        <p className="subtitulo-cabecera-tarjeta">Soportes probatorios adjuntos para auditoría</p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo lista-soportes-minimalista">
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Aprobación por Correo',
                        subtitulo: 'Visto bueno gerencial',
                        icono: Mail,
                        esObligatorio: true,
                        soporte: soporteCorreo,
                        tipoSoporte: 'correo',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteCorreo(null)
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Descuento en Blanco',
                        subtitulo: 'Autorización suscrita por el trabajador',
                        icono: FileText,
                        esObligatorio: true,
                        soporte: soporteFirma,
                        tipoSoporte: 'firma',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteFirma(null)
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura / Recibo Oficial',
                        subtitulo: 'Comprobante de recaudo bancario o SIMIT',
                        icono: Receipt,
                        esObligatorio: true,
                        soporte: soporteFactura,
                        tipoSoporte: 'factura',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteFactura(null)
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Certificado de Curso CIA',
                        subtitulo: 'Certificado pedagógico de escuela vial',
                        icono: FileText,
                        esObligatorio: false,
                        soporte: soporteCursoVial,
                        tipoSoporte: 'curso',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => setSoporteCursoVial(null)
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ============================================================
              PIE DEL MODAL CON ACCIONES CLARAS Y ALINEADAS
             ============================================================ */}
          <div className="modal-gestion-pie">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {guardadoExitoso && (
                <span className="mensaje-guardado-pill">
                  <CheckCircle2 size={14} color="#10b981" />
                  <span>Gestión guardada exitosamente</span>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <EtiquetaTooltip texto="Guardar los datos registrados en el expediente" posicion="arriba">
                <button 
                  type="button" 
                  className="boton-secundario"
                  onClick={() => guardarAvance()}
                >
                  <Save size={14} />
                  <span>Guardar Avance</span>
                </button>
              </EtiquetaTooltip>

              {faseActual > 1 && (
                <EtiquetaTooltip texto="Regresar a la fase anterior" posicion="arriba">
                  <button 
                    type="button" 
                    className="boton-secundario"
                    onClick={retrocederFase}
                  >
                    <ArrowLeft size={14} />
                    <span>Anterior</span>
                  </button>
                </EtiquetaTooltip>
              )}

              {faseActual < 3 ? (
                <EtiquetaTooltip 
                  texto={
                    faseActual === 1 
                      ? (!fase1Completa 
                          ? "Complete los campos obligatorios (*) y adjunte los 2 soportes requeridos en el Paso 1 para continuar" 
                          : "Avanzar al Paso 2: Pago y Facturación")
                      : (!fase2Completa 
                          ? "Ingrese el valor pagado, la fecha de pago y adjunte la factura o recibo oficial para continuar" 
                          : "Avanzar al Paso 3: Descargue SIMIT")
                  } 
                  posicion="arriba"
                >
                  <button 
                    type="button" 
                    className="boton-primario"
                    disabled={(faseActual === 1 && !fase1Completa) || (faseActual === 2 && !fase2Completa)}
                    onClick={avanzarFase}
                  >
                    <span>Siguiente Paso</span>
                    <ArrowRight size={14} />
                  </button>
                </EtiquetaTooltip>
              ) : (
                <EtiquetaTooltip texto="Finalizar y guardar la gestión operativa de este comparendo" posicion="arriba">
                  <button 
                    type="button" 
                    className="boton-primario"
                    onClick={finalizarGestionOperativa}
                  >
                    <CheckCircle2 size={15} />
                    <span>Finalizar Gestión</span>
                  </button>
                </EtiquetaTooltip>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Visor Lightbox para previsualizar y descargar soportes */}
      {soporteEnVisor && (
        <VisorSoporte 
          soporte={soporteEnVisor} 
          alCerrar={() => setSoporteEnVisor(null)} 
        />
      )}
    </>
  )
}
