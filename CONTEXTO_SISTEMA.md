# CONTEXTO GENERAL DEL SISTEMA — COVEPA AMAZONAS
> **Documento Vivo de Arquitectura, Reglas de Negocio y Estado del Proyecto**  
> *Última actualización: 24 de Octubre de 2026*

Este documento es la **fuente única de verdad (Single Source of Truth)** del proyecto. Debe ser consultado y actualizado cada vez que se implementen nuevas funciones o cambios en la arquitectura.

---

## 1. Visión y Objetivo del Proyecto
El sistema **Amazonas-COVEPA** es un ERP / Sistema Web de Gestión Operativa diseñado para la supervisión, programación de cuadrillas en campo y subsanación técnica de observaciones del proyecto de telecomunicaciones en la **Región Amazonas (ZONA 2 y ZONA 7)**.

- **Total de Sitios:** 156 nodos georreferenciados.
- **Grupos Operativos:** 6 grupos territoriales de trabajo (Grupo 1 al Grupo 6).
- **Observaciones Técnicas:** 4,116 observaciones registradas (Hito 1, civil, torres, energía, etc.).
- **Objetivo Operativo:** Que supervisores en oficina y técnicos en campo coordinen rutas, validen observaciones, generen reportes ejecutivos en Excel y visualicen mapas satelitales en Google Earth (PC y celular) tanto online como 100% offline.

---

## 2. Arquitectura Tecnológica

| Componente | Tecnología | Descripción |
| :--- | :--- | :--- |
| **Frontend** | React 19 + Vite 8 | Single Page Application (SPA), JavaScript modular, Zustand para estado, Lucide Icons. |
| **Estilos** | Vanilla CSS Moderno | Diseño corporativo profesional UX/UI: Paleta blanca y celestes suaves (`#f4f8fc` / `#edf4fb` / `#ffffff`) con azul corporativo principal `#003060` (COVEPA), bordes sutiles y micro-interacciones, optimizado para legibilidad diurna y nocturna en campo y oficina. |
| **Base de Datos Propia** | Supabase (`byywikicdvmmmndhkooe`) | Tablas: `observaciones`, `personal` / `tecnicos`, `programacion_rutas`, asignaciones. |
| **Base de Datos Externa** | Supabase SELNET (`iiwmqvnjjhaapyolaity`) | Catálogo maestro de 1,021 sitios para extraer coordenadas GPS, distritos y localidades. |
| **Control de Versiones** | Git + GitHub | Repositorio: `https://github.com/JCarlosCC2001/Amazonas-COVEPA.git` (rama `main`). |
| **Hosting & CI/CD** | Vercel | Despliegue automático con cada push a GitHub. Configurado con `vercel.json` para rutas SPA. |
| **Generador Geoespacial** | Python 3 + KML/KMZ | Script `generar_kmz.py` que compila los mapas satelitales optimizados para Google Earth. |

---

## 3. Módulos y Funcionalidades del Sistema

### 3.1. Dashboard Ejecutivo (`/`)
- Indicadores clave (KPIs): Total de observaciones, subsanadas, validadas, en revisión y pendientes.
- Porcentajes de avance global y por cuadrilla.
- Gráficos interactivos de estado por cada uno de los 6 grupos.

### 3.2. Programación de Cuadrillas (`/programacion`)
- **Vistas:** Vista de Hoy (por técnicos y por cuadrillas), Vista Semanal (Lunes a Domingo) y Vista Lista.
- **Asignación de Personal:** Cuadrillas rápidas (Técnico + Conductor) o personal individual con asignación de sitios y rutas.
- **Regla de Visualización de Sitios:**  
  ⭐ **Siempre mostrar el nombre de la LOCALIDAD al lado del CÓDIGO DEL SITIO** (Ejemplo: `AM-0038-A01 · PEDRO RUIZ GALLO`), tanto en las tarjetas, en la vista semanal, en la lista y en el modal de detalles.
- **Modal de Observaciones por Sitio (`ModalDetallesProgramacion`):**
  - Permite revisar y actualizar estado de observaciones (Validado, En Revisión, Descartado, Rechazado).
  - Autoguardado silencioso de comentarios y acuerdos al cerrar el modal.
  - Exportación nativa a **Excel (.xlsx)** con estilo `TableStyleMedium9`, incluyendo la columna dedicada **`LOCALIDAD`** al lado del código de sitio.

### 3.3. Observaciones Técnicas (`/observaciones`)
- Tabla completa de las 4,116 observaciones con filtros por estado, grupo, hito, revisor y buscador rápido.
- Edición de acuerdos de subsanación y comentarios técnicos.

### 3.4. Personal y Cuadrillas (`/tecnicos`)
- Gestión de personal de COVEPA y GILAT.
- Asignación de cuadrillas fijas (Cuadrilla 1 a 6) y personal de apoyo rotativo.

### 3.5. Sitios Georreferenciados (`/sitios`)
- Catálogo de los 156 nodos con coordenadas geográficas, zona, grupo, distrito y localidad.

### 3.6. Descargas KMZ / Google Earth (`/kmz`)
- **7 Archivos KMZ Estáticos (Offline):**
  - 1 General con los 156 sitios y 4,116 observaciones.
  - 6 archivos independientes por Grupo (Grupo 1 al 6).
  - Paquete completo comprimido en `.ZIP`.
- **Enlace de Red en Tiempo Real (`Amazonas_COVEPA_EN_VIVO.kml`):**
  - Archivo `NetworkLink` que se abre una sola vez en Google Earth de oficina y se auto-refresca cada 60 segundos.
  - Botón directo en la web: **"⚡ Sincronizar KMZs Ahora"** para forzar la actualización desde el navegador.

---

## 4. Reglas Técnicas y Estándares de Diseño del KMZ

Para garantizar que Google Earth funcione a máxima velocidad sin congelarse ni mostrar errores visuales:

1. **Iconos Locales Empaquetados:** Los 4 pines de colores (verde, azul, amarillo, blanco) van guardados físicamente dentro del KMZ en `files/pin_*.png`. Cero llamadas HTTP externas (100% offline).
2. **Desactivación de Snippets (`<Snippet maxLines="0"/>`):** Obligatorio en cada `<Placemark>` para evitar que Google Earth procese el HTML al inicio y monte textos ilegibles en el árbol lateral.
3. **Carpetas Colapsadas (`<open>0</open>`):** Los grupos inician cerrados para no sobrecargar el renderizador de Google Earth.
4. **Ancho del Globo de Observaciones:** Fijado en **850 px** con `<BalloonStyle>` limpio.
5. **Estructura de la Tabla (Exactamente 5 columnas solicitadas):**
   - `Código de observación`
   - `Detalle`
   - `Comentario inicial`
   - `Acuerdo de subsanación`
   - `Estado`
6. **Doble Destino de Salida:** Cualquier generación debe guardar los archivos simultáneamente en:
   - `kmz_output/` (carpeta local de trabajo)
   - `public/kmz/` (carpeta estática para descarga desde la web y Vercel)

---

## 5. Automatización y Flujo de Trabajo

### Herramientas de Doble Clic (Windows)
- **`actualizar_kmz.bat`**: Ejecuta `generar_kmz.py`, consulta Supabase y regenera los 7 KMZ + NetworkLink en 10 segundos.
- **`publicar_actualizacion.bat`**: Guarda todos los cambios en Git, solicita un mensaje descriptivo y hace `git push origin main` para que Vercel actualice la web en la nube en ~45 segundos.

### Variables de Entorno (`.env.local` y Vercel)
- `VITE_SUPABASE_URL`: URL del proyecto Supabase propio.
- `VITE_SUPABASE_ANON_KEY`: Llave pública anon para clientes web.
- `VITE_SUPABASE_EXT_URL`: URL de la base de datos externa SELNET.
- `VITE_SUPABASE_EXT_ANON_KEY`: Llave de consulta externa.

---

## 6. Historial de Decisiones y Cambios Clave

| Fecha | Cambio Implementado | Motivo / Decisión |
| :--- | :--- | :--- |
| **21-10-2026** | Migración de 4,116 observaciones de Excel a Supabase. | Centralizar los datos en base de datos PostgreSQL en la nube. |
| **22-10-2026** | Módulo de Programación con asignación de cuadrillas y modales. | Permitir al coordinador planificar jornadas semanales por ruta. |
| **23-10-2026** | Optimización extrema de KMZ (iconos locales + Snippet maxLines=0). | Eliminar congelamiento de Google Earth y texto montado en panel izquierdo. |
| **23-10-2026** | Ampliación del cuadro de observaciones a 850px. | Permitir lectura cómoda de las 5 columnas sin scroll horizontal. |
| **23-10-2026** | Implementación de NetworkLink (`Amazonas_COVEPA_EN_VIVO.kml`). | Permitir que Google Earth en oficina se actualice solo sin reabrir archivos. |
| **23-10-2026** | Incorporación de Nombre de Localidad al lado de los códigos de sitio. | Facilitar identificación geográfica inmediata a los técnicos y coordinadores. |
| **24-10-2026** | Configuración para despliegue gratuito en Vercel (`vercel.json` y script). | Poner la plataforma en la nube accesible desde celulares y campo sin costo. |
| **24-10-2026** | Creación de `CONTEXTO_SISTEMA.md` y `AGENTS.md`. | Mantener alineación y memoria técnica permanente en el proyecto. |
| **24-10-2026** | Rediseño integral UX/UI corporativo (blancos, celestes suaves y azul Covepa #003060). | Lograr una interfaz seria, profesional, amigable, intuitiva y de máximo contraste para supervisores y técnicos. |
| **24-10-2026** | Remoción de Top Header global (`Layout.jsx`). | Maximizar el espacio vertical útil de trabajo en pantalla y eliminar información redundante. |
| **24-10-2026** | Creación del componente reutilizable `MetricCard` y `MetricGrid`. | Estandarizar medidores/KPIs en Personal, Sitios y Observaciones con diseño visual destacado (marca de agua, acentos y micro-interacciones). |
| **24-10-2026** | Integración de `MetricCard` en Programación y adaptación compacta/responsive. | Reducción de tipografía a tamaño balanceado y adaptación fluida para tablet y celular (2 cols en tablet, 1-2 en móvil). |
| **24-10-2026** | Reorganización de KPIs contextuales y rediseño de barra de controles en Programación. | KPIs de cabecera contextuales (Hoy muestra métricas de la jornada y Semana muestra consolidados), barra de navegación en blanco corporativo `#ffffff`, eliminación de textos redundantes y unificación de filtros por estado y selector de distribución. |

---

> [!IMPORTANT]
> **Compromiso de Actualización:** Cada vez que se agregue o modifique un módulo, regla de visualización o endpoint, se debe actualizar este archivo y registrar el cambio en la tabla de historial superior.



