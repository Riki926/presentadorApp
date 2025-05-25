const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);

// Asegurar que el directorio de PDFs existe
const pdfsDir = path.join(__dirname, 'public', 'pdfs');
if (!fs.existsSync(pdfsDir)) {
  fs.mkdirSync(pdfsDir, { recursive: true });
}

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Aumentar límites para múltiples conexiones
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware para subir archivos con configuración mejorada
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  useTempFiles: true,
  tempFileDir: path.join(__dirname, 'temp'),
  createParentPath: true,
  abortOnLimit: true,
  responseOnLimit: 'El archivo excede el tamaño máximo permitido',
  debug: true
}));

// Middleware para controlar caché
app.use((req, res, next) => {
  // No cachear para rutas específicas
  if (req.path.startsWith('/pdfs/') || req.path.startsWith('/download/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }
  next();
});

// Servir archivos estáticos con caché controlada
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  lastModified: true,
  setHeaders: (res, path) => {
    if (path.endsWith('.pdf')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Ruta para subir PDF con validaciones mejoradas
app.post('/upload', (req, res) => {
  if (!req.files || !req.files.pdf) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });
  }

  const pdfFile = req.files.pdf;

  // Validar que sea un PDF
  if (!pdfFile.mimetype.includes('pdf')) {
    return res.status(400).json({ success: false, message: 'Solo se permiten archivos PDF.' });
  }

  const uploadPath = path.join(__dirname, 'public', 'pdfs', pdfFile.name);

  // Asegurar que el directorio existe
  if (!fs.existsSync(path.dirname(uploadPath))) {
    fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  }

  pdfFile.mv(uploadPath, (err) => {
    if (err) {
      console.error('❌ Error al mover el archivo:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Error al guardar el archivo.',
        error: err.message 
      });
    }

    // Emitir evento de nuevo PDF con información adicional
    io.emit('new-pdf', {
      filename: pdfFile.name,
      size: pdfFile.size,
      timestamp: Date.now()
    });
    
    res.status(200).json({ 
      success: true, 
      filename: pdfFile.name,
      size: pdfFile.size
    });
  });
});

// Ruta para descargar PDF con manejo de caché
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  console.log('📥 Intento de descarga:', filename);
  
  const filePath = path.join(__dirname, 'public', 'pdfs', filename);
  console.log('📂 Ruta del archivo:', filePath);

  // Verificar si el archivo existe
  if (!fs.existsSync(filePath)) {
    console.error('❌ Archivo no encontrado:', filename);
    return res.status(404).json({ success: false, message: 'Archivo no encontrado.' });
  }

  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const range = req.headers.range;

    if (range) {
      // Manejar descarga parcial (streaming)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'application/pdf',
        'Cache-Control': 'public, max-age=3600'
      });
      
      file.pipe(res);
    } else {
      // Descarga completa
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', fileSize);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('❌ Error en la descarga:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error al procesar la descarga.' });
    }
  }
});

// 🔌 Manejar conexión de Socket.IO
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);

  // Manejar desconexión
  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });

  // 🎯 Mostrar ruleta
  socket.on('mostrar-ruleta', () => {
    console.log('🎯 Mostrando ruleta a todos');
    io.emit('mostrar-ruleta');
  });

  // 🔁 Volver al visor PDF
  socket.on('volver-pdf', () => {
    console.log('📚 Volviendo al visor PDF');
    io.emit('volver-pdf');
  });

  // 📃 Cuando se cambia la página del PDF
  socket.on('page-change', (page) => {
    socket.broadcast.emit('page-change', page);
  });

  // 🎡 Giro de ruleta sincronizado
  socket.on('spinRuleta', (data) => {
    socket.broadcast.emit('spinRuleta', data);
    console.log('🔄 Giro de ruleta sincronizado:', data);
  });

  // 🔄 Opciones de ruleta sincronizadas
  socket.on('actualizar-opciones', (opciones) => {
    io.emit('actualizar-opciones', opciones);
    console.log('📥 Opciones de ruleta actualizadas:', opciones);
  });
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🟢 También accesible en la red local usando la IP de tu computadora`);
});

// Ruta raíz para servir el HTML principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
