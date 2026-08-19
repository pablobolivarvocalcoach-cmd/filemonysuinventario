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
  // No usamos getUi().alert: el diálogo aparece en la pestaña de la hoja y
  // deja la ejecución colgada esperando un clic que el usuario no ve.
  Logger.log('Listo. Las hojas FIGURAS y VENTAS están preparadas.');
}


function carpetaFotos() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}


/* ══════════════════════════════════════════════════════════════
   CARGA MASIVA DESDE UNA CARPETA DE DRIVE

   Suba su carpeta de fotos a Drive tal como la tiene en el computador,
   escriba aquí abajo su nombre exacto, y ejecute importarDesdeCarpeta()
   una sola vez desde el editor.

   Lee el nombre de cada archivo ("ABEJA MIEL FLOR NIÑA.jpg") y crea la
   figura con nombre, categoría, palabras de búsqueda y foto ya puestas.
   Ejecutarlo dos veces no duplica: salta las que ya estén en la hoja.
   ══════════════════════════════════════════════════════════════ */

const CARPETA_ORIGEN = 'FILEMON MOLDES';

const VACIAS_GS = ['y','o','de','del','la','el','los','las','un','una','con','en','para','al','a','e'];

const CATEGORIAS_GS = [
  ['Animales', ['abeja','ardilla','conejo','gato','leon','dinosaurio','girafa','jirafa','flamingo','tucan',
                'pelicano','oso','mariposa','pollito','perro','vaca','elefante','buho','pez','tortuga','caballo',
                'oveja','pato','rana','koala','panda','zorro','ciervo','erizo','cerdo','raton','unicornio','dragon','sirena']],
  ['Flores y hojas', ['flor','girasol','rosa','hoja','margarita','tulipan','hongo','planta','cactus']],
  ['Transporte', ['carro','moto','bus','helicoptero','avion','tren','barco','camion','bicicleta','tractor']],
  ['Espacio y cielo', ['astronauta','estrella','luna','cohete','planeta','nube','sol','arcoiris']],
  ['Comida', ['dona','miel','fruta','helado','torta','cupcake','pastel','galleta','pizza','taza','cafe']],
  ['Corazones y amor', ['corazon','amor','beso','labio']],
  ['Casas', ['casita','casa','castillo','iglesia']],
  ['Letras y números', ['letra','numero','abecedario','inicial']],
  ['Bebé', ['bebe','biberon','chupo','sonajero','patuco']],
  ['Fechas especiales', ['navidad','halloween','calabaza','arbol','pascua','huevo']],
];

function limpiarGS(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function variantesGS(p) {
  const v = {};
  v[p] = 1;
  if (p.length > 4 && p.slice(-2) === 'es') v[p.slice(0, -2)] = 1;
  else if (p.length > 3 && p.slice(-1) === 's') v[p.slice(0, -1)] = 1;
  else v[p + (/[aeiou]$/.test(p) ? 's' : 'es')] = 1;

  Object.keys(v).forEach(function (b) {
    const m = b.match(/^(.+)(it[ao])s?$/);
    if (m && m[1].length > 2) v[m[1] + (m[2] === 'ita' ? 'a' : 'o')] = 1;
    else if (/[ao]$/.test(b) && b.length > 3) {
      const r = b.slice(0, -1);
      v[(r.slice(-1) === 'i' ? r.slice(0, -1) : r) + (b.slice(-1) === 'a' ? 'ita' : 'ito')] = 1;
    }
  });
  return Object.keys(v);
}

function analizarNombreGS(nombreArchivo) {
  const base = nombreArchivo.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const publico = {}, resto = [];

  base.split(/[\/,]|\s+/).filter(String).forEach(function (t) {
    const n = limpiarGS(t).replace(/[^a-z0-9]/g, '');
    if (!n) return;
    if (/^nin[ao]s?$/.test(n)) publico[n.charAt(3) === 'a' ? 'niña' : 'niño'] = 1;
    else resto.push({ crudo: t, norm: n });
  });

  const claves = {};
  resto.forEach(function (x) {
    if (VACIAS_GS.indexOf(x.norm) === -1) variantesGS(x.norm).forEach(function (v) { claves[v] = 1; });
  });
  Object.keys(publico).forEach(function (p) { claves[p] = 1; claves[limpiarGS(p)] = 1; });

  const normas = resto.map(function (x) { return x.norm; });
  let categoria = 'Sin clasificar', max = 0;
  CATEGORIAS_GS.forEach(function (par) {
    const n = normas.filter(function (p) {
      return par[1].some(function (c) { return p === c || p === c + 's' || p === c + 'es'; });
    }).length;
    if (n > max) { max = n; categoria = par[0]; }
  });

  return {
    nombre: resto.map(function (x) {
      return x.crudo.charAt(0).toUpperCase() + x.crudo.slice(1).toLowerCase();
    }).join(' ') || base,
    categoria: categoria,
    claves: Object.keys(claves).join(', '),
    publico: Object.keys(publico).join(' y '),
  };
}

function codigoGS(nombre, usados) {
  const raiz = (limpiarGS(nombre).replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase()) || 'FIG';
  let i = 1, c;
  do { c = raiz + '-' + ('0' + i).slice(-2); i++; } while (usados[c]);
  usados[c] = 1;
  return c;
}


function importarDesdeCarpeta() {
  const it = DriveApp.getFoldersByName(CARPETA_ORIGEN);
  if (!it.hasNext()) {
    throw new Error('No encontré en Drive una carpeta llamada "' + CARPETA_ORIGEN +
                    '". Revise el nombre exacto en la constante CARPETA_ORIGEN.');
  }
  const carpeta = it.next();
  const h = hoja(HOJA_FIGURAS);

  const existentes = {}, usados = {};
  if (h.getLastRow() > 1) {
    const previas = h.getRange(2, 1, h.getLastRow() - 1, COLUMNAS.length).getValues();
    previas.forEach(function (f) {
      const nom = limpiarGS(f[COLUMNAS.indexOf('nombre')]).replace(/\s+/g, ' ').trim();
      if (nom) existentes[nom] = 1;
      if (f[COLUMNAS.indexOf('codigo')]) usados[f[COLUMNAS.indexOf('codigo')]] = 1;
    });
  }

  const nuevas = [];
  let saltadas = 0, revisados = 0;
  const ahora = new Date().toISOString();
  const archivos = carpeta.getFiles();

  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (archivo.getMimeType().indexOf('image/') !== 0) continue;
    revisados++;

    const d = analizarNombreGS(archivo.getName());
    const clave = limpiarGS(d.nombre).replace(/\s+/g, ' ').trim();
    if (existentes[clave]) { saltadas++; continue; }
    existentes[clave] = 1;

    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) { /* si ya está compartida o no se puede, seguimos */ }

    const fig = {
      id: 'f' + Date.now() + '-' + nuevas.length,
      codigo: codigoGS(d.nombre, usados),
      nombre: d.nombre,
      categoria: d.categoria,
      claves: d.claves,
      medidas: '',
      existencia: 0,
      minimo: 3,
      precio: 0,
      dias: 2,
      molde: 'bueno',
      ubicacion: '',
      notas: d.publico ? 'Para ' + d.publico : '',
      foto: 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w600',
      actualizado: ahora,
    };
    nuevas.push(COLUMNAS.map(function (c) { return fig[c]; }));
  }

  if (nuevas.length) {
    h.getRange(h.getLastRow() + 1, 1, nuevas.length, COLUMNAS.length).setValues(nuevas);
  }

  const resumen = revisados + ' imágenes revisadas.\n' +
                  nuevas.length + ' figuras nuevas agregadas.\n' +
                  saltadas + ' saltadas porque ya estaban.\n\n' +
                  'Abra la app y toque el punto de arriba para sincronizar.';
  Logger.log(resumen);
  return resumen;
}


/* ══════════════════════════════════════════════════════════════
   REPORTE MENSUAL Y DE TEMPORADA

   Ejecute generarReporte() desde el editor cuando quiera actualizarlo.
   Arma la pestaña REPORTE. Para tenerlo como archivo:
     Archivo → Descargar → Microsoft Excel  (o Documento PDF)
   ══════════════════════════════════════════════════════════════ */

const HOJA_REPORTE = 'REPORTE';
const MESES_LARGO_GS = ['enero','febrero','marzo','abril','mayo','junio','julio',
                        'agosto','septiembre','octubre','noviembre','diciembre'];

function generarReporte() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const figuras = leerFiguras();
  const ventas = leerVentas();

  let r = libro.getSheetByName(HOJA_REPORTE);
  if (!r) r = libro.insertSheet(HOJA_REPORTE);
  r.clear();

  const hoy = new Date();
  const filas = [];
  const titulos = [];   // filas que van en negrita
  const monedas = [];   // filas cuya columna C es dinero

  const seccion = function (t) {
    filas.push(['', '', '', '']);
    titulos.push(filas.length + 1);
    filas.push([t, '', '', '']);
  };

  filas.push(['FILEMÓN · Reporte de inventario y ventas', '', '', '']);
  titulos.push(1);
  filas.push(['Generado el ' + hoy.getDate() + ' de ' + MESES_LARGO_GS[hoy.getMonth()] +
              ' de ' + hoy.getFullYear(), '', '', '']);

  /* ── resumen ── */
  const listas = figuras.filter(function (f) {
    return f.molde === 'bueno' && Number(f.existencia) > 0;
  });
  const piezas = listas.reduce(function (s, f) { return s + Number(f.existencia); }, 0);
  const valor = listas.reduce(function (s, f) { return s + Number(f.existencia) * Number(f.precio); }, 0);

  seccion('RESUMEN');
  filas.push(['Figuras registradas', figuras.length, '', '']);
  filas.push(['Piezas listas en bodega', piezas, '', '']);
  filas.push(['Valor de lo que está listo', valor, '', '']);
  monedas.push(filas.length + 1);
  filas.push(['Moldes dañados', figuras.filter(function (f) { return f.molde === 'danado'; }).length, '', '']);
  filas.push(['Ventas registradas', ventas.length, '', '']);

  /* ── mes a mes ── */
  seccion('VENTAS MES A MES');
  titulos.push(filas.length + 2);
  filas.push(['Mes', 'Unidades', 'Ingresos', '']);

  const porMes = {};
  ventas.forEach(function (v) {
    const d = new Date(v.fecha);
    const k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    if (!porMes[k]) porMes[k] = { u: 0, i: 0 };
    porMes[k].u += Number(v.cantidad) || 0;
    porMes[k].i += Number(v.total) || 0;
  });
  const claves = Object.keys(porMes).sort();
  if (!claves.length) filas.push(['Sin ventas registradas todavía', '', '', '']);
  claves.forEach(function (k) {
    filas.push([k, porMes[k].u, porMes[k].i, '']);
    monedas.push(filas.length + 1);
  });

  /* ── temporada ── */
  seccion('MESES FUERTES (TEMPORADA)');
  titulos.push(filas.length + 2);
  filas.push(['Mes del año', 'Unidades', 'Ingresos', 'Años con datos']);

  const porEstacion = MESES_LARGO_GS.map(function () { return { u: 0, i: 0, años: {} }; });
  ventas.forEach(function (v) {
    const d = new Date(v.fecha);
    const e = porEstacion[d.getMonth()];
    e.u += Number(v.cantidad) || 0;
    e.i += Number(v.total) || 0;
    e.años[d.getFullYear()] = 1;
  });
  const conDatos = porEstacion
    .map(function (e, i) { return { mes: MESES_LARGO_GS[i], u: e.u, i: e.i, n: Object.keys(e.años).length }; })
    .filter(function (e) { return e.u > 0; })
    .sort(function (a, b) { return b.u - a.u; });

  if (!conDatos.length) {
    filas.push(['Se necesita al menos un año de ventas para hablar de temporada', '', '', '']);
  } else {
    conDatos.forEach(function (e) {
      filas.push([e.mes, e.u, e.i, e.n]);
      monedas.push(filas.length + 1);
    });
    const variosAños = conDatos.some(function (e) { return e.n > 1; });
    filas.push([variosAños
      ? 'Con más de un año de datos, esta tabla ya indica temporada.'
      : 'Menos de un año de historia: muestra lo vendido, no una temporada confirmada.', '', '', '']);
  }

  /* ── más vendidas ── */
  seccion('FIGURAS MÁS VENDIDAS');
  titulos.push(filas.length + 2);
  filas.push(['Figura', 'Código', 'Unidades', 'Ingresos']);

  const porFigura = {};
  ventas.forEach(function (v) {
    const k = String(v.id);
    if (!porFigura[k]) porFigura[k] = { nombre: v.nombre, codigo: v.codigo, u: 0, i: 0 };
    porFigura[k].u += Number(v.cantidad) || 0;
    porFigura[k].i += Number(v.total) || 0;
  });
  const ranking = Object.keys(porFigura).map(function (k) { return porFigura[k]; })
    .sort(function (a, b) { return b.u - a.u; }).slice(0, 25);
  if (!ranking.length) filas.push(['Sin ventas registradas todavía', '', '', '']);
  ranking.forEach(function (t) {
    filas.push([t.nombre, t.codigo, t.u, t.i]);
  });

  /* ── por reponer ── */
  seccion('POR REPONER');
  titulos.push(filas.length + 2);
  filas.push(['Figura', 'En bodega', 'Avisar en', 'Días de producción']);

  const bajas = figuras.filter(function (f) {
    const min = (f.minimo === 0 || Number(f.minimo)) ? Number(f.minimo) : 3;
    return f.molde === 'bueno' && Number(f.existencia) > 0 && Number(f.existencia) <= min;
  });
  if (!bajas.length) filas.push(['Nada por reponer', '', '', '']);
  bajas.forEach(function (f) {
    filas.push([f.nombre, Number(f.existencia), Number(f.minimo), Number(f.dias)]);
  });

  /* ── volcado y formato ── */
  r.getRange(1, 1, filas.length, 4).setValues(filas);
  r.getRange(1, 1, 1, 4).setFontSize(14);
  titulos.forEach(function (n) {
    r.getRange(n, 1, 1, 4).setFontWeight('bold').setBackground('#EDEDE7');
  });
  monedas.forEach(function (n) {
    r.getRange(n, 3).setNumberFormat('$#,##0');
  });
  r.getRange(6, 2).setNumberFormat('$#,##0');   // valor del inventario
  r.setColumnWidth(1, 320);
  r.setColumnWidths(2, 3, 130);
  r.setFrozenRows(1);

  const resumen = 'Reporte actualizado en la pestaña ' + HOJA_REPORTE + '.\n\n' +
                  'Para guardarlo como archivo:\n' +
                  'Archivo → Descargar → Microsoft Excel (.xlsx) o Documento PDF (.pdf)';
  Logger.log(resumen);
  return resumen;
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
