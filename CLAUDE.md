# CLAUDE.md — Reglas del proyecto Filemón

Lea este archivo completo antes de tocar código.

## Qué es esto

Inventario interno de un taller de figuras de yeso en Cali. Lo usan el dueño y su
esposa desde el celular, en la bodega, mientras un cliente espera respuesta por
WhatsApp. No es una tienda: nadie externo ve esta página.

`index.html` es la app (un solo archivo, sin dependencias).
`apps-script/Codigo.gs` es el backend, pegado dentro de la hoja de Google Sheets.

## El modelo: cuatro cosas, cada dato en su lugar

**MOLDE** — la plancha física. Foto, caja donde está, estado, días de producción
y cuántas cavidades tiene. No tiene precio ni existencia.

**PIEZA** — cada figura que sale de esa plancha. Número, nombre y **existencia**.
El inventario vive aquí, porque es lo que el cliente escoge.

**PRODUCTO** — lo que se cobra: "Kit de 3 piezas", "Kit de letras con el nombre".
El **precio** vive aquí, no en el molde ni en la pieza.

**VENTA** — une los tres: un producto, las piezas que salieron y el total.

Mezclar estos niveles es el error de modelo que ya se cometió una vez. El
verificador lo comprueba.

## Reglas que no se negocian

**1. El molde y la pieza son cosas distintas.**
De ahí salen los estados: *en bodega* (la pieza tiene existencia), *por encargo*
(no hay existencia pero el molde sirve), *sin nombre* (pieza por completar) y
*no disponible* (molde dañado o inexistente). Colapsarlos hace que se le prometa
al cliente algo que no se puede entregar.

**2. Toda mutación pasa por la cola.**
Guardar, vender y eliminar entran a `cola` mediante `encolar()`. Nunca se llama
`api('guardar…'|'venta'|'eliminar…')` directo desde un manejador de eventos.
`api('leer')` solo se invoca dentro de `sincronizar()`, y **después** de que
`drenar()` haya vaciado la cola.

Motivo: `sincronizar()` reemplaza el estado local con el de la hoja. Si una
operación pendiente no se envió antes de leer, la lectura la revierte en
silencio. Ese bug ya existió y borraba ventas sin dejar rastro.

**3. La foto viaja dentro de la operación encolada.**
`fotoBase64` va en `datos` de la operación, no como envío inmediato aparte. Si
no, una foto tomada sin señal nunca sube.

**4. La pieza se busca por lo suyo.**
`coincidePieza()` mira el nombre y las claves **de esa pieza**, más el código del
molde. Si incluyera el nombre del molde, buscar "abeja" devolvería también Miel y
Flor por ser hermanas de la misma plancha. Ese bug ya existió. La búsqueda por
molde es el respaldo cuando ninguna pieza coincide.

**5. Los vacíos se muestran, no se esconden.**
Una pieza sin nombre aparece en la lista marcada como pendiente. Un molde con
`cavidades` mayor que sus piezas registradas muestra cuántas faltan. Es lo que
permite que otra persona complete el trabajo después.

**6. La búsqueda normaliza sin tildes y en minúscula**, con plurales españoles
(`flor→flores`, no `flors`) y diminutivos (`conejo→conejito`), en los dos lados
de la comparación.

**7. Nada de secretos en el repositorio.**
La URL `/exec` y la clave las escribe el usuario en la app y viven en su celular.
`CLAVE` en `Codigo.gs` se queda como `CAMBIE-ESTA-CLAVE`. El repo es público.

## Importador desde nombres de archivo

Las fotos vienen nombradas como `ABEJA MIEL FLOR NIÑA.jpg`. El nombre del archivo
*es* la ficha: cada palabra se vuelve una pieza numerada. `analizarNombreGS()` lo
interpreta.

- `NIÑA`/`NIÑO` no son piezas: van al público, en las notas del molde.
- Las palabras de tamaño acompañan a la pieza anterior, y si llega una segunda
  abren una pieza nueva: "Conejo grande y pequeño" son DOS piezas.
- Palabras colectivas al inicio (`ANIMALES`, `FRUTAS`) se descartan si quedan al
  menos dos piezas de verdad.
- Importar dos veces no duplica: se comparan los nombres normalizados.
- Los colores de etiqueta de Finder (macOS) no viajan en la subida.

## Restricciones del entorno

- Sin dependencias, sin bundler, sin framework.
- Se usa desde **Firefox en Android**. Nada de APIs que no existan ahí.
- `localStorage` es la caché local. La fuente de verdad es la hoja de Sheets.
- Apps Script exige `Content-Type: text/plain` en el POST para evitar el
  preflight de CORS. No lo cambie a `application/json`.
- Las escrituras masivas usan un solo `setValues`, no `appendRow` por fila: con
  cien archivos se agota el límite de ejecución.
- Nada de `SpreadsheetApp.getUi().alert()`: el diálogo aparece en la pestaña de
  la hoja y deja la ejecución colgada esperando un clic que nadie ve.

## Antes de terminar cualquier tarea

`node verificar.mjs` en verde. Si agrega un campo, agréguelo también a la
constante `COL_*` correspondiente: el verificador comprueba que calcen.

## Limitación aceptada

Dos personas editando lo mismo a la vez: gana la última en sincronizar, sin
aviso. No lo arregle sin pedirlo.
