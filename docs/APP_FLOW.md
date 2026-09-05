# Flujo de la Aplicación — DERMASENSE

---

## 1. Mapa de navegación

```mermaid
graph LR
    L["/ Landing"] --> S["/signup"]
    L --> I["/login"]
    S --> LAB["/lab<br/>Laboratorio"]
    I --> LAB
    LAB --> HIST["/simulations<br/>Historial"]
    HIST --> DET["/simulations/[id]<br/>Detalle + Reporte IA"]
    DET --> LAB
    HIST --> CMP["/simulations/compare<br/>(Should)"]

    style LAB fill:#0ea5e9,color:#fff
```

Rutas bajo `(app)` protegidas por middleware: sin sesión válida redirigen a `/login?next=`.

---

## 2. Flujo principal — "de la hipótesis al insight"

```mermaid
flowchart TD
    A["Usuario entra a /lab"] --> B["Carga catálogo de activos y vehículos"]
    B --> C["Selecciona ingrediente activo"]
    C --> D["Ajusta concentración, vehículo, pH, duración"]
    D --> E{"¿Validación Zod OK?"}
    E -->|No| F["Error inline en el campo<br/>Botón Simular deshabilitado"]
    F --> D
    E -->|Sí| G["Click en Simular"]
    G --> H["Motor: Potts-Guy + solver FTCS"]
    H --> I{"¿Dentro del dominio<br/>de aplicabilidad?"}
    I -->|No| J["Banner de baja confianza<br/>con motivos explícitos"]
    I -->|Sí| K["Confianza alta"]
    J --> L["Render 3D del gradiente"]
    K --> L
    L --> M["Panel de métricas + timeline"]
    M --> N{"Acción del usuario"}
    N -->|Ajustar parámetro| D
    N -->|Guardar| O["POST /api/simulations"]
    N -->|Generar reporte| P["POST /api/report"]
    P --> Q{"¿IA responde?"}
    Q -->|Sí| R["Reporte técnico renderizado"]
    Q -->|No| S["Estado AI_UNAVAILABLE<br/>Métricas siguen visibles<br/>Botón Reintentar"]
    O --> T["/simulations — historial"]
```

**Principio de diseño del flujo:** el bucle `D → G → M → D` (ajustar, simular, leer, ajustar)
debe cerrarse en menos de 5 segundos. Es el corazón del producto: si iterar es rápido, el
formulador explora; si es lento, vuelve a su hoja de cálculo.

---

## 3. Estados de la simulación

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Configuring: usuario edita el formulario
    Configuring --> Invalid: falla validación
    Invalid --> Configuring: corrige
    Configuring --> Running: click en Simular
    Running --> Ready: motor completa
    Running --> Failed: excepción numérica
    Failed --> Configuring: mostrar causa y sugerencia
    Ready --> Playing: play en el timeline
    Playing --> Ready: pausa o fin
    Ready --> Saving: guardar
    Saving --> Saved: 201
    Saving --> Ready: error de red, se conserva el resultado local
    Ready --> Reporting: generar reporte
    Reporting --> Reported: 200
    Reporting --> ReportFailed: 503 AI_UNAVAILABLE
    ReportFailed --> Reporting: reintentar
```

**Invariante crítica:** una vez alcanzado `Ready`, ningún fallo posterior (red, IA, guardado)
puede destruir el resultado en pantalla. El valor central del producto ya fue entregado.

---

## 4. Flujo de autenticación

```mermaid
sequenceDiagram
    actor U as Usuario
    participant MW as Middleware Next.js
    participant SB as Supabase Auth
    participant P as PostgreSQL

    U->>MW: GET /lab
    MW->>SB: getSession() desde cookies
    alt Sin sesión
        MW-->>U: 307 redirect a /login?next=/lab
        U->>SB: signInWithPassword(email, password)
        SB-->>U: Cookies HTTP-only (access + refresh)
        U->>MW: GET /lab (reintento)
    end
    MW-->>U: Renderiza el laboratorio
    U->>P: Consulta con JWT
    P->>P: RLS: user_id = auth.uid()
    P-->>U: Solo sus filas
```

Al primer registro, un trigger de PostgreSQL crea automáticamente la fila en `profiles`.

---

## 5. Estados vacíos y de error (UX)

| Situación | Qué ve el usuario | Salida |
|---|---|---|
| Historial vacío | Ilustración + "Aún no has simulado nada" | CTA a `/lab` |
| Fuera de dominio del modelo | Banner ámbar con los motivos (ej. "MW 780 > 500 Da") | Sigue viendo resultados, marcados de baja confianza |
| Motor falla numéricamente | Mensaje con el parámetro sospechoso | Botón "Restaurar valores por defecto" |
| IA no disponible | Tarjeta de reporte en estado de error | "Reintentar"; métricas intactas |
| Sin conexión al guardar | Toast "No se pudo guardar, se conserva localmente" | Reintento manual |
| Navegador sin WebGL | Fallback a corte 2D en canvas | Toda la información numérica sigue disponible |

---

## 6. Recorrido de demo para el pitch (2 minutos)

1. **Landing** — la promesa en una frase.
2. **Laboratorio** — se carga con retinol 0.3 % preconfigurado.
3. **Simular** — el gradiente atraviesa el estrato córneo en vivo; se lee el *lag time*.
4. **Cambiar el vehículo** a etanólico — el flujo sube visiblemente; el índice de irritación
   también. Ese contraste es el momento que demuestra el valor.
5. **Reporte IA** — interpretación técnica con supuestos y limitaciones explícitas.
6. **Panel de supuestos** — se muestra deliberadamente lo que el modelo NO afirma.

El paso 6 no es una concesión: es el diferenciador frente a herramientas que venden certeza
que no tienen.
