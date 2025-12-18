const AWS = require('aws-sdk');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Configurar AWS SDK usando variables de entorno
AWS.config.update({
  region: process.env.AWS_REGION || 'eu-west-1',
  accessKeyId: process.env.aws_access_key_id,
  secretAccessKey: process.env.aws_secret_access_key,
  sessionToken: process.env.aws_session_token // Opcional, solo si usas tokens temporales
});

const s3 = new AWS.S3;

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
        skipEmptyLines: true
        // No definir headers manualmente - usar la primera línea del CSV como cabeceras
      }))
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        console.log(`CSV parseado: ${results.length} registros encontrados (sin contar cabeceras)`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error parseando CSV:', error);
        reject(new Error(`Error al parsear CSV: ${error.message}`));
      });
  });
}

/**
 * Actualizar contenido CSV con información adicional para todas las filas
 */
async function updateCSVContent(originalContent, updateInfo) {
  try {
    const { resultado, idUsuario, nombreUsuario, timestamp } = updateInfo;
    
    // Parsear el CSV original
    const originalData = await parseCSV(originalContent);
    
    if (!originalData || originalData.length === 0) {
      throw new Error('No hay datos en el CSV para procesar');
    }
    
    // Obtener las cabeceras originales del primer objeto
    const originalHeaders = Object.keys(originalData[0]);
    
    // Agregar nuevas cabeceras si no existen
    const newHeaders = [...originalHeaders];
    if (!newHeaders.includes('resultado')) newHeaders.push('resultado');
    if (!newHeaders.includes('matriculaValidador')) newHeaders.push('matriculaValidador');
    if (!newHeaders.includes('nombreValidador')) newHeaders.push('nombreValidador');
    if (!newHeaders.includes('fechaValidacion')) newHeaders.push('fechaValidacion');
    
    // Crear la línea de cabeceras
    const headers = newHeaders.join(',') + '\n';
    
    // Crear las filas con la información actualizada
    const updatedRows = originalData.map(row => {
      const updatedRow = { ...row };
      
      // Actualizar los campos de procesamiento para cada fila
      updatedRow.resultado = resultado;
      updatedRow.matriculaValidador = idUsuario;
      updatedRow.nombreValidador = nombreUsuario;
      updatedRow.fechaValidacion = timestamp;
      
      // Crear la fila en formato CSV
      return newHeaders.map(header => {
        const value = updatedRow[header] || '';
        // Escapar comas y comillas si es necesario
        if (value.toString().includes(',') || value.toString().includes('"')) {
          return `"${value.toString().replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',');
    });
    
    const updatedContent = headers + updatedRows.join('\n');
    
    console.log(`Contenido CSV actualizado con ${updatedRows.length} filas procesadas`);
    return updatedContent;
  } catch (error) {
    console.error('Error actualizando contenido CSV:', error);
    throw new Error(`Error al actualizar CSV: ${error.message}`);
  }
}

/**
 * Mover un archivo dentro del mismo bucket de S3 (copiar + eliminar original)
 */
async function moveFile(bucket, sourceKey, destinationKey) {
  try {
    // 1. Copiar el archivo al destino
    const copyParams = {
      Bucket: bucket,
      CopySource: `${bucket}/${sourceKey}`,
      Key: destinationKey
    };

    await s3.copyObject(copyParams).promise();
    console.log(`Archivo copiado de ${sourceKey} a ${destinationKey}`);

    // 2. Eliminar el archivo original
    await deleteFile(bucket, sourceKey);
    console.log(`Archivo movido exitosamente de ${sourceKey} a ${destinationKey}`);

    return { success: true, sourceKey, destinationKey };
  } catch (error) {
    console.error(`Error moviendo archivo de ${sourceKey} a ${destinationKey}:`, error);
    throw error;
  }
}

/**
 * Verificar si un archivo existe en S3
 */
async function fileExists(bucket, key) {
  try {
    const params = {
      Bucket: bucket,
      Key: key
    };
    await s3.headObject(params).promise();
    return true;
  } catch (error) {
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      return false;
    }
    throw error;
  }
}

/**
 * Subir un archivo a S3
 */
async function uploadFile(bucket, key, content) {
  try {
    const params = {
      Bucket: bucket,
      Key: key,
      Body: content,
      ContentType: 'text/csv' // Asumimos CSV ya que es lo que estamos procesando
    };

    const result = await s3.upload(params).promise();
    console.log(`Archivo subido exitosamente: ${bucket}/${key}`);
    return result;
  } catch (error) {
    console.error(`Error subiendo archivo ${key}:`, error);
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

/**
 * Descargar archivo desde S3 como stream
 */
async function downloadFile(bucket, key) {
  try {
    const params = {
      Bucket: bucket,
      Key: key
    };

    // Verificar que el archivo existe
    await s3.headObject(params).promise();
    
    // Crear stream para descarga
    const stream = s3.getObject(params).createReadStream();
    
    console.log(`Stream creado para descarga: ${bucket}/${key}`);
    return stream;
  } catch (error) {
    console.error(`Error descargando archivo ${key}:`, error);
    if (error.code === 'NotFound' || error.code === 'NoSuchKey') {
      const notFoundError = new Error(`Archivo no encontrado: ${key}`);
      notFoundError.code = 'NoSuchKey';
      throw notFoundError;
    }
    throw new Error(`Error al descargar archivo: ${error.message}`);
  }
}

/**
 * Listar carpetas (directorios) de un bucket S3 con un prefix específico
 */
async function listFolders(bucket, prefix) {
  try {
    const params = {
      Bucket: bucket,
      Prefix: prefix.endsWith('/') ? prefix : prefix + '/',
      Delimiter: '/'
    };

    const data = await s3.listObjectsV2(params).promise();
    
    // Extraer carpetas de los CommonPrefixes
    const folders = (data.CommonPrefixes || []).map(item => {
      const folderPath = item.Prefix;
      const folderName = folderPath.slice(prefix.length + 1).replace('/', '');
      
      return {
        name: folderName,
        path: folderPath.slice(0, -1), // Quitar la barra final
        fullPath: folderPath
      };
    }).filter(folder => folder.name); // Filtrar carpetas vacías

    console.log(`Encontradas ${folders.length} carpetas en ${bucket}/${prefix}`);
    return folders;
  } catch (error) {
    console.error('Error listando carpetas de S3:', error);
    throw new Error(`Error al listar carpetas: ${error.message}`);
  }
}

module.exports = {
  listFiles,
  listFolders,
  getFileContent,
  parseCSV,
  updateCSVContent,
  uploadFile,
  deleteFile,
  downloadFile,
  moveFile,
  fileExists
};
