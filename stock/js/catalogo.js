/* =========================================================
   PENITENTIA · Catálogo web
   Lo que ve el público en penitentia.com.ar, manejado desde acá:
     - Precio: desde el 03/11/2026 se escribe a mano en cada ficha
       (PRECIO_DESDE_COSTOS = false). Con true, lo vuelve a poner Costos
       solo (Precios y Rentabilidad, cuadro 2, redondeado a $100).
     - Receta nueva en Costos → aparece acá oculta; se completa la
       descripción y la foto y se tilda «Mostrar en la web».
     - Nombre, descripción, foto, orden y «Hay stock» se editan acá.
   El público sólo lee las filas tildadas (ver «CATÁLOGO WEB» en supabase.sql).
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = window.DATOS;
  const { avisar } = window.STOCK;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pesos = n => (typeof n === "number" ? "$ " + n.toLocaleString("es-AR") : "—");
  /* «Jamón y Morrón» = «jamon y morron»: así se encuentran las recetas aunque cambien tildes o mayúsculas */
  const clave = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  const igual = (a, b) => clave(a) === clave(b);
  const slug = s => clave(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "pizza";
  /* Fotos guardadas como «img/…» son de la web: desde /stock/ se ven con «../» delante */
  const verFoto = f => (!f ? "" : /^(https?:|data:)/.test(f) ? f : "../" + f);

  /* Precio automático desde Costos: suspendido a pedido (el precio de venta lo decidís vos) */
  const PRECIO_DESDE_COSTOS = false;

  let filas = [];
  let cargado = false;

  /* =========================================================
     SINCRONIZAR CON COSTOS (lo llama costos.js al guardar)
     recetas: [{ receta, precio }] del cuadro 2, ya redondeado.
     cambios: { renombres: [[viejo, nuevo]], quitadas: [nombre] } hechos en Costos.
     ========================================================= */
  let corriendo = null;
  async function sincronizar(recetas, cambios = {}) {
    while (corriendo) await corriendo.catch(() => {});   // una por vez: dos guardados seguidos no crean filas repetidas
    corriendo = sincronizarYa(recetas, cambios);
    try { return await corriendo; } finally { corriendo = null; }
  }
  async function sincronizarYa(recetas, { renombres = [], quitadas = [] }) {
    const lista = await D.catalogo.listar();
    const res = { precios: [], nuevas: [], sinReceta: [] };
    const cambiar = async (f, campos) => Object.assign(f, await D.catalogo.actualizar(f.id, campos));

    for (const [viejo, nuevo] of renombres) {
      const f = lista.find(x => igual(x.receta, viejo));
      if (f) await cambiar(f, { receta: nuevo });
    }
    for (const nombre of quitadas) {
      const f = lista.find(x => igual(x.receta, nombre));
      if (f) { await cambiar(f, { receta: null, mostrar: false }); res.sinReceta.push(f.nombre); }
    }

    /* Filas cuya receta ya no figura en Costos: si hay una sola receta suelta que empieza igual
       («Agridulce» → «Agridulce de peras, miel y queso azul»), se vinculan; si no, quedan sin vincular */
    if (recetas.length) {
      const sueltas = () => recetas.filter(r => !lista.some(f => igual(f.receta, r.receta)));
      for (const f of lista.filter(x => x.receta && !recetas.some(r => igual(r.receta, x.receta)))) {
        const primera = clave(f.nombre).split(" ")[0];
        const cand = sueltas().filter(r => clave(r.receta).startsWith(primera));
        if (cand.length === 1) await cambiar(f, { receta: cand[0].receta });
        else { await cambiar(f, { receta: null }); res.sinReceta.push(f.nombre); }
      }
    }

    for (const r of recetas) {
      const f = lista.find(x => igual(x.receta, r.receta));
      if (f) {
        if (PRECIO_DESDE_COSTOS && r.precio !== null && f.precio !== r.precio) { res.precios.push({ nombre: f.nombre, antes: f.precio, despues: r.precio }); await cambiar(f, { precio: r.precio }); }
        continue;
      }
      let id = slug(r.receta), n = 2;
      while (lista.some(x => x.id === id)) id = slug(r.receta) + "-" + n++;
      const orden = Math.max(0, ...lista.map(x => x.orden || 0)) + 1;
      lista.push(await D.catalogo.crear({ id, receta: r.receta, nombre: r.receta, descripcion: "", precio: PRECIO_DESDE_COSTOS ? r.precio : null, foto: "", mostrar: false, disponible: true, orden }));
      res.nuevas.push(r.receta);
    }

    filas = lista.sort((x, y) => x.orden - y.orden || x.nombre.localeCompare(y.nombre));
    cargado = true;
    if (!$("#catalogo").hidden) pintar();
    return res;
  }

  /* Texto corto para el aviso de abajo */
  function resumen(res) {
    const partes = [];
    if (res.precios.length) partes.push(res.precios.length === 1
      ? `${res.precios[0].nombre} pasa de ${pesos(res.precios[0].antes)} a ${pesos(res.precios[0].despues)}`
      : `${res.precios.length} precios actualizados`);
    if (res.nuevas.length) partes.push(`${res.nuevas.length === 1 ? "receta nueva" : res.nuevas.length + " recetas nuevas"} en Catálogo (oculta${res.nuevas.length > 1 ? "s" : ""} hasta que la publiques)`);
    if (res.sinReceta.length) partes.push(`sin receta en Costos: ${res.sinReceta.join(", ")}`);
    return partes.length ? "Web: " + partes.join(" · ") + "." : "";
  }

  /* =========================================================
     PANEL
     ========================================================= */
  async function cargar() {
    try {
      filas = await D.catalogo.listar();
      cargado = true;
      $("#cat-falta").hidden = true;
    } catch (e) {
      $("#cat-falta").hidden = !e.faltaTabla;
      if (!e.faltaTabla) avisar("No se pudo leer el catálogo: " + e.message);
      filas = [];
    }
    pintar();
  }

  function pintar() {
    const publicadas = filas.filter(f => f.mostrar).length;
    $("#cat-cuenta").textContent = filas.length ? `${publicadas} de ${filas.length} en la web` : "";
    $("#cat-vacio").hidden = !cargado || filas.length > 0 || !$("#cat-falta").hidden;
    $("#cat-lista").innerHTML = filas.map((f, i) => {
      const foto = verFoto(f.foto);
      const libres = filas.filter(x => x !== f && x.receta && !x.mostrar && !x.descripcion && !x.foto);
      return `
      <article class="cat${f.mostrar ? "" : " cat--oculta"}" data-id="${esc(f.id)}">
        <button type="button" class="cat__foto${foto ? "" : " cat__foto--marca"}" data-foto aria-label="Cambiar la foto de ${esc(f.nombre)}">
          ${foto ? `<img src="${esc(foto)}" alt="" loading="lazy">` : `<img src="../img/logo-blanco.svg" alt="" width="97" height="40">`}
          <span class="cat__foto-txt">${foto ? "Cambiar foto" : "Subir foto"}</span>
        </button>
        <div class="cat__cuerpo">
          <div class="cat__cab">
            <label class="interruptor">
              <input type="checkbox" data-campo="mostrar"${f.mostrar ? " checked" : ""}>
              <span class="interruptor__pista" aria-hidden="true"></span>
              Mostrar en la web
            </label>
            <label class="interruptor">
              <input type="checkbox" data-campo="disponible"${f.disponible ? " checked" : ""}>
              <span class="interruptor__pista" aria-hidden="true"></span>
              Hay stock
            </label>
            <span class="cat__sello">${!f.mostrar ? "Oculta" : f.disponible ? "En la web" : "En la web · Sin stock"}</span>
          </div>
          <p class="cat__nota">${!f.mostrar
            ? "No aparece en la web. Si sólo te quedaste sin pizzas, tildá «Mostrar en la web» y apagá «Hay stock»: se sigue viendo, con «Sin stock»."
            : f.disponible ? "Se ve en la web y se puede pedir." : "Se ve en la web con «Sin stock» y no se puede agregar al pedido."}</p>
          <label class="campo campo--linea">
            <span>Nombre en la web</span>
            <input data-campo="nombre" value="${esc(f.nombre)}" maxlength="50" required>
          </label>
          <label class="campo campo--linea">
            <span>Descripción</span>
            <textarea data-campo="descripcion" rows="2" maxlength="160" placeholder="Ej. Salsa de tomate, mozzarella y …">${esc(f.descripcion)}</textarea>
          </label>
          <div class="cat__pie">
            ${PRECIO_DESDE_COSTOS ? `
            <p class="cat__precio">
              <b>${f.precio ? pesos(f.precio) : "Consultá el precio"}</b>
              <span>${f.receta ? `De Costos · ${esc(f.receta)}` : "Sin receta en Costos"}</span>
            </p>` : `
            <label class="campo campo--linea cat__precio cat__precio--mano">
              <span>Precio en la web $</span>
              <input data-campo="precio" inputmode="numeric" value="${f.precio ? f.precio.toLocaleString("es-AR") : ""}" placeholder="Sin precio" aria-label="Precio de ${esc(f.nombre)} en la web">
            </label>`}
            <div class="cat__orden" role="group" aria-label="Orden en la web">
              <button type="button" class="btn-icono" data-mover="-1" aria-label="Subir ${esc(f.nombre)}"${i === 0 ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>
              <button type="button" class="btn-icono" data-mover="1" aria-label="Bajar ${esc(f.nombre)}"${i === filas.length - 1 ? " disabled" : ""}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button>
            </div>
          </div>
          ${f.receta ? "" : `
          <div class="cat__suelta">
            <p>El precio no se actualiza porque no está vinculada a una receta de Costos.</p>
            ${libres.length ? `<label class="campo campo--linea"><span>Vincular con</span><select data-vincular><option value="">Elegí la receta…</option>${libres.map(x => `<option value="${esc(x.id)}">${esc(x.receta)}</option>`).join("")}</select></label>` : ""}
            <button type="button" class="btn-texto" data-quitar>Quitar del catálogo</button>
          </div>`}
        </div>
      </article>`;
    }).join("");
  }

  const filaDe = el => filas.find(f => f.id === el.closest(".cat").dataset.id);
  async function guardarCampos(f, campos, aviso) {
    try {
      Object.assign(f, await D.catalogo.actualizar(f.id, campos));
      if (aviso) avisar(aviso);
    } catch (e) { avisar("No se guardó: " + e.message); }
    pintar();
  }

  /* Textos: se guardan al salir del campo */
  $("#cat-lista").addEventListener("change", async e => {
    const el = e.target, f = filaDe(el), campo = el.dataset.campo;
    if (el.matches("[data-vincular]")) return vincular(f, el.value);
    if (!f || !campo) return;
    if (campo === "precio") {
      /* 13000, 13.000 o $ 13.000; vacío = «Consultá el precio» */
      const t = el.value.replace(/[$\s.]/g, "").replace(",", ".");
      const n = t === "" ? null : Math.round(Number(t));
      if (n !== null && (!Number.isFinite(n) || n <= 0)) { avisar("Escribí el precio en pesos, por ejemplo 13000."); el.value = f.precio ? f.precio.toLocaleString("es-AR") : ""; return; }
      if (n === f.precio) { el.value = n ? n.toLocaleString("es-AR") : ""; return; }
      return guardarCampos(f, { precio: n }, n ? `${f.nombre}: ${pesos(n)} en la web.` : `${f.nombre}: la web muestra «Consultá el precio».`);
    }
    if (campo === "nombre" || campo === "descripcion") {
      const v = el.value.trim().replace(/\s+/g, " ");
      if (campo === "nombre" && !v) { avisar("El nombre no puede quedar vacío."); el.value = f.nombre; return; }
      if (campo === "descripcion" && !v && f.mostrar) { avisar("Está en la web: escribí una descripción o desmarcá «Mostrar en la web»."); el.value = f.descripcion; return; }
      return guardarCampos(f, { [campo]: v }, "Guardado. La web lo muestra al recargar.");
    }
    if (campo === "mostrar" && el.checked && !f.descripcion.trim()) {
      el.checked = false;
      avisar("Antes de mostrarla, escribí la descripción.");
      $(`.cat[data-id="${CSS.escape(f.id)}"] [data-campo="descripcion"]`).focus();
      return;
    }
    if (campo === "mostrar") return guardarCampos(f, { mostrar: el.checked }, el.checked ? `${f.nombre} ya está en la web.` : `${f.nombre} ya no se ve en la web.`);
    if (campo === "disponible") return guardarCampos(f, { disponible: el.checked }, el.checked ? `${f.nombre}: con stock.` : `${f.nombre}: la web muestra «Sin stock».`);
  });

  $("#cat-lista").addEventListener("click", async e => {
    const b = e.target.closest("[data-mover], [data-foto], [data-quitar]");
    if (!b) return;
    const f = filaDe(b);
    if (b.matches("[data-foto]")) { fotoPara = f; $("#cat-archivo").click(); return; }
    if (b.matches("[data-quitar]")) {
      if (!window.confirm(`¿Quitar «${f.nombre}» del catálogo?\n\nNo toca Costos.`)) return;
      try { await D.catalogo.eliminar(f.id); filas = filas.filter(x => x !== f); avisar(`«${f.nombre}» quitada del catálogo.`); }
      catch (err) { avisar("No se pudo quitar: " + err.message); }
      return pintar();
    }
    /* Orden: se intercambia con la de al lado y se renumeran todas (1, 2, 3…) */
    const i = filas.indexOf(f), j = i + Number(b.dataset.mover);
    if (j < 0 || j >= filas.length) return;
    [filas[i], filas[j]] = [filas[j], filas[i]];
    pintar();
    const foco = $(`.cat[data-id="${CSS.escape(f.id)}"] [data-mover="${b.dataset.mover}"]`); if (foco && !foco.disabled) foco.focus();
    try { await Promise.all(filas.map((x, k) => (x.orden !== k + 1 ? D.catalogo.actualizar(x.id, { orden: k + 1 }).then(() => { x.orden = k + 1; }) : null))); }
    catch (err) { avisar("No se guardó el orden: " + err.message); }
  });

  /* Una fila sin receta toma la receta (y el precio) de una fila nueva que Costos creó sola, y esa se borra */
  async function vincular(f, idOtra) {
    const otra = filas.find(x => x.id === idOtra);
    if (!otra) return;
    try {
      await D.catalogo.eliminar(otra.id);
      filas = filas.filter(x => x !== otra);
      await guardarCampos(f, { receta: otra.receta, precio: otra.precio }, `${f.nombre} vinculada con la receta «${otra.receta}».`);
    } catch (e) { avisar("No se pudo vincular: " + e.message); pintar(); }
  }

  /* ---------- Fotos: se recortan a 4:3 y se achican en el teléfono antes de subir ---------- */
  let fotoPara = null;
  async function achicar(bmp, ancho, tipo) {
    const alto = Math.round(ancho * 3 / 4);
    const c = document.createElement("canvas");
    c.width = ancho; c.height = alto;
    const k = Math.max(ancho / bmp.width, alto / bmp.height), sw = ancho / k, sh = alto / k;
    c.getContext("2d").drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, ancho, alto);
    return new Promise((ok, mal) => c.toBlob(b => (b ? ok(b) : mal(new Error("No se pudo preparar la foto."))), tipo, .82));
  }
  $("#cat-archivo").addEventListener("change", async e => {
    const archivo = e.target.files[0]; e.target.value = "";
    const f = fotoPara; fotoPara = null;
    if (!archivo || !f) return;
    const caja = $(`.cat[data-id="${CSS.escape(f.id)}"] .cat__foto`);
    if (caja) caja.classList.add("subiendo");
    try {
      const bmp = await createImageBitmap(archivo, { imageOrientation: "from-image" });
      let grande = await achicar(bmp, 800, "image/webp"), chica = null, ext = "webp";
      if (grande.type === "image/webp") chica = await achicar(bmp, 480, "image/webp");
      else { grande = await achicar(bmp, 800, "image/jpeg"); ext = "jpg"; }   // navegadores que no arman WebP: una sola, en JPG
      const nombre = `${f.id}-${Date.now().toString(36)}${ext === "webp" ? "-800" : ""}.${ext}`;
      const url = await D.catalogo.subirFoto(nombre, grande, chica);
      await guardarCampos(f, { foto: url }, `Foto de ${f.nombre} actualizada.`);
    } catch (err) {
      avisar("No se pudo subir la foto: " + err.message);
      pintar();
    }
  });

  /* Trae los precios de Costos ahora (abre el libro de costos si hace falta) */
  $("#cat-traer").addEventListener("click", async e => {
    const b = e.currentTarget;
    b.disabled = true;
    try { await window.COSTOS.publicar(); }
    catch (err) { avisar(err.message); }
    finally { b.disabled = false; }
  });

  document.addEventListener("stock:vista", e => { if (e.detail === "catalogo") cargar(); });
  document.addEventListener("stock:salir", () => { filas = []; cargado = false; $("#cat-lista").innerHTML = ""; });

  window.CATALOGO = { sincronizar, resumen, precioAutomatico: PRECIO_DESDE_COSTOS };
  if (!PRECIO_DESDE_COSTOS) {
    $("#cat-traer").textContent = "Traer recetas nuevas de Costos";
    $("#cat-ayuda").innerHTML = "El <b>precio</b> de cada pizza se escribe acá y es el que se ve en la web (y con el que se registra cada venta). Costos ya no lo cambia. Una receta nueva de Costos aparece acá oculta y sin precio: escribile el precio y la descripción, subí la foto y tildá <b>Mostrar en la web</b>.";
  }
  if (!$("#catalogo").hidden) cargar();   // la sesión pudo abrir en Catálogo antes de que cargara este archivo
})();
