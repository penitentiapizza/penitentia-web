/* =========================================================
   PENITENTIA · Prepizzas
   Movimientos cargados a mano para la contabilidad:
     - Producción: prepizzas hechas (suman al stock)
     - Venta: con precio por unidad y canal (restan, y suman a lo cobrado)
     - Pérdida: rotas, vencidas, regaladas (restan)
   El resultado se ve por mes o en total, y se descarga para Excel.
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = window.DATOS;
  const { avisar, hoyISO, fechaAR } = window.STOCK;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const TIPOS = { produccion: "Producción", venta: "Venta", perdida: "Pérdida" };
  const pesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const numero = new Intl.NumberFormat("es-AR");
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const nombreMes = ym => { const [a, m] = ym.split("-"); return `${MESES[+m - 1][0].toUpperCase()}${MESES[+m - 1].slice(1)} ${a}`; };

  let movimientos = [];
  let tipo = "produccion";
  let periodo = hoyISO().slice(0, 7);   // "2026-10" o "" para todo

  const total = m => (m.tipo === "venta" && m.precio_unitario != null ? m.cantidad * Number(m.precio_unitario) : null);
  const enPeriodo = () => movimientos.filter(m => !periodo || m.fecha.startsWith(periodo));
  const suma = (lista, t) => lista.filter(m => m.tipo === t).reduce((a, m) => a + m.cantidad, 0);

  /* ---------- Resultado ---------- */
  function pintarPeriodos() {
    const sel = $("#pp-periodo");
    const meses = [...new Set([hoyISO().slice(0, 7), ...movimientos.map(m => m.fecha.slice(0, 7))])].sort().reverse();
    sel.innerHTML = meses.map(ym => `<option value="${ym}">${nombreMes(ym)}</option>`).join("") + `<option value="">Todo</option>`;
    sel.value = periodo;
  }

  function pintarResumen() {
    const lista = enPeriodo();
    const enStock = suma(movimientos, "produccion") - suma(movimientos, "venta") - suma(movimientos, "perdida");
    const cobrado = lista.reduce((a, m) => a + (total(m) ?? 0), 0);
    const sinPrecio = lista.filter(m => m.tipo === "venta" && m.precio_unitario == null).length;
    const dato = (num, nombre, extra = "") => `<div class="resumen__item resumen__item--fijo"><span class="resumen__num">${num}</span><span class="resumen__nombre">${nombre}</span>${extra}</div>`;
    $("#pp-resumen").innerHTML =
      dato(numero.format(enStock), "En stock hoy", enStock < 0 ? `<span class="resumen__alerta">Revisá las cargas</span>` : "") +
      dato(numero.format(suma(lista, "produccion")), "Hechas") +
      dato(numero.format(suma(lista, "venta")), "Vendidas") +
      dato(numero.format(suma(lista, "perdida")), "Pérdidas") +
      dato(pesos.format(cobrado), "Cobrado", sinPrecio ? `<span class="resumen__alerta">${sinPrecio} venta${sinPrecio > 1 ? "s" : ""} sin precio</span>` : "");
  }

  function pintarLista() {
    const lista = enPeriodo();
    $("#pp-filas").innerHTML = lista.map(m => {
      const t = total(m);
      const detalle = [m.canal, m.nota].filter(Boolean).map(esc).join(" · ");
      return `<tr data-id="${m.id}">
        <td class="col-fecha">${fechaAR(m.fecha)}</td>
        <td><span class="mov mov--${m.tipo}">${TIPOS[m.tipo]}</span></td>
        <td class="num col-cant">${m.tipo === "produccion" ? "+" : "−"}${numero.format(m.cantidad)}</td>
        <td class="num">${m.precio_unitario != null ? pesos.format(m.precio_unitario) : ""}</td>
        <td class="num col-total">${t != null ? pesos.format(t) : ""}</td>
        <td class="col-detalle">${detalle}</td>
        <td class="col-acc">
          <button type="button" class="btn-icono" data-pp-borrar aria-label="Borrar movimiento del ${fechaAR(m.fecha)}" title="Borrar movimiento">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></svg>
          </button>
        </td>
      </tr>`;
    }).join("");
    $("#pp-vacio").hidden = lista.length > 0;
  }

  function pintar() { pintarPeriodos(); pintarResumen(); pintarLista(); }

  /* ---------- Formulario ---------- */
  function elegirTipo(t) {
    tipo = t;
    $$("#pp-form [data-tipo]").forEach(b => b.setAttribute("aria-checked", b.dataset.tipo === t));
    $$("#pp-form [data-solo-venta]").forEach(el => { el.hidden = t !== "venta"; });
    $("#pp-guardar").textContent = { produccion: "Guardar producción", venta: "Guardar venta", perdida: "Guardar pérdida" }[t];
    pintarTotal();
  }

  function pintarTotal() {
    const cant = parseInt($("#pp-cantidad").value, 10) || 0;
    const precio = parseFloat($("#pp-precio").value);
    $("#pp-total").innerHTML = cant && precio >= 0 ? `Total de la venta: <b>${pesos.format(cant * precio)}</b>` : "";
  }

  $("#pp-form").addEventListener("click", e => {
    const b = e.target.closest("[data-tipo]");
    if (b) elegirTipo(b.dataset.tipo);
    const paso = e.target.closest("[data-pp-paso]");
    if (paso) {
      const inp = $("#pp-cantidad");
      inp.value = Math.max(1, Math.min(10000, (parseInt(inp.value, 10) || 1) + Number(paso.dataset.ppPaso)));
      pintarTotal();
    }
  });
  $("#pp-form").addEventListener("input", e => { if (e.target.matches("#pp-cantidad, #pp-precio")) pintarTotal(); });

  $("#pp-form").addEventListener("submit", async e => {
    e.preventDefault();
    const cantidad = parseInt($("#pp-cantidad").value, 10);
    const fecha = $("#pp-fecha").value || hoyISO();
    const precioTxt = $("#pp-precio").value.trim();
    if (!cantidad || cantidad < 1) { avisar("Poné una cantidad de 1 o más."); $("#pp-cantidad").focus(); return; }
    if (tipo === "venta" && precioTxt !== "" && !(parseFloat(precioTxt) >= 0)) { avisar("El precio tiene que ser un número."); $("#pp-precio").focus(); return; }
    const m = {
      fecha, tipo, cantidad,
      precio_unitario: tipo === "venta" && precioTxt !== "" ? Math.round(parseFloat(precioTxt) * 100) / 100 : null,
      canal: tipo === "venta" ? ($("#pp-canal").value || null) : null,
      nota: $("#pp-nota").value.trim() || null,
    };
    const btn = $("#pp-guardar");
    btn.disabled = true; btn.classList.add("cargando");
    try {
      const nuevo = await D.prepizzas.crear(m);
      movimientos = [nuevo, ...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_el.localeCompare(a.creado_el));
      if (periodo && !fecha.startsWith(periodo)) periodo = fecha.slice(0, 7);
      pintar();
      $("#pp-cantidad").value = 1; $("#pp-nota").value = "";
      pintarTotal();
      avisar(`${TIPOS[tipo]}: ${numero.format(cantidad)} prepizza${cantidad > 1 ? "s" : ""} el ${fechaAR(fecha)}`);
    } catch (err) {
      avisar("No se guardó: " + err.message);
    } finally { btn.disabled = false; btn.classList.remove("cargando"); }
  });

  /* ---------- Borrar un movimiento (para corregir un error de carga) ---------- */
  $("#pp-filas").addEventListener("click", async e => {
    if (!e.target.closest("[data-pp-borrar]")) return;
    const id = e.target.closest("tr").dataset.id;
    const m = movimientos.find(x => x.id === id);
    if (!m || !window.confirm(`¿Borrar este movimiento?\n\n${TIPOS[m.tipo]} de ${m.cantidad} prepizza${m.cantidad > 1 ? "s" : ""} del ${fechaAR(m.fecha)}.`)) return;
    try {
      await D.prepizzas.eliminar(id);
      movimientos = movimientos.filter(x => x.id !== id);
      pintar();
      avisar("Movimiento borrado");
    } catch (err) { avisar("No se pudo borrar: " + err.message); }
  });

  $("#pp-periodo").addEventListener("change", e => { periodo = e.target.value; pintarResumen(); pintarLista(); });

  /* ---------- Descargar para Excel (CSV con ; y coma decimal) ---------- */
  $("#pp-csv").addEventListener("click", () => {
    const lista = enPeriodo().slice().reverse();
    if (!lista.length) return avisar("No hay movimientos para descargar.");
    const dec = n => (n == null ? "" : String(n).replace(".", ","));
    const celda = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const filas = [["Fecha", "Movimiento", "Cantidad", "Precio por unidad", "Total", "Canal", "Nota"]]
      .concat(lista.map(m => [fechaAR(m.fecha), TIPOS[m.tipo], m.tipo === "produccion" ? m.cantidad : -m.cantidad, dec(m.precio_unitario), dec(total(m)), m.canal, m.nota]));
    const csv = "﻿" + filas.map(f => f.map(celda).join(";")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `Prepizzas ${periodo ? nombreMes(periodo) : "todo"}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- Cargar al entrar ---------- */
  async function cargar() {
    $("#pp-fecha").value = hoyISO();
    $("#pp-fecha").max = hoyISO();
    try {
      movimientos = await D.prepizzas.listar();
      $("#pp-falta").hidden = true;
    } catch (err) {
      movimientos = [];
      $("#pp-falta").hidden = !err.faltaTabla;
      if (!err.faltaTabla) avisar("No se pudieron leer las prepizzas: " + err.message);
    }
    pintar();
  }

  elegirTipo("produccion");
  document.addEventListener("stock:sesion", cargar);
  document.addEventListener("stock:salir", () => { movimientos = []; pintar(); });
  if (!$("#sistema").hidden) cargar();   // por si la sesión se abrió antes de cargar este archivo
})();
