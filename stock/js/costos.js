/* =========================================================
   PENITENTIA · Costos
   Las pestañas del Excel «Costos Penitentia», con las mismas fórmulas
   vinculadas entre sí: si cambiás un precio en Precios Insumos se
   recalculan Insumos, Recetas, Costos Fijos y Variables, Precios y
   Rentabilidad y el Tablero, igual que en Excel.

   - El Excel se carga una vez con «Cargar Excel» (se lee en el navegador
     con SheetJS) y se guarda en Supabase, sólo visible con usuario.
     En el código de la página no hay ni un precio.
   - Las fórmulas las calcula HyperFormula (licencia GPLv3), que da los
     mismos resultados que Excel: se comprobaron las 868 fórmulas.
   - Se editan las celdas amarillas (y los números de las celdas color
     crema, como «Cantidad de pizzas»), igual que en el Excel.
   ========================================================= */

(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const D = window.DATOS;
  const { avisar } = window.STOCK;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const LIBS = {
    XLSX: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    HyperFormula: "https://cdn.jsdelivr.net/npm/hyperformula@2.7.1/dist/hyperformula.full.min.js",
  };

  /* Colores de relleno del Excel → estilo en la web (se respeta lo que significa cada uno) */
  const RELLENOS = {
    "17324D": "c-titulo", "254B6E": "c-cab", "446C55": "c-total", "3F6B54": "c-total",
    "E8EEF3": "c-seccion", "F7F2EA": "c-nota", "FFF2CC": "c-editable",
    "EEF6F0": "c-calc", "EAF4EC": "c-calc", "EAF2F8": "c-kpi", "FCE9DF": "c-kpi", "E5F1E8": "c-kpi",
    "FFFFFF": "", "FAFBFC": "c-par",
  };
  /* Ajustes por pestaña: columnas auxiliares que sólo alimentan gráficos, y dónde van los gráficos */
  const AJUSTES = {
    Tablero: { hastaCol: 11, graficos: { 17: ["costoPrecio", "margen"], 34: ["fijos", "insumos"] } },
  };

  let modelo = null;     // { version, archivo, importado_el, hojas: [{ nombre, filas, cols, anchos, merges, celdas }] }
  let hf = null;
  let hojaActual = null;
  let cargando = null;
  let tGuardar = null;

  /* ---------- Bibliotecas (se bajan sólo al abrir Costos) ---------- */
  const cargarScript = src => new Promise((ok, mal) => {
    const s = document.createElement("script");
    s.src = src; s.onload = ok; s.onerror = () => mal(new Error("No se pudo descargar " + src.split("/")[2] + ". Revisá la conexión."));
    document.head.append(s);
  });
  async function bibliotecas() {
    for (const [global, src] of Object.entries(LIBS)) if (!window[global]) await cargarScript(src);
  }

  /* ---------- Direcciones de celda ---------- */
  const letra = c => { let s = ""; for (c++; c > 0; c = Math.floor((c - 1) / 26)) s = String.fromCharCode(65 + (c - 1) % 26) + s; return s; };
  const dir = (r, c) => letra(c) + (r + 1);

  /* Excel acepta FALSE/TRUE sueltos (en BUSCARV); HyperFormula los necesita como FALSE()/TRUE() */
  const normalizar = f => f.split(/("[^"]*")/).map((t, i) => (i % 2 ? t : t.replace(/\b(TRUE|FALSE)\b(?!\s*\()/g, "$1()"))).join("");

  /* ---------- Excel → modelo ---------- */
  function leerExcel(buf, nombreArchivo) {
    const wb = XLSX.read(buf, { cellFormula: true, cellStyles: true, cellNF: true });
    const hojas = wb.SheetNames.map(nombre => {
      const ws = wb.Sheets[nombre];
      const r = XLSX.utils.decode_range(ws["!ref"] || "A1");
      const celdas = {};
      for (let f = 0; f <= r.e.r; f++) for (let c = 0; c <= r.e.c; c++) {
        const x = ws[XLSX.utils.encode_cell({ r: f, c })];
        if (!x) continue;
        const cel = {};
        if (x.f) cel.f = x.f;
        if (x.t !== "e" && x.v !== undefined) cel.v = x.v;
        if (x.z && x.z !== "General") cel.z = x.z;
        const rgb = x.s && x.s.patternType === "solid" && x.s.fgColor && x.s.fgColor.rgb;
        if (rgb) cel.c = rgb.slice(-6).toUpperCase();
        if (Object.keys(cel).length) celdas[dir(f, c)] = cel;
      }
      return {
        nombre, filas: r.e.r + 1, cols: r.e.c + 1,
        anchos: (ws["!cols"] || []).map(k => (k && k.wch ? Math.round(k.wch * 7 + 10) : null)),
        merges: (ws["!merges"] || []).map(m => XLSX.utils.encode_range(m)),
        celdas,
      };
    });
    return { version: 1, archivo: nombreArchivo, importado_el: new Date().toISOString(), hojas };
  }

  /* ---------- Modelo → motor de fórmulas ---------- */
  function contenido(cel) {
    if (!cel) return null;
    if (cel.f) return "=" + normalizar(cel.f);
    return cel.v ?? null;
  }
  function armarMotor() {
    hf = HyperFormula.buildEmpty({ licenseKey: "gpl-v3" });
    for (const h of modelo.hojas) hf.addSheet(h.nombre);   // primero todas, así las referencias entre hojas existen
    hf.batch(() => {
      for (const h of modelo.hojas) {
        const m = Array.from({ length: h.filas }, () => Array(h.cols).fill(null));
        for (const [a, cel] of Object.entries(h.celdas)) {
          const { r: row, c: col } = XLSX.utils.decode_cell(a);
          m[row][col] = contenido(cel);
        }
        hf.setSheetContent(hf.getSheetId(h.nombre), m);
      }
    });
  }
  const valor = (hoja, r, c) => hf.getCellValue({ sheet: hf.getSheetId(hoja), row: r, col: c });

  /* ---------- Formato de números, como en el Excel ---------- */
  function mostrar(v, z) {
    if (v === null || v === undefined || v === "") return "";
    if (typeof v === "object" && v.type) return `<span class="c-error" title="${esc(v.message || "")}">${esc(v.value || "#¡ERROR!")}</span>`;
    if (typeof v === "number") {
      let t;
      try { t = XLSX.SSF.format(z || "General", v); } catch { t = String(v); }
      if (!z || z === "General") t = Number.isInteger(v) ? v.toLocaleString("es-AR") : v.toLocaleString("es-AR", { maximumFractionDigits: 4 });
      else t = t.replace(/[.,]/g, ch => (ch === "." ? "," : ".")).replace(/^\$\s?/, "$ ").replace(/^-\$\s?/, "-$ ");
      return esc(t.trim());
    }
    if (typeof v === "boolean") return v ? "VERDADERO" : "FALSO";
    return esc(v);
  }

  const esEditable = cel => !!cel && (cel.c === "FFF2CC" || (cel.c === "F7F2EA" && !cel.f && typeof cel.v === "number"));

  /* ---------- Dibujar una pestaña ---------- */
  function dibujarHoja(nombre, { marcarCambios = null } = {}) {
    const h = modelo.hojas.find(x => x.nombre === nombre) || modelo.hojas[0];
    hojaActual = h.nombre;
    try { sessionStorage.setItem("penitentia.costos.hoja", h.nombre); } catch { /* nada */ }
    $$("#costos-hojas button").forEach(b => b.setAttribute("aria-current", b.dataset.hoja === h.nombre ? "page" : "false"));
    mostrarElegido($("#costos-hojas"));

    const aj = AJUSTES[h.nombre] || {};
    const ultCol = Math.min(h.cols - 1, aj.hastaCol ?? h.cols - 1);
    const tapadas = new Set(); const spans = {}; const filasCombinadas = new Set();
    for (const m of h.merges) {
      const r = XLSX.utils.decode_range(m);
      if (r.e.r > r.s.r) for (let f = r.s.r; f <= r.e.r; f++) filasCombinadas.add(f);
      spans[dir(r.s.r, r.s.c)] = { rs: r.e.r - r.s.r + 1, cs: Math.min(r.e.c, ultCol) - r.s.c + 1 };
      for (let f = r.s.r; f <= r.e.r; f++) for (let c = r.s.c; c <= r.e.c; c++) if (f !== r.s.r || c !== r.s.c) tapadas.add(dir(f, c));
    }
    const anchos = Array.from({ length: ultCol + 1 }, (_, c) => h.anchos[c] || 72);
    let html = `<table class="hoja" style="width:${anchos.reduce((a, b) => a + b, 0)}px"><colgroup>${anchos.map(w => `<col style="width:${w}px">`).join("")}</colgroup><tbody>`;

    for (let r = 0; r < h.filas; r++) {
      let fila = "", llena = false;
      const vacia = cc => { const x = h.celdas[dir(r, cc)]; return !x || (!x.f && (x.v === undefined || x.v === null || x.v === "") && !esEditable(x)); };
      for (let c = 0; c <= ultCol; c++) {
        const a = dir(r, c);
        if (tapadas.has(a)) continue;
        const cel = h.celdas[a];
        let sp = spans[a];
        const v = cel ? (cel.f ? valor(h.nombre, r, c) : cel.v) : null;
        /* Como en Excel: un texto se extiende sobre las celdas vacías de al lado */
        if (!sp && typeof v === "string" && v && !esEditable(cel)) {
          let n = 0;
          while (c + n + 1 <= ultCol && !tapadas.has(dir(r, c + n + 1)) && !spans[dir(r, c + n + 1)] && vacia(c + n + 1)) n++;
          if (n) { sp = { rs: 1, cs: n + 1 }; for (let k = 1; k <= n; k++) tapadas.add(dir(r, c + k)); }
        }
        if (cel && (v !== null && v !== "" || cel.c)) llena = true;
        const clases = [RELLENOS[cel?.c] ?? "", typeof v === "number" ? "num" : ""];
        let estilo = "";
        if (cel?.c && !(cel.c in RELLENOS)) estilo = ` style="background:#${cel.c}"`;
        if (sp && sp.cs > 1 && cel && typeof v === "string" && v.length > 30) clases.push("c-texto");
        const ed = esEditable(cel);
        if (ed) clases.push("c-editable");
        const cambio = marcarCambios && marcarCambios.has(a) ? " c-cambio" : "";
        const attrs = `${sp ? `${sp.rs > 1 ? ` rowspan="${sp.rs}"` : ""}${sp.cs > 1 ? ` colspan="${sp.cs}"` : ""}` : ""}${ed ? ` tabindex="0" data-dir="${a}" aria-label="${esc(etiqueta(h, r, c))}"` : ""}`;
        fila += `<td class="${clases.filter(Boolean).join(" ")}${cambio}"${attrs}${estilo}>${mostrar(v, cel?.z)}</td>`;
      }
      if (llena || filasCombinadas.has(r)) html += `<tr>${fila}</tr>`;
      if (aj.graficos && aj.graficos[r]) html += `<tr class="fila-graficos"><td colspan="${ultCol + 1}"><div class="graficos">${aj.graficos[r].map(g => GRAFICOS[g](h.nombre)).join("")}</div></td></tr>`;
    }
    html += "</tbody></table>";
    $("#costos-hoja").innerHTML = html;
    if (formularioDe !== h.nombre) { formularioDe = h.nombre; pintarAgregar(h.nombre); }
  }
  let formularioDe = null;

  /* Nombre legible de una celda editable, para lectores de pantalla y el título del cuadro */
  function etiqueta(h, r, c) {
    let fila = "", col = "";
    for (let cc = c - 1; cc >= 0 && !fila; cc--) { const x = h.celdas[dir(r, cc)]; if (x && typeof x.v === "string" && !x.f) fila = x.v; }
    for (let rr = r - 1; rr >= 0 && !col; rr--) { const x = h.celdas[dir(rr, c)]; if (x && typeof x.v === "string" && !x.f && ["254B6E", "17324D"].includes(x.c)) col = x.v; }
    return [fila, col].filter(Boolean).join(" · ") || dir(r, c);
  }

  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Gráficos del Tablero (una sola tonalidad, el azul de la marca, con los valores escritos) ---------- */
  const plata = n => (typeof n === "number" ? "$ " + Math.round(n).toLocaleString("es-AR") : "—");
  const tarjeta = (titulo, cuerpo) => `<figure class="grafico"><figcaption>${esc(titulo)}</figcaption>${cuerpo}</figure>`;
  function barras(datos, formato, titulo) {
    const max = Math.max(1, ...datos.map(d => Math.abs(d.v || 0)));
    return tarjeta(titulo, `<div class="gbarras">${datos.map(d => `
      <div class="gbarra" title="${esc(d.n)}: ${esc(formato(d.v))}">
        <span class="gbarra__n">${esc(d.n)}</span>
        <span class="gbarra__pista"><span class="gbarra__relleno" style="width:${Math.max(0, (d.v || 0) / max * 100).toFixed(1)}%"></span></span>
        <span class="gbarra__v">${esc(formato(d.v))}</span>
      </div>`).join("")}</div>`);
  }
  /* Los gráficos leen directo de Precios y Rentabilidad, Costos Fijos y Precios Insumos (así incluyen lo que se agregue) */
  function variedades() {
    const { h, c2 } = filasRentabilidad();
    return c2.map(r => ({ n: String(texto(h, r, 0) ?? ""), costo: valor(h.nombre, r, 3), precio: valor(h.nombre, r, 2), margen: valor(h.nombre, r, 4) }))
      .map(d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, typeof v === "object" && v ? null : v])));
  }
  const GRAFICOS = {
    /* Costo y precio de venta de cada pizza: punto hueco = costo, punto lleno = precio; la línea entre los dos es el margen */
    costoPrecio() {
      const n = variedades();
      const max = Math.max(1, ...n.map(d => Math.max(d.costo || 0, d.precio || 0)));
      const x = v => ((v || 0) / max * 100).toFixed(1);
      return tarjeta("Costo vs. precio de venta por pizza", `
        <p class="grafico__ley"><span class="punto punto--hueco"></span>Costo <span class="punto"></span>Precio de venta</p>
        <div class="gbarras">${n.map(d => `
          <div class="gbarra gbarra--doble" title="${esc(d.n)}: costo ${plata(d.costo)}, precio ${plata(d.precio)}">
            <span class="gbarra__n">${esc(d.n)}</span>
            <span class="gbarra__pista"><span class="pesa" style="left:${x(d.costo)}%;width:${Math.max(0, x(d.precio) - x(d.costo)).toFixed(1)}%"></span><span class="punto punto--hueco" style="left:${x(d.costo)}%"></span><span class="punto" style="left:${x(d.precio)}%"></span></span>
            <span class="gbarra__v">${plata(d.costo)} → ${plata(d.precio)}</span>
          </div>`).join("")}</div>`);
    },
    margen: () => barras(variedades().map(d => ({ n: d.n, v: d.margen })), plata, "Margen por pizza"),
    fijos: () => {
      const { h, items } = costosFijos();
      const C = hojaModelo("Costos Fijos");
      const filas = [...items];
      if (C) for (let r = 0; r < C.filas; r++) { const a = C.celdas[dir(r, 0)]; if ((a?.c === "446C55" || a?.c === "3F6B54") && !/TOTAL COSTOS/i.test(String(a.v))) filas.push(r); }
      return barras(filas.map(r => ({ n: String(texto(h, r, 0) ?? ""), v: valor("Costos Fijos", r, 1) })).map(d => ({ ...d, v: typeof d.v === "number" ? d.v : 0 })).sort((a, b) => b.v - a.v), plata, "Composición de costos fijos mensuales");
    },
    insumos: () => barras(seccionesInsumos(hojaModelo("Precios Insumos")).map(s => ({ n: s.nombre.charAt(0) + s.nombre.slice(1).toLowerCase(), v: s.items.length })), v => (v ?? "—").toString(), "Cantidad de insumos por categoría"),
  };

  /* ---------- Editar una celda ---------- */
  function textoParaEditar(cel) {
    if (cel.f) return "=" + cel.f;
    if (typeof cel.v === "number") {
      const pct = (cel.z || "").includes("%");
      return (pct ? +(cel.v * 100).toFixed(6) : cel.v).toString().replace(".", ",") + (pct ? "%" : "");
    }
    return cel.v ?? "";
  }
  /* Lee lo escrito como en Excel en español: 1.500,50 · 30% · 0,3 · =5000/0,49 */
  function leerEntrada(txt, cel) {
    const t = txt.trim();
    if (t === "") return { v: null };
    if (t.startsWith("=")) {
      const f = t.slice(1);
      return { f: /[A-Za-z]/.test(f) ? f : f.replace(/(\d),(\d)/g, "$1.$2") };   // =5000/0,49 → 5000/0.49 (sólo cuentas, sin funciones)
    }
    let s = t.replace(/\$/g, "").replace(/\s/g, "");
    const pct = s.endsWith("%"); if (pct) s = s.slice(0, -1);
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    if (s === "" || Number.isNaN(n)) return typeof cel.v === "number" ? { error: "Escribí un número (por ejemplo 1500 o 1.500,50)." } : { v: t };
    if (pct || ((cel.z || "").includes("%") && Math.abs(n) > 1)) return { v: n / 100 };
    return { v: n };
  }

  function abrirEdicion(td) {
    if (td.querySelector("input")) return;
    const h = modelo.hojas.find(x => x.nombre === hojaActual);
    const a = td.dataset.dir; const cel = h.celdas[a];
    const anterior = td.innerHTML;
    td.classList.add("c-editando");
    td.innerHTML = `<input class="c-input" value="${esc(textoParaEditar(cel))}" aria-label="${esc(td.getAttribute("aria-label"))}" inputmode="${cel.f ? "text" : "decimal"}" spellcheck="false">`;
    const inp = td.querySelector("input");
    inp.focus(); inp.select();
    let hecho = false;
    const cancelar = () => { if (hecho) return; hecho = true; td.classList.remove("c-editando"); td.innerHTML = anterior; td.focus(); };
    const confirmar = () => {
      if (hecho) return;
      const r = leerEntrada(inp.value, cel);
      if (r.error) { avisar(r.error); inp.focus(); return; }
      hecho = true;
      cambiarCelda(h, a, r);
    };
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); confirmar(); }
      else if (e.key === "Escape") { e.preventDefault(); cancelar(); }
    });
    inp.addEventListener("blur", () => setTimeout(() => { if (!hecho) confirmar(); }, 0));
  }

  function cambiarCelda(h, a, r) {
    const cel = h.celdas[a];
    const antes = foto(h);
    const nuevo = { ...cel };
    delete nuevo.f; delete nuevo.v;
    if (r.f) nuevo.f = r.f; else if (r.v !== null && r.v !== undefined) nuevo.v = r.v;
    const { r: row, c: col } = XLSX.utils.decode_cell(a);
    try {
      hf.setCellContents({ sheet: hf.getSheetId(h.nombre), row, col }, [[contenido(nuevo)]]);
    } catch (e) { avisar("Esa fórmula no se entiende: " + e.message); dibujarHoja(h.nombre); return; }
    h.celdas[a] = nuevo;
    const despues = foto(h);
    const cambios = new Set([...despues.keys()].filter(k => despues.get(k) !== antes.get(k)));
    dibujarHoja(h.nombre, { marcarCambios: cambios });
    const td = $(`#costos-hoja [data-dir="${a}"]`); if (td) td.focus();
    const otras = cambiosEnOtrasHojas(h.nombre);
    avisar(cambios.size > 1 || otras ? `Recalculado: ${cambios.size - 1 > 0 ? `${cambios.size - 1} celdas en esta pestaña` : "esta pestaña"}${otras ? ` y ${otras}` : ""}.` : "Guardando el cambio…");
    programarGuardado();
  }

  /* Valores mostrados de una pestaña, para resaltar lo que cambió */
  function foto(h) {
    const m = new Map();
    for (const [a, cel] of Object.entries(h.celdas)) {
      const { r: row, c: col } = XLSX.utils.decode_cell(a);
      const v = cel.f ? valor(h.nombre, row, col) : cel.v;
      m.set(a, typeof v === "object" && v ? v.value : v);
    }
    return m;
  }
  let fotosOtras = null;
  function cambiosEnOtrasHojas(actual) {
    const ahora = new Map(modelo.hojas.filter(h => h.nombre !== actual).map(h => [h.nombre, foto(h)]));
    let hojas = [];
    if (fotosOtras) for (const [n, f] of ahora) { const a = fotosOtras.get(n); if (a && [...f].some(([k, v]) => a.get(k) !== v)) hojas.push(n); }
    fotosOtras = ahora;
    if (!hojas.length) return "";
    return hojas.length === 1 ? `«${hojas[0]}»` : `${hojas.length} pestañas más`;
  }

  /* ---------- Guardar ---------- */
  function estado(t, tipo = "") { const e = $("#costos-estado"); e.textContent = t; e.dataset.tipo = tipo; }
  function programarGuardado() {
    estado("Guardando…", "guardando");
    clearTimeout(tGuardar);
    tGuardar = setTimeout(guardarYa, 900);
  }
  async function guardarYa() {
    clearTimeout(tGuardar);
    try {
      const { actualizado_el, ...datos } = modelo;
      await D.costos.guardar(datos);
      estado("Guardado", "ok");
    } catch (e) {
      estado("Sin guardar", "error");
      avisar("No se guardó: " + e.message, { texto: "Reintentar", fn: guardarYa });
    }
  }
  window.addEventListener("beforeunload", e => { if ($("#costos-estado").dataset.tipo === "guardando") { e.preventDefault(); e.returnValue = ""; } });

  /* =========================================================
     EDITAR LA ESTRUCTURA DESDE LA PÁGINA (sin pasar por Excel)
     Insumos, ingredientes, recetas nuevas, costos fijos y consumo de
     limpieza y descartables: agregar, quitar y renombrar.
     Regla: un renglón nuevo se inserta ANTES del último de su sección o
     bloque, así SUMA, CONTARA y PROMEDIO lo incluyen solos (como en Excel
     cuando insertás una fila dentro del rango).
     ========================================================= */
  const hojaModelo = n => modelo.hojas.find(h => h.nombre === n);
  const sid = h => hf.getSheetId(h.nombre);
  const texto = (h, r, c) => { const x = h.celdas[dir(r, c)]; const v = x ? (x.f ? valor(h.nombre, r, c) : x.v) : null; return typeof v === "string" ? v.trim() : v; };
  const igual = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

  /* ----- Operaciones de bajo nivel: el motor corre fórmulas; el modelo corre colores y formatos ----- */
  function correrModelo(h, desde, n) {
    const nuevas = {};
    for (const [a, cel] of Object.entries(h.celdas)) {
      const { r, c } = XLSX.utils.decode_cell(a);
      if (n < 0 && r === desde) continue;
      nuevas[dir(r >= desde + (n < 0 ? 1 : 0) ? r + n : r, c)] = cel;
    }
    h.celdas = nuevas;
    h.merges = h.merges.map(m => {
      const g = XLSX.utils.decode_range(m);
      if (n < 0 && g.s.r === desde && g.e.r === desde) return null;
      if (g.s.r >= desde + (n < 0 ? 1 : 0)) g.s.r += n;
      if (g.e.r >= desde + (n < 0 ? 1 : 0)) g.e.r += n;
      return XLSX.utils.encode_range(g);
    }).filter(Boolean);
    h.filas += n;
  }
  function sincronizarFormulas() {
    for (const h of modelo.hojas) {
      const id = sid(h);
      for (const [a, cel] of Object.entries(h.celdas)) {
        if (!cel.f) continue;
        const { r: row, c: col } = XLSX.utils.decode_cell(a);
        const f = hf.getCellFormula({ sheet: id, row, col });
        if (f) cel.f = f.slice(1);
      }
    }
  }
  function insertarFila(h, r) { hf.addRows(sid(h), [r, 1]); correrModelo(h, r, 1); sincronizarFormulas(); }
  function quitarFila(h, r) { hf.removeRows(sid(h), [r, 1]); correrModelo(h, r, -1); sincronizarFormulas(); }

  /* Lee una celda del motor al modelo, con el color y formato de «estilo» */
  function tomarDelMotor(h, r, c, estilo) {
    const s = hf.getCellSerialized({ sheet: sid(h), row: r, col: c });
    const cel = {};
    if (typeof s === "string" && s.startsWith("=")) cel.f = s.slice(1); else if (s !== null && s !== undefined && s !== "") cel.v = s;
    if (estilo?.z) cel.z = estilo.z;
    if (estilo?.c) cel.c = estilo.c;
    if (Object.keys(cel).length) h.celdas[dir(r, c)] = cel; else delete h.celdas[dir(r, c)];
  }
  function poner(h, r, c, contenidoNuevo) {
    hf.setCellContents({ sheet: sid(h), row: r, col: c }, [[contenidoNuevo]]);
    tomarDelMotor(h, r, c, h.celdas[dir(r, c)]);
  }
  /* Copia un renglón (columnas c0..c1) con las fórmulas relativas corridas, y pone los valores dados */
  function copiarFila(h, desde, hacia, valores = {}, c0 = 0, c1 = h.cols - 1) {
    const id = sid(h);
    const estilos = {};
    for (let c = c0; c <= c1; c++) estilos[c] = h.celdas[dir(desde, c)];
    hf.copy({ start: { sheet: id, row: desde, col: c0 }, end: { sheet: id, row: desde, col: c1 } });
    hf.paste({ sheet: id, row: hacia, col: c0 });
    for (let c = c0; c <= c1; c++) {
      if (c in valores) hf.setCellContents({ sheet: id, row: hacia, col: c }, [[valores[c] === "" ? null : valores[c]]]);
      tomarDelMotor(h, hacia, c, estilos[c]);
    }
  }
  function vaciar(h, r, c0, c1) {
    for (let c = c0; c <= c1; c++) { hf.setCellContents({ sheet: sid(h), row: r, col: c }, [[null]]); delete h.celdas[dir(r, c)]; }
  }
  /* Rangos de una misma columna que, tras mover celdas, quedaron incluyendo a su propia celda: se cortan antes */
  function arreglarRangos(h, r0, r1, c0, c1) {
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const cel = h.celdas[dir(r, c)];
      if (!cel?.f) continue;
      const nueva = cel.f.replace(/(^|[^!'\w$])(\$?)([A-Z]{1,3})(\$?)(\d+):(\$?)([A-Z]{1,3})(\$?)(\d+)/g, (m, pre, d1, c1l, d2, f1, d3, c2l, d4, f2) => {
        const desde = +f1, hasta = +f2;
        return desde <= r && hasta >= r + 1 ? `${pre}${d1}${c1l}${d2}${f1}:${d3}${c2l}${d4}${r}` : m;
      });
      if (nueva !== cel.f) poner(h, r, c, "=" + normalizar(nueva));
    }
  }
  /* Corre un pedazo de tabla (columnas c0..c1, filas r0..r1) una fila para arriba o para abajo */
  function correrCeldas(h, c0, c1, r0, r1, n) {
    const id = sid(h);
    const estilos = {};
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) estilos[dir(r, c)] = h.celdas[dir(r, c)];
    hf.moveCells({ start: { sheet: id, row: r0, col: c0 }, end: { sheet: id, row: r1, col: c1 } }, { sheet: id, row: r0 + n, col: c0 });
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) delete h.celdas[dir(r, c)];
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) tomarDelMotor(h, r + n, c, estilos[dir(r, c)]);
    sincronizarFormulas();
    arreglarRangos(h, r0 + n, r1 + n, c0, c1);
  }

  /* ----- Precios Insumos ----- */
  function seccionesInsumos(h) {
    const out = [];
    for (let r = 0; r < h.filas; r++) {
      const x = h.celdas[dir(r, 0)];
      if (x && x.c === "E8EEF3" && typeof x.v === "string") out.push({ nombre: x.v.trim(), fila: r, items: [] });
      else if (out.length && x && typeof x.v === "string" && x.v.trim() && !x.f) out.at(-1).items.push(r);
    }
    return out;
  }
  function insumosExistentes() {
    const h = hojaModelo("Precios Insumos"); if (!h) return [];
    return seccionesInsumos(h).flatMap(s => s.items.map(r => ({ nombre: texto(h, r, 0), unidad: texto(h, r, 1) || "", seccion: s.nombre, fila: r })));
  }
  /* Dónde se usa un insumo (por nombre: así lo buscan los BUSCARV) */
  function usosDeInsumo(nombre) {
    const usos = [];
    const R = hojaModelo("Recetas");
    if (R) for (const b of bloquesRecetas(R)) if (b.usados.some(r => igual(texto(R, r, 0), nombre) && !R.celdas[dir(r, 0)].f)) usos.push(b.nombre);
    const I = hojaModelo("Insumos");
    if (I) for (const t of tablasConsumo(I)) if (t.items.some(r => igual(texto(I, r, t.c0), nombre))) usos.push(`consumo de ${t.nombre.toLowerCase()}`);
    for (const h of modelo.hojas) for (const cel of Object.values(h.celdas)) if (cel.f && cel.f.toLowerCase().includes(`"${nombre.toLowerCase()}"`)) { usos.push(`una fórmula de ${h.nombre}`); break; }
    return [...new Set(usos)];
  }
  function agregarInsumo({ nombre, unidad, precio, seccion }) {
    const h = hojaModelo("Precios Insumos");
    if (insumosExistentes().some(i => igual(i.nombre, nombre))) throw new Error(`«${nombre}» ya está en la lista.`);
    const s = seccionesInsumos(h).find(x => x.nombre === seccion);
    if (!s || !s.items.length) throw new Error("No encontré la sección " + seccion + ".");
    const ultimo = s.items.at(-1);
    insertarFila(h, ultimo);
    copiarFila(h, ultimo + 1, ultimo, { 0: nombre, 1: unidad, 2: precio });
    return { hoja: h.nombre, fila: ultimo, aviso: `«${nombre}» agregado a ${seccion}. Ya lo podés usar en las recetas.` };
  }
  function quitarInsumo({ nombre }) {
    const h = hojaModelo("Precios Insumos");
    const i = insumosExistentes().find(x => igual(x.nombre, nombre));
    if (!i) throw new Error("No encontré ese insumo.");
    const usos = usosDeInsumo(i.nombre);
    if (usos.length) throw new Error(`«${i.nombre}» se usa en: ${usos.join(", ")}. Sacalo primero de ahí.`);
    if (!window.confirm(`¿Quitar «${i.nombre}» de la lista de insumos?`)) return null;
    quitarFila(h, i.fila);
    return { hoja: h.nombre, fila: -1, aviso: `«${i.nombre}» quitado de la lista.` };
  }
  function renombrarInsumo({ nombre, nuevo }) {
    const i = insumosExistentes().find(x => igual(x.nombre, nombre));
    if (!i) throw new Error("No encontré ese insumo.");
    if (insumosExistentes().some(x => igual(x.nombre, nuevo) && x !== i)) throw new Error(`Ya hay un insumo que se llama «${nuevo}».`);
    let n = 0;
    const DONDE = { "Precios Insumos": [0], Recetas: [0], Insumos: [0, 6] };   // sólo columnas de nombres de insumo
    for (const h of modelo.hojas) for (const [a, cel] of Object.entries(h.celdas)) {
      const { r, c } = XLSX.utils.decode_cell(a);
      if (!cel.f && typeof cel.v === "string" && igual(cel.v, i.nombre) && (DONDE[h.nombre] || []).includes(c)) { poner(h, r, c, nuevo); n++; }
      else if (cel.f && cel.f.includes(`"${i.nombre}"`)) { poner(h, r, c, "=" + normalizar(cel.f.split(`"${i.nombre}"`).join(`"${nuevo}"`))); n++; }
    }
    return { hoja: "Precios Insumos", fila: i.fila, aviso: `«${i.nombre}» ahora se llama «${nuevo}» (${n} lugar${n === 1 ? "" : "es"}).` };
  }

  /* ----- Recetas ----- */
  function bloquesRecetas(h) {
    const out = [];
    let actual = null;
    for (let r = 0; r < h.filas; r++) {
      const x = h.celdas[dir(r, 0)];
      const a = x && !x.f && typeof x.v === "string" ? x.v : "";
      if (/Receta:/i.test(a)) actual = { nombre: a.split(/Receta:/i)[1].trim(), titulo: r, desde: r + 3 };
      else if (actual && /COSTO TOTAL DEL PLATO/i.test(a)) { actual.hasta = r - 1; actual.total = r; out.push(actual); actual = null; }
    }
    for (const b of out) {
      b.libres = []; b.molde = null; b.usados = [];
      for (let r = b.desde; r <= b.hasta; r++) {
        const [xa, xc, xf] = [0, 2, 5].map(c => h.celdas[dir(r, c)]);
        const vacia = [xa, xc, xf].every(x => !x || (!x.f && (x.v === undefined || x.v === null || x.v === "")));
        if (vacia) b.libres.push(r); else b.usados.push(r);
        if (xc && xc.f && /VLOOKUP/i.test(xc.f)) b.molde = r;
      }
    }
    return out;
  }
  const filaRef = r => new RegExp(`(^|[^0-9])\\$?A\\$${r + 1}$`);
  /* Renglones de otras recetas que copian este ingrediente de la base (=$A$31) */
  function vinculadas(h, r) {
    const out = [];
    for (const [a, cel] of Object.entries(h.celdas)) {
      const p = XLSX.utils.decode_cell(a);
      if (p.c === 0 && cel.f && filaRef(r).test(cel.f.trim())) out.push(p.r);
    }
    return out;
  }
  function agregarIngrediente({ receta, insumo, cantidad, merma }) {
    const h = hojaModelo("Recetas");
    const b = bloquesRecetas(h).find(x => x.nombre === receta);
    if (!b) throw new Error("No encontré la receta " + receta + ".");
    if (b.molde === null) throw new Error("Esa receta no tiene un renglón de ingrediente para copiar.");
    for (const r of b.usados) if (igual(texto(h, r, 0), insumo.nombre)) throw new Error(`«${insumo.nombre}» ya está en ${receta}.`);
    let fila = b.libres[0], molde = b.molde;
    if (fila === undefined) { fila = b.hasta; insertarFila(h, fila); if (molde >= fila) molde++; }
    copiarFila(h, molde, fila, { 0: insumo.nombre, 1: insumo.unidad, 3: cantidad, 4: merma }, 0, 11);
    return { hoja: h.nombre, fila, aviso: `${insumo.nombre} agregado a ${receta}. Costos y precios recalculados.` };
  }
  function ingredientesDe(receta) {
    const h = hojaModelo("Recetas");
    const b = bloquesRecetas(h).find(x => x.nombre === receta);
    return b ? b.usados.map(r => ({ fila: r, nombre: String(texto(h, r, 0) ?? ""), base: !!h.celdas[dir(r, 0)]?.f })) : [];
  }
  function quitarIngrediente({ receta, fila }) {
    const h = hojaModelo("Recetas");
    const bloques = bloquesRecetas(h);
    const xa = h.celdas[dir(fila, 0)];
    /* Si es una copia de la base (=$A$31) se quita sólo de esta receta; si es la base, de todas las que la copian */
    const filas = xa?.f ? [fila] : [fila, ...vinculadas(h, fila)];
    const base = fila;
    const recetas = [...new Set(filas.map(r => (bloques.find(b => r >= b.desde && r <= b.hasta) || {}).nombre).filter(Boolean))];
    const nombre = texto(h, base, 0);
    const msj = recetas.length > 1
      ? `«${nombre}» es parte de la base que comparten ${recetas.length} recetas (${recetas.join(", ")}).\n\n¿Quitarlo de todas?`
      : `¿Quitar «${nombre}» de ${receta}?`;
    if (!window.confirm(msj)) return null;
    for (const r of filas) vaciar(h, r, 0, 11);   // el renglón queda libre para otro ingrediente
    return { hoja: h.nombre, fila: -1, aviso: `«${nombre}» quitado de ${recetas.length > 1 ? recetas.length + " recetas" : receta}.` };
  }

  /* Filas de Precios y Rentabilidad que muestran cada receta (por la fórmula que apunta a su total) */
  function filasRentabilidad(totalFila) {
    const h = hojaModelo("Precios y Rentabilidad"); if (!h) return { h, c1: [], c2: [], propias: [] };
    const c1 = [], c2 = [], propias = [];
    for (let r = 0; r < h.filas; r++) {
      const b = h.celdas[dir(r, 1)], d = h.celdas[dir(r, 3)];
      if (b?.f && /^Recetas!\$?F\$?\d+$/.test(b.f)) { c1.push(r); if (totalFila !== undefined && +b.f.match(/\d+$/)[0] === totalFila + 1) propias.push(r); }
      if (d?.f && /^Recetas!\$?F\$?\d+$/.test(d.f)) { c2.push(r); if (totalFila !== undefined && +d.f.match(/\d+$/)[0] === totalFila + 1) propias.push(r); }
    }
    return { h, c1, c2, propias };
  }
  /* Corre las referencias fijas ($) que apuntan adentro del bloque copiado */
  function correrFijas(f, r0, r1, n) {
    return f.split(/("[^"]*"|'[^']*'![$A-Z0-9:]+|[A-Za-z]+![$A-Z0-9:]+)/).map((t, i) => (i % 2 ? t : t.replace(/(\$?[A-Z]{1,3})\$(\d+)/g, (m, col, fila) => (+fila >= r0 + 1 && +fila <= r1 + 1 ? `${col}$${+fila + n}` : m)))).join("");
  }
  function nuevaReceta({ nombre, copiarDe }) {
    const h = hojaModelo("Recetas");
    const bloques = bloquesRecetas(h);
    if (bloques.some(b => igual(b.nombre, nombre))) throw new Error(`Ya hay una receta «${nombre}».`);
    const src = bloques.find(b => b.nombre === copiarDe);
    if (!src) throw new Error("Elegí de qué receta copiar.");
    const ultima = bloques.at(-1);
    const destino = Math.max(ultima.total, h.filas - 1) + 6;
    const n = destino - src.titulo;
    const id = sid(h);
    hf.copy({ start: { sheet: id, row: src.titulo, col: 0 }, end: { sheet: id, row: src.total, col: 11 } });
    hf.paste({ sheet: id, row: destino, col: 0 });
    for (let r = src.titulo; r <= src.total; r++) for (let c = 0; c <= 11; c++) {
      const s = hf.getCellSerialized({ sheet: id, row: r + n, col: c });
      if (typeof s === "string" && s.startsWith("=")) { const f = correrFijas(s.slice(1), src.titulo, src.total, n); if (f !== s.slice(1)) hf.setCellContents({ sheet: id, row: r + n, col: c }, [["=" + f]]); }
      tomarDelMotor(h, r + n, c, h.celdas[dir(r, c)]);
    }
    for (const m of h.merges.slice()) { const g = XLSX.utils.decode_range(m); if (g.s.r >= src.titulo && g.e.r <= src.total) { g.s.r += n; g.e.r += n; h.merges.push(XLSX.utils.encode_range(g)); } }
    h.filas = Math.max(h.filas, src.total + n + 1);
    poner(h, destino, 0, `PENITENTIA  -  Receta: ${nombre}`);
    const total = src.total + n;
    /* Una fila en cada cuadro de Precios y Rentabilidad, antes de la última (así PROMEDIO la incluye) */
    for (const cuadro of ["c1", "c2"]) {
      const { h: P, [cuadro]: filas } = filasRentabilidad();
      if (!filas.length) continue;
      const ult = filas.at(-1);
      insertarFila(P, ult);
      copiarFila(P, ult + 1, ult, {}, 0, P.cols - 1);
      poner(P, ult, 0, nombre);
      for (const c of [1, 3]) {
        const cel = P.celdas[dir(ult, c)];
        if (cel?.f) poner(P, ult, c, "=" + cel.f.replace(/^(Recetas!\$?F\$?)\d+/, `$1${total + 1}`));
      }
    }
    return { hoja: h.nombre, fila: destino, aviso: `Receta «${nombre}» creada a partir de ${copiarDe}. Ajustá sus ingredientes abajo de todo en Recetas; ya figura en Precios y Rentabilidad.` };
  }
  function renombrarReceta({ receta, nuevo }) {
    const h = hojaModelo("Recetas");
    const bloques = bloquesRecetas(h);
    const b = bloques.find(x => x.nombre === receta);
    if (!b) throw new Error("No encontré la receta.");
    if (bloques.some(x => x !== b && igual(x.nombre, nuevo))) throw new Error(`Ya hay una receta «${nuevo}».`);
    const titulo = String(h.celdas[dir(b.titulo, 0)].v);
    poner(h, b.titulo, 0, titulo.replace(/(Receta:\s*).*/i, `$1${nuevo}`));
    const { h: P, propias } = filasRentabilidad(b.total);
    for (const r of propias) poner(P, r, 0, nuevo);
    return { hoja: h.nombre, fila: b.titulo, aviso: `«${receta}» ahora se llama «${nuevo}».` };
  }
  function quitarReceta({ receta }) {
    const h = hojaModelo("Recetas");
    const bloques = bloquesRecetas(h);
    const b = bloques.find(x => x.nombre === receta);
    if (!b) throw new Error("No encontré la receta.");
    for (let r = b.desde; r <= b.hasta; r++) if (vinculadas(h, r).some(v => v < b.desde || v > b.hasta)) throw new Error(`«${receta}» es la base de otras recetas; no se puede quitar.`);
    if (!window.confirm(`¿Quitar la receta «${receta}» y sus filas en Precios y Rentabilidad?`)) return null;
    const { h: P, propias } = filasRentabilidad(b.total);
    for (const r of propias.sort((x, y) => y - x)) quitarFila(P, r);
    for (let r = b.total + 5; r >= b.titulo; r--) if (r < h.filas && (r <= b.total || !Object.keys(h.celdas).some(a => XLSX.utils.decode_cell(a).r === r))) quitarFila(h, r);
    return { hoja: h.nombre, fila: -1, aviso: `Receta «${receta}» quitada.` };
  }

  /* ----- Costos Fijos ----- */
  function costosFijos() {
    const h = hojaModelo("Costos Fijos"); if (!h) return { h, items: [], primerTotal: -1 };
    const items = []; let primerTotal = -1;
    for (let r = 0; r < h.filas; r++) {
      const a = h.celdas[dir(r, 0)], b = h.celdas[dir(r, 1)];
      if (a?.c === "446C55" || a?.c === "3F6B54") { if (primerTotal < 0) primerTotal = r; continue; }
      if (primerTotal < 0 && a && typeof a.v === "string" && b && !b.f && typeof b.v === "number") items.push(r);
    }
    return { h, items, primerTotal };
  }
  function agregarCostoFijo({ nombre, monto }) {
    const { h, items, primerTotal } = costosFijos();
    if (!items.length || primerTotal < 0) throw new Error("No encontré la lista de costos fijos.");
    if (items.some(r => igual(texto(h, r, 0), nombre))) throw new Error(`Ya hay un costo fijo «${nombre}».`);
    insertarFila(h, primerTotal);   // queda entre el último concepto y «Total Limpieza», dentro de la SUMA
    copiarFila(h, items.at(-1), primerTotal, { 0: nombre, 1: monto }, 0, h.cols - 1);
    return { hoja: h.nombre, fila: primerTotal, aviso: `«${nombre}» agregado a los costos fijos.` };
  }
  function quitarCostoFijo({ fila }) {
    const { h } = costosFijos();
    const n = texto(h, fila, 0);
    if (!window.confirm(`¿Quitar «${n}» de los costos fijos?`)) return null;
    quitarFila(h, fila);
    return { hoja: h.nombre, fila: -1, aviso: `«${n}» quitado de los costos fijos.` };
  }
  function renombrarCostoFijo({ fila, nuevo }) {
    const { h } = costosFijos();
    const n = texto(h, fila, 0);
    poner(h, fila, 0, nuevo);
    return { hoja: h.nombre, fila, aviso: `«${n}» ahora se llama «${nuevo}».` };
  }

  /* ----- Insumos: consumo mensual de limpieza y descartables (dos tablas lado a lado) ----- */
  function tablasConsumo(h) {
    const out = [];
    for (const c0 of [0, 6]) {
      let cab = -1, total = -1; const items = [];
      for (let r = 0; r < h.filas; r++) {
        const x = h.celdas[dir(r, c0)];
        if (!x) continue;
        if (x.c === "254B6E" && cab < 0) { cab = r; continue; }
        if (cab >= 0 && typeof x.v === "string" && /^TOTAL/i.test(x.v.trim())) { total = r; break; }
        if (cab >= 0 && typeof x.v === "string" && x.v.trim()) items.push(r);
      }
      const titulo = String(texto(h, 0, c0) || "");
      if (cab >= 0 && total >= 0) out.push({ nombre: /descart/i.test(titulo) ? "Descartables" : "Limpieza", c0, c1: c0 + 4, cab, total, items });
    }
    return out;
  }
  function agregarConsumo({ tabla, insumo, cantidad }) {
    const h = hojaModelo("Insumos");
    const tablas = tablasConsumo(h);
    const t = tablas.find(x => x.nombre === tabla);
    if (!t || !t.items.length) throw new Error("No encontré la tabla " + tabla + ".");
    if (t.items.some(r => igual(texto(h, r, t.c0), insumo.nombre))) throw new Error(`«${insumo.nombre}» ya está en ${tabla}.`);
    const ultimo = t.items.at(-1);
    insertarFila(h, ultimo);
    /* La otra tabla quedó con un renglón vacío en el medio: se sube lo que está debajo */
    for (const o of tablas) {
      if (o === t || o.total + 1 <= ultimo) continue;
      correrCeldas(h, o.c0, o.c1, ultimo + 1, o.total + 1, -1);
    }
    copiarFila(h, ultimo + 1, ultimo, { [t.c0]: insumo.nombre, [t.c0 + 1]: insumo.unidad, [t.c0 + 3]: cantidad }, t.c0, t.c1);
    return { hoja: h.nombre, fila: ultimo, aviso: `${insumo.nombre} agregado al consumo de ${tabla.toLowerCase()}. Costos fijos recalculados.` };
  }
  function quitarConsumo({ tabla, fila }) {
    const h = hojaModelo("Insumos");
    const t = tablasConsumo(h).find(x => x.nombre === tabla);
    const n = texto(h, fila, t.c0);
    if (!window.confirm(`¿Quitar «${n}» del consumo de ${tabla.toLowerCase()}?`)) return null;
    vaciar(h, fila, t.c0, t.c1);
    correrCeldas(h, t.c0, t.c1, fila + 1, t.total, -1);
    return { hoja: h.nombre, fila: -1, aviso: `«${n}» quitado del consumo de ${tabla.toLowerCase()}.` };
  }

  /* ----- Formularios: una barra de acciones por pestaña ----- */
  const opciones = (lista, valor = x => x, etiqueta = x => x) => lista.map(x => `<option value="${esc(valor(x))}">${esc(etiqueta(x))}</option>`).join("");
  const campo = (rotulo, control) => `<label class="campo campo--linea"><span>${rotulo}</span>${control}</label>`;
  const ACCIONES = {
    "Precios Insumos": {
      agregar: ["Agregar insumo", () => {
        const secs = seccionesInsumos(hojaModelo("Precios Insumos")).map(s => s.nombre);
        return campo("Nombre", `<input name="nombre" maxlength="60" placeholder="Ej. Rúcula">`) + campo("Sección", `<select name="seccion">${opciones(secs)}</select>`) +
          campo("Unidad", `<input name="unidad" list="costos-unidades" maxlength="30" placeholder="Kg">`) + campo("Precio de compra $", `<input name="precio" inputmode="decimal" placeholder="0">`);
      }, f => agregarInsumo({ nombre: nombreDe(f.nombre), seccion: f.seccion.value, unidad: f.unidad.value.trim() || "Unidad", precio: numeroObligatorio(f.precio, "el precio de compra", true) })],
      renombrar: ["Renombrar", () => campo("Insumo", `<select name="insumo">${opciones(insumosExistentes(), i => i.nombre, i => i.nombre)}</select>`) + campo("Nombre nuevo", `<input name="nuevo" maxlength="60">`),
        f => renombrarInsumo({ nombre: f.insumo.value, nuevo: nombreDe(f.nuevo) })],
      quitar: ["Quitar", () => campo("Insumo", `<select name="insumo">${opciones(insumosExistentes(), i => i.nombre, i => i.nombre)}</select>`), f => quitarInsumo({ nombre: f.insumo.value })],
    },
    Recetas: {
      agregar: ["Agregar ingrediente", () => {
        const ins = insumosExistentes().filter(i => /INGREDIENTE/i.test(i.seccion));
        return campo("Receta", `<select name="receta">${opciones(bloquesRecetas(hojaModelo("Recetas")).map(b => b.nombre))}</select>`) +
          campo("Insumo", `<select name="insumo">${opciones(ins, i => i.nombre, i => `${i.nombre} (${i.unidad || "—"})`)}</select>`) +
          campo("Cantidad por pizza", `<input name="cantidad" inputmode="decimal" placeholder="Ej. 0,05">`) + campo("Merma %", `<input name="merma" inputmode="decimal" placeholder="0">`) +
          `<p class="agregar__nota">La cantidad va en la unidad del insumo: 0,05 Kg son 50 g. ¿No está el insumo? Agregalo primero en Precios Insumos.</p>`;
      }, f => {
        const insumo = insumosExistentes().find(i => i.nombre === f.insumo.value);
        if (!insumo) throw new Error("Elegí un insumo.");
        let merma = numeroEs(f.merma.value) ?? 0;
        if (Number.isNaN(merma) || merma < 0) { f.merma.focus(); throw new Error("La merma tiene que ser un número (por ejemplo 5)."); }
        if (merma >= 1) merma /= 100;
        return agregarIngrediente({ receta: f.receta.value, insumo, cantidad: numeroObligatorio(f.cantidad, "la cantidad por pizza"), merma });
      }],
      quitar: ["Quitar ingrediente", () => {
        const recetas = bloquesRecetas(hojaModelo("Recetas")).map(b => b.nombre);
        return campo("Receta", `<select name="receta" data-recarga>${opciones(recetas)}</select>`) +
          campo("Ingrediente", `<select name="fila">${opciones(ingredientesDe(recetas[0]), i => i.fila, i => i.nombre + (i.base ? " (base)" : ""))}</select>`);
      }, f => quitarIngrediente({ receta: f.receta.value, fila: +f.fila.value })],
      nueva: ["Nueva receta", () => campo("Nombre", `<input name="nombre" maxlength="50" placeholder="Ej. Cuatro quesos">`) +
        campo("Copiar de", `<select name="copiarDe">${opciones(bloquesRecetas(hojaModelo("Recetas")).map(b => b.nombre))}</select>`) +
        `<p class="agregar__nota">Se copia la receta elegida con sus ingredientes; después cambiás cantidades, agregás o quitás. Aparece sola en Precios y Rentabilidad y en el Tablero.</p>`,
        f => nuevaReceta({ nombre: nombreDe(f.nombre), copiarDe: f.copiarDe.value })],
      renombrar: ["Renombrar receta", () => campo("Receta", `<select name="receta">${opciones(bloquesRecetas(hojaModelo("Recetas")).map(b => b.nombre))}</select>`) + campo("Nombre nuevo", `<input name="nuevo" maxlength="50">`),
        f => renombrarReceta({ receta: f.receta.value, nuevo: nombreDe(f.nuevo) })],
      quitarReceta: ["Quitar receta", () => campo("Receta", `<select name="receta">${opciones(bloquesRecetas(hojaModelo("Recetas")).map(b => b.nombre))}</select>`),
        f => quitarReceta({ receta: f.receta.value })],
    },
    "Costos Fijos": {
      agregar: ["Agregar costo fijo", () => campo("Concepto", `<input name="nombre" maxlength="60" placeholder="Ej. Seguro">`) + campo("Monto mensual $", `<input name="monto" inputmode="decimal" placeholder="0">`),
        f => agregarCostoFijo({ nombre: nombreDe(f.nombre), monto: numeroObligatorio(f.monto, "el monto mensual", true) })],
      renombrar: ["Renombrar", () => { const { h, items } = costosFijos(); return campo("Concepto", `<select name="fila">${opciones(items, r => r, r => texto(h, r, 0))}</select>`) + campo("Nombre nuevo", `<input name="nuevo" maxlength="60">`); },
        f => renombrarCostoFijo({ fila: +f.fila.value, nuevo: nombreDe(f.nuevo) })],
      quitar: ["Quitar", () => { const { h, items } = costosFijos(); return campo("Concepto", `<select name="fila">${opciones(items, r => r, r => texto(h, r, 0))}</select>`); },
        f => quitarCostoFijo({ fila: +f.fila.value })],
    },
    Insumos: {
      agregar: ["Agregar al consumo mensual", () => {
        const ts = tablasConsumo(hojaModelo("Insumos")).map(t => t.nombre);
        const ins = insumosExistentes().filter(i => !/INGREDIENTE/i.test(i.seccion));
        return campo("Tabla", `<select name="tabla">${opciones(ts)}</select>`) + campo("Artículo", `<select name="insumo">${opciones(ins, i => i.nombre, i => `${i.nombre} (${i.seccion.toLowerCase()})`)}</select>`) +
          campo("Consumo mensual", `<input name="cantidad" inputmode="decimal" placeholder="1">`) + `<p class="agregar__nota">El artículo tiene que estar en Precios Insumos (Limpieza o Descartables).</p>`;
      }, f => {
        const insumo = insumosExistentes().find(i => i.nombre === f.insumo.value);
        if (!insumo) throw new Error("Elegí un artículo.");
        return agregarConsumo({ tabla: f.tabla.value, insumo, cantidad: numeroObligatorio(f.cantidad, "el consumo mensual") });
      }],
      quitar: ["Quitar del consumo", () => {
        const h = hojaModelo("Insumos");
        const items = tablasConsumo(h).flatMap(t => t.items.map(r => ({ v: `${t.nombre}|${r}`, n: `${texto(h, r, t.c0)} (${t.nombre.toLowerCase()})` })));
        return campo("Artículo", `<select name="articulo">${opciones(items, i => i.v, i => i.n)}</select>`);
      }, f => { const [tabla, fila] = f.articulo.value.split("|"); return quitarConsumo({ tabla, fila: +fila }); }],
    },
  };
  const nombreDe = inp => { const v = inp.value.trim().replace(/\s+/g, " "); if (!v) { inp.focus(); throw new Error("Escribí el nombre."); } return v; };
  const numeroEs = t => { const s = String(t || "").trim().replace(/\$/g, "").replace(/\s/g, ""); if (!s) return null; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s); return Number.isNaN(n) ? NaN : n; };
  function numeroObligatorio(inp, que, ceroVale = false) {
    const n = numeroEs(inp.value);
    if (n === null || Number.isNaN(n) || n < 0 || (!ceroVale && n === 0)) { inp.focus(); throw new Error(`Escribí ${que} (por ejemplo 1500 o 0,05).`); }
    return n;
  }

  let accionActual = {};
  function pintarAgregar(nombreHoja) {
    const caja = $("#costos-agregar");
    const acc = ACCIONES[nombreHoja];
    if (!acc) { caja.innerHTML = ""; caja.hidden = true; return; }
    const clave = acc[accionActual[nombreHoja]] ? accionActual[nombreHoja] : Object.keys(acc)[0];
    accionActual[nombreHoja] = clave;
    let cuerpo;
    try { cuerpo = acc[clave][1](); } catch { cuerpo = `<p class="agregar__nota">Esta pestaña no tiene la forma que espera esta acción.</p>`; }
    caja.innerHTML = `
      <div class="agregar">
        <div class="agregar__acciones" role="tablist" aria-label="Qué querés hacer">${Object.entries(acc).map(([k, [t]]) => `<button type="button" role="tab" data-accion-costos="${k}" aria-selected="${k === clave}">${esc(t)}</button>`).join("")}</div>
        <form class="agregar__form" data-accion="${clave}" novalidate>${cuerpo}<button class="btn btn--azul" type="submit">${esc(acc[clave][0])}</button></form>
      </div>
      <datalist id="costos-unidades"><option>Kg</option><option>L</option><option>Unidad</option><option>Pack x 3</option><option>Bidón 5 L</option><option>Rollo</option></datalist>`;
    caja.hidden = false;
    mostrarElegido(caja.querySelector(".agregar__acciones"));
  }
  /* En el celular las fichas se deslizan de costado: que la elegida quede a la vista */
  function mostrarElegido(fila) {
    const b = fila && fila.querySelector('[aria-selected="true"], [aria-current="page"]');
    if (b && fila.scrollWidth > fila.clientWidth) fila.scrollLeft = Math.max(0, b.offsetLeft - fila.offsetLeft - 16);
  }

  $("#costos-agregar").addEventListener("click", e => {
    const b = e.target.closest("[data-accion-costos]");
    if (!b) return;
    accionActual[hojaActual] = b.dataset.accionCostos;
    pintarAgregar(hojaActual);
    const primero = $("#costos-agregar form input, #costos-agregar form select"); if (primero) primero.focus();
  });
  /* Quitar ingrediente: al cambiar la receta se actualiza la lista de ingredientes */
  $("#costos-agregar").addEventListener("change", e => {
    if (!e.target.matches("[data-recarga]")) return;
    const sel = e.target.form.fila;
    sel.innerHTML = opciones(ingredientesDe(e.target.value), i => i.fila, i => i.nombre + (i.base ? " (base)" : ""));
  });
  $("#costos-agregar").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target;
    const acc = ACCIONES[hojaActual][f.dataset.accion];
    let res;
    try { res = acc[2](f); } catch (err) { avisar(err.message); return; }
    if (!res) return;   // cancelado
    sincronizarFormulas();
    fotosOtras = null; cambiosEnOtrasHojas("");
    formularioDe = null;
    const marcar = new Set(res.fila >= 0 ? Object.keys(hojaModelo(res.hoja).celdas).filter(k => XLSX.utils.decode_cell(k).r === res.fila) : []);
    dibujarHoja(res.hoja, { marcarCambios: marcar });
    const td = $("#costos-hoja td.c-cambio"); if (td) td.scrollIntoView({ block: "center", behavior: "smooth" });
    const errores = contarErrores();
    avisar(res.aviso + (errores ? ` Ojo: hay ${errores} fórmula${errores > 1 ? "s" : ""} con error.` : ""));
    programarGuardado();
  });
  function contarErrores() {
    let n = 0;
    for (const h of modelo.hojas) for (const [a, cel] of Object.entries(h.celdas)) {
      if (!cel.f || (AJUSTES[h.nombre]?.hastaCol !== undefined && XLSX.utils.decode_cell(a).c > AJUSTES[h.nombre].hastaCol)) continue;
      const { r, c } = XLSX.utils.decode_cell(a); const v = valor(h.nombre, r, c);
      if (v && typeof v === "object" && v.type) n++;
    }
    return n;
  }

  /* ---------- Mostrar el libro ---------- */
  function mostrarLibro() {
    $("#costos-vacio").hidden = !!modelo;
    $("#costos-libro").hidden = !modelo;
    $("#costos-exportar").hidden = !modelo;
    /* Con datos cargados, reemplazar con un Excel pasa a ser una opción discreta */
    const imp = $("#costos-importar");
    imp.className = modelo ? "btn-texto" : "btn btn--azul";
    imp.textContent = modelo ? "Reemplazar con un Excel" : "Cargar Excel";
    if (!modelo) return;
    $("#costos-hojas").innerHTML = modelo.hojas.map(h => `<button type="button" data-hoja="${esc(h.nombre)}">${esc(h.nombre)}</button>`).join("");
    let guardada = null;
    try { guardada = sessionStorage.getItem("penitentia.costos.hoja"); } catch { /* nada */ }
    fotosOtras = null; cambiosEnOtrasHojas("");
    formularioDe = null;
    dibujarHoja(guardada && modelo.hojas.some(h => h.nombre === guardada) ? guardada : modelo.hojas[0].nombre);
  }

  async function abrir() {
    if (cargando) return cargando;
    cargando = (async () => {
      estado("Cargando…", "guardando");
      try {
        await bibliotecas();
        modelo = await D.costos.leer();
        $("#costos-falta").hidden = true;
        if (modelo) armarMotor();
        mostrarLibro();
        estado(modelo ? "Guardado" : "", modelo ? "ok" : "");
      } catch (e) {
        cargando = null;
        $("#costos-falta").hidden = !e.faltaTabla;
        estado("", "");
        if (!e.faltaTabla) avisar("No se pudieron abrir los costos: " + e.message);
      }
    })();
    return cargando;
  }

  /* ---------- Cargar Excel ---------- */
  $("#costos-importar").addEventListener("click", () => $("#costos-archivo").click());
  $("#costos-archivo").addEventListener("change", async e => {
    const archivo = e.target.files[0]; e.target.value = "";
    if (!archivo) return;
    if (modelo && !window.confirm(`¿Reemplazar los costos de la web por los de «${archivo.name}»?\n\nLos cambios que hiciste acá y no están en ese Excel se pierden.`)) return;
    try {
      estado("Leyendo el Excel…", "guardando");
      await bibliotecas();
      const nuevo = leerExcel(await archivo.arrayBuffer(), archivo.name);
      if (!nuevo.hojas.length) throw new Error("El archivo no tiene pestañas.");
      modelo = nuevo;
      armarMotor();
      mostrarLibro();
      await guardarYa();
      const formulas = modelo.hojas.reduce((a, h) => a + Object.values(h.celdas).filter(c => c.f).length, 0);
      avisar(`Listo: ${modelo.hojas.length} pestañas y ${formulas} fórmulas cargadas.`);
    } catch (err) {
      estado("", "");
      avisar("No se pudo leer el Excel: " + err.message);
    }
  });

  /* ---------- Descargar Excel (con las fórmulas; los colores no viajan) ---------- */
  $("#costos-exportar").addEventListener("click", () => {
    const wb = XLSX.utils.book_new();
    for (const h of modelo.hojas) {
      const ws = {};
      for (const [a, cel] of Object.entries(h.celdas)) {
        const { r: row, c: col } = XLSX.utils.decode_cell(a);
        const v = cel.f ? valor(h.nombre, row, col) : cel.v;
        const x = {};
        if (typeof v === "number") { x.t = "n"; x.v = v; } else if (typeof v === "boolean") { x.t = "b"; x.v = v; }
        else if (v && typeof v === "object") { x.t = "e"; x.v = 15; } else { x.t = "s"; x.v = v ?? ""; }
        if (cel.f) x.f = cel.f;
        if (cel.z) x.z = cel.z;
        ws[a] = x;
      }
      ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: h.filas - 1, c: h.cols - 1 } });
      ws["!merges"] = h.merges.map(m => XLSX.utils.decode_range(m));
      ws["!cols"] = h.anchos.map(w => (w ? { wch: Math.max(4, (w - 10) / 7) } : {}));
      XLSX.utils.book_append_sheet(wb, ws, h.nombre);
    }
    const hoy = new Date().toLocaleDateString("es-AR").replace(/\//g, "-");
    XLSX.writeFile(wb, `Costos Penitentia (web ${hoy}).xlsx`);
  });

  /* ---------- Interacción con las celdas y las pestañas ---------- */
  $("#costos-hojas").addEventListener("click", e => { const b = e.target.closest("[data-hoja]"); if (b) dibujarHoja(b.dataset.hoja); });
  $("#costos-hoja").addEventListener("click", e => { const td = e.target.closest("td[data-dir]"); if (td) abrirEdicion(td); });
  $("#costos-hoja").addEventListener("keydown", e => {
    const td = e.target.closest("td[data-dir]");
    if (td && e.target === td && (e.key === "Enter" || e.key === "F2")) { e.preventDefault(); abrirEdicion(td); }
  });

  document.addEventListener("stock:vista", e => { if (e.detail === "costos") abrir(); });
  document.addEventListener("stock:salir", () => { modelo = null; hf = null; cargando = null; $("#costos-hoja").innerHTML = ""; });
  if (!$("#costos").hidden) abrir();
})();
