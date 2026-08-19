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

## Visor de fotos

`abrirVisor(idMolde)` abre la plancha a pantalla completa. Existe porque para
numerar las piezas hay que ver la foto grande; por eso lleva debajo la lista de
piezas del molde, y tocar una abre su ficha.

- Pide la foto en alta cambiando `sz=w600` por `sz=w1600` en la URL de Drive.
- Gestos con Pointer Events: dos punteros para pellizcar, uno para arrastrar
  (solo con zoom), doble toque para alternar 1x/2.5x, rueda en computador.
- `.visor-lienzo` lleva `min-height:0`. Sin eso, el ítem flexible no se encoge
  por debajo de su contenido y la foto se corta por abajo. Ya pasó.
- `limitar()` calcula el margen sobre el tamaño real que ocupa la imagen, no
  sobre el lienzo: una foto vertical deja franjas laterales por las que no debe
  poder arrastrarse, y una ampliada sí debe recorrerse entera. Tiene en cuenta
  el giro, porque a 90° y 270° se intercambian ancho y alto.
- La tira de piezas va en una sola fila con desplazamiento horizontal: en
  varias filas le robaba demasiado alto a la foto en el celular.
- Dos modos, porque las fotos llegan con proporciones distintas según el celular
  que las tomó: **Ajustar** muestra la foto completa (escala 1, `object-fit:
  contain`) y **Llenar** la agranda hasta cubrir la pantalla. El doble toque
  alterna entre los dos. Al abrir, si la foto aprovecha menos del 62% del
  lienzo, arranca en Llenar; si no, en Ajustar. Nunca arranca en Llenar si eso
  implicara ampliar más de 1.8x: en una pantalla ancha con foto vertical el
  recorte sería brutal.
- No etiquete el botón como "1:1": sugiere tamaño real en píxeles y confunde.
- El giro del visor es temporal, para mirar. El giro que se guarda es el de la
  ficha del molde.
- Las miniaturas son `<span data-zoom>` dentro de un `<button>`, no botones
  anidados (HTML inválido). El clic se intercepta en fase de captura.

## El código del molde

Es un número corrido: `M-001`, `M-002`… **No se deriva del nombre.** Un código
mnemotécnico (`ABE-01`) envejece mal —si se renombra el molde deja de
corresponder— y choca entre moldes parecidos: dos de conejos serían `CON-01` y
`CON-02` sin que nadie sepa cuál es cuál.

Su único trabajo es ser un identificador corto, estable y pronunciable
("pásame el molde 47"). Los moldes no se marcan físicamente: el uso borra la
marca, así que la correspondencia vive en la app.

`siguienteNumero()` en el backend y `codigoLibre()` en la app deben dar el mismo
resultado. `renumerarMoldes()` reasigna todos en el orden actual de la hoja, para
migrar desde la numeración vieja.

## Las direcciones de foto de Drive

`https://drive.google.com/thumbnail?id=X&sz=wN` devuelve **a veces un recorte
centrado**, no la foto completa. Con las planchas del taller cortaba la fila de
abajo. Ya pasó y costó tiempo diagnosticarlo, porque parecía un problema de CSS.

Use `https://lh3.googleusercontent.com/d/{ID}=w{N}`, que respeta la proporción.

La traducción se hace en la app con `urlFoto(foto, ancho)`, no en el backend: así
funciona también con las fotos que ya estaban guardadas con la dirección vieja,
sin obligar a reimportar. `Codigo.gs` sigue guardando la forma `thumbnail?id=`
y eso está bien; el id es lo único que importa.

Todo `<img>` de foto lleva `onerror` que cae de vuelta a la dirección guardada.
