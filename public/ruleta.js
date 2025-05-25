const params = new URLSearchParams(window.location.search);
const esProfe = params.get('profe') === '1';

if (!esProfe) {
  // Oculta el editor solo para estudiantes
  const editor = document.getElementById('editar-opciones');
  if (editor) {
    editor.style.display = 'none';
  }

  // Opcional: bloquear botón girar también
  const btn = document.getElementById('spin');
  if (btn) {
    btn.style.display = 'none';
  }
}

const socket = io();
const wheel = document.getElementById('wheel');
const ctx = wheel.getContext('2d');
const spinBtn = document.getElementById('spin');
const resultado = document.getElementById('resultado');
const opcionesInput = document.getElementById('opciones-input');
const actualizarBtn = document.getElementById('actualizar-opciones');
const modal = document.getElementById('modal');
const modalText = document.getElementById('modal-text');
const cerrarModal = document.getElementById('cerrar-modal');

let opciones = ["Pregunta 1", "Pregunta 2", "Pregunta 3", "Pregunta 4"];
let colors = ["#FF5733", "#33C1FF", "#75FF33", "#FFD433"];
let startAngle = 0;
let arc = Math.PI * 2 / opciones.length;
let isSpinning = false;
let spinTimeout = null;
let spinAngleStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;

function drawWheel() {
    const outsideRadius = 200;
    // Ajustar radios para más espacio si hay muchas opciones
    const textRadiusStart = opciones.length > 16 ? 60 : 70;
    const textRadiusEnd = opciones.length > 16 ? 170 : 180;
    const insideRadius = 50;
  
    ctx.clearRect(0, 0, 500, 500);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 3;
  
    for (let i = 0; i < opciones.length; i++) {
      const angle = startAngle + i * arc;
      ctx.fillStyle = colors[i % colors.length];
  
      // Dibuja cada sección
      ctx.beginPath();
      ctx.arc(250, 250, outsideRadius, angle, angle + arc, false);
      ctx.arc(250, 250, insideRadius, angle + arc, angle, true);
      ctx.fill();
  
      // Texto
      ctx.save();
      ctx.translate(250, 250); // Mover al centro
      ctx.rotate(angle + arc / 2); // Rotar según el segmento

      const texto = opciones[i];
      ctx.fillStyle = "black";
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      // Calcular tamaño de fuente dinámico para que el texto quepa en el radio
      let fontSize = opciones.length > 16 ? 14 : 22;
      const minFontSize = opciones.length > 16 ? 8 : 10;
      const maxWidth = textRadiusEnd - textRadiusStart;
      ctx.font = `bold ${fontSize}px sans-serif`;
      let textWidth = ctx.measureText(texto).width;
      while (textWidth > maxWidth && fontSize > minFontSize) {
        fontSize--;
        ctx.font = `bold ${fontSize}px sans-serif`;
        textWidth = ctx.measureText(texto).width;
      }

      // Si el texto sigue siendo muy largo, lo dividimos en varias líneas
      let lines = [];
      if (textWidth > maxWidth) {
        let words = texto.split(' ');
        let line = '';
        for (let w = 0; w < words.length; w++) {
          let testLine = line + words[w] + ' ';
          let testWidth = ctx.measureText(testLine).width;
          if (testWidth > maxWidth && line !== '') {
            lines.push(line.trim());
            line = words[w] + ' ';
          } else {
            line = testLine;
          }
        }
        lines.push(line.trim());
      } else {
        lines = [texto];
      }

      // Dibujar cada línea, alineada desde el centro hacia afuera
      const lineHeight = fontSize + 2;
      const totalHeight = lineHeight * lines.length;
      for (let l = 0; l < lines.length; l++) {
        ctx.fillText(lines[l], textRadiusStart, (l - (lines.length - 1) / 2) * lineHeight);
      }
      ctx.restore();
    }
  
    // Borde exterior
    ctx.beginPath();
    ctx.arc(250, 250, outsideRadius, 0, Math.PI * 2);
    ctx.stroke();
  }

function rotateWheel(indexGanadorForzado = null) {
  spinTime += 30;
  if (spinTime >= spinTimeTotal) {
    stopRotateWheel(indexGanadorForzado);
    return;
  }
  const spinAngle = spinAngleStart - easeOut(spinTime, 0, spinAngleStart, spinTimeTotal);
  startAngle += (spinAngle * Math.PI / 180);
  drawWheel();
  spinTimeout = setTimeout(() => rotateWheel(indexGanadorForzado), 30);
}

function stopRotateWheel(indexGanadorForzado = null) {
  clearTimeout(spinTimeout);
  const degrees = startAngle * 180 / Math.PI + 90;
  const arcd = arc * 180 / Math.PI;
  let index = Math.floor((360 - (degrees % 360)) / arcd) % opciones.length;
  if (indexGanadorForzado !== null) {
    index = indexGanadorForzado;
  }
  const text = opciones[index];
  resultado.textContent = `Resultado: ${text}`;
  modalText.textContent = text;
  modal.style.display = 'flex';
  isSpinning = false;
}

function easeOut(t, b, c, d) {
  const ts = (t /= d) * t;
  const tc = ts * t;
  return b + c * (tc + -3 * ts + 3 * t);
}

  actualizarBtn.addEventListener('click', () => {
    const nuevasOpciones = opcionesInput.value
      .split('\n')
      .map(op => op.trim())
      .filter(op => op !== '');
  
    if (nuevasOpciones.length > 0) {
      opciones = nuevasOpciones;
      arc = Math.PI * 2 / opciones.length;
      drawWheel();
  
      // 🚀 Enviar a todos los estudiantes
      socket.emit('actualizar-opciones', opciones);
    }
  });
  
// 🚀 Modal - cerrar
cerrarModal.addEventListener('click', () => {
  modal.style.display = 'none';
});

// Dibujo inicial
drawWheel();


socket.on('spinRuleta', ({ angle, index }) => {
  girarRuletaDesdeProfe(angle, index);
});
  

// Función mejorada para hacer girar la ruleta sincronizada
function girarRuletaDesdeProfe(finalAngle, indexGanador) {
    // Reiniciar la ruleta
    startAngle = 0;
    drawWheel();
    
    // Calcular el ángulo total a girar (5 vueltas + el ángulo final)
    const vueltasCompletas = 5; // Número de vueltas completas
    spinAngleStart = (vueltasCompletas * 360) + finalAngle;
    spinTime = 0;
    spinTimeTotal = 5000; // 5 segundos de animación
    
    // Iniciar la rotación
    isSpinning = true;
    rotateWheel(indexGanador);
}
  

socket.on('volver-pdf', () => {
    console.log('🔙 Recibido evento volver-pdf');
    window.location.href = '/pdf-viewer.html';
  });



  function resultadoText(texto) {
    resultado.textContent = `Resultado: ${texto}`;
    modalText.textContent = texto;
    modal.style.display = 'flex';
    isSpinning = false;
  }
  
  socket.on('actualizar-opciones', (nuevasOpciones) => {
    opciones = nuevasOpciones;
    arc = Math.PI * 2 / opciones.length;
    drawWheel();

    console.log('📥 Opciones actualizadas desde el profe:', nuevasOpciones);

  });
  
if (esProfe && spinBtn) {
  spinBtn.addEventListener('click', () => {
    if (isSpinning) return;
    const indiceGanador = Math.floor(Math.random() * opciones.length);
    const gradosPorOpcion = 360 / opciones.length;
    const anguloObjetivo = 360 - (indiceGanador * gradosPorOpcion + gradosPorOpcion / 2);
    socket.emit('spinRuleta', { angle: anguloObjetivo, index: indiceGanador });
    girarRuletaDesdeProfe(anguloObjetivo, indiceGanador);
  });
}
  