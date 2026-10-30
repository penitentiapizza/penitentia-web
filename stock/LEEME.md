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
- **Agregar insumos e ingredientes:** en **Precios Insumos** hay un formulario para sumar un insumo nuevo (nombre, sección, unidad y precio). En **Recetas**, otro para sumar un ingrediente a una receta (cantidad por pizza y merma). El renglón se inserta antes del último de la sección o de la receta, así las sumas y los conteos del Tablero lo incluyen solos.
- **Descargar Excel:** baja un .xlsx con los valores y las fórmulas actuales (sin los colores).
- **Volver a cargar el Excel** reemplaza lo que hay en la web por lo del archivo.
- Las fórmulas las calcula HyperFormula (licencia GPLv3) y el Excel se lee con SheetJS; las dos se descargan sólo al abrir la pestaña. Se comprobó que las 868 fórmulas dan igual que en Excel.
