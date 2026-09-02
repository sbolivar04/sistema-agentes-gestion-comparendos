import logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from base_datos.conexion import motor

logger = logging.getLogger(__name__)

enrutador_programacion = APIRouter(
    prefix="/api/programacion",
    tags=["Programación del Agente SIMIT en cron.job"]
)

class EsquemaActualizarProgramacion(BaseModel):
    hora_colombia: str  # Formato "HH:MM" (24h) ej. "07:00", "06:30"
    activo: Optional[bool] = True

def cron_utc_a_hora_colombia(schedule: str):
    """
    Convierte una expresión cron UTC ('minuto hora * * *') a formato horario de Colombia (UTC-5).
    """
    try:
        partes = schedule.strip().split()
        if len(partes) >= 2:
            minuto = int(partes[0])
            hora_utc = int(partes[1])
            hora_colombia = (hora_utc - 5 + 24) % 24
            
            # Formatear a 12 horas con AM/PM
            periodo = "AM" if hora_colombia < 12 else "PM"
            hora_12 = hora_colombia % 12
            if hora_12 == 0:
                hora_12 = 12
            
            hora_formato_12h = f"{hora_12:02d}:{minuto:02d} {periodo}"
            hora_formato_24h = f"{hora_colombia:02d}:{minuto:02d}"
            
            return {
                "hora_24h": hora_formato_24h,
                "hora_12h": hora_formato_12h,
                "hora_colombia_numero": hora_colombia,
                "minuto": minuto
            }
    except Exception as e:
        logger.error(f"Error parseando cron UTC {schedule}: {e}")
    
    return {
        "hora_24h": "07:00",
        "hora_12h": "07:00 AM",
        "hora_colombia_numero": 7,
        "minuto": 0
    }

def hora_colombia_a_cron_utc(hora_24h: str):
    """
    Convierte una hora en formato Colombia 24h ("HH:MM") a expresión cron UTC ('minuto hora * * *').
    """
    partes = hora_24h.strip().split(":")
    hora_col = int(partes[0])
    minuto_col = int(partes[1]) if len(partes) > 1 else 0
    
    hora_utc = (hora_col + 5) % 24
    return f"{minuto_col} {hora_utc} * * *"

@enrutador_programacion.get("")
def obtener_programacion_agente():
    """
    Consulta la hora exacta de automatización programada en la tabla cron.job de Supabase.
    """
    try:
        with motor.connect() as conn:
            consulta = text("""
                SELECT jobid, schedule, command, active, jobname 
                FROM cron.job 
                WHERE jobname = 'extraccion_diaria_simit'
                LIMIT 1;
            """)
            fila = conn.execute(consulta).fetchone()
            
            if not fila:
                # Fallback: consultar el primer job disponible si existe
                fila_fallback = conn.execute(text("SELECT jobid, schedule, command, active, jobname FROM cron.job LIMIT 1;")).fetchone()
                if fila_fallback:
                    fila = fila_fallback
            
            if fila:
                jobid, schedule, command, active, jobname = fila
                info_hora = cron_utc_a_hora_colombia(schedule)
                
                return {
                    "exitoso": True,
                    "jobid": jobid,
                    "jobname": jobname,
                    "activo": bool(active),
                    "schedule_cron": schedule,
                    "hora_24h": info_hora["hora_24h"],
                    "hora_12h": info_hora["hora_12h"],
                    "hora_colombia": info_hora["hora_12h"],
                    "hora_corta": f"{info_hora['hora_12h'].split()[0]}",
                    "periodo": info_hora["hora_12h"].split()[1],
                    "mensaje": "Programación cargada desde cron.job en Supabase"
                }
            else:
                return {
                    "exitoso": True,
                    "jobid": None,
                    "jobname": "extraccion_diaria_simit",
                    "activo": True,
                    "schedule_cron": "0 12 * * *",
                    "hora_24h": "07:00",
                    "hora_12h": "07:00 AM",
                    "hora_colombia": "07:00 AM",
                    "hora_corta": "07:00",
                    "periodo": "AM",
                    "mensaje": "Sin registro cron, usando valor predeterminado"
                }
    except Exception as e:
        logger.error(f"Error consultando cron.job: {e}")
        return {
            "exitoso": False,
            "error": str(e),
            "hora_24h": "07:00",
            "hora_12h": "07:00 AM",
            "hora_colombia": "07:00 AM"
        }

@enrutador_programacion.post("")
def actualizar_programacion_agente(datos: EsquemaActualizarProgramacion):
    """
    Actualiza la hora de ejecución del agente en pg_cron de Supabase usando cron.alter_job.
    """
    try:
        nuevo_cron = hora_colombia_a_cron_utc(datos.hora_colombia)
        
        with motor.connect() as conn:
            # 1. Obtener el jobid del cron de extraccion
            consulta_id = text("""
                SELECT jobid FROM cron.job 
                WHERE jobname = 'extraccion_diaria_simit' OR jobid = 1 
                ORDER BY jobid ASC LIMIT 1;
            """)
            fila_id = conn.execute(consulta_id).fetchone()
            id_job = fila_id[0] if fila_id else 1
            
            # 2. Usar la funcion oficial cron.alter_job autorizada por pg_cron
            conn.execute(text("""
                SELECT cron.alter_job(
                    job_id := :job_id,
                    schedule := :schedule,
                    active := :activo
                );
            """), {
                "job_id": id_job,
                "schedule": nuevo_cron,
                "activo": datos.activo
            })
            conn.commit()
        
        info_hora = cron_utc_a_hora_colombia(nuevo_cron)
        logger.info(f"Programación cron actualizada exitosamente a {datos.hora_colombia} COT ({nuevo_cron} UTC).")
        
        return {
            "exitoso": True,
            "schedule_cron": nuevo_cron,
            "hora_24h": info_hora["hora_24h"],
            "hora_12h": info_hora["hora_12h"],
            "hora_colombia": info_hora["hora_12h"],
            "mensaje": f"Hora de ejecución actualizada a las {info_hora['hora_12h']} (Hora Colombia)."
        }
    except Exception as e:
        logger.error(f"Error actualizando cron.job: {e}")
        raise HTTPException(status_code=500, detail=f"No fue posible actualizar la programación en cron.job: {str(e)}")
