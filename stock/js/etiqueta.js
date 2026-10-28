/* =========================================================
   Etiqueta de cada variedad, igual a las originales en Word de
   «3 - Etiquetas/1 - Mozzarella … 7 - Americana» (100 × 150 mm,
   márgenes de 4 mm), con lote, vencimiento y contenido
   neto ya escritos. Cada pizza sale en su propia hoja.
   Los íconos y el logo son las mismas imágenes de esos Word (assets/etiqueta).
   ========================================================= */

(function () {
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fechaAR = iso => iso.split("-").reverse().join("/");
  const A = "assets/etiqueta/";

  function html(p, v) {
    const peso = p.peso ? esc(p.peso) : '<span class="etq__vacio"></span>';
    return `
<article class="etq">
  <header class="etq__cabecera">
    <img src="${A}logo.png" alt="">
    <p>CONGELADA · A LA PIEDRA</p>
  </header>

  <h1 class="etq__sabor">${esc(v.nombre)}</h1>
  <p class="etq__bajada">Pizza congelada lista para tu horno.</p>

  <section class="etq__datos">
    <div><span class="etq__rotulo">Contenido neto</span><strong>${peso} g</strong></div>
    <div><span class="etq__rotulo">Lote</span><strong class="etq__lote">${esc(p.codigo)}</strong></div>
    <div><span class="etq__rotulo">Vencimiento</span><strong>${fechaAR(p.vencimiento)}</strong></div>
  </section>

  <h2 class="etq__titulo">Conservación y preparación</h2>
  <ul class="etq__pasos">
    <li><img src="${A}frio.png" alt="">Conservar en freezer a -18 °C o menos. Mantener la cadena de frío. Una vez descongelada, no volver a congelar.</li>
    <li><img src="${A}horno.png" alt="">Retirar todo el envase. Colocar la pizza congelada sobre una bandeja apta para horno y llevar a horno precalentado entre 200 y 220&nbsp;°C (250&nbsp;°C para una base más crujiente).</li>
    <li><img src="${A}reloj.png" alt="">Cocinar completamente antes de consumir. El tiempo depende del horno y del producto. Tiempo estimado: ${esc(v.horno)} minutos.</li>
  </ul>

  <h2 class="etq__titulo">Ingredientes</h2>
  <p class="etq__ingredientes">${esc(v.ingredientes)}</p>
  <p class="etq__alergenos">${esc(v.alergenos)}</p>

  <footer class="etq__pie">
    <img class="etq__qr" src="${A}qr.png" alt="">
    <div>
      <strong>Escaneá y pedí tu próxima Penitentia.</strong>
      <p class="etq__web">penitentia.com.ar</p>
      <p class="etq__red"><img src="${A}whatsapp.png" alt=""><b>261 725 2048</b></p>
      <p class="etq__red"><img src="${A}instagram.png" alt=""><b>@penitentia.ar</b></p>
    </div>
  </footer>
</article>`;
  }

  /* El texto que no entra en una línea se achica hasta entrar (sabor y lote) */
  function ajustar(el, desde, minimo) {
    let t = desde;
    el.style.fontSize = t + "pt";
    while (el.scrollWidth > el.clientWidth && t > minimo) { t -= .25; el.style.fontSize = t + "pt"; }
  }

  window.imprimirEtiquetas = async function (pizzas) {
    const caja = document.getElementById("impresion");
    const porId = Object.fromEntries(window.VARIEDADES.map(v => [v.id, v]));
    caja.innerHTML = pizzas.map(p => html(p, porId[p.variedad])).join("");
    caja.querySelectorAll(".etq__sabor").forEach(h => ajustar(h, 23.5, 12));
    caja.querySelectorAll(".etq__lote").forEach(l => ajustar(l, 10, 7));
    await Promise.all([...caja.querySelectorAll("img")].map(img => img.decode().catch(() => {})));
    window.print();
  };
})();
