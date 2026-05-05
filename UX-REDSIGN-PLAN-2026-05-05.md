# Timeflow UX Redesign Plan — 2026-05-05

## Diagnosis

**Sintoma reportado por el usuario:** UX "muy engorrosa", escala "fatal".

**Causa razīg identificaba:** Las fases 1-4 del plan anterior se implementaron como features individuales sin una estrategia de UX cohesiva. TimelineView tiene 1044 lineas con 15+ responsabilidades. La app tiene muchas features pero ninguna funciona de forma fluida.

---

## Lo que la investigacīg revela

### Linear (gold standard productivity UX)
- **Cmd+K command menu** — navegacīg universal, descubrible
- **Split-pane** — lista izquierda, detalle derecha, nunca pierdes contexto
- **Optimistic UI** — las acciones se sienten instantaneas
- **Virtual scrolling** — miles de items sin lag
- **Compact rows** (40px) con informacīg densa pero no saturada
- **Transiciones suaves** (cubic-bezier(.45,0,.55,1) a 450ms)
- **Dark mode real** (#090909, no colores invertidos)

### Cron (best calendar UX)
- **Color families** — ribbons, backgrounds, text, dimmed states todos derivados del mismo hue
- **Right-hand context panel** en vez de modal — preserva contexto espacial
- **Mobile-first** — gano Mobile App of the Year
- **Infinite scroll** con performance optimizada
- **Cmd+K command menu** tambien presente
- **Keyboard shortcuts** surfaced en hover

### Structured (unified task+calendar)
- **Unified timeline** simple — tareas y eventos mezclados visualmente
- **Diseno limpio** — lo minimo necesario

---

## Principio Rector

> **No anadir features. Hacer que las existentes funcionen de forma fluida.**

El plan anterior anadia funcionalidades. Este plan **reduce complejidad, mejora performance y refina la UX existente**.

---

## Phase 1: Foundation — Performance & Simplification (Week 1-2)

### 1.1 Virtual Scrolling en Timeline y Agenda
**Problema:** Renderizar 48 slots/hora x 24 horas = muchos DOM nodes
**Solucīg:** Implementar virtual scrolling con ventanizado de slots visibles

### 1.2 Consolidar TimelineView (1044 -> ~400 lineas)
**Problema:** 15+ responsabilidades en un solo componente
**Solucīg:** Extraer:
- `CurrentTimeIndicator.tsx` — linea roja actual
- `FreeBlocksLayer.tsx` — bloques de tiempo libre
- `TaskBlocksLayer.tsx` — rendering de tareas
- `GoogleEventsLayer.tsx` — eventos de Google
- `WorkingHoursBoundary.tsx` — limite horario
- `DropZoneOverlay.tsx` — overlay para drag-drop

### 1.3 Optimistic UI para task creation/completion
**Problema:** Feedback lento al crear/completar tareas
**Solucīg:** Actualizar estado local inmediatamente, sync en background

### 1.4 Command Menu (Cmd+K)
**Referencia:** Linear y Cron
- Quick nav: ir a Agenda, Timeline, Calendar, Inbox
- Quick actions: crear tarea, buscar, cambiar fecha
- Descubrible: shortcuts mostrados en hover

---

## Phase 2: Visual Refinement (Week 2-3)

### 2.1 Color System — Color Families
**Problema:** Colores planos sin coherencia
**Solucīg:** Sistema de 8 colors base con:
- `bg` — background del bloque (10-20% opacity)
- `border` — borde izquierdo (color solido)
- `text` — texto sobre el bloque
- `dimmed` — eventos pasados (30% opacity)
- `glow` — cuando esta seleccionado

### 2.2 Dark Mode Audit
**Problema:** Posible gris oscuro en vez de negro real
**Solucīg:**
- Background: #090909 (no #0a0a0f)
- Surface: #13131a -> #0f0f11
- Border: #2a2a3d -> #1c1e21
- Verificar contrast ratios WCAG AA

### 2.3 Transitions Audit
**Solucīg:** Implementar cubic-bezier(.45,0,.55,1) a 450ms para:
- Hover states
- Modal open/close
- Tab transitions
- Header shrink/expand

### 2.4 Compact Mode para Timeline
**Problema:** Expanded mode ocupa mucho espacio
**Solucīg:** Double-tap ya implementado, pero refinar:
- Transicion suave entre modos
- Memory user preference

---

## Phase 3: Interaction Polish (Week 3-4)

### 3.1 Right-Hand Context Panel para Editar Tarea
**Problema:** Modal de edicion full-screen pierde contexto
**Solucīg:** Panel lateral derecho (~400px) para editar:
- Preserva scroll position
- Permite comparar con dia siguiente/anterior
- Toggle entre panel y modal full

### 3.2 Pull-to-Refresh con Feedback Visual
**Proucion:** Ya existe, mejorar:
- Spinner integrado en header
- "Actualizando..." texto
- Error state con retry

### 3.3 Swipe Gestures — Simplificar
**Problema:** Demasiados gestos posibles
**Solucīg:** Mantener solo los que funcionan bien:
- Swipe right -> complete (verde checkmark)
- Swipe left -> reschedule (date picker)
- Long press -> drag mode (unico trigger)
- Eliminar gestos conflictivos

### 3.4 FAB Behavior
**Solucīg:**
- Single tap -> quick add (minimal form, 3 campos max)
- Long press 500ms -> NLP input
- Ya implementado, solo refinar transition

---

## Phase 4: Mobile-First Optimization (Week 4-5)

### 4.1 Touch Target Audit
**Problema:** Posibles elementos < 44px
**Solucīg:** Audit de todos los touch targets:
- Buttons: min 44x44px
- FAB: 56px (ya correcto)
- Chips: min 44px height
- Task blocks: min altura para tap

### 4.2 Safe Area Handling
**Problema:** iOS notch/home indicator
**Solucīg:** Verificar padding con env(safe-area-inset-*)
- Header: padding-top: env(safe-area-inset-top)
- FAB: bottom: calc(28px + env(safe-area-inset-bottom))

### 4.3 PWA Improvements
- Offline indicator visible
- Add to homescreen prompt
- Splash screen con logo

### 4.4 Gesture Navigation (iOS)
**Solucīg:** Soportar swipe-back de iOS para navegacion entre vistas

---

## Phase 5: Performance Deep Dive (Week 5-6)

### 5.1 Bundle Analysis
**Solucīg:** Analizar con next/bundle-analyzer:
- Cuanto pesa cada vista?
- Librerias pesadas que se pueden reemplazar?
- Code splitting por ruta

### 5.2 Memo Audit
**Problema:** Re-renders innecesarios
**Solucīg:**
- Audit de todos los React.memo faltantes
- useCallback para handlers pasados como props
- useMemo para calculos pesados (free blocks, gradient)

### 5.3 API Response Caching
**Solucīg:**
- SWR o React Query para cachear API calls
- Invalidacion inteligente
- Stale-while-revalidate para disponibilidad

### 5.4 Image/Asset Optimization
**Problema:** Posible logos/iconos sin optimizar
**Solucīg:**
- Next.js Image component
- SVG inline para iconos pequenos

---

## Success Metrics

| Metrica | Antes | Despues (target) |
|---------|-------|-----------------|
| Timeline scroll FPS | <30? | >55 |
| Task creation feedback | >500ms | <100ms (optimistic) |
| Time to interactive | ? | <2s |
| Touch targets <44px | ? | 0 |
| Lighthouse performance | ? | >90 |
| Bundle size (gzipped) | ? | <150kb |

---

## Implementation Order

1. **Primero:** Git checkpoint + Obsidian documentation
2. **Fase 1:** Performance (virtual scroll, consolidate components)
3. **Fase 2:** Visual refinement (colors, transitions)
4. **Fase 3:** Interaction polish (context panel, gestures)
5. **Fase 4:** Mobile-first
6. **Fase 5:** Performance deep dive

**No anadir features nuevas hasta que las existentes funcionen fluidamente.**

---

## Risk Mitigation

### Rollback Plan
```bash
git tag checkpoint-pre-ux-redesign-2026-05-05
git tag checkpoint-phase-1-complete
# Si algo falla:
git reset --hard checkpoint-pre-ux-redesign-2026-05-05
```

### Obsidian Documentation
- /Timeflow/Checkpoint-2026-05-05.md — snapshot pre-cambios
- /Timeflow/UX-Redesign-2026-05-05.md — este plan
- Updates despues de cada fase

---

*Plan basado en investigacion UX de Linear, Cron, Structured*
*Creado: 2026-05-05*
*Autor: Beckario*
