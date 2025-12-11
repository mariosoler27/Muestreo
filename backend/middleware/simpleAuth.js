const { decodeToken, isTokenExpired, getUserInfoFromToken } = require('../services/authService');

/**
 * Middleware de autenticación simplificado
 * Usa decodificación de tokens sin verificación de firma para desarrollo
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Obtener los tokens de las cabeceras
    const authHeader = req.headers.authorization;
    const idTokenHeader = req.headers['x-id-token'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Token de acceso requerido',
        message: 'Debe proporcionar un token de acceso válido'
      });
    }

    if (!idTokenHeader) {
      return res.status(401).json({
        error: 'Token ID requerido',
        message: 'Debe proporcionar un token ID válido'
      });
    }

    // Extraer el token del header Authorization
    const accessToken = authHeader.slice(7); // Remover 'Bearer '

    // Verificar que los tokens no hayan expirado
    if (isTokenExpired(accessToken) || isTokenExpired(idTokenHeader)) {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token ha expirado, por favor inicia sesión nuevamente'
      });
    }

    // Decodificar tokens
    const accessTokenDecoded = decodeToken(accessToken);
    const idTokenDecoded = decodeToken(idTokenHeader);

    if (!accessTokenDecoded || !idTokenDecoded) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'No se pudo decodificar el token'
      });
    }

    // Verificar que los tokens pertenecen al mismo usuario
    if (accessTokenDecoded.username !== idTokenDecoded['cognito:username']) {
      return res.status(401).json({
        error: 'Tokens inconsistentes',
        message: 'Los tokens no pertenecen al mismo usuario'
      });
    }

    // Añadir información del usuario al request
    req.user = {
      username: accessTokenDecoded.username,
      sub: accessTokenDecoded.sub,
      email: idTokenDecoded.email,
      name: idTokenDecoded.name,
      groups: idTokenDecoded['cognito:groups'] || [],
      roles: idTokenDecoded['custom:roles'] || '[]',
      clientId: accessTokenDecoded.client_id,
      tokenUse: accessTokenDecoded.token_use,
      authTime: accessTokenDecoded.auth_time,
      exp: accessTokenDecoded.exp
    };

    console.log(`Usuario autenticado: ${req.user.username} (${req.user.email})`);
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    
    return res.status(401).json({
      error: 'Error de autenticación',
      message: 'No se pudo autenticar la solicitud'
    });
  }
};

/**
 * Middleware opcional que no requiere autenticación pero la procesa si está presente
 */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const idTokenHeader = req.headers['x-id-token'];

    if (authHeader && authHeader.startsWith('Bearer ') && idTokenHeader) {
      // Si hay tokens, intentar autenticar
      await authMiddleware(req, res, next);
    } else {
      // Si no hay tokens, continuar sin autenticación
      req.user = null;
      next();
    }
  } catch (error) {
    // En modo opcional, los errores de token no bloquean la solicitud
    req.user = null;
    next();
  }
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};
