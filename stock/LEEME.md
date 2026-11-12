# Penitentia · Stock y lotes

Sistema interno para generar el código de lote de cada pizza, imprimir su etiqueta y seguir el stock hasta que se vende.

## Cómo funciona

- **Producir:** elegís la fecha del lote (hoy por defecto), la cantidad y el contenido neto de cada variedad, y tocás **Generar e imprimir**. Se crea un código por pizza y se abre la impresión con la etiqueta original (la de Word) de esa variedad, con lote, vencimiento y peso ya escritos (una etiqueta por hoja).
- **Código:** `AAMMDD-XX-N`, el mismo formato que la etiqueta de Agridulce (`261021-AG-1`).
  - `AAMMDD`: fecha del lote.
  - `XX`: variedad. MO Mozzarella · FQ Fugazza con queso · JM Jamón y morrón · PR Provolone · AG Agridulce · TR Tropical · AM Americana.
  - `N`: número de pizza de ese día y variedad. Si hacés otra tanda el mismo día, sigue contando (no se repite nunca).
- **Vencimiento:** 3 meses después de la fecha del lote (30/11 → 28/02, no 2/03).
- **Stock:** cuántas hay de cada variedad en el freezer, cuáles vencen pronto (14 días o menos) o ya vencieron. Vendés escribiendo el código en **Vender por código** (o tocando **Vendida** en la fila). Podés elegir varias y marcarlas vendidas, reimprimir sus etiquetas, darlas de baja o volverlas al freezer. Todo tiene **Deshacer**.

Las etiquetas salen de `js/variedades.js` y `js/etiqueta.js` (mismo diseño y textos que las etiquetas Word de `3 - Etiquetas/1 … 7`). Si cambia una receta, se edita ahí.

### Al imprimir

En la ventana de impresión elegí la impresora de etiquetas, tamaño de papel **100 × 150 mm**, el mismo de las etiquetas Word, y márgenes **Ninguno**. Escala 100 %.

## Modo prueba (ahora)

Mientras `js/config.js` no tenga las claves, todo se guarda **sólo en ese navegador**. La primera vez que entrás, el usuario y la contraseña que escribas quedan como los tuyos. Sirve para probar; no lo uses para el stock real (si borrás los datos del navegador se pierde).

## Pasarlo a Supabase (usuarios reales, en todos los equipos)

1. Entrá a [supabase.com](https://supabase.com), creá una cuenta y un proyecto nuevo (plan Free; región São Paulo).
2. **SQL Editor → New query**: pegá el contenido de `supabase.sql` y tocá **Run**.
3. **Authentication → Sign In / Providers → Email**: dejá Email activado y **desactivá «Allow new users to sign up»** (así nadie se puede crear una cuenta solo).
4. **Authentication → Users → Add user → Create new user**: mail `tunombre@penitentia.com.ar` (no hace falta que el mail exista), una contraseña, y tildá **Auto Confirm User**. Repetí por cada persona.
   En la pantalla de ingreso se entra con `tunombre` (o con el mail completo).
5. **Project Settings → API**: copiá **Project URL** y la clave **anon public** en `js/config.js`.
6. Publicá (ver abajo) y entrá.

La clave *anon* puede estar a la vista: sin usuario y contraseña la base no muestra ni deja escribir nada.

## Publicarlo

La carpeta `stock/` está dentro de la web, así que al subirla queda en **penitentia.com.ar/stock** (no aparece en Google: tiene `noindex` y está bloqueada en `robots.txt`).

```bash
git add stock robots.txt
git commit -m "Sistema de stock y lotes"
git push
```

## Probar en tu compu

```bash
python -m http.server 8642
```
y abrí http://localhost:8642/stock/

## Costos (pestaña Costos)

Es el Excel «2 - Costos/Costos Penitentia.xlsx» dentro de la página, con las mismas pestañas y las mismas fórmulas vinculadas: si cambiás un precio en **Precios Insumos**, se recalculan Insumos, Recetas, Costos Fijos y Variables, Precios y Rentabilidad y el Tablero.

- **Primera vez:** tocá **Cargar Excel** y elegí `Costos Penitentia.xlsx`. Se guarda en Supabase (tabla `costos_libro`, sólo con usuario). En el código de la página no hay ningún precio.
- **Editar:** se tocan las celdas amarillas (y los números de las celdas color crema, como «Cantidad de pizzas»). Se aceptan `1.500,50`, `30%` o una cuenta como `=5000/0,49`. Lo que cambia por el recálculo parpadea un instante. Se guarda solo.
- **Sin Excel:** todo se hace desde la página. Arriba de cada pestaña hay una barra de acciones:
  - **Precios Insumos:** agregar, renombrar o quitar un insumo (no deja quitar uno que se usa en una receta o en el consumo).
  - **Recetas:** agregar o quitar un ingrediente, crear una **receta nueva** copiando otra (aparece sola en Precios y Rentabilidad y en el Tablero), renombrarla o quitarla. Si quitás un ingrediente de la base en la receta de Mozzarella, pregunta si sacarlo de todas las que la copian; si lo quitás en otra receta, sale sólo de esa.
  - **Costos Fijos:** agregar, renombrar o quitar un concepto.
  - **Insumos:** agregar o quitar artículos del consumo mensual de limpieza y descartables.
  Los renglones nuevos se insertan antes del último de su sección, así las sumas los incluyen solos.
- **Descargar Excel:** baja un .xlsx con los valores y las fórmulas actuales (sin los colores).
- **Reemplazar con un Excel** (discreto, al lado de Descargar) cambia todo lo de la web por lo del archivo; ya no hace falta usarlo.
- Las fórmulas las calcula HyperFormula (licencia GPLv3) y el Excel se lee con SheetJS; las dos se descargan sólo al abrir la pestaña. Se comprobó que las 868 fórmulas dan igual que en Excel.

## Catálogo web (pestaña Catálogo)

Es lo que ve el público en penitentia.com.ar. La web lo lee de Supabase (tabla `catalogo`); sin usuario sólo se pueden leer las pizzas tildadas y sólo nombre, descripción, precio, foto, stock y orden. Costos, márgenes y recetas no salen nunca.

- **Precios (desde el 03/11/2026):** se escriben a mano en cada ficha del Catálogo; Costos ya no los cambia. Para volver al precio automático: `PRECIO_DESDE_COSTOS = true` en `js/catalogo.js`. Antes: Cada vez que se guarda algo en Costos, el precio de venta de cada receta (Precios y Rentabilidad, cuadro 2) pasa al catálogo redondeado a $100 (8.750 → 8.800). Abajo aparece un aviso con lo que cambió. **Traer precios de Costos** hace lo mismo a mano.
- **Receta nueva en Costos:** aparece en Catálogo **oculta**. Escribile la descripción, subí la foto y tildá **Mostrar en la web**. Sin descripción no deja publicarla.
- **Renombrar una receta** en Costos no la desvincula. **Quitarla** la saca de la web y queda «Sin receta en Costos».
- **Sin receta en Costos:** el precio queda fijo. Se puede **vincular** con una receta nueva (la fila nueva se borra y esta toma su receta y su precio) o **quitar del catálogo**.
- **Mostrar en la web** y **Hay stock** van arriba de cada ficha. Sin stock: dejá «Mostrar en la web» tildado y apagá «Hay stock», así la pizza se sigue viendo con «Sin stock» y no se puede pedir. «Mostrar en la web» apagado la saca de la web (para recetas en preparación).
- **Nombre y descripción** se guardan al salir del campo. Las flechas cambian el orden en la web.
- **Fotos:** se recortan a 4:3 y se achican en el teléfono (800 y 480 px, WebP) antes de subir. Quedan en Supabase Storage, carpeta `catalogo` (pública: la web las muestra).
- **Respaldo:** si Supabase no responde (por ejemplo, si pausó el proyecto), la web muestra la última lista que vio ese navegador o, si nunca la vio, la de `js/productos.js`.
- **Primera vez:** pegá la parte «CATÁLOGO WEB» de `supabase.sql` en Supabase → SQL Editor → Run. Crea la tabla con las 7 variedades que había en la web y la carpeta de fotos.

## Precio de venta y revisión (03/11/2026)

- **Precio de venta:** al marcar una pizza vendida (por fila, por código o varias juntas) se guarda el precio que tenía publicado en el catálogo web en ese momento. Se ve en el estado («Vendida · 03/11/2026 · WhatsApp · $ 8.000»). «Deshacer» lo borra. Si la variedad no está en el catálogo, se vende igual, sin precio, y avisa.
- **En revisión:** para una pizza con la etiqueta dudosa (por ejemplo, si se mezclaron). El ícono de banderita en la fila o «A revisión» con varias elegidas la aparta; no cuenta como freezer ni como vendida. En el filtro **En revisión** (con el número de pizzas) se devuelve **Al freezer** o se marca **Vendida**.
- **Primera vez:** pegá la parte «PRECIO DE VENTA Y REVISIÓN» de `supabase.sql` en Supabase → SQL Editor → Run. Sin eso las ventas se guardan igual, pero sin precio.

## Prefermento (Costos → Recetas)

Cuadro justo debajo de **PRODUCCIÓN (¿cuánto necesito?)** del bollo (RECETA BASE Y PROPORCIONES queda más abajo), vinculado a sus totales: harina y agua en partes iguales (100 % del agua total) y levadura 4 g por kg de esa harina. La columna **Después** dice lo que falta agregar al amasar: el resto de la harina y de la levadura, y la sal. Las proporciones (100 %, 100 %, 4 g/kg) son celdas amarillas. La página lo agrega sola la primera vez que se abre Costos.

## Organización (desde el 12/11/2026)

- **Día a día:** Inicio, Producir, Stock y Ventas. **Gestión:** Prepizzas, Costos y Catálogo (en pantallas medianas y en el celular están dentro de **Más**).
- **Inicio:** lo primero al entrar. El freezer por variedad (cuántas hay, la primera en vencer y lo vendido en el mes; tocá una variedad para verla en Stock), **Para revisar** (vencidas, por vencer en 14 días, en revisión) y las ventas del mes con las últimas cinco.
- **Vender** (botón blanco de la barra, siempre a mano): abre la venta en curso. Se suman pizzas escaneando o escribiendo el código, con «Vendida» en cada pizza del Stock o eligiendo varias. Muestra el precio de la web de cada una y el total; se confirma con **Cliente** (sugiere los que ya compraron) y **Canal**. En la compu es una columna a la derecha; en el celular, una hoja que sube. Se puede cerrar y seguir: la venta queda armada.
- **Stock:** el freezer físico (En freezer, En revisión, De baja, Todas). Lo vendido está en Ventas.
- **Ventas:** por mes o todo, con totales por variedad y por cliente (tocá un cliente para ver sólo lo suyo). En cada venta se puede **cambiar el cliente** (lápiz) o **Anular** (la pizza vuelve al freezer). «Descargar para Excel» baja lo que se ve.
- **Prepizzas:** las ventas también tienen Cliente.
- **Primera vez:** pegá la parte «CLIENTE» de `supabase.sql` en Supabase → SQL Editor → Run. Sin eso se vende igual, pero sin guardar el cliente (avisa).
