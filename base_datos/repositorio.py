import logging
import hashlib
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import select, func, case

from base_datos.modelos import ComparendoORM, LogExtraccionORM, EntidadConsultaORM, PreferenciaConsultaORM, UsuarioORM

logger = logging.getLogger(__name__)

class RepositorioBaseDatos:
    """
    Repositorio de acceso a datos para persistir y sincronizar vehículos, comparendos y logs en Supabase.
    """

    def __init__(self, sesion_bd: Session):
        self.session = sesion_bd
        self.sesion = sesion_bd

    def guardar_comparendos(
        self,
        comparendos_extraidos: List[Any],
        criterio: str,
        permitir_conciliacion: bool = True
    ) -> Tuple[int, int]:
        """Inserta o actualiza registros. Concilia para marcar 'No activo' los que ya no están en SIMIT solo si permitir_conciliacion=True."""
        nuevos = 0
        actualizados = 0

        # 1. Conciliación de Comparendos (Solo si la extracción fue 100% íntegra y sin fallos parciales)
        if permitir_conciliacion:
            identificadores_extraidos = set()
            for c in comparendos_extraidos:
                if c.numero_comparendo:
                    identificadores_extraidos.add(str(c.numero_comparendo).strip().upper())
                if c.numero_resolucion:
                    identificadores_extraidos.add(str(c.numero_resolucion).strip().upper())
            
            # Determinar criterios equivalentes para la conciliación (con y sin DV continuo)
            from agente_extraccion_simit.utilidades_documento import descomponer_nit
            criterio_limpio = str(criterio).replace("-", "").strip()
            criterios_conciliacion = [criterio_limpio]
            if criterio_limpio.isdigit() and len(criterio_limpio) >= 8:
                base_nit, dv = descomponer_nit(criterio_limpio)
                criterios_conciliacion = list({criterio_limpio, base_nit, f"{base_nit}{dv}"})

            # Si el criterio es una placa vehicular (<= 6 caracteres alfanuméricos),
            # la conciliación debe considerar comparendos asociados a la placa o al criterio
            es_placa_criterio = len(criterio_limpio) <= 6 and not criterio_limpio.isdigit()
            if es_placa_criterio:
                condicion_conciliacion = (ComparendoORM.placa == criterio_limpio) | (ComparendoORM.criterio_busqueda.in_(criterios_conciliacion))
            else:
                condicion_conciliacion = ComparendoORM.criterio_busqueda.in_(criterios_conciliacion)

            comparendos_db_activos = self.session.execute(
                select(ComparendoORM)
                .where(condicion_conciliacion)
                .where(ComparendoORM.estado_simit == 'Activo')
            ).scalars().all()
            
            for c_db in comparendos_db_activos:
                num_comp_db = str(c_db.numero_comparendo or '').strip().upper()
                num_res_db = str(c_db.numero_resolucion or '').strip().upper()
                
                # Se mantiene activo si su número de comparendo o su resolución están en la extracción
                sigue_presente = (num_comp_db in identificadores_extraidos) or (bool(num_res_db) and num_res_db in identificadores_extraidos)
                if not sigue_presente:
                    c_db.estado_simit = "No activo"
                    c_db.fecha_descarga_simit = datetime.now()
                    actualizados += 1
                    logger.info(f"Conciliación: Comparendo {c_db.numero_comparendo} (Res: {c_db.numero_resolucion}) descargado de SIMIT -> Estado: No activo.")
        else:
            logger.warning(
                f"Conciliación omitida por seguridad para {criterio}: "
                f"La extracción fue parcial o presentó fallas en alguna variante. Los comparendos activos se mantienen protegidos."
            )

        # 2. Inserción o actualización inteligente (Deduplicación multicriterio por placa y resolución)
        from sqlalchemy import or_
        for comp in comparendos_extraidos:
            comp_num = str(comp.numero_comparendo).strip() if comp.numero_comparendo else ""
            comp_res = str(comp.numero_resolucion).strip() if comp.numero_resolucion else None
            comp_placa = str(comp.placa).strip().upper() if comp.placa else ""

            # 1. Búsqueda directa por número de comparendo
            existente = self.session.scalar(
                select(ComparendoORM).where(ComparendoORM.numero_comparendo == comp_num)
            )

            # 2. Si no coincide directamente por comparendo, buscar coincidencia por resolución para la misma placa
            if not existente and comp_placa:
                condiciones_cruce = []
                if comp_res:
                    condiciones_cruce.append(ComparendoORM.numero_resolucion == comp_res)
                    condiciones_cruce.append(ComparendoORM.numero_comparendo == comp_res)
                if comp_num:
                    condiciones_cruce.append(ComparendoORM.numero_resolucion == comp_num)

                if condiciones_cruce:
                    existente = self.session.scalar(
                        select(ComparendoORM)
                        .where(ComparendoORM.placa == comp_placa)
                        .where(or_(*condiciones_cruce))
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
                # Regla de Identidad Canónica de Comparendo:
                # Si el nuevo dato trae un número oficial canónico de 20 dígitos y el existente tenía una resolución provisional, actualizar el comparendo.
                es_nuevo_canonico = len(comp_num) >= 15 and comp_num.isdigit()
                es_existente_canonico = len(existente.numero_comparendo) >= 15 and existente.numero_comparendo.isdigit()
                if es_nuevo_canonico and not es_existente_canonico:
                    logger.info(f"Actualizando comparendo canónico para {existente.placa}: '{existente.numero_comparendo}' -> '{comp_num}'")
                    existente.numero_comparendo = comp_num

                if comp_res:
                    existente.numero_resolucion = comp_res
                if comp.criterio_busqueda:
                    existente.criterio_busqueda = comp.criterio_busqueda
                existente.valor = comp.valor
                existente.intereses = comp.intereses
                existente.valor_total = comp.valor_total
                if comp.direccion:
                    existente.direccion = comp.direccion
                if comp.fuente_comparendo:
                    existente.fuente_comparendo = comp.fuente_comparendo
                if comp.fecha_infraccion and not es_existente_canonico:
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

    def marcar_comparendo_como_descargado(
        self,
        placa: str,
        identificador: str
    ) -> Optional[ComparendoORM]:
        """
        Marca un comparendo puntual como 'No activo' (descargado en SIMIT / Paz y Salvo)
        tras confirmar que en la consulta oficial de SIMIT para la placa ya no figura activo.
        """
        id_limpio = str(identificador or "").strip()
        placa_limpia = str(placa or "").strip().upper()
        if not id_limpio or not placa_limpia:
            return None

        from sqlalchemy import or_
        comparendo = self.session.scalar(
            select(ComparendoORM)
            .where(ComparendoORM.placa == placa_limpia)
            .where(
                or_(
                    ComparendoORM.numero_comparendo == id_limpio,
                    ComparendoORM.numero_resolucion == id_limpio
                )
            )
        )

        if comparendo:
            comparendo.estado_simit = "No activo"
            comparendo.fecha_descarga_simit = datetime.now()
            comparendo.fecha_ultima_actualizacion = datetime.now()
            self.session.flush()
            logger.info(
                f"[SIMIT PAZ Y SALVO] Comparendo puntual {comparendo.numero_comparendo} (Res: {comparendo.numero_resolucion}) "
                f"de la placa {placa_limpia} marcado como 'No activo' (descargado de SIMIT)."
            )
        return comparendo

    def registrar_log_extraccion(
        self,
        criterio: str,
        tipo_consulta: str,
        encontrados: int,
        nuevos: int,
        actualizados: int,
        exitoso: bool = True,
        error: str = None,
        id_lote: Optional[str] = None,
        origen: Optional[str] = None,
        usuario: Optional[str] = "Sistema"
    ) -> LogExtraccionORM:
        """Registra la traza de auditoría de la ejecución de extracción con trazabilidad de lote, origen y usuario ejecutor."""
        log = LogExtraccionORM(
            criterio_busqueda=criterio,
            tipo_consulta=tipo_consulta,
            registros_encontrados=encontrados,
            registros_nuevos=nuevos,
            registros_actualizados=actualizados,
            exitoso=exitoso,
            mensaje_error=error,
            id_lote=id_lote,
            origen=origen or ("PROGRAMADO_MASIVO" if id_lote else "MANUAL_INDIVIDUAL"),
            usuario=usuario or "Sistema"
        )
        self.session.add(log)
        self.session.flush()
        return log

    def autenticar_usuario(self, email: str, contrasena: str) -> Optional[UsuarioORM]:
        """Verifica credenciales contra comparendos_fscr.usuarios usando SHA-256."""
        if not email or not contrasena:
            return None
        hash_ingresado = hashlib.sha256(contrasena.strip().encode("utf-8")).hexdigest()
        stmt = select(UsuarioORM).where(
            func.lower(UsuarioORM.email) == func.lower(email.strip()),
            UsuarioORM.contrasena_hash == hash_ingresado,
            UsuarioORM.activo.is_(True)
        )
        return self.session.scalars(stmt).first()

    def obtener_usuario_por_email(self, email: str) -> Optional[UsuarioORM]:
        """Obtiene un usuario activo por su correo electrónico."""
        if not email:
            return None
        stmt = select(UsuarioORM).where(
            func.lower(UsuarioORM.email) == func.lower(email.strip()),
            UsuarioORM.activo.is_(True)
        )
        return self.session.scalars(stmt).first()

    def recalcular_descuentos_comparendos_existentes(self) -> int:
        """
        Recorre todos los comparendos y multas de la base de datos y recalcula sus descuentos,
        garantizando que multas con resolución o intereses no tengan descuento activo y que los
        comparendos físicos tengan su fecha de notificación en vía.
        """
        from agente_extraccion_simit.motor_descuentos import calcular_descuentos
        from agente_extraccion_simit.modelos import ComparendoSchema

        stmt = select(ComparendoORM)
        comparendos_bd = list(self.session.scalars(stmt).all())
        actualizados = 0

        for c in comparendos_bd:
            esquema_temp = ComparendoSchema(
                numero_comparendo=c.numero_comparendo,
                numero_resolucion=c.numero_resolucion,
                tipo_registro=c.tipo_registro,
                fecha_infraccion=c.fecha_infraccion,
                fecha_notificacion=c.fecha_notificacion,
                fecha_resolucion=c.fecha_resolucion,
                placa=c.placa,
                criterio_busqueda=c.criterio_busqueda,
                codigo_infraccion=c.codigo_infraccion,
                descripcion_infraccion=c.descripcion_infraccion,
                secretaria=c.secretaria,
                valor=c.valor or 0.0,
                intereses=c.intereses or 0.0,
                valor_total=c.valor_total or 0.0,
                es_fotodeteccion=c.es_fotodeteccion
            )

            # Para comparendos pagados/no activos, evaluamos la vigencia del descuento según la fecha
            # en que efectivamente se pagó o descargó del SIMIT, nunca según el día de hoy, preservando el beneficio legal.
            fecha_eval = None
            if c.estado_simit in ['No activo', 'Pagado']:
                # 1. Fecha de pago en gestión operativa
                g = getattr(c, "gestion_operativa", None)
                if isinstance(g, list) and g:
                    g = g[0]
                if g and getattr(g, "fecha_pago", None):
                    fp = g.fecha_pago
                    if isinstance(fp, str):
                        try:
                            fecha_eval = datetime.strptime(fp.split("T")[0], "%Y-%m-%d").date()
                        except Exception:
                            fecha_eval = None
                    elif isinstance(fp, datetime):
                        fecha_eval = fp.date()
                    elif isinstance(fp, date):
                        fecha_eval = fp

                # 2. Fecha de descargue del SIMIT
                if not fecha_eval and c.fecha_descarga_simit:
                    fecha_eval = c.fecha_descarga_simit.date() if isinstance(c.fecha_descarga_simit, datetime) else c.fecha_descarga_simit

                # 3. Fallback a fecha de última actualización
                if not fecha_eval and c.fecha_ultima_actualizacion:
                    fecha_eval = c.fecha_ultima_actualizacion.date() if isinstance(c.fecha_ultima_actualizacion, datetime) else c.fecha_ultima_actualizacion

            esquema_recalc = calcular_descuentos(esquema_temp, fecha_evaluacion=fecha_eval)

            cambio = False
            if c.aplica_descuento_50 != esquema_recalc.aplica_descuento_50:
                c.aplica_descuento_50 = esquema_recalc.aplica_descuento_50
                cambio = True
            if c.aplica_descuento_25 != esquema_recalc.aplica_descuento_25:
                c.aplica_descuento_25 = esquema_recalc.aplica_descuento_25
                cambio = True
            if c.valor_con_descuento_50 != esquema_recalc.valor_con_descuento_50:
                c.valor_con_descuento_50 = esquema_recalc.valor_con_descuento_50
                cambio = True
            if c.valor_con_descuento_25 != esquema_recalc.valor_con_descuento_25:
                c.valor_con_descuento_25 = esquema_recalc.valor_con_descuento_25
                cambio = True
            if c.fecha_limite_descuento_50 != esquema_recalc.fecha_limite_descuento_50:
                c.fecha_limite_descuento_50 = esquema_recalc.fecha_limite_descuento_50
                cambio = True
            if c.fecha_limite_descuento_25 != esquema_recalc.fecha_limite_descuento_25:
                c.fecha_limite_descuento_25 = esquema_recalc.fecha_limite_descuento_25
                cambio = True
            if not c.fecha_notificacion and esquema_recalc.fecha_notificacion:
                c.fecha_notificacion = esquema_recalc.fecha_notificacion
                cambio = True

            es_multa = (str(c.tipo_registro).strip().lower() == "multa") or bool(c.fecha_resolucion) or bool(c.intereses and c.intereses > 0)
            if es_multa and c.tipo_registro != "Multa":
                c.tipo_registro = "Multa"
                cambio = True

            if cambio:
                c.fecha_ultima_actualizacion = datetime.now()
                actualizados += 1

        self.session.flush()
        return actualizados

    # =========================================================================
    # GESTIÓN CONSOLIDADA DE ENTIDADES Y PREFERENCIAS DE CONSULTA
    # =========================================================================

    def obtener_entidades_consulta(self, solo_activas: bool = False) -> List[EntidadConsultaORM]:
        """Obtiene el listado de entidades registradas para consulta y monitoreo."""
        stmt = select(EntidadConsultaORM).order_by(EntidadConsultaORM.id.asc())
        if solo_activas:
            stmt = stmt.where(EntidadConsultaORM.activo == True)
        return list(self.session.scalars(stmt).all())

    def obtener_entidad_por_id(self, id_entidad: int) -> Optional[EntidadConsultaORM]:
        """Obtiene una entidad por su ID primario."""
        return self.session.get(EntidadConsultaORM, id_entidad)

    def obtener_entidad_por_criterio(self, criterio: str) -> Optional[EntidadConsultaORM]:
        """Obtiene una entidad por su número de documento o criterio de búsqueda (reconoce variantes con/sin DV)."""
        criterio_limpio = str(criterio).replace("-", "").strip()
        criterios_busqueda = [criterio_limpio]
        if criterio_limpio.isdigit() and len(criterio_limpio) >= 8:
            from agente_extraccion_simit.utilidades_documento import descomponer_nit
            base_nit, dv = descomponer_nit(criterio_limpio)
            criterios_busqueda = list({criterio_limpio, base_nit, f"{base_nit}{dv}"})

        return self.session.scalar(
            select(EntidadConsultaORM).where(EntidadConsultaORM.criterio_busqueda.in_(criterios_busqueda))
        )

    def crear_entidad_consulta(
        self,
        nombre_entidad: str,
        criterio_busqueda: str,
        tipo_documento: str = "NIT",
        activo: bool = True
    ) -> EntidadConsultaORM:
        """Crea y registra una nueva entidad para monitoreo y consulta de comparendos."""
        criterio_limpio = str(criterio_busqueda).replace("-", "").strip()
        
        # Si es NIT, normalizar al NIT base canónico
        if tipo_documento.upper() in ["NIT", "AMBOS"] and criterio_limpio.isdigit() and len(criterio_limpio) >= 8:
            from agente_extraccion_simit.utilidades_documento import descomponer_nit
            nit_base, _ = descomponer_nit(criterio_limpio)
            criterio_almacenar = nit_base
        else:
            criterio_almacenar = criterio_limpio

        existente = self.obtener_entidad_por_criterio(criterio_limpio)
        if existente:
            existente.nombre_entidad = nombre_entidad.strip()
            existente.criterio_busqueda = criterio_almacenar
            existente.tipo_documento = tipo_documento.strip()
            existente.activo = activo
            existente.requiere_desambiguacion = False
            self.session.flush()
            return existente

        nueva_entidad = EntidadConsultaORM(
            nombre_entidad=nombre_entidad.strip(),
            criterio_busqueda=criterio_almacenar,
            tipo_documento=tipo_documento.strip(),
            activo=activo,
            requiere_desambiguacion=False
        )
        self.session.add(nueva_entidad)
        self.session.flush()
        return nueva_entidad

    def actualizar_entidad_consulta(
        self,
        id_entidad: int,
        nombre_entidad: str = None,
        criterio_busqueda: str = None,
        tipo_documento: str = None,
        activo: bool = None
    ) -> Optional[EntidadConsultaORM]:
        """Actualiza los datos de una entidad existente."""
        entidad = self.obtener_entidad_por_id(id_entidad)
        if not entidad:
            return None

        if nombre_entidad is not None:
            entidad.nombre_entidad = nombre_entidad.strip()
        if criterio_busqueda is not None:
            entidad.criterio_busqueda = str(criterio_busqueda).replace("-", "").strip()
        if tipo_documento is not None:
            entidad.tipo_documento = tipo_documento.strip()
            # Si el usuario asigna un tipo válido, se apaga la alerta de desambiguación
            if entidad.tipo_documento in ["NIT", "Cédula", "Cédula de Ciudadanía", "AMBOS"]:
                entidad.requiere_desambiguacion = False
        if activo is not None:
            entidad.activo = activo

        entidad.fecha_actualizacion = datetime.utcnow()
        self.session.flush()
        return entidad

    def eliminar_entidad_consulta(self, id_entidad: int) -> bool:
        """Elimina una entidad de la tabla de consultas."""
        entidad = self.obtener_entidad_por_id(id_entidad)
        if not entidad:
            return False
        self.session.delete(entidad)
        self.session.flush()
        return True

    def marcar_desambiguacion_requerida(self, criterio: str):
        """Marca una entidad como requiriente de desambiguación tras detección por el agente."""
        entidad = self.obtener_entidad_por_criterio(criterio)
        if entidad:
            entidad.requiere_desambiguacion = True
            entidad.fecha_actualizacion = datetime.utcnow()
            self.session.flush()

    def resolver_desambiguacion(self, id_entidad: int, tipo_documento: str) -> Optional[EntidadConsultaORM]:
        """Resuelve la alerta de desambiguación asignando el tipo de documento elegido por el usuario."""
        entidad = self.obtener_entidad_por_id(id_entidad)
        if entidad:
            entidad.tipo_documento = tipo_documento.strip()
            entidad.requiere_desambiguacion = False
            entidad.fecha_actualizacion = datetime.utcnow()
            self.session.flush()
            return entidad
        return None

    def obtener_preferencia_documento(self, criterio: str) -> Optional[str]:
        """Obtiene el tipo de documento configurado para un criterio."""
        entidad = self.obtener_entidad_por_criterio(criterio)
        if entidad and entidad.tipo_documento and entidad.tipo_documento not in ["Pendiente", "Sin especificar"]:
            return entidad.tipo_documento
        return None

    def guardar_preferencia_documento(self, criterio: str, tipo_documento: str):
        """Guarda o actualiza el tipo de documento para un criterio."""
        criterio_limpio = str(criterio).replace("-", "").strip()
        entidad = self.obtener_entidad_por_criterio(criterio_limpio)
        if entidad:
            entidad.tipo_documento = tipo_documento.strip()
            entidad.requiere_desambiguacion = False
            entidad.fecha_actualizacion = datetime.utcnow()
        else:
            nueva = EntidadConsultaORM(
                nombre_entidad=f"Empresa NIT {criterio_limpio}",
                criterio_busqueda=criterio_limpio,
                tipo_documento=tipo_documento.strip(),
                activo=True,
                requiere_desambiguacion=False
            )
            self.session.add(nueva)
        self.session.flush()

    def obtener_resumen_flota(self, criterio_busqueda: str = None, estado: Optional[str] = "Activo") -> Dict[str, Any]:
        """
        Genera métricas consolidadas del estado de comparendos de la flota.
        Parámetro estado:
          - 'Activo' (por defecto): Solo comparendos vigentes / pendientes de pago en SIMIT (deuda real).
          - 'No activo': Solo comparendos descargados del SIMIT o pagados (histórico resuelto).
          - 'Todos' o 'Historico': Todo el historial acumulado.
        """
        stmt = select(ComparendoORM)
        if criterio_busqueda:
            stmt = stmt.where(ComparendoORM.criterio_busqueda == criterio_busqueda)

        # Normalizar y aplicar filtro de estado si no es 'todos' ni 'historico'
        estado_normalizado = None
        if estado and str(estado).strip().lower() not in ["todos", "historico", "global", "all"]:
            texto_estado = str(estado).strip().lower()
            if any(term in texto_estado for term in ["inactiv", "no activ", "no_activ", "pagad", "descargad", "cancelad", "paz y salvo", "resuelt"]):
                estado_normalizado = "No activo"
            elif any(term in texto_estado for term in ["activ", "vigent", "pendient", "mora", "abiert", "deuda"]):
                estado_normalizado = "Activo"
            else:
                estado_normalizado = estado.strip().capitalize()
            
            stmt = stmt.where(ComparendoORM.estado_simit == estado_normalizado)

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

        # Conteos globales de auditoría para la flota
        stmt_totales = select(
            func.count(case((ComparendoORM.estado_simit == 'Activo', 1))).label("activos"),
            func.count(case((ComparendoORM.estado_simit == 'No activo', 1))).label("inactivos"),
            func.count(ComparendoORM.id).label("total_historico")
        )
        if criterio_busqueda:
            stmt_totales = stmt_totales.where(ComparendoORM.criterio_busqueda == criterio_busqueda)
        conteos = self.session.execute(stmt_totales).first()

        return {
            "estado_consultado": estado_normalizado if estado_normalizado else "Histórico Completo",
            "total_comparendos": total_comparendos,
            "total_valor_nominal": total_nominal,
            "total_valor_optimizado": total_con_descuento_actual,
            "ahorro_total_disponible": ahorro_potencial,
            "cant_con_descuento_50": len(comparendos_50_pct),
            "cant_con_descuento_25": len(comparendos_25_pct),
            "cant_sin_descuento": len(comparendos_sin_descuento),
            "resumen_global_flota": {
                "total_activos_vigentes": conteos[0] if conteos else 0,
                "total_pagados_o_descargados": conteos[1] if conteos else 0,
                "total_historico_general": conteos[2] if conteos else 0
            }
        }

# Alias de compatibilidad
DatabaseRepository = RepositorioBaseDatos
RepositorioBaseDatos.upsert_comparendos = RepositorioBaseDatos.guardar_comparendos
RepositorioBaseDatos.get_preferencia_documento = RepositorioBaseDatos.obtener_preferencia_documento
RepositorioBaseDatos.save_preferencia_documento = RepositorioBaseDatos.guardar_preferencia_documento
