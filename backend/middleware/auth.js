const jwt = require('jsonwebtoken');
// Usar import dinámico para jwks-client debido a que es un módulo ESM
let jwksClient;
(async () => {
  const jwksModule = await import('jwks-client');
  jwksClient = jwksModule.default;
})();

// Configuración de Cognito
const COGNITO_CONFIG = {
  region: 'eu-west-1',
  userPoolId: 'eu-west-1_cTWYNAv36',
  clientId: '693u99k2vlosal78rfhp9na6gc'
};

// Cliente JWKS para obtener las claves públicas de Cognito
const jwksClientInstance = jwksClient({
  jwksUri: `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/${COGNITO_CONFIG.userPoolId}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 5,
  cacheMaxAge: 600000, // 10 minutos
});

/**
 * Obtener la clave pública para verificar el token
 */
function getSigningKey(kid) {
  return new Promise((resolve, reject) => {
    jwksClientInstance.getSigningKey(kid, (err, key) => {
      if (err) {
        return reject(err);
      }
      const signingKey = key.publicKey || key.rsaPublicKey;
      resolve(signingKey);
    });
  });
}

/**
 * Verificar y decodificar un token JWT
 */
async function verifyToken(token, tokenType = 'access') {
  try {
    // Decodificar el header para obtener el kid
    const decodedHeader = jwt.decode(token, { complete: true });
    
    if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
      throw new Error('Token inválido: no se puede obtener kid del header');
    }

    // Obtener la clave pública
    const signingKey = await getSigningKey(decodedHeader.header.kid);

    // Verificar el token
    const decoded = jwt.verify(token, signingKey, {
      algorithms: ['RS256'],
      issuer: `https://cognito-idp.${COGNITO_CONFIG.region}.amazonaws.com/${COGNITO_CONFIG.userPoolId}`,
      audience: tokenType === 'access' ? undefined : COGNITO_CONFIG.clientId // Solo ID tokens tienen audience
    });

    return decoded;
  } catch (error) {
    console.error(`Error verificando ${tokenType} token:`, error.message);
    throw new Error(`Token ${tokenType} inválido: ${error.message}`);
  }
}

/**
 * Middleware de autenticación
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

    // Verificar ambos tokens
    const [accessTokenDecoded, idTokenDecoded] = await Promise.all([
      verifyToken(accessToken, 'access'),
      verifyToken(idTokenHeader, 'id')
    ]);

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
    
    // Determinar el tipo de error y responder apropiadamente
    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token ha expirado, por favor inicia sesión nuevamente'
      });
    } else if (error.message.includes('inválido')) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token proporcionado no es válido'
      });
    } else {
      return res.status(401).json({
        error: 'Error de autenticación',
        message: 'No se pudo autenticar la solicitud'
      });
    }
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
  optionalAuthMiddleware,
  verifyToken,
  COGNITO_CONFIG
};
