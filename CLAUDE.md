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
