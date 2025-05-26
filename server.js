
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuración de Cloudinary usando variables de entorno
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Almacenamiento de archivos directamente en Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'presentadorApp', // Puedes cambiar el nombre de la carpeta en Cloudinary
    resource_type: 'auto',    // Detecta automáticamente si es imagen o PDF
  },
});
const upload = multer({ storage: storage });




const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

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


app.post('/upload', (req, res) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      console.error('❌ Error al subir a Cloudinary:', err);
      return res.status(500).json({
        success: false,
        message: 'Error en la subida a Cloudinary',
        error: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });
    }

    const fileUrl = req.file.path;
    res.json({
      success: true,
      message: 'Archivo subido con éxito',
      url: fileUrl
    });
  });
});


// app.post('/upload', upload.single('archivo'), (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ success: false, message: 'No se subió ningún archivo.' });
//   }

//   // Cloudinary ya almacenó el archivo y Multer agregó la info a req.file
//   const fileUrl = req.file.path; // esta es la URL pública del archivo en Cloudinary

//   res.json({
//     success: true,
//     message: 'Archivo subido con éxito',
//     url: fileUrl
//   });
// });



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
