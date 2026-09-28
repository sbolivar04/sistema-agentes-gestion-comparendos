import React, { useState, useEffect } from 'react'
import { apiBackend } from '../servicios/apiBackend'
import { subirSoporteASupabaseStorage, eliminarSoporteDeSupabaseStorage } from '../servicios/almacenamientoSupabase'
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
  Lock,
  RefreshCw,
  Ban
} from 'lucide-react'
import { SelectorDesplegable } from './SelectorDesplegable'
import { SelectorFecha } from './SelectorFecha'
import { VisorSoporte } from './VisorSoporte'
import { EtiquetaTooltip } from './EtiquetaTooltip'

// Opciones corporativas para la distribución de la responsabilidad del pago
const OPCIONES_DISTRIBUCION_PAGO = [
  { valor: '100_conductor', etiqueta: '100% Conductor', icono: User },
  { valor: '50_50', etiqueta: '50% Empresa • 50% Conductor', icono: Users },
  { valor: '100_empresa', etiqueta: '100% Empresa (FSCR)', icono: Building2 },
  { valor: '100_cliente', etiqueta: '100% Cliente', icono: Briefcase },
  { valor: 'de_baja', etiqueta: 'De baja (Exoneración / SIMIT)', icono: Ban }
]

// Opciones de canal de recaudo para el pago
const OPCIONES_CANAL_PAGO = [
  { valor: 'banco', etiqueta: 'Sucursal Bancaria / Débito', icono: Building2 },
  { valor: 'pse', etiqueta: 'Portal SIMIT (PSE)', icono: CreditCard },
  { valor: 'corresponsal', etiqueta: 'Efecty / Corresponsal', icono: Users },
  { valor: 'otro', etiqueta: 'Otro Canal Autorizado', icono: FileText }
]

/**
 * Formatea un número de cédula o documento de identidad aplicando separador de miles con punto
 * (ej. 1023456789 -> 1.023.456.789).
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
 * Extrae y formatea los datos iniciales de gestión operativa para montar el modal de inmediato
 * sin saltos de interfaz ni pantallas en blanco.
 */
function resolverDatosGestionInicial(datos, comp) {
  if (!datos) {
    return {
      fase: 1,
      respNombre: '',
      respDoc: '',
      distPago: '',
      obsAsig: '',
      sopCorreo: null,
      sopFirma: null,
      valPag: comp?.valor_a_pagar ? formatearMonedaMiles(Math.round(Number(comp.valor_a_pagar))) : '',
      fecPag: '',
      sopFactura: null,
      sopCurso: null,
      confSimit: false,
      fecSimit: ''
    }
  }

  const distPagoInicial = datos.distribucionPago || datos.distribucion_pago
  const esDeBajaInicial = distPagoInicial === 'de_baja'

  const paso1CompletoDatos = Boolean(
    (datos.paso1Completo === true || datos.paso1_completo === true) || (
      esDeBajaInicial
        ? Boolean(datos.soporteCorreo || datos.soporte_correo)
        : (
            (datos.responsableNombre || datos.responsable_nombre)?.trim() &&
            (datos.responsableDocumento || datos.responsable_documento) &&
            distPagoInicial &&
            (datos.soporteCorreo || datos.soporte_correo) &&
            (datos.soporteFirma || datos.soporte_firma)
          )
    )
  )

  const paso2CompletoDatos = Boolean(
    paso1CompletoDatos && (
      esDeBajaInicial
        ? true
        : (
            (datos.paso2Completo === true || datos.paso2_completo === true) || (
              (datos.valorPagado || datos.valor_pagado) && 
              Number(String(datos.valorPagado || datos.valor_pagado).replace(/\D/g, '')) > 0 &&
              (datos.fechaPago || datos.fecha_pago) &&
              (datos.soporteFactura || datos.soporte_factura)
            )
          )
    )
  )

  let fase = 1
  const faseGuardada = Number(datos.faseActual || datos.fase_actual)
  if (comp?.estado_simit === 'No activo' || comp?.estado_simit === 'Pagado' || datos.confirmadoDescargueSimit || datos.confirmado_descargue_simit) {
    fase = 3
  } else if (faseGuardada === 3 && paso2CompletoDatos) {
    fase = 3
  } else if (faseGuardada === 2 && paso1CompletoDatos) {
    fase = 2
  } else {
    // Si no ha completado el Paso 1, abre estrictamente en el Paso 1
    fase = 1
  }

  const respNombre = datos.responsableNombre || datos.responsable_nombre
  const respDoc = datos.responsableDocumento || datos.responsable_documento
  const distPago = datos.distribucionPago || datos.distribucion_pago
  const obsAsig = datos.observacionesAsignacion || datos.observaciones_asignacion
  const valPag = datos.valorPagado || datos.valor_pagado
  const fecPag = datos.fechaPago || datos.fecha_pago
  const confSimit = datos.confirmadoDescargueSimit ?? datos.confirmado_descargue_simit
  const fecSimit = datos.fechaConfirmacionSimit || datos.fecha_confirmacion_simit

  let nombreDefecto = respNombre ? respNombre.trim() : ''
  let docDefecto = respDoc ? formatearDocumentoMiles(respDoc) : ''

  if (!nombreDefecto) {
    if (distPago === 'de_baja') {
      nombreDefecto = 'Trámite de Baja SIMIT'
    } else if (distPago === '100_empresa') {
      nombreDefecto = 'FSCR Ingenieria S.A.S'
    }
  }

  if (!docDefecto && distPago === '100_empresa') {
    docDefecto = formatearDocumentoMiles('900160091')
  }

  return {
    fase,
    respNombre: nombreDefecto,
    respDoc: docDefecto,
    distPago: distPago || '',
    obsAsig: obsAsig || '',
    sopCorreo: datos.soporteCorreo || datos.soporte_correo || null,
    sopFirma: datos.soporteFirma || datos.soporte_firma || null,
    valPag: valPag ? formatearMonedaMiles(valPag) : (comp?.valor_a_pagar ? formatearMonedaMiles(Math.round(Number(comp.valor_a_pagar))) : ''),
    fecPag: fecPag || '',
    sopFactura: datos.soporteFactura || datos.soporte_factura || null,
    sopCurso: datos.soporteCursoVial || datos.soporte_curso_vial || null,
    confSimit: confSimit !== undefined ? Boolean(confSimit) : false,
    fecSimit: fecSimit || ''
  }
}

/**
 * Componente ModalGestionOperativa
 * Formulario de flujo operacional paso a paso con diseño premium de 2 columnas paralelas.
 */
export function ModalGestionOperativa({ comparendo, gestionInicial, alCerrar, alActualizarGestion }) {
  const datosIniciales = resolverDatosGestionInicial(gestionInicial, comparendo)

  // Fase activa del stepper (1: Asignación, 2: Pago, 3: Descargue SIMIT)
  const [faseActual, setFaseActual] = useState(datosIniciales.fase)

  // Datos de la Fase 1: Asignación y Autorizaciones
  const [responsableNombre, setResponsableNombre] = useState(datosIniciales.respNombre)
  const [responsableDocumento, setResponsableDocumento] = useState(datosIniciales.respDoc)
  const [errorCedulaLongitud, setErrorCedulaLongitud] = useState(false)
  const [distribucionPago, setDistribucionPago] = useState(datosIniciales.distPago)
  const [observacionesAsignacion, setObservacionesAsignacion] = useState(datosIniciales.obsAsig)
  const [soporteCorreo, setSoporteCorreo] = useState(datosIniciales.sopCorreo)
  const [soporteFirma, setSoporteFirma] = useState(datosIniciales.sopFirma)

  // Datos de la Fase 2: Pago y Facturación
  const [valorPagado, setValorPagado] = useState(datosIniciales.valPag)
  const [fechaPago, setFechaPago] = useState(datosIniciales.fecPag)
  const [soporteFactura, setSoporteFactura] = useState(datosIniciales.sopFactura)
  const [soporteCursoVial, setSoporteCursoVial] = useState(datosIniciales.sopCurso)

  // Datos de la Fase 3: Descargue SIMIT
  const [confirmadoDescargueSimit, setConfirmadoDescargueSimit] = useState(datosIniciales.confSimit)
  const [fechaConfirmacionSimit, setFechaConfirmacionSimit] = useState(datosIniciales.fecSimit)

  // Estados de carga a Supabase Storage por slot
  const [subiendoSoporte, setSubiendoSoporte] = useState({})

  // Visor Lightbox, estados de sincronización con Supabase y alertas
  const [soporteEnVisor, setSoporteEnVisor] = useState(null)
  const [guardadoExitoso, setGuardadoExitoso] = useState(false)
  const [guardandoEnBd, setGuardandoEnBd] = useState(false)
  const [cargandoBd, setCargandoBd] = useState(false)

  const esDeBaja = distribucionPago === 'de_baja'

  // Validación de Cédula de Ciudadanía: Rango obligatorio estricto entre 6 y 10 dígitos numéricos
  // Menos de 6 dígitos = Inválido (celda mala) | Más de 10 dígitos = Inválido (celda mala)
  // Si la celda de cédula está mala, no se debe avanzar al Paso 2 ni activarse el botón de siguiente paso
  const digitosCedula = responsableDocumento ? String(responsableDocumento).replace(/\D/g, '') : ''
  const cantDigitosCedula = digitosCedula.length
  const cedulaValida = esDeBaja
    ? (cantDigitosCedula === 0 || (cantDigitosCedula >= 6 && cantDigitosCedula <= 10))
    : (cantDigitosCedula >= 6 && cantDigitosCedula <= 10)

  // Determinar si la celda de cédula tiene error visual (se pone en rojo con alerta)
  const cedulaTieneError = (cantDigitosCedula > 0 && (cantDigitosCedula < 6 || cantDigitosCedula > 10)) || errorCedulaLongitud

  // Validación estricta del Paso 1: todos los campos obligatorios (*) y los 2 soportes requeridos cargados
  // Regla especial de baja: si se selecciona "De baja", ÚNICAMENTE el soporte de aprobación por correo es obligatorio (y cédula válida si se digitó)
  const fase1Completa = esDeBaja
    ? Boolean(soporteCorreo && cedulaValida)
    : Boolean(
        responsableNombre && 
        responsableNombre.trim().length > 0 && 
        cedulaValida && 
        distribucionPago && 
        soporteCorreo && 
        soporteFirma
      )

  // Validación del Paso 2: si es "De baja", se considera listo al completar el Paso 1 (con $0 y fecha automática)
  const fase2Completa = esDeBaja
    ? Boolean(fase1Completa)
    : Boolean(
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

  // Sincronizar datos de gestión operativa
  useEffect(() => {
    if (!comparendo?.id) return

    const resetearFormulario = () => {
      setFaseActual(1)
      setResponsableNombre('')
      setResponsableDocumento('')
      setDistribucionPago('')
      setObservacionesAsignacion('')
      setSoporteCorreo(null)
      setSoporteFirma(null)
      setValorPagado(comparendo.valor_a_pagar ? formatearMonedaMiles(Math.round(Number(comparendo.valor_a_pagar))) : '')
      setFechaPago('')
      setSoporteFactura(null)
      setSoporteCursoVial(null)
      setConfirmadoDescargueSimit(false)
      setFechaConfirmacionSimit('')
    }

    const aplicarDatosGestion = (datos) => {
      if (!datos) {
        resetearFormulario()
        return
      }

      const distPagoGuardado = datos.distribucionPago || datos.distribucion_pago
      const esDeBajaGuardado = distPagoGuardado === 'de_baja'

      const paso1CompletoDatos = Boolean(
        (datos.paso1Completo === true || datos.paso1_completo === true) || (
          esDeBajaGuardado
            ? Boolean(datos.soporteCorreo || datos.soporte_correo)
            : (
                (datos.responsableNombre || datos.responsable_nombre)?.trim() &&
                (datos.responsableDocumento || datos.responsable_documento) &&
                distPagoGuardado &&
                (datos.soporteCorreo || datos.soporte_correo) &&
                (datos.soporteFirma || datos.soporte_firma)
              )
        )
      )

      const paso2CompletoDatos = Boolean(
        paso1CompletoDatos && (
          esDeBajaGuardado
            ? true
            : (
                (datos.paso2Completo === true || datos.paso2_completo === true) || (
                  (datos.valorPagado || datos.valor_pagado) && 
                  Number(String(datos.valorPagado || datos.valor_pagado).replace(/\D/g, '')) > 0 &&
                  (datos.fechaPago || datos.fecha_pago) &&
                  (datos.soporteFactura || datos.soporte_factura)
                )
              )
        )
      )

      let fase = 1
      const faseGuardada = Number(datos.faseActual || datos.fase_actual)
      if (comparendo?.estado_simit === 'No activo' || comparendo?.estado_simit === 'Pagado' || datos.confirmadoDescargueSimit || datos.confirmado_descargue_simit) {
        fase = 3
      } else if (faseGuardada === 3 && paso2CompletoDatos) {
        fase = 3
      } else if (faseGuardada === 2 && paso1CompletoDatos) {
        fase = 2
      } else {
        fase = 1
      }
      setFaseActual(fase)

      const respNombre = datos.responsableNombre || datos.responsable_nombre
      setResponsableNombre(respNombre ? respNombre.trim() : '')

      const respDoc = datos.responsableDocumento || datos.responsable_documento
      setResponsableDocumento(respDoc ? formatearDocumentoMiles(respDoc) : '')

      const distPago = datos.distribucionPago || datos.distribucion_pago
      setDistribucionPago(distPago || '')

      const obsAsig = datos.observacionesAsignacion || datos.observaciones_asignacion
      setObservacionesAsignacion(obsAsig || '')

      setSoporteCorreo(datos.soporteCorreo || datos.soporte_correo || null)
      setSoporteFirma(datos.soporteFirma || datos.soporte_firma || null)

      const valPag = datos.valorPagado || datos.valor_pagado
      setValorPagado(valPag ? formatearMonedaMiles(valPag) : (comparendo.valor_a_pagar ? formatearMonedaMiles(Math.round(Number(comparendo.valor_a_pagar))) : ''))

      const fecPag = datos.fechaPago || datos.fecha_pago
      setFechaPago(fecPag || '')

      setSoporteFactura(datos.soporteFactura || datos.soporte_factura || null)
      setSoporteCursoVial(datos.soporteCursoVial || datos.soporte_curso_vial || null)

      const confSimit = datos.confirmadoDescargueSimit ?? datos.confirmado_descargue_simit
      setConfirmadoDescargueSimit(confSimit !== undefined ? Boolean(confSimit) : false)

      const fecSimit = datos.fechaConfirmacionSimit || datos.fecha_confirmacion_simit
      setFechaConfirmacionSimit(fecSimit || '')
    }

    // Si ya vino precargado desde la tabla en memoria, aplicar de inmediato sin llamadas de red
    if (gestionInicial) {
      aplicarDatosGestion(gestionInicial)
      setCargandoBd(false)
      return
    }

    // Si no vino precargado, consultar registro oficial directamente desde Supabase Cloud (PostgreSQL)
    let activo = true
    setCargandoBd(true)
    apiBackend.obtenerGestionComparendo(comparendo.id)
      .then((res) => {
        if (!activo) return
        setCargandoBd(false)
        if (res?.exitoso && res.gestion) {
          aplicarDatosGestion(res.gestion)
        } else {
          resetearFormulario()
          localStorage.removeItem(`gestion_operativa_${comparendo.id}`)
        }
      })
      .catch((err) => {
        if (!activo) return
        setCargandoBd(false)
        console.warn('Error al cargar gestión desde Supabase:', err)
      })

    return () => { activo = false }
  }, [comparendo?.id])

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

  // Procesar carga directa a Storage con reemplazo limpio del archivo anterior
  const manejarSubidaArchivo = async (e, tipoSoporte) => {
    const archivo = e.target.files?.[0]
    if (!archivo) return

    e.target.value = ''
    setSubiendoSoporte(prev => ({ ...prev, [tipoSoporte]: true }))

    // Identificar archivo previo para no dejar huérfanos en Storage si se está modificando
    let soporteAnterior = null
    if (tipoSoporte === 'correo') soporteAnterior = soporteCorreo
    else if (tipoSoporte === 'firma') soporteAnterior = soporteFirma
    else if (tipoSoporte === 'factura') soporteAnterior = soporteFactura
    else if (tipoSoporte === 'curso') soporteAnterior = soporteCursoVial

    try {
      const nuevoSoporte = await subirSoporteASupabaseStorage(archivo, comparendo.id, tipoSoporte)

      if (tipoSoporte === 'correo') setSoporteCorreo(nuevoSoporte)
      if (tipoSoporte === 'firma') setSoporteFirma(nuevoSoporte)
      if (tipoSoporte === 'factura') setSoporteFactura(nuevoSoporte)
      if (tipoSoporte === 'curso') setSoporteCursoVial(nuevoSoporte)

      // Si se subió con éxito el nuevo y existía uno anterior, eliminar el viejo de Storage
      const rutaAnterior = soporteAnterior?.rutaStorage || soporteAnterior?.url
      if (rutaAnterior && rutaAnterior !== nuevoSoporte.rutaStorage) {
        eliminarSoporteDeSupabaseStorage(rutaAnterior)
      }
    } catch (err) {
      console.error('Error al subir soporte:', err)
      alert('Error al subir archivo: ' + (err.message || 'Verifique la conexión.'))
    } finally {
      setSubiendoSoporte(prev => ({ ...prev, [tipoSoporte]: false }))
    }
  }

  // Eliminar soporte de Storage y de estado local
  const manejarEliminarSoporte = async (tipoSoporte) => {
    let soporteActual = null
    const claveStorage = `gestion_operativa_${comparendo.id}`

    if (tipoSoporte === 'correo') {
      soporteActual = soporteCorreo
      setSoporteCorreo(null)
    } else if (tipoSoporte === 'firma') {
      soporteActual = soporteFirma
      setSoporteFirma(null)
    } else if (tipoSoporte === 'factura') {
      soporteActual = soporteFactura
      setSoporteFactura(null)
    } else if (tipoSoporte === 'curso') {
      soporteActual = soporteCursoVial
      setSoporteCursoVial(null)
    }

    // Eliminar físicamente el archivo de Supabase Storage
    const rutaAEliminar = soporteActual?.rutaStorage || soporteActual?.url
    if (rutaAEliminar) {
      try {
        await eliminarSoporteDeSupabaseStorage(rutaAEliminar)
      } catch (err) {
        console.warn('Error al eliminar archivo de Supabase Storage:', err)
      }
    }

    // Actualizar de inmediato la copia local en localStorage para consistencia inmediata
    try {
      const guardadoLocal = localStorage.getItem(claveStorage)
      if (guardadoLocal) {
        const parsed = JSON.parse(guardadoLocal)
        if (tipoSoporte === 'correo') { parsed.soporteCorreo = null; parsed.soporte_correo = null; }
        if (tipoSoporte === 'firma') { parsed.soporteFirma = null; parsed.soporte_firma = null; }
        if (tipoSoporte === 'factura') { parsed.soporteFactura = null; parsed.soporte_factura = null; }
        if (tipoSoporte === 'curso') { parsed.soporteCursoVial = null; parsed.soporte_curso_vial = null; }
        localStorage.setItem(claveStorage, JSON.stringify(parsed))
      }
    } catch {
      // Ignorar errores de localStorage
    }

    // Persistir de inmediato en Supabase PostgreSQL para consistencia total
    const campoSoporte = tipoSoporte === 'curso' ? 'soporteCursoVial' : (tipoSoporte === 'correo' ? 'soporteCorreo' : (tipoSoporte === 'firma' ? 'soporteFirma' : 'soporteFactura'))
    guardarAvance(null, null, null, { [campoSoporte]: null })
  }

  // Manejar cambio en el número de documento: rango legal colombiano (mínimo 6, máximo 10 dígitos numéricos)
  const manejarCambioDocumento = (e) => {
    const rawValue = e.target.value
    const soloDigitos = rawValue.replace(/\D/g, '')

    if (soloDigitos.length > 10) {
      setErrorCedulaLongitud(true)
      const primeros10 = soloDigitos.slice(0, 10)
      const documentoFormateado = formatearDocumentoMiles(primeros10)
      setResponsableDocumento(documentoFormateado)
      return
    }

    setErrorCedulaLongitud(false)
    const documentoFormateado = formatearDocumentoMiles(soloDigitos)
    setResponsableDocumento(documentoFormateado)
  }

  // Prevenir ingreso de más de 10 números e indicar error visual en tiempo real
  const manejarKeyDownDocumento = (e) => {
    if (['Backspace', 'Tab', 'Delete', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key) || e.ctrlKey || e.metaKey) {
      if (['Backspace', 'Delete'].includes(e.key)) {
        setErrorCedulaLongitud(false)
      }
      return
    }
    if (/^\d$/.test(e.key)) {
      const soloDigitos = responsableDocumento ? String(responsableDocumento).replace(/\D/g, '') : ''
      const seleccionLen = window.getSelection()?.toString().replace(/\D/g, '').length || 0
      if (soloDigitos.length >= 10 && seleccionLen === 0) {
        setErrorCedulaLongitud(true)
        e.preventDefault()
      }
    }
  }

  // Manejar cambio en el valor pagado: solo acepta dígitos numéricos y aplica separador de miles en pesos
  const manejarCambioValorPagado = (e) => {
    const valorFormateado = formatearMonedaMiles(e.target.value)
    setValorPagado(valorFormateado)
  }

  // Guardar estado actual en Supabase PostgreSQL y sincronizar en localStorage
  const guardarAvance = (nuevaFase = null, simitConfirmado = null, fechaSimit = null, soportesSobrescritos = null, valoresSobrescritos = null) => {
    const faseAGuardar = nuevaFase !== null ? nuevaFase : faseActual
    const esConfirmadoSimit = simitConfirmado !== null ? simitConfirmado : confirmadoDescargueSimit
    const strFechaSimit = fechaSimit !== null ? fechaSimit : fechaConfirmacionSimit
    const claveStorage = `gestion_operativa_${comparendo.id}`

    // Resolver soportes considerando sobreescrituras inmediatas si aplican
    const soporteCorreoFinal = soportesSobrescritos && 'soporteCorreo' in soportesSobrescritos ? soportesSobrescritos.soporteCorreo : soporteCorreo
    const soporteFirmaFinal = soportesSobrescritos && 'soporteFirma' in soportesSobrescritos ? soportesSobrescritos.soporteFirma : soporteFirma
    const soporteFacturaFinal = soportesSobrescritos && 'soporteFactura' in soportesSobrescritos ? soportesSobrescritos.soporteFactura : soporteFactura
    const soporteCursoVialFinal = soportesSobrescritos && 'soporteCursoVial' in soportesSobrescritos ? soportesSobrescritos.soporteCursoVial : soporteCursoVial

    // Eliminar espacios en blanco al inicio y al final del nombre del responsable
    const nombreLimpio = responsableNombre ? responsableNombre.trim() : (esDeBaja ? 'Trámite de Baja SIMIT' : '')
    // Asegurar que la cédula contenga únicamente dígitos con separador de miles
    const documentoLimpio = formatearDocumentoMiles(responsableDocumento)
    // Asegurar que el monto contenga separadores de miles estándar o 0 si es de baja
    const valorLimpio = esDeBaja ? '0' : (valoresSobrescritos?.valorPagado !== undefined ? valoresSobrescritos.valorPagado : formatearMonedaMiles(valorPagado))
    const fechaPagoLimpia = esDeBaja 
      ? (valoresSobrescritos?.fechaPago || fechaPago || new Date().toISOString().split('T')[0]) 
      : (valoresSobrescritos?.fechaPago !== undefined ? valoresSobrescritos.fechaPago : fechaPago)

    setResponsableNombre(nombreLimpio)
    setResponsableDocumento(documentoLimpio)
    setValorPagado(valorLimpio)
    if (esDeBaja && !fechaPago) {
      setFechaPago(fechaPagoLimpia)
    }

    // Determinar el subestado operativo actual
    let subestadoCodigo = 'sin_gestion'
    let subestadoTexto = 'Sin Gestión'

    if (esDescargadoSimit) {
      subestadoCodigo = 'descargado_paz_y_salvo'
      subestadoTexto = 'Paz y Salvo • Descargado SIMIT'
    } else if (faseAGuardar === 3) {
      // El Paso 3 es para indicar que ya se tramitó (o pagó) y se espera el descargue del SIMIT
      subestadoCodigo = 'pagado_esperando_descargue'
      subestadoTexto = esDeBaja 
        ? 'De Baja • Esperando Descargue SIMIT' 
        : 'Pagado • Esperando Descargue SIMIT'
    } else if (faseAGuardar === 2) {
      // En el Paso 2 permanece en trámite
      subestadoCodigo = 'pendiente_pago'
      subestadoTexto = esDeBaja ? 'Fase 2: Trámite de Baja ($0)' : 'Fase 2: En Trámite de Pago'
    } else if (esDeBaja && soporteCorreoFinal) {
      subestadoCodigo = 'revision_aprobacion'
      subestadoTexto = 'Fase 1: Aprobado para Baja'
    } else if (nombreLimpio && (soporteCorreoFinal || soporteFirmaFinal)) {
      subestadoCodigo = 'revision_aprobacion'
      subestadoTexto = 'Fase 1: En Revisión de Firmas'
    } else if (nombreLimpio || documentoLimpio || (distribucionPago && String(distribucionPago).trim().length > 0)) {
      subestadoCodigo = 'identificacion'
      subestadoTexto = esDeBaja ? 'Fase 1: En Trámite de Baja' : 'Fase 1: En Asignación de Responsable'
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
      soporteCorreo: soporteCorreoFinal,
      soporteFirma: soporteFirmaFinal,
      valorPagado: valorLimpio,
      fechaPago: fechaPagoLimpia,
      soporteFactura: soporteFacturaFinal,
      soporteCursoVial: soporteCursoVialFinal,
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

      // Persistencia oficial en Supabase PostgreSQL
      setGuardandoEnBd(true)
      apiBackend.guardarGestionComparendo(comparendo.id, payload)
        .then((res) => {
          setGuardandoEnBd(false)
          if (res?.exitoso && res.gestion) {
            localStorage.setItem(claveStorage, JSON.stringify(res.gestion))
            if (alActualizarGestion) {
              alActualizarGestion(comparendo.id, res.gestion)
            }
          }
        })
        .catch((err) => {
          setGuardandoEnBd(false)
          console.error('Error al persistir gestión en Supabase:', err)
        })
    } catch (e) {
      console.error('Error al guardar gestión operativa:', e)
    }
  }

  const puedeAccederAPaso = (pasoDestino) => {
    // Siempre puede ver o regresar al Paso 1
    if (pasoDestino === 1) return true
    // Para acceder al Paso 2, el Paso 1 debe estar completado
    if (pasoDestino === 2) return fase1Completa
    // Para acceder al Paso 3, debe estar descargado en SIMIT o haber completado Paso 1 (y Paso 2 si no es de baja)
    if (pasoDestino === 3) return esDescargadoSimit || (fase1Completa && (esDeBaja || fase2Completa))
    return false
  }

  const navegarAPaso = (pasoDestino) => {
    if (!puedeAccederAPaso(pasoDestino)) return
    if (pasoDestino === faseActual) return
    setFaseActual(pasoDestino)
    guardarAvance(pasoDestino)
  }

  const avanzarFase = () => {
    if (faseActual === 1 && !fase1Completa) return
    if (faseActual === 2 && !fase2Completa) return

    // Si es "De baja" y está en Paso 1, autocompleta el Paso 2 con $0 y fecha actual y salta directo al Paso 3
    if (faseActual === 1 && esDeBaja) {
      const hoy = fechaPago || new Date().toISOString().split('T')[0]
      setValorPagado('0')
      setFechaPago(hoy)
      setFaseActual(3)
      guardarAvance(3, null, null, null, { valorPagado: '0', fechaPago: hoy })
      return
    }

    const siguiente = Math.min(faseActual + 1, 3)
    setFaseActual(siguiente)
    guardarAvance(siguiente)
  }

  const retrocederFase = () => {
    if (faseActual === 3 && esDeBaja) {
      setFaseActual(1)
      guardarAvance(1)
      return
    }
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
    // Paso 3: ya se tramitó y se está esperando el descargue oficial en SIMIT
    if (faseActual === 3) {
      return {
        texto: esDeBaja ? 'De Baja • Esperando Descargue SIMIT' : 'Pagado • Esperando Descargue SIMIT',
        clase: 'pagado_esperando_descargue',
        icono: Clock
      }
    }
    // Paso 2: estrictamente en trámite de pago y facturación
    if (faseActual === 2) {
      return {
        texto: esDeBaja ? 'Trámite de Baja ($0)' : 'En Trámite de Pago',
        clase: 'pendiente_pago',
        icono: CreditCard
      }
    }
    // Paso 1: en revisión de firmas o en asignación de responsable
    if (esDeBaja && soporteCorreo) {
      return {
        texto: 'Aprobado para Baja',
        clase: 'revision_aprobacion',
        icono: UserCheck
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
    if (responsableNombre || responsableDocumento || (distribucionPago && String(distribucionPago).trim().length > 0)) {
      return {
        texto: 'En Asignación',
        clase: 'identificacion',
        icono: AlertCircle
      }
    }
    return {
      texto: 'Sin Gestión',
      clase: 'sin_gestion',
      icono: Clock
    }
  }

  const badgeActual = obtenerBadgeSubestado()
  const IconoBadge = badgeActual.icono

  // Renderizar slot de soporte minimalista y compacto con estado de Supabase Storage
  const renderizarSlotSoporteMinimalista = ({
    titulo,
    subtitulo,
    icono: IconoSlot,
    esObligatorio = true,
    soporte,
    tipoSoporte,
    esDesactivadoBaja = false,
    alSubir = manejarSubidaArchivo,
    alEliminar
  }) => {
    const estaSubiendo = Boolean(subiendoSoporte[tipoSoporte])
    const accionEliminar = alEliminar || (() => manejarEliminarSoporte(tipoSoporte))

    return (
      <div 
        className={`slot-soporte-minimalista ${soporte ? 'adjuntado' : ''}`}
        style={esDesactivadoBaja && !soporte ? { opacity: 0.72, filter: 'grayscale(0.4)' } : {}}
      >
        <div className="slot-soporte-izq">
          <div className={`slot-soporte-icono ${soporte ? 'adjuntado' : ''}`}>
            {soporte ? <CheckCircle2 size={16} /> : <IconoSlot size={16} />}
          </div>
          <div className="slot-soporte-textos">
            <div className="slot-soporte-titulo-fila">
              <span className="slot-soporte-titulo">{titulo}</span>
              {esDesactivadoBaja ? (
                <EtiquetaTooltip texto="No es requerido para comparendos dados de baja" posicion="arriba">
                  <span className="badge-opcional-mini" style={{ background: 'var(--fondo-hover, #e2e8f0)', color: 'var(--texto-atenuado, #64748b)' }}>No aplica</span>
                </EtiquetaTooltip>
              ) : esObligatorio ? (
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
                  target="_blank"
                  rel="noreferrer"
                  className="boton-mini-soporte"
                >
                  <Download size={13} />
                </a>
              </EtiquetaTooltip>

              <EtiquetaTooltip texto="Eliminar documento adjunto" posicion="arriba">
                <button 
                  type="button" 
                  className="boton-mini-soporte eliminar"
                  onClick={accionEliminar}
                >
                  <Trash2 size={13} />
                </button>
              </EtiquetaTooltip>
            </div>
          ) : estaSubiendo ? (
            <div className="boton-adjuntar-minimalista" style={{ opacity: 0.85, cursor: 'wait', display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-primario)' }}>
              <RefreshCw size={13} className="animar-giro" />
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Subiendo...</span>
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
                  ? (esDeBaja 
                      ? "Bloqueado: Adjunte el correo de aprobación en el Paso 1 para continuar"
                      : "Bloqueado: Complete los campos obligatorios (*) y adjunte los 2 soportes en el Paso 1 para desbloquear")
                  : (esDeBaja
                      ? "Paso 2: Comparendo de baja • Saldo automático en $0"
                      : "Paso 2: Registro de valor pagado, fecha de pago y soporte de factura")
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
                (!fase1Completa || (!esDeBaja && !fase2Completa)) && !esDescargadoSimit
                  ? "Bloqueado: Complete los pasos anteriores para desbloquear"
                  : (esDescargadoSimit
                      ? "Paso 3: Paz y Salvo oficial descargado en SIMIT" 
                      : (esDeBaja
                          ? "Paso 3: Comparendo de baja • Esperando descargue oficial en SIMIT"
                          : "Paso 3: Comparendo pagado • Esperando descargue en SIMIT"))
              } 
              posicion="abajo"
            >
              <button 
                type="button" 
                className={`stepper-paso-item ${faseActual === 3 ? 'activo' : ''} ${esDescargadoSimit ? 'completado' : ''} ${((!fase1Completa || (!esDeBaja && !fase2Completa)) && !esDescargadoSimit) ? 'bloqueado' : ''}`}
                disabled={(!fase1Completa || (!esDeBaja && !fase2Completa)) && !esDescargadoSimit}
                onClick={() => navegarAPaso(3)}
              >
                <div className="stepper-icono-circulo">
                  {((!fase1Completa || (!esDeBaja && !fase2Completa)) && !esDescargadoSimit) ? <Lock size={12} /> : (esDescargadoSimit ? <Check size={16} /> : '3')}
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
                            <span>{esDeBaja ? 'Nombre del Responsable (Opcional)' : 'Nombre del Responsable *'}</span>
                          </label>
                          <input 
                            id="responsable-nombre"
                            type="text"
                            className="campo-input-corporativo"
                            placeholder={esDeBaja ? 'Opcional (Comparendo de baja)' : 'Ej. Carlos Andrés Mendoza'}
                            value={responsableNombre}
                            onChange={(e) => setResponsableNombre(e.target.value)}
                            onBlur={() => setResponsableNombre(prev => prev.trim())}
                          />
                        </div>

                        <div className="campo-grupo-corporativo">
                          <label htmlFor="responsable-documento">
                            <Briefcase size={13} />
                            <span>{esDeBaja ? 'N° Cédula de Ciudadanía (Opcional)' : 'N° Cédula de Ciudadanía *'}</span>
                          </label>
                          <input 
                            id="responsable-documento"
                            type="text"
                            inputMode="numeric"
                            className={`campo-input-corporativo ${cedulaTieneError ? 'campo-input-error' : ''}`}
                            placeholder={esDeBaja ? 'Opcional (6 a 10 dígitos)' : 'Ej. 1.020.450.890 (6 a 10 dígitos)'}
                            value={responsableDocumento}
                            onChange={manejarCambioDocumento}
                            onKeyDown={manejarKeyDownDocumento}
                            style={cedulaTieneError ? {
                              borderColor: '#ef4444',
                              backgroundColor: 'rgba(239, 68, 68, 0.04)',
                              boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)'
                            } : {}}
                          />
                          {cedulaTieneError && (
                            <span 
                              style={{ 
                                color: '#ef4444', 
                                fontSize: '0.73rem', 
                                fontWeight: 600, 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.3rem',
                                marginTop: '0.3rem' 
                              }}
                            >
                              <AlertCircle size={13} />
                              {errorCedulaLongitud
                                ? 'El número de cédula no puede superar los 10 dígitos (máximo 10)'
                                : `El número de cédula debe tener entre 6 y 10 dígitos (actualmente tiene ${cantDigitosCedula} ${cantDigitosCedula === 1 ? 'dígito' : 'dígitos'})`
                              }
                            </span>
                          )}
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
                          alCambiar={(val) => {
                            setDistribucionPago(val)
                            if (val === 'de_baja') {
                              setResponsableNombre('Trámite de Baja SIMIT')
                              setValorPagado('0')
                              if (!fechaPago) {
                                const hoy = new Date().toISOString().split('T')[0]
                                setFechaPago(hoy)
                              }
                            } else if (val === '100_empresa') {
                              setResponsableNombre('FSCR Ingenieria S.A.S')
                              setResponsableDocumento(formatearDocumentoMiles('900160091'))
                              setErrorCedulaLongitud(false)
                            } else {
                              // Si previamente se habían autorellenado los datos corporativos o de baja, se limpian para facilitar el ingreso manual
                              if (responsableNombre === 'Trámite de Baja SIMIT' || responsableNombre === 'FSCR Ingenieria S.A.S') {
                                setResponsableNombre('')
                              }
                              if (responsableDocumento === formatearDocumentoMiles('900160091')) {
                                setResponsableDocumento('')
                              }
                            }
                          }}
                          placeholder="Seleccione responsable del pago..."
                          anchoMinimo="100%"
                          tamano="compacto"
                        />
                      </div>

                      {/* Fila 3: Observaciones */}
                      <div className="campo-grupo-corporativo" style={{ marginTop: '0.35rem' }}>
                        <label htmlFor="observaciones-asignacion">
                          <span>Observaciones o motivos de baja / acuerdos (Opcional)</span>
                        </label>
                        <textarea 
                          id="observaciones-asignacion"
                          className="campo-input-corporativo textarea-corporativo"
                          placeholder={esDeBaja ? 'Detalle el motivo de la baja (ej. placa errada, comparendo no imputable al vehículo, etc.)...' : 'Indique acuerdos específicos con nómina, conductor o cliente...'}
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
                        <p className="subtitulo-cabecera-tarjeta">
                          {esDeBaja 
                            ? 'Solo se requiere la aprobación de gerencia para procesar la baja'
                            : 'Adjunte los documentos requeridos en PDF o imagen'}
                        </p>
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
                        alEliminar: () => manejarEliminarSoporte('correo')
                      })}

                      {/* Slot 2: Descuento en Blanco */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Descuento en Blanco',
                        subtitulo: 'Formato físico firmado por el conductor o responsable',
                        icono: FileText,
                        esObligatorio: !esDeBaja,
                        esDesactivadoBaja: esDeBaja && !soporteFirma,
                        soporte: soporteFirma,
                        tipoSoporte: 'firma',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('firma')
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
                              placeholder={esDeBaja ? '0' : 'Ej. 260.000'}
                              value={valorPagado}
                              onChange={manejarCambioValorPagado}
                              readOnly={esDeBaja}
                              style={esDeBaja ? { backgroundColor: 'var(--fondo-hover, #f1f5f9)', cursor: 'not-allowed' } : {}}
                            />
                          </div>
                        </div>

                        <div className="campo-grupo-corporativo">
                          <label htmlFor="fecha-pago">
                            <Calendar size={13} />
                            <span>{esDeBaja ? 'Fecha de Trámite de Baja *' : 'Fecha de Pago *'}</span>
                          </label>
                          <SelectorFecha 
                            id="fecha-pago"
                            valor={fechaPago}
                            alCambiar={(nuevaFecha) => setFechaPago(nuevaFecha)}
                            placeholder="Seleccionar fecha..."
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
                        <p className="subtitulo-cabecera-tarjeta">
                          {esDeBaja 
                            ? 'No se requieren facturas ni recibos para comparendos de baja' 
                            : 'Recibo bancario emitido y factura del curso'}
                        </p>
                      </div>
                    </div>

                    <div className="tarjeta-columna-cuerpo lista-soportes-minimalista">
                      {/* Slot 1: Factura / Recibo Oficial */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura / Recibo Oficial',
                        subtitulo: 'Comprobante bancario o recibo del organismo de tránsito',
                        icono: Receipt,
                        esObligatorio: !esDeBaja,
                        esDesactivadoBaja: esDeBaja && !soporteFactura,
                        soporte: soporteFactura,
                        tipoSoporte: 'factura',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('factura')
                      })}

                      {/* Slot 2: Curso Pedagógico CIA */}
                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura de Curso CIA',
                        subtitulo: 'Requerido si se aplicó descuento del 50% o 25%',
                        icono: FileText,
                        esObligatorio: false,
                        esDesactivadoBaja: esDeBaja && !soporteCursoVial,
                        soporte: soporteCursoVial,
                        tipoSoporte: 'curso',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('curso')
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
                <div className={`banner-subestado-paso3 ${esDescargadoSimit ? 'descargado' : (esDeBaja ? 'esperando de_baja' : 'esperando')}`}>
                  <div className="banner-subestado-icono">
                    {esDescargadoSimit ? (
                      <ShieldCheck size={20} color="#059669" />
                    ) : esDeBaja ? (
                      <Ban size={20} color="#ea580c" />
                    ) : (
                      <Clock size={20} color="#ea580c" />
                    )}
                  </div>
                  <div className="banner-subestado-info">
                    <h4 className="banner-subestado-titulo">
                      {esDescargadoSimit
                        ? 'Paz y Salvo Oficial • Descargado en SIMIT' 
                        : (esDeBaja 
                            ? 'Dado de Baja • Esperando Descargue SIMIT' 
                            : 'Pagado Físicamente • Esperando Descargue SIMIT')}
                    </h4>
                    <p className="banner-subestado-desc">
                      {esDescargadoSimit
                        ? 'El comparendo se encuentra debidamente descargado y registrado como Pagado o Exonerado en la plataforma oficial SIMIT. El vehículo está a paz y salvo.'
                        : (esDeBaja
                            ? 'El comparendo fue tramitado como dado de baja / exonerado ante las autoridades (placa errada o no imputable al vehículo). La gestión interna culmina en este paso con valor $0 a la espera del descargue oficial en SIMIT.'
                            : 'El comparendo ya fue cancelado físicamente y cuenta con comprobante de pago adjunto. La gestión interna concluye en este paso a la espera de que el organismo de tránsito efectúe el descargue oficial en la plataforma SIMIT.')}
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
                                {responsableNombre || (esDeBaja ? 'No aplica (Trámite de Baja SIMIT)' : 'Sin asignar')}
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
                            {distribucionPago === 'de_baja' ? (
                              <Ban size={15} />
                            ) : distribucionPago?.includes('empresa') ? (
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
                              <span className="item-resumen-etiqueta">{esDeBaja ? 'Fecha de Baja' : 'Fecha de Pago'}</span>
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
                        alEliminar: () => manejarEliminarSoporte('correo')
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Descuento en Blanco',
                        subtitulo: 'Autorización suscrita por el trabajador',
                        icono: FileText,
                        esObligatorio: false,
                        esDesactivadoBaja: esDeBaja && !soporteFirma,
                        soporte: soporteFirma,
                        tipoSoporte: 'firma',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('firma')
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura / Recibo Oficial',
                        subtitulo: 'Comprobante de recaudo bancario o SIMIT',
                        icono: Receipt,
                        esObligatorio: false,
                        esDesactivadoBaja: esDeBaja && !soporteFactura,
                        soporte: soporteFactura,
                        tipoSoporte: 'factura',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('factura')
                      })}

                      {renderizarSlotSoporteMinimalista({
                        titulo: 'Factura de Curso CIA',
                        subtitulo: 'Factura pedagógica de escuela vial CIA',
                        icono: FileText,
                        esObligatorio: false,
                        esDesactivadoBaja: esDeBaja && !soporteCursoVial,
                        soporte: soporteCursoVial,
                        tipoSoporte: 'curso',
                        alSubir: manejarSubidaArchivo,
                        alEliminar: () => manejarEliminarSoporte('curso')
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
              {guardandoEnBd && (
                <span className="mensaje-guardado-pill" style={{ borderColor: 'rgba(59, 130, 246, 0.4)', color: '#3b82f6' }}>
                  <RefreshCw size={14} className="animar-giro" />
                  <span>Sincronizando...</span>
                </span>
              )}
              {guardadoExitoso && !guardandoEnBd && (
                <span className="mensaje-guardado-pill">
                  <CheckCircle2 size={14} color="#10b981" />
                  <span>Guardado correctamente</span>
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
                          ? (!cedulaValida && cantDigitosCedula > 0
                              ? `La cédula ingresada es inválida (debe tener entre 6 y 10 dígitos, actualmente tiene ${cantDigitosCedula})`
                              : (!cedulaValida && !esDeBaja
                                  ? "Ingrese un número de cédula válido (entre 6 y 10 dígitos) para continuar"
                                  : (esDeBaja 
                                      ? "Adjunte la aprobación por correo para continuar con el trámite de baja" 
                                      : "Complete los campos obligatorios (*) y adjunte los 2 soportes requeridos en el Paso 1 para continuar")))
                          : (esDeBaja 
                              ? "Avanzar al Paso 3: Resumen y Descargue SIMIT (Valor: $0)" 
                              : "Avanzar al Paso 2: Pago y Facturación"))
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
