/* =========================================================
   PENITENTIA · Ventas
   Las pizzas vendidas: cuándo, a quién, por qué canal y a qué precio
   (el publicado en la web al venderla). Por mes o todo, con totales por
   variedad y por cliente. El cliente se puede corregir después; una
   venta se puede anular (la pizza vuelve al freezer).
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const S = window.STOCK;
  const { esc, pesos, fechaAR, fechaLocal, avisar } = S;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const nombreMes = ym => { const [a, m] = ym.split("-"); return `${MESES[+m - 1][0].toUpperCase()}${MESES[+m - 1].slice(1)} ${a}`; };
  const clave = s => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

  let periodo = S.hoyISO().slice(0, 7);   // "2026-11" o "" para todo
  let cliente = "";
  let editando = null;

  const vendidas = () => S.pizzas().filter(p => p.estado === "vendida" && p.vendida_el);
  const delPeriodo = () => vendidas().filter(p => !periodo || fechaLocal(p.vendida_el).startsWith(periodo));
  const visibles = () => delPeriodo()
    .filter(p => !cliente || (cliente === "—" ? !p.cliente : clave(p.cliente).includes(clave(cliente))))
    .sort((a, b) => b.vendida_el.localeCompare(a.vendida_el));

  function pintarPeriodos() {
    const sel = $("#ventas-periodo");
    const meses = [...new Set([S.hoyISO().slice(0, 7), ...vendidas().map(p => fechaLocal(p.vendida_el).slice(0, 7))])].sort().reverse();
    sel.innerHTML = meses.map(ym => `<option value="${ym}">${nombreMes(ym)}</option>`).join("") + `<option value="">Todo</option>`;
    sel.value = periodo;
  }

  function corte(lista, llave, nombre) {
    const g = new Map();
    for (const p of lista) { const k = llave(p); const x = g.get(k) || { n: 0, total: 0 }; x.n++; x.total += p.precio_venta || 0; g.set(k, x); }
    return [...g.entries()].sort((a, b) => b[1].n - a[1].n || b[1].total - a[1].total).map(([k, x]) => ({ k, nombre: nombre(k), ...x }));
  }

  function pintar() {
    if ($("#ventas").hidden) return;
    pintarPeriodos();
    $("#ventas-falta").hidden = !S.faltan().includes("cliente");
    const base = delPeriodo();
    const lista = visibles();

    const cobrado = lista.reduce((a, p) => a + (p.precio_venta || 0), 0);
    const sinPrecio = lista.filter(p => !p.precio_venta).length;
    const nClientes = new Set(lista.map(p => p.cliente).filter(Boolean)).size;
    $("#ventas-total").innerHTML = lista.length
      ? `<b>${lista.length}</b> pizza${lista.length > 1 ? "s" : ""} vendida${lista.length > 1 ? "s" : ""}${cobrado ? ` · <b>${pesos(cobrado)}</b>` : ""}${nClientes ? ` · ${nClientes} cliente${nClientes > 1 ? "s" : ""}` : ""}${sinPrecio ? ` <span class="tenue">(${sinPrecio} sin precio)</span>` : ""}`
      : "";

    const fila = (nombre, x, attrs = "") => `<tr${attrs}><td>${nombre}</td><td class="num">${x.n}</td><td class="num">${x.total ? pesos(x.total) : ""}</td></tr>`;
    $("#ventas-variedad").innerHTML = corte(lista, p => p.variedad, k => esc(S.porId[k]?.nombre ?? k)).map(x => fila(x.nombre, x)).join("")
      || `<tr><td class="tenue">Sin ventas</td></tr>`;
    $("#ventas-clientes").innerHTML = corte(base, p => p.cliente || "—", k => (k === "—" ? "Sin indicar" : esc(k))).slice(0, 12)
      .map(x => fila(`<button type="button" class="fila-link" data-cliente="${esc(x.k)}" aria-pressed="${cliente === x.k}">${x.nombre}</button>`, x, cliente === x.k ? ' class="elegida"' : "")).join("")
      || `<tr><td class="tenue">Sin ventas</td></tr>`;

    $("#ventas-filas").innerHTML = lista.map(p => {
      const v = S.porId[p.variedad];
      const celdaCliente = editando === p.id
        ? `<input class="ventas__editar" list="lista-clientes" value="${esc(p.cliente || "")}" maxlength="80" aria-label="Cliente de ${p.codigo}" data-editar>`
        : `${p.cliente ? `<b>${esc(p.cliente)}</b>` : `<span class="tenue">Sin indicar</span>`}
           <button type="button" class="btn-icono btn-icono--chico" data-accion="cliente" aria-label="Cambiar el cliente de ${p.codigo}" title="Cambiar cliente">
             <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>
           </button>`;
      return `<tr data-id="${p.id}">
        <td class="col-fecha">${fechaAR(fechaLocal(p.vendida_el))}</td>
        <td class="col-pizza"><b>${esc(v?.nombre ?? p.variedad)}</b> <span class="tenue">${p.codigo}</span></td>
        <td class="col-cliente">${celdaCliente}</td>
        <td class="col-canal">${p.canal ? esc(p.canal) : `<span class="tenue">—</span>`}</td>
        <td class="num col-precio">${p.precio_venta ? pesos(p.precio_venta) : `<span class="tenue">—</span>`}</td>
        <td class="col-acc"><button type="button" class="btn-fila btn-fila--suave" data-accion="anular" title="La pizza vuelve al freezer">Anular</button></td>
      </tr>`;
    }).join("");
    const vacio = $("#ventas-vacio");
    vacio.hidden = lista.length > 0;
    if (!lista.length) vacio.innerHTML = cliente
      ? `<p>No hay ventas a «${esc(cliente === "—" ? "Sin indicar" : cliente)}» en este período.</p><button type="button" class="btn-texto" data-ver-todos>Ver todos los clientes</button>`
      : `<p>No hay ventas ${periodo ? "en " + nombreMes(periodo).toLowerCase() : "todavía"}.</p><button type="button" class="btn btn--azul" data-vender>Vender una pizza</button>`;
    const inp = $("#ventas-filas [data-editar]");
    if (inp) { inp.focus(); inp.select(); }
  }

  async function guardarCliente(id, valor) {
    editando = null;
    const nuevo = valor.trim().replace(/\s+/g, " ");
    const p = S.pizzas().find(x => x.id === id);
    if (!p || (p.cliente || "") === nuevo) return pintar();
    try { await S.cambiarCliente(id, nuevo); avisar(nuevo ? `${p.codigo}: vendida a ${nuevo}.` : `${p.codigo}: sin cliente.`); }
    catch (e) { avisar("No se guardó el cliente: " + e.message); pintar(); }
  }

  /* ---------- Eventos ---------- */
  $("#ventas-periodo").addEventListener("change", e => { periodo = e.target.value; pintar(); });
  $("#ventas-cliente").addEventListener("input", e => { cliente = e.target.value.trim(); pintar(); });
  $("#ventas-clientes").addEventListener("click", e => {
    const b = e.target.closest("[data-cliente]");
    if (!b) return;
    cliente = cliente === b.dataset.cliente ? "" : b.dataset.cliente;
    $("#ventas-cliente").value = cliente === "—" ? "" : cliente;
    pintar();
  });
  $("#ventas-vacio").addEventListener("click", e => {
    if (e.target.closest("[data-ver-todos]")) { cliente = ""; $("#ventas-cliente").value = ""; pintar(); }
    if (e.target.closest("[data-vender]")) window.VENTA.abrir();
  });
  $("#ventas-filas").addEventListener("click", async e => {
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const id = b.closest("tr").dataset.id;
    if (b.dataset.accion === "cliente") { editando = id; pintar(); return; }
    if (b.dataset.accion === "anular") {
      const p = S.pizzas().find(x => x.id === id);
      if (!window.confirm(`¿Anular la venta de ${p.codigo}${p.cliente ? " a " + p.cliente : ""}?\n\nLa pizza vuelve al freezer.`)) return;
      await S.cambiarEstado([id], "stock");
    }
  });
  $("#ventas-filas").addEventListener("keydown", e => {
    if (!e.target.matches("[data-editar]")) return;
    if (e.key === "Enter") { e.preventDefault(); guardarCliente(e.target.closest("tr").dataset.id, e.target.value); }
    if (e.key === "Escape") { editando = null; pintar(); }
  });
  $("#ventas-filas").addEventListener("focusout", e => {
    if (e.target.matches("[data-editar]") && editando) guardarCliente(e.target.closest("tr").dataset.id, e.target.value);
  });

  /* Descargar para Excel (CSV con ; y coma decimal) */
  $("#ventas-csv").addEventListener("click", () => {
    const lista = visibles().slice().reverse();
    if (!lista.length) return avisar("No hay ventas para descargar.");
    const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const filas = [["Fecha", "Código", "Variedad", "Cliente", "Canal", "Precio"]]
      .concat(lista.map(p => [fechaAR(fechaLocal(p.vendida_el)), p.codigo, S.porId[p.variedad]?.nombre ?? p.variedad, p.cliente, p.canal, p.precio_venta ?? ""]));
    const csv = "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Ventas ${periodo ? nombreMes(periodo) : "todo"}${cliente ? " - " + cliente : ""}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  document.addEventListener("stock:datos", pintar);
  document.addEventListener("stock:vista", e => { if (e.detail === "ventas") pintar(); });
  pintar();
})();
