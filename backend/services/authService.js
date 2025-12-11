const axios = require('axios');
const https = require('https');

// Configurar agente HTTPS para ignorar certificados autofirmados en desarrollo
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Configuración de Cognito
const COGNITO_CONFIG = {
  client_id: "693u99k2vlosal78rfhp9na6gc",
  user_pool_id: "eu-west-1_cTWYNAv36",
  auth_endpoint: "https://0mc4x2a536.execute-api.eu-west-1.amazonaws.com:443/NaturgyCognitoAPI_stage/signinuser"
};

/**
 * Autenticar usuario con AWS Cognito a través del API Gateway
 */
async function authenticateUser(username, password) {
  try {
    console.log(`Intentando autenticar usuario: ${username}`);
    
    const response = await axios.post(COGNITO_CONFIG.auth_endpoint, {
      username: username,
      password: password,
      client_id: COGNITO_CONFIG.client_id,
      user_pool_id: COGNITO_CONFIG.user_pool_id
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'jVNJLEaBE74p9YzmsShre9FDyVaS4EIl7XYBuhM1'
      },
      httpsAgent: httpsAgent,
      timeout: 10000 // Timeout de 10 segundos
    });

    const data = response.data;

    if (data.error) {
      console.error('Error en autenticación:', data.message);
      return {
        success: false,
        error: data.message || 'Error de autenticación'
      };
    }

    console.log(`Usuario autenticado exitosamente: ${data.username}`);
    
    return {
      success: true,
      username: data.username,
      accessToken: data.AccessToken,
      idToken: data.IdToken,
      refreshToken: data.RefreshToken
    };
  } catch (error) {
    console.error('Error conectando con servicio de autenticación:', error);
    return {
      success: false,
      error: 'Error de conexión con el servicio de autenticación'
    };
  }
}

/**
 * Decodificar token JWT sin verificar (solo para obtener información)
 */
function decodeToken(token) {
  try {
    if (!token) return null;
    
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return payload;
  } catch (error) {
    console.error('Error decodificando token:', error);
    return null;
  }
}

/**
 * Verificar si un token ha expirado
 */
function isTokenExpired(token) {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * Obtener información del usuario desde el ID token
 */
function getUserInfoFromToken(idToken) {
  const decoded = decodeToken(idToken);
  if (!decoded) return null;
  
  return {
    username: decoded['cognito:username'],
    email: decoded.email,
    name: decoded.name,
    groups: decoded['cognito:groups'] || [],
    roles: decoded['custom:roles'] || '[]',
    sub: decoded.sub
  };
}

module.exports = {
  authenticateUser,
  decodeToken,
  isTokenExpired,
  getUserInfoFromToken,
  COGNITO_CONFIG
};
