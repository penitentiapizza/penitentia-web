/* =========================================================
   Dónde se guardan las pizzas.
   - Con claves en config.js → Supabase (usuarios reales, se ve igual en
     todos los equipos).
   - Sin claves → modo prueba, en este navegador (localStorage).
   Las dos versiones exponen lo mismo: sesion, entrar, salir, listar,
   crear, actualizar.
   ========================================================= */

(function () {
  const cfg = window.STOCK_CONFIG || {};
  const conSupabase = Boolean(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase);

  /* «jere» → «jere@penitentia.com.ar»: así se entra con un usuario corto */
  const comoEmail = u => (u.includes("@") ? u : u + "@penitentia.com.ar").trim().toLowerCase();

  /* ---------- Supabase ---------- */
  function crearSupabase() {
    const sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    const tabla = () => sb.from("pizzas");
    const falla = (error) => { if (error) throw new Error(error.message); };

    return {
      modo: "nube",
      async sesion() {
        const { data } = await sb.auth.getSession();
        return data.session ? { usuario: data.session.user.email.replace("@penitentia.com.ar", "") } : null;
      },
      async entrar(usuario, clave) {
        const { error } = await sb.auth.signInWithPassword({ email: comoEmail(usuario), password: clave });
        if (error) throw new Error(/invalid/i.test(error.message) ? "Usuario o contraseña incorrectos." : error.message);
        return this.sesion();
      },
      async salir() { await sb.auth.signOut(); },
      async listar() {
        const filas = [];
        for (let desde = 0; ; desde += 1000) {
          const { data, error } = await tabla().select("*").order("creada_el", { ascending: false }).range(desde, desde + 999);
          falla(error);
          filas.push(...data);
          if (data.length < 1000) return filas;
        }
      },
      async crear(pizzas) {
        const { data, error } = await tabla().insert(pizzas).select();
        if (error && error.code === "23505") throw Object.assign(new Error("Código repetido"), { repetido: true });
        falla(error);
        return data;
      },
      async actualizar(ids, campos) {
        const { data, error } = await tabla().update(campos).in("id", ids).select();
        falla(error);
        return data;
      },
      /* Borra para siempre; sólo pizzas dadas de baja. Devuelve los id borrados. */
      async eliminar(ids) {
        const { data, error } = await tabla().delete().in("id", ids).eq("estado", "baja").select("id");
        falla(error);
        return data.map(p => p.id);
      },
    };
  }

  /* ---------- Modo prueba (este navegador) ---------- */
  function crearLocal() {
    const K = { pizzas: "penitentia.stock.pizzas", usuario: "penitentia.stock.usuario", sesion: "penitentia.stock.sesion" };
    const leer = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
    const guardar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
    const hash = async (texto) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("penitentia:" + texto));
      return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
    };

    return {
      modo: "prueba",
      hayUsuario: () => Boolean(leer(K.usuario, null)),
      async sesion() {
        const s = leer(K.sesion, null);
        return s ? { usuario: s } : null;
      },
      async entrar(usuario, clave) {
        const u = usuario.trim().toLowerCase();
        const guardado = leer(K.usuario, null);
        const h = await hash(u + ":" + clave);
        if (!guardado) guardar(K.usuario, { u, h });          // la primera vez se crea el usuario
        else if (guardado.u !== u || guardado.h !== h) throw new Error("Usuario o contraseña incorrectos.");
        guardar(K.sesion, u);
        return { usuario: u };
      },
      async salir() { try { localStorage.removeItem(K.sesion); } catch { /* nada */ } },
      async listar() { return leer(K.pizzas, []); },
      async crear(pizzas) {
        const todas = leer(K.pizzas, []);
        const usados = new Set(todas.map(p => p.codigo));
        if (pizzas.some(p => usados.has(p.codigo))) throw Object.assign(new Error("Código repetido"), { repetido: true });
        const ahora = new Date().toISOString();
        const nuevas = pizzas.map(p => ({ id: crypto.randomUUID(), estado: "stock", vendida_el: null, canal: null, nota: null, creada_el: ahora, ...p }));
        guardar(K.pizzas, [...nuevas, ...todas]);
        return nuevas;
      },
      async actualizar(ids, campos) {
        const set = new Set(ids);
        const todas = leer(K.pizzas, []).map(p => (set.has(p.id) ? { ...p, ...campos } : p));
        guardar(K.pizzas, todas);
        return todas.filter(p => set.has(p.id));
      },
      async eliminar(ids) {
        const set = new Set(ids);
        const todas = leer(K.pizzas, []);
        const borradas = todas.filter(p => set.has(p.id) && p.estado === "baja").map(p => p.id);
        guardar(K.pizzas, todas.filter(p => !borradas.includes(p.id)));
        return borradas;
      },
    };
  }

  window.DATOS = conSupabase ? crearSupabase() : crearLocal();
})();
