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

## Fotos acostadas

Varias fotos del taller están guardadas apaisadas aunque el molde sea vertical.
Por eso existe `giro` y por eso se puede guardar desde el visor: es donde uno se
da cuenta.

`medidas()` calcula `base`, el factor que vuelve a encajar la foto cuando el giro
es 90° o 270° e intercambia ancho y alto. Sin él, una foto apaisada girada se
sale del lienzo y se corta. Se calcula con `naturalWidth`/`naturalHeight`, nunca
con el rectángulo ya transformado: eso se muerde la cola.

La escala que se aplica es siempre `base * escala`, donde `escala` es solo el
zoom del usuario y 1 significa "cabe entera".

## Identidad visual

La paleta sale del logo, no de un gusto abstracto: melena `#33220F`, león
`#FCB40C`, hocico `#FCE4B4`, palabra `#A86C18`. El fondo es crema cálido
`#F6EEDF`. Tipografía de titulares **Fredoka**, que recoge el trazo redondeado
del logotipo; texto en Public Sans y códigos en mono, que aporta el aire de
libro de inventario.

`icono.png` es la cabeza del león recortada. Sirve de favicon y de icono al
agregar a pantalla de inicio.

Cuidado con un choque: el ámbar es color de marca **y** era el color del estado
"por encargo". Los estados usan verde, naranja quemado y rojo ladrillo; el ámbar
queda reservado para acciones y acentos.

Los moldes se muestran en cuadrícula porque el producto es visual; las piezas en
lista, porque ahí lo que importa es el nombre y la existencia.

No baje el contraste. Se usa bajo techo de zinc, con luz mala y a contraluz.

## Orden y recorte de las piezas

Las piezas se listan **agrupadas por molde**, con una cabecera por plancha, y
dentro de cada grupo por su `numero`, que es el orden físico. Alfabético global
las regaba por toda la página: las piezas de una misma plancha se producen y se
buscan juntas.

`celdaDe(molde, pieza)` calcula en qué casilla de la cuadrícula cae la pieza a
partir de `columnas` y `cavidades`, y la miniatura muestra solo ese pedazo de la
foto. Devuelve `null` —y entonces se muestra la plancha entera— si falta el dato
o si `giro` no es 0: rotar y recortar a la vez desalinea la cuadrícula, y no vale
la pena resolverlo mientras las fotos se puedan enderezar antes de subirlas.

El importador supone `columnas: 2` cuando hay 4 o más piezas, que es la
distribución más común; quien mire la foto lo corrige.

## Marcado manual de piezas

No se intenta detectar las formas analizando la foto. Las planchas son gris claro
sobre fondo gris claro, con sombras suaves y fotos de baja resolución: un
detector acertaría a medias y obligaría a revisar todo igual, pero desconfiando.

En su lugar, `abrirMarcado()` deja tocar la foto para situar cada pieza. Se
guarda en `recorte` de la pieza como `x,y,w,h` en fracciones de la imagen, y
manda sobre la cuadrícula automática. La cuadrícula sirve de punto de partida.

El recuadro se mantiene cuadrado en píxeles (`h = w * anchoNatural /
altoNatural`); si no, la miniatura sale estirada. Y el tamaño se topa en
`min(1, altoNatural/anchoNatural)`, porque en una foto apaisada el alto crece
más rápido que el ancho y se saldría del borde.

Marcar exige `giro === 0`, igual que el recorte por cuadrícula.

## Columnas nuevas: siempre al final

`crearHoja()` reescribe la fila de encabezados, pero **no** mueve los datos ya
escritos. Si se inserta una columna en la mitad de un `COL_*`, los encabezados
quedan corridos respecto a las filas existentes y cada campo se lee en la casilla
del vecino. Pasó al agregar `columnas` y dejó todos los moldes sin foto.

Agregue siempre al final del arreglo, aunque quede menos ordenado de leer. Las
filas viejas devuelven vacío en la columna nueva, que es exactamente lo correcto.
