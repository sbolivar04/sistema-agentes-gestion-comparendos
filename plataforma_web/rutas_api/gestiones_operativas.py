"""
Módulo de rutas API para la gestión operativa de comparendos.
Permite consultar, guardar y sincronizar en Supabase PostgreSQL la información diligenciada
por el gestor de flota (responsable, asignación, comprobantes de pago y estado de descargue).
"""

import logging
from datetime import datetime, date
from typing import Dict, Any, Optional, List
from urllib.parse import unquote
import requests
from fastapi import APIRouter, HTTPException, Path
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy import select

from base_datos.conexion import obtener_sesion_bd
from base_datos.modelos import GestionOperativaORM, ComparendoORM
from configuracion import configuracion

logger = logging.getLogger(__name__)

enrutador_gestiones_operativas = APIRouter(prefix="/api/gestiones", tags=["Gestión Operativa"])


class EsquemaGuardarGestion(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    fase_actual: Optional[int] = Field(default=1, alias="faseActual")
    subestado_codigo: Optional[str] = Field(default="sin_gestion", alias="subestadoCodigo")
    paso1_completo: Optional[bool] = Field(default=False, alias="paso1Completo")
    paso2_completo: Optional[bool] = Field(default=False, alias="paso2Completo")
    responsable_nombre: Optional[str] = Field(default=None, alias="responsableNombre")
    responsable_documento: Optional[str] = Field(default=None, alias="responsableDocumento")
    distribucion_pago: Optional[str] = Field(default=None, alias="distribucionPago")
    observaciones_asignacion: Optional[str] = Field(default=None, alias="observacionesAsignacion")
    soporte_correo: Optional[Dict[str, Any]] = Field(default=None, alias="soporteCorreo")
    soporte_firma: Optional[Dict[str, Any]] = Field(default=None, alias="soporteFirma")
    valor_pagado: Optional[Any] = Field(default=None, alias="valorPagado")
    fecha_pago: Optional[str] = Field(default=None, alias="fechaPago")
    soporte_factura: Optional[Dict[str, Any]] = Field(default=None, alias="soporteFactura")
    soporte_curso_vial: Optional[Dict[str, Any]] = Field(default=None, alias="soporteCursoVial")
    confirmado_descargue_simit: Optional[bool] = Field(default=False, alias="confirmadoDescargueSimit")
    fecha_confirmacion_simit: Optional[str] = Field(default=None, alias="fechaConfirmacionSimit")


def serializar_gestion(g: GestionOperativaORM) -> Dict[str, Any]:
    """Serializa la entidad ORM de gestión operativa a diccionario compatible con JSON (soporta snake y camel)."""
    fecha_pago_str = g.fecha_pago.strftime("%Y-%m-%d") if g.fecha_pago else None
    fecha_conf_str = g.fecha_confirmacion_simit.strftime("%Y-%m-%d %H:%M:%S") if g.fecha_confirmacion_simit else None
    val_num = float(g.valor_pagado) if g.valor_pagado is not None else None

    return {
        "id": g.id,
        "comparendo_id": g.comparendo_id,
        "comparendoId": g.comparendo_id,
        "fase_actual": g.fase_actual,
        "faseActual": g.fase_actual,
        "subestado_codigo": g.subestado_codigo,
        "subestadoCodigo": g.subestado_codigo,
        "paso1_completo": g.paso1_completo,
        "paso1Completo": g.paso1_completo,
        "paso2_completo": g.paso2_completo,
        "paso2Completo": g.paso2_completo,
        "responsable_nombre": g.responsable_nombre,
        "responsableNombre": g.responsable_nombre,
        "responsable_documento": g.responsable_documento,
        "responsableDocumento": g.responsable_documento,
        "distribucion_pago": g.distribucion_pago,
        "distribucionPago": g.distribucion_pago,
        "observaciones_asignacion": g.observaciones_asignacion,
        "observacionesAsignacion": g.observaciones_asignacion,
        "soporte_correo": g.soporte_correo,
        "soporteCorreo": g.soporte_correo,
        "soporte_firma": g.soporte_firma,
        "soporteFirma": g.soporte_firma,
        "valor_pagado": val_num,
        "valorPagado": val_num,
        "fecha_pago": fecha_pago_str,
        "fechaPago": fecha_pago_str,
        "soporte_factura": g.soporte_factura,
        "soporteFactura": g.soporte_factura,
        "soporte_curso_vial": g.soporte_curso_vial,
        "soporteCursoVial": g.soporte_curso_vial,
        "tiene_soporte_correo": bool(g.soporte_correo),
        "tiene_soporte_firma": bool(g.soporte_firma),
        "tiene_soporte_factura": bool(g.soporte_factura),
        "confirmado_descargue_simit": g.confirmado_descargue_simit,
        "confirmadoDescargueSimit": g.confirmado_descargue_simit,
        "fecha_confirmacion_simit": fecha_conf_str,
        "fechaConfirmacionSimit": fecha_conf_str,
        "fecha_creacion": g.fecha_creacion.strftime("%Y-%m-%d %H:%M:%S") if g.fecha_creacion else None,
        "fecha_actualizacion": g.fecha_actualizacion.strftime("%Y-%m-%d %H:%M:%S") if g.fecha_actualizacion else None
    }


@enrutador_gestiones_operativas.get("")
def listar_mapa_gestiones() -> Dict[str, Any]:
    """
    Retorna un diccionario indexado por comparendo_id con la información completa de gestión operativa
    de cada comparendo gestionado, optimizado para alimentar la tabla y precargar los modales de inmediato.
    """
    try:
        with obtener_sesion_bd() as sesion:
            consulta = select(GestionOperativaORM)
            registros = sesion.scalars(consulta).all()

            mapa = {}
            for g in registros:
                mapa[g.comparendo_id] = serializar_gestion(g)

            return {
                "exitoso": True,
                "total": len(mapa),
                "gestiones": mapa
            }
    except Exception as e:
        logger.error(f"Error al listar mapa de gestiones operativas: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar gestiones operativas: {str(e)}")


def extraer_ruta_relativa_storage(ruta_o_url: Optional[str], bucket: str = "soportes_comparendos") -> str:
    """
    Extrae la ruta relativa interna de un archivo dentro del bucket de Supabase Storage.
    Elimina query parameters (?t=...), prefijos de URL/CDN y barras inclinadas iniciales.
    """
    if not ruta_o_url:
        return ""
    texto = str(ruta_o_url).strip()
    if "?" in texto:
        texto = texto.split("?")[0]

    patron_cdn = f"/storage/v1/object/public/{bucket}/"
    patron_api = f"/storage/v1/object/{bucket}/"
    patron_bucket = f"{bucket}/"

    if patron_cdn in texto:
        texto = texto.split(patron_cdn, 1)[1]
    elif patron_api in texto:
        texto = texto.split(patron_api, 1)[1]
    elif patron_bucket in texto:
        texto = texto.split(patron_bucket, 1)[1]

    texto = unquote(texto.lstrip("/"))
    return texto


def eliminar_archivo_storage(ruta_o_url: Optional[str], bucket: str = "soportes_comparendos") -> bool:
    """
    Elimina físicamente un archivo de Supabase Storage mediante la API REST de Storage.
    Retorna True si fue eliminado exitosamente, False si no se pudo eliminar o hubo error.
    """
    if not ruta_o_url:
        return False

    ruta_limpia = extraer_ruta_relativa_storage(ruta_o_url, bucket)
    if not ruta_limpia:
        return False

    url_eliminar = f"{configuracion.SUPABASE_URL}/storage/v1/object/{bucket}"
    encabezados = {
        "Authorization": f"Bearer {configuracion.SUPABASE_ANON_KEY}",
        "apikey": configuracion.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }

    try:
        respuesta = requests.delete(
            url_eliminar,
            headers=encabezados,
            json={"prefixes": [ruta_limpia]},
            timeout=10
        )
        if respuesta.status_code == 200:
            logger.info(f"Archivo eliminado exitosamente de Supabase Storage: {ruta_limpia}")
            return True
        else:
            logger.warning(f"No se pudo eliminar archivo de Storage ({respuesta.status_code}): {respuesta.text}")
            return False
    except Exception as error:
        logger.error(f"Error al conectar con Supabase Storage para eliminar {ruta_limpia}: {error}")
        return False


def extraer_ruta_de_soporte_dict(soporte_obj: Any) -> Optional[str]:
    """Obtiene la ruta o URL de un soporte estructurado como dict o string."""
    if not soporte_obj:
        return None
    if isinstance(soporte_obj, dict):
        return soporte_obj.get("rutaStorage") or soporte_obj.get("url")
    if isinstance(soporte_obj, str):
        return soporte_obj
    return None


@enrutador_gestiones_operativas.get("/configuracion-storage")
def obtener_configuracion_storage() -> Dict[str, Any]:
    """Retorna los parámetros para que el cliente cargue directamente archivos a Supabase Storage."""
    return {
        "exitoso": True,
        "url_supabase": configuracion.SUPABASE_URL,
        "anon_key": configuracion.SUPABASE_ANON_KEY,
        "bucket": "soportes_comparendos"
    }


@enrutador_gestiones_operativas.get("/{comparendo_id}")
def obtener_gestion_comparendo(
    comparendo_id: int = Path(..., description="ID primario del comparendo en la base de datos")
) -> Dict[str, Any]:
    """
    Obtiene la información completa de gestión operativa diligenciada para un comparendo específico.
    Si aún no tiene gestión registrada, retorna gestion: null.
    """
    try:
        with obtener_sesion_bd() as sesion:
            # Validar que el comparendo exista
            comp = sesion.get(ComparendoORM, comparendo_id)
            if not comp:
                raise HTTPException(status_code=404, detail="El comparendo especificado no existe.")

            consulta = select(GestionOperativaORM).where(GestionOperativaORM.comparendo_id == comparendo_id)
            gestion = sesion.scalars(consulta).first()

            if not gestion:
                return {
                    "exitoso": True,
                    "comparendo_id": comparendo_id,
                    "gestion": None
                }

            return {
                "exitoso": True,
                "comparendo_id": comparendo_id,
                "gestion": serializar_gestion(gestion)
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al obtener gestión del comparendo {comparendo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al consultar gestión operativa: {str(e)}")


@enrutador_gestiones_operativas.post("/{comparendo_id}")
def guardar_gestion_comparendo(
    datos: EsquemaGuardarGestion,
    comparendo_id: int = Path(..., description="ID primario del comparendo en la base de datos")
) -> Dict[str, Any]:
    """
    Inserta o actualiza (Upsert) la gestión operativa de un comparendo en Supabase PostgreSQL.
    """
    try:
        with obtener_sesion_bd() as sesion:
            # Validar que el comparendo exista
            comp = sesion.get(ComparendoORM, comparendo_id)
            if not comp:
                raise HTTPException(status_code=404, detail="El comparendo especificado no existe.")

            consulta = select(GestionOperativaORM).where(GestionOperativaORM.comparendo_id == comparendo_id)
            gestion = sesion.scalars(consulta).first()

            # Parsear monto pagado numérico de forma robusta
            monto_pagado_num = None
            if datos.valor_pagado is not None:
                if isinstance(datos.valor_pagado, (int, float)):
                    monto_pagado_num = float(datos.valor_pagado)
                else:
                    limpio = str(datos.valor_pagado).replace("$", "").replace(" ", "").strip()
                    if "." in limpio and "," in limpio:
                        limpio = limpio.replace(".", "").replace(",", ".")
                    elif "." in limpio:
                        limpio = limpio.replace(".", "")
                    elif "," in limpio:
                        limpio = limpio.replace(",", ".")
                    try:
                        monto_pagado_num = float(limpio) if limpio else None
                    except (ValueError, TypeError):
                        monto_pagado_num = None

            # Parsear fechas si vienen en cadena
            dt_fecha_pago = None
            if datos.fecha_pago and datos.fecha_pago.strip():
                try:
                    dt_fecha_pago = datetime.strptime(datos.fecha_pago.strip()[:10], "%Y-%m-%d").date()
                except ValueError:
                    pass

            dt_confirmacion_simit = None
            if datos.fecha_confirmacion_simit and datos.fecha_confirmacion_simit.strip():
                try:
                    dt_confirmacion_simit = datetime.fromisoformat(datos.fecha_confirmacion_simit.strip().replace("Z", ""))
                except ValueError:
                    dt_confirmacion_simit = datetime.utcnow()

            if not gestion:
                # Crear nuevo registro de gestión operativa
                gestion = GestionOperativaORM(
                    comparendo_id=comparendo_id,
                    fase_actual=datos.fase_actual or 1,
                    subestado_codigo=datos.subestado_codigo or "sin_gestion",
                    paso1_completo=datos.paso1_completo or False,
                    paso2_completo=datos.paso2_completo or False,
                    responsable_nombre=datos.responsable_nombre,
                    responsable_documento=datos.responsable_documento,
                    distribucion_pago=datos.distribucion_pago,
                    observaciones_asignacion=datos.observaciones_asignacion,
                    soporte_correo=datos.soporte_correo,
                    soporte_firma=datos.soporte_firma,
                    valor_pagado=monto_pagado_num,
                    fecha_pago=dt_fecha_pago,
                    soporte_factura=datos.soporte_factura,
                    soporte_curso_vial=datos.soporte_curso_vial,
                    confirmado_descargue_simit=datos.confirmado_descargue_simit or False,
                    fecha_confirmacion_simit=dt_confirmacion_simit,
                    fecha_creacion=datetime.utcnow(),
                    fecha_actualizacion=datetime.utcnow()
                )
                sesion.add(gestion)
                sesion.flush()
                mensaje = "Gestión operativa creada exitosamente en Supabase."
            else:
                # Purgar de Supabase Storage cualquier soporte previo que haya sido removido o sustituido
                soportes_a_verificar = [
                    (gestion.soporte_correo, datos.soporte_correo),
                    (gestion.soporte_firma, datos.soporte_firma),
                    (gestion.soporte_factura, datos.soporte_factura),
                    (gestion.soporte_curso_vial, datos.soporte_curso_vial),
                ]
                for soporte_viejo, soporte_nuevo in soportes_a_verificar:
                    ruta_vieja = extraer_ruta_de_soporte_dict(soporte_viejo)
                    ruta_nueva = extraer_ruta_de_soporte_dict(soporte_nuevo)
                    if ruta_vieja and (not ruta_nueva or ruta_vieja != ruta_nueva):
                        eliminar_archivo_storage(ruta_vieja)

                # Actualizar registro existente
                gestion.fase_actual = datos.fase_actual if datos.fase_actual is not None else gestion.fase_actual
                gestion.subestado_codigo = datos.subestado_codigo or gestion.subestado_codigo
                gestion.paso1_completo = datos.paso1_completo if datos.paso1_completo is not None else gestion.paso1_completo
                gestion.paso2_completo = datos.paso2_completo if datos.paso2_completo is not None else gestion.paso2_completo
                gestion.responsable_nombre = datos.responsable_nombre
                gestion.responsable_documento = datos.responsable_documento
                gestion.distribucion_pago = datos.distribucion_pago
                gestion.observaciones_asignacion = datos.observaciones_asignacion
                gestion.soporte_correo = datos.soporte_correo
                gestion.soporte_firma = datos.soporte_firma
                gestion.valor_pagado = monto_pagado_num if monto_pagado_num is not None else gestion.valor_pagado
                gestion.fecha_pago = dt_fecha_pago if dt_fecha_pago is not None else gestion.fecha_pago
                gestion.soporte_factura = datos.soporte_factura
                gestion.soporte_curso_vial = datos.soporte_curso_vial
                gestion.confirmado_descargue_simit = datos.confirmado_descargue_simit if datos.confirmado_descargue_simit is not None else gestion.confirmado_descargue_simit
                gestion.fecha_confirmacion_simit = dt_confirmacion_simit if dt_confirmacion_simit is not None else gestion.fecha_confirmacion_simit
                gestion.fecha_actualizacion = datetime.utcnow()
                sesion.flush()
                mensaje = "Gestión operativa actualizada exitosamente en Supabase."

            return {
                "exitoso": True,
                "mensaje": mensaje,
                "gestion": serializar_gestion(gestion)
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al guardar gestión del comparendo {comparendo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al guardar gestión operativa en Supabase: {str(e)}")


@enrutador_gestiones_operativas.delete("/{comparendo_id}/soporte/{tipo_soporte}")
def eliminar_soporte_comparendo(
    comparendo_id: int = Path(..., description="ID primario del comparendo en la base de datos"),
    tipo_soporte: str = Path(..., description="Tipo de soporte: correo, firma, factura, curso")
) -> Dict[str, Any]:
    """
    Elimina físicamente un soporte documental de Supabase Storage y actualiza el campo correspondiente
    en la tabla gestiones_operativas a NULL en Supabase PostgreSQL.
    """
    mapa_campos = {
        "correo": "soporte_correo",
        "firma": "soporte_firma",
        "factura": "soporte_factura",
        "curso": "soporte_curso_vial"
    }

    nombre_campo = mapa_campos.get(tipo_soporte.lower())
    if not nombre_campo:
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de soporte inválido: '{tipo_soporte}'. Opciones permitidas: correo, firma, factura, curso."
        )

    try:
        with obtener_sesion_bd() as sesion:
            consulta = select(GestionOperativaORM).where(GestionOperativaORM.comparendo_id == comparendo_id)
            gestion = sesion.scalars(consulta).first()
            if not gestion:
                raise HTTPException(status_code=404, detail="No se encontró gestión operativa para este comparendo.")

            soporte_actual = getattr(gestion, nombre_campo)
            ruta_a_eliminar = extraer_ruta_de_soporte_dict(soporte_actual)

            if ruta_a_eliminar:
                eliminar_archivo_storage(ruta_a_eliminar)

            setattr(gestion, nombre_campo, None)
            gestion.fecha_actualizacion = datetime.utcnow()
            sesion.flush()

            return {
                "exitoso": True,
                "mensaje": f"Soporte documental '{tipo_soporte}' eliminado exitosamente de la base de datos y Storage.",
                "gestion": serializar_gestion(gestion)
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error al eliminar soporte {tipo_soporte} del comparendo {comparendo_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error al eliminar soporte en Supabase: {str(e)}")
