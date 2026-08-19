/**
 * FILEMÓN — Puente entre la app de inventario y Google Sheets.
 *
 * Este archivo va DENTRO de su hoja de cálculo (Extensiones > Apps Script).
 * Instrucciones completas en el README del repositorio.
 */

// ─────────────────────────────────────────────────────────────
// 1. CAMBIE ESTA CLAVE POR UNA SUYA ANTES DE PUBLICAR
//    Debe ser exactamente la misma que escriba en la app.
//    Use algo largo, sin espacios. Ejemplo: filemon-yeso-2026-x7k9
// ─────────────────────────────────────────────────────────────
const CLAVE = 'CAMBIE-ESTA-CLAVE';

const HOJA_FIGURAS = 'FIGURAS';
const HOJA_VENTAS  = 'VENTAS';
const CARPETA      = 'Filemon - Fotos';

const COLUMNAS = ['id','codigo','nombre','categoria','claves','medidas','existencia',
                  'minimo','precio','dias','molde','ubicacion','notas','foto','actualizado'];

const COLUMNAS_VENTAS = ['fecha','id','codigo','nombre','cantidad','precio','total','cliente','nota'];


/**
 * Ejecute esta función UNA VEZ desde el editor (botón Ejecutar)
 * para que cree las hojas, los encabezados y la carpeta de fotos.
 */
function prepararHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();

  let hf = libro.getSheetByName(HOJA_FIGURAS);
  if (!hf) hf = libro.insertSheet(HOJA_FIGURAS);
  if (hf.getLastRow() === 0) {
    hf.getRange(1, 1, 1, COLUMNAS.length).setValues([COLUMNAS])
      .setFontWeight('bold').setBackground('#2B3439').setFontColor('#FFFFFF');
    hf.setFrozenRows(1);
    hf.setColumnWidth(3, 200);
    hf.setColumnWidth(5, 260);
  }

  let hv = libro.getSheetByName(HOJA_VENTAS);
  if (!hv) hv = libro.insertSheet(HOJA_VENTAS);
  if (hv.getLastRow() === 0) {
    hv.getRange(1, 1, 1, COLUMNAS_VENTAS.length).setValues([COLUMNAS_VENTAS])
      .setFontWeight('bold').setBackground('#146B52').setFontColor('#FFFFFF');
    hv.setFrozenRows(1);
  }

  carpetaFotos();
  // getUi() no está disponible en todos los contextos de ejecución.
  const aviso = 'Listo. Las hojas FIGURAS y VENTAS están preparadas.';
  Logger.log(aviso);
  try { SpreadsheetApp.getUi().alert(aviso); } catch (err) {}
}


function carpetaFotos() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}


function doPost(e) {
  const salida = ContentService.createTextOutput();
  salida.setMimeType(ContentService.MimeType.JSON);

  let peticion;
  try {
    peticion = JSON.parse(e.postData.contents);
  } catch (err) {
    salida.setContent(JSON.stringify({ ok: false, error: 'Petición ilegible' }));
    return salida;
  }

  if (peticion.token !== CLAVE) {
    salida.setContent(JSON.stringify({ ok: false, error: 'Clave incorrecta' }));
    return salida;
  }

  const candado = LockService.getScriptLock();
  try {
    candado.waitLock(20000);
    const datos = despachar(peticion.accion, peticion.datos || {});
    salida.setContent(JSON.stringify({ ok: true, datos: datos }));
  } catch (err) {
    salida.setContent(JSON.stringify({ ok: false, error: String(err && err.message || err) }));
  } finally {
    try { candado.releaseLock(); } catch (err) {}
  }
  return salida;
}


function doGet() {
  return ContentService
    .createTextOutput('Puente de Filemón activo. Use la app para conectarse.')
    .setMimeType(ContentService.MimeType.TEXT);
}


function despachar(accion, datos) {
  switch (accion) {
    case 'leer':     return { figuras: leerFiguras(), ventas: leerVentas() };
    case 'guardar':  return guardarFigura(datos);
    case 'eliminar': return eliminarFigura(datos.id);
    case 'venta':    return registrarVenta(datos);
    case 'importar': return importar(datos.figuras || []);
    default: throw new Error('Acción desconocida: ' + accion);
  }
}


function hoja(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('Falta la hoja ' + nombre + '. Ejecute prepararHoja() una vez.');
  return h;
}


function leerFiguras() {
  const h = hoja(HOJA_FIGURAS);
  if (h.getLastRow() < 2) return [];
  const filas = h.getRange(2, 1, h.getLastRow() - 1, COLUMNAS.length).getValues();
  return filas
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const o = {};
      COLUMNAS.forEach(function (c, i) { o[c] = f[i]; });
      ['existencia', 'minimo', 'precio', 'dias'].forEach(function (k) { o[k] = Number(o[k]) || 0; });
      o.actualizado = o.actualizado ? new Date(o.actualizado).toISOString() : '';
      return o;
    });
}


function leerVentas() {
  const h = hoja(HOJA_VENTAS);
  if (h.getLastRow() < 2) return [];
  const desde = Math.max(2, h.getLastRow() - 999);
  const n = h.getLastRow() - desde + 1;
  const filas = h.getRange(desde, 1, n, COLUMNAS_VENTAS.length).getValues();
  return filas
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const o = {};
      COLUMNAS_VENTAS.forEach(function (c, i) { o[c] = f[i]; });
      o.fecha = new Date(o.fecha).toISOString();
      o.cantidad = Number(o.cantidad) || 0;
      o.total = Number(o.total) || 0;
      return o;
    });
}


function buscarFila(h, id) {
  if (h.getLastRow() < 2) return 0;
  const ids = h.getRange(2, 1, h.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return 0;
}


function subirFoto(id, base64) {
  const partes = base64.split(',');
  const tipo = (partes[0].match(/data:(.*?);/) || [null, 'image/jpeg'])[1];
  const blob = Utilities.newBlob(Utilities.base64Decode(partes[1]), tipo, id + '.jpg');

  const carpeta = carpetaFotos();
  const viejos = carpeta.getFilesByName(id + '.jpg');
  while (viejos.hasNext()) viejos.next().setTrashed(true);

  const archivo = carpeta.createFile(blob);
  archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w600';
}


function guardarFigura(f) {
  const h = hoja(HOJA_FIGURAS);
  const borrarFoto = !!f.quitarFoto;

  if (f.fotoBase64) {
    f.foto = subirFoto(f.id, f.fotoBase64);
  } else if (borrarFoto) {
    f.foto = '';
    const carpeta = carpetaFotos();
    const viejos = carpeta.getFilesByName(f.id + '.jpg');
    while (viejos.hasNext()) viejos.next().setTrashed(true);
  }
  delete f.fotoBase64;
  delete f.quitarFoto;

  f.actualizado = new Date().toISOString();
  const fila = COLUMNAS.map(function (c) { return f[c] !== undefined ? f[c] : ''; });

  const n = buscarFila(h, f.id);
  if (n) {
    const previo = h.getRange(n, 1, 1, COLUMNAS.length).getValues()[0];
    if (!f.foto && !borrarFoto) fila[COLUMNAS.indexOf('foto')] = previo[COLUMNAS.indexOf('foto')];
    h.getRange(n, 1, 1, COLUMNAS.length).setValues([fila]);
  } else {
    h.appendRow(fila);
  }
  return { figura: f };
}


function eliminarFigura(id) {
  const h = hoja(HOJA_FIGURAS);
  const n = buscarFila(h, id);
  if (n) h.deleteRow(n);

  const carpeta = carpetaFotos();
  const viejos = carpeta.getFilesByName(id + '.jpg');
  while (viejos.hasNext()) viejos.next().setTrashed(true);

  return { eliminado: !!n };
}


function registrarVenta(v) {
  const hf = hoja(HOJA_FIGURAS);
  const n = buscarFila(hf, v.id);
  if (!n) throw new Error('Esa figura ya no existe en la hoja');

  const colExi = COLUMNAS.indexOf('existencia') + 1;
  const actual = Number(hf.getRange(n, colExi).getValue()) || 0;
  const cantidad = Number(v.cantidad) || 0;
  hf.getRange(n, colExi).setValue(Math.max(0, actual - cantidad));
  hf.getRange(n, COLUMNAS.indexOf('actualizado') + 1).setValue(new Date().toISOString());

  const precio = Number(v.precio) || 0;
  hoja(HOJA_VENTAS).appendRow([
    new Date(), v.id, v.codigo || '', v.nombre || '',
    cantidad, precio, cantidad * precio, v.cliente || '', v.nota || ''
  ]);

  return { existencia: Math.max(0, actual - cantidad) };
}


function importar(figuras) {
  var guardadas = 0;
  figuras.forEach(function (f) { guardarFigura(f); guardadas++; });
  return { guardadas: guardadas };
}
