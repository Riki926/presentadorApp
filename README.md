# Presentador App

Aplicación web para presentaciones con ruleta y visualización de PDFs.

## Requisitos Previos

- Node.js >= 14.0.0
- Cuenta en AWS (para S3)
- Cuenta en el proveedor de nube elegido (AWS, GCP, Azure)

## Configuración Local

1. Instalar dependencias:
```bash
npm install
```

2. Crear archivo `.env` con las siguientes variables:
```env
PORT=3000
NODE_ENV=development
MAX_FILE_SIZE=52428800
ALLOWED_ORIGINS=http://localhost:3000
CLOUD_PROVIDER=aws
CLOUD_BUCKET_NAME=tu-bucket-name
CLOUD_REGION=us-east-1
AWS_ACCESS_KEY_ID=tu-access-key
AWS_SECRET_ACCESS_KEY=tu-secret-key
```

3. Iniciar en modo desarrollo:
```bash
npm run dev
```

## Despliegue en la Nube

### AWS (Recomendado)

1. Crear un bucket S3:
   - Nombre único global
   - Habilitar CORS
   - Configurar políticas de acceso

2. Configurar IAM:
   - Crear usuario con acceso programático
   - Asignar políticas para S3
   - Guardar credenciales

3. Desplegar en EC2 o Elastic Beanstalk:
   - Crear instancia EC2 o aplicación Elastic Beanstalk
   - Configurar variables de entorno
   - Desplegar código

### Google Cloud Platform

1. Crear bucket en Cloud Storage
2. Configurar credenciales de servicio
3. Desplegar en App Engine o Cloud Run

### Azure

1. Crear cuenta de almacenamiento
2. Configurar contenedor blob
3. Desplegar en App Service

## Estructura del Proyecto

```
presentadorApp/
├── public/           # Archivos estáticos
├── server.js         # Servidor principal
├── package.json      # Dependencias
├── .env             # Variables de entorno
└── README.md        # Documentación
```

## Características

- Subida y visualización de PDFs
- Ruleta interactiva
- Sincronización en tiempo real
- Almacenamiento en la nube
- Seguridad mejorada

## Soporte

Para reportar problemas o solicitar ayuda, por favor crear un issue en el repositorio. 