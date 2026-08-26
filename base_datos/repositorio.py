import logging
from datetime import datetime
from typing import List, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import select, func

from base_datos.modelos import ComparendoORM, LogExtraccionORM, PreferenciaConsultaORM

logger = logging.getLogger(__name__)

class RepositorioBaseDatos:
    """
    Repositorio de acceso a datos para persistir y sincronizar vehículos, comparendos y logs en Supabase.
    """

    def __init__(self, sesion_bd: Session):
        self.session = sesion_bd
        self.sesion = sesion_bd

    def guardar_comparendos(self, comparendos_extraidos: List[Any], criterio: str) -> Tuple[int, int]:
        """Inserta o actualiza registros. Concilia para marcar 'No activo' los que ya no están en SIMIT."""
        nuevos = 0
        actualizados = 0

        # 1. Conciliación de Comparendos
        numeros_extraidos = {c.numero_comparendo for c in comparendos_extraidos}
        
        comparendos_db_activos = self.session.execute(
            select(ComparendoORM)
            .where(ComparendoORM.criterio_busqueda == criterio)
            .where(ComparendoORM.estado_simit == 'Activo')
        ).scalars().all()
        
        for c_db in comparendos_db_activos:
            if c_db.numero_comparendo not in numeros_extraidos:
                c_db.estado_simit = "No activo"
                c_db.fecha_descarga_simit = datetime.now()
                actualizados += 1
                logger.info(f"Conciliación: Comparendo {c_db.numero_comparendo} descargado de SIMIT -> Estado: No activo.")

        # 2. Inserción o actualización
        for comp in comparendos_extraidos:
            existente = self.session.scalar(
                select(ComparendoORM).where(ComparendoORM.numero_comparendo == comp.numero_comparendo)
            )

            if not existente:
                nuevo_orm = ComparendoORM(
                    numero_resolucion=comp.numero_resolucion,
                    numero_comparendo=comp.numero_comparendo,
                    placa=comp.placa,
                    criterio_busqueda=comp.criterio_busqueda,
                    fecha_infraccion=comp.fecha_infraccion,
                    fecha_notificacion=comp.fecha_notificacion,
                    fecha_resolucion=comp.fecha_resolucion,
                    codigo_infraccion=comp.codigo_infraccion,
                    descripcion_infraccion=comp.descripcion_infraccion,
                    secretaria=comp.secretaria,
                    direccion=comp.direccion,
                    fuente_comparendo=comp.fuente_comparendo,
                    valor=comp.valor,
                    intereses=comp.intereses,
                    valor_total=comp.valor_total,
                    es_fotodeteccion=comp.es_fotodeteccion,
                    tipo_registro=comp.tipo_registro,
                    fecha_limite_descuento_50=comp.fecha_limite_descuento_50,
                    valor_con_descuento_50=comp.valor_con_descuento_50,
                    fecha_limite_descuento_25=comp.fecha_limite_descuento_25,
                    valor_con_descuento_25=comp.valor_con_descuento_25,
                    aplica_descuento_50=comp.aplica_descuento_50,
                    aplica_descuento_25=comp.aplica_descuento_25,
                    estado_simit="Activo"
                )
                self.session.add(nuevo_orm)
                nuevos += 1
            else:
                if comp.numero_resolucion:
                    existente.numero_resolucion = comp.numero_resolucion
                if comp.criterio_busqueda:
                    existente.criterio_busqueda = comp.criterio_busqueda
                existente.valor = comp.valor
                existente.intereses = comp.intereses
                existente.valor_total = comp.valor_total
                if comp.direccion:
                    existente.direccion = comp.direccion
                if comp.fuente_comparendo:
                    existente.fuente_comparendo = comp.fuente_comparendo
                if comp.fecha_infraccion:
                    existente.fecha_infraccion = comp.fecha_infraccion
                if comp.fecha_notificacion:
                    existente.fecha_notificacion = comp.fecha_notificacion
                if comp.fecha_resolucion:
                    existente.fecha_resolucion = comp.fecha_resolucion
                if comp.secretaria:
                    existente.secretaria = comp.secretaria
                if comp.descripcion_infraccion:
                    existente.descripcion_infraccion = comp.descripcion_infraccion
                if comp.tipo_registro:
                    existente.tipo_registro = comp.tipo_registro
                existente.fecha_limite_descuento_50 = comp.fecha_limite_descuento_50
                existente.valor_con_descuento_50 = comp.valor_con_descuento_50
                existente.fecha_limite_descuento_25 = comp.fecha_limite_descuento_25
                existente.valor_con_descuento_25 = comp.valor_con_descuento_25
                existente.aplica_descuento_50 = comp.aplica_descuento_50
                existente.aplica_descuento_25 = comp.aplica_descuento_25
                existente.fecha_ultima_actualizacion = datetime.now()
                
                if existente.estado_simit != "Activo":
                    existente.estado_simit = "Activo"
                    existente.fecha_descarga_simit = None

                actualizados += 1

        self.session.flush()
        return nuevos, actualizados

    def registrar_log_extraccion(
        self,
        criterio: str,
        tipo_consulta: str,
        encontrados: int,
        nuevos: int,
        actualizados: int,
        exitoso: bool = True,
        error: str = None
    ) -> LogExtraccionORM:
        """Registra la traza de auditoría de la ejecución de extracción."""
        log = LogExtraccionORM(
            criterio_busqueda=criterio,
            tipo_consulta=tipo_consulta,
            registros_encontrados=encontrados,
            registros_nuevos=nuevos,
            registros_actualizados=actualizados,
            exitoso=exitoso,
            mensaje_error=error
        )
        self.session.add(log)
        self.session.flush()
        return log

    def obtener_preferencia_documento(self, criterio: str) -> str:
        """Obtiene la preferencia de tipo de documento para un criterio específico."""
        preferencia = self.session.scalar(
            select(PreferenciaConsultaORM).where(PreferenciaConsultaORM.criterio_busqueda == criterio)
        )
        return preferencia.tipo_documento if preferencia else None

    def guardar_preferencia_documento(self, criterio: str, tipo_documento: str):
        """Guarda o actualiza la preferencia de tipo de documento para un criterio."""
        preferencia = self.session.scalar(
            select(PreferenciaConsultaORM).where(PreferenciaConsultaORM.criterio_busqueda == criterio)
        )
        if preferencia:
            preferencia.tipo_documento = tipo_documento
        else:
            nueva_preferencia = PreferenciaConsultaORM(
                criterio_busqueda=criterio,
                tipo_documento=tipo_documento
            )
            self.session.add(nueva_preferencia)
        self.session.flush()

    def obtener_resumen_flota(self, criterio_busqueda: str = None) -> Dict[str, Any]:
        """Genera métricas consolidadas del estado de comparendos de la flota."""
        stmt = select(ComparendoORM)
        if criterio_busqueda:
            stmt = stmt.where(ComparendoORM.criterio_busqueda == criterio_busqueda)

        comparendos = self.session.scalars(stmt).all()

        total_comparendos = len(comparendos)
        total_nominal = sum(c.valor_total for c in comparendos)
        
        total_con_descuento_actual = sum(
            c.valor_con_descuento_50 if c.aplica_descuento_50 
            else (c.valor_con_descuento_25 if c.aplica_descuento_25 else c.valor_total)
            for c in comparendos
        )
        
        ahorro_potencial = total_nominal - total_con_descuento_actual

        comparendos_50_pct = [c for c in comparendos if c.aplica_descuento_50]
        comparendos_25_pct = [c for c in comparendos if c.aplica_descuento_25]
        comparendos_sin_descuento = [c for c in comparendos if not c.aplica_descuento_50 and not c.aplica_descuento_25]

        return {
            "total_comparendos": total_comparendos,
            "total_valor_nominal": total_nominal,
            "total_valor_optimizado": total_con_descuento_actual,
            "ahorro_total_disponible": ahorro_potencial,
            "cant_con_descuento_50": len(comparendos_50_pct),
            "cant_con_descuento_25": len(comparendos_25_pct),
            "cant_sin_descuento": len(comparendos_sin_descuento),
        }

# Alias de compatibilidad
DatabaseRepository = RepositorioBaseDatos
RepositorioBaseDatos.upsert_comparendos = RepositorioBaseDatos.guardar_comparendos
RepositorioBaseDatos.get_preferencia_documento = RepositorioBaseDatos.obtener_preferencia_documento
RepositorioBaseDatos.save_preferencia_documento = RepositorioBaseDatos.guardar_preferencia_documento
