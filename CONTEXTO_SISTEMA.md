# CONTEXTO GENERAL DEL SISTEMA — COVEPA AMAZONAS
> **Documento Vivo de Arquitectura, Reglas de Negocio y Estado del Proyecto**  
> *Última actualización: 26 de Octubre de 2026*

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
| **Base de Datos Propia** | Supabase (`byywikicdvmmmndhkooe`) | Tablas activas: `observaciones`, `programaciones`, `programacion_sitios`, `programacion_personal`, `perfiles_usuario` (cuentas y roles). Tabla `personal` local obsoleta/en desuso. |
| **Base de Datos Externa** | Supabase SELNET (`iiwmqvnjjhaapyolaity`) | Tablas activas: `personal` (fuente única de verdad del equipo y contactos) y `sitios` (maestro de 1,021 sitios GPS). |
| **Control de Versiones** | Git + GitHub | Repositorio: `https://github.com/JCarlosCC2001/Amazonas-COVEPA.git` (rama `main`). |
| **Hosting & CI/CD** | Vercel | Despliegue automático con cada push a GitHub. Configurado con `vercel.json` para rutas SPA. |
| **Generador Geoespacial** | Python 3 + KML/KMZ | Script `generar_kmz.py` que compila los mapas satelitales optimizados para Google Earth. |

---

## 3. Módulos y Funcionalidades del Sistema

### 3.1. Dashboard Ejecutivo (`/`)
- **Indicadores Globales del Proyecto (KPIs):** Total de Observaciones (4,116), Pendientes (3,593), Subsanadas / Validadas (72), En Revisión (62), Rechazadas (18), Descartadas (371) y Total de Sitios (156 nodos georreferenciados).
- **Tacómetro y Balance General:** Porcentaje global de subsanación técnica y barra segmentada de distribución.
- **Balance por Grupos Territoriales:** Monitoreo comparativo de los 6 Grupos (sitios, observaciones totales, subsanadas, en revisión, pendientes y avance porcentual).
- **Cobertura Territorial:** Distribución por ZONA 2 (Amazonas Norte - 53 sitios) y ZONA 7 (Amazonas Sur - 103 sitios).
- **Monitoreo Ejecutivo de Sitios:** Tabla interactiva con buscador rápido por código de sitio o localidad y filtro por grupo para supervisar los 156 nodos.
- **Desacoplamiento Operativo:** El avance diario se encuentra centralizado en el módulo de Programación (`ModalAvanceDia`).

### 3.2. Programación de Cuadrillas (`/programacion`)
- **Vistas:** Vista de Hoy (por técnicos y por cuadrillas), Vista Semanal (Lunes a Domingo) y Vista Lista.
- **Asignación de Personal:** Cuadrillas rápidas (Técnico + Conductor) o personal individual con asignación de sitios y rutas.
- **Regla de Visualización de Sitios:**  
  ⭐ **Siempre mostrar el nombre de la LOCALIDAD al lado del CÓDIGO DEL SITIO** (Ejemplo: `AM-0038-A01 · PEDRO RUIZ GALLO`), tanto en las tarjetas, en la vista semanal, en la lista y en el modal de detalles.
- **Modal de Observaciones por Sitio (`ModalDetallesProgramacion`):**
  - Permite revisar y actualizar estado de observaciones (Validado, En Revisión, Descartado, Rechazado).
  - Autoguardado silencioso de comentarios y acuerdos al cerrar el modal.
  - Exportación nativa a **Excel (.xlsx)** con estilo `TableStyleMedium9`, incluyendo la columna dedicada **`LOCALIDAD`** al lado del código de sitio.
- **Ventana Emergente de Avance del Día (`ModalAvanceDia`):**
  - Botón dedicado `[ 📊 Avance del Día ]` en la barra superior que abre un modal con el reporte diario de avances para la fecha seleccionada.
  - Métricas de estado (Total, Por Subir, En Revisión, Enviadas, Descartadas, Rechazadas) que actúan como filtros reactivos.
  - Buscador en tiempo real por código, técnico, cuadrilla, sitio o revisor.
  - Tabla de observaciones del día con visualización de detalle individual y exportación oficial a Excel (.xlsx) cumpliendo el estándar de código de sitio y localidad.
  - Cierre seguro restringido únicamente al botón 'X' o tecla 'Esc'.

### 3.3. Observaciones Técnicas (`/observaciones`)
- **Medidores KPIs Interactivos (6 Tarjetas):** Total Observaciones, Pendientes, Subsanadas/Subidas, Rechazadas, Descartadas y Total de Sitios (156 nodos), con filtrado reactivo directo al clic.
- Tabla completa de las 4,116 observaciones con filtros por estado, grupo, hito, revisor y buscador rápido.
- Edición de acuerdos de subsanación y comentarios técnicos.

### 3.4. Personal y Cuadrillas (`/tecnicos`)
- Gestión de personal de COVEPA y GILAT.
- Asignación de cuadrillas fijas (Cuadrilla 1 a 6) y personal de apoyo rotativo.

### 3.5. Sitios Georreferenciados (`/sitios`)
- Catálogo de los 156 nodos con coordenadas geográficas, zona, grupo, distrito y localidad.

### 3.6. Centro de Descargas (`/kmz`)
- **Organización por Pestañas:**
  - **Pestaña 1 (Por Grupo - KMZ + Excel):** Tarjetas individuales para cada uno de los 6 Grupos con botones para descargar KMZ, KML y el nuevo reporte oficial en Excel (.xlsx) de observaciones del grupo con la localidad al lado del código de sitio y formato nativo de tabla con filtros.
  - **Pestaña 2 (Paquetes Globales y En Vivo):** Mapa general de 156 sitios y 4,116 observaciones (KMZ, KML y Excel General), paquete ZIP con los 7 KMZs, y NetworkLink en tiempo real con botón de sincronización directa.
  - **Pestaña 3 (Guía de Uso):** Manual paso a paso para Google Earth en PC, celular vía Google Drive y uso 100% offline en campo.
- **Medidores Superiores:** 4 MetricCards corporativas (Sitios GPS, Observaciones Mapeadas, Grupos Territoriales y Formatos Disponibles).
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
| **24-10-2026** | Eliminación de barra secundaria redundante y conversión de medidores en filtros interactivos. | Los medidores superiores en Vista Hoy ahora representan directamente los estados operativos (Cuadrillas, En Revisión, Validados, Enviados, Descartadas) y funcionan como botones de filtrado interactivo (clic para filtrar / desfiltrar). Se eliminó por completo la segunda barra de estados y el selector de distribución se integró directamente a la barra principal. |
| **24-10-2026** | Simplificación de vistas: sólo Hoy y Semana, distribución fija por técnicos. | Se eliminaron la Vista Lista y el modo Cuadrillas; la Vista Hoy queda permanentemente agrupada por técnicos y el conmutador temporal solo alterna entre 'Hoy' y 'Semana'. |
| **24-10-2026** | Remoción de barra de chips de filtro por técnicos. | Se eliminó la franja horizontal con chips de técnicos ('TÉCNICOS: Todos los Técnicos...') para despejar la vista y mostrar directamente a todos los técnicos responsables programados. |
| **24-10-2026** | Rediseño compacto con scroll independiente para técnicos en Vista Hoy. | Se confinó el desplazamiento vertical al contenedor `.prog-tech-list-wrap` manteniendo fijos los KPIs superiores y la barra de fecha; se redujo la altura de cada fila de técnico de ~300px a ~80px eliminando textos redundantes ("Sin acompañante", etiquetas y sub-barras repetitivas) y convirtiendo los sitios asignados en pastillas compactas e interactivas que abren el modal de detalle al clic. |
| **24-10-2026** | Micro-insignias operativas (En Revisión / Por Subir) en pastillas de sitios y resumen. | Se añadieron distintivos compactos con color y conteo directo (`🔍 X` en celeste para En Revisión y `✓ Y por subir` en verde) tanto en las pastillas individuales de cada sitio como en el resumen superior del técnico, permitiendo identificar al instante qué sitios requieren acción sin saturar el espacio vertical. |
| **24-10-2026** | Tarjetas de sitios en 2 filas limpias (Fila 1: Código + Localidad; Fila 2: Resueltas, En Revisión, Por Subir y Rechazadas). | Se dividió la visualización de cada sitio en dos filas claras, eliminando el texto de ruta, el teléfono del técnico y el botón del ojo; toda la tarjeta actúa como botón interactivo para abrir el modal con el detalle completo. |
| **24-10-2026** | Agrupación por técnicos en Vista Semana para ahorro de espacio. | En cada columna diaria de la semana, los sitios ahora se agrupan debajo del nombre de cada técnico programado con diseño compacto, scroll interno por columna y micro-insignias operativas (resueltas, en revisión, por subir y rechazadas). |
| **24-10-2026** | Sidebar responsivo off-canvas (se oculta en pantallas reducidas <= 1024px y se despliega con botón flotante). | En pantallas reducidas o al encoger la ventana, el sidebar se oculta automáticamente hacia la izquierda liberando el 100% del ancho para el contenido; se despliega con un botón flotante con fondo oscuro y efecto blur, cerrándose automáticamente al hacer clic fuera o navegar. |
| **24-10-2026** | Simplificación extrema en Vista Semana (solo lo básico: técnico, cuadrilla, código de sitio y localidad). | Se removieron los conteos de sitios, métricas de observaciones e insignias de rechazadas en la vista semanal, dejando exclusivamente el nombre del técnico, cuadrilla y pastillas limpias de código + localidad para máxima claridad y compacidad. |
| **24-10-2026** | Adaptación responsiva integral de componentes y vistas del módulo de Programación. | Optimización completa para pantallas de escritorio, tablets y smartphones. La barra de herramientas se reorganiza fluidamente en filas equilibradas sin desbordamiento horizontal; la Vista Semana implementa un carrusel táctil horizontal continuo con scroll-snap manteniendo legible el orden cronológico de los 7 días; en la Vista Hoy las tarjetas de sitios en 2 filas y filas de técnicos se adaptan al 100% del ancho con elipses limpias para localidades largas; los modales de creación y detalles se ajustan a 98vw con barras táctiles de estado (scroll horizontal en móviles) y controles de revisor/fecha apilados verticalmente con máxima ergonomía táctil. |
| **24-10-2026** | Estandarización de 4 medidores de estado operativo en Vista Hoy y Vista Semana (En Revisión, Validados, Enviados por COVEPA y Descartadas). | Se removió la tarjeta "Cuadrillas en Campo" y se fijaron exactamente 4 medidores interactivos consistentes tanto en la Vista Hoy como en la Vista Semana: En Revisión (sky), Validados/Por Subir (emerald), Enviados por COVEPA (purple) y Descartadas/Rechazadas (rose). Por defecto siempre se visualizan todas las cuadrillas y sitios; al hacer clic en cualquier medidor se filtra interactivamente por ese estado tanto en Hoy como en la Semana, mostrando el banner de filtro activo con botón "Mostrar Todas" y permitiendo desactivar el filtro al volver a pulsar la tarjeta. |
| **24-10-2026** | Eliminación de márgenes excesivos en pantallas móviles y cuadrícula 2x2 para medidores. | Reducción drástica del padding de `.page-body` en móviles de 2rem (32px) a 0.35rem-0.45rem (~5px-7px), recuperando más de 50px de ancho útil. Los 4 medidores se mantienen en formato 2x2 compacto en celulares en lugar de apilarse en una columna vertical gigante, se ajustaron los paddings de la barra de herramientas, tarjetas de sitios y el botón flotante del sidebar a dimensiones táctiles ergonómicas. |
| **24-10-2026** | Rediseño integral y responsivo del modal de detalles de sitio y observaciones (`ModalDetallesProgramacion`). | Se eliminó la información redundante solicitada por el usuario (fecha, itinerario crudo en JSON y detalle de técnicos en ruta). Se destacó el Código de Sitio y Localidad con insignias geográficas y pestañas de sitios múltiples. Los contadores de estado se convirtieron en botones interactivos de filtrado en una barra flexible que no se quiebra en filas huérfanas. Las observaciones presentan máximo contraste y legibilidad profesional (insignia de código, selector de estado con código de colores, barra de auditoría con revisor y fecha, caja de detalle neutral, comentario inicial en ámbar oscuro de alta legibilidad, acuerdo de subsanación en azul marino nítido y comentario COVEPA con autoguardado y guardado manual). Optimización responsive completa para móviles y tablets. |
| **24-10-2026** | Calibración de márgenes y paddings confortables en pantallas móviles. | Se ajustaron los márgenes laterales de `.page-body` en móviles a `0.85rem` (~14px) y paddings internos balanceados en los 4 medidores KPI, barra de herramientas y filas de técnicos/sitios. Esto elimina la sensación de 'contenido metido a la fuerza', otorgando un respiro visual profesional y asegurando que las tarjetas y botones tengan espacio respecto a los bordes físicos del teléfono. |
| **24-10-2026** | Corrección de recorte vertical y scrollbar en barra de contadores del modal de detalles. | Se corrigió el recorte superior de las etiquetas de estado ('TOTAL', 'POR SUBIR', etc.) y la aparición de un scrollbar vertical en `.prog-modal-stats-bar` asignando `flex-shrink: 0`, `overflow-y: hidden`, `min-height: 0` en el cuerpo del modal y altura fija ergonómica en los botones de estado. |
| **24-10-2026** | Botones de acción del modal (Editar, Eliminar, Cerrar) como iconos compactos anclados en esquina superior. | Se transformaron los botones de editar y eliminar a botones de sólo icono (34x34px) coincidentes con el botón de cerrar y se anclaron permanentemente en la esquina superior derecha de la cabecera del modal tanto en escritorio como en celular, evitando que se quiebren o bajen a una segunda fila. |
| **25-10-2026** | Reorganización integral de la zona de KMZ como 'Centro de Descargas' y exportación de Excel por grupo. | Se rediseñó la vista integrando el sistema de diseño corporativo (MetricGrid de 4 medidores arriba: Sitios GPS, Observaciones, Grupos y Formatos). Se organizó en 3 pestañas segmentadas: 'Por Grupo (KMZ + Excel)', 'Paquetes Globales y En Vivo' y 'Guía de Uso (PC y Celular)'. Se implementó el servicio de exportación `exportService.js` que genera con ExcelJS archivos .xlsx oficiales por cada grupo (Grupo 1 al 6) y global, manteniendo estrictamente la columna LOCALIDAD al lado del CÓDIGO DE SITIO y estilo TableStyleMedium9 con filtros. Se renombró la entrada en el Sidebar a 'Centro de Descargas' con su respectivo icono. |
| **24-10-2026** | Control de cambios y consulta previa obligatoria. | Las actualizaciones no se aplican de forma automática o unilateral; para modificaciones de gran magnitud se debe plantear primero la propuesta al usuario y requerir su aprobación antes de proceder. |
| **24-10-2026** | Armonización visual y tipográfica del modal Nueva Programación con los componentes de Programación. | Eliminación de tarjetas anidadas flotantes (`.prog-panel-card`) y fondo gris; unificación del cuerpo a 2 columnas con fondo blanco puro y divisor sutil. Reemplazo de la pastilla negra oscura del código de sitio por la tipografía institucional del sistema (`site-2row-code` monospace en `#003060`, pin celeste y localidad en `#0284c7`), con etiquetas geográficas sutiles (`meta-pill` para zona y grupo) consistentes con `ModalDetallesProgramacion` y `prog-site-2row-card`. Unificación de cabeceras de sección con contadores integrados y botones de acción limpios. |
| **24-10-2026** | Simplificación y responsividad del modal Nueva Programación: fecha fija en cabecera y selección única de sitio. | Se eliminó el campo editable de fecha y se reubicó la fecha predefinida en la cabecera como un distintivo destacado (`.prog-modal-date-badge`). Se eliminaron los contadores de sitios e integrantes del encabezado y pie de página. Se cambió la selección de sitios a selección única exclusiva (radio button / clic único). Se eliminó la barra de filtros por grupos y el conteo total de sitios. Se optimizó la responsividad para tablets y móviles (apilado vertical, padding dinámico, botones expandidos al 100% y scroll sin desbordamientos). |
| **24-10-2026** | Depuración visual extrema del modal Nueva Programación: fecha como subtítulo, remoción de notas, pie simplificado y sitios mínimos. | La fecha se reubicó directamente debajo del título principal y se eliminó el subtítulo descriptivo ("Asignación de personal operativo..."). Se removió el bloque de 'Notas o Itinerario' y el texto de jornada en el pie. En cuadrillas rápidas se eliminó la mención '1 Clic' y 'Técnico + Conductor'. En la lista de sitios se simplificó la presentación exclusivamente al Código de Sitio, Nombre de Lugar/Localidad y Zona (eliminados grupo y nombres secundarios de nodo). |
| **26-10-2026** | Cierre exclusivo de ventanas emergentes (modales y drawers) mediante botón 'X' o tecla 'Esc'. | Se eliminó el cierre accidental al hacer clic en el backdrop/overlay exterior en todos los modales del sistema (Programación, Sitios, Técnicos, Dashboard y Observaciones). Ahora las ventanas emergentes solo se cierran intencionalmente al pulsar el botón 'X' o presionar la tecla 'Esc'. |
| **26-10-2026** | Remoción del botón manual de guardar comentario y persistencia automática al cerrar la ventana/página. | Se eliminó el botón manual 'Guardar' que aparecía al redactar notas en las observaciones del modal de detalles. Los comentarios ahora se guardan automáticamente al perder el foco (`onBlur`), al cambiar de pestaña de sitio, al cerrar la ventana con el botón 'X' o tecla 'Esc', y ante el cierre o recarga de la página web (`beforeunload` y desmontaje). |
| **26-10-2026** | Incorporación de botón y modal emergente de 'Avance del Día' en Programación sin alterar estructura existente. | Se agregó el botón `[ 📊 Avance del Día ]` en la barra superior de Programación (`prog-toolbar-actions`). Al hacer clic, abre `ModalAvanceDia` para la fecha activa consultando `getAvancePorFecha()`. Cuenta con contadores de estado como filtros (Total, Por Subir, En Revisión, Enviadas, Descartadas, Rechazadas), buscador en vivo, exportación oficial a Excel (.xlsx) con regla inmutable de CÓDIGO DE SITIO acompañado de LOCALIDAD, y visor de detalle de observación. Cierre seguro únicamente mediante 'X' o 'Esc'. |
| **26-10-2026** | Eliminación de columna '#' y exportación/copia a portapapeles de reporte en imagen PNG (`imageExportService.js`). | Se removió la columna correlativa `#` tanto en la tabla en pantalla como en el Excel para maximizar la visibilidad del código de observación y localidad. Se implementó `imageExportService.js` mediante HTML5 Canvas de ultra alta definición (2x Retina) que genera un reporte gráfico institucional (cabecera con fecha, medidores de estado, tabla con códigos, técnicos, sitios y badges de estado). Se agregaron los botones 'Copiar PNG' (copia directa al portapapeles con `ClipboardItem` para pegar en WhatsApp o correo) y 'Descargar PNG' (descarga directa de archivo). |
| **26-10-2026** | Reestructuración de medidores en Observaciones a 6 KPIs operativos interactivos. | Se actualizaron los medidores de la página `/observaciones` para reflejar exactamente: 1. Total Observaciones (navy), 2. Pendientes (amber), 3. Subsanadas / Subidas (emerald), 4. Rechazadas (rose), 5. Descartadas (purple) y 6. Total de Sitios (sky - 156 nodos georreferenciados). Cada medidor funciona como un filtro interactivo con clic y se actualizó `fetchObservacionesKPIs` en `observacionesService.js` para consultar en paralelo los conteos exactos. Soporte responsivo de 6 columnas en pantallas grandes, 3x2 en laptop y 2x3 en móvil. |
| **26-10-2026** | Rediseño y ampliación ergonómica de la selección de personal en el modal Nueva Programación. | Se solucionó el problema de nombres truncados y altura deficiente en celulares. Se desacopló la fila de personal en una tarjeta con estructura vertical limpia (nombre completo en tipografía destacada arriba y badges de cargo/cuadrilla debajo). Se duplicó la altura efectiva de la lista en móviles (de 120px a 270px) permitiendo ver 4-5 técnicos a la vez, y se compactó el bloque de 'Cuadrillas Rápidas' a una cuadrícula de 3 columnas para liberar espacio vertical sin apretar la lista. En escritorio, se eliminó el límite artificial de max-height y se asignó flex: 1 con overflow: hidden en la columna izquierda para que la lista de técnicos ocupe el 100% del alto disponible simétricamente con la lista de sitios, eliminando todo espacio en blanco inferior. |
| **26-10-2026** | Conexión de tabla Personal con Usuarios mediante Perfiles y Roles (Opción 3) y gestión exclusiva de contraseña para Administrador. | Se implementó la arquitectura de Roles y Perfiles vinculando `auth.users`, `public.perfiles_usuario` y `public.personal`. En `useAuth.jsx` se agregó carga reactiva de roles, enlace automático de personal, detección estricta de `isAdmin` (asignado a `jcarloscc1101@gmail.com`) y función de actualización nativa de contraseña `updatePassword`. En la pantalla `/tecnicos` se añadió el botón y modal de seguridad `[ 🔑 Mi Contraseña ]` accesible y visible **únicamente para el Administrador** (bloqueado y oculto para técnicos u otros usuarios), con validación en tiempo real y persistencia en Supabase. Se añadió además el campo de correo electrónico en el registro de personal para futuros enlaces y se actualizó el Sidebar para mostrar el rol dinámico y nombre real del usuario. Se generó el script SQL `setup_perfiles_usuario.sql`. |
| **26-10-2026** | Reestructuración integral del Dashboard (`/`): Medidores generales de todo el proyecto y remoción del avance del día. | Siguiendo la solicitud del usuario tras la reubicación del avance del día en Programación, se rediseñó completamente la pantalla de inicio (`Dashboard.jsx`). Se eliminó el selector de fecha, los controles de jornada y la tabla de avances diarios. Ahora el Dashboard actúa como el Centro de Control Ejecutivo Global del Proyecto: 1. Medidores generales de alto nivel; 2. Panel panorámico con Tacómetro semicircular de avance global y barra segmentada de distribución; 3. Balance comparativo y barras de progreso por cada uno de los 6 Grupos Territoriales; 4. Cobertura territorial por Zonas (ZONA 2 y ZONA 7); 5. Monitor ejecutivo de los 156 sitios con buscador reactivo y filtros de grupo. |
| **26-10-2026** | Estandarización de 6 medidores clave en Observaciones y Dashboard en orden del ciclo operativo. | Se reconfiguraron los 6 medidores de la cabecera en `/observaciones` y `/` para presentar exactamente las 6 métricas solicitadas ordenadas según el ciclo de vida del trabajo de subsanación: 1. **Total de Observaciones** (navy - universo del proyecto), 2. **Pendientes** (amber - trabajo por subsanar en campo), 3. **Subidas** (sky - estado Enviado a supervisión COVEPA/Pronatel), 4. **Validadas** (emerald - estado Validado con conformidad), 5. **Rechazadas** (rose - estado Rechazado que requiere corrección), 6. **Descartadas** (purple - estado Descartado que no aplica o cerrada). En `observacionesService.js` se optimizó `fetchObservacionesKPIs` desacoplando el filtro de estado para mantener los contadores estables al interactuar con las tarjetas y filtrando la tabla en vivo al hacer clic en cualquiera de ellas. |
| **26-10-2026** | Registro de Carlos Cóndor (Supervisor COVEPA), rediseño visual de Personal y métrica de cuenta de acceso al sistema. | 1. Se incorporó a **Carlos Cóndor** con DNI `73144613`, celular `958086874`, cargo `SUPERVISOR` en empresa `COVEPA` con cuenta activa vinculada al correo `jcarloscc1101@gmail.com`. 2. Se rediseñó íntegramente la vista `/tecnicos` con la identidad institucional (tarjetas blancas nítidas, contrastes azul marino `#003060`, insignias monospace de DNI, badges de empresa/cargo, contactos telefónicos y acceso directo a WhatsApp). 3. En el detalle del integrante (`DrawerPersonal`) se implementó la **Métrica y Gestión de Cuenta de Acceso al Programa**, mostrando el estado de credenciales, DNI, correo y un control interactivo para habilitar o deshabilitar el acceso al sistema con persistencia inmediata en Supabase. 4. Se actualizó el formulario de registro (`ModalPersonal`) con campos de DNI y switch de acceso web. |
| **26-10-2026** | Integración directa con Base de Datos Externa (`Amazonas-SELNET`) para tabla `personal` y asignación de roles en BD Local. | 1. Conexión de `personalService.js` a `supabaseExt` (`iiwmqvnjjhaapyolaity.supabase.co`) como fuente única de verdad para consultar, registrar, editar y dar de baja personal, abandonando la tabla aislada local. 2. Implementación de esquema de asignación de cuentas en esta BD local (`byywikicdvmmmndhkooe.perfiles_usuario`), vinculando cada personal externo con su rol de sistema (`admin`, `supervisor`, `coordinador`, `tecnico`) y permiso de acceso. 3. Sincronización transparente de espejo local no bloqueante para preservar claves foráneas en `programaciones`. 4. Adaptación completa de vistas de Personal (Tarjetas y Tabla ERP) con insignias de rol COVEPA, estado en BD externa y botones de asignación directa desde el Drawer de Ficha. |
| **26-10-2026** | Incorporación de columna `ciudad_origen`, desacoplamiento total de tabla `personal` local y mapeo histórico de asignaciones. | 1. Soporte completo de la columna `ciudad_origen` en `personalService.js`, `ModalPersonal` y `DrawerPersonal`. 2. Eliminación de todas las consultas y escrituras a la tabla local `personal` en el frontend (`src/`), permitiendo que el usuario elimine la tabla local sin causar errores. 3. Desacoplamiento de `getProgramaciones` de uniones foráneas SQL a `personal`, resolviendo el personal asignado en memoria desde la BD externa. 4. Implementación de mapa de nombres históricos (`KNOWN_LEGACY_NAMES`) y utilidad `reassignProgramacionStaff` para reasignar las 31 programaciones existentes a los nuevos UUIDs de la BD externa. |
| **26-10-2026** | Regla inmutable de BD (sólo UPDATE de celdas) y auditoría de tablas. | 1. Regla: el asistente sólo puede modificar celdas; inserción de filas, columnas o eliminaciones se entregan mediante script SQL al usuario. 2. Auditoría: `public.personal` en BD local quedó obsoleta y desconectada; tablas activas locales: `observaciones`, `programaciones`, `programacion_sitios`, `programacion_personal`, `perfiles_usuario`; tablas activas externas: `personal`, `sitios`. |
| **26-10-2026** | Estandarización de Grupo a Cuadrilla y asignación oficial de integrantes (Cuadrillas 1 a 6). | 1. Reemplazo integral de 'Grupo 1...6' por 'Cuadrilla 1...6' en exportaciones oficiales a Excel (columna CUADRILLA), Centro de Descargas (KMZ), Dashboard ejecutivo, catálogo de sitios y tabla de observaciones. 2. Asignación oficial fija de técnicos y conductores según cuadro de asistencia operativa (Cuadrilla 1: Jhonatan Flores + Carlos Perez; Cuadrilla 2: Cristian Isla + Jhordin Perez; Cuadrilla 3: Daniel Javier + Lino Ticlla; Cuadrilla 4: Alfonso Curi + Nilson Vera; Cuadrilla 5: William Avila + Jhordin Antonio; Cuadrilla 6: Gabriel Farro + Ander Peralta). 3. Entrega de script SQL `setup_insertar_conductores_external.sql` para registrar oficialmente a los 6 conductores en la BD externa. |
| **26-10-2026** | Columna dedicada de Cuadrilla y filtro reactivo en la tabla de Observaciones (`/observaciones`). | 1. Se incorporó la columna dedicada **'Cuadrilla'** en la tabla principal de observaciones junto al código de observación. 2. Cada fila muestra la insignia destacada de su cuadrilla asignada (`CUADRILLA 1` a `CUADRILLA 6`) mapeada en tiempo real según el sitio. 3. Se agregó el selector desplegable 'Todas las Cuadrillas' en la barra de filtros superior para filtrar observaciones por cuadrilla de forma reactiva. 4. Se incluyó la cuadrilla en el panel lateral de detalle (`ObsDrawer`) y en las exportaciones CSV. |



---

> [!IMPORTANT]
> **Compromiso de Actualización y Consulta:** Las actualizaciones **NO son automáticas** para cualquier cambio. Para modificaciones de gran magnitud (arquitectura, reestructuración de módulos, esquemas de BD o lógica central), **se debe consultar y solicitar confirmación previa al usuario** antes de proceder. Una vez aprobado e implementado el cambio, se documentará en este archivo.



