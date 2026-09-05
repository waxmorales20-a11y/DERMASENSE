# ADR-003 — Supabase con RLS para el aislamiento multi-tenant

**Estado:** Aceptada · **Fecha:** 2026-09-05

## Contexto

Las formulaciones son propiedad intelectual sensible de cada laboratorio. Una fuga entre
inquilinos sería fatal para la adopción B2B. Hacía falta una solución de auth y datos
operativa en menos de 30 minutos y defendible en producción.

## Decisión

Supabase (PostgreSQL gestionado + GoTrue), con **Row Level Security activo en todas las
tablas** y las políticas definidas en `002_rls.sql`. La autorización vive en la base de
datos, no en la capa de aplicación.

La clave `service_role` no se usa en ningún camino de código alcanzable desde el cliente;
queda reservada a migraciones y seed.

## Consecuencias

**A favor**
- El aislamiento se mantiene aunque un Route Handler tenga un bug: la política
  `auth.uid() = user_id` se evalúa en el motor de la base de datos.
- Auth completa (registro, sesión, refresh, recuperación) sin escribirla nosotros.
- PostgreSQL relacional con JSONB: columnas escalares para filtrar, JSONB para métricas
  de forma flexible.
- Un trigger crea el perfil automáticamente al registrarse, sin lógica en el cliente.

**En contra**
- Las políticas RLS son fáciles de escribir mal y difíciles de depurar. Mitigación:
  verificación explícita con dos usuarios de prueba antes de cerrar la Fase 1.
- Dependencia de un proveedor. Aceptable: por debajo es PostgreSQL estándar y el esquema
  es portable.
- RLS añade coste por consulta. Irrelevante al volumen previsto.

## Alternativas descartadas

- **Filtrado solo en la aplicación:** un único `where` olvidado expone datos de otro
  inquilino. Riesgo inaceptable para el segmento objetivo.
- **Auth propia con JWT:** horas de trabajo sin valor diferencial en una hackathon.
- **Firebase / Firestore:** sin SQL relacional; las consultas de comparación entre
  simulaciones serían más torpes.
