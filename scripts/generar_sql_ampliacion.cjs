const ExcelJS = require('exceljs')
const fs = require('fs')
const path = require('path')

async function generateSQL() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile('Lista de Ampliacion.xlsx')

  const wsSitios = wb.getWorksheet('sitios')
  const wsObs = wb.getWorksheet('obs')

  function esc(val) {
    if (val === null || val === undefined) return 'NULL'
    let s = String(val).trim()
    if (!s) return 'NULL'
    return "'" + s.replace(/'/g, "''") + "'"
  }

  function escNum(val) {
    if (val === null || val === undefined) return 'NULL'
    let n = parseFloat(val)
    return isNaN(n) ? 'NULL' : n
  }

  const sqlHeader = [
    '-- ==============================================================',
    '-- MIGRACIÓN: INSERCIÓN DE SITIOS Y OBSERVACIONES DE AMPLIACIÓN',
    '-- Proyecto: Amazonas - COVEPA',
    '-- Fecha: 16 de noviembre de 2026',
    '-- Total sitios: 27 | Total observaciones: 1236',
    '-- ==============================================================\n',
    '-- 1. Asignaciones de Sitios de Ampliación (sitios_cuadrillas)',
    'INSERT INTO public.sitios_cuadrillas (id_site, cuadrilla, zona, activo)',
    'VALUES'
  ]

  const sitiosValues = []
  wsSitios.eachRow((r, i) => {
    if (i > 1) {
      const id = (r.getCell(1).text || r.getCell(1).value || '').trim()
      const zona = (r.getCell(2).text || r.getCell(2).value || '').trim().toUpperCase()
      const grupo = (r.getCell(3).text || r.getCell(3).value || '').trim().replace(/GRUPO/gi, 'CUADRILLA').toUpperCase()
      sitiosValues.push(`  (${esc(id)}, ${esc(grupo)}, ${esc(zona)}, true)`)
    }
  })

  const sitiosSql = sqlHeader.join('\n') + '\n' + sitiosValues.join(',\n') +
    '\nON CONFLICT (id_site) DO UPDATE SET cuadrilla = EXCLUDED.cuadrilla, zona = EXCLUDED.zona, activo = true;\n\n'

  const obsValues = []
  wsObs.eachRow((r, i) => {
    if (i > 1) {
      const id_obs = r.getCell(1).text || r.getCell(1).value
      const hito = r.getCell(2).text || r.getCell(2).value
      const id_sitio = r.getCell(3).text || r.getCell(3).value
      let protocolo = (r.getCell(4).text || r.getCell(4).value || '').trim()
      if (!protocolo) protocolo = 'SEGURIDAD FÍSICA'
      const subsistema = r.getCell(5).text || r.getCell(5).value
      const detalle = r.getCell(6).text || r.getCell(6).value
      const item = r.getCell(7).value
      const sub_item = r.getCell(8).value
      const com_ini = r.getCell(9).text || r.getCell(9).value
      const com_comp = r.getCell(10).text || r.getCell(10).value
      const com_fin = r.getCell(11).text || r.getCell(11).value
      const acuerdo = r.getCell(12).text || r.getCell(12).value
      const est_gilat = r.getCell(13).text || r.getCell(13).value
      const est_covepa = r.getCell(14).text || r.getCell(14).value
      const est_pronatel = r.getCell(15).text || r.getCell(15).value
      const com_covepa = r.getCell(16).text || r.getCell(16).value
      const fecha_sub = r.getCell(17).text || r.getCell(17).value
      const revisor = r.getCell(18).text || r.getCell(18).value
      const just_demora = r.getCell(19).text || r.getCell(19).value
      const t_real = r.getCell(20).value
      const t_demora = r.getCell(21).value
      const f_demora = r.getCell(22).text || r.getCell(22).value

      obsValues.push(`  (${esc(id_obs)}, ${esc(hito)}, ${esc(id_sitio)}, ${esc(protocolo)}, ${esc(subsistema)}, ${esc(detalle)}, ${esc(item)}, ${esc(sub_item)}, ${esc(com_ini)}, ${esc(com_comp)}, ${esc(com_fin)}, ${esc(acuerdo)}, ${esc(est_gilat)}, ${esc(est_covepa)}, ${esc(est_pronatel)}, ${esc(com_covepa)}, ${esc(fecha_sub)}, ${esc(revisor)}, ${esc(just_demora)}, ${escNum(t_real)}, ${escNum(t_demora)}, ${esc(f_demora)})`)
    }
  })

  const chunkSize = 200
  const sqlChunks = [sitiosSql]

  for (let c = 0; c < obsValues.length; c += chunkSize) {
    const chunk = obsValues.slice(c, c + chunkSize)
    const chunkSql = '-- 2. Lote de Observaciones ' + (c + 1) + ' a ' + (c + chunk.length) + '\n' +
      'INSERT INTO public.observaciones (\n' +
      '  id_obs, hito, id_sitio, protocolo, subsistema, detalle,\n' +
      '  item, sub_item, comentario_inicial, comentario_complementario,\n' +
      '  comentario_final, acuerdo_subsanacion, estado_gilat, estado_covepa,\n' +
      '  estado_pronatel, comentario_covepa, fecha_subsanacion, revisor,\n' +
      '  justificacion_demora, tiempo_ejecucion_real, tiempo_ejecucion_demora, fecha_registro_demora\n' +
      ') VALUES\n' + chunk.join(',\n') + '\nON CONFLICT (id_obs) DO NOTHING;\n'
    sqlChunks.push(chunkSql)
  }

  const outPath = path.join(process.cwd(), 'sql', 'migraciones', '20261116_insertar_ampliacion_obs_y_sitios.sql')
  fs.writeFileSync(outPath, sqlChunks.join('\n'), 'utf8')
  console.log('Script SQL generado con éxito en:', outPath)
}

generateSQL().catch(console.error)
