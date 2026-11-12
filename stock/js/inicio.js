/* =========================================================
   PENITENTIA · Inicio
   Lo del día de un vistazo: qué hay en el freezer (por variedad, con la
   primera en vencer y lo vendido en el mes), qué hay que revisar
   (vencidas, por vencer, en revisión) y las ventas del mes.
   Todo sale de las pizzas que ya cargó app.js; no lee nada extra.
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const S = window.STOCK;
  const { esc, pesos, fechaAR, fechaLocal, diasHasta } = S;
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const FLECHA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

  function pintar() {
    if ($("#inicio").hidden) return;
    const pizzas = S.pizzas();
    const hoy = S.hoyISO(), mes = hoy.slice(0, 7);
    const d = new Date(hoy + "T12:00:00");
    const dia = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    $("#inicio-fecha").textContent = dia.charAt(0).toUpperCase() + dia.slice(1);

    const enFreezer = pizzas.filter(p => p.estado === "stock");
    const vendidasMes = pizzas.filter(p => p.estado === "vendida" && p.vendida_el && fechaLocal(p.vendida_el).startsWith(mes));

    /* ---------- Freezer por variedad ---------- */
    $("#inicio-freezer").innerHTML = S.VAR.map(v => {
      const suyas = enFreezer.filter(p => p.variedad === v.id);
      const primera = suyas.map(p => p.vencimiento).sort()[0];
      const dias = primera ? diasHasta(primera) : null;
      const corta = primera ? fechaAR(primera).slice(0, 5) : "";   // 04/11: siempre dentro de los próximos meses
      const vence = !primera ? `<span class="tenue">—</span>`
        : dias < 0 ? `<span class="estado estado--vencida" title="Venció el ${fechaAR(primera)}">Vencida ${corta}</span>`
        : dias <= 14 ? `<span class="estado estado--pronto" title="Vence el ${fechaAR(primera)}">${corta} · ${dias === 0 ? "hoy" : `${dias} día${dias === 1 ? "" : "s"}`}</span>`
        : `<span title="${fechaAR(primera)}">${corta}</span>`;
      const vendidas = vendidasMes.filter(p => p.variedad === v.id).length;
      return `<tr class="${suyas.length ? "" : "fila--cero"}">
        <td><button type="button" class="fila-link" data-variedad="${v.id}" aria-label="Ver ${esc(v.nombre)} en el stock">${esc(v.nombre)}</button></td>
        <td class="num fila__num">${suyas.length}</td>
        <td>${vence}</td>
        <td class="num">${vendidas || `<span class="tenue">0</span>`}</td>
      </tr>`;
    }).join("");
    $("#inicio-freezer-total").innerHTML = `<tr><td>Total</td><td class="num fila__num">${enFreezer.length}</td><td></td><td class="num">${vendidasMes.length}</td></tr>`;

    /* ---------- Para revisar ---------- */
    const vencidas = enFreezer.filter(p => diasHasta(p.vencimiento) < 0).length;
    const pronto = enFreezer.filter(p => { const x = diasHasta(p.vencimiento); return x >= 0 && x <= 14; }).length;
    const revision = pizzas.filter(p => p.estado === "revision").length;
    const alertas = [
      vencidas && { txt: `<b>${vencidas}</b> vencida${vencidas > 1 ? "s" : ""} en el freezer`, ir: "stock" },
      pronto && { txt: `<b>${pronto}</b> vence${pronto > 1 ? "n" : ""} en los próximos 14 días`, ir: "stock" },
      revision && { txt: `<b>${revision}</b> en revisión (etiqueta dudosa)`, ir: "revision" },
    ].filter(Boolean);
    $("#inicio-alertas").innerHTML = alertas.length
      ? alertas.map(a => `<li><button type="button" class="alerta" data-estado="${a.ir}"><span>${a.txt}</span>${FLECHA}</button></li>`).join("")
      : `<li class="alertas__ok">Todo en orden: nada vencido, por vencer ni en revisión.</li>`;

    /* ---------- Ventas del mes ---------- */
    $("#inicio-mes").textContent = MESES[+mes.slice(5) - 1];
    const cobrado = vendidasMes.reduce((a, p) => a + (p.precio_venta || 0), 0);
    const clientes = new Set(vendidasMes.map(p => p.cliente).filter(Boolean)).size;
    $("#inicio-total").innerHTML = vendidasMes.length
      ? `<b>${vendidasMes.length}</b> pizza${vendidasMes.length > 1 ? "s" : ""}${cobrado ? ` · <b>${pesos(cobrado)}</b>` : ""}${clientes ? ` · ${clientes} cliente${clientes > 1 ? "s" : ""}` : ""}`
      : "Todavía no hay ventas este mes.";
    const ultimas = pizzas.filter(p => p.estado === "vendida" && p.vendida_el).sort((a, b) => b.vendida_el.localeCompare(a.vendida_el)).slice(0, 5);
    $("#inicio-ultimas").innerHTML = ultimas.map(p => `<li>
        <span class="ultimas__fecha">${fechaAR(fechaLocal(p.vendida_el)).slice(0, 5)}</span>
        <span class="ultimas__que"><b>${esc(S.porId[p.variedad]?.nombre ?? p.variedad)}</b>${p.cliente ? ` · ${esc(p.cliente)}` : ""}</span>
        <span class="ultimas__precio">${p.precio_venta ? pesos(p.precio_venta) : ""}</span>
      </li>`).join("");
  }

  /* ---------- Eventos ---------- */
  $("#inicio-freezer").addEventListener("click", e => { const b = e.target.closest("[data-variedad]"); if (b) S.verStock({ variedad: b.dataset.variedad }); });
  $("#inicio-alertas").addEventListener("click", e => { const b = e.target.closest("[data-estado]"); if (b) S.verStock({ estado: b.dataset.estado }); });
  $("#inicio-vender").addEventListener("submit", e => {
    e.preventDefault();
    const inp = $("#inicio-codigo");
    if (!inp.value.trim()) { window.VENTA.abrir(); return; }
    if (window.VENTA.agregarCodigo(inp.value)) inp.value = "";
  });

  document.addEventListener("stock:datos", pintar);
  document.addEventListener("stock:vista", e => { if (e.detail === "inicio") pintar(); });
  pintar();
})();
