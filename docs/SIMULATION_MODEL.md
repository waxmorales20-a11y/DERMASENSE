# Modelo de Simulación — DERMASENSE

> Este documento es la fuente de verdad científica del proyecto. Define **qué se calcula,
> con qué ecuaciones, bajo qué supuestos y qué NO puede afirmarse** con estos resultados.

---

## 1. Geometría: la piel como sistema multicapa

Se modela la piel como un medio unidimensional (dirección `x`, perpendicular a la superficie)
compuesto por cuatro estratos en serie. La difusión lateral se desprecia: para aplicación
tópica uniforme, el gradiente dominante es el transversal.

| # | Capa | Espesor por defecto | D por defecto (cm²/s) | Rol en el modelo |
|---|---|---|---|---|
| 0 | Estrato córneo (SC) | 20 µm | 1.0 × 10⁻¹⁰ | Barrera limitante de velocidad |
| 1 | Epidermis viable (VE) | 80 µm | 1.0 × 10⁻⁷ | Sitio de irritación / células vivas |
| 2 | Dermis | 1800 µm | 5.0 × 10⁻⁷ | Difusión + eliminación por microcirculación |
| 3 | Hipodermis | 1200 µm | 1.0 × 10⁻⁷ | Reservorio lipofílico terminal |

Los valores son parámetros configurables (`SkinModel`), no constantes ocultas. Los defaults
provienen de rangos reportados en literatura de absorción percutánea; se documentan como
**referenciales**, no como medidas propias.

---

## 2. Permeabilidad del estrato córneo — Potts & Guy (1992)

La correlación QSPR más usada en la industria para estimar el coeficiente de permeabilidad
de la piel a partir de dos descriptores moleculares:

```
log Kp = -2.7 + 0.71 · logP − 0.0061 · MW
```

- `Kp` en cm/h — coeficiente de permeabilidad piel/agua.
- `logP` — coeficiente de partición octanol/agua.
- `MW` — peso molecular (g/mol).

**Dominio de aplicabilidad declarado** (fuera de él, la UI marca la predicción como
*baja confianza*):

- `MW ≤ 500 g/mol` (regla de los 500 Dalton de Bos & Meinardi para penetración cutánea)
- `−1 ≤ logP ≤ 6`

### Coeficiente de partición SC/vehículo

```
log K_sc/v = 0.74 · logP
```

Determina el salto de concentración en la interfase vehículo→SC y en cada interfase interna
mediante continuidad de potencial químico:

```
C_i · K_{i+1} = C_{i+1} · K_i     (condición de interfase)
```

### Difusividad efectiva del SC

Derivada de `Kp` y del espesor, de forma consistente con el modelo de membrana homogénea:

```
D_sc = Kp · h_sc / K_sc/v
```

Esto **evita inventar un D arbitrario**: la difusividad queda anclada a una correlación
publicada.

---

## 3. Transporte: 2ª ley de Fick con eliminación

Dentro de cada capa `i`:

```
∂C/∂t = D_i · ∂²C/∂x²  −  k_i · C
```

donde `k_i` es la constante de eliminación de primer orden. Solo la dermis tiene `k > 0`
(`k_dermis = 1.0 × 10⁻³ s⁻¹`), representando el *clearance* por la microcirculación
capilar — el sumidero fisiológico que impide acumulación indefinida.

### Condiciones de frontera

- **x = 0 (superficie):** dosis finita. El vehículo se agota conforme el activo penetra:
  ```
  C_vehículo(t+Δt) = C_vehículo(t) − (J_entrada · A · Δt) / V_vehículo
  ```
  Esto es lo que diferencia una aplicación cosmética real (dosis finita, ~2 mg/cm²) de un
  ensayo de dosis infinita.
- **x = L (base de la hipodermis):** sumidero perfecto, `C = 0`.

### Esquema numérico

Diferencias finitas explícitas (FTCS) sobre malla no uniforme, refinada en el SC:

```
C_j^{n+1} = C_j^n + Δt · [ D · (C_{j+1}^n − 2C_j^n + C_{j-1}^n)/Δx²  −  k · C_j^n ]
```

**Estabilidad:** el paso temporal se calcula automáticamente respetando la condición de
Courant–Friedrichs–Lewy para difusión, con margen de seguridad:

```
Δt = 0.4 · min_i( Δx_i² / D_i )
```

Se valida en tests que la solución conserva masa (entrada = acumulado + eliminado + salida)
con error < 1 %.

---

## 4. Métricas de salida

| Métrica | Definición | Unidad |
|---|---|---|
| `logKp` | Potts–Guy | log(cm/h) |
| `steadyStateFlux` | `J = Kp · C_vehículo` | µg/cm²/h |
| `lagTime` | `t_lag = h_sc² / (6 · D_sc)` | h |
| `absorbedFraction24h` | masa que cruzó el SC / masa aplicada | % |
| `penetrationDepth` | `x` donde `C(x) = 0.05 · C_max` a las 24 h | µm |
| `peakConcentrationVE` | máximo de `C` en epidermis viable | µg/cm³ |
| `irritationIndex` | heurístico, sección 5 | 0–100 |
| `confidence` | `high` / `medium` / `low` según dominio de aplicabilidad | enum |

---

## 5. Índice de irritación — HEURÍSTICO, NO VALIDADO

> **Declaración de honestidad científica.** Esto NO es un modelo predictivo validado.
> Es un agregador ponderado de factores de riesgo conocidos, diseñado para **ordenar
> formulaciones entre sí** (comparación relativa), no para emitir un veredicto de seguridad.
> La UI lo muestra siempre con la etiqueta *"estimación exploratoria — no regulatoria"*.

```
irritationIndex = clamp(0, 100,
    35 · f_exposición(peakConcentrationVE)
  + 25 · f_pH(pH)
  + 25 · f_ingrediente(flags)
  + 15 · f_vehículo(penetration_enhancer)
)
```

- `f_exposición`: normalización logística de la concentración pico en epidermis viable
  frente a un umbral de referencia por ingrediente.
- `f_pH`: penaliza desviación respecto al pH fisiológico cutáneo (4.5–5.5); crece de forma
  cuadrática fuera de ese rango.
- `f_ingrediente`: banderas conocidas por clase (retinoides, AHA/BHA, aceites esenciales,
  tensioactivos aniónicos).
- `f_vehículo`: los potenciadores de penetración (etanol, propilenglicol, DMSO) aumentan
  el flujo y por tanto la exposición.

Bandas de lectura: `0–25 bajo · 26–50 moderado · 51–75 alto · 76–100 muy alto`.

---

## 6. Limitaciones — lo que este modelo NO puede afirmar

1. **No modela metabolismo cutáneo.** Las enzimas de la epidermis viable pueden transformar
   el activo; aquí se asume químicamente inerte.
2. **No modela vías anexiales** (folículos pilosos, glándulas sudoríparas), relevantes para
   nanopartículas y en las primeras horas.
3. **No modela piel dañada ni patológica.** Los parámetros son de piel humana sana intacta.
4. **No modela interacciones entre múltiples activos** en la misma formulación (v1 simula un
   activo por corrida).
5. **Sin calibración experimental propia.** Los defaults provienen de literatura; no se han
   comparado contra celdas de Franz propias. La validación cruzada es roadmap declarado.
6. **La irritación es heurística** (sección 5).

Estas limitaciones se exponen literalmente en la UI (panel "Supuestos del modelo") y en el
reporte generado por IA. Ocultarlas sería el mayor riesgo reputacional del producto.

---

## 7. Referencias

- Potts, R.O. & Guy, R.H. (1992). *Predicting skin permeability.* Pharmaceutical Research, 9(5), 663–669.
- Bos, J.D. & Meinardi, M.M. (2000). *The 500 Dalton rule for skin penetration.* Experimental Dermatology, 9(3), 165–169.
- Crank, J. (1975). *The Mathematics of Diffusion*, 2nd ed. Oxford University Press.
- OECD (2004). *Test Guideline 428: Skin Absorption — In Vitro Method.*
- Reglamento (CE) 1223/2009 sobre productos cosméticos — prohibición de ensayos en animales.
