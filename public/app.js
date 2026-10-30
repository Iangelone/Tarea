const secciones = document.querySelectorAll(".seccion");
const pestanas = document.querySelectorAll(".pestana");
const conversacion = document.querySelector("#conversacion");
const chat = document.querySelector("#chat");
const bienvenida = document.querySelector("#bienvenida");
const listaTickets = document.querySelector("#lista-tickets");
const historial = [];
let enviandoChat = false;

// Alterna entre las funciones existentes de la aplicación.
for (const pestana of pestanas) {
  pestana.addEventListener("click", () => {
    for (const boton of pestanas) {
      const activa = boton === pestana;
      boton.classList.toggle("activa", activa);
      boton.setAttribute("aria-pressed", String(activa));
    }
    for (const seccion of secciones) seccion.hidden = seccion.id !== pestana.dataset.seccion;
    if (pestana.dataset.seccion === "tickets") cargarTickets();
  });
}

async function solicitar(ruta, opciones) {
  const respuesta = await fetch(ruta, opciones);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.error || "No se pudo completar la solicitud");
  return datos;
}

// Da formato básico al Markdown sin interpretar HTML recibido del modelo.
function mostrarRespuesta(elemento, texto) {
  const lineas = texto.split("\n");
  for (const [indice, linea] of lineas.entries()) {
    if (indice) elemento.append(document.createTextNode("\n"));
    const contenido = linea.replace(/^\s{0,3}#{1,6}\s+/, "");
    if (/^\s*---+\s*$/.test(contenido)) continue;
    const partes = contenido.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g);
    for (const parte of partes) {
      const negrita = parte.startsWith("**") && parte.endsWith("**") && parte.length > 4;
      const cursiva = !negrita && parte.startsWith("*") && parte.endsWith("*") && parte.length > 2;
      if (negrita || cursiva) {
        const formato = document.createElement(negrita ? "strong" : "em");
        formato.textContent = parte.slice(negrita ? 2 : 1, negrita ? -2 : -1);
        elemento.append(formato);
      } else {
        elemento.append(document.createTextNode(parte));
      }
    }
  }
}

// Inserta texto sin interpretar HTML arbitrario.
function agregarMensaje(texto, tipo, fuentes = []) {
  const mensaje = document.createElement("div");
  mensaje.className = `mensaje ${tipo}`;
  if (tipo === "asistente") mostrarRespuesta(mensaje, texto);
  else mensaje.textContent = texto;
  if (fuentes.length) {
    const detalle = document.createElement("div");
    detalle.className = "fuentes";
    detalle.textContent = `Fuentes consultadas: ${fuentes.join(", ")}`;
    mensaje.append(detalle);
  }
  conversacion.append(mensaje);
}

document.querySelector("#form-chat").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const pregunta = document.querySelector("#pregunta");
  const texto = pregunta.value.trim();
  if (!texto || enviandoChat) return;
  enviandoChat = true;
  const boton = evento.currentTarget.querySelector("button");
  bienvenida.hidden = true;
  chat.classList.replace("chat-vacio", "chat-activo");
  agregarMensaje(texto, "usuario");
  pregunta.value = "";
  boton.disabled = true;
  try {
    // Conserva los mensajes recientes sin superar el límite del servidor.
    const recientes = historial.slice(-20);
    while (recientes.length && new TextEncoder().encode(JSON.stringify({ pregunta: texto, historial: recientes })).length > 9500) {
      recientes.splice(0, 2);
    }
    const datos = await solicitar("/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pregunta: texto, historial: recientes }) });
    agregarMensaje(datos.respuesta, "asistente", datos.fuentes);
    historial.push({ role: "user", content: texto }, { role: "assistant", content: datos.respuesta });
  } catch (error) {
    agregarMensaje(error.message, "asistente");
  } finally {
    enviandoChat = false;
    boton.disabled = false;
    pregunta.focus();
    window.scrollTo(0, document.body.scrollHeight);
  }
});

async function cargarTickets() {
  listaTickets.textContent = "Cargando tickets...";
  try {
    const tickets = await solicitar("/tickets");
    listaTickets.textContent = tickets.length ? "" : "Todavía no hay tickets guardados.";
    for (const ticket of tickets) {
      const elemento = document.createElement("article");
      elemento.className = "ticket";
      const texto = document.createElement("p");
      texto.textContent = ticket.texto;
      const detalle = document.createElement("small");
      detalle.textContent = `Categoría: ${ticket.categoria} · Prioridad: ${ticket.prioridad}`;
      elemento.append(texto, detalle);
      listaTickets.append(elemento);
    }
  } catch (error) {
    listaTickets.textContent = error.message;
  }
}

document.querySelector("#form-ticket").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const reclamo = document.querySelector("#reclamo");
  const texto = reclamo.value.trim();
  if (!texto) return;
  const boton = evento.currentTarget.querySelector("button");
  const estado = document.querySelector("#estado-ticket");
  boton.disabled = true;
  estado.textContent = "Clasificando...";
  try {
    const resultado = await solicitar("/clasificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ texto }) });
    estado.textContent = `Categoría: ${resultado.categoria} · Prioridad: ${resultado.prioridad}`;
    reclamo.value = "";
    await cargarTickets();
  } catch (error) {
    estado.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
});
