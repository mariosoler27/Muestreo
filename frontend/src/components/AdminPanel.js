import React, { useState } from 'react';
import UserManagement from './UserManagement';
import AuthorizationManagement from './AuthorizationManagement';

const AdminPanel = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <div className="admin-panel">
      <div className="admin-content">
        <div className="admin-header">
          <h2>Panel de Administración</h2>
          <button onClick={onClose} className="close-btn" title="Cerrar panel">
            ✕
          </button>
        </div>

        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            👥 Gestión de Usuarios
          </button>
          <button 
            className={`tab-btn ${activeTab === 'authorizations' ? 'active' : ''}`}
            onClick={() => setActiveTab('authorizations')}
          >
            🔐 Gestión de Autorizaciones
          </button>
        </div>

        <div className="admin-tab-content">
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'authorizations' && <AuthorizationManagement />}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
