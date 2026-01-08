const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;

/**
 * Modelo de usuarios utilizando SQLite
 * Estructura de la tabla de usuarios:
 * - id: identificador único del usuario
 * - username: nombre del usuario
 * - admin: true/false si es administrador
 * - activo: true/false
 * - fecha_creacion: timestamp de creación
 */

class User {
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
            console.error('Error conectando a SQLite (User):', err.message);
            reject(err);
          } else {
            console.log('Conectado a la base de datos SQLite de usuarios');
            this.createTables(resolve, reject);
          }
        });
      });
    } catch (error) {
      console.error('Error inicializando base de datos de usuarios:', error);
      throw error;
    }
  }

  /**
   * Crear las tablas necesarias
   */
  createTables(resolve, reject) {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        admin BOOLEAN NOT NULL DEFAULT 0,
        activo BOOLEAN NOT NULL DEFAULT 1,
        fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creando tabla users:', err.message);
        reject(err);
      } else {
        console.log('Tabla users creada o ya existe');
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
   * Obtener usuario por username
   */
  async getUser(username) {
    try {
      await this.ensureReady();
      const sql = 'SELECT * FROM users WHERE username = ? AND activo = 1';
      const user = await this.getQuery(sql, [username]);
      return user || null;
    } catch (error) {
      console.error('Error obteniendo usuario:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por ID
   */
  async getUserById(id) {
    try {
      await this.ensureReady();
      const sql = 'SELECT * FROM users WHERE id = ? AND activo = 1';
      const user = await this.getQuery(sql, [id]);
      return user || null;
    } catch (error) {
      console.error('Error obteniendo usuario por ID:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo usuario
   */
  async createUser(username, admin = false) {
    try {
      await this.ensureReady();
      
      // Verificar si ya existe el usuario
      const existing = await this.getQuery(
        'SELECT * FROM users WHERE username = ?', 
        [username]
      );
      
      if (existing) {
        // Si existe pero está inactivo, reactivarlo
        if (!existing.activo) {
          const updateSql = `
            UPDATE users 
            SET activo = 1, admin = ?, fecha_creacion = CURRENT_TIMESTAMP
            WHERE username = ?
          `;
          await this.runQuery(updateSql, [admin, username]);
          return await this.getUser(username);
        }
        throw new Error(`El usuario ${username} ya existe`);
      } else {
        // Crear nuevo usuario
        const insertSql = `
          INSERT INTO users (username, admin, activo)
          VALUES (?, ?, 1)
        `;
        const result = await this.runQuery(insertSql, [username, admin]);
        
        // Devolver el nuevo usuario
        return await this.getUserById(result.id);
      }
    } catch (error) {
      console.error('Error creando usuario:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario
   */
  async updateUser(username, updates) {
    try {
      await this.ensureReady();
      
      // Verificar que el usuario existe
      const existing = await this.getUser(username);
      
      if (!existing) {
        throw new Error(`No se encontró el usuario: ${username}`);
      }

      // Construir query de actualización dinámicamente
      const allowedFields = ['admin', 'activo'];
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
      const updateSql = `UPDATE users SET ${updateFields.join(', ')} WHERE username = ?`;
      
      await this.runQuery(updateSql, updateValues);
      
      // Devolver el usuario actualizado
      return await this.getUser(username);
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      throw error;
    }
  }

  /**
   * Desactivar usuario
   */
  async deactivateUser(username) {
    return await this.updateUser(username, { activo: 0 });
  }

  /**
   * Verificar si un usuario es administrador
   */
  async isUserAdmin(username) {
    try {
      const user = await this.getUser(username);
      return user ? !!user.admin : false;
    } catch (error) {
      console.error('Error verificando si usuario es admin:', error);
      return false;
    }
  }

  /**
   * Obtener todos los usuarios
   */
  async getAllUsers() {
    try {
      await this.ensureReady();
      const sql = 'SELECT * FROM users ORDER BY fecha_creacion DESC';
      const users = await this.allQuery(sql);
      return users;
    } catch (error) {
      console.error('Error obteniendo todos los usuarios:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario por ID (para administradores)
   */
  async updateUserById(id, updates) {
    try {
      await this.ensureReady();
      
      // Construir query de actualización dinámicamente
      const allowedFields = ['username', 'admin', 'activo'];
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

      updateValues.push(id);
      const updateSql = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
      
      await this.runQuery(updateSql, updateValues);
      
      // Devolver el usuario actualizado
      return await this.getUserById(id);
    } catch (error) {
      console.error('Error actualizando usuario por ID:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario por ID (solo para administradores)
   */
  async deleteUser(id) {
    try {
      await this.ensureReady();
      const sql = 'DELETE FROM users WHERE id = ?';
      await this.runQuery(sql, [id]);
      return true;
    } catch (error) {
      console.error('Error eliminando usuario:', error);
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
          console.error('Error cerrando base de datos de usuarios:', err.message);
        } else {
          console.log('Conexión a SQLite de usuarios cerrada');
        }
      });
    }
  }
}

module.exports = User;
