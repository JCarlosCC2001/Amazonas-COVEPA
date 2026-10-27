# Reglas de Proyecto — Antigravity Assistant

Este archivo define las directivas y contexto obligatorio para cualquier asistente de IA que trabaje en el repositorio **Amazonas-COVEPA**.

---

## 1. Fuente de Verdad y Control de Cambios
- Antes de proponer o implementar cambios, consulta siempre [CONTEXTO_SISTEMA.md](file:///d:/Proyectos/Amazonas-COVEPA/CONTEXTO_SISTEMA.md).
- **Control de Cambios de Gran Magnitud:** Las actualizaciones NO deben aplicarse de forma automática ni unilateral. **Antes de ejecutar cualquier cambio de gran magnitud** (modificaciones de arquitectura, reestructuración profunda de pantallas, alteraciones en el esquema de base de datos o cambios de lógica estructural), **DEBES consultar primero al usuario, presentar la propuesta y solicitar su confirmación**.
- **Mantenimiento del Contexto:** Una vez aprobado y ejecutado un cambio relevante, registrar el ajuste en el Historial de Cambios de [CONTEXTO_SISTEMA.md](file:///d:/Proyectos/Amazonas-COVEPA/CONTEXTO_SISTEMA.md).
- **Tipografía Unificada:** Todo el sistema usa exclusivamente la tipografía **Inter** (`var(--font-sans)` y `var(--font-mono)` unificadas en Inter, utilizando `font-variant-numeric: tabular-nums` para números y códigos tabulados) y las clases `.t-*` de `src/styles/index.css`. **Prohibido** `fontFamily`/`fontSize` en línea en JSX en archivos migrados. Validar con `npm run check:typography:strict`.

---

## 2. Reglas de Negocio y Convenciones Inmutables

1. **Localidad al lado del Código de Sitio:**
   - En cualquier parte del módulo de **Programación** (Vista Hoy, Vista Semanal, Vista Lista, Modales, Pestañas y exportaciones a Excel), el código de sitio (ej. `AM-0038-A01`) **SIEMPRE debe ir acompañado por el nombre de la LOCALIDAD** (ej: `AM-0038-A01 · PEDRO RUIZ GALLO`).
   - La exportación a Excel de observaciones de programación debe mantener la columna `LOCALIDAD` al lado de `CÓDIGO DE SITIO`.

2. **Estándares de Generación KMZ / Google Earth:**
   - **5 Columnas Obligatorias en la Tabla de Observaciones:** `Código de observación`, `Detalle`, `Comentario inicial`, `Acuerdo de subsanación`, `Estado`.
   - **Diseño:** Fondo blanco, ancho fijo de **850 px** con `<BalloonStyle>`.
   - **Rendimiento:** Íconos locales empaquetados (`files/pin_*.png`) y `<Snippet maxLines="0"/>` en cada Placemark para evitar bloqueos y textos solapados en Google Earth.
   - **Sincronización:** Los archivos generados deben escribirse simultáneamente en `kmz_output/` y en `public/kmz/`.

3. **Arquitectura y Despliegue:**
   - Frontend en **Vite + React**. Servido con rutas SPA mediante `vercel.json` y `public/_redirects`.
   - Base de datos en **Supabase**. Las modificaciones de datos deben mantenerse sincronizadas con el cliente Supabase configurado en `src/lib/supabase.js`.
   - Despliegue en la nube mediante **GitHub + Vercel**. Para publicar cambios de código se utiliza `publicar_actualizacion.bat` o `git push origin main`.

4. **Regla Estricta de Manipulación de Bases de Datos:**
   - El asistente **SÓLO tiene permitido modificar datos de celdas existentes (`UPDATE`)**.
   - **PROHIBIDO** agregar columnas (`ALTER TABLE ADD COLUMN`), agregar filas (`INSERT`) o eliminar filas/columnas (`DELETE` / `DROP`) directamente en las bases de datos.
   - Si se requiere cualquier creación de columnas, inserción de filas, eliminación de datos o alteración de esquemas, **SIEMPRE se debe entregar el script SQL correspondiente al usuario** para que él lo revise y ejecute.

