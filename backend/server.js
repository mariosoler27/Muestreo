require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getFileTypeFromName } = require('./config/fileTypes');
const { authMiddleware } = require('./middleware/simpleAuth');
const { 
  fullAuthMiddleware, 
  authorizationMiddleware, 
  fileAuthorizationMiddleware,
  authorizationService 
} = require('./middleware/authorizationMiddleware');
const { authenticateUser } = require('./services/authService');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Importar servicios S3
const s3Services = require('./services/s3Services');

// Rutas

// Ruta de autenticación (wrapper para evitar CORS)
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        error: true,
        message: 'Usuario y contraseña son requeridos'
      });
    }
    
    console.log(`Solicitud de login para usuario: ${username}`);
    
    const result = await authenticateUser(username, password);
    
    if (result.success) {
      res.json({
        error: false,
        message: "DONE, user signed in",
        username: result.username,
        AccessToken: result.accessToken,
        IdToken: result.idToken,
        RefreshToken: result.refreshToken
      });
    } else {
      res.status(401).json({
        error: true,
        message: result.error,
        username: username,
        AccessToken: null,
        IdToken: null,
        RefreshToken: null
      });
    }
  } catch (error) {
    console.error('Error en ruta de login:', error);
    res.status(500).json({
      error: true,
      message: 'Error interno del servidor durante la autenticación',
      username: req.body.username || null,
      AccessToken: null,
      IdToken: null,
      RefreshToken: null
    });
  }
});

// Obtener lista de archivos del bucket S3 (requiere autenticación + autorización)
app.get('/api/getFiles', fullAuthMiddleware, async (req, res) => {
  try {
    // Usar el bucket autorizado del usuario
    const bucket = req.userAuth.bucket;
    const prefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    
    console.log(`Obteniendo archivos del bucket: ${bucket}, prefix: ${prefix} para usuario: ${req.user.username}`);
    
    const files = await s3Services.listFiles(bucket, prefix);
    
    // Filtrar archivos según el grupo de documentos del usuario
    const userGroup = req.userAuth.grupo_documentos;
    console.log(`Filtrando archivos para grupo: ${userGroup}`);
    
    const filesWithTypes = files.map(file => {
      const fileType = getFileTypeFromName(file.name);
      return {
        ...file,
        tipologia: fileType.tipologia,
        descripcion: fileType.descripcion
      };
    }).filter(file => {
      // Filtrar basándose en coincidencias de texto en la descripción
      const descripcion = file.descripcion.toLowerCase();
      
      if (userGroup === 'Facturas') {
        // Si el usuario tiene acceso a Facturas, mostrar archivos que contengan "factur" en la descripción
        return descripcion.includes('factur');
      } else if (userGroup === 'Cartas') {
        // Si el usuario tiene acceso a Cartas, mostrar archivos que contengan "cartas" en la descripción
        return descripcion.includes('cartas');
      }
      
      // Por defecto, no mostrar nada si el grupo no es reconocido
      return false;
    });
    
    console.log(`Archivos filtrados: ${filesWithTypes.length} de ${files.length} total`);
    res.json(filesWithTypes);
  } catch (error) {
    console.error('Error obteniendo archivos:', error);
    res.status(500).json({ 
      error: 'Error al obtener los archivos', 
      details: error.message 
    });
  }
});

// Obtener información específica de un archivo CSV (requiere autenticación + autorización)
app.get('/api/getFileInfo/:fileName', fullAuthMiddleware, fileAuthorizationMiddleware, async (req, res) => {
  try {
    const fileName = req.params.fileName;
    // Usar el bucket autorizado del usuario
    const bucket = req.userAuth.bucket;
    const sourcePrefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    const key = `${sourcePrefix}${fileName}`;
    
    console.log(`Obteniendo información del archivo: ${fileName} para usuario: ${req.user.username}`);
    
    const fileContent = await s3Services.getFileContent(bucket, key);
    const parsedData = await s3Services.parseCSV(fileContent);
    
    // La información de tipología ya está disponible en req.fileTypeInfo gracias al fileAuthorizationMiddleware
    const fileType = req.fileTypeInfo;
    
    res.json({
      fileName,
      tipologia: fileType.tipologia,
      descripcion: fileType.descripcion,
      data: parsedData,
      userGroup: req.userAuth.grupo_documentos // Información adicional del usuario
    });
  } catch (error) {
    console.error('Error obteniendo información del archivo:', error);
    res.status(500).json({ 
      error: 'Error al obtener la información del archivo', 
      details: error.message 
    });
  }
});

// Procesar un archivo (requiere autenticación + autorización)
app.post('/api/processFile', fullAuthMiddleware, async (req, res) => {
  try {
    const { 
      fileName, 
      idSpool, 
      tipoDocumento, 
      resultado 
    } = req.body;

    // Verificar que el usuario puede acceder a este archivo
    const fileType = getFileTypeFromName(fileName);
    const accessCheck = await authorizationService.canAccessFile(
      req.user.username,
      fileName,
      fileType
    );

    if (!accessCheck.canAccess) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: accessCheck.reason
      });
    }
    
    // Usar información del usuario autenticado y su bucket autorizado
    const idUsuario = req.user.username;
    const nombreUsuario = req.user.name || req.user.username;
    const bucket = req.userAuth.bucket; // Usar bucket autorizado del usuario
    
    const sourcePrefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    const destinationPrefix = process.env.S3_DESTINATION_PREFIX || 'Recepcion/Muestreo/Resultado/';
    const sourceKey = `${sourcePrefix}${fileName}`;
    const destinationKey = `${destinationPrefix}${fileName}`;
    
    console.log(`Procesando archivo: ${fileName}`);
    console.log(`Resultado: ${resultado}, Usuario: ${nombreUsuario} (${idUsuario}), Bucket: ${bucket}`);
    
    // Obtener el archivo actual
    const currentContent = await s3Services.getFileContent(bucket, sourceKey);
    
    // Actualizar el contenido del archivo con nueva información
    const timestamp = new Date().toISOString();
    const updatedContent = await s3Services.updateCSVContent(
      currentContent, 
      {
        idSpool,
        tipoDocumento,
        resultado,
        idUsuario,
        nombreUsuario,
        timestamp
      }
    );
    
    // Subir el archivo actualizado a la carpeta de Resultado
    await s3Services.uploadFile(bucket, destinationKey, updatedContent);
    
    // Eliminar el archivo de la ubicación original
    await s3Services.deleteFile(bucket, sourceKey);
    
    res.json({ 
      success: true, 
      message: `Archivo ${fileName} procesado y movido a Resultado`,
      processedBy: nombreUsuario,
      processedAt: timestamp,
      resultado,
      userGroup: req.userAuth.grupo_documentos
    });
  } catch (error) {
    console.error('Error procesando archivo:', error);
    res.status(500).json({ 
      error: 'Error al procesar el archivo', 
      details: error.message 
    });
  }
});

// Rutas de administración de autorizaciones (requiere autenticación)
app.get('/api/admin/authorizations', authMiddleware, async (req, res) => {
  try {
    const result = await authorizationService.getAllAuthorizations();
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo autorizaciones:', error);
    res.status(500).json({
      error: 'Error obteniendo autorizaciones',
      details: error.message
    });
  }
});

// Crear nueva autorización (requiere autenticación)
app.post('/api/admin/authorizations', authMiddleware, async (req, res) => {
  try {
    const { username, bucket, grupo_documentos } = req.body;
    
    if (!username || !bucket || !grupo_documentos) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren username, bucket y grupo_documentos'
      });
    }
    
    const result = await authorizationService.createUserAuthorization(
      username, 
      bucket, 
      grupo_documentos
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error creando autorización:', error);
    res.status(500).json({
      error: 'Error creando autorización',
      details: error.message
    });
  }
});

// Obtener autorización de un usuario específico
app.get('/api/user/authorization', fullAuthMiddleware, async (req, res) => {
  try {
    res.json({
      success: true,
      authorization: req.userAuth
    });
  } catch (error) {
    console.error('Error obteniendo autorización del usuario:', error);
    res.status(500).json({
      error: 'Error obteniendo autorización',
      details: error.message
    });
  }
});

// Descargar documento desde S3 (requiere autenticación + autorización)
app.get('/api/downloadDocument/:documentId', fullAuthMiddleware, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    if (!documentId) {
      return res.status(400).json({
        error: 'ID de documento requerido'
      });
    }

    // Usar el bucket autorizado del usuario
    const bucket = req.userAuth.bucket;
    const documentPath = `Recepcion/${documentId}`;
    
    console.log(`Descargando documento: ${documentId} para usuario: ${req.user.username}`);
    console.log(`Bucket: ${bucket}, Ruta: ${documentPath}`);
    
    // Verificar que el archivo existe y obtenerlo
    const fileStream = await s3Services.downloadFile(bucket, documentPath);
    
    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${documentId}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    
    // Pipe el stream del archivo S3 a la respuesta
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error en stream de descarga:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Error descargando archivo', 
          details: error.message 
        });
      }
    });
    
  } catch (error) {
    console.error('Error descargando documento:', error);
    
    if (error.code === 'NoSuchKey') {
      res.status(404).json({
        error: 'Documento no encontrado',
        message: `El documento ${req.params.documentId} no existe en S3`
      });
    } else {
      res.status(500).json({ 
        error: 'Error descargando documento', 
        details: error.message 
      });
    }
  }
});

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en puerto ${PORT}`);
});
