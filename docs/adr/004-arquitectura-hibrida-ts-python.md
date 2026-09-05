# ADR-004 — Arquitectura hibrida: motor TypeScript + backend Python

**Estado:** Propuesta (a confirmar con Tonny) · **Fecha:** 2026-09-05

## Contexto

El equipo crecio a 4 personas y se definio una vision de producto mas amplia (ver README):
biblioteca cientifica con evidencia (RAG), prediccion ML/QSPR de propiedades faltantes,
reportes Excel multi-hoja. El stack propuesto para eso es Python (FastAPI, RDKit,
scikit-learn, pgvector).

Esto choca en apariencia con ADR-001, que fijo el motor de simulacion en TypeScript
corriendo en el navegador, precisamente para que mover un control recalcule al instante sin
ida y vuelta de red.

Reparto de trabajo acordado: **Tonny construye el backend** (Python, ML, RAG, reportes).
**Max (con este asistente) construye el frontend** (Next.js, visor 3D, formularios).

## Decision

Se adopta una arquitectura de **dos motores con responsabilidades distintas**, no uno que
reemplaza al otro:

1. **Motor matematico (TypeScript, cliente, ya construido)** — sigue siendo la fuente de
   verdad para la simulacion de difusion en tiempo real. Determinista, sin red, sin
   dependencia del LLM ni del backend Python. Es exactamente lo que el README describe en
   la seccion 10: *"El motor no depende del LLM para realizar los calculos"*.

2. **Backend cientifico (Python/FastAPI, Tonny)** — resuelve lo que el motor TypeScript no
   hace:
   - Investigacion automatizada de ingredientes nuevos (RAG sobre papers/evidencia).
   - Prediccion ML/QSPR de descriptores moleculares cuando no hay dato experimental.
   - Calculo de descriptores desde estructura molecular (RDKit) para ingredientes sin
     ficha previa.
   - Generacion de reportes Excel multi-hoja.
   - Revision regulatoria basada en reglas (no ML).

El frontend consume ambos: llama al motor TypeScript localmente para simular, y al backend
Python via HTTP para todo lo demas. El contrato exacto esta en
[API_CONTRACT.md](../API_CONTRACT.md).

## Por que NO migrar el motor de simulacion a Python

- Ya esta construido, probado (47 tests) y desplegado. Reescribirlo en NumPy/SciPy no
  aporta capacidad nueva y consume horas que no sobran.
- Mover el calculo a un servidor reintroduce la latencia de red que ADR-001 elimino
  deliberadamente. El caso de uso central del producto -mover un control y ver el
  resultado al instante- se degradaria.
- El motor no necesita ML ni RAG: es una ecuacion diferencial con parametros conocidos.

## Consecuencias

**A favor**
- Tonny y Max pueden trabajar en paralelo sin bloquearse: el contrato de API es la unica
  superficie compartida.
- El frontend sigue funcionando (con datos limitados) aunque el backend Python no este
  listo a tiempo: la simulacion central no depende de el.
- Evita duplicar la logica de difusion en dos lenguajes.

**En contra**
- Dos stacks de backend (Next.js Route Handlers + FastAPI) para desplegar y mantener.
- Requiere que el contrato de API se defina temprano y no cambie a mitad de la tarde.
- El indice de irritacion heuristico y el efecto del vehiculo (ADR previos) podrian en el
  futuro beneficiarse de ML/QSPR real desde el backend Python; por ahora se mantienen como
  heuristica declarada en el motor TS (ver docs/DATA_SOURCES.md).

## Pendiente de confirmar con Tonny

- Si el backend Python expone tambien un endpoint de simulacion (redundante con el motor TS)
  para casos donde se necesite recalcular en servidor (por ejemplo, para el reporte Excel,
  que corre sin navegador). Ver API_CONTRACT.md seccion 4.
- Version minima viable de RAG para hoy: se recomienda una tabla `evidence` con insercion
  manual de 5-10 registros para la demo, dejando la busqueda semantica (pgvector) declarada
  como pendiente si no hay tiempo.
