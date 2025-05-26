const socket = io();
const container = document.getElementById('pdf-container');

let pdfDoc = null;
let currentPage = 1;
let totalPages = 0;
let currentPDFName = null;
let loadingTimeout = null;
let currentPDFUrl = null;

// Configurar PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Función para limpiar caché
function limpiarCache() {
  if ('caches' in window) {
    caches.keys().then(function(names) {
      for (let name of names) {
        caches.delete(name);
      }
    });
  }
  
  // Forzar recarga de recursos
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister();
      }
    });
  }
}

// Limpiar caché al cargar la página
document.addEventListener('DOMContentLoaded', () => {
  limpiarCache();
  
  // Agregar botón de descarga
  const downloadButton = document.createElement('button');
  downloadButton.innerHTML = '📥 Descargar PDF';
  downloadButton.className = 'download-button';
  downloadButton.onclick = downloadPDF;
  document.body.appendChild(downloadButton);
  console.log('Botón de descarga agregado');
});

// Eliminada la carga de PDF por defecto local
// loadPDF('pdfs/lectura.pdf');

// =====================
// FUNCIONES PDF
// =====================
function loadPDF(url) {
  // Mostrar indicador de carga
  container.innerHTML = '<div class="loading">Cargando PDF...</div>';
  
  // Limpiar timeout anterior si existe
  if (loadingTimeout) {
    clearTimeout(loadingTimeout);
  }

  // Establecer timeout para mostrar error si la carga toma demasiado tiempo
  loadingTimeout = setTimeout(() => {
    if (!pdfDoc) {
      container.innerHTML = '<p style="color:red">La carga está tomando más tiempo de lo esperado. Por favor, intenta recargar la página.</p>';
    }
  }, 30000);

  // Agregar timestamp para evitar caché
  const urlConTimestamp = `${url}?t=${Date.now()}`;

  pdfjsLib.getDocument(urlConTimestamp).promise.then((pdf) => {
    pdfDoc = pdf;
    totalPages = pdf.numPages;
    currentPage = 1;
    renderPage(currentPage);
    const parts = url.split('/');
    currentPDFName = parts[parts.length - 1];
    currentPDFUrl = url;
    
    // Limpiar timeout ya que la carga fue exitosa
    clearTimeout(loadingTimeout);
  }).catch((err) => {
    pdfDoc = null;
    currentPDFName = null;
    container.innerHTML = '<p style="color:red">No se pudo cargar el PDF. Por favor, intenta recargar la página.</p>';
    console.error('Error al cargar PDF:', err);
  });
}

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
    });
  });
}

// =====================
// SOCKET.IO - ESCUCHA
// =====================

// Sincronización de página
socket.on('page-change', (page) => {
  if (pdfDoc && page !== currentPage) {
    currentPage = page;
    renderPage(currentPage);
  }
});

// Cuando se sube un nuevo PDF
socket.on('new-pdf', (data) => {
  console.log('Nuevo PDF recibido:', data);
  if (data && data.url) {
    loadPDF(data.url);
  } else if (typeof data === 'string') {
    loadPDF(`pdfs/${data}`);
  } else {
    console.error('Formato de datos de nuevo PDF inesperado:', data);
    alert('Error al recibir información del nuevo PDF.');
  }
});

// Mostrar ruleta (orden del profe)
socket.on('mostrar-ruleta', () => {
  window.location.href = '/ruleta.html';
});

// Giro sincronizado de ruleta
socket.on('spinRuleta', ({ angle }) => {
  if (typeof girarRuletaDesdeProfe === 'function') {
    girarRuletaDesdeProfe(angle);
  }
});

// Volver al PDF (orden del profe)
socket.on('volver-pdf', () => {
  window.location.href = '/pdf-viewer.html';
});

// Función para descargar el PDF actual
function downloadPDF() {
  if (!currentPDFUrl) {
    alert('No hay PDF disponible para descargar');
    return;
  }
  
  try {
    const downloadUrl = currentPDFUrl;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('target', '_blank');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error al intentar descargar:', error);
    alert('Error al intentar descargar el PDF. Por favor, intenta de nuevo.');
  }
}
