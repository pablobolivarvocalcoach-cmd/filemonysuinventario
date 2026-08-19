# Filemón · Inventario de figuras de yeso

Sistema interno para saber en segundos qué figuras hay listas, cuáles se producen sobre pedido y cuáles no se pueden hacer. Los datos viven en **su propia hoja de Google Sheets**; las fotos, en **su propio Google Drive**.

---

## Qué hace

- Busca por como el cliente lo dice (*oso, osito, teddy*), no por como está catalogado.
- Redacta la respuesta lista para pegar en WhatsApp, con existencia, precio y plazo.
- Distingue **piezas listas** de **capacidad de producir**: nunca promete lo que no puede entregar.
- Registra ventas y descuenta del inventario.
- Calcula qué producir primero según el ritmo de venta de los últimos 30 días.
- Funciona sin señal: guarda en el celular y sube los cambios al reconectar.

---

## Instalación

Son tres partes: la hoja, el script y la página. Calcule 30 minutos la primera vez.

### Parte 1 — La hoja de cálculo

1. Cree una hoja nueva en Google Sheets. Llámela **Filemón · Inventario**.
2. Menú **Extensiones → Apps Script**.
3. Borre todo lo que aparezca y pegue el contenido de `apps-script/Codigo.gs`.
4. En la línea 12, cambie `CAMBIE-ESTA-CLAVE` por una clave suya. Larga, sin espacios ni tildes. Ejemplo: `filemon-yeso-2026-x7k9`. **Anótela**, la necesita en la Parte 3.
5. Guarde (💾).
6. Arriba, en el selector de funciones, elija **prepararHoja** y presione **Ejecutar**. Google le va a pedir permisos: acepte (le va a mostrar una pantalla de "app no verificada" — es su propio script, entre por *Configuración avanzada → Ir a…*).
7. Confirme que se crearon las pestañas **FIGURAS** y **VENTAS**, y la carpeta *Filemon - Fotos* en su Drive.

### Parte 2 — Publicar el script

1. En el editor de Apps Script: **Implementar → Nueva implementación**.
2. Engranaje ⚙ → tipo **Aplicación web**.
3. Configure así:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
4. **Implementar** y copie la URL que termina en `/exec`.

> Si más adelante modifica el script, use **Implementar → Gestionar implementaciones → editar ✏️ → Versión: Nueva** para que los cambios tomen efecto. Si crea una implementación nueva, la URL cambia.

### Parte 3 — Publicar la página en GitHub Pages

1. Cree un repositorio nuevo en GitHub llamado `filemonysuinventario`.
2. Suba `index.html` y la carpeta `apps-script/` (puede arrastrarlos en la web de GitHub, o por Git):

```bash
git init
git add .
git commit -m "Inventario Filemón"
git branch -M main
git remote add origin https://github.com/USUARIO/filemonysuinventario.git
git push -u origin main
```

3. En el repositorio: **Settings → Pages → Source: Deploy from a branch → Branch: main / (root) → Save**.
4. En un par de minutos tendrá la dirección `https://USUARIO.github.io/filemonysuinventario/`.
5. Ábrala en el celular y use **Compartir → Agregar a pantalla de inicio**. Le queda como una app.

### Parte 4 — Conectar

1. Abra la página, toque **···**.
2. Pegue la URL `/exec` y la clave que anotó en el paso 4 de la Parte 1.
3. **Guardar conexión**. El punto de arriba debe quedar verde y decir *Al día*.

Si ya tenía figuras registradas en la versión anterior, descargue su respaldo desde esa versión y cárguelo con **Cargar respaldo o subir todo a la hoja**. Sube todo, fotos incluidas.

---

## Sobre la seguridad

La URL y la clave **no van dentro del repositorio**. Se escriben en la app y quedan guardadas en cada celular por separado. Por eso el repositorio puede ser público sin exponer nada.

Para darle acceso a otra persona: le pasa la dirección de la página, la URL `/exec` y la clave. Le comparte la hoja de Sheets solo si quiere que también edite desde el computador.

**Si alguna vez se filtra la clave:** cámbiela en el script (línea 12), vuelva a implementar y actualícela en cada celular.

---

## Uso diario

| Situación | Qué hacer |
|---|---|
| Cliente pregunta "¿tienes osos?" | Escriba `oso`. Copie la respuesta. |
| Vendió 3 piezas | Abra la figura → **Registrar venta** |
| Sacó 20 del molde | Abra la figura → botón **+** hasta la cantidad → Guardar |
| Se rompió un molde | Abra la figura → Estado del molde: **Dañado** |
| Planear la semana | **···** → *Qué producir primero* |
| No aparece algo que sí maneja | Abra la figura → agregue la palabra a los sinónimos |

Regla de oro: **registre la venta en el momento**. Si no, en dos semanas los números no sirven y el cálculo de producción tampoco.

---

## Si algo falla

**"Clave incorrecta"** — no coinciden la clave del script y la de la app. Revise mayúsculas y espacios sobrantes.

**"Sin conexión" con internet activo** — casi siempre es que la implementación quedó como *Solo yo* en vez de *Cualquier usuario*, o que modificó el script sin publicar versión nueva.

**Las fotos no cargan** — el script las comparte automáticamente al subirlas. Si arrastró archivos a la carpeta de Drive a mano, no quedan compartidas: súbalas desde la app.

**Faltan las hojas** — ejecute `prepararHoja` otra vez desde el editor.

---

## Si usa Firefox

Todo funciona igual, pero hay cuatro detalles propios de este navegador:

**Impida que Firefox borre los datos del sitio.** Es el paso más importante. La app guarda en el celular la conexión y la cola de cambios que todavía no llegan a la hoja; si Firefox los borra al cerrar, esos cambios se pierden.

- *Android:* ⋮ → Ajustes → **Eliminar datos de navegación al salir**. Confirme que *Cookies* y *Almacenamiento del sitio* estén **desmarcados**.
- *Computador:* Ajustes → Privacidad y seguridad → Cookies y datos del sitio. Desmarque «Eliminar cookies y datos del sitio cuando se cierre Firefox» y agregue su dirección en **Administrar excepciones**.
- Nunca la use en ventana privada: ahí Firefox borra todo al cerrar.

**Inicie sesión en Google dentro de Firefox** antes de autorizar el script. Si el inicio de sesión se queda dando vueltas, toque el escudo de la barra de direcciones y desactive la protección contra rastreo solo para `accounts.google.com`.

**Agregar a la pantalla de inicio:** en Firefox para Android, menú ⋮ → *Agregar a la pantalla de inicio*. En computador, clic derecho sobre la pestaña → *Fijar pestaña*.

**Si está en iPhone:** Firefox para iOS no puede instalar la página en la pantalla de inicio. Use Safari en ese caso; el resto funciona igual.

---

## Prueba final antes de confiarle el inventario

1. Registre una figura de prueba con foto. Abra su hoja y confirme que apareció la fila y que la columna `foto` trae un enlace de Drive.
2. Búsquela en la app y toque **Copiar para WhatsApp**. Péguelo en cualquier chat.
3. Ponga el celular en **modo avión** y registre una venta. La ficha queda con un punto amarillo.
4. Quite el modo avión y toque el punto de arriba. Debe pasar a verde, y la venta aparecer en la pestaña **VENTAS** con la existencia ya descontada.

Si el paso 4 pasa, el sistema está completo.

---

## Limitación conocida

Si dos personas editan **la misma figura** al mismo tiempo desde dos celulares, gana la última que sincronice, sin aviso. Resolverlo bien exige control de versiones por fila, complejidad que con menos de 50 figuras y dos personas no compensa. El acuerdo práctico: que una sola persona ajuste existencias, o avisarse antes de tocar la misma pieza.

---

## Estructura

```
index.html              La app. Un solo archivo, sin dependencias.
apps-script/Codigo.gs   El puente con Sheets y Drive.
README.md               Este archivo.
```

---

## Cargar el catálogo de una vez

Si tiene las fotos nombradas de forma descriptiva (`ABEJA MIEL FLOR NIÑA.jpg`),
use el menú ··· → **Importar desde las fotos**. Lee los nombres y crea las
figuras con el nombre, la categoría y las palabras de búsqueda ya puestas.
Revise la lista antes de confirmar; las que ya tenga aparecen desmarcadas.

Ojo: los colores de etiqueta de Finder no se pueden leer desde el navegador.
Si esos colores significan algo (por ejemplo, molde dañado), márquelo dentro
de la app o escríbalo en el nombre del archivo.

---

## El modelo: molde, pieza, producto

**Molde** es la plancha: foto, caja donde está, estado, días de producción.
**Pieza** es cada figura que sale de ella: número, nombre y cuántas hay en bodega.
**Producto** es lo que se cobra: Kit de 3 piezas, Kit de letras con el nombre.

El cliente pregunta por una pieza ("¿tienes abejas?"), usted busca por ahí, y la
respuesta lista trae la existencia, el plazo y los precios de sus productos.

Las piezas que todavía no ha nombrado aparecen como *Sin nombre — por completar*,
y los moldes a los que les faltan piezas muestran cuántas. Nadie tiene que
acordarse de los pendientes.

---

## Cargar el catálogo desde Drive

1. En Drive, cree una carpeta llamada exactamente **FILEMON MOLDES** y suba ahí
   sus fotos con los nombres descriptivos: `ABEJA MIEL FLOR NIÑA.jpg`.
2. En Apps Script, elija la función **importarDesdeCarpeta** y presione Ejecutar.
3. Cada palabra del nombre se vuelve una pieza numerada. "ABEJA MIEL FLOR" crea
   un molde con tres piezas: 1 Abeja, 2 Miel, 3 Flor.
4. Abra la app, sincronice, y **revise que el número de cada pieza coincida con
   la foto**: el orden del nombre del archivo no siempre es el orden físico.

Ejecutarlo dos veces no duplica. Puede volver a correrlo cada vez que agregue
moldes a la carpeta.

---

## El código del molde

La página los numera sola: `M-001`, `M-002`… No hay que escribir códigos en los
nombres de las fotos. El nombre del archivo sirve para las piezas; el código es
solo un identificador corto para referirse al molde.

Si viene de la numeración vieja, ejecute **renumerarMoldes** una sola vez desde
Apps Script y sincronice.

---

## Quién actualiza qué

**Las existencias y las ventas, desde la app.** Su esposa puede usar la misma
página desde su celular: le pasa la dirección, la URL `/exec` y la clave.

Registrar una venta: menú ··· → *Registrar una venta*. Escoge el producto, busca
las piezas que salieron, y el sistema descuenta cada una.

**Si prefiere escribir directo en la hoja**, cambie la columna `existencia` en la
pestaña PIEZAS. La app lo recoge al sincronizar. Hágalo solo cuando el punto de
la app esté verde.

---

## Ver la foto en grande

Toque la miniatura de cualquier molde o pieza y la plancha se abre a pantalla
completa. Pellizque para acercar, doble toque para alternar, arrastre para
moverse. Debajo aparecen las piezas del molde con su número: toque una para
abrir su ficha sin cerrar lo que está mirando.

Los botones de giro del visor son solo para mirar. Para dejar la foto derecha de
forma permanente, use los botones ↺ ↻ dentro de la ficha del molde y guarde.

---

## Reportes

**Desde el celular** — menú ··· → *Ventas por mes, Excel y PDF*: barras de los
últimos 12 meses, inventario e historial en CSV para Excel, y reporte imprimible
(elija *Guardar como PDF*).

**Desde la hoja** — ejecute `generarReporte()` en Apps Script. Arma la pestaña
REPORTE con el análisis de temporada, las piezas por reponer y los moldes
incompletos. Para el archivo: *Archivo → Descargar → Microsoft Excel* o *PDF*.

Con menos de un año de ventas el reporte lo advierte: muestra lo vendido, pero no
lo llama temporada.

---

## Antes de publicar

```bash
npm run check
```

Revisa sintaxis, que no se haya comiteado la clave real, que ninguna operación
salte la cola de sincronización, y que los campos de la app calcen con las
columnas de la hoja. Sale con error si algo está mal.
