/* =========================================================
   PENITENTIA · Stock y lotes
   Código de cada pizza: AAMMDD-XX-N
     AAMMDD = fecha del lote, XX = variedad, N = número de pizza de ese
     día y variedad (sigue contando si hacés otra tanda el mismo día).
   Vencimiento: 3 meses después de la fecha del lote.
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = window.DATOS;
  const VAR = window.VARIEDADES;
  const porId = Object.fromEntries(VAR.map(v => [v.id, v]));
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let pizzas = [];
  const filtro = { estado: "stock", variedad: "", texto: "" };
  const elegidas = new Set();

  /* ---------- Fechas ---------- */
  const hoyISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fechaAR = iso => (iso ? iso.split("-").reverse().join("/") : "—");
  function sumarMeses(iso, meses) {
    const [a, m, d] = iso.split("-").map(Number);
    const ultimo = new Date(Date.UTC(a, m - 1 + meses + 1, 0)).getUTCDate();   // 30-nov + 3 = 28-feb, no 2-mar
    const r = new Date(Date.UTC(a, m - 1 + meses, Math.min(d, ultimo)));
    return r.toISOString().slice(0, 10);
  }
  const diasHasta = iso => Math.round((Date.parse(iso) - Date.parse(hoyISO())) / 864e5);
  const prefijo = (iso, v) => iso.slice(2).replaceAll("-", "") + "-" + porId[v].codigo;

  /* ---------- Avisos ---------- */
  let tTostada;
  function avisar(texto, accion) {
    $("#tostada-texto").textContent = texto;
    const b = $("#tostada-accion");
    b.hidden = !accion;
    b.onclick = null;
    if (accion) { b.textContent = accion.texto; b.onclick = () => { ocultarTostada(); accion.fn(); }; }
    $("#tostada").hidden = false;
    requestAnimationFrame(() => $("#tostada").classList.add("visible"));
    clearTimeout(tTostada);
    tTostada = setTimeout(ocultarTostada, accion ? 7000 : 3800);
  }
  function ocultarTostada() { $("#tostada").classList.remove("visible"); setTimeout(() => { $("#tostada").hidden = true; }, 260); }

  /* ---------- Recordar el último peso de cada variedad ---------- */
  const pesoGuardado = id => { try { return localStorage.getItem("penitentia.peso." + id); } catch { return null; } };
  const guardarPeso = (id, g) => { try { localStorage.setItem("penitentia.peso." + id, g); } catch { /* nada */ } };

  /* =========================================================
     PRODUCIR
     ========================================================= */
  function pintarVariedades() {
    $("#variedades").innerHTML = VAR.map(v => {
      const peso = pesoGuardado(v.id) ?? v.peso;
      const foto = v.foto
        ? `<img src="${v.foto}" alt="" width="480" height="282" loading="lazy">`
        : `<span class="variedad__inicial" aria-hidden="true"><img src="../img/favicon.svg" alt=""></span>`;
      return `
      <li class="variedad" data-id="${v.id}">
        <div class="variedad__foto">${foto}</div>
        <div class="variedad__info">
          <h3>${esc(v.nombre)} <span class="variedad__codigo">${v.codigo}</span></h3>
          <p>${esc(v.propuesta)}</p>
          <p class="variedad__stock" data-stock></p>
        </div>
        <div class="variedad__control">
          <div class="cantidad" role="group" aria-label="Cantidad de ${esc(v.nombre)}">
            <button type="button" data-paso="-1" aria-label="Una menos">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>
            </button>
            <input type="number" inputmode="numeric" min="1" max="200" value="1" aria-label="Cantidad" data-cantidad>
            <button type="button" data-paso="1" aria-label="Una más">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12"/></svg>
            </button>
          </div>
          <label class="peso">
            <input type="number" inputmode="numeric" min="1" max="5000" placeholder="—" value="${esc(peso)}" data-peso aria-label="Contenido neto de ${esc(v.nombre)} en gramos">
            <span>g</span>
          </label>
          <button type="button" class="btn btn--azul btn--generar" data-generar>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>
            <span>Generar e imprimir</span>
          </button>
        </div>
      </li>`;
    }).join("");
  }

  function pintarStockVariedades() {
    $$(".variedad").forEach(li => {
      const enStock = pizzas.filter(p => p.variedad === li.dataset.id && p.estado === "stock");
      const proxima = enStock.map(p => p.vencimiento).sort()[0];
      li.querySelector("[data-stock]").innerHTML = enStock.length
        ? `<b>${enStock.length}</b> en el freezer · la primera vence el ${fechaAR(proxima)}`
        : "Sin pizzas en el freezer";
    });
  }

  function pintarVence() { $("#vence-lote").textContent = fechaAR(sumarMeses($("#fecha-lote").value || hoyISO(), window.MESES_VENCIMIENTO)); }

  async function generar(li, boton) {
    const id = li.dataset.id;
    const cant = Math.max(1, Math.min(200, parseInt(li.querySelector("[data-cantidad]").value, 10) || 1));
    const peso = parseInt(li.querySelector("[data-peso]").value, 10) || null;
    const fecha = $("#fecha-lote").value || hoyISO();
    if (peso) guardarPeso(id, peso);

    boton.disabled = true;
    boton.classList.add("cargando");
    let creadas;
    try {
      for (let intento = 0; intento < 3 && !creadas; intento++) {
        if (intento) pizzas = await D.listar();          // alguien más generó en el medio: recalcular
        const pre = prefijo(fecha, id);
        const ultimo = Math.max(0, ...pizzas.filter(p => p.codigo.startsWith(pre + "-")).map(p => p.numero));
        const nuevas = Array.from({ length: cant }, (_, i) => ({
          codigo: `${pre}-${ultimo + i + 1}`, variedad: id, fecha_lote: fecha, numero: ultimo + i + 1,
          vencimiento: sumarMeses(fecha, window.MESES_VENCIMIENTO), peso,
        }));
        try { creadas = await D.crear(nuevas); } catch (e) { if (!e.repetido) throw e; }
      }
      if (!creadas) throw new Error("No se pudo generar un código nuevo. Probá de nuevo.");
      creadas.sort((a, b) => a.numero - b.numero);
      pizzas = [...creadas, ...pizzas];
      refrescar();
      li.querySelector("[data-cantidad]").value = 1;
      const rango = creadas.length > 1 ? `${creadas[0].codigo} a ${creadas.at(-1).codigo}` : creadas[0].codigo;
      avisar(`${porId[id].nombre}: ${rango}`, { texto: "Ver etiquetas", fn: () => window.imprimirEtiquetas(creadas) });
    } catch (e) {
      avisar("No se guardó: " + e.message);
    } finally {
      boton.disabled = false;
      boton.classList.remove("cargando");
    }
    if (creadas) window.imprimirEtiquetas(creadas).catch(e => avisar("Se guardó, pero no se pudo imprimir: " + e.message));
  }

  $("#variedades").addEventListener("click", e => {
    const li = e.target.closest(".variedad");
    if (!li) return;
    const paso = e.target.closest("[data-paso]");
    if (paso) {
      const inp = li.querySelector("[data-cantidad]");
      inp.value = Math.max(1, Math.min(200, (parseInt(inp.value, 10) || 1) + Number(paso.dataset.paso)));
      actualizarBoton(li);
    }
    const gen = e.target.closest("[data-generar]");
    if (gen) generar(li, gen);
  });
  $("#variedades").addEventListener("input", e => { if (e.target.matches("[data-cantidad]")) actualizarBoton(e.target.closest(".variedad")); });
  function actualizarBoton(li) {
    const n = parseInt(li.querySelector("[data-cantidad]").value, 10) || 1;
    li.querySelector("[data-generar] span").textContent = n > 1 ? `Generar e imprimir ${n}` : "Generar e imprimir";
  }

  /* =========================================================
     STOCK
     ========================================================= */
  function estadoDe(p) {
    if (p.estado === "vendida") return { clase: "vendida", texto: "Vendida" + (p.vendida_el ? " · " + fechaAR(p.vendida_el.slice(0, 10)) : "") + (p.canal ? " · " + p.canal : "") };
    if (p.estado === "baja") return { clase: "baja", texto: "De baja" };
    const d = diasHasta(p.vencimiento);
    if (d < 0) return { clase: "vencida", texto: "Vencida" };
    if (d <= 14) return { clase: "pronto", texto: d === 0 ? "Vence hoy" : `Vence en ${d} día${d === 1 ? "" : "s"}` };
    return { clase: "stock", texto: "En freezer" };
  }

  function pintarResumen() {
    const enStock = pizzas.filter(p => p.estado === "stock");
    $("#num-stock").textContent = enStock.length;
    $("#resumen").innerHTML = VAR.map(v => {
      const suyas = enStock.filter(p => p.variedad === v.id);
      const vencidas = suyas.filter(p => diasHasta(p.vencimiento) < 0).length;
      const activa = filtro.variedad === v.id;
      return `<button type="button" class="resumen__item${suyas.length ? "" : " resumen__item--cero"}" data-variedad="${v.id}" aria-pressed="${activa}">
        <span class="resumen__num">${suyas.length}</span>
        <span class="resumen__nombre">${esc(v.nombre)}</span>
        ${vencidas ? `<span class="resumen__alerta">${vencidas} vencida${vencidas > 1 ? "s" : ""}</span>` : ""}
      </button>`;
    }).join("");
  }

  function visibles() {
    const t = filtro.texto.trim().toUpperCase();
    return pizzas
      .filter(p => !filtro.estado || p.estado === filtro.estado)
      .filter(p => !filtro.variedad || p.variedad === filtro.variedad)
      .filter(p => !t || p.codigo.includes(t) || fechaAR(p.fecha_lote).includes(t) || porId[p.variedad].nombre.toUpperCase().includes(t))
      .sort((a, b) => filtro.estado === "stock"
        ? a.vencimiento.localeCompare(b.vencimiento) || a.codigo.localeCompare(b.codigo, "es", { numeric: true })
        : b.creada_el.localeCompare(a.creada_el) || b.numero - a.numero);
  }

  function pintarTabla() {
    const lista = visibles();
    for (const id of elegidas) if (!lista.some(p => p.id === id)) elegidas.delete(id);
    $("#filas").innerHTML = lista.map(p => {
      const e = estadoDe(p);
      let acc = p.estado === "stock"
        ? `<button type="button" class="btn-fila" data-fila="vender">Vendida</button>`
        : `<button type="button" class="btn-fila btn-fila--suave" data-fila="stock">Deshacer</button>`;
      if (p.estado === "baja") acc += `
          <button type="button" class="btn-icono" data-fila="eliminar" aria-label="Eliminar definitivamente ${p.codigo}" title="Eliminar definitivamente">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>
          </button>`;
      return `<tr data-id="${p.id}" class="${elegidas.has(p.id) ? "elegida" : ""}">
        <td class="col-check"><input type="checkbox" ${elegidas.has(p.id) ? "checked" : ""} aria-label="Elegir ${p.codigo}"></td>
        <td class="col-codigo">${p.codigo}</td>
        <td class="col-variedad">${esc(porId[p.variedad]?.nombre ?? p.variedad)}</td>
        <td class="col-lote"><span class="sr-movil">Lote </span>${fechaAR(p.fecha_lote)}</td>
        <td class="col-vence"><span class="sr-movil">Vence </span>${fechaAR(p.vencimiento)}</td>
        <td class="col-estado"><span class="estado estado--${e.clase}">${e.texto}</span></td>
        <td class="col-acc">
          ${acc}
          <button type="button" class="btn-icono" data-fila="imprimir" aria-label="Imprimir etiqueta de ${p.codigo}" title="Imprimir etiqueta">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/></svg>
          </button>
        </td>
      </tr>`;
    }).join("");

    const vacio = $("#vacio");
    vacio.hidden = lista.length > 0;
    if (!lista.length) {
      vacio.innerHTML = pizzas.length
        ? `<p>No hay pizzas con estos filtros.</p><button type="button" class="btn-texto" data-limpiar-filtros>Ver todas</button>`
        : `<img src="../img/h-sale-azul.svg" alt="" width="1369" height="253"><p>Todavía no generaste ningún lote.</p><button type="button" class="btn btn--azul" data-ir="producir">Generar el primero</button>`;
    }
    $("#marcar-todas").checked = lista.length > 0 && lista.every(p => elegidas.has(p.id));
    pintarAcciones();
  }

  function pintarAcciones() {
    const n = elegidas.size;
    const barra = $("#acciones");
    barra.hidden = n === 0;
    $("#acciones-num").textContent = n === 1 ? "1 pizza elegida" : `${n} pizzas elegidas`;
    /* «Eliminar» sólo aparece si todas las elegidas están dadas de baja */
    $("[data-accion=eliminar]").hidden = !n || pizzas.some(p => elegidas.has(p.id) && p.estado !== "baja");
  }

  /* Borrar para siempre (sólo pizzas dadas de baja). No tiene «Deshacer», por eso pregunta antes. */
  async function eliminar(ids) {
    const lista = pizzas.filter(p => ids.includes(p.id) && p.estado === "baja");
    if (!lista.length) return;
    const que = lista.length === 1 ? `la pizza ${lista[0].codigo}` : `${lista.length} pizzas dadas de baja`;
    if (!window.confirm(`¿Eliminar definitivamente ${que}?\n\nSe borra del sistema y no se puede recuperar.`)) return;
    try {
      const borradas = await D.eliminar(lista.map(p => p.id));
      pizzas = pizzas.filter(p => !borradas.includes(p.id));
      borradas.forEach(id => elegidas.delete(id));
      refrescar();
      avisar(borradas.length === 1 ? `${lista[0].codigo} eliminada` : `${borradas.length} pizzas eliminadas`);
    } catch (e) { avisar("No se pudo eliminar: " + e.message); }
  }

  async function cambiarEstado(ids, estado, { silencio = false } = {}) {
    if (!ids.length) return;
    const antes = pizzas.filter(p => ids.includes(p.id)).map(p => ({ id: p.id, estado: p.estado, vendida_el: p.vendida_el, canal: p.canal }));
    const campos = estado === "vendida"
      ? { estado, vendida_el: new Date().toISOString(), canal: $("#canal").value || null }
      : { estado, vendida_el: null, canal: null };
    try {
      const cambiadas = await D.actualizar(ids, campos);
      const m = Object.fromEntries(cambiadas.map(p => [p.id, p]));
      pizzas = pizzas.map(p => m[p.id] ?? p);
      ids.forEach(id => elegidas.delete(id));
      refrescar();
      if (silencio) return;
      const que = { vendida: "vendida", stock: "de vuelta en el freezer", baja: "dada de baja" }[estado];
      const texto = ids.length === 1 ? `${m[ids[0]].codigo} ${que}` : `${ids.length} pizzas: ${que.replace("vendida", "vendidas").replace("dada", "dadas")}`;
      avisar(texto, { texto: "Deshacer", fn: () => deshacer(antes) });
    } catch (e) { avisar("No se guardó: " + e.message); }
  }

  async function deshacer(antes) {
    try {
      for (const a of antes) {
        const [p] = await D.actualizar([a.id], { estado: a.estado, vendida_el: a.vendida_el, canal: a.canal });
        pizzas = pizzas.map(x => (x.id === p.id ? p : x));
      }
      refrescar();
      avisar("Listo, quedó como antes.");
    } catch (e) { avisar("No se pudo deshacer: " + e.message); }
  }

  /* Vender escribiendo (o escaneando) el código */
  $("#form-vender").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("#codigo-vender");
    const cod = inp.value.trim().toUpperCase().replace(/\s+/g, "");
    if (!cod) { inp.focus(); return; }
    const p = pizzas.find(x => x.codigo === cod);
    if (!p) return avisar(`No existe el código ${cod}.`);
    if (p.estado === "vendida") return avisar(`${cod} ya figura vendida el ${fechaAR(p.vendida_el?.slice(0, 10))}.`);
    if (p.estado === "baja") return avisar(`${cod} está dada de baja.`);
    inp.value = "";
    cambiarEstado([p.id], "vendida");
    inp.focus();
  });

  $("#filas").addEventListener("click", e => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const id = tr.dataset.id;
    const b = e.target.closest("[data-fila]");
    if (b) {
      if (b.dataset.fila === "imprimir") window.imprimirEtiquetas(pizzas.filter(p => p.id === id));
      else if (b.dataset.fila === "eliminar") eliminar([id]);
      else cambiarEstado([id], b.dataset.fila === "vender" ? "vendida" : "stock");
      return;
    }
    if (e.target.matches("input[type=checkbox]") || e.target.closest(".col-codigo, .col-variedad")) {
      elegidas.has(id) ? elegidas.delete(id) : elegidas.add(id);
      pintarTabla();
    }
  });
  $("#marcar-todas").addEventListener("change", e => {
    visibles().forEach(p => (e.target.checked ? elegidas.add(p.id) : elegidas.delete(p.id)));
    pintarTabla();
  });

  $("#acciones").addEventListener("click", e => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const ids = [...elegidas];
    const a = b.dataset.accion;
    if (a === "limpiar") { elegidas.clear(); pintarTabla(); }
    else if (a === "imprimir") window.imprimirEtiquetas(pizzas.filter(p => elegidas.has(p.id)).sort((x, y) => x.codigo.localeCompare(y.codigo, "es", { numeric: true })));
    else if (a === "vender") cambiarEstado(ids.filter(id => pizzas.find(p => p.id === id).estado === "stock"), "vendida");
    else if (a === "eliminar") eliminar(ids);
    else cambiarEstado(ids, a);
  });

  $$(".segmentos button").forEach(b => b.addEventListener("click", () => {
    filtro.estado = b.dataset.estado;
    $$(".segmentos button").forEach(x => x.setAttribute("aria-pressed", x === b));
    elegidas.clear();
    pintarTabla();
  }));
  $("#filtro-variedad").innerHTML += VAR.map(v => `<option value="${v.id}">${esc(v.nombre)}</option>`).join("");
  $("#filtro-variedad").addEventListener("change", e => { filtro.variedad = e.target.value; pintarResumen(); pintarTabla(); });
  $("#resumen").addEventListener("click", e => {
    const b = e.target.closest("[data-variedad]");
    if (!b) return;
    filtro.variedad = filtro.variedad === b.dataset.variedad ? "" : b.dataset.variedad;
    $("#filtro-variedad").value = filtro.variedad;
    pintarResumen(); pintarTabla();
  });
  $("#buscar").addEventListener("input", e => { filtro.texto = e.target.value; pintarTabla(); });
  $("#vacio").addEventListener("click", e => {
    if (e.target.closest("[data-limpiar-filtros]")) {
      Object.assign(filtro, { estado: "", variedad: "", texto: "" });
      $("#buscar").value = ""; $("#filtro-variedad").value = "";
      $$(".segmentos button").forEach(x => x.setAttribute("aria-pressed", x.dataset.estado === ""));
      pintarResumen(); pintarTabla();
    }
  });

  /* =========================================================
     NAVEGACIÓN, INGRESO, ARRANQUE
     ========================================================= */
  function ir(vista) {
    $$(".vista").forEach(v => { v.hidden = v.id !== vista; });
    $$(".pestana").forEach(p => (p.dataset.ir === vista ? p.setAttribute("aria-current", "page") : p.removeAttribute("aria-current")));
    try { sessionStorage.setItem("penitentia.vista", vista); } catch { /* nada */ }
    window.scrollTo({ top: 0 });
  }
  document.addEventListener("click", e => { const b = e.target.closest("[data-ir]"); if (b) ir(b.dataset.ir); });

  function refrescar() { pintarStockVariedades(); pintarResumen(); pintarTabla(); }

  async function abrirSistema(sesion) {
    $("#ingreso").hidden = true;
    $("#sistema").hidden = false;
    $("#nombre-usuario").textContent = sesion.usuario;
    $("#chip-prueba").hidden = D.modo !== "prueba";
    try { pizzas = await D.listar(); } catch (e) { avisar("No se pudieron leer las pizzas: " + e.message); }
    refrescar();
    let vista = "producir";
    try { vista = sessionStorage.getItem("penitentia.vista") || vista; } catch { /* nada */ }
    ir(vista);
  }

  function abrirIngreso() {
    $("#sistema").hidden = true;
    $("#ingreso").hidden = false;
    $("#nota-prueba").hidden = D.modo !== "prueba";
    $("#form-ingreso [name=usuario]").focus();
  }

  $("#form-ingreso").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target;
    const err = $("#error-ingreso");
    const usuario = f.usuario.value.trim(), clave = f.clave.value;
    if (!usuario || !clave) { err.textContent = "Escribí tu usuario y tu contraseña."; err.hidden = false; return; }
    if (D.modo === "prueba" && !D.hayUsuario() && clave.length < 6) { err.textContent = "Elegí una contraseña de 6 caracteres o más."; err.hidden = false; return; }
    const btn = f.querySelector("button[type=submit]");
    btn.disabled = true; btn.classList.add("cargando");
    try {
      const s = await D.entrar(usuario, clave);
      err.hidden = true; f.reset();
      abrirSistema(s);
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      f.clave.select();
    } finally { btn.disabled = false; btn.classList.remove("cargando"); }
  });

  $("#btn-salir").addEventListener("click", async () => { await D.salir(); pizzas = []; elegidas.clear(); abrirIngreso(); });

  /* Arranque */
  $("#fecha-lote").value = hoyISO();
  $("#fecha-lote").max = hoyISO();
  $("#fecha-lote").addEventListener("change", pintarVence);
  pintarVariedades();
  pintarVence();

  const cfg = window.STOCK_CONFIG || {};
  if (cfg.SUPABASE_URL && !window.supabase) {
    document.body.innerHTML = '<p class="falla">No se pudo conectar con la base de datos. Revisá la conexión a internet y recargá la página.</p>';
    return;
  }
  D.sesion().then(s => (s ? abrirSistema(s) : abrirIngreso()));
})();
