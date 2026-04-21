# INFORME DE REVISIÓN — TimeFlow v0.10
## T-20260421-002 — Hallazgos de auditoría técnica

---

## 🔴 CRÍTICAS (deben arreglarse)

### C1 — Docker image 1.75 GB ⚠️
**Impacto:** Cada deploy sube ~1.75GB por el túnel SSH. Build lento.
**Causas raíz:**
- `.dockerignore` inexistente → copia TODO el proyecto (node_modules, .next, git, docs, etc.)
- `node:20-bookworm` base = ~580MB (debería ser `node:20-slim` = ~150MB)
- Múltiples capas `apt-get install` que no se compactan
- `node_modules` se copia DOS veces (deps stage + runner stage)

**Fix estimado:** 30 min → imagen ~400-500MB

---

### C2 — page.tsx: 817 líneas, 4 vistas en un solo archivo ⚠️
**Impacto:** Mantenimiento imposible. Cada vista accede a estado del padre por props drilling.

Las 4 secciones (AgendaView=395l, TimelineView=926l, CalendarMonth=334l, InboxView=440l) están todas en page.tsx. Esto causa:
- Re-renders innecesarios en todo el árbol cuando cambia cualquier estado
- Imposibilidad de cachear cada vista independientemente
- Conflictos de lógica (el FAB se muestra en tabs que no son timeline/calendario por una variable global del padre)

**Fix estimado:** 2-4h →拆分 a componentes separados con su propio estado

---

### C3 — Google Tasks sync: doble llamada en mount ⚠️
**Impacto:** Cada vez que abres Inbox se hacen 2 llamadas POST a `/api/tasks/sync-google` en paralelo.

```tsx
// page.tsx línea 507 — useEffect de InboxView
useEffect(() => { fetch('/api/tasks/sync-google', ...).catch(() => {}) }, [])
// ^ Se ejecuta al montar InboxView

// page.tsx línea 508 — OTRO useEffect
useEffect(() => { fetch('/api/tasks/sync-google', ...).catch(() => {}) }, [])
// ^ Este es el segundo sync (¿duplicado accidental?)
```

**Fix estimado:** 5 min → eliminar línea 508

---

### C4 — N+1 query en syncGoogleToLocal ⚠️
**Impacto:** Si tienes 100 tareas en Google, se hacen 101 queries a la BD (1 para todos los existentes + 100 aggregate individuales).

```ts
// GoogleTasksSync.ts — dentro del for
const max = await prisma.task.aggregate({
  where: { archived: false, scheduledStart: null },
  _max: { inboxOrder: true },
})
```
**Fix estimado:** 10 min → obtener el max una sola vez antes del for

---

## 🟡 IMPORTANTES (mejorar rendimiento notable)

### P1 — Sin React.memo/useMemo en ningún componente
**Impacto:** Cada cambio de estado en page.tsx re-renderiza AgendaView, TimelineView, CalendarMonth y InboxView completos aunque sus datos no hayan cambiado.

`filtered.map()` (línea 471) se recalcula en cada render aunque `tasks` no haya cambiado.

**Fix estimado:** 1-2h → memoizar componentes pesados + filtrado

---

### P2 — Sin optimistic updates en InboxView
**Impacto:** Tictac/tictac → esperar respuesta servidor → actualizar UI. Percepción de lentitud.

Cuando marcas una tarea completa o creas una nueva, la UI espera el round-trip completo.

**Fix estimado:** 1h → updates locales inmediatos + rollback en error

---

### P3 — API Disponibilidad: 31 días por defecto
**Impacto:** Cada vez que abres Timeline/Calendario se piden 31 días × 4 APIs = datos de más de un mes aunque solo navegues 3 días.

```tsx
// page.tsx línea 693 — se cargan 31 días siempre
fetch('/api/disponibilidad?dias=31')
fetch('/api/google-events?dias=31')
```

**Fix estimado:** 30 min → pedir solo días visibles (~7) + prefetch del siguiente

---

### P4 — MotorConfig: doble escritura localStorage + BD
**Impacto:** Cada vez que guardas, se escribe 2 veces (API + localStorage). El localStorage nunca se lee como fuente principal (solo como fallback).

```ts
// MotorConfig.tsx línea 164 — tras POST exitoso
localStorage.setItem('timeflow_motor_config', JSON.stringify(...))
// ^ Innecesario si el POST funcionó
```

**Fix estimado:** 10 min → eliminar localStorage, usar solo BD

---

### P5 — CSS inline massivo vs CSS modular
**Impacto:** Cada render genera objetos de estilos nuevos. CSS inline no se cachea por el navegador.

```tsx
// page.tsx —数百 de style={{ ... }} dispersos por todo el archivo
// No hay CSS classes externas (solo globals.css con variables)
```

**Fix estimado:** 4h+ → sistema de CSS modular con clases

---

### P6 — Sin loading skeletons en Inbox
**Impacto:** "Cargando..." con texto plano se siente lento aunque la API responda rápido.

```tsx
// page.tsx línea 530
{loading ? <div style={{ textAlign: 'center', padding: '48px 20px', color: '#4a4a6a' }}><p>Cargando...</p></div> : ...
```

**Fix estimado:** 30 min → skeleton cards simulando estructura de tarea

---

## 🟢 MODERADAS (técnico/deuda)

### M1 — Prisma: sin paginación en findMany
`findMany({})` devuelve TODAS las tareas sin paginar. Con 500+ tareas la respuesta es lenta.

### M2 — Tags: `tags=[]` vs `tags=null` inconsistente
Tareas existentes tienen `tags=null`, nuevas `tags=[]`. El código hace `.find(tag => tag.id === activeTag)` en array posiblemente null.

### M3 — SW: 44KB para Service Worker, sin background sync
- Sin cache deprecated para limpiar old caches
- Sin background sync para crear tareas offline
- Sin push notifications de Google Tasks

### M4 — Sin error boundaries
Cualquier crash de componente = pantalla en blanco.

### M5 — next@14.2.29 (14.x stable), next@15 disponible
Posible mejora de rendimiento con RSC en Next 15.

### M6 — MotorConfig + OAuth state: sin CSRF protection
El callback de OAuth no valida `state` parameter contra CSRF.

---

## 📊 PRIORIZACIÓN RECOMENDADA

| # | Hallazgo | Impacto | Esfuerzo | Prioridad |
|---|----------|---------|----------|-----------|
| C1 | Docker image 1.75GB | 🔴 Alto | 30 min | **1º** |
| C3 | Doble sync Google Tasks | 🟡 Medio | 5 min | **2º** |
| C4 | N+1 en syncGoogleToLocal | 🟡 Medio | 10 min | **3º** |
| P3 | API 31 días por defecto | 🟡 Medio | 30 min | **4º** |
| P2 | Sin optimistic updates | 🟡 Medio | 1 h | **5º** |
| P1 | Sin memoización | 🟡 Medio | 1-2 h | **6º** |
| C2 | page.tsx 817 líneas | 🔴 Alto | 2-4 h | **7º** |
| P4 | localStorage doble escritura | 🟢 Bajo | 10 min | **8º** |

---

## 💡 OBSERVACIONES POSITIVAS

- Arquitectura de calendario clara y bien diseñada ✅
- Sistema de tags bien implementado ✅
- PWA básico funcional ✅
- MotorConfig con BD persistente (no solo localStorage) ✅
- Prisma schema limpio (5 modelos bien definidos) ✅
- CSS variables para theming: bien hecho ✅
- Google Tasks sync bidireccional bien implementado ✅
- No hay dependencias innecesarias (solo 4 deps) ✅
