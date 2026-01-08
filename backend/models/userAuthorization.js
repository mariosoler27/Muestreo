const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const User = require('./user');

/**
 * Modelo de autorización de usuarios utilizando SQLite
 * Nueva estructura de la tabla de autorización:
 * - id: identificador único de la autorización
 * - user_id: foreign key a la tabla users
 * - bucket: bucket S3 asignado
 * - grupo_documentos: 'Cartas' o 'Facturas'
 * - activo: true/false
 * - fecha_creacion: timestamp de creación
 */

class UserAuthorization {
  constructor() {
    this.dbPath = path.join(__dirname, '../data/user_authorization.db');
    this.db = null;
    this.isReady = false;
    this.userModel = new User();
    this.initPromise = this.initDatabase();
  }

  /**
   * Inicializar la base de datos SQLite
   */
  async initDatabase() {
    try {
      // Asegurar que existe el directorio de datos
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });

      // Crear conexión a la base de datos
      return new Promise((resolve, reject) => {
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error('Error conectando a SQLite:', err.message);
            reject(err);
          } else {
            console.log('Conectado a la base de datos SQLite de autorización');
            this.createTables(resolve, reject);
          }
        });
      });
    } catch (error) {
      console.error('Error inicializando base de datos:', error);
      throw error;
    }
  }

  /**
   * Crear las tablas necesarias
   */
  createTables(resolve, reject) {
    // Crear la tabla de usuarios si no existe
    const createUsersTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        admin BOOLEAN NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createUsersTableSQL, (err) => {
      if (err) {
        console.error('Error creando tabla users:', err.message);
        reject(err);
        return;
      }

      // Crear la tabla de autorizaciones con estructura definitiva
      const createAuthTableSQL = `
        CREATE TABLE IF NOT EXISTS user_authorizations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          bucket TEXT NOT NULL,
          grupo_documentos TEXT NOT NULL,
          activo BOOLEAN NOT NULL DEFAULT 1,
          fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(user_id, bucket, grupo_documentos)
        )
      `;

      this.db.run(createAuthTableSQL, (err) => {
        if (err) {
          console.error('Error creando tabla user_authorizations:', err.message);
          reject(err);
        } else {
          console.log('Tablas users y user_authorizations creadas o ya existen');
          this.isReady = true;
          resolve();
        }
      });
    });
  }

  /**
   * Asegurar que la base de datos está lista
   */
  async ensureReady() {
    if (!this.isReady) {
      await this.initPromise;
    }
  }

  /**
   * Ejecutar query con promesa
   */
  runQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Base de datos no inicializada'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  /**
   * Obtener un registro
   */
  getQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Base de datos no inicializada'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Obtener múltiples registros
   */
  allQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Base de datos no inicializada'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Obtener autorización de un usuario (primera encontrada - para compatibilidad)
   */
  async getUserAuthorization(username) {
    try {
      await this.ensureReady();
      const sql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE u.username = ? AND ua.activo = 1 AND u.activo = 1
        ORDER BY ua.fecha_creacion DESC LIMIT 1
      `;
      const userAuth = await this.getQuery(sql, [username]);
      return userAuth || null;
    } catch (error) {
      console.error('Error obteniendo autorización de usuario:', error);
      throw error;
    }
  }

  /**
   * Obtener todas las autorizaciones de un usuario
   */
  async getAllUserAuthorizations(username) {
    try {
      await this.ensureReady();
      const sql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE u.username = ? AND ua.activo = 1 AND u.activo = 1
        ORDER BY ua.fecha_creacion DESC
      `;
      const userAuths = await this.allQuery(sql, [username]);
      return userAuths || [];
    } catch (error) {
      console.error('Error obteniendo autorizaciones de usuario:', error);
      throw error;
    }
  }

  /**
   * Obtener una autorización específica por usuario, bucket y grupo
   */
  async getUserAuthorizationSpecific(username, bucket, grupoDocumentos) {
    try {
      await this.ensureReady();
      const sql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE u.username = ? AND ua.bucket = ? AND ua.grupo_documentos = ? 
        AND ua.activo = 1 AND u.activo = 1
      `;
      const userAuth = await this.getQuery(sql, [username, bucket, grupoDocumentos]);
      return userAuth || null;
    } catch (error) {
      console.error('Error obteniendo autorización específica de usuario:', error);
      throw error;
    }
  }

  /**
   * Crear nueva autorización de usuario
   */
  async createUserAuthorization(username, bucket, grupoDocumentos) {
    try {
      await this.ensureReady();
      
      // Primero asegurar que el usuario existe
      let user = await this.userModel.getUser(username);
      if (!user) {
        // Crear usuario si no existe
        user = await this.userModel.createUser(username, false);
      }
      
      // Verificar si ya existe esta autorización específica
      const existing = await this.getUserAuthorizationSpecific(username, bucket, grupoDocumentos);
      
      if (existing) {
        // Ya existe esta combinación exacta, activarla si está inactiva
        if (!existing.activo) {
          const updateSql = `
            UPDATE user_authorizations 
            SET activo = 1, fecha_creacion = CURRENT_TIMESTAMP
            WHERE user_id = ? AND bucket = ? AND grupo_documentos = ?
          `;
          await this.runQuery(updateSql, [user.id, bucket, grupoDocumentos]);
          return await this.getUserAuthorizationSpecific(username, bucket, grupoDocumentos);
        }
        return existing;
      } else {
        // Crear nueva autorización
        const insertSql = `
          INSERT INTO user_authorizations (user_id, bucket, grupo_documentos, activo)
          VALUES (?, ?, ?, 1)
        `;
        const result = await this.runQuery(insertSql, [user.id, bucket, grupoDocumentos]);
        
        // Devolver la nueva autorización con JOIN
        const selectSql = `
          SELECT ua.*, u.username, u.admin 
          FROM user_authorizations ua
          JOIN users u ON ua.user_id = u.id
          WHERE ua.id = ?
        `;
        return await this.getQuery(selectSql, [result.id]);
      }
    } catch (error) {
      console.error('Error creando autorización de usuario:', error);
      throw error;
    }
  }

  /**
   * Actualizar autorización de usuario
   */
  async updateUserAuthorization(username, updates) {
    try {
      await this.ensureReady();
      
      // Obtener el usuario y su autorización
      const user = await this.userModel.getUser(username);
      if (!user) {
        throw new Error(`No se encontró el usuario: ${username}`);
      }

      // Verificar que el usuario tiene autorizaciones
      const existing = await this.getQuery(
        'SELECT * FROM user_authorizations WHERE user_id = ? LIMIT 1', 
        [user.id]
      );
      
      if (!existing) {
        throw new Error(`No se encontró autorización para el usuario: ${username}`);
      }

      // Construir query de actualización dinámicamente
      const allowedFields = ['bucket', 'grupo_documentos', 'activo'];
      const updateFields = [];
      const updateValues = [];

      allowedFields.forEach(field => {
        if (updates.hasOwnProperty(field)) {
          updateFields.push(`${field} = ?`);
          updateValues.push(updates[field]);
        }
      });

      if (updateFields.length === 0) {
        throw new Error('No se especificaron campos válidos para actualizar');
      }

      updateValues.push(user.id);
      const updateSql = `UPDATE user_authorizations SET ${updateFields.join(', ')} WHERE user_id = ?`;
      
      await this.runQuery(updateSql, updateValues);
      
      // Devolver la primera autorización actualizada con JOIN
      const selectSql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE u.username = ? LIMIT 1
      `;
      return await this.getQuery(selectSql, [username]);
    } catch (error) {
      console.error('Error actualizando autorización de usuario:', error);
      throw error;
    }
  }

  /**
   * Desactivar autorización de usuario
   */
  async deactivateUserAuthorization(username) {
    return await this.updateUserAuthorization(username, { activo: 0 });
  }

  /**
   * Obtener todas las autorizaciones
   */
  async getAllAuthorizations() {
    try {
      await this.ensureReady();
      const sql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        ORDER BY ua.fecha_creacion DESC
      `;
      const data = await this.allQuery(sql);
      return data;
    } catch (error) {
      console.error('Error obteniendo todas las autorizaciones:', error);
      throw error;
    }
  }

  /**
   * Verificar si un usuario tiene acceso a un bucket y grupo de documentos específicos
   */
  async verifyAccess(username, bucket = null, grupoDocumentos = null) {
    try {
      const userAuth = await this.getUserAuthorization(username);
      
      if (!userAuth) {
        return {
          hasAccess: false,
          reason: 'Usuario no autorizado'
        };
      }

      // Si se especifica bucket, verificar que coincida
      if (bucket && userAuth.bucket !== bucket) {
        return {
          hasAccess: false,
          reason: 'Acceso denegado al bucket especificado'
        };
      }

      // Si se especifica grupo de documentos, verificar que coincida
      if (grupoDocumentos && userAuth.grupo_documentos !== grupoDocumentos) {
        return {
          hasAccess: false,
          reason: 'Acceso denegado al grupo de documentos especificado'
        };
      }

      return {
        hasAccess: true,
        authorization: userAuth
      };
    } catch (error) {
      console.error('Error verificando acceso:', error);
      return {
        hasAccess: false,
        reason: 'Error interno verificando permisos'
      };
    }
  }

  /**
   * Verificar si un usuario es administrador
   */
  async isUserAdmin(username) {
    try {
      return await this.userModel.isUserAdmin(username);
    } catch (error) {
      console.error('Error verificando si usuario es admin:', error);
      return false;
    }
  }

  /**
   * Eliminar autorización por ID (solo para administradores)
   */
  async deleteAuthorization(id) {
    try {
      await this.ensureReady();
      const sql = 'DELETE FROM user_authorizations WHERE id = ?';
      await this.runQuery(sql, [id]);
      return true;
    } catch (error) {
      console.error('Error eliminando autorización:', error);
      throw error;
    }
  }

  /**
   * Actualizar autorización por ID (solo para administradores)
   */
  async updateAuthorizationById(id, updates) {
    try {
      await this.ensureReady();
      
      // Obtener la autorización actual para saber el user_id
      const currentAuth = await this.getQuery(
        'SELECT * FROM user_authorizations WHERE id = ?', 
        [id]
      );
      
      if (!currentAuth) {
        throw new Error(`No se encontró autorización con ID: ${id}`);
      }

      // Separar campos de usuario y autorización
      const userFields = ['username', 'admin'];
      const authFields = ['bucket', 'grupo_documentos', 'activo'];
      
      const userUpdates = {};
      const authUpdates = {};
      
      Object.keys(updates).forEach(field => {
        if (userFields.includes(field)) {
          userUpdates[field] = updates[field];
        } else if (authFields.includes(field)) {
          authUpdates[field] = updates[field];
        }
      });

      // Actualizar usuario si hay campos de usuario
      if (Object.keys(userUpdates).length > 0) {
        if (userUpdates.username) {
          await this.userModel.updateUserById(currentAuth.user_id, userUpdates);
        } else {
          // Solo actualizar admin
          await this.userModel.updateUserById(currentAuth.user_id, { admin: userUpdates.admin });
        }
      }

      // Actualizar autorización si hay campos de autorización
      if (Object.keys(authUpdates).length > 0) {
        const updateFields = [];
        const updateValues = [];

        Object.keys(authUpdates).forEach(field => {
          updateFields.push(`${field} = ?`);
          updateValues.push(authUpdates[field]);
        });

        updateValues.push(id);
        const updateSql = `UPDATE user_authorizations SET ${updateFields.join(', ')} WHERE id = ?`;
        await this.runQuery(updateSql, updateValues);
      }
      
      // Devolver la autorización actualizada con JOIN
      const selectSql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE ua.id = ?
      `;
      return await this.getQuery(selectSql, [id]);
    } catch (error) {
      console.error('Error actualizando autorización por ID:', error);
      throw error;
    }
  }

  /**
   * Crear autorización completa (para administradores)
   */
  async createAuthorizationAdmin(username, bucket, grupoDocumentos, admin = null) {
    try {
      await this.ensureReady();
      
      // Crear o actualizar usuario
      let user = await this.userModel.getUser(username);
      if (!user) {
        // Si no existe el usuario, crearlo con los privilegios especificados
        user = await this.userModel.createUser(username, admin || false);
      } else if (admin !== null && admin !== undefined && user.admin !== admin) {
        // Solo actualizar privilegios de admin si se especificó explícitamente y es diferente
        await this.userModel.updateUser(username, { admin });
        user.admin = admin;
      }
      
      // Crear autorización
      const insertSql = `
        INSERT INTO user_authorizations (user_id, bucket, grupo_documentos, activo)
        VALUES (?, ?, ?, 1)
      `;
      const result = await this.runQuery(insertSql, [user.id, bucket, grupoDocumentos]);
      
      // Devolver la nueva autorización con JOIN
      const selectSql = `
        SELECT ua.*, u.username, u.admin 
        FROM user_authorizations ua
        JOIN users u ON ua.user_id = u.id
        WHERE ua.id = ?
      `;
      return await this.getQuery(selectSql, [result.id]);
    } catch (error) {
      console.error('Error creando autorización completa:', error);
      throw error;
    }
  }

  /**
   * Inicializar datos de ejemplo (solo para desarrollo)
   */
  async initializeTestData() {
    try {
      await this.ensureReady();
      
      // Verificar si ya existen datos
      const existingData = await this.getAllAuthorizations();
      
      // Solo inicializar si no hay datos
      if (existingData.length === 0) {
        console.log('Inicializando datos de prueba de autorización...');
        
        // Usuario con múltiples autorizaciones para probar el selector
        await this.createUserAuthorization(
          'usuario1',
          'rgpdintcomer-des-deltasmile-servinform',
          'Recepcion/Muestreo/Cartas'
        );
        
        await this.createUserAuthorization(
          'usuario1',
          'rgpdintcomer-des-deltasmile-servinform',
          'Recepcion/Muestreo/Facturas'
        );
        
        // Usuario con una sola autorización
        await this.createUserAuthorization(
          'usuario2', 
          'rgpdintcomer-des-deltasmile-servinform',
          'Recepcion/Muestreo/Cartas'
        );
        
        console.log('Datos de prueba de autorización inicializados');
        return await this.getAllAuthorizations();
      }
      
      return existingData;
    } catch (error) {
      console.error('Error inicializando datos de prueba:', error);
      throw error;
    }
  }


  /**
   * Cerrar conexión de base de datos
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error cerrando base de datos:', err.message);
        } else {
          console.log('Conexión a SQLite cerrada');
        }
      });
    }
  }
}

module.exports = UserAuthorization;
