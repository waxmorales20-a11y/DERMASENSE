# Fuentes de Datos y Procedencia — DERMASENSE

> Este documento existe para responder una sola pregunta, la más difícil que puede hacer
> un jurado, un cliente o un revisor científico:
>
> **"¿De dónde salió ese número?"**
>
> Si un valor no puede responderla, no debe presentarse como resultado sin una etiqueta que
> lo advierta. Este documento es la fuente de verdad sobre la procedencia de cada dato del
> sistema.

---

## 1. Los cuatro niveles de calidad del dato

Cada parámetro del sistema lleva un nivel. El nivel se guarda en la base de datos junto al
valor, viaja con la simulación y **se muestra en la interfaz**.

| Nivel | Significado | Qué se puede afirmar |
|---|---|---|
| ✅ **Verificado** | Valor experimental con cita exacta (identificador de registro, publicación) | "Medido en laboratorio, fuente X" |
| 🔶 **Literatura** | Valor dentro de un rango publicado y aceptado, pero sin cita fijada a ese número concreto | "Valor típico reportado en literatura" |
| ⚠️ **Estimado** | Derivado por cálculo, escalado o analogía a partir de otro dato | "Estimado a partir de X mediante Y" |
| ❌ **Heurístico** | Construido por nosotros sin base experimental | "Criterio propio, no validado" |

**Regla de propagación:** una simulación no puede tener mejor confianza que su peor
ingrediente. Si un solo parámetro es ❌, el resultado se marca como exploratorio.

Esto no es burocracia. Es el mecanismo que impide que el producto mienta por omisión.

---

## 2. Auditoría del estado actual (2026-09-05)

Estado real del motor implementado hoy, sin maquillaje:

| Dato | Valor actual | Nivel | Acción requerida |
|---|---|---|---|
| MW, logP, pKa de 12 activos | Desde PubChem | ✅ | Ampliar a ~60, guardar el CID por campo |
| Ecuación Potts-Guy | `-2.7 + 0.71*logP - 0.0061*MW` | ✅ | Ninguna. Publicada y citada |
| Espesor del estrato córneo | 20 µm fijo | 🔶 | Parametrizar por sitio anatómico (§4) |
| Difusividad del SC | Derivada de Kp | ⚠️ | Correcto: anclada a correlación publicada |
| **Difusividad de epidermis y dermis** | **Constante fija** | ❌ | **Error físico. Debe depender del tamaño molecular (§5)** |
| Clearance dérmico | `1e-3 s^-1` | 🔶 | Fijar cita o marcar como estimado |
| **`enhancerFactor` del vehículo** | **1.0 - 1.85** | ❌ | **Inventados. Ver §6** |
| **Pesos de irritación por clase** | **0.6 - 1.0** | ❌ | **Inventados. Ver §7** |
| **`referenceThreshold`** | **5 % de la concentración del vehículo** | ❌ | **Circular. Sustituir por límite regulatorio (§7)** |
| Validación experimental | Ninguna | — | Dataset de Flynn (§8) |

**Lectura honesta:** el esqueleto físico (Potts-Guy + Fick + balance de masa) es sólido y
citable. Lo que está flojo es la periferia: el efecto del vehículo, la irritación y la
difusividad en tejido acuoso. Son exactamente los puntos que este documento cierra.

---

## 3. Datos de ingredientes

### 3.1 Qué necesita el motor

| Campo | Uso en el motor | Obligatorio |
|---|---|---|
| `molecular_weight` | Potts-Guy + escalado de difusividad | Sí |
| `log_p` | Potts-Guy + coeficiente de partición | Sí |
| `pka` | Ionización según el pH (v2) | No |
| `inci_name` | Nomenclatura legal cosmética | Recomendado |
| `risk_flags` | Índice heurístico de irritación | No |
| `max_use_concentration` | Umbral regulatorio (§7) | Recomendado |

### 3.2 Estrategia: curación manual de ~60 activos

**Decisión:** se curan a mano, no se importan automáticamente.

**Por qué.** PubChem devuelve con frecuencia `XLogP3`, que es un logP *calculado por
computadora*, no medido. Para el motor la diferencia importa: `logP` entra en Potts-Guy
multiplicado por 0.71, así que un error de 0.5 unidades desplaza `log Kp` en 0.35 — un
factor de más de 2 en permeabilidad. Además la resolución automática por nombre confunde
sales, isómeros y derivados (retinol / retinal / palmitato de retinilo son tres moléculas
distintas con el mismo prefijo comercial).

**Coste real:** ~60 activos por 3 minutos cada uno son unas 3 horas de curación. Es
asumible, y es la diferencia entre un catálogo defendible y uno decorativo.

### 3.3 Procedencia por campo, no por fila

Cada valor guarda su propia fuente. Un ingrediente puede tener el peso molecular verificado
y el logP estimado:

```jsonc
{
  "name": "Ácido salicílico",
  "molecular_weight": 138.12,
  "log_p": 2.26,
  "sources": {
    "molecular_weight": { "db": "PubChem", "id": "CID 338", "level": "verified" },
    "log_p":            { "db": "PubChem", "id": "CID 338", "type": "experimental", "level": "verified" },
    "pka":              { "db": "PubChem", "id": "CID 338", "level": "verified" }
  }
}
```

Si `log_p` viniera de `XLogP3`, el campo `type` sería `"calculated"` y el nivel bajaría a
⚠️ **Estimado**, y la interfaz lo mostraría con un icono distinto.

### 3.4 Fuentes admitidas, en orden de preferencia

1. **PubChem** (NIH, EE. UU.) — gratuita, con CID estable. Preferir siempre el logP
   experimental sobre el calculado.
2. **CosIng** (Comisión Europea) — autoridad en nomenclatura INCI y restricciones legales.
3. **DrugBank / ChEMBL** — útiles para activos de origen farmacéutico.
4. **Ficha técnica del proveedor** — para activos comerciales patentados. Nivel 🔶.

### 3.5 Lista objetivo de curación (~60 activos)

Se priorizan por frecuencia de uso real en formulación cosmética:

- **Retinoides (5):** retinol, retinal, palmitato de retinilo, retinoato de hidroxipinacolona, adapaleno
- **Ácidos exfoliantes (8):** glicólico, láctico, mandélico, salicílico, málico, tartárico, azelaico, polihidroxiácidos
- **Antioxidantes (8):** ácido ascórbico, ascorbil fosfato de magnesio, ascorbil glucósido, tocoferol, ácido ferúlico, resveratrol, ácido lipoico, coenzima Q10
- **Despigmentantes (6):** ácido kójico, arbutina, alfa-arbutina, ácido tranexámico, ácido tióctico, niacinamida
- **Hidratantes y barrera (7):** glicerina, urea, pantenol, ceramida NP, ceramida AP, colesterol, escualano
- **Péptidos (5):** acetil hexapéptido-8, palmitoil pentapéptido-4, cobre GHK, palmitoil tripéptido-1, acetil tetrapéptido-5
- **Filtros solares (8):** avobenzona, octinoxato, octocrileno, homosalato, óxido de zinc, dióxido de titanio, bemotrizinol, bisoctrizol
- **Calmantes (5):** bisabolol, alantoína, ácido glicirretínico, madecasósido, asiaticósido
- **Conservantes y otros (8):** fenoxietanol, alcohol bencílico, cafeína, ácido hialurónico (varios pesos), adenosina, ectoína, bakuchiol, ácido salicílico de origen natural

> Se incluyen deliberadamente casos que **caen fuera del dominio del modelo**: péptidos,
> ácido hialurónico de alto peso, óxidos metálicos. No son un defecto del catálogo: son la
> demostración en vivo de que el sistema reconoce sus propios límites en lugar de inventar
> un resultado.

### 3.6 Ingredientes privados del usuario

**Decisión tomada: sí, introduciendo los números a mano.**

Caso de uso real: una formuladora desarrolla un activo que su proveedor acaba de patentar.
No existe en ninguna base pública, pero ella tiene MW y logP en la ficha técnica.

Reglas:

- El ingrediente pertenece a su creador (`owner_id`), **nunca** entra al catálogo público.
- Aislado por Row Level Security: ningún otro usuario puede leerlo ni por accidente.
- Nivel de dato: 🔶 **Literatura** (declarado por el usuario), nunca ✅.
- La simulación resultante se marca como "ingrediente definido por el usuario".
- Se validan rangos físicos al introducirlo (MW > 0, -5 <= logP <= 10) para evitar
  resultados absurdos por un error de tecleo.

Esto es propiedad intelectual sensible: es el dato más confidencial que la plataforma va a
tocar. El aislamiento no es una funcionalidad, es un requisito de adopción.

---

## 4. Modelos de piel por sitio anatómico

**Decisión tomada: parametrizado por sitio anatómico.**

### 4.1 Por qué importa tanto

El estrato córneo es la barrera limitante, y su espesor **varía más de 20 veces** entre
zonas del cuerpo. Simular una crema facial con parámetros de antebrazo introduce un error
mayor que casi cualquier otra decisión del modelo. Un formulador de cosmética facial lo
detecta de inmediato, y es el tipo de detalle que separa una herramienta creíble de una
demo.

### 4.2 Presets

| Sitio | SC (µm) | Epidermis viable (µm) | Dermis (µm) | Nivel | Nota |
|---|---|---|---|---|---|
| **Antebrazo (volar)** | 15-20 | 50-80 | 1000-1500 | 🔶 | Sitio de referencia de la mayoría de estudios *in vitro*. Valor por defecto |
| **Rostro (mejilla)** | 10-15 | 40-60 | 900-1200 | 🔶 | Barrera más delgada: mayor penetración |
| **Frente** | 12-16 | 50-70 | 1000-1400 | 🔶 | Alta densidad sebácea |
| **Cuero cabelludo** | 15-20 | 50-70 | 1200-1800 | 🔶 | Alta densidad folicular: la vía anexial, que el modelo NO simula, pesa más aquí |
| **Abdomen** | 13-18 | 50-80 | 1500-2500 | 🔶 | Frecuente en estudios *ex vivo* con piel de cirugía |
| **Palma / planta** | 400-600 | 300-500 | 1500-2000 | 🔶 | Barrera extrema. Caso límite útil para demostrar el contraste |

> **Estado:** todos los valores son 🔶 **Literatura**. Son rangos ampliamente reportados y
> el ordenamiento relativo entre sitios es sólido, pero **falta fijar la cita exacta de cada
> número**. Es la primera tarea de curación (§9). Hasta entonces, la interfaz debe mostrar
> el rango, no un valor puntual con falsa precisión.

### 4.3 Advertencia específica del cuero cabelludo

En cuero cabelludo la penetración por folículo piloso puede dominar en las primeras horas.
El modelo **solo simula difusión pasiva transepidérmica**, así que en este sitio
*subestima* la penetración temprana. La interfaz debe advertirlo explícitamente al
seleccionar ese preset. Callarlo sería el tipo de omisión que destruye la confianza cuando
un experto la detecta.

---

## 5. Corrección física: la difusividad depende de la molécula

### 5.1 El error actual

El motor usa hoy una difusividad **fija** en epidermis viable y dermis
(`1e-7` y `5e-7 cm²/s`), idéntica para todas las moléculas. Eso implica que la cafeína
(194 g/mol) y un péptido (800 g/mol) difundirían por la dermis a la misma velocidad, lo
cual es físicamente falso.

### 5.2 La corrección

En medio acuoso, la relación de **Stokes-Einstein** da `D ∝ 1/r`, y para una esfera
`r ∝ MW^(1/3)`, de donde `D ∝ MW^(-1/3)`. En tejido, la obstrucción celular y la
tortuosidad hacen la caída más pronunciada; en modelado de absorción dérmica se emplean
habitualmente exponentes entre 0.5 y 0.6.

Se adopta:

```
D_tejido(MW) = D_ref * (MW_ref / MW)^0.6
```

con `MW_ref = 138 g/mol` (ácido salicílico) y `D_ref` anclado al valor de literatura de esa
capa. La epidermis viable recibe un `D` menor que la dermis por su mayor densidad celular.

| Parámetro | Valor | Nivel |
|---|---|---|
| Forma de la ley de escala | `MW^(-0.6)` | 🔶 Base física en Stokes-Einstein, exponente de literatura de difusión en tejido |
| Prefactor `D_ref` por capa | Anclado a valor típico | ⚠️ **Estimado. Pendiente de fijar cita** |

**Efecto esperado:** las moléculas grandes se frenarán en dermis, aumentando su tiempo de
residencia en epidermis viable. Eso **cambiará el índice de irritación** de los activos
pesados. Es una corrección con consecuencias, no cosmética.

> El estrato córneo **no** usa esta ley: su difusividad se deriva de `Kp` vía Potts-Guy, que
> ya incorpora la dependencia con MW dentro de la correlación. Aplicar ambas sería contar
> el mismo efecto dos veces.

---

## 6. Efecto del vehículo — el dato más débil del sistema

### 6.1 Estado honesto

Los valores de `enhancerFactor` (1.0 para agua, 1.6 para hidroalcohólico, 1.85 para
propilenglicol) **son inventados**. Son plausibles en su ordenamiento pero **no tienen
respaldo experimental**. Es el punto más atacable del proyecto.

### 6.2 Por qué no tiene solución limpia

En la literatura, el efecto de un potenciador se expresa como *enhancement ratio* (ER):
el cociente entre el flujo con potenciador y sin él. El problema es que **el ER es
específico del par potenciador-molécula**: el etanol multiplica el flujo de un activo
lipofílico de forma muy distinta a como lo hace con uno hidrofílico. No existe un factor
universal por vehículo.

Un `enhancerFactor` único por vehículo es, por construcción, una simplificación gruesa.

### 6.3 Qué se hace

1. **Declararlo sin ambigüedad.** Nivel ❌ **Heurístico**, visible en la interfaz junto al
   selector de vehículo, no escondido en la documentación.
2. **Hacerlo editable.** El formulador que conoce su sistema puede introducir su propio ER
   medido. Convierte una debilidad en un punto de extensibilidad.
3. **Acotar el efecto.** Rango 0.1-5.0, para impedir que un valor absurdo produzca un
   resultado sin sentido.
4. **Roadmap:** tabla de ER por par potenciador-clase de molécula, poblada desde literatura.

**Alternativa considerada y descartada:** eliminar la selección de vehículo de la v1. Se
descarta porque comparar vehículos es el caso de uso número uno del formulador. Es mejor
ofrecerlo declarando su incertidumbre que no ofrecerlo.

---

## 7. Umbrales regulatorios — el dato real que hoy falta

### 7.1 El problema actual

El `referenceThreshold` que normaliza el índice de irritación se calcula hoy como el 5 % de
la concentración del vehículo. Es **circular**: el umbral depende de la propia dosis, así
que duplicar la concentración no cambia la señal de riesgo. No informa de nada.

### 7.2 La sustitución: límites de uso reales

Existe dato real, público y autoritativo para esto:

| Fuente | Qué aporta | Ámbito |
|---|---|---|
| **Reglamento (CE) 1223/2009, Anexos II-VI** | Sustancias prohibidas y concentraciones máximas legales | UE, vinculante |
| **CosIng** | Interfaz consultable de los anexos anteriores | UE |
| **Opiniones del SCCS** | Dictámenes científicos con límites recomendados | UE |
| **CIR (Cosmetic Ingredient Review)** | Concentraciones de uso seguro evaluadas | EE. UU., de referencia |

El campo `max_use_concentration` pasa a ser el denominador del índice de irritación. Así el
índice deja de ser autorreferencial y pasa a decir algo interpretable:
**"la exposición estimada en epidermis viable respecto al límite de uso aceptado"**.

Ejemplos del tipo de restricción existente (**a verificar contra CosIng durante la
curación**, no citar de memoria en el pitch):

- Ácido salicílico: restringido en la UE, con límites distintos para productos que se
  aclaran y los que no.
- Retinol: el SCCS ha emitido dictamen con límites diferenciados para rostro y cuerpo.
- Ácido glicólico: restringido con condiciones de pH mínimo.
- Hidroquinona: prohibida en cosmética en la UE.

> Estas restricciones **cambian con el tiempo**. El esquema guarda `regulation_version` y
> `checked_at` en cada fila para que un valor desactualizado sea detectable, no invisible.

### 7.3 Los pesos por clase de ingrediente

Los pesos del índice heurístico (retinoide 1.0, tensioactivo 0.9, AHA 0.8) también son
inventados. Se mantienen porque el **ordenamiento relativo** es defendible —un retinoide
irrita más que un humectante, eso no está en discusión— pero:

- Se etiquetan como ❌ **Heurístico** en la interfaz.
- El índice se presenta siempre como **comparador entre formulaciones**, nunca como
  predicción absoluta de tolerancia.
- Se documenta que su utilidad es ordenar candidatos, no aprobar uno.

---

## 8. Validación: el dataset de Flynn

### 8.1 Qué es

Un conjunto público y ampliamente reproducido de aproximadamente **90 compuestos con
coeficiente de permeabilidad medido experimentalmente en piel humana**. Es, precisamente,
el conjunto sobre el que Potts y Guy ajustaron su correlación en 1992.

### 8.2 Cómo se usa

1. Se carga como tabla de referencia (`validation_records`).
2. Se ejecuta el motor sobre los 90 compuestos.
3. Se calcula el error entre `log Kp` predicho y medido: RMSE, R² y fracción dentro de un
   orden de magnitud.
4. Se publica el gráfico predicho-vs-medido dentro del producto, no solo en la
   documentación.

### 8.3 Qué permite afirmar — y qué no

**Sí permite decir:** "El motor reproduce las permeabilidades experimentales del conjunto de
referencia con un error de X". Eso es un número medido, no una promesa.

**No permite decir:** "El modelo está validado para uso regulatorio". Sigue sin estarlo, y
además hay una limitación de honestidad que debe quedar escrita: **Potts-Guy fue ajustada
sobre este mismo conjunto**, así que evaluarla contra él mide *reproducción*, no *capacidad
predictiva sobre datos nuevos*. Presentarlo como validación independiente sería deshonesto.

Para una evaluación limpia haría falta un conjunto de prueba externo. Queda declarado como
siguiente paso, y esa distinción —anunciada por nosotros antes de que la detecte un
revisor— es exactamente lo que da credibilidad.

### 8.4 Estado

⚠️ **Pendiente de obtener.** El conjunto está tabulado en la literatura y reproducido en
bases como EDETOX. Hay que conseguirlo y verificarlo antes de afirmar nada.

---

## 9. Plan de curación, en orden de impacto

| # | Tarea | Impacto | Esfuerzo |
|---|---|---|---|
| 1 | Corregir la difusividad dependiente de MW (§5) | **Corrige un error físico** | 1 h |
| 2 | Sustituir `referenceThreshold` por límite regulatorio (§7) | Convierte el índice de irritación en algo interpretable | 2 h |
| 3 | Fijar citas de los presets de sitio anatómico (§4) | Sube 6 filas de 🔶 a ✅ | 2 h |
| 4 | Curar ~60 activos con procedencia por campo (§3) | Catálogo defendible | 3 h |
| 5 | Cargar y ejecutar el dataset de Flynn (§8) | **Respuesta demostrable a "¿esto es real?"** | 3 h |
| 6 | Marcar `enhancerFactor` como editable y heurístico (§6) | Cierra el punto más atacable | 1 h |
| 7 | Tabla de *enhancement ratio* por par potenciador-molécula | Elimina la última ❌ | Roadmap |

**Si solo hay tiempo para dos, deben ser la 1 y la 5.** La primera corrige algo que está
mal; la segunda es la única que convierte "confía en nosotros" en un número.

---

## 10. Resumen de decisiones

| Decisión | Elección | Quién decidió |
|---|---|---|
| Modelo de piel | Parametrizado por sitio anatómico | Equipo |
| Ingredientes propios del usuario | Sí, con entrada manual de descriptores | Equipo |
| Llenado del catálogo | Curación manual de ~60 activos con procedencia por campo | Recomendación técnica |
| Validación | Dataset de Flynn, declarando su limitación de circularidad | Recomendación técnica |
| Efecto del vehículo | Se mantiene como heurístico declarado y editable | Recomendación técnica |
| Umbral de irritación | Se sustituye por límite regulatorio real | Recomendación técnica |
