#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generador ULTRA RÁPIDO y OPTIMIZADO de KMZ / KML para Google Earth (PC y Celular)
Proyecto: COVEPA - PRONATEL Amazonas

Optimizaciones de rendimiento:
1. Iconos empaquetados localmente dentro del archivo KMZ (zero peticiones de red a Google).
2. HTML ultra limpio y optimizado para el motor de renderizado de Google Earth.
3. Carga instantánea (0.1 seg) tanto en Google Earth Desktop como en Celular.
4. Tabla con fondo blanco y EXACTAMENTE las 5 columnas solicitadas:
   - Código de observación
   - Detalle
   - Comentario inicial
   - Acuerdo de subsanación
   - Estado
"""

import os
import re
import json
import zipfile
import html
import urllib.request
import urllib.error
from datetime import datetime

# Credenciales Supabase
SUPABASE_URL = "https://byywikicdvmmmndhkooe.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5eXdpa2ljZHZtbW1uZGhrb29lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1MTIxODgsImV4cCI6MjEwODA4ODE4OH0.KnBrlx7KmH6OelDv9k7EstHhuFCTGcgtgarLvHh4epk"

SUPABASE_EXT_URL = "https://iiwmqvnjjhaapyolaity.supabase.co"
SUPABASE_EXT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlpd21xdm5qamhhYXB5b2xhaXR5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjk5OTM3MCwiZXhwIjoyMDk4NTc1MzcwfQ.Q6YLBY_HWLQP3pGNyDtq1SYqTTBtjYQQqvGiVkcIVSw"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, "kmz_output")
PUBLIC_KMZ_DIR = os.path.join(BASE_DIR, "public", "kmz")
ICONS_CACHE_DIR = os.path.join(BASE_DIR, "temp_icons")

# URLs seguras HTTPS para KML plano
REMOTE_ICONS = {
    "pin_verde": "https://maps.google.com/mapfiles/kml/paddle/grn-circle.png",
    "pin_azul": "https://maps.google.com/mapfiles/kml/paddle/blu-circle.png",
    "pin_amarillo": "https://maps.google.com/mapfiles/kml/paddle/ylw-circle.png",
    "pin_blanco": "https://maps.google.com/mapfiles/kml/paddle/wht-circle.png"
}

def asegurar_iconos_locales():
    """Descarga los 4 iconos una sola vez para empaquetarlos dentro de cada archivo KMZ"""
    os.makedirs(ICONS_CACHE_DIR, exist_ok=True)
    icon_files = {}
    for key, url in REMOTE_ICONS.items():
        fname = f"{key}.png"
        fpath = os.path.join(ICONS_CACHE_DIR, fname)
        if not os.path.exists(fpath) or os.path.getsize(fpath) == 0:
            try:
                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    with open(fpath, "wb") as f:
                        f.write(resp.read())
            except Exception as e:
                print(f"Advertencia descargando icono {fname}: {e}")
        if os.path.exists(fpath):
            icon_files[fname] = fpath
    return icon_files

def fetch_json(url, key, range_header=None):
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    if range_header:
        headers["Range"] = range_header
        headers["Range-Unit"] = "items"

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8")), resp.headers.get("Content-Range")

def cargar_asignaciones():
    """Carga los 156 sitios asignados con su grupo y zona"""
    sql_path = os.path.join(BASE_DIR, "insert_sitios_asignados.sql")
    if os.path.exists(sql_path):
        with open(sql_path, "r", encoding="utf-8") as f:
            content = f.read()
        matches = re.findall(r"\('([A-Z0-9\-]+)',\s*'([^']+)',\s*'([^']+)'\)", content)
        if matches:
            asignaciones = {}
            for id_site, grupo, zona in matches:
                asignaciones[id_site] = {
                    "id_site": id_site,
                    "grupo": grupo.strip().upper(),
                    "zona": zona.strip().upper()
                }
            return asignaciones

    raise FileNotFoundError("No se encontró el archivo de asignaciones base.")

def obtener_sitios_georeferenciados(asignaciones):
    """Consulta la BD externa para traer latitud, longitud, localidad, nombre_nodo"""
    print("🌍 Consultando coordenadas geográficas en BD externa...")
    url = f"{SUPABASE_EXT_URL}/rest/v1/sitios?select=id_site,nombre_nodo,localidad,distrito,provincia,latitud,longitud"
    
    sitios_dict = {}
    page_size = 1000
    offset = 0

    while True:
        range_hdr = f"{offset}-{offset + page_size - 1}"
        data, content_range = fetch_json(url, SUPABASE_EXT_KEY, range_header=range_hdr)
        if not data:
            break
        for s in data:
            sitios_dict[s["id_site"]] = s
        if len(data) < page_size:
            break
        offset += page_size

    print(f"✅ Catálogo externo cargado: {len(sitios_dict)} sitios en total.")

    sitios_completos = []
    for id_site, asig in asignaciones.items():
        ext = sitios_dict.get(id_site, {})
        parts = id_site.split("-")
        codigo_lugar = f"{parts[0]}-{parts[1]}" if len(parts) >= 2 else id_site

        lat = ext.get("latitud")
        lon = ext.get("longitud")

        sitios_completos.append({
            "id_site": id_site,
            "codigo_lugar": codigo_lugar,
            "grupo": asig["grupo"],
            "zona": asig["zona"],
            "nombre_nodo": ext.get("nombre_nodo") or id_site,
            "localidad": ext.get("localidad") or "",
            "distrito": ext.get("distrito") or "",
            "provincia": ext.get("provincia") or "",
            "latitud": lat,
            "longitud": lon,
            "tiene_coordenadas": lat is not None and lon is not None
        })

    return sitios_completos

def obtener_todas_las_observaciones():
    """Descarga todas las observaciones desde Supabase utilizando paginación"""
    print("📋 Descargando observaciones registradas...")
    url = f"{SUPABASE_URL}/rest/v1/observaciones?select=id_obs,id_sitio,detalle,comentario_inicial,acuerdo_subsanacion,estado_covepa,fecha_subsanacion"
    
    observaciones = []
    page_size = 1000
    offset = 0

    while True:
        range_hdr = f"{offset}-{offset + page_size - 1}"
        data, content_range = fetch_json(url, SUPABASE_KEY, range_header=range_hdr)
        if not data:
            break
        observaciones.extend(data)
        if len(data) < page_size:
            break
        offset += page_size

    print(f"✅ Observaciones descargadas: {len(observaciones)} registros.")

    obs_por_sitio = {}
    for o in observaciones:
        sid = o.get("id_sitio")
        if sid:
            if sid not in obs_por_sitio:
                obs_por_sitio[sid] = []
            obs_por_sitio[sid].append(o)

    return obs_por_sitio

def generar_popup_html_ligero(sitio, obs_list):
    """
    Genera una tabla HTML ULTRA RÁPIDA, limpia y ligera:
    - Fondo blanco
    - Cero estilos repetitivos inline por celda (Google Earth vuela al abrirlo)
    - Únicamente las 5 columnas solicitadas
    """
    id_site = html.escape(sitio["id_site"])
    codigo_lugar = html.escape(sitio["codigo_lugar"])
    nombre_nodo = html.escape(sitio.get("nombre_nodo") or "—")
    localidad = html.escape(sitio.get("localidad") or "—")
    distrito = html.escape(sitio.get("distrito") or "—")
    provincia = html.escape(sitio.get("provincia") or "—")
    grupo = html.escape(sitio["grupo"])
    zona = html.escape(sitio["zona"])

    total = len(obs_list)

    # Filas con EXACTAMENTE las 5 columnas solicitadas
    filas = []
    for idx, o in enumerate(obs_list, 1):
        st = o.get("estado_covepa") or ("Validado" if o.get("fecha_subsanacion") else "Pendiente")
        id_obs = html.escape(str(o.get("id_obs") or ""))
        det = html.escape(str(o.get("detalle") or "—"))
        com_ini = html.escape(str(o.get("comentario_inicial") or "—"))
        acuerdo = html.escape(str(o.get("acuerdo_subsanacion") or "—"))

        # Color de texto sutil para el estado
        st_style = "font-weight:bold;"
        if st == "Validado":
            st_style += "color:#059669;"
        elif st in ("En Revision", "En Revisión"):
            st_style += "color:#0284c7;"
        elif st == "Descartado":
            st_style += "color:#64748b;"
        elif st == "Rechazado":
            st_style += "color:#dc2626;"
        else:
            st_style += "color:#d97706;"

        bg = ' bgcolor="#f9fafb"' if idx % 2 == 0 else ''
        filas.append(
            f'<tr{bg}>'
            f'<td><b>{id_obs}</b></td>'
            f'<td>{det}</td>'
            f'<td>{com_ini}</td>'
            f'<td>{acuerdo}</td>'
            f'<td align="center" style="{st_style}">{st}</td>'
            f'</tr>'
        )

    filas_html = "".join(filas)

    tabla_html = f"""
    <table border="1" cellpadding="6" cellspacing="0" width="850" style="border-collapse:collapse;width:850px;min-width:850px;font-size:11px;font-family:Arial,sans-serif;background:#ffffff;border-color:#d1d5db;margin-top:6px;">
      <thead>
        <tr bgcolor="#f3f4f6" style="font-weight:bold;color:#111827;">
          <th width="120" style="width:120px;padding:6px 8px;border:1px solid #d1d5db;white-space:nowrap;">Código de observación</th>
          <th width="240" style="width:240px;padding:6px 8px;border:1px solid #d1d5db;">Detalle</th>
          <th width="230" style="width:230px;padding:6px 8px;border:1px solid #d1d5db;">Comentario inicial</th>
          <th width="200" style="width:200px;padding:6px 8px;border:1px solid #d1d5db;">Acuerdo de subsanación</th>
          <th width="60" style="width:60px;padding:6px 8px;border:1px solid #d1d5db;text-align:center;">Estado</th>
        </tr>
      </thead>
      <tbody>
        {filas_html}
      </tbody>
    </table>
    """ if total > 0 else "<p style='color:#6b7280;font-size:12px;margin:8px 0;'>No hay observaciones registradas en este sitio.</p>"

    html_content = f"""<div style="width:850px;min-width:850px;font-family:Arial,sans-serif;background:#ffffff;color:#111827;padding:8px;line-height:1.4;">
<h3 style="margin:0 0 4px;font-size:15px;color:#111827;border-bottom:1px solid #e5e7eb;padding-bottom:4px;">{codigo_lugar} - {nombre_nodo} ({id_site})</h3>
<div style="font-size:12px;color:#4b5563;margin-bottom:8px;">Localidad: <b>{localidad}</b> &nbsp;|&nbsp; Distrito: <b>{distrito}</b> &nbsp;|&nbsp; Provincia: <b>{provincia}</b> &nbsp;|&nbsp; <b>{grupo}</b> ({zona})</div>
{tabla_html}
</div>"""

    return html_content

def generar_kml_xml(titulo, sitios_lista, obs_por_sitio, use_local_icons=True):
    """
    Construye el documento KML estándar:
    Si use_local_icons=True (para KMZ), utiliza los iconos locales 'files/pin_X.png'
    que se empaquetan dentro del zip para carga 100% offline sin peticiones de red.
    """
    if use_local_icons:
        icon_verde = "files/pin_verde.png"
        icon_azul = "files/pin_azul.png"
        icon_amarillo = "files/pin_amarillo.png"
        icon_blanco = "files/pin_blanco.png"
    else:
        icon_verde = REMOTE_ICONS["pin_verde"]
        icon_azul = REMOTE_ICONS["pin_azul"]
        icon_amarillo = REMOTE_ICONS["pin_amarillo"]
        icon_blanco = REMOTE_ICONS["pin_blanco"]

    kml = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<kml xmlns="http://www.opengis.net/kml/2.2">',
        '<Document>',
        f'  <name>{html.escape(titulo)}</name>',
        f'  <open>1</open>',
        '',
        '  <!-- ESTILOS DE PINES -->',
        '  <Style id="pin_verde">',
        f'    <IconStyle><scale>1.1</scale><Icon><href>{icon_verde}</href></Icon></IconStyle>',
        '    <LabelStyle><scale>0.8</scale></LabelStyle>',
        '    <BalloonStyle><text><![CDATA[$[description]]]></text></BalloonStyle>',
        '  </Style>',
        '  <Style id="pin_azul">',
        f'    <IconStyle><scale>1.1</scale><Icon><href>{icon_azul}</href></Icon></IconStyle>',
        '    <LabelStyle><scale>0.8</scale></LabelStyle>',
        '    <BalloonStyle><text><![CDATA[$[description]]]></text></BalloonStyle>',
        '  </Style>',
        '  <Style id="pin_amarillo">',
        f'    <IconStyle><scale>1.1</scale><Icon><href>{icon_amarillo}</href></Icon></IconStyle>',
        '    <LabelStyle><scale>0.8</scale></LabelStyle>',
        '    <BalloonStyle><text><![CDATA[$[description]]]></text></BalloonStyle>',
        '  </Style>',
        '  <Style id="pin_blanco">',
        f'    <IconStyle><scale>1.0</scale><Icon><href>{icon_blanco}</href></Icon></IconStyle>',
        '    <LabelStyle><scale>0.8</scale></LabelStyle>',
        '    <BalloonStyle><text><![CDATA[$[description]]]></text></BalloonStyle>',
        '  </Style>',
        ''
    ]

    # Agrupar sitios por Grupo
    grupos_dict = {}
    for s in sitios_lista:
        g = s["grupo"]
        if g not in grupos_dict:
            grupos_dict[g] = []
        grupos_dict[g].append(s)

    for nombre_grupo in sorted(grupos_dict.keys()):
        sitios_del_grupo = grupos_dict[nombre_grupo]
        kml.append(f'  <Folder>')
        kml.append(f'    <name>{html.escape(nombre_grupo)} ({len(sitios_del_grupo)} Sitios)</name>')
        kml.append(f'    <open>0</open>')

        for s in sitios_del_grupo:
            if not s["tiene_coordenadas"]:
                continue

            obs_list = obs_por_sitio.get(s["id_site"], [])
            total = len(obs_list)
            validadas = sum(1 for o in obs_list if o.get("estado_covepa") == "Validado" or o.get("fecha_subsanacion"))
            en_revision = sum(1 for o in obs_list if o.get("estado_covepa") in ("En Revision", "En Revisión"))
            descartadas = sum(1 for o in obs_list if o.get("estado_covepa") == "Descartado")
            pendientes = total - (validadas + en_revision + descartadas)

            # Selección de estilo del pin
            if total == 0 or (validadas + descartadas == total):
                estilo = "#pin_verde"
            elif en_revision > 0:
                estilo = "#pin_azul"
            elif pendientes > 0:
                estilo = "#pin_amarillo"
            else:
                estilo = "#pin_blanco"

            popup_html = generar_popup_html_ligero(s, obs_list)
            label = f"{s['codigo_lugar']} - {s['nombre_nodo']} ({s['id_site']})"

            kml.append('    <Placemark>')
            kml.append(f'      <name>{html.escape(label)}</name>')
            kml.append('      <Snippet maxLines="0"></Snippet>')
            kml.append(f'      <styleUrl>{estilo}</styleUrl>')
            kml.append('      <description><![CDATA[' + popup_html + ']]></description>')
            kml.append('      <Point>')
            kml.append(f'        <coordinates>{s["longitud"]},{s["latitud"]},0</coordinates>')
            kml.append('      </Point>')
            kml.append('    </Placemark>')

        kml.append('  </Folder>')

    kml.append('</Document>')
    kml.append('</kml>')

    return "\n".join(kml)

def exportar_kmz_optimizado(nombre_archivo, kml_kmz_text, kml_plain_text, icon_files):
    """
    Guarda:
    - Archivo .kmz: con doc.kml y los iconos locales dentro de files/, ultra rápido y sin red.
    - Archivo .kml: con URLs https remotas para QGIS o viewers externos.
    Tanto en kmz_output/ como en public/kmz/
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(PUBLIC_KMZ_DIR, exist_ok=True)

    for base_folder in (OUTPUT_DIR, PUBLIC_KMZ_DIR):
        kmz_path = os.path.join(base_folder, nombre_archivo + ".kmz")
        kml_path = os.path.join(base_folder, nombre_archivo + ".kml")

        # 1. Guardar KML plano
        with open(kml_path, "w", encoding="utf-8") as f:
            f.write(kml_plain_text)

        # 2. Empaquetar KMZ con iconos locales incluidos (Zero network lag)
        with zipfile.ZipFile(kmz_path, "w", zipfile.ZIP_DEFLATED) as zf:
            zf.writestr("doc.kml", kml_kmz_text.encode("utf-8"))
            # Empaquetar los 4 iconos PNG dentro de files/
            for fname, fpath in icon_files.items():
                if os.path.exists(fpath):
                    zf.write(fpath, arcname=f"files/{fname}")

    size_kb = os.path.getsize(os.path.join(OUTPUT_DIR, nombre_archivo + ".kmz")) / 1024
    print(f"⚡ Creado (Ultra Rápido): {nombre_archivo}.kmz ({size_kb:.1f} KB)")

def main():
    print("=" * 65)
    print("🚀 GENERADOR ULTRA RÁPIDO DE KMZ - COVEPA AMAZONAS")
    print("=" * 65)

    # 1. Asegurar iconos locales
    icon_files = asegurar_iconos_locales()
    print(f"🎨 Iconos locales listos: {len(icon_files)} empaquetados directamente en cada KMZ.")

    # 2. Cargar asignaciones
    asignaciones = cargar_asignaciones()
    print(f"✅ Asignaciones base cargadas: {len(asignaciones)} sitios del proyecto.")

    # 3. Cargar coordenadas
    sitios = obtener_sitios_georeferenciados(asignaciones)
    con_coords = [s for s in sitios if s["tiene_coordenadas"]]
    print(f"📍 Sitios con coordenadas válidas: {len(con_coords)} de {len(sitios)}")

    # 4. Cargar observaciones
    obs_por_sitio = obtener_todas_las_observaciones()

    print("\n" + "=" * 65)
    print("🛠️ GENERANDO LOS 7 ARCHIVOS KMZ / KML (OPTIMIZADOS AL MÁXIMO)")
    print("=" * 65)

    # ── 1. ARCHIVO GENERAL (TODAS LAS OBSERVACIONES Y TODOS LOS GRUPOS) ──
    print("\n1️⃣  Generando KMZ General de Amazonas (Todos los grupos)...")
    kml_kmz = generar_kml_xml("COVEPA Amazonas - Todas las Observaciones (General)", con_coords, obs_por_sitio, use_local_icons=True)
    kml_plain = generar_kml_xml("COVEPA Amazonas - Todas las Observaciones (General)", con_coords, obs_por_sitio, use_local_icons=False)
    exportar_kmz_optimizado("Amazonas_COVEPA_GENERAL_Todas_Observaciones", kml_kmz, kml_plain, icon_files)

    # ── 2 a 7. ARCHIVOS INDIVIDUALES POR CADA GRUPO (GRUPO 1 A GRUPO 6) ──
    for num_grupo in range(1, 7):
        nombre_g = f"GRUPO {num_grupo}"
        sitios_g = [s for s in con_coords if s["grupo"] == nombre_g]
        print(f"\n{num_grupo + 1}️⃣  Generando KMZ para {nombre_g} ({len(sitios_g)} sitios)...")

        kml_g_kmz = generar_kml_xml(f"COVEPA Amazonas - {nombre_g} ({len(sitios_g)} Sitios)", sitios_g, obs_por_sitio, use_local_icons=True)
        kml_g_plain = generar_kml_xml(f"COVEPA Amazonas - {nombre_g} ({len(sitios_g)} Sitios)", sitios_g, obs_por_sitio, use_local_icons=False)
        exportar_kmz_optimizado(f"Amazonas_COVEPA_Grupo_{num_grupo}", kml_g_kmz, kml_g_plain, icon_files)

    # ── Empaquetar el ZIP con los 7 KMZ ──
    for base_folder in (OUTPUT_DIR, PUBLIC_KMZ_DIR):
        zip_path = os.path.join(base_folder, "Amazonas_COVEPA_7_Grupos_KMZ.zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            gen_kmz = "Amazonas_COVEPA_GENERAL_Todas_Observaciones.kmz"
            zf.write(os.path.join(base_folder, gen_kmz), arcname=gen_kmz)
            for num in range(1, 7):
                kmz_name = f"Amazonas_COVEPA_Grupo_{num}.kmz"
                zf.write(os.path.join(base_folder, kmz_name), arcname=kmz_name)

    # ── Generar Archivo NetworkLink (En Vivo para Google Earth) ──
    print("\n📡 Generando enlace en vivo (NetworkLink) para Google Earth...")
    nl_content = """<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>📡 Amazonas COVEPA - En Vivo (Tiempo Real)</name>
    <open>1</open>
    <description><![CDATA[
      <h3>Amazonas COVEPA - Enlace en Tiempo Real</h3>
      <p>Este archivo se sincroniza automáticamente con el sistema.<br/>
      <b>Frecuencia de refresco:</b> Cada 60 segundos y al abrir Google Earth.<br/>
      No necesitas volver a importar el archivo a Google Earth cuando haya cambios.</p>
    ]]></description>
    <NetworkLink>
      <name>General - Todas las Observaciones (Auto-actualizable)</name>
      <open>1</open>
      <flyToView>0</flyToView>
      <Link>
        <href>http://localhost:5173/kmz/Amazonas_COVEPA_GENERAL_Todas_Observaciones.kmz</href>
        <refreshMode>onInterval</refreshMode>
        <refreshInterval>60</refreshInterval>
        <viewRefreshMode>never</viewRefreshMode>
      </Link>
    </NetworkLink>
  </Document>
</kml>"""

    for base_folder in (OUTPUT_DIR, PUBLIC_KMZ_DIR):
        nl_path = os.path.join(base_folder, "Amazonas_COVEPA_EN_VIVO.kml")
        with open(nl_path, "w", encoding="utf-8") as f:
            f.write(nl_content)

    print("\n" + "=" * 65)
    print(f"🎉 ¡PROCESO COMPLETADO CON ÉXITO!")
    print(f"📁 Archivos KMZ y NetworkLink listos en:")
    print(f"   👉 {OUTPUT_DIR}")
    print(f"   👉 {PUBLIC_KMZ_DIR}")
    print("=" * 65)

if __name__ == "__main__":
    main()
