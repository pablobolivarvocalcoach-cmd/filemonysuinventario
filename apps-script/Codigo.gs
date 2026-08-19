/**
 * FILEMÓN — Puente entre la app de inventario y Google Sheets.
 *
 * Este archivo va DENTRO de su hoja de cálculo (Extensiones > Apps Script).
 *
 * MODELO
 *   MOLDE     la plancha física: foto, caja, estado, días de producción.
 *   PIEZA     cada figura que sale de esa plancha. Aquí vive el inventario.
 *   PRODUCTO  lo que se cobra (Kit de 3 piezas, Kit de letras). Aquí vive el precio.
 *   VENTA     une los tres: un producto, las piezas que salieron, el total.
 */

// ─────────────────────────────────────────────────────────────
// CAMBIE ESTA CLAVE POR UNA SUYA ANTES DE PUBLICAR
// Debe ser exactamente la misma que escriba en la app.
// ─────────────────────────────────────────────────────────────
const CLAVE = 'CAMBIE-ESTA-CLAVE';

const HOJA_MOLDES    = 'MOLDES';
const HOJA_PIEZAS    = 'PIEZAS';
const HOJA_PRODUCTOS = 'PRODUCTOS';
const HOJA_VENTAS    = 'VENTAS';
const HOJA_REPORTE   = 'REPORTE';

const CARPETA        = 'Filemon - Fotos';   // fotos tomadas desde el celular
const CARPETA_ORIGEN = 'FILEMON MOLDES';    // sus fotos originales del taller

const COL_MOLDES = ['id','codigo','nombre','categoria','claves','medidas','cavidades',
                    'dias','estado','ubicacion','notas','foto','giro','actualizado'];

const COL_PIEZAS = ['id','idMolde','numero','nombre','claves','existencia','minimo','actualizado'];

const COL_PRODUCTOS = ['id','nombre','precio','piezas','notas','actualizado'];

const COL_VENTAS = ['fecha','idProducto','producto','precio','total','detalle','cliente','nota'];

const PRODUCTOS_INICIALES = [
  ['Kit de 3 piezas', 12000, 3, 'El cliente escoge las tres piezas'],
  ['Kit de letras con el nombre', 15000, 0, 'La cantidad de letras depende del nombre'],
];


/* ══════════════════════════════════════════════════════════════
   PREPARACIÓN
   ══════════════════════════════════════════════════════════════ */

function prepararHoja() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();

  crearHoja(libro, HOJA_MOLDES,    COL_MOLDES,    '#2B3439');
  crearHoja(libro, HOJA_PIEZAS,    COL_PIEZAS,    '#1F5F6B');
  crearHoja(libro, HOJA_PRODUCTOS, COL_PRODUCTOS, '#A2620A');
  crearHoja(libro, HOJA_VENTAS,    COL_VENTAS,    '#146B52');

  const hp = libro.getSheetByName(HOJA_PRODUCTOS);
  if (hp.getLastRow() < 2) {
    const ahora = new Date().toISOString();
    const filas = PRODUCTOS_INICIALES.map(function (p, i) {
      return ['p' + Date.now() + '-' + i, p[0], p[1], p[2], p[3], ahora];
    });
    hp.getRange(2, 1, filas.length, COL_PRODUCTOS.length).setValues(filas);
    hp.getRange(2, 3, filas.length, 1).setNumberFormat('$#,##0');
  }

  carpetaFotos();
  Logger.log('Listo. Hojas MOLDES, PIEZAS, PRODUCTOS y VENTAS preparadas.');
}


function crearHoja(libro, nombre, columnas, color) {
  let h = libro.getSheetByName(nombre);
  if (!h) h = libro.insertSheet(nombre);
  // Siempre se reescriben: así una columna nueva queda con su título.
  h.getRange(1, 1, 1, columnas.length).setValues([columnas])
    .setFontWeight('bold').setBackground(color).setFontColor('#FFFFFF');
  h.setFrozenRows(1);
  return h;
}


function hoja(nombre) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h) throw new Error('Falta la hoja ' + nombre + '. Ejecute prepararHoja() una vez.');
  return h;
}


function carpetaFotos() {
  const it = DriveApp.getFoldersByName(CARPETA);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA);
}


/* ══════════════════════════════════════════════════════════════
   LECTURA Y ESCRITURA GENÉRICAS
   ══════════════════════════════════════════════════════════════ */

function leerTabla(nombreHoja, columnas, numericas) {
  const h = hoja(nombreHoja);
  if (h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, columnas.length).getValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const o = {};
      columnas.forEach(function (c, i) { o[c] = f[i]; });
      (numericas || []).forEach(function (k) { o[k] = Number(o[k]) || 0; });
      if (o.actualizado) o.actualizado = new Date(o.actualizado).toISOString();
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

function guardarEn(nombreHoja, columnas, obj) {
  const h = hoja(nombreHoja);
  obj.actualizado = new Date().toISOString();
  const fila = columnas.map(function (c) { return obj[c] !== undefined ? obj[c] : ''; });
  const n = buscarFila(h, obj.id);
  if (n) h.getRange(n, 1, 1, columnas.length).setValues([fila]);
  else h.appendRow(fila);
  return obj;
}

function eliminarEn(nombreHoja, id) {
  const h = hoja(nombreHoja);
  const n = buscarFila(h, id);
  if (n) h.deleteRow(n);
  return !!n;
}

function leerMoldes()    { return leerTabla(HOJA_MOLDES, COL_MOLDES, ['cavidades','dias','giro']); }
function leerPiezas()    { return leerTabla(HOJA_PIEZAS, COL_PIEZAS, ['numero','existencia','minimo']); }
function leerProductos() { return leerTabla(HOJA_PRODUCTOS, COL_PRODUCTOS, ['precio','piezas']); }

function leerVentas() {
  const h = hoja(HOJA_VENTAS);
  if (h.getLastRow() < 2) return [];
  const desde = Math.max(2, h.getLastRow() - 999);
  return h.getRange(desde, 1, h.getLastRow() - desde + 1, COL_VENTAS.length).getValues()
    .filter(function (f) { return f[0]; })
    .map(function (f) {
      const o = {};
      COL_VENTAS.forEach(function (c, i) { o[c] = f[i]; });
      o.fecha = new Date(o.fecha).toISOString();
      o.precio = Number(o.precio) || 0;
      o.total = Number(o.total) || 0;
      return o;
    });
}


/* ══════════════════════════════════════════════════════════════
   FOTOS Y MOLDES
   ══════════════════════════════════════════════════════════════ */

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


function guardarMolde(m) {
  const borrarFoto = !!m.quitarFoto;

  if (m.fotoBase64) {
    m.foto = subirFoto(m.id, m.fotoBase64);
  } else if (borrarFoto) {
    m.foto = '';
    const carpeta = carpetaFotos();
    const viejos = carpeta.getFilesByName(m.id + '.jpg');
    while (viejos.hasNext()) viejos.next().setTrashed(true);
  }
  delete m.fotoBase64;
  delete m.quitarFoto;

  // Sin foto nueva y sin borrado explícito, se conserva la que ya estaba.
  if (!m.foto && !borrarFoto) {
    const h = hoja(HOJA_MOLDES);
    const n = buscarFila(h, m.id);
    if (n) m.foto = h.getRange(n, COL_MOLDES.indexOf('foto') + 1).getValue();
  }

  return { molde: guardarEn(HOJA_MOLDES, COL_MOLDES, m) };
}


function eliminarMolde(id) {
  const eliminado = eliminarEn(HOJA_MOLDES, id);

  // Las piezas de ese molde se van con él: una pieza huérfana no significa nada.
  const h = hoja(HOJA_PIEZAS);
  if (h.getLastRow() > 1) {
    const col = COL_PIEZAS.indexOf('idMolde') + 1;
    const vals = h.getRange(2, col, h.getLastRow() - 1, 1).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (String(vals[i][0]) === String(id)) h.deleteRow(i + 2);
    }
  }

  const carpeta = carpetaFotos();
  const viejos = carpeta.getFilesByName(id + '.jpg');
  while (viejos.hasNext()) viejos.next().setTrashed(true);

  return { eliminado: eliminado };
}


/* ══════════════════════════════════════════════════════════════
   VENTAS
   ══════════════════════════════════════════════════════════════ */

function registrarVenta(v) {
  const h = hoja(HOJA_PIEZAS);
  const colExi = COL_PIEZAS.indexOf('existencia') + 1;
  const detalle = [];

  (v.piezas || []).forEach(function (p) {
    const n = buscarFila(h, p.id);
    if (!n) return;
    const actual = Number(h.getRange(n, colExi).getValue()) || 0;
    const cantidad = Number(p.cantidad) || 0;
    h.getRange(n, colExi).setValue(Math.max(0, actual - cantidad));
    h.getRange(n, COL_PIEZAS.indexOf('actualizado') + 1).setValue(new Date().toISOString());
    detalle.push(p.nombre + ' x' + cantidad);
  });

  const precio = Number(v.precio) || 0;
  const total = Number(v.total) || precio;

  hoja(HOJA_VENTAS).appendRow([
    new Date(), v.idProducto || '', v.producto || '', precio, total,
    detalle.join(' · '), v.cliente || '', v.nota || '',
  ]);

  return { registrada: true };
}


/* ══════════════════════════════════════════════════════════════
   IMPORTAR DESDE UNA CARPETA DE DRIVE

   Suba su carpeta de fotos a Drive con los nombres descriptivos
   ("ABEJA MIEL FLOR NIÑA.jpg") y ejecute importarDesdeCarpeta().
   Cada palabra del nombre se vuelve una pieza numerada.
   ══════════════════════════════════════════════════════════════ */

const VACIAS_GS = ['y','o','de','del','la','el','los','las','un','una','con','en','para','al','a','e'];

const CATEGORIAS_GS = [
  ['Animales', ['abeja','ardilla','conejo','gato','leon','dinosaurio','girafa','jirafa','flamingo','tucan',
                'pelicano','oso','mariposa','pollito','perro','vaca','elefante','buho','pez','tortuga','caballo',
                'oveja','pato','rana','koala','panda','zorro','ciervo','erizo','cerdo','raton','unicornio','dragon',
                'sirena','zebra','hipopotamo','cocodrilo','papagayo','ave']],
  ['Flores y hojas', ['flor','girasol','rosa','hoja','margarita','tulipan','hongo','planta','cactus','nuez']],
  ['Transporte', ['carro','moto','bus','helicoptero','avion','tren','barco','camion','bicicleta','tractor']],
  ['Espacio y cielo', ['astronauta','estrella','luna','cohete','planeta','nube','sol','arcoiris']],
  ['Comida', ['dona','miel','fruta','helado','torta','cupcake','pastel','galleta','pizza','taza','cafe']],
  ['Corazones y amor', ['corazon','amor','beso','labio']],
  ['Casas', ['casita','casa','castillo','iglesia']],
  ['Letras y números', ['letra','numero','abecedario','inicial']],
  ['Bebé', ['bebe','biberon','chupo','sonajero','patuco']],
  ['Fechas especiales', ['navidad','halloween','calabaza','arbol','pascua','huevo']],
];

const TAMANOS_GS = ['grande','grandes','pequeno','pequenos','pequena','pequenas',
                    'mediano','medianos','mediana','medianas','mini'];

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

function clavesDeGS(texto) {
  const claves = {};
  String(texto || '').split(/\s+/).forEach(function (t) {
    const n = limpiarGS(t).replace(/[^a-z0-9]/g, '');
    if (n && VACIAS_GS.indexOf(n) === -1) {
      variantesGS(n).forEach(function (v) { claves[v] = 1; });
    }
  });
  return Object.keys(claves).join(', ');
}

/**
 * Interpreta "ABEJA MIEL FLOR NIÑA.jpg".
 * Devuelve el nombre del molde, su categoría, el público y las piezas sueltas.
 */
function analizarNombreGS(nombreArchivo) {
  const base = nombreArchivo.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const publico = {}, resto = [];

  base.split(/[\/,:]|\s+/).filter(String).forEach(function (t) {
    const n = limpiarGS(t).replace(/[^a-z0-9]/g, '');
    if (!n) return;
    if (/^nin[ao]s?$/.test(n)) publico[n.charAt(3) === 'a' ? 'niña' : 'niño'] = 1;
    else resto.push({ crudo: t, norm: n });
  });

  const titulo = function (s) { return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };

  // "Conejo grande y pequeño" son DOS piezas, no una: el tamaño que llega
  // cuando la pieza anterior ya tiene tamaño abre una pieza nueva.
  const piezas = [];
  let nucleo = '', conTamano = false;
  resto.forEach(function (x) {
    if (VACIAS_GS.indexOf(x.norm) !== -1) return;
    if (TAMANOS_GS.indexOf(x.norm) !== -1) {
      if (!piezas.length) { piezas.push(titulo(x.crudo)); nucleo = titulo(x.crudo); conTamano = true; return; }
      if (conTamano) piezas.push(nucleo + ' ' + titulo(x.crudo));
      else { piezas[piezas.length - 1] += ' ' + titulo(x.crudo); conTamano = true; }
      return;
    }
    piezas.push(titulo(x.crudo));
    nucleo = titulo(x.crudo);
    conTamano = false;
  });

  // "Animales", "Frutas": encabezan la lista pero no son una pieza. Se
  // descartan solo si quedan al menos dos piezas de verdad.
  const COLECTIVAS = ['animales','frutas','flores','letras','numeros','figuras','surtidos'];
  if (piezas.length > 2 && COLECTIVAS.indexOf(limpiarGS(piezas[0])) !== -1) piezas.shift();

  const normas = resto.map(function (x) { return x.norm; });
  const claves = {};
  normas.forEach(function (n) {
    if (VACIAS_GS.indexOf(n) === -1) variantesGS(n).forEach(function (v) { claves[v] = 1; });
  });
  Object.keys(publico).forEach(function (p) { claves[p] = 1; claves[limpiarGS(p)] = 1; });

  let categoria = 'Sin clasificar', max = 0;
  CATEGORIAS_GS.forEach(function (par) {
    const n = normas.filter(function (p) {
      return par[1].some(function (c) { return p === c || p === c + 's' || p === c + 'es'; });
    }).length;
    if (n > max) { max = n; categoria = par[0]; }
  });

  return {
    nombre: piezas.join(' ') || base,
    categoria: categoria,
    claves: Object.keys(claves).join(', '),
    publico: Object.keys(publico).join(' y '),
    piezas: piezas,
  };
}

/**
 * El código es un número corrido, a propósito.
 * Uno derivado del nombre envejece mal (si renombra el molde deja de
 * corresponder) y choca entre moldes parecidos. Este nunca cambia.
 */
function siguienteNumero(codigos) {
  let max = 0;
  Object.keys(codigos).forEach(function (c) {
    const m = String(c).match(/^M-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}

function codigoGS(n) {
  return 'M-' + (n < 1000 ? ('00' + n).slice(-3) : n);
}


/**
 * Reasigna los códigos como M-001, M-002… en el orden actual de la hoja.
 * Úselo una sola vez si viene de la numeración vieja.
 */
function renumerarMoldes() {
  const h = hoja(HOJA_MOLDES);
  if (h.getLastRow() < 2) { Logger.log('No hay moldes que renumerar.'); return; }
  const col = COL_MOLDES.indexOf('codigo') + 1;
  const n = h.getLastRow() - 1;
  const nuevos = [];
  for (var i = 0; i < n; i++) nuevos.push([codigoGS(i + 1)]);
  h.getRange(2, col, n, 1).setValues(nuevos);
  const resumen = n + ' moldes renumerados: de M-001 a ' + codigoGS(n) +
                  '.\n\nAbra la app y sincronice.';
  Logger.log(resumen);
  return resumen;
}


function importarDesdeCarpeta() {
  const it = DriveApp.getFoldersByName(CARPETA_ORIGEN);
  if (!it.hasNext()) {
    throw new Error('No encontré en Drive una carpeta llamada "' + CARPETA_ORIGEN +
                    '". Revise el nombre exacto en la constante CARPETA_ORIGEN.');
  }
  const carpeta = it.next();
  const hm = hoja(HOJA_MOLDES);
  const hp = hoja(HOJA_PIEZAS);

  const existentes = {}, usados = {};
  leerMoldes().forEach(function (m) {
    const nom = limpiarGS(m.nombre).replace(/\s+/g, ' ').trim();
    if (nom) existentes[nom] = 1;
    if (m.codigo) usados[m.codigo] = 1;
  });
  var proximo = siguienteNumero(usados);

  const nuevosMoldes = [], nuevasPiezas = [];
  let saltados = 0, revisados = 0;
  const ahora = new Date().toISOString();
  const archivos = carpeta.getFiles();

  while (archivos.hasNext()) {
    const archivo = archivos.next();
    if (archivo.getMimeType().indexOf('image/') !== 0) continue;
    revisados++;

    const d = analizarNombreGS(archivo.getName());
    const clave = limpiarGS(d.nombre).replace(/\s+/g, ' ').trim();
    if (existentes[clave]) { saltados++; continue; }
    existentes[clave] = 1;

    try {
      archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) { /* si ya está compartida o no se puede, seguimos */ }

    const idMolde = 'm' + Date.now() + '-' + nuevosMoldes.length;
    const molde = {
      id: idMolde,
      codigo: codigoGS(proximo++),
      nombre: d.nombre,
      categoria: d.categoria,
      claves: d.claves,
      medidas: '',
      cavidades: d.piezas.length,   // provisional: lo confirma quien mire la foto
      dias: 2,
      estado: 'bueno',
      ubicacion: '',
      notas: d.publico ? 'Para ' + d.publico : '',
      foto: 'https://drive.google.com/thumbnail?id=' + archivo.getId() + '&sz=w600',
      giro: 0,
      actualizado: ahora,
    };
    nuevosMoldes.push(COL_MOLDES.map(function (c) { return molde[c]; }));

    d.piezas.forEach(function (nombrePieza, i) {
      const pieza = {
        id: 'z' + Date.now() + '-' + nuevasPiezas.length,
        idMolde: idMolde,
        numero: i + 1,
        nombre: nombrePieza,
        claves: clavesDeGS(nombrePieza),
        existencia: 0,
        minimo: 3,
        actualizado: ahora,
      };
      nuevasPiezas.push(COL_PIEZAS.map(function (c) { return pieza[c]; }));
    });
  }

  if (nuevosMoldes.length) {
    hm.getRange(hm.getLastRow() + 1, 1, nuevosMoldes.length, COL_MOLDES.length).setValues(nuevosMoldes);
  }
  if (nuevasPiezas.length) {
    hp.getRange(hp.getLastRow() + 1, 1, nuevasPiezas.length, COL_PIEZAS.length).setValues(nuevasPiezas);
  }

  const resumen = revisados + ' imágenes revisadas.\n' +
                  nuevosMoldes.length + ' moldes nuevos.\n' +
                  nuevasPiezas.length + ' piezas creadas.\n' +
                  saltados + ' saltados porque ya estaban.\n\n' +
                  'Revise en la app que el número de cada pieza coincida con la foto.';
  Logger.log(resumen);
  return resumen;
}


/* ══════════════════════════════════════════════════════════════
   REPORTE
   ══════════════════════════════════════════════════════════════ */

const MESES_LARGO_GS = ['enero','febrero','marzo','abril','mayo','junio','julio',
                        'agosto','septiembre','octubre','noviembre','diciembre'];

function generarReporte() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const moldes = leerMoldes();
  const piezas = leerPiezas();
  const ventas = leerVentas();

  let r = libro.getSheetByName(HOJA_REPORTE);
  if (!r) r = libro.insertSheet(HOJA_REPORTE);
  r.clear();

  const hoy = new Date();
  const filas = [], titulos = [], monedas = [];

  const seccion = function (t) {
    filas.push(['', '', '', '']);
    titulos.push(filas.length + 1);
    filas.push([t, '', '', '']);
  };

  filas.push(['FILEMÓN · Reporte de inventario y ventas', '', '', '']);
  titulos.push(1);
  filas.push(['Generado el ' + hoy.getDate() + ' de ' + MESES_LARGO_GS[hoy.getMonth()] +
              ' de ' + hoy.getFullYear(), '', '', '']);

  const porMolde = {};
  moldes.forEach(function (m) { porMolde[m.id] = m; });
  const cuentaPiezas = {};
  piezas.forEach(function (p) { cuentaPiezas[p.idMolde] = (cuentaPiezas[p.idMolde] || 0) + 1; });

  const utiles = piezas.filter(function (p) {
    const m = porMolde[p.idMolde];
    return m && m.estado === 'bueno';
  });
  const enBodega = utiles.reduce(function (s, p) { return s + Number(p.existencia); }, 0);
  const sinNombre = piezas.filter(function (p) { return !String(p.nombre || '').trim(); }).length;
  const incompletos = moldes.filter(function (m) {
    return Number(m.cavidades) > (cuentaPiezas[m.id] || 0);
  });

  seccion('RESUMEN');
  filas.push(['Moldes registrados', moldes.length, '', '']);
  filas.push(['Piezas distintas', piezas.length, '', '']);
  filas.push(['Piezas en bodega', enBodega, '', '']);
  filas.push(['Piezas sin nombre', sinNombre, '', '']);
  filas.push(['Moldes con piezas por registrar', incompletos.length, '', '']);
  filas.push(['Moldes dañados', moldes.filter(function (m) { return m.estado === 'danado'; }).length, '', '']);
  filas.push(['Ventas registradas', ventas.length, '', '']);

  seccion('VENTAS MES A MES');
  titulos.push(filas.length + 2);
  filas.push(['Mes', 'Ventas', 'Ingresos', '']);

  const porMes = {};
  ventas.forEach(function (v) {
    const d = new Date(v.fecha);
    const k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
    if (!porMes[k]) porMes[k] = { n: 0, i: 0 };
    porMes[k].n++;
    porMes[k].i += Number(v.total) || 0;
  });
  const claves = Object.keys(porMes).sort();
  if (!claves.length) filas.push(['Sin ventas registradas todavía', '', '', '']);
  claves.forEach(function (k) {
    filas.push([k, porMes[k].n, porMes[k].i, '']);
    monedas.push(filas.length + 1);
  });

  seccion('MESES FUERTES (TEMPORADA)');
  titulos.push(filas.length + 2);
  filas.push(['Mes del año', 'Ventas', 'Ingresos', 'Años con datos']);

  const est = MESES_LARGO_GS.map(function () { return { n: 0, i: 0, anios: {} }; });
  ventas.forEach(function (v) {
    const d = new Date(v.fecha);
    const e = est[d.getMonth()];
    e.n++;
    e.i += Number(v.total) || 0;
    e.anios[d.getFullYear()] = 1;
  });
  const conDatos = est
    .map(function (e, i) { return { mes: MESES_LARGO_GS[i], n: e.n, i: e.i, a: Object.keys(e.anios).length }; })
    .filter(function (e) { return e.n > 0; })
    .sort(function (a, b) { return b.n - a.n; });

  if (!conDatos.length) {
    filas.push(['Se necesita al menos un año de ventas para hablar de temporada', '', '', '']);
  } else {
    conDatos.forEach(function (e) {
      filas.push([e.mes, e.n, e.i, e.a]);
      monedas.push(filas.length + 1);
    });
    filas.push([conDatos.some(function (e) { return e.a > 1; })
      ? 'Con más de un año de datos, esta tabla ya indica temporada.'
      : 'Menos de un año de historia: muestra lo vendido, no una temporada confirmada.', '', '', '']);
  }

  seccion('PIEZAS POR REPONER');
  titulos.push(filas.length + 2);
  filas.push(['Pieza', 'Molde', 'En bodega', 'Avisar en']);

  const bajas = utiles.filter(function (p) {
    return Number(p.existencia) > 0 && Number(p.existencia) <= Number(p.minimo);
  });
  if (!bajas.length) filas.push(['Nada por reponer', '', '', '']);
  bajas.forEach(function (p) {
    const m = porMolde[p.idMolde] || {};
    filas.push([p.nombre, (m.codigo || '') + ' · pieza ' + p.numero, Number(p.existencia), Number(p.minimo)]);
  });

  seccion('MOLDES CON PIEZAS SIN REGISTRAR');
  titulos.push(filas.length + 2);
  filas.push(['Molde', 'Código', 'Cavidades', 'Piezas registradas']);

  if (!incompletos.length) filas.push(['Todos los moldes tienen sus piezas registradas', '', '', '']);
  incompletos.forEach(function (m) {
    filas.push([m.nombre, m.codigo, Number(m.cavidades), cuentaPiezas[m.id] || 0]);
  });

  r.getRange(1, 1, filas.length, 4).setValues(filas);
  r.getRange(1, 1, 1, 4).setFontSize(14);
  titulos.forEach(function (n) {
    r.getRange(n, 1, 1, 4).setFontWeight('bold').setBackground('#EDEDE7');
  });
  monedas.forEach(function (n) { r.getRange(n, 3).setNumberFormat('$#,##0'); });
  r.setColumnWidth(1, 320);
  r.setColumnWidths(2, 3, 130);
  r.setFrozenRows(1);

  const resumen = 'Reporte actualizado en la pestaña ' + HOJA_REPORTE + '.\n\n' +
                  'Para guardarlo como archivo:\n' +
                  'Archivo → Descargar → Microsoft Excel (.xlsx) o Documento PDF (.pdf)';
  Logger.log(resumen);
  return resumen;
}


/* ══════════════════════════════════════════════════════════════
   PUENTE CON LA APP
   ══════════════════════════════════════════════════════════════ */

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
    salida.setContent(JSON.stringify({ ok: true, datos: despachar(peticion.accion, peticion.datos || {}) }));
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
    case 'leer':
      return {
        moldes: leerMoldes(), piezas: leerPiezas(),
        productos: leerProductos(), ventas: leerVentas(),
      };
    case 'guardarMolde':     return guardarMolde(datos);
    case 'eliminarMolde':    return eliminarMolde(datos.id);
    case 'guardarPieza':     return { pieza: guardarEn(HOJA_PIEZAS, COL_PIEZAS, datos) };
    case 'eliminarPieza':    return { eliminado: eliminarEn(HOJA_PIEZAS, datos.id) };
    case 'guardarProducto':  return { producto: guardarEn(HOJA_PRODUCTOS, COL_PRODUCTOS, datos) };
    case 'eliminarProducto': return { eliminado: eliminarEn(HOJA_PRODUCTOS, datos.id) };
    case 'venta':            return registrarVenta(datos);
    default: throw new Error('Acción desconocida: ' + accion);
  }
}
