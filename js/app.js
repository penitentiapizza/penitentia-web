(function () {
  "use strict";

  var PRODUCTOS = window.PENITENTIA_PRODUCTOS || [];
  var CONTACTO = window.PENITENTIA_CONTACTO || {};
  var CLAVE = "penitentia-pedido-v1";

  var $ = function (sel, raiz) { return (raiz || document).querySelector(sel); };
  var $$ = function (sel, raiz) { return Array.prototype.slice.call((raiz || document).querySelectorAll(sel)); };

  var formatoPesos = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  var pesos = function (n) { return formatoPesos.format(n).replace(/ /g, " "); };
  var porId = function (id) { return PRODUCTOS.filter(function (p) { return p.id === id; })[0]; };

  /* ---------- Estado del pedido (se guarda en este navegador) ---------- */
  var pedido = leer();

  function leer() {
    try {
      var datos = JSON.parse(localStorage.getItem(CLAVE) || "{}");
      var limpio = {};
      Object.keys(datos).forEach(function (id) {
        var p = porId(id);
        if (p && p.disponible !== false && datos[id] > 0) limpio[id] = Math.min(99, Math.floor(datos[id]));
      });
      return limpio;
    } catch (e) { return {}; }
  }
  function guardar() {
    try { localStorage.setItem(CLAVE, JSON.stringify(pedido)); } catch (e) { /* modo privado: seguimos sin guardar */ }
  }
  function unidades() { return Object.keys(pedido).reduce(function (t, id) { return t + pedido[id]; }, 0); }
  function total() { return Object.keys(pedido).reduce(function (t, id) { return t + pedido[id] * porId(id).precio; }, 0); }

  function cambiar(id, cantidad) {
    cantidad = Math.max(0, Math.min(99, cantidad));
    if (cantidad === 0) delete pedido[id]; else pedido[id] = cantidad;
    guardar();
    pintarTodo();
  }

  /* ---------- Catálogo ---------- */
  var grilla = $("#grilla");
  var seleccion = {}; // cantidad elegida en cada tarjeta antes de agregar

  function pintarCatalogo() {
    grilla.innerHTML = PRODUCTOS.map(function (p) {
      var hay = p.disponible !== false;
      seleccion[p.id] = seleccion[p.id] || 1;
      return (
        '<article class="pizza" data-id="' + p.id + '" data-entra>' +
          '<div class="pizza__foto">' +
            '<img src="' + p.foto + '" alt="Pizza ' + p.nombre + '" loading="lazy" width="800" height="470">' +
            '<span class="pizza__sello">' + (hay ? "Congelada" : "Sin stock") + '</span>' +
          '</div>' +
          '<div class="pizza__cuerpo">' +
            '<h3 class="pizza__nombre">' + p.nombre + '</h3>' +
            '<p class="pizza__desc">' + p.descripcion + '</p>' +
            '<div class="pizza__pie">' +
              '<p class="pizza__precio">' + pesos(p.precio) + '</p>' +
              '<div class="cantidad" role="group" aria-label="Cantidad de ' + p.nombre + '">' +
                '<button type="button" data-menos aria-label="Una menos"' + (hay ? "" : " disabled") + '>−</button>' +
                '<output data-sel>' + seleccion[p.id] + '</output>' +
                '<button type="button" data-mas aria-label="Una más"' + (hay ? "" : " disabled") + '>+</button>' +
              '</div>' +
              '<button type="button" class="pizza__agregar" data-agregar' + (hay ? "" : " disabled") + '>' +
                (hay ? "Agregar" : "Sin stock") +
              '</button>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join("");
  }

  grilla.addEventListener("click", function (ev) {
    var tarjeta = ev.target.closest(".pizza");
    if (!tarjeta) return;
    var id = tarjeta.getAttribute("data-id");
    var salida = $("[data-sel]", tarjeta);
    if (ev.target.closest("[data-mas]")) seleccion[id] = Math.min(20, seleccion[id] + 1);
    else if (ev.target.closest("[data-menos]")) seleccion[id] = Math.max(1, seleccion[id] - 1);
    else if (ev.target.closest("[data-agregar]")) {
      cambiar(id, (pedido[id] || 0) + seleccion[id]);
      confirmarBoton(ev.target.closest("[data-agregar]"));
      avisar(seleccion[id] + " × " + porId(id).nombre + " al pedido");
      seleccion[id] = 1;
      saltarContador();
    }
    salida.textContent = seleccion[id];
  });

  function confirmarBoton(boton) {
    boton.textContent = "Sumada";
    boton.classList.add("listo");
    clearTimeout(boton._t);
    boton._t = setTimeout(function () { boton.textContent = "Agregar"; boton.classList.remove("listo"); }, 1400);
  }

  /* ---------- Carrito ---------- */
  var carrito = $("#carrito");
  var velo = $(".velo");
  var lista = $("[data-items]");
  var form = $("[data-form]");
  var ultimoFoco = null;

  function pintarCarrito() {
    var ids = Object.keys(pedido);
    var vacio = ids.length === 0;
    $("[data-vacio]").hidden = !vacio;
    form.hidden = vacio;
    $("[data-pie-carrito]").hidden = vacio;

    lista.innerHTML = ids.map(function (id) {
      var p = porId(id), c = pedido[id];
      return (
        '<li class="item" data-id="' + id + '">' +
          '<img src="' + p.foto + '" alt="" width="64" height="64">' +
          '<div>' +
            '<p class="item__nombre">' + p.nombre + '</p>' +
            '<p class="item__unit">' + pesos(p.precio) + ' c/u</p>' +
            '<div class="cantidad cantidad--chica" role="group" aria-label="Cantidad de ' + p.nombre + '" style="margin-top:8px">' +
              '<button type="button" data-menos aria-label="Una menos">−</button>' +
              '<output>' + c + '</output>' +
              '<button type="button" data-mas aria-label="Una más">+</button>' +
            '</div>' +
          '</div>' +
          '<div class="item__der">' +
            '<span class="item__sub">' + pesos(p.precio * c) + '</span>' +
            '<button type="button" class="item__quitar" data-quitar>Quitar</button>' +
          '</div>' +
        '</li>'
      );
    }).join("");

    $("[data-total]").textContent = pesos(total());
  }

  lista.addEventListener("click", function (ev) {
    var fila = ev.target.closest(".item");
    if (!fila) return;
    var id = fila.getAttribute("data-id");
    if (ev.target.closest("[data-mas]")) cambiar(id, pedido[id] + 1);
    else if (ev.target.closest("[data-menos]")) cambiar(id, pedido[id] - 1);
    else if (ev.target.closest("[data-quitar]")) cambiar(id, 0);
  });

  function abrir() {
    ultimoFoco = document.activeElement;
    pintarCarrito();
    carrito.hidden = false; velo.hidden = false;
    requestAnimationFrame(function () { carrito.classList.add("abierto"); velo.classList.add("visible"); });
    document.body.style.overflow = "hidden";
    $$("[data-abrir-carrito]").forEach(function (b) { b.setAttribute("aria-expanded", "true"); });
    setTimeout(function () { $(".cerrar", carrito).focus(); }, 60);
  }
  function cerrar() {
    carrito.classList.remove("abierto"); velo.classList.remove("visible");
    document.body.style.overflow = "";
    $$("[data-abrir-carrito]").forEach(function (b) { b.setAttribute("aria-expanded", "false"); });
    setTimeout(function () { carrito.hidden = true; velo.hidden = true; }, 320);
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus();
  }
  $$("[data-abrir-carrito]").forEach(function (b) { b.addEventListener("click", abrir); });
  $$("[data-cerrar-carrito]").forEach(function (b) { b.addEventListener("click", cerrar); });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && !carrito.hidden) cerrar();
    if (ev.key === "Tab" && !carrito.hidden) atraparFoco(ev);
  });
  function atraparFoco(ev) {
    var focos = $$('button, a[href], input, textarea', carrito).filter(function (el) { return el.offsetParent !== null && !el.disabled; });
    if (!focos.length) return;
    var primero = focos[0], ultimo = focos[focos.length - 1];
    if (ev.shiftKey && document.activeElement === primero) { ev.preventDefault(); ultimo.focus(); }
    else if (!ev.shiftKey && document.activeElement === ultimo) { ev.preventDefault(); primero.focus(); }
  }

  /* Dirección solo si elige envío */
  var campoDir = $("[data-campo-direccion]");
  form.addEventListener("change", function (ev) {
    if (ev.target.name === "entrega") campoDir.hidden = ev.target.value !== "Envío";
  });

  /* ---------- Enviar a WhatsApp ---------- */
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var error = $("[data-error]");
    var nombre = form.nombre.value.trim();
    var entrega = (form.querySelector('input[name="entrega"]:checked') || {}).value || "Retiro";
    var direccion = form.direccion.value.trim();
    var notas = form.notas.value.trim();

    $$(".invalido", form).forEach(function (el) { el.classList.remove("invalido"); });
    if (!unidades()) return;
    if (!nombre) return fallar(form.nombre, "Contanos a nombre de quién va el pedido.");
    if (entrega === "Envío" && !direccion) return fallar(form.direccion, "Falta la dirección para el envío.");
    error.hidden = true;

    var lineas = ["¡Hola Penitentia! Quiero hacer este pedido:", ""];
    Object.keys(pedido).forEach(function (id) {
      var p = porId(id);
      lineas.push("• " + pedido[id] + " × " + p.nombre + " — " + pesos(p.precio * pedido[id]));
    });
    lineas.push("", "Total: " + pesos(total()) + " (" + unidades() + (unidades() === 1 ? " pizza" : " pizzas") + ")", "");
    lineas.push("Nombre: " + nombre);
    lineas.push("Entrega: " + entrega + (entrega === "Envío" ? " — " + direccion : ""));
    if (notas) lineas.push("Comentarios: " + notas);

    window.open(enlaceWa(lineas.join("\n")), "_blank", "noopener");

    function fallar(campo, texto) {
      error.textContent = texto; error.hidden = false;
      campo.classList.add("invalido"); campo.focus();
    }
  });

  function enlaceWa(texto) {
    return "https://wa.me/" + CONTACTO.whatsapp + (texto ? "?text=" + encodeURIComponent(texto) : "");
  }

  /* ---------- Indicadores ---------- */
  var flotante = $(".flotante");
  function pintarIndicadores() {
    var n = unidades();
    $("[data-contador]").textContent = n;
    $("[data-total-flotante]").textContent = pesos(total());
    flotante.hidden = n === 0;
    document.body.classList.toggle("con-flotante", n > 0);
  }
  function saltarContador() {
    var c = $("[data-contador]");
    c.classList.remove("salto"); void c.offsetWidth; c.classList.add("salto");
  }
  var temporizador;
  function avisar(texto) {
    var t = $("[data-toast]");
    t.textContent = texto; t.hidden = false;
    t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(temporizador);
    temporizador = setTimeout(function () { t.hidden = true; }, 2200);
  }

  function pintarTodo() {
    pintarIndicadores();
    if (!carrito.hidden) pintarCarrito();
  }

  /* ---------- Contacto ---------- */
  $$("[data-wa]").forEach(function (a) {
    a.href = enlaceWa("¡Hola Penitentia! Quería hacerles una consulta.");
    a.target = "_blank"; a.rel = "noopener";
  });
  $$("[data-wa-visible]").forEach(function (el) { el.textContent = CONTACTO.whatsappVisible; });
  $$("[data-mail]").forEach(function (a) { a.href = "mailto:" + CONTACTO.email + "?subject=" + encodeURIComponent("Consulta desde la web"); });
  $$("[data-ig]").forEach(function (a) { a.href = "https://www.instagram.com/" + CONTACTO.instagram + "/"; });
  $$("[data-anio]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* Sombra de la barra al bajar */
  var barra = $("#barra");
  window.addEventListener("scroll", function () { barra.classList.toggle("con-sombra", window.scrollY > 8); }, { passive: true });

  /* Precio "desde" en la portada */
  var precios = PRODUCTOS.filter(function (p) { return p.disponible !== false; }).map(function (p) { return p.precio; });
  if (precios.length) $$("[data-desde]").forEach(function (el) { el.textContent = pesos(Math.min.apply(null, precios)); });

  pintarCatalogo();
  pintarTodo();
  // Se mide después de la carga, cuando el navegador ya saltó a un #enlace
  if (document.readyState === "complete") requestAnimationFrame(prepararEntradas);
  else window.addEventListener("load", function () { requestAnimationFrame(prepararEntradas); });
  prepararVideo();

  /* ---------- Movimiento: entradas por sección ---------- */
  function prepararEntradas() {
    var quieto = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (quieto || !("IntersectionObserver" in window)) return;
    if (location.hash && location.hash !== "#inicio") return; // llegó a una sección: mostrar todo de una
    var piezas = $$("[data-entra]").filter(function (el) { return el.getBoundingClientRect().top > window.innerHeight * .92; });
    // Escalonado dentro de cada grupo (encabezado, texto, fotos, filas)
    var grupos = new Map();
    piezas.forEach(function (el) {
      var padre = el.parentElement;
      var i = grupos.get(padre) || 0;
      el.style.setProperty("--retraso", Math.min(i, 5) * 80 + "ms");
      grupos.set(padre, i + 1);
      el.classList.add("espera");
    });
    var io = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (e) { if (e.isIntersecting) mostrar(e.target); });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .12 });
    piezas.forEach(function (el) { io.observe(el); });
    function mostrar(el) { el.classList.remove("espera"); io.unobserve(el); }
    // Red de seguridad: además del observador, revisar al hacer scroll para que nada quede oculto
    var pendiente = false;
    function revisar() {
      pendiente = false;
      var limite = window.innerHeight * .95;
      $$(".espera").forEach(function (el) { if (el.getBoundingClientRect().top < limite) mostrar(el); });
      if (!$(".espera")) window.removeEventListener("scroll", alScroll);
    }
    function alScroll() { if (!pendiente) { pendiente = true; requestAnimationFrame(revisar); setTimeout(revisar, 200); } }
    window.addEventListener("scroll", alScroll, { passive: true });
  }

  /* El video del horno solo corre cuando se ve, y nunca con movimiento reducido */
  function prepararVideo() {
    var v = $(".preparacion__video video");
    if (!v) return;
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); return; }
    if (!("IntersectionObserver" in window)) return;
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause();
    }).observe(v);
  }
})();
