const socket = io();
const container = document.getElementById('pdf-container');
const fileInput = document.getElementById('file-input');
const pageNumElem = document.getElementById('page-num');
const pageCountElem = document.getElementById('page-count');

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;

// =====================
// PDF.js Config
// =====================
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';


// =====================
// Función: Cargar PDF
// =====================
function loadPDF(url) {
  pdfjsLib.getDocument(url).promise.then((pdf) => {
    pdfDoc = pdf;
    totalPages = pdf.numPages;
    currentPage = 1;
    pageCountElem.textContent = totalPages;
    renderPage(currentPage);
  });
}

// =====================
// Función: Renderizar Página
// =====================
function renderPage(num) {
  pdfDoc.getPage(num).then((page) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const viewport = page.getViewport({ scale: 1.5 });

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    page.render({ canvasContext: ctx, viewport }).promise.then(() => {
      container.innerHTML = '';
      container.appendChild(canvas);
      pageNumElem.textContent = currentPage;
      socket.emit('page-change', currentPage);
    });
  });
}

// =====================
// Navegación entre páginas
// =====================
function nextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    renderPage(currentPage);
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage(currentPage);
  }
}

// =====================
// Funciones remotas
// =====================
function girarRuleta() {
  const rand = Math.floor(Math.random() * 360);
  socket.emit('spinRuleta', { angle: rand });
}

function mostrarRuleta() {
  socket.emit('mostrar-ruleta');
  window.open('/ruleta.html', '_blank');
}

function volverAlPDF() {
socket.emit('volver-pdf');
}

// =====================
// Eventos del DOM
// =====================
window.addEventListener('DOMContentLoaded', () => {
  const volverBtn = document.getElementById('volver-pdf-btn');
  if (volverBtn) {
    volverBtn.addEventListener('click', volverAlPDF);
  } else {
    console.warn('⚠️ Botón volver-pdf-btn no encontrado en el DOM.');
  }

  const ruletaBtn = document.getElementById('mostrar-ruleta-btn');
  if (ruletaBtn) {
    ruletaBtn.addEventListener('click', mostrarRuleta);
  }

  // Manejo de subida del archivo
  document.getElementById('upload-form').addEventListener('submit', async function (e) {
    e.preventDefault(); // Previene el comportamiento por defecto del formulario

    const input = document.getElementById('file-input');
    const file = input.files[0];
    if (!file) {
      alert('Por favor seleccioná un archivo PDF.');
      return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        alert('✅ Archivo subido con éxito');
        if (result.url) {
          loadPDF(result.url);
        }
      } else {
        alert('⚠️ Error: ' + (result.message || 'Error desconocido'));
      }
    } catch (err) {
      console.error('Error al subir:', err);
      alert('❌ Error inesperado al subir el archivo');
    }
  })
})