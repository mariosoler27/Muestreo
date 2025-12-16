const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

/**
 * Modelo de autorización de usuarios utilizando SQLite
 * Estructura de la tabla de autorización:
 * - username: nombre del usuario
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
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS user_authorizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        bucket TEXT NOT NULL,
        grupo_documentos TEXT NOT NULL CHECK (grupo_documentos IN ('Cartas', 'Facturas')),
        activo BOOLEAN NOT NULL DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creando tabla user_authorizations:', err.message);
        reject(err);
      } else {
        console.log('Tabla user_authorizations creada o ya existe');
        this.isReady = true;
        resolve();
      }
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
   * Obtener autorización de un usuario
   */
  async getUserAuthorization(username) {
    try {
      await this.ensureReady();
      const sql = 'SELECT * FROM user_authorizations WHERE username = ? AND activo = 1';
      const userAuth = await this.getQuery(sql, [username]);
      return userAuth || null;
    } catch (error) {
      console.error('Error obteniendo autorización de usuario:', error);
      throw error;
    }
  }

  /**
   * Crear nueva autorización de usuario
   */
  async createUserAuthorization(username, bucket, grupoDocumentos) {
    try {
      await this.ensureReady();
      
      // Verificar si ya existe una autorización para este usuario
      const existing = await this.getUserAuthorization(username);
      
      if (existing) {
        // Actualizar autorización existente
        const updateSql = `
          UPDATE user_authorizations 
          SET bucket = ?, grupo_documentos = ?, activo = 1, fecha_creacion = CURRENT_TIMESTAMP
          WHERE username = ?
        `;
        await this.runQuery(updateSql, [bucket, grupoDocumentos, username]);
        
        // Devolver la autorización actualizada
        return await this.getUserAuthorization(username);
      } else {
        // Crear nueva autorización
        const insertSql = `
          INSERT INTO user_authorizations (username, bucket, grupo_documentos, activo)
          VALUES (?, ?, ?, 1)
        `;
        const result = await this.runQuery(insertSql, [username, bucket, grupoDocumentos]);
        
        // Devolver la nueva autorización
        const selectSql = 'SELECT * FROM user_authorizations WHERE id = ?';
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
      
      // Verificar que el usuario existe
      const existing = await this.getQuery(
        'SELECT * FROM user_authorizations WHERE username = ?', 
        [username]
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

      updateValues.push(username);
      const updateSql = `UPDATE user_authorizations SET ${updateFields.join(', ')} WHERE username = ?`;
      
      await this.runQuery(updateSql, updateValues);
      
      // Devolver la autorización actualizada
      return await this.getQuery(
        'SELECT * FROM user_authorizations WHERE username = ?', 
        [username]
      );
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
      const sql = 'SELECT * FROM user_authorizations ORDER BY fecha_creacion DESC';
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
        
        await this.createUserAuthorization(
          'usuario1',
          'rgpdintcomer-des-deltasmile-servinform',
          'Cartas'
        );
        
        await this.createUserAuthorization(
          'usuario2', 
          'rgpdintcomer-des-deltasmile-servinform',
          'Facturas'
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
