const AWS = require('aws-sdk');
const csv = require('csv-parser');
const { Readable } = require('stream');
const https = require('https');

// Configurar agente HTTPS para ignorar certificados autofirmados
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configurar AWS SDK usando variables de entorno
AWS.config.update({
  region: process.env.AWS_REGION || 'eu-west-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN, // Opcional, solo si usas tokens temporales
  httpOptions: {
    agent: httpsAgent
  }
});

const s3 = new AWS.S3({
  httpOptions: {
    agent: httpsAgent
  }
});

/**
 * Listar archivos de un bucket S3 con un prefix específico
 */
async function listFiles(bucket, prefix) {
  try {
    const params = {
      Bucket: bucket,
      Prefix: prefix
    };

    const data = await s3.listObjectsV2(params).promise();
    
    const files = data.Contents
      .filter(item => {
        // Excluir carpetas
        if (item.Key.endsWith('/')) return false;
        
        // Solo incluir archivos que estén directamente en el directorio del prefix
        // (sin subcarpetas adicionales)
        const relativePath = item.Key.slice(prefix.length);
        return !relativePath.includes('/');
      })
      .map(item => ({
        name: item.Key.split('/').pop(), // Solo el nombre del archivo sin la ruta
        key: item.Key,
        size: item.Size,
        lastModified: item.LastModified,
        fullPath: item.Key
      }));

    console.log(`Encontrados ${files.length} archivos en ${bucket}/${prefix}`);
    return files;
  } catch (error) {
    console.error('Error listando archivos de S3:', error);
    throw new Error(`Error al listar archivos: ${error.message}`);
  }
}

/**
 * Obtener el contenido de un archivo específico de S3
 */
async function getFileContent(bucket, key) {
  try {
    const params = {
      Bucket: bucket,
      Key: key
    };

    const data = await s3.getObject(params).promise();
    return data.Body.toString('utf-8');
  } catch (error) {
    console.error(`Error obteniendo archivo ${key}:`, error);
    throw new Error(`Error al obtener el archivo: ${error.message}`);
  }
}

/**
 * Parsear contenido CSV y devolver un array de objetos
 */
async function parseCSV(csvContent) {
  return new Promise((resolve, reject) => {
    const results = [];
    const readable = Readable.from([csvContent]);
    
    readable
      .pipe(csv({
        separator: ',', // O ';' dependiendo del formato
        skipEmptyLines: true,
        headers: ['idSpool', 'tipoDocumento'] // Headers esperados basados en los requisitos
      }))
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        console.log(`CSV parseado: ${results.length} registros encontrados`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error parseando CSV:', error);
        reject(new Error(`Error al parsear CSV: ${error.message}`));
      });
  });
}

/**
 * Actualizar contenido CSV con información adicional
 */
async function updateCSVContent(originalContent, updateInfo) {
  try {
    const { idSpool, tipoDocumento, resultado, idUsuario, nombreUsuario, timestamp } = updateInfo;
    
    // Parsear el CSV original
    const originalData = await parseCSV(originalContent);
    
    // Crear el contenido actualizado
    // Agregar headers adicionales
    const headers = 'idSpool,tipoDocumento,resultado,idUsuario,nombreUsuario,timestamp\n';
    
    // Crear las filas con la información actualizada
    const updatedRows = originalData.map(row => {
      return `${row.idSpool || idSpool},${row.tipoDocumento || tipoDocumento},${resultado},${idUsuario},${nombreUsuario},${timestamp}`;
    });
    
    const updatedContent = headers + updatedRows.join('\n');
    
    console.log('Contenido CSV actualizado con nueva información');
    return updatedContent;
  } catch (error) {
    console.error('Error actualizando contenido CSV:', error);
    throw new Error(`Error al actualizar CSV: ${error.message}`);
  }
}

/**
 * Subir archivo a S3
 */
async function uploadFile(bucket, key, content) {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/csv'
    };

    await s3.upload(params).promise();
    console.log(`Archivo subido exitosamente a ${bucket}/${key}`);
  } catch (error) {
    console.error(`Error subiendo archivo a ${key}:`, error);
    throw new Error(`Error al subir archivo: ${error.message}`);
  }
}

/**
 * Eliminar archivo de S3
 */
async function deleteFile(bucket, key) {
  try {
    const params = {
      Bucket: bucket,
      Key: key
    };

    await s3.deleteObject(params).promise();
    console.log(`Archivo eliminado exitosamente: ${bucket}/${key}`);
  } catch (error) {
    console.error(`Error eliminando archivo ${key}:`, error);
    throw new Error(`Error al eliminar archivo: ${error.message}`);
  }
}

module.exports = {
  listFiles,
  getFileContent,
  parseCSV,
  updateCSVContent,
  uploadFile,
  deleteFile
};
