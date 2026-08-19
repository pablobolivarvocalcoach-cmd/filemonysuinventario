/* Verificación previa a publicar.  Uso: node verificar.mjs
   Sin dependencias. Sale con código 1 si algo falla. */

import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const gs   = readFileSync('apps-script/Codigo.gs', 'utf8');
const js   = (html.match(/<script>([\s\S]*)<\/script>/) || [, ''])[1];

let fallos = 0, avisos = 0;

const ok    = m => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const falla = m => { console.log(`  \x1b[31m✗\x1b[0m ${m}`); fallos++; };
const aviso = m => { console.log(`  \x1b[33m!\x1b[0m ${m}`); avisos++; };
const grupo = t => console.log(`\n\x1b[1m${t}\x1b[0m`);

/* ─────────────────────────────── 1. sintaxis */
grupo('Sintaxis');
for (const [nombre, fuente] of [['index.html', js], ['Codigo.gs', gs]]) {
  try { new Function(fuente); ok(`${nombre} compila`); }
  catch (e) { falla(`${nombre}: ${e.message}`); }
}

/* ─────────────────────────────── 2. secretos */
grupo('Secretos (el repositorio es público)');

const clave = (gs.match(/const\s+CLAVE\s*=\s*'([^']*)'/) || [])[1];
if (clave === undefined) falla('No se encontró la constante CLAVE en Codigo.gs');
else if (clave !== 'CAMBIE-ESTA-CLAVE')
  falla(`CLAVE tiene un valor real ("${clave}"). Devuélvala al marcador antes de publicar.`);
else ok('CLAVE sigue siendo el marcador');

const urlExec = html.match(/https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]{20,}/);
if (urlExec) falla(`Hay una URL /exec real incrustada en index.html: ${urlExec[0].slice(0, 60)}…`);
else ok('index.html no trae URL de despliegue incrustada');

if (/clave\s*:\s*'(?!')[^']{3,}'/.test(js)) aviso('Revise: parece haber una clave con valor por defecto en el config');
else ok('El config arranca vacío');

/* ─────────────────────────────── 3. la cola */
grupo('Invariante de la cola (regla 2 de CLAUDE.md)');

const directas = [...js.matchAll(/api\(\s*'(guardar|venta|eliminar|importar)'/g)].map(m => m[1]);
if (directas.length)
  falla(`Hay ${directas.length} llamada(s) directa(s) que saltan la cola: ${[...new Set(directas)].join(', ')}. Deben pasar por encolar().`);
else ok('Ninguna mutación llama a api() directamente');

for (const f of ['encolar', 'drenar', 'idsEnCola', 'guardarCola'])
  new RegExp(`function\\s+${f}\\s*\\(|${f}\\s*=\\s*(async\\s*)?\\(`).test(js)
    ? ok(`Existe ${f}()`) : falla(`Falta la función ${f}()`);

const sinc = (js.match(/async function sincronizar[\s\S]*?\n}/) || [''])[0];
if (!sinc) falla('No se pudo aislar sincronizar()');
else {
  const iDrenar = sinc.indexOf('drenar('), iLeer = sinc.indexOf("api('leer')");
  if (iDrenar === -1 || iLeer === -1) falla('sincronizar() debe llamar a drenar() y luego a api(\'leer\')');
  else if (iDrenar > iLeer) falla('sincronizar() lee la hoja ANTES de vaciar la cola: revierte cambios pendientes');
  else ok('sincronizar() vacía la cola antes de leer la hoja');
}

if (/fotoBase64/.test(js) && /Object\.assign\(\{\},\s*figura,\s*extra/.test(js))
  ok('La foto viaja dentro de la operación encolada');
else aviso('No se detectó que fotoBase64 se incluya en la operación encolada (regla 3)');

/* ─────────────────────────────── 4. restos del modelo viejo */
grupo('Restos de versiones anteriores');
const restos = ['eliminadas', 'f.pendiente', 'pendiente:true', 'delete copia.pendiente']
  .filter(t => html.includes(t));
restos.length ? falla(`Quedaron restos: ${restos.join(', ')}`) : ok('Sin restos del modelo anterior');

/* ─────────────────────────────── 5. app ↔ backend */
grupo('Acoplamiento entre la app y la hoja');

const acciones = new Set([...js.matchAll(/encolar\(\s*'([a-z]+)'/g)].map(m => m[1]));
acciones.add('leer');
const despachadas = new Set([...gs.matchAll(/case\s+'([a-z]+)'/g)].map(m => m[1]));
const huerfanas = [...acciones].filter(a => !despachadas.has(a));
huerfanas.length
  ? falla(`La app pide acciones que el backend no atiende: ${huerfanas.join(', ')}`)
  : ok(`Las ${acciones.size} acciones de la app existen en el despachador`);

const columnas = ((gs.match(/const COLUMNAS\s*=\s*\[([\s\S]*?)\]/) || [, ''])[1]
  .match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
const literal = (js.match(/\{\s*id:'f'\+Date\.now\(\)[\s\S]*?\}/) || [''])[0];
const campos = (literal.match(/(\w+)\s*:/g) || []).map(s => s.replace(/\s*:$/, ''));

if (!columnas.length) falla('No se pudo leer COLUMNAS de Codigo.gs');
else if (!campos.length) falla('No se pudo leer los campos de la figura en index.html');
else {
  const faltan = campos.filter(c => !columnas.includes(c));
  const sobran = columnas.filter(c => !campos.includes(c) && !['foto', 'actualizado'].includes(c));
  if (faltan.length) falla(`Campos que la app envía y la hoja no guarda: ${faltan.join(', ')}`);
  else if (sobran.length) aviso(`Columnas de la hoja que la app nunca llena: ${sobran.join(', ')}`);
  else ok(`Los ${campos.length} campos de la figura calzan con COLUMNAS`);
}

/* ─────────────────────────────── 6. entorno */
grupo('Entorno');

/Content-Type'\s*:\s*'text\/plain/.test(js)
  ? ok('El POST usa text/plain (evita el preflight de CORS de Apps Script)')
  : falla('El POST no usa text/plain: Apps Script va a rechazarlo por CORS');

const externos = [...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g)]
  .map(m => m[1]).filter(u => !u.includes('fonts.googleapis') && !u.includes('fonts.gstatic'));
externos.length
  ? aviso(`Recursos externos además de las fuentes: ${externos.join(', ')}`)
  : ok('Autocontenido salvo Google Fonts');

/normalize\('NFD'\)/.test(js)
  ? ok('La búsqueda normaliza tildes')
  : falla('La búsqueda no normaliza tildes (regla 6)');

/* ─────────────────────────────── resumen */
console.log(`\n${'─'.repeat(52)}`);
if (fallos) console.log(`\x1b[31m${fallos} fallo(s)\x1b[0m${avisos ? `, ${avisos} aviso(s)` : ''}. No publique todavía.`);
else console.log(`\x1b[32mTodo en verde\x1b[0m${avisos ? `, con ${avisos} aviso(s) por revisar` : ''}. Listo para publicar.`);
process.exit(fallos ? 1 : 0);
