/*
  CATÁLOGO DE PIZZAS CONGELADAS
  ------------------------------------------------------------
  Para cambiar precios, nombres o agregar variedades, editá solo este archivo.
  - id:          identificador único, sin espacios ni tildes.
  - nombre:      como aparece en la tarjeta y en el pedido de WhatsApp.
  - descripcion: propuesta de sabor (no reemplaza la lista de ingredientes).
  - precio:      número sin puntos ni signo $ (ej: 11600). Poné null para mostrar
                 "Consultá el precio": la pizza aparece, pero se consulta por WhatsApp.
  - foto:        ruta de la imagen dentro de la carpeta img/ (.webp o .jpg).
                 Dejala vacía ("") y se muestra la etiqueta azul de Penitentia.
                 Si el nombre termina en -800.webp y existe la versión -480.webp,
                 los celulares descargan la chica automáticamente.
  - disponible:  true para mostrarla con botón de compra, false para "Sin stock".
*/
window.PENITENTIA_PRODUCTOS = [
  {
    id: "muzzarella",
    nombre: "Muzzarella",
    descripcion: "Salsa de tomate, mozzarella, aceite de oliva y orégano.",
    precio: 8000,
    foto: "img/p-muzzarella-800.webp",
    disponible: true
  },
  {
    id: "fugazza-con-queso",
    nombre: "Fugazza con queso",
    descripcion: "Salsa de tomate, mozzarella y cebolla.",
    precio: 8800,
    foto: "img/p-fugazza-800.webp",
    disponible: true
  },
  {
    id: "provolone",
    nombre: "Provolone",
    descripcion: "Salsa de tomate, mozzarella y provolone.",
    precio: 10500,
    foto: "",
    disponible: true
  },
  {
    id: "jamon-y-morron",
    nombre: "Jamón cocido y morrón",
    descripcion: "Salsa de tomate, mozzarella, jamón cocido y morrón.",
    precio: null,
    foto: "img/p-jamon-800.webp",
    disponible: true
  },
  {
    id: "pepperoni",
    nombre: "Pepperoni",
    descripcion: "Salsa de tomate, mozzarella y pepperoni.",
    precio: null,
    foto: "img/p-pepperoni-800.webp",
    disponible: true
  },
  {
    id: "agridulce",
    nombre: "Agridulce",
    descripcion: "Mozzarella, peras, miel y queso azul.",
    precio: 10400,
    foto: "",
    disponible: true
  },
  {
    id: "tropical",
    nombre: "Tropical",
    descripcion: "Mozzarella, ananá y jamón cocido.",
    precio: 13300,
    foto: "",
    disponible: true
  },
  {
    id: "americana",
    nombre: "Americana",
    descripcion: "Mozzarella, salchicha alemana y panceta.",
    precio: 14200,
    foto: "",
    disponible: true
  },
  {
    id: "mortadella",
    nombre: "Mortadella",
    descripcion: "Mortadella, pistacho y un toque de oliva con ajo.",
    precio: null,
    foto: "",
    disponible: true
  },
  {
    id: "jamon-crudo",
    nombre: "Jamón crudo",
    descripcion: "Jamón crudo y rúcula.",
    precio: null,
    foto: "",
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
