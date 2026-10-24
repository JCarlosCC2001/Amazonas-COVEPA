# Reglas de Proyecto — Antigravity Assistant

Este archivo define las directivas y contexto obligatorio para cualquier asistente de IA que trabaje en el repositorio **Amazonas-COVEPA**.

---

## 1. Fuente de Verdad Obligatoria
- Antes de proponer o implementar cambios, consulta siempre [CONTEXTO_SISTEMA.md](file:///d:/Desarrollo%20Software/Amazonas-COVEPA/CONTEXTO_SISTEMA.md).
- **Mantenimiento del Contexto:** Al finalizar cualquier tarea relevante (nuevas pantallas, cambios de lógica, reglas de negocio o despliegue), **DEBES actualizar [CONTEXTO_SISTEMA.md](file:///d:/Desarrollo%20Software/Amazonas-COVEPA/CONTEXTO_SISTEMA.md)** agregando la entrada al Historial de Cambios y reflejando las nuevas directivas.

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
