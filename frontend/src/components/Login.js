import React, { useState } from 'react';

const Login = ({ onLoginSuccess }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE_URL = 'http://localhost:5000/api';

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    if (error) {
      setError('');
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!formData.username.trim() || !formData.password.trim()) {
      setError('Por favor, introduce usuario y contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        })
      });

      const data = await response.json();

      if (data.error) {
        setError(data.message || 'Error de autenticación');
      } else {
        // Almacenar tokens en sessionStorage
        sessionStorage.setItem('accessToken', data.AccessToken);
        sessionStorage.setItem('idToken', data.IdToken);
        sessionStorage.setItem('refreshToken', data.RefreshToken);
        sessionStorage.setItem('username', data.username);
        
        // Notificar al componente padre que el login fue exitoso
        onLoginSuccess({
          username: data.username,
          accessToken: data.AccessToken,
          idToken: data.IdToken
        });
      }
    } catch (error) {
      console.error('Error durante el login:', error);
      setError('Error de conexión. Por favor, inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>Iniciar Sesión</h2>
        <p className="login-subtitle">Sistema de Procesamiento de Ficheros</p>
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="form-field">
            <label htmlFor="username">Usuario:</label>
            <input
              type="text"
              id="username"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              placeholder="Introduce tu usuario"
              disabled={loading}
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Contraseña:</label>
            <input
              type="password"
              id="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              placeholder="Introduce tu contraseña"
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
