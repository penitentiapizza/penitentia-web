/*
  CATÁLOGO DE PIZZAS CONGELADAS
  ------------------------------------------------------------
  Para cambiar precios, nombres o agregar variedades, editá solo este archivo.
  - id:          identificador único, sin espacios ni tildes.
  - nombre:      como aparece en la tarjeta y en el pedido de WhatsApp.
  - descripcion: propuesta de sabor (no reemplaza la lista de ingredientes).
  - precio:      número sin puntos ni signo $ (ej: 11600).
  - foto:        ruta de la imagen dentro de la carpeta img/ (.webp o .jpg).
                 Si el nombre termina en -800.webp y existe la versión -480.webp,
                 los celulares descargan la chica automáticamente.
  - disponible:  true para mostrarla con botón de compra, false para "Sin stock".
*/
window.PENITENTIA_PRODUCTOS = [
  {
    id: "muzzarella",
    nombre: "Muzzarella",
    descripcion: "Salsa de tomate, mozzarella, aceite de oliva y orégano.",
    precio: 7790,
    foto: "img/p-muzzarella-800.webp",
    disponible: true
  },
  {
    id: "fugazza-con-queso",
    nombre: "Fugazza con queso",
    descripcion: "Mozzarella y mucha cebolla, con aceite de oliva y orégano.",
    precio: 11600,
    foto: "img/p-fugazza-800.webp",
    disponible: true
  },
  {
    id: "jamon-y-morron",
    nombre: "Jamón cocido y morrón",
    descripcion: "Salsa de tomate, mozzarella, jamón cocido y morrón.",
    precio: 11660,
    foto: "img/p-jamon-800.webp",
    disponible: true
  },
  {
    id: "pepperoni",
    nombre: "Pepperoni",
    descripcion: "Salsa de tomate, mozzarella y pepperoni.",
    precio: 12660,
    foto: "img/p-pepperoni-800.webp",
    disponible: true
  }
];

/* Costo del envío a domicilio (número sin puntos). El retiro no tiene cargo. */
window.PENITENTIA_ENVIO = 4000;

/* Datos de contacto: se usan en toda la página */
window.PENITENTIA_CONTACTO = {
  whatsapp: "5492617252048",          // código país 54 + 9 + 261 7252048
  whatsappVisible: "261 725 2048",
  email: "penitentia.oficial@gmail.com",
  instagram: "penitentia.ar"
};
