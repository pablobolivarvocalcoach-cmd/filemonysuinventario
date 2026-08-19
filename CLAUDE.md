# Filemón · Inventario

Página estática (una sola app en `index.html`, sin build ni dependencias) que se publica
directo en GitHub Pages. Los datos viven en Google Sheets/Drive del usuario, conectados
a través de un Apps Script (`apps-script/Codigo.gs`) publicado como aplicación web.

## Estructura obligatoria

El repositorio debe tener exactamente esto en la raíz, sin carpetas anidadas ni archivos sueltos:

```
index.html
README.md
CLAUDE.md
package.json
verificar.mjs
apps-script/
  Codigo.gs
```

Nada más. Si aparece un `.zip`, una carpeta duplicada, o `index.html` termina dentro de una
subcarpeta, GitHub Pages deja de servir la app correctamente.

## Verificación

```bash
npm run check
```

Corre `verificar.mjs`, que confirma que la raíz tiene solo los archivos esperados, que
`apps-script/` contiene únicamente `Codigo.gs`, que no hay `.zip` sueltos ni carpetas con
nombres de duplicado (`copia-`, `nuevo-`, etc.), y que `index.html` es un documento HTML
válido. Debe salir en verde antes de dar cualquier cambio de estructura por terminado.

## Notas para trabajar aquí

- `index.html` es un solo archivo autocontenido (HTML + CSS + JS inline). No dividirlo en
  módulos ni agregar un bundler: es intencional que no tenga build step, para que baste con
  subirlo a GitHub Pages.
- `apps-script/Codigo.gs` se pega manualmente en el editor de Google Apps Script; no se
  ejecuta ni se importa desde Node.
- No hay dependencias de npm. `package.json` solo existe para exponer `npm run check`.
- El proyecto y su documentación (README.md) están en español, porque el usuario final no
  programa y lo administra directamente.
