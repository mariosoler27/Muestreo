require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getFileTypeFromName } = require('./config/fileTypes');
const { authMiddleware } = require('./middleware/simpleAuth');
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

// Obtener lista de archivos del bucket S3 (requiere autenticación)
app.get('/api/getFiles', authMiddleware, async (req, res) => {
  try {
    const bucket = process.env.S3_BUCKET_NAME || 'rgpdintcomer-des-deltasmile-servinform';
    const prefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    
    console.log(`Obteniendo archivos del bucket: ${bucket}, prefix: ${prefix}`);
    
    const files = await s3Services.listFiles(bucket, prefix);
    
    // Agregar información de tipología a cada archivo
    const filesWithTypes = files.map(file => {
      const fileType = getFileTypeFromName(file.name);
      return {
        ...file,
        tipologia: fileType.tipologia,
        descripcion: fileType.descripcion
      };
    });
    
    res.json(filesWithTypes);
  } catch (error) {
    console.error('Error obteniendo archivos:', error);
    res.status(500).json({ 
      error: 'Error al obtener los archivos', 
      details: error.message 
    });
  }
});

// Obtener información específica de un archivo CSV (requiere autenticación)
app.get('/api/getFileInfo/:fileName', authMiddleware, async (req, res) => {
  try {
    const fileName = req.params.fileName;
    const bucket = process.env.S3_BUCKET_NAME || 'rgpdintcomer-des-deltasmile-servinform';
    const sourcePrefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    const key = `${sourcePrefix}${fileName}`;
    
    console.log(`Obteniendo información del archivo: ${fileName}`);
    
    const fileContent = await s3Services.getFileContent(bucket, key);
    const parsedData = await s3Services.parseCSV(fileContent);
    
    // Agregar información de tipología
    const fileType = getFileTypeFromName(fileName);
    
    res.json({
      fileName,
      tipologia: fileType.tipologia,
      descripcion: fileType.descripcion,
      data: parsedData
    });
  } catch (error) {
    console.error('Error obteniendo información del archivo:', error);
    res.status(500).json({ 
      error: 'Error al obtener la información del archivo', 
      details: error.message 
    });
  }
});

// Procesar un archivo (requiere autenticación)
app.post('/api/processFile', authMiddleware, async (req, res) => {
  try {
    const { 
      fileName, 
      idSpool, 
      tipoDocumento, 
      resultado 
    } = req.body;
    
    // Usar información del usuario autenticado
    const idUsuario = req.user.username;
    const nombreUsuario = req.user.name || req.user.username;
    
    const bucket = process.env.S3_BUCKET_NAME || 'rgpdintcomer-des-deltasmile-servinform';
    const sourcePrefix = process.env.S3_SOURCE_PREFIX || 'Recepcion/Muestreo/';
    const destinationPrefix = process.env.S3_DESTINATION_PREFIX || 'Recepcion/Muestreo/Resultado/';
    const sourceKey = `${sourcePrefix}${fileName}`;
    const destinationKey = `${destinationPrefix}${fileName}`;
    
    console.log(`Procesando archivo: ${fileName}`);
    console.log(`Resultado: ${resultado}, Usuario: ${nombreUsuario} (${idUsuario})`);
    
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
      resultado
    });
  } catch (error) {
    console.error('Error procesando archivo:', error);
    res.status(500).json({ 
      error: 'Error al procesar el archivo', 
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
