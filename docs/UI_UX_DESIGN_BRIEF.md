# UI/UX Design Brief — DERMASENSE

---

## 1. Principio rector

> **Instrumento científico, no juguete.**

La interfaz debe transmitir precisión y sobriedad. El 3D es una herramienta de lectura de
datos, no un efecto decorativo. Cada elemento visual responde a: *¿ayuda a decidir una
formulación?* Si no, se elimina.

Tres reglas derivadas:

1. **El número manda, la visual acompaña.** Toda información codificada en color o
   movimiento tiene un equivalente numérico visible. Esto es accesibilidad y también rigor.
2. **La incertidumbre es visible.** La confianza del modelo se muestra siempre, nunca se
   esconde tras un resultado limpio.
3. **La iteración es el flujo.** Cambiar un parámetro y volver a simular no debe requerir
   navegación: todo ocurre en una sola pantalla.

---

## 2. Referencias visuales

- Instrumentación de laboratorio moderna (interfaces de espectrofotómetros, Benchling).
- Herramientas de simulación técnica (Ansys Discovery, COMSOL) por su densidad informativa.
- Linear y Vercel por su tipografía y jerarquía sobria.

**Anti-referencia:** e-commerce de belleza. Nada de degradados rosados, ni tipografía
manuscrita, ni lenguaje aspiracional. El usuario es un químico.

---

## 3. Sistema de color

Tema oscuro por defecto: maximiza el contraste del gradiente 3D y reduce fatiga visual en
sesiones largas. Tema claro disponible para presentaciones e impresión.

### Tokens base

| Token | Oscuro | Claro | Uso |
|---|---|---|---|
| `--bg` | `#0B1120` | `#FFFFFF` | Fondo de aplicación |
| `--surface` | `#111C31` | `#F8FAFC` | Paneles y tarjetas |
| `--surface-2` | `#1A2942` | `#F1F5F9` | Elementos anidados |
| `--border` | `#22304C` | `#E2E8F0` | Separadores |
| `--text` | `#E8EEF7` | `#0F172A` | Texto principal |
| `--text-muted` | `#93A4BF` | `#64748B` | Texto secundario |
| `--accent` | `#22D3EE` | `#0891B2` | Acción primaria, foco |
| `--accent-soft` | `#0E7490` | `#CFFAFE` | Fondos de acento |

### Colores semánticos de resultado

| Token | Valor | Significado |
|---|---|---|
| `--ok` | `#34D399` | Irritación baja, confianza alta |
| `--warn` | `#FBBF24` | Moderado, fuera de dominio |
| `--risk` | `#F87171` | Alto |
| `--risk-high` | `#DC2626` | Muy alto |

### Escala de concentración (secuencial, para el 3D y el heatmap)

Escala perceptualmente uniforme, de baja a alta concentración. Legible en ambos temas y
distinguible en deuteranopia (varía en luminosidad, no solo en tono):

```
#0B1120 → #143A5A → #1D6E8E → #21A0A0 → #6FCf7F → #E8E36B → #F5A25D
```

Nunca se usa una escala arcoíris: introduce fronteras perceptuales falsas donde los datos
son continuos.

### Colores identificadores de capa (categóricos, no secuenciales)

| Capa | Color | Nota |
|---|---|---|
| Estrato córneo | `#C4B59A` | Tono queratina |
| Epidermis viable | `#E0A88A` | |
| Dermis | `#C97B7B` | |
| Hipodermis | `#E8C87E` | Tono adiposo |

Estos colores identifican la capa a baja opacidad; el gradiente de concentración se
superpone y siempre domina visualmente.

---

## 4. Tipografía

| Rol | Fuente | Tamaño / peso |
|---|---|---|
| Display | Inter | 32 / 600, tracking -0.02em |
| Título de sección | Inter | 20 / 600 |
| Cuerpo | Inter | 14 / 400, line-height 1.6 |
| Etiqueta | Inter | 12 / 500, uppercase, tracking 0.06em |
| **Datos numéricos** | **JetBrains Mono** | 14–28 / 500, **cifras tabulares** |

Regla estricta: todo número que el usuario pueda comparar va en monoespaciada con
`font-variant-numeric: tabular-nums`. Las cifras deben alinearse verticalmente entre
simulaciones — es lo que hace posible comparar de un vistazo.

---

## 5. Espaciado y forma

- Escala de 4 px: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64`.
- Radios: `sm 6px · md 10px · lg 14px` (paneles) · `full` (badges).
- Elevación por borde y fondo, no por sombras difusas: en tema oscuro las sombras ensucian.
- Ancho máximo de contenido: 1440 px; el laboratorio usa el ancho completo.

---

## 6. Layout del Laboratorio (`/lab`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  DERMASENSE          Laboratorio · Historial            [usuario ▾] │
├──────────────────┬──────────────────────────────┬───────────────────┤
│ FORMULACIÓN      │                              │ MÉTRICAS          │
│ (320px)          │      VISOR 3D                │ (340px)           │
│                  │      (flexible)              │                   │
│ Ingrediente ▾    │   ┌────────────────────┐     │  log Kp           │
│ ─────────────    │   │ ▓▓▓ Estrato córneo │     │  -2.41            │
│ MW    138 g/mol  │   │ ▒▒  Epid. viable   │     │  ───────────────  │
│ logP  2.26       │   │ ░   Dermis         │     │  Flujo est.       │
│ ─────────────    │   │     Hipodermis     │     │  4.8 µg/cm²/h     │
│ Concentración    │   └────────────────────┘     │  ───────────────  │
│ [====○─────] 2 % │                              │  Lag time  1.9 h  │
│                  │   ◀◀ ▶ ▶▶  ●──────  8.0 h    │  Absorbido 12.4 % │
│ Vehículo    ▾    │                              │  Profund.  310 µm │
│ pH  [===○──] 4.8 │   Leyenda de concentración   │  ───────────────  │
│ Duración    24 h │   0 ▬▬▬▬▬▬▬▬▬▬ 100 µg/cm³    │  IRRITACIÓN       │
│                  │                              │  ◍ 34 Moderado    │
│ [   SIMULAR   ]  │                              │  heurístico ⓘ     │
│                  │                              │  ───────────────  │
│ Supuestos ⓘ      │                              │ [Guardar][Reporte]│
└──────────────────┴──────────────────────────────┴───────────────────┘
```

- **Izquierda: entrada.** Todos los controles de formulación, siempre visibles.
- **Centro: evidencia.** El corte 3D con el gradiente y el control de tiempo.
- **Derecha: salida.** Métricas en monoespaciada y acciones.

El ojo recorre entrada → evidencia → salida. Ese es el modelo mental del experimento.

### Responsive

- **>= 1280 px:** tres columnas como arriba.
- **768–1279 px:** 3D arriba a ancho completo; formulario y métricas en dos columnas debajo.
- **< 768 px:** una columna con pestañas `Formulación · Visor · Resultados`. El 3D reduce
  su resolución de malla. Se declara como experiencia secundaria: el usuario objetivo
  trabaja en escritorio.

---

## 7. Componentes clave

### `SkinScene` (visor 3D)

- Bloque rectangular de piel en corte, cámara en perspectiva ligeramente elevada.
- Cuatro capas con espesor proporcional al real, pero con **escala logarítmica opcional**:
  a escala lineal el estrato córneo (20 µm frente a 1800 µm de dermis) sería invisible, y es
  la capa más importante del modelo. El conmutador de escala se muestra explícitamente para
  no engañar sobre las proporciones.
- El gradiente se aplica mediante una textura de datos 1D actualizada por frame; no se
  regenera la geometría.
- Órbita limitada (no se permite girar bajo el plano de la piel: desorienta).
- Etiquetas de capa siempre legibles, ancladas al borde izquierdo del corte.

### `MetricCard`

Etiqueta pequeña en mayúsculas, valor grande en monoespaciada, unidad en `--text-muted`,
y una micro-barra que sitúa el valor en su rango típico. Tooltip con la definición y la
ecuación de origen.

### `IrritationGauge`

Arco de 0 a 100 con las cuatro bandas. **Siempre** acompañado del texto
*"estimación heurística exploratoria — no es una evaluación de seguridad"*. No es letra
pequeña: es parte del componente.

### `ConfidenceBanner`

Aparece sobre las métricas cuando el input sale del dominio de aplicabilidad, con los
motivos concretos ("MW 780 g/mol excede el límite de 500 Da del modelo").

### `Timeline`

Play/pausa, scrub, y velocidades 1x/4x/12x. El tiempo simulado se muestra en horas con un
decimal, en monoespaciada.

---

## 8. Movimiento

| Elemento | Duración | Curva |
|---|---|---|
| Cambio de estado de UI | 150 ms | `ease-out` |
| Aparición de paneles | 220 ms | `cubic-bezier(0.16,1,0.3,1)` |
| Interpolación del gradiente 3D | continua | lineal (representa datos: acelerar mentiría) |

Se respeta `prefers-reduced-motion`: se desactivan las transiciones decorativas y el
timeline pasa a control manual.

---

## 9. Accesibilidad

- Contraste mínimo AA (4.5:1 en texto, 3:1 en elementos gráficos).
- Foco visible de 2 px en `--accent` en todos los interactivos.
- El visor 3D tiene `role="img"` con `aria-label` describiendo el estado actual, y su
  información completa está duplicada en la tabla de métricas.
- Todo el flujo (configurar, simular, leer, guardar) es operable solo con teclado.
- Ningún estado se comunica únicamente por color: siempre hay icono o texto.

---

## 10. Tono de la comunicación

- **Preciso, no promocional.** "Flujo estimado en estado estacionario", no "¡Penetración
  potente!".
- **Honesto con la incertidumbre.** "Estimado", "bajo los supuestos del modelo", "no
  validado experimentalmente".
- **Sin alarmismo.** Un índice de irritación alto se comunica como un dato a verificar, no
  como una advertencia de peligro.
