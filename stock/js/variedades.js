/* =========================================================
   Variedades y datos de la etiqueta de cada una.
   Los textos salen de las etiquetas Word de «3 - Etiquetas/1 … 7»
   (las originales), así la etiqueta que imprime el sistema es la misma.

   - codigo:  las dos letras del lote (ej. 261021-AG-1).
   - peso:    contenido neto sugerido en gramos. Se puede cambiar al generar
              y el sistema recuerda el último que usaste. Vacío = línea para completar.
   - foto:    foto de la web (carpeta ../img).
   ========================================================= */

const ALERGENOS_TL = "ALÉRGENOS: CONTIENE TRIGO (GLUTEN) Y LECHE.";
const FIN = "aceite de oliva, sal, orégano y levadura.";

window.VARIEDADES = [
  { id: "mozzarella", codigo: "MO", nombre: "Mozzarella", peso: 825,
    propuesta: "Salsa de tomate, mozzarella, aceite de oliva y orégano",
    ingredientes: "Harina de trigo, mozzarella, salsa de tomate, agua, " + FIN,
    foto: "../img/p-muzzarella-480.webp" },
  { id: "fugazza-con-queso", codigo: "FQ", nombre: "Fugazza con queso", peso: "",
    propuesta: "Salsa de tomate, mozzarella y cebolla",
    ingredientes: "Cebolla, harina de trigo, mozzarella, salsa de tomate, agua, " + FIN,
    foto: "../img/p-fugazza-480.webp" },
  { id: "jamon-y-morron", codigo: "JM", nombre: "Jamón y morrón", peso: "",
    propuesta: "Jamón cocido y morrón",
    ingredientes: "Harina de trigo, mozzarella, salsa de tomate, jamón cocido, morrón, agua, " + FIN,
    foto: "../img/p-jamon-480.webp" },
  { id: "provolone", codigo: "PR", nombre: "Provolone", peso: "",
    propuesta: "Salsa de tomate, mozzarella y provolone",
    ingredientes: "Harina de trigo, salsa de tomate, agua, mozzarella, queso provolone, " + FIN,
    foto: "" },
  { id: "agridulce", codigo: "AG", nombre: "Agridulce", peso: 1030,
    propuesta: "Peras, miel levemente picante y queso azul",
    ingredientes: "Harina de trigo, pera, salsa de tomate, agua, mozzarella, queso azul, miel levemente picante, " + FIN,
    foto: "../img/p-agridulce-480.webp" },
  { id: "tropical", codigo: "TR", nombre: "Tropical", peso: "",
    propuesta: "Ananá y jamón cocido",
    ingredientes: "Harina de trigo, mozzarella, ananá, salsa de tomate, jamón cocido, agua, " + FIN,
    foto: "../img/p-tropical-480.webp" },
  { id: "americana", codigo: "AM", nombre: "Americana", peso: "",
    propuesta: "Salchicha alemana y panceta",
    ingredientes: "Harina de trigo, mozzarella, salchicha alemana, salsa de tomate, agua, panceta, " + FIN,
    foto: "../img/p-americana-480.webp" },
].map(v => ({ alergenos: ALERGENOS_TL, horno: "7 a 10", ...v }));

/* Meses hasta el vencimiento, contados desde la fecha del lote */
window.MESES_VENCIMIENTO = 3;
