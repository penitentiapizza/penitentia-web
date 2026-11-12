/* =========================================================
   PENITENTIA · Venta en curso
   Un panel que se arma de a una pizza o varias (una venta = un cliente):
     - por código (se escribe o se escanea), desde el botón «Vender» de
       arriba o desde Inicio;
     - con «Vendida» en cada pizza del Stock o eligiendo varias.
   Muestra el precio publicado en la web de cada una y el total, y se
   confirma con a quién se vendió y por qué canal.
   No es una ventana que bloquea: se puede cerrar, seguir mirando el
   stock y volver; la venta queda armada hasta confirmarla o vaciarla.
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const S = window.STOCK;
  const { esc, pesos, avisar } = S;

  let items = [];          // ids de pizzas
  let precios = {};        // precio publicado por variedad (se lee al abrir)
  let leyendoPrecios = null;
  const CLAVE_CANAL = "penitentia.venta.canal";

  const pizza = id => S.pizzas().find(p => p.id === id);
  const vendible = p => p && (p.estado === "stock" || p.estado === "revision");

  async function leerPrecios() {
    if (!leyendoPrecios) leyendoPrecios = S.preciosPublicados().then(r => { precios = r; }).catch(() => { precios = {}; }).finally(() => { leyendoPrecios = null; pintar(); });
    return leyendoPrecios;
  }

  function abrir({ foco = "codigo" } = {}) {
    const panel = $("#venta");
    if (panel.hidden) { panel.hidden = false; document.body.classList.add("con-venta"); leerPrecios(); }
    pintar();
    (foco === "cliente" && items.length ? $("#venta-cliente") : $("#venta-cod")).focus();
  }
  function cerrar() {
    $("#venta").hidden = true;
    document.body.classList.remove("con-venta");
    $("#btn-vender").focus();
  }

  /* Suma pizzas a la venta; devuelve cuántas entraron */
  function agregar(ids, { abrirPanel = true } = {}) {
    let n = 0, motivo = "";
    for (const id of ids) {
      const p = pizza(id);
      if (!vendible(p)) { motivo = p ? `${p.codigo} está ${p.estado === "vendida" ? "vendida" : "dada de baja"}.` : ""; continue; }
      if (items.includes(id)) { motivo = `${p.codigo} ya está en la venta.`; continue; }
      items.push(id); n++;
    }
    if (motivo && !n) avisar(motivo);
    if (abrirPanel) abrir({ foco: n ? "cliente" : "codigo" });
    else pintar();
    return n;
  }

  function agregarCodigo(texto) {
    const cod = String(texto || "").trim().toUpperCase().replace(/\s+/g, "");
    if (!cod) return false;
    const p = S.pizzas().find(x => x.codigo === cod);
    if (!p) { avisar(`No existe el código ${cod}.`); return false; }
    if (p.estado === "vendida") { avisar(`${cod} ya figura vendida${p.vendida_el ? " el " + S.fechaAR(S.fechaLocal(p.vendida_el)) : ""}${p.cliente ? " a " + p.cliente : ""}.`); return false; }
    if (p.estado === "baja") { avisar(`${cod} está dada de baja.`); return false; }
    return agregar([p.id], { abrirPanel: true }) > 0;
  }

  function pintar() {
    items = items.filter(id => vendible(pizza(id)));   // si algo cambió mientras tanto (otra pestaña, deshacer)
    const lista = items.map(pizza);
    const n = lista.length;
    const num = $("#num-venta");
    num.textContent = n; num.hidden = !n;
    $("#venta-cuenta").textContent = n ? `${n} pizza${n > 1 ? "s" : ""}` : "";
    $("#venta-vacia").hidden = n > 0;
    $("#venta-items").innerHTML = lista.map(p => {
      const v = S.porId[p.variedad];
      const pr = precios[p.variedad];
      return `<li data-id="${p.id}">
        <span class="venta__nombre">${esc(v?.nombre ?? p.variedad)}</span>
        <span class="venta__cod">${p.codigo}${p.estado === "revision" ? " · en revisión" : ""}</span>
        <span class="venta__precio">${pr ? pesos(pr) : leyendoPrecios ? "…" : "sin precio"}</span>
        <button type="button" class="btn-icono" data-quitar aria-label="Quitar ${p.codigo} de la venta" title="Quitar">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        </button>
      </li>`;
    }).join("");
    const total = lista.reduce((a, p) => a + (precios[p.variedad] || 0), 0);
    $("#venta-total").textContent = n ? (total ? pesos(total) : "—") : "—";
    $("#venta-confirmar").disabled = !n;
    $("#venta-vaciar").hidden = !n;
  }

  async function confirmar() {
    if (!items.length) return;
    const b = $("#venta-confirmar");
    b.disabled = true; b.classList.add("cargando");
    const cliente = $("#venta-cliente").value.trim().replace(/\s+/g, " ");
    const canal = $("#venta-canal").value;
    try { localStorage.setItem(CLAVE_CANAL, canal); } catch { /* nada */ }
    const ok = await S.cambiarEstado([...items], "vendida", { cliente, canal });
    b.classList.remove("cargando");
    if (ok) {
      items = [];
      $("#venta-cliente").value = "";
      $("#venta").hidden = true;
      document.body.classList.remove("con-venta");
    }
    pintar();
  }

  /* ---------- Eventos ---------- */
  $("#btn-vender").addEventListener("click", () => ($("#venta").hidden ? abrir() : cerrar()));
  $("#venta-cerrar").addEventListener("click", cerrar);
  $("#venta-codigo").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("#venta-cod");
    if (agregarCodigo(inp.value)) inp.value = "";
    inp.focus();
  });
  $("#venta-items").addEventListener("click", e => {
    const li = e.target.closest("[data-quitar]")?.closest("li");
    if (!li) return;
    items = items.filter(id => id !== li.dataset.id);
    pintar();
    $("#venta-cod").focus();
  });
  $("#venta-vaciar").addEventListener("click", () => { items = []; pintar(); $("#venta-cod").focus(); });
  $("#venta-confirmar").addEventListener("click", confirmar);
  $("#venta-cliente").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); confirmar(); } });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#venta").hidden && !document.querySelector(".previa:not([hidden])")) cerrar(); });

  document.addEventListener("stock:datos", pintar);
  document.addEventListener("stock:salir", () => { items = []; $("#venta").hidden = true; document.body.classList.remove("con-venta"); pintar(); });

  try { const c = localStorage.getItem(CLAVE_CANAL); if (c !== null) $("#venta-canal").value = c; } catch { /* nada */ }

  window.VENTA = { agregar, agregarCodigo, abrir };
  pintar();
})();
