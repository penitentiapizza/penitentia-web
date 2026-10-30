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
  const lista = (hoja, c1, c2, desde, hasta) => {
    const out = [];
    for (let r = desde; r <= hasta; r++) {
      const n = valor(hoja, r, c1), v = valor(hoja, r, c2);
      if (n !== null && n !== "" && typeof n !== "object") out.push({ n: String(n), v: typeof v === "number" ? v : null });
    }
    return out;
  };
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
  const GRAFICOS = {
    /* Costo y precio de venta de cada pizza: punto hueco = costo, punto lleno = precio; la línea entre los dos es el margen */
    costoPrecio(h) {
      const n = lista(h, 13, 14, 1, 7).map((d, i) => ({ ...d, p: valor(h, i + 1, 15) }));
      const max = Math.max(1, ...n.map(d => Math.max(d.v || 0, typeof d.p === "number" ? d.p : 0)));
      const x = v => ((v || 0) / max * 100).toFixed(1);
      return tarjeta("Costo vs. precio de venta por pizza", `
        <p class="grafico__ley"><span class="punto punto--hueco"></span>Costo <span class="punto"></span>Precio de venta</p>
        <div class="gbarras">${n.map(d => `
          <div class="gbarra gbarra--doble" title="${esc(d.n)}: costo ${plata(d.v)}, precio ${plata(d.p)}">
            <span class="gbarra__n">${esc(d.n)}</span>
            <span class="gbarra__pista"><span class="pesa" style="left:${x(d.v)}%;width:${(x(d.p) - x(d.v)).toFixed(1)}%"></span><span class="punto punto--hueco" style="left:${x(d.v)}%"></span><span class="punto" style="left:${x(d.p)}%"></span></span>
            <span class="gbarra__v">${plata(d.v)} → ${plata(d.p)}</span>
          </div>`).join("")}</div>`);
    },
    margen: h => barras(lista(h, 13, 16, 1, 7), plata, "Margen por pizza"),
    fijos: h => barras(lista(h, 18, 19, 1, 7).sort((a, b) => (b.v || 0) - (a.v || 0)), plata, "Composición de costos fijos mensuales"),
    insumos: h => barras(lista(h, 20, 21, 1, 3), v => (v ?? "—").toString(), "Cantidad de insumos por categoría"),
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
     AGREGAR INSUMOS E INGREDIENTES
     Se inserta un renglón ANTES del último de la sección o del bloque:
     así las sumas (SUMA, CONTARA) se agrandan solas, como en Excel
     cuando insertás una fila dentro del rango.
     ========================================================= */
  const hojaModelo = n => modelo.hojas.find(h => h.nombre === n);
  const texto = (h, r, c) => { const x = h.celdas[dir(r, c)]; const v = x ? (x.f ? valor(h.nombre, r, c) : x.v) : null; return typeof v === "string" ? v.trim() : v; };

  /* Precios Insumos: secciones = renglones con relleno de sección (INGREDIENTES, LIMPIEZA, DESCARTABLES) */
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
    return seccionesInsumos(h).flatMap(s => s.items.map(r => ({ nombre: texto(h, r, 0), unidad: texto(h, r, 1) || "", seccion: s.nombre })));
  }

  /* Recetas: bloques «Receta: X» hasta «COSTO TOTAL DEL PLATO» */
  function bloquesRecetas(h) {
    const out = [];
    let actual = null;
    for (let r = 0; r < h.filas; r++) {
      const a = texto(h, r, 0);
      if (typeof a === "string" && /Receta:/i.test(a) && !h.celdas[dir(r, 0)].f) actual = { nombre: a.split(/Receta:/i)[1].trim(), titulo: r, desde: r + 3 };
      else if (actual && typeof a === "string" && /COSTO TOTAL DEL PLATO/i.test(a)) { actual.hasta = r - 1; actual.total = r; out.push(actual); actual = null; }
    }
    for (const b of out) {
      b.libres = []; b.molde = null; b.usados = [];
      for (let r = b.desde; r <= b.hasta; r++) {
        const [xa, xc, xf] = [0, 2, 5].map(c => h.celdas[dir(r, c)]);
        const vacia = [xa, xc, xf].every(x => !x || (!x.f && (x.v === undefined || x.v === null || x.v === "")));
        if (vacia) b.libres.push(r); else b.usados.push(r);
        if (xc && xc.f && /VLOOKUP/i.test(xc.f)) b.molde = r;   // el último renglón «normal» sirve de molde
      }
    }
    return out;
  }

  /* Inserta un renglón vacío en la posición r de la hoja (el motor corre fórmulas y rangos; el modelo corre estilos) */
  function insertarFila(h, r) {
    hf.addRows(hf.getSheetId(h.nombre), [r, 1]);
    const nuevas = {};
    for (const [a, cel] of Object.entries(h.celdas)) {
      const { r: f, c } = XLSX.utils.decode_cell(a);
      nuevas[dir(f >= r ? f + 1 : f, c)] = cel;
    }
    h.celdas = nuevas;
    h.merges = h.merges.map(m => {
      const g = XLSX.utils.decode_range(m);
      if (g.s.r >= r) g.s.r++;
      if (g.e.r >= r) g.e.r++;
      return XLSX.utils.encode_range(g);
    });
    h.filas++;
    sincronizarFormulas();
  }
  /* Después de insertar, las fórmulas de todas las hojas se toman del motor (ya corregidas) */
  function sincronizarFormulas() {
    for (const h of modelo.hojas) {
      const id = hf.getSheetId(h.nombre);
      for (const [a, cel] of Object.entries(h.celdas)) {
        if (!cel.f) continue;
        const { r: row, c: col } = XLSX.utils.decode_cell(a);
        const f = hf.getCellFormula({ sheet: id, row, col });
        if (f) cel.f = f.slice(1);
      }
    }
  }
  /* Copia un renglón (fórmulas relativas corridas por el motor) y le pone los valores dados por columna */
  function copiarFila(h, desde, hacia, valores) {
    const id = hf.getSheetId(h.nombre);
    const ultima = h.cols - 1;
    hf.copy({ start: { sheet: id, row: desde, col: 0 }, end: { sheet: id, row: desde, col: ultima } });
    hf.paste({ sheet: id, row: hacia, col: 0 });
    for (let c = 0; c <= ultima; c++) {
      const origen = h.celdas[dir(desde, c)];
      const s = hf.getCellSerialized({ sheet: id, row: hacia, col: c });
      const cel = {};
      if (typeof s === "string" && s.startsWith("=")) cel.f = s.slice(1); else if (s !== null && s !== undefined && s !== "") cel.v = s;
      if (origen?.z) cel.z = origen.z;
      if (origen?.c) cel.c = origen.c;
      if (c in valores) { delete cel.f; delete cel.v; if (valores[c] !== null && valores[c] !== "") cel.v = valores[c]; }
      if (Object.keys(cel).length) h.celdas[dir(hacia, c)] = cel; else delete h.celdas[dir(hacia, c)];
      if (c in valores) hf.setCellContents({ sheet: id, row: hacia, col: c }, [[cel.v ?? null]]);
    }
  }

  function agregarInsumo({ nombre, unidad, precio, seccion }) {
    const h = hojaModelo("Precios Insumos");
    if (insumosExistentes().some(i => i.nombre.toLowerCase() === nombre.toLowerCase())) throw new Error(`«${nombre}» ya está en la lista.`);
    const s = seccionesInsumos(h).find(x => x.nombre === seccion);
    if (!s || !s.items.length) throw new Error("No encontré la sección " + seccion + ".");
    const ultimo = s.items.at(-1);
    insertarFila(h, ultimo);                       // queda vacío en «ultimo»; el que era último baja uno
    copiarFila(h, ultimo + 1, ultimo, { 0: nombre, 1: unidad, 2: precio });
    return { hoja: h.nombre, fila: ultimo };
  }

  function agregarIngrediente({ receta, insumo, cantidad, merma }) {
    const h = hojaModelo("Recetas");
    const b = bloquesRecetas(h).find(x => x.nombre === receta);
    if (!b) throw new Error("No encontré la receta " + receta + ".");
    if (b.molde === null) throw new Error("Esa receta no tiene un renglón de ingrediente para copiar.");
    for (const r of b.usados) if (String(texto(h, r, 0) || "").toLowerCase() === insumo.nombre.toLowerCase()) throw new Error(`«${insumo.nombre}» ya está en ${receta}.`);
    let fila = b.libres[0];
    let molde = b.molde;
    if (fila === undefined) {                      // sin renglones libres: se inserta antes del último
      fila = b.hasta;
      insertarFila(h, fila);
      if (molde >= fila) molde++;
    }
    copiarFila(h, molde, fila, { 0: insumo.nombre, 1: insumo.unidad, 3: cantidad, 4: merma });
    return { hoja: h.nombre, fila };
  }

  /* ---------- Formularios ---------- */
  function pintarAgregar(nombreHoja) {
    const caja = $("#costos-agregar");
    if (nombreHoja === "Precios Insumos") {
      const secs = seccionesInsumos(hojaModelo(nombreHoja)).map(s => s.nombre);
      caja.innerHTML = `
        <form class="agregar" data-agregar="insumo" novalidate>
          <p class="agregar__tit">Agregar insumo</p>
          <label class="campo campo--linea"><span>Nombre</span><input name="nombre" required maxlength="60" placeholder="Ej. Rúcula"></label>
          <label class="campo campo--linea"><span>Sección</span><select name="seccion">${secs.map(s => `<option>${esc(s)}</option>`).join("")}</select></label>
          <label class="campo campo--linea"><span>Unidad</span><input name="unidad" list="costos-unidades" maxlength="30" placeholder="Kg"></label>
          <label class="campo campo--linea"><span>Precio de compra $</span><input name="precio" inputmode="decimal" placeholder="0"></label>
          <button class="btn btn--azul" type="submit">Agregar</button>
          <datalist id="costos-unidades"><option>Kg</option><option>L</option><option>Unidad</option><option>Pack x 3</option><option>Bidón 5 L</option><option>Rollo</option></datalist>
        </form>`;
    } else if (nombreHoja === "Recetas") {
      const bloques = bloquesRecetas(hojaModelo(nombreHoja));
      const ins = insumosExistentes().filter(i => /INGREDIENTE/i.test(i.seccion));
      caja.innerHTML = `
        <form class="agregar" data-agregar="ingrediente" novalidate>
          <p class="agregar__tit">Agregar ingrediente a una receta</p>
          <label class="campo campo--linea"><span>Receta</span><select name="receta">${bloques.map(b => `<option>${esc(b.nombre)}</option>`).join("")}</select></label>
          <label class="campo campo--linea"><span>Insumo</span><select name="insumo">${ins.map(i => `<option value="${esc(i.nombre)}">${esc(i.nombre)} (${esc(i.unidad || "—")})</option>`).join("")}</select></label>
          <label class="campo campo--linea"><span>Cantidad por pizza</span><input name="cantidad" inputmode="decimal" placeholder="Ej. 0,05"></label>
          <label class="campo campo--linea"><span>Merma %</span><input name="merma" inputmode="decimal" placeholder="0"></label>
          <button class="btn btn--azul" type="submit">Agregar</button>
          <p class="agregar__nota">La cantidad va en la unidad del insumo: 0,05 Kg son 50 g. ¿No está el insumo? Agregalo primero en Precios Insumos.</p>
        </form>`;
    } else { caja.innerHTML = ""; }
    caja.hidden = !caja.innerHTML;
  }

  const numeroEs = t => { const s = String(t || "").trim().replace(/\$/g, "").replace(/\s/g, ""); if (!s) return null; const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s); return Number.isNaN(n) ? NaN : n; };

  $("#costos-agregar").addEventListener("submit", e => {
    e.preventDefault();
    const f = e.target, tipo = f.dataset.agregar;
    const hAntes = hojaModelo(tipo === "insumo" ? "Precios Insumos" : "Recetas");
    const antes = foto(hAntes), filasAntes = hAntes.filas;
    let res;
    try {
      if (tipo === "insumo") {
        const nombre = f.nombre.value.trim().replace(/\s+/g, " ");
        const precio = numeroEs(f.precio.value);
        if (!nombre) { f.nombre.focus(); throw new Error("Escribí el nombre del insumo."); }
        if (precio === null || Number.isNaN(precio) || precio < 0) { f.precio.focus(); throw new Error("Escribí el precio de compra (por ejemplo 5000 o 5.000,50)."); }
        res = agregarInsumo({ nombre, unidad: f.unidad.value.trim() || "Unidad", precio, seccion: f.seccion.value });
        avisar(`«${nombre}» agregado a ${f.seccion.value}. Ya lo podés usar en las recetas.`);
      } else {
        const insumo = insumosExistentes().find(i => i.nombre === f.insumo.value);
        const cantidad = numeroEs(f.cantidad.value);
        let merma = numeroEs(f.merma.value) ?? 0;
        if (!insumo) throw new Error("Elegí un insumo.");
        if (cantidad === null || Number.isNaN(cantidad) || cantidad <= 0) { f.cantidad.focus(); throw new Error("Escribí la cantidad por pizza (por ejemplo 0,05)."); }
        if (Number.isNaN(merma) || merma < 0) { f.merma.focus(); throw new Error("La merma tiene que ser un número (por ejemplo 5)."); }
        if (merma >= 1) merma = merma / 100;
        res = agregarIngrediente({ receta: f.receta.value, insumo, cantidad, merma });
        avisar(`${insumo.nombre} agregado a ${f.receta.value}. Costos y precios recalculados.`);
      }
    } catch (err) { avisar(err.message); return; }
    fotosOtras = null; cambiosEnOtrasHojas("");
    const h = hojaModelo(res.hoja);
    const despues = foto(h);
    /* Se resalta el renglón nuevo y, si no se corrieron filas, también lo que se recalculó */
    const corrida = h.filas !== filasAntes;
    const nuevas = new Set([...despues.keys()].filter(k => XLSX.utils.decode_cell(k).r === res.fila || (!corrida && despues.get(k) !== antes.get(k))));
    formularioDe = null;
    dibujarHoja(res.hoja, { marcarCambios: nuevas });
    const td = $(`#costos-hoja td.c-cambio`); if (td) td.scrollIntoView({ block: "center", behavior: "smooth" });
    programarGuardado();
  });

  /* ---------- Mostrar el libro ---------- */
  function mostrarLibro() {
    $("#costos-vacio").hidden = !!modelo;
    $("#costos-libro").hidden = !modelo;
    $("#costos-exportar").hidden = !modelo;
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
