import React, { useState, useEffect } from 'react';
import { 
  getAllAuthorizations, 
  createAuthorization, 
  updateAuthorization, 
  deleteAuthorization 
} from '../services/api';

const AdminPanel = ({ onClose }) => {
  const [authorizations, setAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingAuth, setEditingAuth] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAuth, setNewAuth] = useState({
    username: '',
    bucket: 'naturgy-fau-dev-newco',
    grupo_documentos: 'Recepcion/Muestreo/Cartas',
    admin: false
  });

  useEffect(() => {
    loadAuthorizations();
  }, []);

  const loadAuthorizations = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getAllAuthorizations();
      if (response.success) {
        setAuthorizations(response.authorizations);
      }
    } catch (error) {
      console.error('Error cargando autorizaciones:', error);
      setError('Error al cargar las autorizaciones');
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
        await loadAuthorizations();
        setShowCreateForm(false);
        setNewAuth({
          username: '',
          bucket: 'naturgy-fau-dev-newco',
          grupo_documentos: 'Recepcion/Muestreo/Cartas',
          admin: false
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
        await loadAuthorizations();
        setEditingAuth(null);
      }
    } catch (error) {
      console.error('Error actualizando autorización:', error);
      setError('Error al actualizar la autorización: ' + error.message);
    }
  };

  const handleDeleteAuth = async (id) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta autorización?')) {
      try {
        setError(null);
        const response = await deleteAuthorization(id);
        if (response.success) {
          await loadAuthorizations();
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

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="admin-content">
          <div className="admin-header">
            <h2>Panel de Administración</h2>
            <button onClick={onClose} className="close-btn" title="Cerrar panel">
              ✕
            </button>
          </div>
          <div className="loading">Cargando autorizaciones...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-content">
        <div className="admin-header">
          <h2>Panel de Administración</h2>
          <button onClick={onClose} className="close-btn" title="Cerrar panel">
            ✕
          </button>
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
          <button onClick={loadAuthorizations} className="refresh-btn">
            🔄 Actualizar
          </button>
        </div>

        {showCreateForm && (
          <div className="form-section">
            <h3>Crear Nueva Autorización</h3>
            <form onSubmit={handleCreateAuth} className="auth-form">
              <div className="form-row">
                <div className="form-field">
                  <label>Usuario:</label>
                  <input
                    type="text"
                    value={newAuth.username}
                    onChange={(e) => setNewAuth({...newAuth, username: e.target.value})}
                    required
                  />
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
                    <option value="Recepcion/Muestreo/Cartas">Recepcion/Muestreo/Cartas</option>
                    <option value="Recepcion/Muestreo/Facturas">Recepcion/Muestreo/Facturas</option>
                    <option value="Recepcion/Muestreo/Contratos">Recepcion/Muestreo/Contratos</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={newAuth.admin}
                      onChange={(e) => setNewAuth({...newAuth, admin: e.target.checked})}
                    />
                    Es Administrador
                  </label>
                </div>
              </div>
              <div className="form-actions">
                <button type="submit" className="save-btn">Crear</button>
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
            <h3>Editar Autorización</h3>
            <form onSubmit={handleUpdateAuth} className="auth-form">
              <div className="form-row">
                <div className="form-field">
                  <label>Usuario:</label>
                  <input
                    type="text"
                    value={editingAuth.username}
                    onChange={(e) => setEditingAuth({...editingAuth, username: e.target.value})}
                    required
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
                    <option value="Recepcion/Muestreo/Cartas">Recepcion/Muestreo/Cartas</option>
                    <option value="Recepcion/Muestreo/Facturas">Recepcion/Muestreo/Facturas</option>
                    <option value="Recepcion/Muestreo/Contratos">Recepcion/Muestreo/Contratos</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingAuth.admin || false}
                      onChange={(e) => setEditingAuth({...editingAuth, admin: e.target.checked})}
                    />
                    Es Administrador
                  </label>
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>
                    <input
                      type="checkbox"
                      checked={editingAuth.activo}
                      onChange={(e) => setEditingAuth({...editingAuth, activo: e.target.checked})}
                    />
                    Activo
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
          <h3>Autorizaciones Existentes ({authorizations.length})</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Bucket</th>
                  <th>Grupo</th>
                  <th>Admin</th>
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
                    <td title={auth.bucket}>{auth.bucket.length > 20 ? auth.bucket.substring(0, 20) + '...' : auth.bucket}</td>
                    <td>{auth.grupo_documentos.split('/').pop()}</td>
                    <td>{auth.admin ? '✅' : '❌'}</td>
                    <td>{auth.activo ? '✅' : '❌'}</td>
                    <td>{formatDate(auth.fecha_creacion)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          onClick={() => startEditing(auth)} 
                          className="edit-btn"
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleDeleteAuth(auth.id)} 
                          className="delete-btn"
                          title="Eliminar"
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
    </div>
  );
};

export default AdminPanel;
