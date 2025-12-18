require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getFileTypeFromName } = require('./config/fileTypes');
const { authMiddleware } = require('./middleware/simpleAuth');
const { 
  fullAuthMiddleware, 
  authorizationMiddleware, 
  fileAuthorizationMiddleware,
  fullAdminMiddleware,
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

// Obtener carpetas disponibles para el usuario (requiere autenticación + autorización)
app.get('/api/getFolders', fullAuthMiddleware, async (req, res) => {
  try {
    // Usar el bucket y ruta autorizada del usuario
    const bucket = req.userAuth.bucket;
    const basePath = req.userAuth.grupo_documentos; // Esto ahora será la ruta completa como "Recepcion/Muestreo/Cartas"
    
    console.log(`Obteniendo carpetas del bucket: ${bucket}, basePath: ${basePath} para usuario: ${req.user.username}`);
    
    const folders = await s3Services.listFolders(bucket, basePath);
    
    res.json({
      basePath,
      folders
    });
  } catch (error) {
    console.error('Error obteniendo carpetas:', error);
    res.status(500).json({ 
      error: 'Error al obtener las carpetas', 
      details: error.message 
    });
  }
});

// Obtener lista de archivos de una carpeta específica (requiere autenticación + autorización)
app.get('/api/getFiles', fullAuthMiddleware, async (req, res) => {
  try {
    const folderPath = req.query.folder;
    
    if (!folderPath) {
      return res.status(400).json({
        error: 'Parámetro folder requerido'
      });
    }

    // Verificar que el usuario tiene acceso a esta carpeta
    const basePath = req.userAuth.grupo_documentos;
    if (!folderPath.startsWith(basePath)) {
      return res.status(403).json({
        error: 'Acceso denegado a esta carpeta'
      });
    }

    // Usar el bucket autorizado del usuario
    const bucket = req.userAuth.bucket;
    
    console.log(`Obteniendo archivos del bucket: ${bucket}, folder: ${folderPath} para usuario: ${req.user.username}`);
    
    const files = await s3Services.listFiles(bucket, folderPath + '/');
    
    const filesWithTypes = files.map(file => {
      const fileType = getFileTypeFromName(file.name);
      return {
        ...file,
        tipologia: fileType.tipologia,
        descripcion: fileType.descripcion,
        folder: folderPath
      };
    });
    
    console.log(`Archivos encontrados en ${folderPath}: ${filesWithTypes.length}`);
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
app.get('/api/getFileInfo/:fileName', fullAuthMiddleware, async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const folderPath = req.query.folder; // Obtener carpeta de query params
    
    if (!folderPath) {
      return res.status(400).json({
        error: 'Parámetro folder requerido'
      });
    }

    // Verificar que el usuario tiene acceso a esta carpeta
    const basePath = req.userAuth.grupo_documentos;
    if (!folderPath.startsWith(basePath)) {
      return res.status(403).json({
        error: 'Acceso denegado a esta carpeta'
      });
    }

    // Usar el bucket autorizado del usuario
    const bucket = req.userAuth.bucket;
    const key = `${folderPath}/${fileName}`;
    
    console.log(`Obteniendo información del archivo: ${fileName} en ${folderPath} para usuario: ${req.user.username}`);
    
    // Verificar acceso al archivo específico usando la autorización específica ya validada
    const { getFileTypeFromName } = require('./config/fileTypes');
    const fileTypeInfo = getFileTypeFromName(fileName);
    
    // Ya hemos verificado que el usuario tiene acceso a esta carpeta usando req.userAuth
    // Solo necesitamos verificar que la carpeta está dentro de la ruta autorizada
    if (!folderPath.startsWith(req.userAuth.grupo_documentos)) {
      console.log(`Acceso denegado al archivo ${fileName} para usuario ${req.user.username}: Carpeta fuera de la ruta autorizada`);
      return res.status(403).json({
        error: 'Acceso denegado al archivo',
        message: `El archivo "${fileName}" en la carpeta "${folderPath}" no está dentro de la ruta autorizada "${req.userAuth.grupo_documentos}"`
      });
    }
    
    const fileContent = await s3Services.getFileContent(bucket, key);
    const parsedData = await s3Services.parseCSV(fileContent);
    
    res.json({
      fileName,
      folderPath,
      tipologia: fileTypeInfo.tipologia,
      descripcion: fileTypeInfo.descripcion,
      data: parsedData,
      userGroup: req.userAuth.grupo_documentos
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
      folderPath,
      resultado 
    } = req.body;

    if (!fileName || !folderPath || !resultado) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren fileName, folderPath y resultado'
      });
    }

    // Verificar que el usuario tiene acceso a esta carpeta
    const basePath = req.userAuth.grupo_documentos;
    if (!folderPath.startsWith(basePath)) {
      return res.status(403).json({
        error: 'Acceso denegado a esta carpeta'
      });
    }
    
    // Información del usuario autenticado
    const idUsuario = req.user.username;
    const nombreUsuario = req.user.name || req.user.username;
    const bucket = req.userAuth.bucket;
    const timestamp = new Date().toISOString();
    
    console.log(`Procesando archivo completo: ${fileName} en ${folderPath}`);
    console.log(`Resultado: ${resultado}, Usuario: ${nombreUsuario} (${idUsuario})`);
    
    // 1. PASO 1: Obtener y procesar el CSV
    const sourceKey = `${folderPath}/${fileName}`;
    const destinationKey = `Recepcion/Muestreo/Resultado/${fileName}`;
    
    // Obtener el contenido actual del CSV
    const currentContent = await s3Services.getFileContent(bucket, sourceKey);
    
    // Parsear el CSV para obtener los idDocumento
    const csvData = await s3Services.parseCSV(currentContent);
    
    // Actualizar el contenido del CSV con resultado, usuario y timestamp
    const updatedContent = await s3Services.updateCSVContent(
      currentContent, 
      {
        resultado,
        idUsuario,
        nombreUsuario,
        timestamp
      }
    );
    
    // 2. PASO 2: Mover el CSV a Resultado (PRIMERO como solicitaste)
    console.log(`Moviendo CSV de ${sourceKey} a ${destinationKey}`);
    await s3Services.uploadFile(bucket, destinationKey, updatedContent);
    await s3Services.deleteFile(bucket, sourceKey);
    
    // 3. PASO 3: Mover cada PDF individualmente (UNO POR UNO)
    const movedDocuments = [];
    const failedDocuments = [];
    
    for (const row of csvData) {
      if (row.idDocumento) {
        try {
          const pdfSourceKey = `Recepcion/${row.idDocumento}`;
          const pdfDestinationKey = `Recepcion/Muestreo/BackupPDF/${row.idDocumento}`;
          
          // Verificar si el archivo PDF existe antes de intentar moverlo
          const pdfExists = await s3Services.fileExists(bucket, pdfSourceKey);
          
          if (pdfExists) {
            console.log(`Moviendo PDF: ${row.idDocumento}`);
            await s3Services.moveFile(bucket, pdfSourceKey, pdfDestinationKey);
            movedDocuments.push(row.idDocumento);
          } else {
            console.warn(`PDF no encontrado: ${row.idDocumento} en ${pdfSourceKey}`);
            failedDocuments.push({
              idDocumento: row.idDocumento,
              reason: 'Archivo no encontrado'
            });
          }
        } catch (error) {
          console.error(`Error moviendo PDF ${row.idDocumento}:`, error);
          failedDocuments.push({
            idDocumento: row.idDocumento,
            reason: error.message
          });
        }
      }
    }
    
    console.log(`Procesamiento completado: ${movedDocuments.length} PDFs movidos exitosamente`);
    if (failedDocuments.length > 0) {
      console.log(`${failedDocuments.length} PDFs no pudieron ser movidos:`, failedDocuments);
    }
    
    res.json({ 
      success: true, 
      message: `Archivo ${fileName} procesado completamente`,
      csvMoved: true,
      csvDestination: destinationKey,
      documentsProcessed: csvData.length,
      documentsMovedSuccessfully: movedDocuments.length,
      documentsFailed: failedDocuments.length,
      failedDocuments: failedDocuments,
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

// Obtener todas las autorizaciones disponibles para un usuario
app.get('/api/user/availableBuckets', fullAuthMiddleware, async (req, res) => {
  try {
    const allAuthorizations = await authorizationService.getAllUserAuthorizationConfigs(req.user.username);
    
    if (allAuthorizations.length === 0) {
      return res.status(404).json({
        error: 'No se encontraron autorizaciones para el usuario'
      });
    }

    // Crear una estructura más amigable para el frontend
    const buckets = allAuthorizations.map(auth => ({
      id: auth.id,
      bucket: auth.bucket,
      grupoDocumentos: auth.grupo_documentos,
      descripcion: auth.grupo_documentos.split('/').pop(), // Último segmento como descripción amigable
      fechaCreacion: auth.fecha_creacion
    }));

    res.json({
      success: true,
      buckets: buckets,
      currentBucket: req.userAuth // La autorización actual del middleware
    });
  } catch (error) {
    console.error('Error obteniendo buckets disponibles:', error);
    res.status(500).json({
      error: 'Error obteniendo buckets disponibles',
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

// ===== ENDPOINTS DE ADMINISTRACIÓN (Solo para usuarios admin) =====

// Verificar si el usuario actual es administrador
app.get('/api/admin/isAdmin', fullAuthMiddleware, async (req, res) => {
  try {
    const isAdmin = await authorizationService.isUserAdmin(req.user.username);
    res.json({ 
      success: true, 
      isAdmin,
      username: req.user.username
    });
  } catch (error) {
    console.error('Error verificando admin:', error);
    res.status(500).json({
      error: 'Error verificando permisos de administración',
      details: error.message
    });
  }
});

// Obtener todas las autorizaciones (solo admins)
app.get('/api/admin/all-authorizations', fullAdminMiddleware, async (req, res) => {
  try {
    const result = await authorizationService.getAllAuthorizations();
    res.json(result);
  } catch (error) {
    console.error('Error obteniendo todas las autorizaciones:', error);
    res.status(500).json({
      error: 'Error obteniendo autorizaciones',
      details: error.message
    });
  }
});

// Crear nueva autorización completa (solo admins)
app.post('/api/admin/create-authorization', fullAdminMiddleware, async (req, res) => {
  try {
    const { username, bucket, grupo_documentos, admin } = req.body;
    
    if (!username || !bucket || !grupo_documentos) {
      return res.status(400).json({
        error: 'Datos incompletos',
        message: 'Se requieren username, bucket y grupo_documentos'
      });
    }
    
    const result = await authorizationService.createAuthorizationAdmin(
      username, 
      bucket, 
      grupo_documentos,
      admin || false
    );
    
    console.log(`Admin ${req.user.username} creó nueva autorización para ${username}`);
    res.json(result);
  } catch (error) {
    console.error('Error creando autorización (admin):', error);
    res.status(500).json({
      error: 'Error creando autorización',
      details: error.message
    });
  }
});

// Actualizar autorización por ID (solo admins)
app.put('/api/admin/update-authorization/:id', fullAdminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    if (!id) {
      return res.status(400).json({
        error: 'ID de autorización requerido'
      });
    }
    
    const result = await authorizationService.updateAuthorizationById(id, updates);
    
    console.log(`Admin ${req.user.username} actualizó autorización ID ${id}`);
    res.json(result);
  } catch (error) {
    console.error('Error actualizando autorización (admin):', error);
    res.status(500).json({
      error: 'Error actualizando autorización',
      details: error.message
    });
  }
});

// Eliminar autorización por ID (solo admins)
app.delete('/api/admin/delete-authorization/:id', fullAdminMiddleware, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (!id) {
      return res.status(400).json({
        error: 'ID de autorización requerido'
      });
    }
    
    const result = await authorizationService.deleteAuthorization(id);
    
    console.log(`Admin ${req.user.username} eliminó autorización ID ${id}`);
    res.json(result);
  } catch (error) {
    console.error('Error eliminando autorización (admin):', error);
    res.status(500).json({
      error: 'Error eliminando autorización',
      details: error.message
    });
  }
});

// Ruta de salud del servidor
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente' });
});

app.listen(PORT, () => {
  console.log(`Servidor backend ejecutándose en puerto ${PORT}`);
});
