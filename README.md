# DERMASENSE

> **Laboratorio virtual de simulación 3D de piel para experimentación cosmética.**
> Permite formular virtualmente ingredientes cosméticos, modificar sus proporciones y visualizar mediante un modelo computacional 3D cómo se distribuyen a través de las capas de la piel a lo largo del tiempo.
>
> DERMASENSE combina **evidencia científica, Machine Learning/QSPR, simulación computacional, visualización 3D e inteligencia artificial** para convertir una formulación en un experimento virtual trazable y generar un reporte técnico para su posterior revisión profesional.

**Track:** Future of Health & Wellbeing

**🔗 Producción:** [dermasense-rose.vercel.app](https://dermasense-rose.vercel.app)

---

# 1. Problema

La investigación y desarrollo cosmético requiere evaluar repetidamente ingredientes, concentraciones y formulaciones. Estos procesos pueden implicar consumo de reactivos, tiempo de laboratorio y diferentes métodos experimentales para estudiar la interacción y absorción cutánea.

DERMASENSE propone una etapa previa de **experimentación in silico**, donde el usuario puede modificar virtualmente una formulación y observar su comportamiento estimado sobre un modelo computacional de piel antes de realizar evaluaciones experimentales.

El sistema busca:

* Reducir experimentación física innecesaria durante las primeras etapas de formulación.
* Permitir comparar diferentes proporciones de ingredientes.
* Centralizar evidencia científica asociada a cada ingrediente.
* Visualizar la distribución estimada de los compuestos por capas de piel.
* Registrar cada formulación y sus resultados.
* Generar información estructurada para facilitar la revisión posterior por especialistas.

> **DERMASENSE no reemplaza ensayos experimentales, evaluación dermatológica, estudios toxicológicos ni procesos regulatorios.**

---

# 2. Propósito de DERMASENSE

El propósito principal es:

> **Permitir experimentar virtualmente con formulaciones cosméticas sobre un modelo 3D de piel, modificando las proporciones de sus ingredientes y observando mediante simulación computacional su comportamiento estimado a través de las capas cutáneas.**

El sistema sigue el ciclo:

```text
EVIDENCIA CIENTÍFICA
        ↓
INGREDIENTES
        ↓
FORMULACIÓN
        ↓
PROPORCIONES
        ↓
MACHINE LEARNING / QSPR
        ↓
SIMULACIÓN
        ↓
VISOR 3D
        ↓
RESULTADOS
        ↓
REPORTE
        ↓
REVISIÓN PROFESIONAL
```

---

# 3. Usuarios objetivo

| Usuario                   | Necesidad                                                               |
| ------------------------- | ----------------------------------------------------------------------- |
| Formulador cosmético      | Explorar diferentes proporciones antes de realizar pruebas físicas      |
| Investigador              | Analizar comportamiento dérmico mediante simulación                     |
| Estudiante                | Comprender visualmente la interacción y distribución de ingredientes    |
| Startup cosmética         | Comparar formulaciones de manera rápida durante etapas tempranas de I+D |
| Profesional especializado | Consultar resultados y evidencia generada por las simulaciones          |

---

# 4. Arquitectura funcional — 3 módulos

DERMASENSE se estructura en únicamente **tres módulos principales**.

```text
┌──────────────────────────────────────────┐
│               DERMASENSE                 │
├──────────────────────────────────────────┤
│                                          │
│  01 INGREDIENTES                         │
│       ↓                                  │
│  Evidencia + propiedades + ML/QSPR       │
│       ↓                                  │
│  02 VISOR 3D                             │
│       ↓                                  │
│  Formulación + proporciones + simulación │
│       ↓                                  │
│  03 REPORTES                             │
│       ↓                                  │
│  Historial + análisis + Excel            │
│                                          │
└──────────────────────────────────────────┘
```

---

# 5. Módulo 01 — Ingredientes

El módulo de ingredientes constituye la **biblioteca científica de DERMASENSE**.

El usuario puede seleccionar un ingrediente existente o registrar uno nuevo.

## Flujo

```text
Usuario
  ↓
Buscar ingrediente
  ↓
¿Existe en la biblioteca?
  │
  ├── Sí → Mostrar información científica
  │
  └── No → Investigación automatizada
              ↓
          Papers
          Artículos
          Tesis
          Datos experimentales
              ↓
          Extracción
              ↓
          Normalización
              ↓
          Perfil científico
              ↓
             Guardar
```

## Información almacenada

### Identificación

* Nombre.
* Sinónimos.
* Identificador químico.
* Estructura molecular.

### Propiedades fisicoquímicas

* Peso molecular.
* LogP.
* Solubilidad.
* Propiedades relevantes para el transporte cutáneo.
* Descriptores moleculares utilizados por el modelo QSPR/ML.

### Datos dérmicos

Cuando exista evidencia disponible:

* Permeabilidad.
* `Kp`.
* Flux.
* Retención cutánea.
* Fracción permeada.
* Concentración estudiada.
* Tiempo de exposición.

### Condiciones experimentales

* Modelo de piel.
* Zona anatómica.
* Área de aplicación.
* Vehículo.
* Concentración.
* Tiempo.
* Temperatura.
* pH.
* Método experimental.

### Evidencia

Cada dato debe conservar su procedencia:

* Título del estudio.
* Autores.
* Año.
* DOI o identificador de fuente.
* Tipo de estudio.
* Método.
* Fuente original.
* Nivel/calidad de evidencia.

La OECD TG 428 constituye una referencia metodológica importante para la absorción cutánea *in vitro*, incluyendo condiciones de exposición, concentración, formulación, área de aplicación y perfil de absorción a lo largo del tiempo.

## Machine Learning en Ingredientes

Machine Learning/QSPR se utilizará para trabajar con propiedades y relaciones cuantitativas de los ingredientes cuando exista suficiente información científica para construir y validar modelos.

```text
Datos científicos
       ↓
Características moleculares
       ↓
Dataset estructurado
       ↓
QSPR / Machine Learning
       ↓
Predicciones
```

El sistema conservará la diferencia entre:

```text
DATO EXPERIMENTAL
        ≠
DATO PREDICHO
```

Las predicciones deberán indicar el modelo utilizado y su nivel de incertidumbre/desempeño cuando corresponda.

## Acciones

```text
[ GUARDAR INGREDIENTE ]

[ CANCELAR ]
```

---

# 6. Módulo 02 — Visor 3D

El visor 3D constituye el **núcleo experimental de DERMASENSE**.

Aquí el usuario selecciona los ingredientes previamente almacenados y construye una formulación.

## Flujo

```text
Ingredientes guardados
        ↓
Seleccionar ingredientes
        ↓
Crear formulación
        ↓
Definir proporciones
        ↓
Definir condiciones
        ↓
Validación IA + ML
        ↓
Ejecutar simulación
        ↓
Motor de simulación
        ↓
Visualización 3D
        ↓
Estadísticas
        ↓
Interpretación IA
        ↓
Guardar
```

---

# 7. Constructor de formulación

Ejemplo:

```text
FORMULACIÓN #001

Cafeína          2 %
Glicerina        5 %
Propilenglicol   3 %
Vehículo        90 %

TOTAL           100 %
```

El usuario puede modificar libremente las proporciones dentro de los límites definidos por el modelo y la evidencia disponible.

Por ejemplo:

```text
Cafeína

1 % → simulación A

2 % → simulación B

4 % → simulación C
```

Cada modificación genera una nueva configuración experimental.

## Validación

El sistema comprobará:

```text
TOTAL = 100 %
```

Si la formulación es válida:

```text
✓ Formulación válida

[ SIMULAR ]
```

Si no:

```text
✕ Las proporciones de la formulación no son válidas.
```

## Acciones

```text
[ GUARDAR BORRADOR ]

[ CANCELAR ]

[ SIMULAR ]
```

---

# 8. Modelo computacional de piel

El MVP utilizará un modelo virtual de piel dividido en cuatro regiones:

```text
              SUPERFICIE
                  ↓
        ┌──────────────────┐
        │ ESTRATO CÓRNEO   │
        ├──────────────────┤
        │ EPIDERMIS VIABLE │
        ├──────────────────┤
        │ DERMIS           │
        ├──────────────────┤
        │ HIPODERMIS       │
        └──────────────────┘
```

## Zona anatómica inicial

**Abdomen**

La zona anatómica será parte de las condiciones de simulación para evitar mezclar automáticamente datos obtenidos de diferentes regiones de piel.

## Condiciones

```text
Zona:
Abdomen

Área:
[ configurable ]

Tiempo:
24 h

Puntos temporales:
0 h
1 h
6 h
12 h
24 h

Temperatura:
[ parámetro ]

pH:
[ parámetro ]

Vehículo:
[ según formulación ]

Concentración:
[ según formulación ]
```

Las condiciones experimentales deben conservarse junto con cada simulación, ya que la absorción cutánea depende de factores como formulación, concentración, tiempo y condiciones de exposición.

---

# 9. Machine Learning durante la formulación

Cuando el usuario modifica una proporción:

```text
Ingrediente
     +
Propiedades
     +
Concentración
     +
Vehículo
     +
Condiciones
     ↓
QSPR / ML
     ↓
Parámetros estimados
     ↓
Motor de simulación
```

Por ejemplo:

```text
Cafeína
2 %
     ↓
Propiedades moleculares
     ↓
Modelo QSPR/ML
     ↓
Predicción de parámetros
     ↓
Simulación
```

Al cambiar:

```text
Cafeína
2 % → 4 %
```

el sistema recalcula la formulación y genera una nueva simulación.

**El usuario controla las proporciones; el modelo calcula las consecuencias estimadas dentro de su dominio de aplicación.**

---

# 10. Motor de simulación

El motor será responsable del cálculo científico.

El MVP utilizará un modelo de **difusión pasiva basado en la segunda ley de Fick**, con un esquema numérico de diferencias finitas.

```text
Formulación
     ↓
Parámetros
     ↓
Motor de difusión
     ↓
t = 0 h
     ↓
t = 1 h
     ↓
t = 6 h
     ↓
t = 12 h
     ↓
t = 24 h
```

El motor no depende del LLM para realizar los cálculos.

```text
ML / QSPR
     ↓
Parámetros
     ↓
Motor matemático
     ↓
Resultados
```

---

# 11. Visor 3D

Los resultados del motor alimentarán la visualización:

```text
                 VISOR 3D

        ┌──────────────────────┐
        │ Estrato córneo       │
        ├──────────────────────┤
        │ Epidermis             │
        ├──────────────────────┤
        │ Dermis                │
        ├──────────────────────┤
        │ Hipodermis            │
        └──────────────────────┘

          Tiempo: 6 h
```

El usuario podrá avanzar por los diferentes puntos temporales y observar la distribución estimada del compuesto.

---

# 12. Estadísticas del visor

DERMASENSE mostrará un conjunto reducido de métricas relevantes.

## Transporte

* `Kp`.
* Flux.
* Lag time.

## Distribución

* Concentración estimada en estrato córneo.
* Concentración estimada en epidermis.
* Concentración estimada en dermis.
* Concentración estimada en hipodermis.

## Evolución temporal

* Concentración vs. tiempo.
* Concentración vs. profundidad.
* Distribución por capa.
* Fracción permeada.

## Comparación

```text
FORMULACIÓN #001
        VS
FORMULACIÓN #002
```

---

# 13. Inteligencia Artificial en el visor

La IA no reemplaza al motor científico.

Su función es **interpretar los resultados calculados**.

```text
Motor de simulación
        ↓
Resultados numéricos
        ↓
IA
        ↓
Interpretación
        ↓
Texto + voz
```

La IA podrá explicar:

* Qué capa presenta mayor concentración estimada.
* Cómo evolucionó la distribución.
* Qué cambió respecto a otra formulación.
* Qué variables tuvieron mayor influencia.
* Qué evidencia científica respalda los datos.
* Qué incertidumbres o limitaciones existen.

Ejemplo:

```text
"En el tiempo actual de simulación,
la mayor concentración estimada permanece
en las capas superficiales del modelo.
El resultado corresponde a la formulación
y condiciones seleccionadas."
```

La IA **no debe inventar reacciones químicas ni presentar una predicción como un resultado experimental real**.

---

# 14. Módulo 03 — Reportes

El módulo de reportes reúne el historial de las formulaciones realizadas en el visor.

```text
VISOR 3D
    ↓
FORMULACIÓN
    ↓
SIMULACIÓN
    ↓
RESULTADOS
    ↓
GUARDAR
    ↓
HISTORIAL
    ↓
REPORTE
```

Cada simulación conserva:

* Formulación.
* Ingredientes.
* Proporciones.
* Condiciones.
* Modelo de piel.
* Parámetros.
* Resultados ML/QSPR.
* Resultados de simulación.
* Estadísticas.
* Análisis IA.
* Evidencia científica utilizada.

---

# 15. Historial de formulaciones

Ejemplo:

```text
SIMULACIONES

#001
Cafeína 2 %
Glicerina 5 %
PG 3 %
24 h

[ VER ] [ COMPARAR ] [ DUPLICAR ]

--------------------------------

#002
Cafeína 4 %
Glicerina 5 %
PG 3 %
24 h

[ VER ] [ COMPARAR ] [ DUPLICAR ]
```

## Acciones

```text
[ VER ]

[ COMPARAR ]

[ DUPLICAR ]

[ ELIMINAR ]
```

La opción **Duplicar** permitirá crear una nueva formulación a partir de una anterior y modificar únicamente las proporciones necesarias.

---

# 16. Reporte Excel

Cada simulación podrá convertirse en un archivo `.xlsx`.

## Hoja 1 — Formulación

```text
ID
Fecha
Ingrediente
Concentración
Vehículo
Zona
Área
Tiempo
```

## Hoja 2 — Propiedades

```text
Ingrediente
Propiedad
Valor
Unidad
Fuente
DOI
```

## Hoja 3 — Evidencia

```text
Fuente
Tipo de estudio
Modelo experimental
Concentración
Condiciones
Resultado
DOI
```

## Hoja 4 — Simulación

```text
Tiempo
Capa
Concentración
Kp
Flux
Penetración
Fracción permeada
```

## Hoja 5 — Machine Learning

```text
Variable
Predicción
Modelo
Versión
Métrica de validación
Incertidumbre
```

## Hoja 6 — Análisis IA

```text
Resultado
Interpretación
Limitaciones
Evidencia utilizada
Riesgo predictivo
```

## Hoja 7 — Revisión regulatoria

```text
Jurisdicción
Requisito
Resultado preliminar
Fuente
Observaciones
```

---

# 17. Revisión profesional

El reporte de DERMASENSE está diseñado para ser utilizado como **insumo técnico para revisión profesional**.

```text
DERMASENSE
     ↓
SIMULACIÓN
     ↓
REPORTE
     ↓
DERMATÓLOGO /
TOXICÓLOGO /
FORMULADOR /
EVALUADOR DE SEGURIDAD
     ↓
REVISIÓN PROFESIONAL
```

DERMASENSE no emitirá una autorización automática de comercialización.

El sistema podrá mostrar:

```text
✓ Información disponible

⚠ Requiere revisión profesional

⚠ Evidencia insuficiente

⚠ Fuera del dominio del modelo
```

---

# 18. Revisión regulatoria

La revisión regulatoria será una **capa basada en reglas y fuentes**, no una predicción de Machine Learning.

Inicialmente podrá contemplar:

* Unión Europea — Reglamento (CE) N.º 1223/2009.
* Estados Unidos — Modernization of Cosmetics Regulation Act (MoCRA).
* Otras jurisdicciones como roadmap.

```text
FORMULACIÓN
     ↓
REQUISITOS REGULATORIOS
     ↓
BASE DE REGLAS
     ↓
VERIFICACIÓN
     ↓
RESULTADO PRELIMINAR
```

El resultado será informativo:

> **"Revisión regulatoria preliminar — requiere evaluación profesional."**

No:

> ❌ "Producto aprobado para comercialización."

En la Unión Europea existen requisitos formales de evaluación de seguridad antes de comercializar un cosmético. En Estados Unidos, MoCRA establece requisitos relacionados con la substanciación de seguridad y conservación de registros. ([eur-lex.europa.eu](https://eur-lex.europa.eu/eli/reg/2009/1223/2024-04-04/eng?utm_source=chatgpt.com)) ([fda.gov](https://www.fda.gov/cosmetics/cosmetics-laws-regulations/modernization-cosmetics-regulation-act-2022-mocra?utm_source=chatgpt.com))

---

# 19. Arquitectura de IA

DERMASENSE utilizará IA en tres funciones principales:

```text
                 IA DERMASENSE
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   INVESTIGACIÓN   INTERPRETACIÓN   ASISTENCIA
   CIENTÍFICA      DE RESULTADOS     POR VOZ
        │              │
        ▼              ▼
      RAG            LLM
```

Mientras que la parte cuantitativa será:

```text
       DATOS CIENTÍFICOS
              ↓
       DATASET ESTRUCTURADO
              ↓
          QSPR / ML
              ↓
        PREDICCIONES
              ↓
      SIMULACIÓN FÍSICA
```

### Principio fundamental

> **LLM ≠ motor científico**

El LLM interpreta y organiza información.

El modelo QSPR/ML realiza predicciones cuantitativas.

El motor matemático ejecuta la simulación.

El visor 3D representa los resultados.

---

# 20. Stack tecnológico

| Componente          | Tecnología                                        | Función                                |
| ------------------- | ------------------------------------------------- | -------------------------------------- |
| Frontend            | Next.js + React + TypeScript                      | Aplicación web                         |
| UI                  | Tailwind CSS + shadcn/ui                          | Interfaz                               |
| Visualización 3D    | Three.js + React Three Fiber + drei               | Modelo 3D de piel                      |
| Backend             | Python + FastAPI                                  | API científica                         |
| Machine Learning    | Python + scikit-learn                             | Modelos predictivos                    |
| QSPR                | RDKit                                             | Descriptores y propiedades moleculares |
| Datos científicos   | Pandas + NumPy                                    | Procesamiento de datasets              |
| Simulación          | NumPy + SciPy                                     | Modelo matemático                      |
| IA                  | LLM + RAG                                         | Extracción e interpretación            |
| Base de datos       | PostgreSQL / Supabase                             | Persistencia                           |
| Búsqueda científica | APIs/fuentes científicas + pipeline de extracción | Evidencia                              |
| Vector Search       | pgvector                                          | Recuperación de evidencia              |
| Excel               | Python + openpyxl                                 | Generación de reportes                 |
| Voz                 | Text-to-Speech                                    | Explicación durante la simulación      |
| Deploy frontend     | Vercel                                            | Producción                             |
| Testing frontend    | Vitest                                            | Pruebas                                |
| Testing backend     | Pytest                                            | Pruebas científicas/API                |

---

# 21. Arquitectura técnica

```text
                         FRONTEND
              ┌─────────────────────────┐
              │ Next.js / React / TS    │
              │                         │
              │ Ingredientes            │
              │ Visor 3D                │
              │ Reportes                │
              └────────────┬────────────┘
                           │
                           ▼
                     FASTAPI
                           │
          ┌────────────────┼─────────────────┐
          ▼                ▼                 ▼
     SCIENTIFIC AI      ML / QSPR        SIMULATOR
          │                │                 │
          ▼                ▼                 ▼
        RAG             RDKit            NumPy
          │           scikit-learn         SciPy
          │                │                 │
          └────────────────┼─────────────────┘
                           │
                           ▼
                      PostgreSQL
                       Supabase
                           │
                           ▼
                     HISTORIAL
                           │
                           ▼
                     REPORTES XLSX
```

---

# 22. Base de datos

## `ingredients`

Información principal de cada ingrediente.

```text
id
name
synonyms
chemical_identifier
molecular_weight
logp
solubility
molecular_structure
created_at
```

## `evidence`

Fuentes científicas.

```text
id
ingredient_id
title
authors
year
doi
source
study_type
skin_model
anatomical_site
concentration
vehicle
exposure_time
temperature
ph
result
evidence_quality
```

## `formulations`

Formulaciones creadas.

```text
id
name
created_at
status
```

## `formulation_ingredients`

Relación entre formulación e ingredientes.

```text
formulation_id
ingredient_id
concentration
```

## `simulations`

Configuración de cada experimento virtual.

```text
id
formulation_id
skin_model
anatomical_site
area
duration
temperature
ph
created_at
```

## `simulation_results`

Resultados temporales.

```text
simulation_id
time
layer
concentration
kp
flux
penetration
fraction_permeated
```

## `ml_predictions`

Predicciones del modelo.

```text
simulation_id
model_version
variable
prediction
uncertainty
validation_metric
```

## `reports`

Resultados finales.

```text
simulation_id
ai_analysis
risk_analysis
regulatory_analysis
report_path
created_at
```

---

# 23. Flujo completo del sistema

```text
                         USUARIO
                            │
                            ▼
                 ┌───────────────────┐
                 │ 01 INGREDIENTES   │
                 └─────────┬─────────┘
                           │
                    IA + evidencia
                           │
                           ▼
                  PERFIL CIENTÍFICO
                           │
                           ▼
                 ┌───────────────────┐
                 │ 02 VISOR 3D       │
                 └─────────┬─────────┘
                           │
                  seleccionar
                  ingredientes
                           │
                           ▼
                     proporciones
                           │
                           ▼
                     condiciones
                           │
                           ▼
                       ML/QSPR
                           │
                           ▼
                  MOTOR SIMULACIÓN
                           │
                           ▼
                       PIEL 3D
                           │
               ┌───────────┼───────────┐
               ▼           ▼           ▼
             TIEMPO    ESTADÍSTICAS    IA
               │           │           │
               └───────────┼───────────┘
                           ▼
                        GUARDAR
                           │
                           ▼
                 ┌───────────────────┐
                 │ 03 REPORTES       │
                 └─────────┬─────────┘
                           │
                           ▼
                       HISTORIAL
                           │
                    ┌──────┴──────┐
                    ▼             ▼
                COMPARAR       EXPORTAR
                                  │
                                  ▼
                              EXCEL
                                  │
                                  ▼
                       REVISIÓN PROFESIONAL
```

---

# 24. Modelo científico

El MVP utilizará:

### Transporte

**Segunda ley de Fick**

```text
∂C/∂t = D · ∂²C/∂x²
```

para representar la evolución temporal de la concentración dentro del modelo de piel.

### Permeabilidad

Se utilizarán relaciones QSPR/QSAR respaldadas por evidencia científica para estimar parámetros cuando los datos experimentales directos no estén disponibles.

La implementación completa, supuestos, parámetros, condiciones de frontera, discretización y limitaciones se documentará en:

```text
docs/SIMULATION_MODEL.md
```

---

# 25. Métricas de Machine Learning

Los modelos predictivos deberán evaluarse con datos separados de entrenamiento y evaluación.

Dependiendo del modelo y del dataset se podrán reportar:

```text
MAE
RMSE
R²
MAPE
```

Además:

```text
Modelo
Versión
Dataset
Variables utilizadas
Dominio de aplicación
Métricas
Incertidumbre
```

DERMASENSE no presentará una predicción fuera del dominio de aplicación como si fuera un resultado confiable.

---

# 26. Fuera de alcance del MVP

DERMASENSE **no** pretende:

* Sustituir ensayos de laboratorio.
* Sustituir ensayos OECD.
* Sustituir pruebas de Franz Cell.
* Diagnosticar enfermedades.
* Certificar seguridad cosmética.
* Aprobar productos para comercialización.
* Emitir una autorización regulatoria.
* Afirmar que una reacción simulada ocurrirá necesariamente en una persona.
* Utilizar IA generativa como sustituto de modelos científicos.
* Presentar predicciones sin indicar su evidencia o incertidumbre.

---

# 27. Aviso científico

DERMASENSE es un **sistema computacional exploratorio de apoyo a la investigación y desarrollo cosmético**.

Las simulaciones representan estimaciones obtenidas a partir de modelos matemáticos, datos experimentales disponibles y modelos predictivos.

Los resultados:

* No constituyen evidencia clínica.
* No constituyen diagnóstico.
* No constituyen validación regulatoria.
* No sustituyen ensayos experimentales.
* Deben ser interpretados dentro del dominio y limitaciones del modelo.

Las decisiones sobre seguridad, formulación final y comercialización deben ser realizadas por profesionales competentes y conforme a los requisitos regulatorios aplicables.

---

# 28. Documentación

| Documento                     | Contenido                               | Estado |
| ----------------------------- | --------------------------------------- | --- |
| `docs/PRD.md`                 | Product Requirement Document            | ✅ |
| `docs/TRD.md`                 | Technical Requirement Document          | ✅ |
| `docs/ARCHITECTURE.md`        | Arquitectura del sistema                | ✅ |
| `docs/API_CONTRACT.md`        | **Contrato frontend ↔ backend Python**, para trabajar en paralelo | ✅ |
| `docs/APP_FLOW.md`            | Flujo de los tres módulos               | ✅ |
| `docs/UI_UX_DESIGN_BRIEF.md`  | Diseño de interfaz                      | ✅ |
| `docs/BACKEND_SCHEMA.md`      | Esquema PostgreSQL                      | ✅ |
| `docs/SIMULATION_MODEL.md`    | Modelo matemático                       | ✅ |
| `docs/DATA_SOURCES.md`        | Procedencia de cada dato: qué es real, qué es estimado | ✅ |
| `docs/ML_MODEL.md`            | Dataset, features, modelos y validación | ⏳ Pendiente (Tonny) |
| `docs/SCIENTIFIC_EVIDENCE.md` | Fuentes y trazabilidad                  | ⏳ Pendiente (Tonny) |
| `docs/AI_PIPELINE.md`         | Pipeline de IA/RAG                      | ⏳ Pendiente (Tonny) |
| `docs/REPORT_SCHEMA.md`       | Estructura de reportes                  | ⏳ Pendiente (Tonny) |
| `docs/REGULATORY_RULES.md`    | Reglas y fuentes regulatorias           | ⏳ Pendiente (Tonny) |
| `docs/IMPLEMENTATION_PLAN.md` | Plan de implementación                  | ✅ |
| `docs/adr/`                   | Decisiones de arquitectura, incluyendo por qué el motor es TS y no Python | ✅ |

---

# 29. Setup local

```bash
git clone https://github.com/<org>/dermasense.git

cd dermasense

npm install

cp .env.example .env.local

npm run dev
```

Backend:

```bash
cd backend

python -m venv .venv

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Testing:

```bash
npm test

pytest
```

---

# 30. Integrantes

| Nombre        | GitHub               | Rol                                      |
| ------------- | -------------------- | ---------------------------------------- |
| Jeanfranco Chamorro   | `@jeanfrancochamorro-jpg` | Tech Lead / Arquitectura / Simulación    |
| Max Morales   | `@maxmorales`                  | Frontend / Visualización 3D              |
| Tonny Hinstroza | `@tonnyhinostroza`                  | Backend / ML / IA                        |
| Julio Rios    | `@juliorios`                  | Producto / Investigación / Documentación |

---

# 31. Resumen

DERMASENSE integra:

```text
        EVIDENCIA CIENTÍFICA
                ↓
          INGREDIENTES
                ↓
        FORMULACIÓN VIRTUAL
                ↓
           PROPORCIONES
                ↓
            ML / QSPR
                ↓
       SIMULACIÓN CUTÁNEA
                ↓
             VISOR 3D
                ↓
       ESTADÍSTICAS + IA
                ↓
           HISTORIAL
                ↓
          REPORTE EXCEL
                ↓
      REVISIÓN PROFESIONAL
```

> **DERMASENSE: formula, simula, visualiza y documenta antes de experimentar físicamente.**

---

# Licencia

MIT
