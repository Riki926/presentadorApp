require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configuración de Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configuración de Multer con Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'presentadorApp',
    resource_type: 'raw',
    allowed_formats: ['pdf'],
    format: 'pdf'
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos PDF'), false);
    }
  }
});

const app = express();
const server = http.createServer(app);

// Middleware necesario
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de Socket.IO
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Ruta para subir PDF
app.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se subió ningún archivo.' 
      });
    }

    // Emitir evento de nuevo PDF
    io.emit('new-pdf', {
      filename: req.file.originalname,
      url: req.file.path,
      size: req.file.size,
      timestamp: Date.now()
    });

    res.status(200).json({ 
      success: true, 
      filename: req.file.originalname,
      url: req.file.path,
      size: req.file.size
    });
  } catch (error) {
    console.error('❌ Error al subir archivo:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al subir el archivo',
      error: error.message 
    });
  }
});

// Ruta para obtener la lista de PDFs
app.get('/pdfs', async (req, res) => {
  try {
    const result = await cloudinary.search
      .expression('folder:presentadorApp/*')
      .sort_by('created_at', 'desc')
      .max_results(30)
      .execute();

    res.json({
      success: true,
      pdfs: result.resources
    });
  } catch (error) {
    console.error('❌ Error al obtener PDFs:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener la lista de PDFs',
      error: error.message
    });
  }
});

// Socket.IO events
io.on('connection', (socket) => {
  console.log(`✅ Cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
  });

  socket.on('mostrar-ruleta', () => {
    console.log('🎯 Mostrando ruleta a todos');
    io.emit('mostrar-ruleta');
  });

  socket.on('volver-pdf', () => {
    console.log('📚 Volviendo al visor PDF');
    io.emit('volver-pdf');
  });

  socket.on('page-change', (page) => {
    socket.broadcast.emit('page-change', page);
  });

  socket.on('spinRuleta', (data) => {
    socket.broadcast.emit('spinRuleta', data);
    console.log('🔄 Giro de ruleta sincronizado:', data);
  });

  socket.on('actualizar-opciones', (opciones) => {
    io.emit('actualizar-opciones', opciones);
    console.log('📥 Opciones de ruleta actualizadas:', opciones);
  });
});

// Manejo de errores global
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promesa rechazada no manejada:', reason);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🟢 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`🟢 Modo: ${process.env.NODE_ENV || 'development'}`);
}).on('error', (err) => {
  console.error('Error al iniciar el servidor:', err);
});
