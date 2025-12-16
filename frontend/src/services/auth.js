// Servicio de autenticación para gestionar tokens y sesión

// Configuración de Cognito
export const COGNITO_CONFIG = {
  client_id: "693u99k2vlosal78rfhp9na6gc",
  user_pool_id: "eu-west-1_cTWYNAv36",
  auth_endpoint: "https://0mc4x2a536.execute-api.eu-west-1.amazonaws.com:443/NaturgyCognitoAPI_stage/signinuser"
};

/**
 * Obtener tokens del sessionStorage
 */
export const getStoredTokens = () => {
  return {
    accessToken: sessionStorage.getItem('accessToken'),
    idToken: sessionStorage.getItem('idToken'),
    refreshToken: sessionStorage.getItem('refreshToken'),
    username: sessionStorage.getItem('username')
  };
};

/**
 * Verificar si el usuario está autenticado
 */
export const isAuthenticated = () => {
  const tokens = getStoredTokens();
  return !!(tokens.accessToken && tokens.idToken);
};

/**
 * Obtener información del usuario desde el token
 */
export const getUserInfo = () => {
  const tokens = getStoredTokens();
  if (!tokens.idToken) return null;
  
  try {
    // Decodificar el token JWT (sin verificar la firma, solo para obtener info)
    const payload = JSON.parse(atob(tokens.idToken.split('.')[1]));
    return {
      username: payload['cognito:username'],
      email: payload.email,
      name: payload.name,
      groups: payload['cognito:groups'] || [],
      roles: payload['custom:roles'] || '[]'
    };
  } catch (error) {
    console.error('Error decodificando token:', error);
    return null;
  }
};

/**
 * Cerrar sesión
 */
export const logout = () => {
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('idToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('username');
  
  // Recargar la página para limpiar el estado
  window.location.reload();
};

/**
 * Verificar si un token ha expirado
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error('Error verificando expiración del token:', error);
    return true;
  }
};

/**
 * Obtener headers de autorización para las peticiones API
 */
export const getAuthHeaders = () => {
  const tokens = getStoredTokens();
  
  if (!tokens.accessToken || !tokens.idToken) {
    return {};
  }
  
  return {
    'Authorization': `Bearer ${tokens.accessToken}`,
    'X-ID-Token': tokens.idToken
  };
};

/**
 * Interceptor para verificar si los tokens han expirado
 */
export const checkTokensValidity = () => {
  const tokens = getStoredTokens();
  
  if (!tokens.accessToken || !tokens.idToken) {
    return false;
  }
  
  // Verificar si algún token ha expirado
  if (isTokenExpired(tokens.accessToken) || isTokenExpired(tokens.idToken)) {
    console.warn('Tokens expirados, cerrando sesión...');
    logout();
    return false;
  }
  
  return true;
};

/**
 * Inicializar el servicio de autenticación
 */
export const initAuth = () => {
  // Verificar tokens al cargar la aplicación
  if (isAuthenticated()) {
    checkTokensValidity();
  }
  
  // Configurar interceptor para verificar tokens periódicamente
  setInterval(() => {
    if (isAuthenticated()) {
      checkTokensValidity();
    }
  }, 60000); // Verificar cada minuto
};

export default {
  COGNITO_CONFIG,
  getStoredTokens,
  isAuthenticated,
  getUserInfo,
  logout,
  isTokenExpired,
  getAuthHeaders,
  checkTokensValidity,
  initAuth
};
