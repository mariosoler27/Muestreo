const AuthorizationService = require('../services/authorizationService');

/**
 * Middleware de autorización que verifica los permisos adicionales del usuario
 * después de la autenticación exitosa con Cognito
 */

const authorizationService = new AuthorizationService();

/**
 * Middleware principal de autorización
 * Se ejecuta después del middleware de autenticación para verificar permisos específicos
 */
const authorizationMiddleware = async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado
    if (!req.user || !req.user.username) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Se requiere autenticación antes de verificar autorización'
      });
    }

    const username = req.user.username;
    
    // Verificar si se especifica un bucket específico en los headers
    const selectedBucketId = req.headers['x-selected-bucket-id'];
    const selectedGroupDocuments = req.headers['x-selected-group-documents'];
    
    let userAuth = null;
    
    if (selectedBucketId && selectedGroupDocuments) {
      // Buscar la autorización específica
      const allAuths = await authorizationService.getAllUserAuthorizationConfigs(username);
      userAuth = allAuths.find(auth => auth.id === parseInt(selectedBucketId));
      
      if (!userAuth) {
        console.log(`Usuario ${username} no tiene autorización para el bucket ID ${selectedBucketId}`);
        return res.status(403).json({
          error: 'Sin autorización para bucket específico',
          message: 'El usuario no tiene permisos para el bucket seleccionado'
        });
      }
    } else {
      // Usar la autorización por defecto (primera encontrada)
      userAuth = await authorizationService.getUserAuthorizationConfig(username);
    }
    
    if (!userAuth) {
      console.log(`Usuario ${username} no tiene permisos de autorización configurados`);
      return res.status(403).json({
        error: 'Sin autorización',
        message: 'El usuario no tiene permisos configurados para acceder a este sistema'
      });
    }

    if (!userAuth.activo) {
      console.log(`Usuario ${username} tiene permisos desactivados`);
      return res.status(403).json({
        error: 'Autorización desactivada',
        message: 'Los permisos del usuario han sido desactivados'
      });
    }

    // Añadir información de autorización al request
    req.userAuth = userAuth;
    
    console.log(`Autorización verificada para ${username}:`, {
      bucket: userAuth.bucket,
      grupo_documentos: userAuth.grupo_documentos,
      selected: selectedBucketId ? 'specific' : 'default'
    });
    
    next();
  } catch (error) {
    console.error('Error en middleware de autorización:', error);
    return res.status(500).json({
      error: 'Error de autorización',
      message: 'Error interno verificando permisos del usuario'
    });
  }
};

/**
 * Middleware específico para verificar acceso a bucket
 */
const bucketAuthorizationMiddleware = (requiredBucket = null) => {
  return async (req, res, next) => {
    try {
      if (!req.userAuth) {
        return res.status(403).json({
          error: 'Sin autorización',
          message: 'No se encontró información de autorización'
        });
      }

      const userBucket = req.userAuth.bucket;
      const targetBucket = requiredBucket || process.env.S3_BUCKET_NAME;

      if (userBucket !== targetBucket) {
        console.log(`Acceso denegado al bucket ${targetBucket} para usuario ${req.user.username}. Bucket autorizado: ${userBucket}`);
        return res.status(403).json({
          error: 'Acceso denegado al bucket',
          message: `No tiene permisos para acceder al bucket solicitado`
        });
      }

      next();
    } catch (error) {
      console.error('Error en middleware de autorización de bucket:', error);
      return res.status(500).json({
        error: 'Error de autorización',
        message: 'Error verificando permisos de bucket'
      });
    }
  };
};

/**
 * Middleware para verificar acceso a grupo de documentos específico
 */
const documentGroupAuthorizationMiddleware = (requiredGroup) => {
  return async (req, res, next) => {
    try {
      if (!req.userAuth) {
        return res.status(403).json({
          error: 'Sin autorización',
          message: 'No se encontró información de autorización'
        });
      }

      const userGroup = req.userAuth.grupo_documentos;

      if (userGroup !== requiredGroup) {
        console.log(`Acceso denegado al grupo ${requiredGroup} para usuario ${req.user.username}. Grupo autorizado: ${userGroup}`);
        return res.status(403).json({
          error: 'Acceso denegado al grupo de documentos',
          message: `No tiene permisos para acceder a documentos del tipo ${requiredGroup}`
        });
      }

      next();
    } catch (error) {
      console.error('Error en middleware de autorización de grupo:', error);
      return res.status(500).json({
        error: 'Error de autorización',
        message: 'Error verificando permisos de grupo de documentos'
      });
    }
  };
};

/**
 * Middleware para verificar acceso a archivos específicos basado en tipología
 */
const fileAuthorizationMiddleware = async (req, res, next) => {
  try {
    if (!req.userAuth) {
      return res.status(403).json({
        error: 'Sin autorización',
        message: 'No se encontró información de autorización'
      });
    }

    // Si hay un fileName en los parámetros, verificar acceso
    const fileName = req.params.fileName;
    if (fileName) {
      const { getFileTypeFromName } = require('../config/fileTypes');
      const fileTypeInfo = getFileTypeFromName(fileName);
      
      const accessCheck = await authorizationService.canAccessFile(
        req.user.username, 
        fileName, 
        fileTypeInfo
      );

      if (!accessCheck.canAccess) {
        console.log(`Acceso denegado al archivo ${fileName} para usuario ${req.user.username}: ${accessCheck.reason}`);
        return res.status(403).json({
          error: 'Acceso denegado al archivo',
          message: accessCheck.reason
        });
      }

      // Añadir información del archivo al request
      req.fileTypeInfo = fileTypeInfo;
      req.fileAccessInfo = accessCheck;
    }

    next();
  } catch (error) {
    console.error('Error en middleware de autorización de archivo:', error);
    return res.status(500).json({
      error: 'Error de autorización',
      message: 'Error verificando permisos de archivo'
    });
  }
};

/**
 * Middleware combinado: autenticación + autorización básica
 */
const fullAuthMiddleware = (req, res, next) => {
  // Primero aplicar el middleware de autenticación existente
  const { authMiddleware } = require('./simpleAuth');
  
  authMiddleware(req, res, (authError) => {
    if (authError) {
      return next(authError);
    }
    
    // Luego aplicar el middleware de autorización
    authorizationMiddleware(req, res, next);
  });
};

/**
 * Middleware para verificar que el usuario sea administrador
 */
const adminAuthorizationMiddleware = async (req, res, next) => {
  try {
    // Verificar que el usuario esté autenticado primero
    if (!req.user || !req.user.username) {
      return res.status(401).json({
        error: 'No autenticado',
        message: 'Se requiere autenticación para acceder a funciones de administración'
      });
    }

    const username = req.user.username;
    
    // Verificar si el usuario es administrador
    const isAdmin = await authorizationService.isUserAdmin(username);
    
    if (!isAdmin) {
      console.log(`Usuario ${username} intentó acceder a funciones de administración sin permisos`);
      return res.status(403).json({
        error: 'Sin permisos de administración',
        message: 'El usuario no tiene permisos de administración'
      });
    }

    console.log(`Acceso de administrador verificado para ${username}`);
    next();
  } catch (error) {
    console.error('Error en middleware de autorización de administrador:', error);
    return res.status(500).json({
      error: 'Error de autorización',
      message: 'Error interno verificando permisos de administración'
    });
  }
};

/**
 * Middleware combinado: autenticación + autorización + admin
 */
const fullAdminMiddleware = (req, res, next) => {
  // Primero aplicar el middleware de autenticación
  const { authMiddleware } = require('./simpleAuth');
  
  authMiddleware(req, res, (authError) => {
    if (authError) {
      return next(authError);
    }
    
    // Luego aplicar el middleware de admin
    adminAuthorizationMiddleware(req, res, next);
  });
};

/**
 * Obtener información de autorización para uso en rutas
 */
const getAuthorizationInfo = async (username) => {
  try {
    return await authorizationService.getUserAuthorizationConfig(username);
  } catch (error) {
    console.error('Error obteniendo información de autorización:', error);
    return null;
  }
};

module.exports = {
  authorizationMiddleware,
  bucketAuthorizationMiddleware,
  documentGroupAuthorizationMiddleware,
  fileAuthorizationMiddleware,
  fullAuthMiddleware,
  adminAuthorizationMiddleware,
  fullAdminMiddleware,
  getAuthorizationInfo,
  authorizationService // Exportar el servicio para uso directo si es necesario
};
