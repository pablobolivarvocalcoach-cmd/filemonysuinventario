# CLAUDE.md — Reglas del proyecto Filemón

Lea este archivo completo antes de tocar código.

## Qué es esto

Inventario interno de **figuras de yeso** para un taller en Cali. Lo usa la dueña
desde el celular, de pie en la bodega, mientras una clienta espera respuesta por
WhatsApp. No es una tienda: nadie externo ve esta página.

`index.html` es la app (un solo archivo, sin dependencias).
`apps-script/Codigo.gs` es el backend, pegado dentro de la hoja de Google Sheets.

## Reglas que no se negocian

**1. El molde y la pieza son cosas distintas.**
`existencia` = piezas de yeso terminadas en bodega.
`molde` = si la herramienta sirve para producir más.
De ahí salen tres estados y no dos: *listas hoy* (hay existencia),
*por encargo* (no hay existencia pero el molde sirve) y *no disponible*
(molde dañado o inexistente). Colapsar esto en un solo campo hace que la
dueña le prometa al cliente algo que no puede entregar. Es el peor error posible
en este sistema.

**2. Toda mutación pasa por la cola.**
Guardar, vender y eliminar entran a `cola` mediante `encolar()`. Nunca se llama
`api('guardar'|'venta'|'eliminar')` directo desde un manejador de eventos.
`api('leer')` solo se invoca dentro de `sincronizar()`, y **después** de que
`drenar()` haya vaciado la cola.

Motivo: `sincronizar()` reemplaza el estado local con el de la hoja. Si una
operación pendiente no se envió antes de leer, la lectura la revierte en
silencio. Ese bug ya existió y borraba ventas sin dejar rastro.

**3. La foto viaja dentro de la operación encolada.**
`fotoBase64` va en `datos` de la operación, no como parámetro suelto de un envío
inmediato. Si no, una foto tomada sin señal nunca sube.

**4. El invariante de la venta.**
Registrar una venta descuenta de `existencia` y agrega una fila en `VENTAS`.
Las dos cosas o ninguna. Nunca se permite vender más de lo que hay en bodega.

**5. Tres casos de foto en el backend, no dos.**
Foto nueva, foto borrada a propósito, y guardado normal sin tocarla (hay que
conservar la URL que ya estaba en la hoja). Confundir el segundo con el tercero
hace que «Quitar foto» no funcione. Ya pasó.

**6. La búsqueda se normaliza sin tildes y en minúscula**, en los dos lados de la
comparación. La dueña escribe «corazon» buscando «corazón».

**7. Nada de secretos en el repositorio.**
La URL `/exec` y la clave las escribe la usuaria en la app y viven en su celular.
`CLAVE` en `Codigo.gs` se queda como `CAMBIE-ESTA-CLAVE`. El repo es público.

## Restricciones del entorno

- Sin dependencias, sin bundler, sin framework. Un archivo HTML que abre con
  doble clic o se sirve estático desde GitHub Pages.
- Se usa desde **Firefox en Android**. Nada de APIs que no existan ahí.
- `localStorage` es la caché local. La fuente de verdad es la hoja de Sheets.
- Apps Script exige `Content-Type: text/plain` en el POST para evitar el
  preflight de CORS. No lo cambie a `application/json`.

## Antes de terminar cualquier tarea

`node verificar.mjs` en verde. Si agrega un campo a la figura, agréguelo también
a `COLUMNAS` en `Codigo.gs` — el verificador comprueba que coincidan.

## Limitación aceptada

Dos personas editando la misma figura a la vez: gana la última en sincronizar,
sin aviso. No lo arregle sin pedirlo; con menos de 50 figuras no compensa.

## Importador desde nombres de archivo

Las fotos del taller vienen nombradas como `ABEJA MIEL FLOR NIÑA.jpg`. El nombre
del archivo *es* la ficha: de ahí salen el nombre, las palabras de búsqueda y el
público. `analizarNombre()` lo interpreta.

- Un archivo = un registro, aunque contenga varias figuras. Las palabras sueltas
  se vuelven claves de búsqueda, que es justo lo que hace útil el buscador.
- Se generan plurales según la regla española (`flor→flores`, no `flors`) y
  diminutivos (`conejo→conejito`), porque así pide la gente.
- Las palabras vacías (`y`, `de`, `la`) no entran a las claves, y `coincide()`
  también las descarta de la consulta.
- Importar dos veces no duplica: se comparan los nombres normalizados y las
  repetidas aparecen desmarcadas.
- Sin conexión a Sheets se importan los nombres **sin fotos**. Cien fotos en
  `localStorage` revientan la cuota del navegador.
- Las etiquetas de color de Finder (macOS) no viajan en la subida. El navegador
  solo recibe el nombre del archivo.

## Carga masiva desde Drive

`importarDesdeCarpeta()` en `Codigo.gs` lee una carpeta de Drive, interpreta el
nombre de cada archivo con `analizarNombreGS()` y escribe las filas en FIGURAS
en un solo `setValues` (no `appendRow` por fila: con 100 archivos se agota el
límite de ejecución).

`analizarNombreGS()` es el gemelo de `analizarNombre()` del navegador. Si cambia
la lógica en uno, cámbiela en el otro o las dos vías darán claves distintas.

Las fotos importadas así se quedan en su carpeta original, no en `Filemon - Fotos`.
Por eso «Quitar foto» sobre ellas limpia la URL pero no manda el archivo a la
papelera. Es intencional: son las fotos originales del taller.

## Reportes

Dos vías, a propósito:

- **Navegador** (`abrirReportes`): vista rápida de 12 meses, CSV para Excel y
  reporte imprimible vía `@media print` sobre `#impresion`. Sin librerías: no se
  agregan dependencias para generar xlsx o pdf.
- **Hoja** (`generarReporte` en Codigo.gs): pestaña REPORTE con el análisis de
  temporada. Google Sheets ya exporta a Excel y a PDF desde su propio menú, así
  que no se escribe código de exportación.

El CSV usa punto y coma y marca de orden de bytes (`\uFEFF`): es lo que Excel en
español espera. No lo cambie a coma sin probarlo en un Excel real.

Con menos de un año de datos, el reporte debe decir explícitamente que no es
temporada confirmada. No presente correlaciones de un solo año como estacionalidad.
