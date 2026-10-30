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
    nombre: "Jamón y morrón",
    descripcion: "Salsa de tomate, mozzarella, jamón cocido y morrón.",
    precio: 13000,
    foto: "img/p-jamon-800.webp",
    disponible: true
  },
  {
    id: "agridulce",
    nombre: "Agridulce",
    descripcion: "Salsa de tomate, mozzarella, peras, miel levemente picante y queso azul.",
    precio: 10900,
    foto: "img/p-agridulce-800.webp",
    disponible: true
  },
  {
    id: "tropical",
    nombre: "Tropical",
    descripcion: "Salsa de tomate, mozzarella, ananá y jamón cocido.",
    precio: 13300,
    foto: "img/p-tropical-800.webp",
    disponible: true
  },
  {
    id: "americana",
    nombre: "Americana",
    descripcion: "Salsa de tomate, mozzarella, salchicha alemana y panceta.",
    precio: 14200,
    foto: "img/p-americana-800.webp",
    disponible: true
  }
];

/* Costo del envío a domicilio (número sin puntos). El retiro no tiene cargo. */
window.PENITENTIA_ENVIO = 4000;

/* Día de reparto: se muestra en el catálogo, en el carrito y en el mensaje de WhatsApp */
window.PENITENTIA_DIA_REPARTO = "viernes";

/* Datos de contacto: se usan en toda la página */
window.PENITENTIA_CONTACTO = {
  whatsapp: "5492617252048",          // código país 54 + 9 + 261 7252048
  whatsappVisible: "261 725 2048",
  email: "penitentia.oficial@gmail.com",
  instagram: "penitentia.ar",
  // Ubicación: cuando la tengas, pegá el link de Google Maps y la dirección.
  // Mientras esté vacío, en penitentia.com.ar/contacto aparece como "Próximamente".
  ubicacion: "",                      // ej: "https://maps.app.goo.gl/xxxxx"
  ubicacionVisible: ""                // ej: "San Martín 1234, Mendoza"
};
