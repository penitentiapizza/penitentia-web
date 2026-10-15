/*
  CATÁLOGO DE PIZZAS CONGELADAS
  ------------------------------------------------------------
  Para cambiar precios, nombres o agregar variedades, editá solo este archivo.
  - id:          identificador único, sin espacios ni tildes.
  - nombre:      como aparece en la tarjeta y en el pedido de WhatsApp.
  - descripcion: propuesta de sabor (no reemplaza la lista de ingredientes).
  - precio:      número sin puntos ni signo $ (ej: 11600).
  - foto:        ruta de la imagen dentro de la carpeta img/.
  - disponible:  true para mostrarla con botón de compra, false para "Sin stock".
*/
window.PENITENTIA_PRODUCTOS = [
  {
    id: "muzzarella",
    nombre: "Muzzarella",
    descripcion: "Salsa de tomate, mozzarella, aceite de oliva y orégano.",
    precio: 7790,
    foto: "img/p-muzzarella.jpg",
    disponible: true
  },
  {
    id: "fugazza-con-queso",
    nombre: "Fugazza con queso",
    descripcion: "Mozzarella y mucha cebolla, con aceite de oliva y orégano.",
    precio: 11600,
    foto: "img/p-fugazza.jpg",
    disponible: true
  },
  {
    id: "jamon-y-morron",
    nombre: "Jamón cocido y morrón",
    descripcion: "Salsa de tomate, mozzarella, jamón cocido y morrón.",
    precio: 11660,
    foto: "img/p-jamon.jpg",
    disponible: true
  },
  {
    id: "pepperoni",
    nombre: "Pepperoni",
    descripcion: "Salsa de tomate, mozzarella y pepperoni.",
    precio: 12660,
    foto: "img/p-pepperoni.jpg",
    disponible: true
  }
];

/* Datos de contacto: se usan en toda la página */
window.PENITENTIA_CONTACTO = {
  whatsapp: "5492612125532",          // código país 54 + 9 + 261 2125532
  whatsappVisible: "261 212 5532",
  email: "penitentia.oficial@gmail.com",
  instagram: "penitentia.ar"
};
