import React, { useState, useEffect } from 'react';
import { 
  getAllUsers, 
  createUser, 
  updateUser, 
  deleteUser 
} from '../services/api';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    admin: false
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllUsers();
      if (response.success) {
        setUsers(response.users);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      setError('Error al cargar los usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await createUser(newUser);
      if (response.success) {
        await loadUsers();
        setShowCreateForm(false);
        setNewUser({
          username: '',
          admin: false
        });
      }
    } catch (error) {
      console.error('Error creando usuario:', error);
      setError('Error al crear el usuario: ' + error.message);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const { id, ...updates } = editingUser;
      const response = await updateUser(id, updates);
      if (response.success) {
        await loadUsers();
        setEditingUser(null);
      }
    } catch (error) {
      console.error('Error actualizando usuario:', error);
      setError('Error al actualizar el usuario: ' + error.message);
    }
  };

  const handleDeleteUser = async (id, username) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el usuario "${username}"? Esta acción también eliminará todas sus autorizaciones.`)) {
      try {
        setError(null);
        const response = await deleteUser(id);
        if (response.success) {
          await loadUsers();
        }
      } catch (error) {
        console.error('Error eliminando usuario:', error);
        setError('Error al eliminar el usuario: ' + error.message);
      }
    }
  };

  const startEditing = (user) => {
    setEditingUser({ ...user });
    setShowCreateForm(false);
  };

  const cancelEditing = () => {
    setEditingUser(null);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Cargando usuarios...</div>;
  }

  return (
    <div className="user-management">
      <div className="section-header">
        <h3>Gestión de Usuarios</h3>
        <p>Crear y administrar usuarios del sistema, así como sus privilegios de administrador</p>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)} className="error-close">✕</button>
        </div>
      )}

      <div className="admin-actions">
        <button 
          onClick={() => {
            setShowCreateForm(true);
            setEditingUser(null);
          }} 
          className="create-btn"
          disabled={showCreateForm}
        >
          ➕ Nuevo Usuario
        </button>
        <button onClick={loadUsers} className="refresh-btn">
          🔄 Actualizar
        </button>
      </div>

      {showCreateForm && (
        <div className="form-section">
          <h4>Crear Nuevo Usuario</h4>
          <form onSubmit={handleCreateUser} className="user-form">
            <div className="form-row">
              <div className="form-field">
                <label>Nombre de Usuario:</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                  required
                  placeholder="Nombre único del usuario"
                />
              </div>
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newUser.admin}
                    onChange={(e) => setNewUser({...newUser, admin: e.target.checked})}
                  />
                  Es Administrador
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">Crear Usuario</button>
              <button 
                type="button" 
                onClick={() => setShowCreateForm(false)} 
                className="cancel-btn"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {editingUser && (
        <div className="form-section">
          <h4>Editar Usuario</h4>
          <form onSubmit={handleUpdateUser} className="user-form">
            <div className="form-row">
              <div className="form-field">
                <label>Nombre de Usuario:</label>
                <input
                  type="text"
                  value={editingUser.username}
                  onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                  required
                />
              </div>
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingUser.admin || false}
                    onChange={(e) => setEditingUser({...editingUser, admin: e.target.checked})}
                  />
                  Es Administrador
                </label>
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingUser.activo}
                    onChange={(e) => setEditingUser({...editingUser, activo: e.target.checked})}
                  />
                  Usuario Activo
                </label>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">Actualizar</button>
              <button type="button" onClick={cancelEditing} className="cancel-btn">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="users-table">
        <h4>Usuarios Existentes ({users.length})</h4>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nombre de Usuario</th>
                <th>Administrador</th>
                <th>Activo</th>
                <th>Fecha de Creación</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className={!user.activo ? 'inactive' : ''}>
                  <td>{user.id}</td>
                  <td>{user.username}</td>
                  <td>{user.admin ? '✅' : '❌'}</td>
                  <td>{user.activo ? '✅' : '❌'}</td>
                  <td>{formatDate(user.fecha_creacion)}</td>
                  <td>
                    <div className="action-buttons">
                      <button 
                        onClick={() => startEditing(user)} 
                        className="edit-btn"
                        title="Editar Usuario"
                      >
                        ✏️
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id, user.username)} 
                        className="delete-btn"
                        title="Eliminar Usuario"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
