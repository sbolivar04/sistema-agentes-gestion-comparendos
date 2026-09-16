/**
 * Servicio de Almacenamiento en Supabase Storage
 * Permite subir archivos y soportes directamente al bucket 'soportes_comparendos' en Supabase Cloud.
 */

const SUPABASE_URL = "https://yupaibsqnxfismckuqje.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl1cGFpYnNxbnhmaXNtY2t1cWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODYwMTgsImV4cCI6MjA4NTM2MjAxOH0.pHvAOBk53Zpo7Y6BO3kQDTpjpWAJK3DXM6bQB0aeprM"
const BUCKET_NAME = "soportes_comparendos"

/**
 * Sanitiza el nombre de un archivo eliminando caracteres especiales o acentos
 */
function sanitizarNombreArchivo(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Sube un archivo a Supabase Storage y retorna el objeto de soporte listo para asociar a la gestión
 *
 * @param {File} archivo - Archivo binario obtenido del input file
 * @param {number|string} comparendoId - ID del comparendo
 * @param {string} tipoSoporte - 'correo' | 'firma' | 'factura' | 'curso'
 * @returns {Promise<Object>} Objeto de soporte con url pública CDN
 */
export async function subirSoporteASupabaseStorage(archivo, comparendoId, tipoSoporte) {
  if (!archivo) throw new Error("No se ha proporcionado ningún archivo.")

  const nombreLimpio = sanitizarNombreArchivo(archivo.name)
  const marcaTiempo = Date.now()
  const rutaObjeto = `${comparendoId}/${tipoSoporte}_${marcaTiempo}_${nombreLimpio}`
  const urlSubida = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}/${rutaObjeto}`

  // Determinar mime type seguro
  let tipoMime = archivo.type
  if (!tipoMime || tipoMime === 'application/octet-stream') {
    if (archivo.name.toLowerCase().endsWith('.pdf')) tipoMime = 'application/pdf'
    else if (archivo.name.toLowerCase().endsWith('.png')) tipoMime = 'image/png'
    else if (archivo.name.toLowerCase().endsWith('.webp')) tipoMime = 'image/webp'
    else tipoMime = 'image/jpeg'
  }

  const respuesta = await fetch(urlSubida, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
      'Content-Type': tipoMime,
      'x-upsert': 'true'
    },
    body: archivo
  })

  if (!respuesta.ok) {
    const errorTexto = await respuesta.text()
    throw new Error(`Error al subir archivo a Supabase Storage (${respuesta.status}): ${errorTexto}`)
  }

  // URL pública directa de acceso CDN
  const urlPublica = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${rutaObjeto}`
  const esPdf = tipoMime.includes('pdf') || archivo.name.toLowerCase().endsWith('.pdf')

  return {
    id: `soporte_${marcaTiempo}`,
    nombre: archivo.name,
    tipo: esPdf ? 'pdf' : 'imagen',
    tamano: `${(archivo.size / 1024).toFixed(1)} KB`,
    fechaCarga: new Date().toLocaleDateString('es-CO'),
    url: urlPublica,
    rutaStorage: rutaObjeto
  }
}

/**
 * Extrae la ruta relativa de un objeto dentro del bucket eliminando prefijos de URL, parámetros y barras.
 */
export function extraerRutaRelativaStorage(rutaOUrl) {
  if (!rutaOUrl) return ''
  let texto = String(rutaOUrl).trim()

  // Eliminar query parameters (?t=...)
  if (texto.includes('?')) {
    texto = texto.split('?')[0]
  }

  // Eliminar prefijos conocidos del bucket o del endpoint CDN público
  const prefijoCdn = `/storage/v1/object/public/${BUCKET_NAME}/`
  const prefijoApi = `/storage/v1/object/${BUCKET_NAME}/`
  const prefijoBucket = `${BUCKET_NAME}/`

  if (texto.includes(prefijoCdn)) {
    texto = texto.split(prefijoCdn)[1]
  } else if (texto.includes(prefijoApi)) {
    texto = texto.split(prefijoApi)[1]
  } else if (texto.includes(prefijoBucket)) {
    texto = texto.split(prefijoBucket)[1]
  }

  // Quitar barras inclinadas al inicio y decodificar caracteres codificados (%20, etc.)
  texto = texto.replace(/^\/+/, '')
  try {
    texto = decodeURIComponent(texto)
  } catch {
    // Si la cadena ya estaba decodificada o falla el decode, conservar el texto limpio
  }

  return texto
}

/**
 * Elimina un soporte de Supabase Storage cuando el usuario lo descarta o lo reemplaza.
 *
 * @param {string} rutaOUrl - Ruta relativa en storage o URL completa del archivo
 * @returns {Promise<boolean>} True si fue eliminado exitosamente, False de lo contrario
 */
export async function eliminarSoporteDeSupabaseStorage(rutaOUrl) {
  if (!rutaOUrl) return false

  try {
    const rutaLimpia = extraerRutaRelativaStorage(rutaOUrl)
    if (!rutaLimpia) {
      console.warn('Ruta de archivo vacía o inválida para eliminar de Storage:', rutaOUrl)
      return false
    }

    const urlEliminar = `${SUPABASE_URL}/storage/v1/object/${BUCKET_NAME}`
    const respuesta = await fetch(urlEliminar, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prefixes: [rutaLimpia] })
    })

    if (!respuesta.ok) {
      const errorDetalle = await respuesta.text()
      console.warn(`No se pudo eliminar el archivo de Storage (${respuesta.status}):`, errorDetalle)
      return false
    }

    const resultadoJson = await respuesta.json()
    console.log('Archivo eliminado exitosamente de Storage:', rutaLimpia, resultadoJson)
    return true
  } catch (e) {
    console.warn('Error al conectar con Storage para eliminar archivo:', e)
    return false
  }
}

