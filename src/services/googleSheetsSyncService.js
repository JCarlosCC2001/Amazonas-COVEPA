/**
 * =========================================================================
 * SERVICIO: Sincronización de Reporte Excel en Línea (Google Sheets)
 * Archivo: src/services/googleSheetsSyncService.js
 * =========================================================================
 * Maneja la preparación de datos y la sincronización bidireccional con
 * la hoja de cálculo de Google Drive 'Levantamiento de Observaciones Amazonas':
 * - Pestaña 1: Amazonas Original
 * - Pestaña 2: Amazonas Ampliación
 *
 * Columnas actualizadas por código de observación:
 *   - Cuadrilla Ejecutora (Col D)
 *   - Técnico Asignado   (Col E)
 *   - Estado             (Col F)
 *   - Fecha Actualización (Col G)
 *   - Revisor            (Col H)
 * =========================================================================
 */

import { supabase } from '../lib/supabase'
import { esAmpliacionObs, resolverNombreTecnico } from '../shared/reportesCore'
import { formatPrimerNombrePrimerApellido } from '../utils/helpers'

const STORAGE_KEY_CONFIG = 'covepa_google_sheets_config'
const STORAGE_KEY_ULTIMO_SYNC = 'covepa_google_sheets_ultimo_sync'

export const DEFAULT_SHEETS_CONFIG = {
  urlHoja: 'https://docs.google.com/spreadsheets/d/1vC1e2q3w4e5r6t7y8u9i0/edit',
  webhookUrl: 'https://script.google.com/macros/s/AKfycbykqyocf2riK4Cp0Q1onBDh9MJc2DANHLdKsVBQOQ_2WSZRw65WpWd8d4lK3EFYnOrN/exec',
  pestañaOriginal: 'Amazonas Original',
  pestañaAmpliacion: 'Amazonas Ampliación',
  activo: true
}

/**
 * Código fuente oficial de Google Apps Script para que el usuario lo pegue
 * en Extensiones > Apps Script dentro de su Google Sheet.
 */
export const APPS_SCRIPT_SOURCE_CODE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: SINCRONIZACIÓN DE OBSERVACIONES AMAZONAS-COVEPA
 * =========================================================================
 * Instrucciones:
 * 1. En tu Google Sheet ve a: Extensiones > Apps Script.
 * 2. Borra cualquier código y pega este contenido completo.
 * 3. Clic en Guardar (ícono de disco).
 * 4. Clic en "Implementar" (botón azul) > "Nueva implementación".
 * 5. Tipo: "Aplicación web".
 *    - Ejecutar como: "Yo (tu correo)"
 *    - Quién tiene acceso: "Cualquier usuario"
 * 6. Copia la URL generada (termina en /exec) y pégala en Amazonas-COVEPA.
 * =========================================================================
 */

function doPost(e) {
  try {
    var raw = e.postData.contents;
    var payload = JSON.parse(raw);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    var updatedOriginal = 0;
    var updatedAmpliacion = 0;

    // 1. Sincronizar pestaña: Amazonas Original
    if (payload.original && Array.isArray(payload.original)) {
      var sheetOrig = ss.getSheetByName('Amazonas Original');
      if (sheetOrig) {
        updatedOriginal = syncSheetTab(sheetOrig, payload.original);
      }
    }

    // 2. Sincronizar pestaña: Amazonas Ampliación
    if (payload.ampliacion && Array.isArray(payload.ampliacion)) {
      var sheetAmp = ss.getSheetByName('Amazonas Ampliación');
      if (sheetAmp) {
        updatedAmpliacion = syncSheetTab(sheetAmp, payload.ampliacion);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      updatedOriginal: updatedOriginal,
      updatedAmpliacion: updatedAmpliacion,
      totalUpdated: updatedOriginal + updatedAmpliacion,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function syncSheetTab(sheet, items) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  if (values.length <= 1) return 0;

  var headers = values[0].map(function(h) {
    return String(h || '').trim().toLowerCase();
  });

  // Localizar índices de columnas
  var colObsIdx = -1;
  var colCuadIdx = -1;
  var colTecIdx = -1;
  var colEstIdx = -1;
  var colFecIdx = -1;
  var colRevIdx = -1;

  for (var c = 0; c < headers.length; c++) {
    var h = headers[c];
    if (h.indexOf('código obs') !== -1 || h.indexOf('codigo obs') !== -1) colObsIdx = c;
    else if (h.indexOf('cuadrilla') !== -1) colCuadIdx = c;
    else if (h.indexOf('técnico') !== -1 || h.indexOf('tecnico') !== -1) colTecIdx = c;
    else if (h === 'estado' || h.indexOf('estado') === 0) colEstIdx = c;
    else if (h.indexOf('fecha actualiz') !== -1 || h.indexOf('fecha') !== -1) colFecIdx = c;
    else if (h.indexOf('revisor') !== -1) colRevIdx = c;
  }

  if (colObsIdx === -1) return 0;

  // Indexar items a actualizar
  var updates = {};
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (it && it.id_obs) {
      updates[String(it.id_obs).trim().toUpperCase()] = it;
    }
  }

  var updatedCount = 0;
  var hasChanges = false;

  for (var r = 1; r < values.length; r++) {
    var code = String(values[r][colObsIdx] || '').trim().toUpperCase();
    if (!code || !updates[code]) continue;

    var upd = updates[code];
    var rowChanged = false;

    // Cuadrilla Ejecutora
    if (colCuadIdx !== -1 && upd.cuadrilla !== undefined) {
      var valC = String(upd.cuadrilla || '').trim();
      if (String(values[r][colCuadIdx] || '').trim() !== valC) {
        values[r][colCuadIdx] = valC;
        rowChanged = true;
      }
    }

    // Técnico Asignado
    if (colTecIdx !== -1 && upd.tecnico !== undefined) {
      var valT = String(upd.tecnico || '').trim();
      if (String(values[r][colTecIdx] || '').trim() !== valT) {
        values[r][colTecIdx] = valT;
        rowChanged = true;
      }
    }

    // Estado
    if (colEstIdx !== -1 && upd.estado !== undefined) {
      var valE = String(upd.estado || '').trim();
      if (String(values[r][colEstIdx] || '').trim() !== valE) {
        values[r][colEstIdx] = valE;
        rowChanged = true;
      }
    }

    // Fecha Actualización (DD/MM/YYYY)
    if (colFecIdx !== -1 && upd.fecha !== undefined && upd.fecha !== '') {
      var valF = String(upd.fecha || '').trim();
      if (String(values[r][colFecIdx] || '').trim() !== valF) {
        values[r][colFecIdx] = valF;
        rowChanged = true;
      }
    }

    // Revisor
    if (colRevIdx !== -1 && upd.revisor !== undefined) {
      var valR = String(upd.revisor || '').trim();
      if (String(values[r][colRevIdx] || '').trim() !== valR) {
        values[r][colRevIdx] = valR;
        rowChanged = true;
      }
    }

    if (rowChanged) {
      updatedCount++;
      hasChanges = true;
    }
  }

  if (hasChanges) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }

  return updatedCount;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    sistema: 'Amazonas-COVEPA',
    descripcion: 'Webhook activo para sincronización de Google Sheets'
  })).setMimeType(ContentService.MimeType.JSON);
}
`

/**
 * Obtener configuración guardada en localStorage
 */
export function getStoredSheetsConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (!raw) return DEFAULT_SHEETS_CONFIG
    return { ...DEFAULT_SHEETS_CONFIG, ...JSON.parse(raw) }
  } catch (_) {
    return DEFAULT_SHEETS_CONFIG
  }
}

/**
 * Guardar configuración en localStorage
 */
export function saveStoredSheetsConfig(cfg) {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(cfg))
    return true
  } catch (err) {
    console.error('Error guardando configuración de Google Sheets:', err)
    return false
  }
}

/**
 * Obtener datos del último sync realizado
 */
export function getStoredUltimoSync() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ULTIMO_SYNC)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

/**
 * Formatear fecha a DD/MM/YYYY para Google Sheets
 */
function formatearFechaDDMMYYYY(fechaStr) {
  if (!fechaStr) return ''
  try {
    const d = new Date(fechaStr)
    if (isNaN(d.getTime())) {
      // Si ya viene con formato YYYY-MM-DD
      const m = String(fechaStr).match(/^(\d{4})-(\d{2})-(\d{2})/)
      if (m) return `${m[3]}/${m[2]}/${m[1]}`
      return String(fechaStr)
    }
    return d.toLocaleDateString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  } catch (_) {
    return String(fechaStr)
  }
}

/**
 * Extrae y estructura las observaciones separadas en Original y Ampliación
 */
export async function fetchDatosParaGoogleSheets() {
  const { data, error } = await supabase
    .from('observaciones')
    .select('id_obs, id_sitio, cuadrilla_ejecutora, tecnico_ejecutor, estado_covepa, estado_gilat, fecha_subsanacion, revisor')

  if (error) {
    throw new Error(`Error consultando observaciones: ${error.message}`)
  }

  const original = []
  const ampliacion = []

  for (const obs of (data || [])) {
    const esAmex = esAmpliacionObs(obs.id_sitio, obs.id_obs)
    const estadoFinal = obs.estado_covepa || obs.estado_gilat || 'Pendiente'
    const tecVisible = formatPrimerNombrePrimerApellido(resolverNombreTecnico(obs.tecnico_ejecutor) || obs.tecnico_ejecutor) || ''
    const item = {
      id_obs: obs.id_obs,
      id_sitio: obs.id_sitio,
      cuadrilla: obs.cuadrilla_ejecutora || '',
      tecnico: tecVisible,
      estado: estadoFinal,
      fecha: formatearFechaDDMMYYYY(obs.fecha_subsanacion),
      revisor: obs.revisor || ''
    }

    if (esAmex) {
      ampliacion.push(item)
    } else {
      original.push(item)
    }
  }

  return {
    original,
    ampliacion,
    total: original.length + ampliacion.length
  }
}

/**
 * Ejecuta la llamada Webhook a Google Apps Script
 */
export async function sincronizarGoogleSheets(webhookUrl, datos) {
  if (!webhookUrl || !webhookUrl.trim()) {
    throw new Error('La URL del Webhook de Apps Script no está configurada.')
  }

  const cleanUrl = webhookUrl.trim()
  const payload = {
    original: datos.original,
    ampliacion: datos.ampliacion,
    enviado_at: new Date().toISOString()
  }

  // Se usa 'text/plain;charset=utf-8' para evitar preflight CORS en Google Apps Script
  const response = await fetch(cleanUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },
    body: JSON.stringify(payload)
  })

  let result = null
  try {
    result = await response.json()
  } catch (_) {
    // Si la respuesta fue opaca o redirección exitosa
    if (response.ok) {
      result = { success: true, totalUpdated: datos.total, timestamp: new Date().toISOString() }
    } else {
      throw new Error(`Respuesta HTTP ${response.status} de Google Apps Script.`)
    }
  }

  if (result && result.success !== false) {
    const syncAudit = {
      fecha: new Date().toISOString(),
      updatedOriginal: result.updatedOriginal ?? 0,
      updatedAmpliacion: result.updatedAmpliacion ?? 0,
      totalUpdated: result.totalUpdated ?? ((result.updatedOriginal || 0) + (result.updatedAmpliacion || 0)),
      totalExaminados: datos.total
    }
    try {
      localStorage.setItem(STORAGE_KEY_ULTIMO_SYNC, JSON.stringify(syncAudit))
    } catch (_) {}
    return syncAudit
  } else {
    throw new Error(result?.error || 'Error desconocido al actualizar la hoja de cálculo.')
  }
}
