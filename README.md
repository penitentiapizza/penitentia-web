# Penitentia Pizza · Sitio web

Sitio estático (HTML + CSS + JS, sin dependencias) para **penitentia.com.ar**, publicado con GitHub Pages.

- Catálogo de pizzas congeladas con carrito.
- El carrito arma el pedido y lo abre en WhatsApp (261 725 2048).
- Contacto directo a WhatsApp, mail (penitentia.oficial@gmail.com) e Instagram (@penitentia.ar).
- Para Google y redes: `robots.txt`, `sitemap.xml`, datos estructurados (LocalBusiness) en `index.html`, imagen de vista previa `img/og.jpg` (1200 × 630) y una página `404.html` con la marca.
- Colores y tipografía según el Cuaderno de Marca v8: azul `#1D2E4A`, blanco, Brush Script MT para la firma y frases, Arial Bold / Regular para la información.

## Cambiar precios o variedades

Editá **`js/productos.js`**. Cada pizza tiene nombre, descripción, precio (número sin puntos) y foto. Poné `disponible: false` para marcarla "Sin stock".

Las fotos van en `img/` (proporción horizontal, ideal 800 × 470 px).

> Las frases en cursiva (logo, "Elegí tu sabor.", etc.) están en `img/*.svg`, convertidas a trazos desde Brush Script MT. Así se ven igual en cualquier celular aunque no tenga esa fuente instalada.

## Publicar en GitHub Pages

1. Creá un repositorio nuevo en GitHub (por ejemplo `penitentia-web`), **público**, sin README.
2. En esta carpeta:
   ```bash
   git remote add origin https://github.com/penitentiapizza/penitentia-web.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment**
   - Source: *Deploy from a branch*
   - Branch: `main` / `/ (root)` → Save
4. En **Settings → Pages → Custom domain** escribí `penitentia.com.ar` (el archivo `CNAME` ya está en el repo).
5. Cuando el DNS esté listo, tildá **Enforce HTTPS**.

### Si `https://` da error de certificado

GitHub emite el certificado cuando registra el dominio. Si quedó sin emitir (pasó el 21-oct-2026: `https://penitentia.com.ar` mostraba el certificado de `*.github.io`), hay dos caminos:

- **Con admin del repo:** Settings → Pages → Custom domain → quitar el dominio, guardar, volverlo a escribir y guardar. En unos minutos aparece el candado y se puede tildar *Enforce HTTPS*.
- **Con permiso de escritura solamente:** borrar el archivo `CNAME` en un commit, esperar a que Pages termine de construir (Settings → Pages dice «Your site is live»), y volver a crearlo en otro commit. Es lo mismo que lo anterior, porque Pages lee el dominio de ese archivo.

*Enforce HTTPS* (que `http://` redirija a `https://`) sólo lo puede tildar un admin. Mientras tanto, `index.html` tiene un script de dos líneas que hace esa redirección.

## Configurar el dominio .com.ar

NIC Argentina no guarda registros DNS: hay que **delegar** el dominio a un servicio de DNS. La opción gratis y simple es Cloudflare:

1. Creá una cuenta en Cloudflare → *Add a site* → `penitentia.com.ar` → plan Free.
2. Cloudflare te da 2 servidores de nombre (ej. `xxx.ns.cloudflare.com`).
3. En **nic.ar → Mis dominios → penitentia.com.ar → Delegaciones**, cargá esos 2 servidores.
4. En Cloudflare → DNS, creá estos registros (con la nube en **gris / DNS only**):

| Tipo  | Nombre | Valor                    |
|-------|--------|--------------------------|
| A     | @      | 185.199.108.153          |
| A     | @      | 185.199.109.153          |
| A     | @      | 185.199.110.153          |
| A     | @      | 185.199.111.153          |
| CNAME | www    | penitentiapizza.github.io |

La delegación puede tardar unas horas. Después volvé a GitHub Pages y activá *Enforce HTTPS*.

## Probar en tu compu

```bash
python -m http.server 8642
```
y abrí http://localhost:8642
