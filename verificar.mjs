#!/usr/bin/env node
// Verifica que el repositorio tenga la estructura correcta para publicar
// en GitHub Pages: nada anidado, nada duplicado, nada suelto.

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = dirname(fileURLToPath(import.meta.url));

const IGNORAR_EN_RAIZ = new Set([".git", "node_modules", "package-lock.json"]);

const RAIZ_ESPERADA = new Set([
  "index.html",
  "README.md",
  "CLAUDE.md",
  "package.json",
  "verificar.mjs",
  "apps-script",
]);

const errores = [];

function ruta(...partes) {
  return join(RAIZ, ...partes);
}

function relativa(p) {
  return p.slice(RAIZ.length + 1) || ".";
}

// 1) La raíz debe tener exactamente los archivos esperados (ni de más ni de menos).
const contenidoRaiz = readdirSync(RAIZ).filter((n) => !IGNORAR_EN_RAIZ.has(n));

for (const nombre of contenidoRaiz) {
  if (!RAIZ_ESPERADA.has(nombre)) {
    errores.push(`Sobra en la raíz: "${nombre}" (no debería estar ahí).`);
  }
}
for (const esperado of RAIZ_ESPERADA) {
  if (!existsSync(ruta(esperado))) {
    errores.push(`Falta en la raíz: "${esperado}".`);
  }
}

// 2) index.html debe ser un archivo real en la raíz, con contenido de verdad.
if (existsSync(ruta("index.html"))) {
  if (!statSync(ruta("index.html")).isFile()) {
    errores.push('"index.html" existe pero no es un archivo.');
  } else {
    const html = readFileSync(ruta("index.html"), "utf8");
    if (!html.trim().toLowerCase().startsWith("<!doctype html")) {
      errores.push('"index.html" no empieza con "<!DOCTYPE html>".');
    }
  }
}

// 3) apps-script/ debe contener exactamente Codigo.gs, nada más.
const carpetaScript = ruta("apps-script");
if (existsSync(carpetaScript) && statSync(carpetaScript).isDirectory()) {
  const contenido = readdirSync(carpetaScript);
  if (!contenido.includes("Codigo.gs")) {
    errores.push('Falta "apps-script/Codigo.gs".');
  } else if (readFileSync(join(carpetaScript, "Codigo.gs"), "utf8").trim().length === 0) {
    errores.push('"apps-script/Codigo.gs" está vacío.');
  }
  const sobran = contenido.filter((n) => n !== "Codigo.gs");
  if (sobran.length) {
    errores.push(`Sobra dentro de "apps-script/": ${sobran.join(", ")}.`);
  }
} else if (existsSync(carpetaScript)) {
  errores.push('"apps-script" existe pero no es una carpeta.');
}

// 4) En ningún lado del repo debe quedar un .zip, ni carpetas duplicadas comunes.
const NOMBRES_SOSPECHOSOS = /^(copia|copy|nuevo|new|duplicado|final|old|viejo)[ _-]/i;

function revisarCarpeta(dir) {
  for (const nombre of readdirSync(dir)) {
    if (IGNORAR_EN_RAIZ.has(nombre)) continue;
    const p = join(dir, nombre);
    const info = statSync(p);
    if (info.isDirectory()) {
      if (NOMBRES_SOSPECHOSOS.test(nombre)) {
        errores.push(`Carpeta con nombre sospechoso de duplicado: "${relativa(p)}".`);
      }
      revisarCarpeta(p);
    } else {
      if (nombre.toLowerCase().endsWith(".zip")) {
        errores.push(`Archivo .zip que no debería estar subido: "${relativa(p)}".`);
      }
      if (NOMBRES_SOSPECHOSOS.test(nombre)) {
        errores.push(`Archivo con nombre sospechoso de duplicado: "${relativa(p)}".`);
      }
    }
  }
}
revisarCarpeta(RAIZ);

// Resultado
if (errores.length) {
  console.log("\x1b[31m✗ La estructura del repositorio tiene problemas:\x1b[0m\n");
  for (const e of errores) console.log(`  - ${e}`);
  console.log(`\n${errores.length} problema(s) encontrado(s).`);
  process.exit(1);
} else {
  console.log("\x1b[32m✓ Estructura correcta para GitHub Pages.\x1b[0m");
  console.log("  index.html, README.md, CLAUDE.md, package.json, verificar.mjs, apps-script/Codigo.gs");
  process.exit(0);
}
