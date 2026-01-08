import React, { useState, useEffect } from 'react';
import { 
  getAllAuthorizations, 
  createAuthorization, 
  updateAuthorization, 
  deleteAuthorization,
  getAllUsers
} from '../services/api';

const AuthorizationManagement = () => {
  const [authorizations, setAuthorizations] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAuth, setEditingAuth] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAuth, setNewAuth] = useState({
    username: '',
    bucket: 'rgpdintcomer-des-deltasmile-servinform',
    grupo_documentos: 'Recepcion/Muestreo/CartasCobro'
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Cargar autorizaciones y usuarios en paralelo
      const [authResponse, usersResponse] = await Promise.all([
        getAllAuthorizations(),
        getAllUsers()
      ]);
      
      if (authResponse.success) {
        setAuthorizations(authResponse.authorizations);
      }
      
      if (usersResponse.success) {
        setUsers(usersResponse.users);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      setError('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAuth = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const response = await createAuthorization(newAuth);
      if (response.success) {
        await loadData();
        setShowCreateForm(false);
        setNewAuth({
          username: '',
          bucket: 'rgpdintcomer-des-deltasmile-servinform',
          grupo_documentos: 'Recepcion/Muestreo/CartasCobro'
        });
      }
    } catch (error) {
      console.error('Error creando autorización:', error);
      setError('Error al crear la autorización: ' + error.message);
    }
  };

  const handleUpdateAuth = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const { id, ...updates } = editingAuth;
      const response = await updateAuthorization(id, updates);
      if (response.success) {
        await loadData();
        setEditingAuth(null);
      }
    } catch (error) {
      console.error('Error actualizando autorización:', error);
      setError('Error al actualizar la autorización: ' + error.message);
    }
  };

  const handleDeleteAuth = async (id, username, grupo_documentos) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la autorización de "${username}" para "${grupo_documentos.split('/').pop()}"?`)) {
      try {
        setError(null);
        const response = await deleteAuthorization(id);
        if (response.success) {
          await loadData();
        }
      } catch (error) {
        console.error('Error eliminando autorización:', error);
        setError('Error al eliminar la autorización: ' + error.message);
      }
    }
  };

  const startEditing = (auth) => {
    setEditingAuth({ ...auth });
    setShowCreateForm(false);
  };

  const cancelEditing = () => {
    setEditingAuth(null);
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

  const getActiveUsers = () => {
    return users.filter(user => user.activo);
  };

  if (loading) {
    return <div className="loading">Cargando autorizaciones...</div>;
  }

  return (
    <div className="authorization-management">
      <div className="section-header">
        <h3>Gestión de Autorizaciones</h3>
        <p>Asignar buckets y grupos de carpetas a usuarios existentes</p>
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
            setEditingAuth(null);
          }} 
          className="create-btn"
          disabled={showCreateForm}
        >
          ➕ Nueva Autorización
        </button>
        <button onClick={loadData} className="refresh-btn">
          🔄 Actualizar
        </button>
      </div>

      {showCreateForm && (
        <div className="form-section">
          <h4>Crear Nueva Autorización</h4>
          <form onSubmit={handleCreateAuth} className="auth-form">
            <div className="form-row">
              <div className="form-field">
                <label>Usuario:</label>
                <select
                  value={newAuth.username}
                  onChange={(e) => setNewAuth({...newAuth, username: e.target.value})}
                  required
                >
                  <option value="">Seleccionar usuario...</option>
                  {getActiveUsers().map(user => (
                    <option key={user.id} value={user.username}>
                      {user.username} {user.admin ? '(Admin)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Bucket:</label>
                <input
                  type="text"
                  value={newAuth.bucket}
                  onChange={(e) => setNewAuth({...newAuth, bucket: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Grupo de Documentos:</label>
                <select
                  value={newAuth.grupo_documentos}
                  onChange={(e) => setNewAuth({...newAuth, grupo_documentos: e.target.value})}
                  required
                >
                  <option value="Recepcion/Muestreo/CartasContratacion">Recepcion/Muestreo/CartasContratacion</option>
                  <option value="Recepcion/Muestreo/Facturas">Recepcion/Muestreo/Facturas</option>
                  <option value="Recepcion/Muestreo/CartasCobro">Recepcion/Muestreo/CartasCobro</option>
                </select>
              </div>
            </div>
            <div className="form-actions">
              <button type="submit" className="save-btn">Crear Autorización</button>
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

      {editingAuth && (
        <div className="form-section">
          <h4>Editar Autorización</h4>
          <form onSubmit={handleUpdateAuth} className="auth-form">
            <div className="form-row">
              <div className="form-field">
                <label>Usuario:</label>
                <input
                  type="text"
                  value={editingAuth.username}
                  readOnly
                  className="readonly-input"
                  title="El usuario no se puede cambiar. Elimina y crea una nueva autorización si es necesario."
                />
              </div>
              <div className="form-field">
                <label>Bucket:</label>
                <input
                  type="text"
                  value={editingAuth.bucket}
                  onChange={(e) => setEditingAuth({...editingAuth, bucket: e.target.value})}
                  required
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-field">
                <label>Grupo de Documentos:</label>
                <select
                  value={editingAuth.grupo_documentos}
                  onChange={(e) => setEditingAuth({...editingAuth, grupo_documentos: e.target.value})}
                  required
                >
                  <option value="Recepcion/Muestreo/CartasContratacion">Recepcion/Muestreo/CartasContratacion</option>
                  <option value="Recepcion/Muestreo/Facturas">Recepcion/Muestreo/Facturas</option>
                  <option value="Recepcion/Muestreo/CartasCobro">Recepcion/Muestreo/CartasCobro</option>
                </select>
              </div>
              <div className="form-field">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingAuth.activo}
                    onChange={(e) => setEditingAuth({...editingAuth, activo: e.target.checked})}
                  />
                  Autorización Activa
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

      <div className="authorizations-table">
        <h4>Autorizaciones Existentes ({authorizations.length})</h4>
        <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Bucket</th>
                  <th>Grupo de Documentos</th>
                  <th>Activo</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {authorizations.map(auth => (
                  <tr key={auth.id} className={!auth.activo ? 'inactive' : ''}>
                    <td>{auth.id}</td>
                    <td>{auth.username}</td>
                    <td title={auth.bucket}>
                      {auth.bucket.length > 25 ? auth.bucket.substring(0, 25) + '...' : auth.bucket}
                    </td>
                    <td>
                      <span className="grupo-badge">
                        {auth.grupo_documentos.split('/').pop()}
                      </span>
                    </td>
                    <td>{auth.activo ? '✅' : '❌'}</td>
                    <td>{formatDate(auth.fecha_creacion)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => startEditing(auth)} 
                          className="edit-btn"
                          title="Editar Autorización"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteAuth(auth.id, auth.username, auth.grupo_documentos)} 
                          className="delete-btn"
                          title="Eliminar Autorización"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          
          {authorizations.length === 0 && !loading && (
            <div className="empty-state">
              <p>No hay autorizaciones configuradas</p>
              <p>Crea la primera autorización para comenzar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthorizationManagement;
