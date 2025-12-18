const UserAuthorization = require('../models/userAuthorization');

/**
 * Servicio de autorización que gestiona los permisos de los usuarios
 * para acceder a buckets y grupos de documentos específicos
 */

class AuthorizationService {
  constructor() {
    this.userAuthModel = new UserAuthorization();
    this.initializeIfNeeded();
  }

  /**
   * Inicializar datos de prueba si es necesario (solo en desarrollo)
   */
  async initializeIfNeeded() {
    try {
      // Inicializar datos de prueba si no hay datos
      if (process.env.NODE_ENV !== 'production') {
        await this.userAuthModel.initializeTestData();
      }
    } catch (error) {
      console.error('Error inicializando servicio de autorización:', error);
    }
  }

  /**
   * Verificar si un usuario está autorizado para acceder a recursos específicos
   */
  async checkUserAuthorization(username, bucket = null, grupoDocumentos = null) {
    try {
      console.log(`Verificando autorización para usuario: ${username}`);
      
      const result = await this.userAuthModel.verifyAccess(username, bucket, grupoDocumentos);
      
      if (!result.hasAccess) {
        console.log(`Acceso denegado para ${username}: ${result.reason}`);
        return {
          authorized: false,
          message: result.reason,
          userAuth: null
        };
      }

      console.log(`Acceso autorizado para ${username}`);
      return {
        authorized: true,
        message: 'Acceso autorizado',
        userAuth: result.authorization
      };
    } catch (error) {
      console.error('Error verificando autorización:', error);
      return {
        authorized: false,
        message: 'Error interno verificando permisos',
        userAuth: null
      };
    }
  }

  /**
   * Obtener la configuración de autorización de un usuario (primera encontrada)
   */
  async getUserAuthorizationConfig(username) {
    try {
      const userAuth = await this.userAuthModel.getUserAuthorization(username);
      return userAuth;
    } catch (error) {
      console.error('Error obteniendo configuración de autorización:', error);
      return null;
    }
  }

  /**
   * Obtener todas las configuraciones de autorización de un usuario
   */
  async getAllUserAuthorizationConfigs(username) {
    try {
      const userAuths = await this.userAuthModel.getAllUserAuthorizations(username);
      return userAuths;
    } catch (error) {
      console.error('Error obteniendo todas las configuraciones de autorización:', error);
      return [];
    }
  }

  /**
   * Obtener una autorización específica por bucket y grupo
   */
  async getUserAuthorizationSpecific(username, bucket, grupoDocumentos) {
    try {
      const userAuth = await this.userAuthModel.getUserAuthorizationSpecific(username, bucket, grupoDocumentos);
      return userAuth;
    } catch (error) {
      console.error('Error obteniendo autorización específica:', error);
      return null;
    }
  }

  /**
   * Crear nueva autorización para un usuario
   */
  async createUserAuthorization(username, bucket, grupoDocumentos) {
    try {
      // Validar grupo de documentos
      const validGroups = ['Cartas', 'Facturas'];
      if (!validGroups.includes(grupoDocumentos)) {
        throw new Error(`Grupo de documentos inválido. Debe ser: ${validGroups.join(' o ')}`);
      }

      const newAuth = await this.userAuthModel.createUserAuthorization(
        username, 
        bucket, 
        grupoDocumentos
      );

      console.log(`Nueva autorización creada para ${username}:`, {
        bucket: newAuth.bucket,
        grupo_documentos: newAuth.grupo_documentos
      });

      return {
        success: true,
        authorization: newAuth
      };
    } catch (error) {
      console.error('Error creando autorización:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Actualizar autorización existente
   */
  async updateUserAuthorization(username, updates) {
    try {
      // Validar grupo de documentos si se está actualizando
      if (updates.grupo_documentos) {
        const validGroups = ['Cartas', 'Facturas'];
        if (!validGroups.includes(updates.grupo_documentos)) {
          throw new Error(`Grupo de documentos inválido. Debe ser: ${validGroups.join(' o ')}`);
        }
      }

      const updatedAuth = await this.userAuthModel.updateUserAuthorization(username, updates);

      console.log(`Autorización actualizada para ${username}:`, updates);

      return {
        success: true,
        authorization: updatedAuth
      };
    } catch (error) {
      console.error('Error actualizando autorización:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Desactivar autorización de un usuario
   */
  async deactivateUserAuthorization(username) {
    try {
      const result = await this.userAuthModel.deactivateUserAuthorization(username);
      
      console.log(`Autorización desactivada para ${username}`);
      
      return {
        success: true,
        authorization: result
      };
    } catch (error) {
      console.error('Error desactivando autorización:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Obtener todas las autorizaciones (para administración)
   */
  async getAllAuthorizations() {
    try {
      const authorizations = await this.userAuthModel.getAllAuthorizations();
      return {
        success: true,
        authorizations: authorizations
      };
    } catch (error) {
      console.error('Error obteniendo todas las autorizaciones:', error);
      return {
        success: false,
        message: error.message,
        authorizations: []
      };
    }
  }

  /**
   * Verificar si un usuario puede acceder a un archivo específico basado en la carpeta donde se encuentra
   */
  async canAccessFile(username, fileName, fileTypeInfo, folderPath = null) {
    try {
      const userAuth = await this.userAuthModel.getUserAuthorization(username);
      
      if (!userAuth) {
        return {
          canAccess: false,
          reason: 'Usuario no autorizado'
        };
      }

      // Si se proporciona una ruta de carpeta, verificar que esté dentro de la ruta autorizada
      if (folderPath) {
        const authorizedPath = userAuth.grupo_documentos;
        
        // Verificar que la carpeta del archivo esté dentro de la ruta autorizada
        if (!folderPath.startsWith(authorizedPath)) {
          return {
            canAccess: false,
            reason: `Acceso denegado. El archivo "${fileName}" en la carpeta "${folderPath}" no está dentro de la ruta autorizada "${authorizedPath}"`
          };
        }
      } else {
        // Si no hay carpeta especificada, verificar por tipo de archivo (compatibilidad con código anterior)
        const descripcion = fileTypeInfo.descripcion.toLowerCase();
        const userGroup = userAuth.grupo_documentos;
        
        let canAccess = false;
        
        if (userGroup.includes('Facturas')) {
          canAccess = descripcion.includes('factur');
        } else if (userGroup.includes('Cartas')) {
          canAccess = descripcion.includes('cartas');
        }
        
        if (!canAccess) {
          return {
            canAccess: false,
            reason: `Acceso denegado. El archivo "${fileName}" con descripción "${fileTypeInfo.descripcion}" no coincide con el grupo autorizado "${userGroup}"`
          };
        }
      }

      return {
        canAccess: true,
        userAuth: userAuth
      };
    } catch (error) {
      console.error('Error verificando acceso a archivo:', error);
      return {
        canAccess: false,
        reason: 'Error interno verificando permisos'
      };
    }
  }

  /**
   * Obtener bucket autorizado para un usuario
   */
  async getAuthorizedBucket(username) {
    try {
      const userAuth = await this.userAuthModel.getUserAuthorization(username);
      return userAuth ? userAuth.bucket : null;
    } catch (error) {
      console.error('Error obteniendo bucket autorizado:', error);
      return null;
    }
  }

  /**
   * Obtener grupo de documentos autorizado para un usuario
   */
  async getAuthorizedDocumentGroup(username) {
    try {
      const userAuth = await this.userAuthModel.getUserAuthorization(username);
      return userAuth ? userAuth.grupo_documentos : null;
    } catch (error) {
      console.error('Error obteniendo grupo de documentos autorizado:', error);
      return null;
    }
  }
}

module.exports = AuthorizationService;
