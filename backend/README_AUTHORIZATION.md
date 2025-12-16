# Sistema de Autorización Adicional

## Descripción

Este sistema implementa una capa adicional de autorización que funciona después de la autenticación exitosa con AWS Cognito. Permite controlar el acceso de los usuarios a buckets S3 específicos y grupos de documentos (Cartas o Facturas).

## Arquitectura

### Componentes Principales

1. **UserAuthorization Model** (`models/userAuthorization.js`)
   - Gestiona el almacenamiento de permisos en base de datos SQLite
   - Estructura: username, bucket, grupo_documentos, activo, fecha_creacion

2. **AuthorizationService** (`services/authorizationService.js`)
   - Lógica de negocio para verificar y gestionar permisos
   - Métodos para crear, actualizar y verificar autorizaciones

3. **Authorization Middleware** (`middleware/authorizationMiddleware.js`)
   - Middleware que se ejecuta después de la autenticación
   - Verifica permisos específicos por ruta y archivo

## Flujo de Funcionamiento

### 1. Autenticación + Autorización
```
Usuario -> AWS Cognito -> Token JWT -> Middleware Auth -> Middleware Authorization -> Ruta
```

### 2. Verificación de Permisos
- **Por Bucket**: Verifica que el usuario tenga acceso al bucket solicitado
- **Por Grupo de Documentos**: Verifica acceso a Cartas o Facturas
- **Por Archivo**: Verifica acceso basado en la tipología del archivo

## Base de Datos (SQLite)

Ubicación: `backend/data/user_authorization.db`

### Estructura de Tabla
```sql
CREATE TABLE user_authorizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  bucket TEXT NOT NULL,
  grupo_documentos TEXT NOT NULL CHECK (grupo_documentos IN ('Cartas', 'Facturas')),
  activo BOOLEAN NOT NULL DEFAULT 1,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Ejemplo de Registro
```json
{
  "id": 1,
  "username": "usuario1",
  "bucket": "rgpdintcomer-des-deltasmile-servinform",
  "grupo_documentos": "Cartas",
  "activo": 1,
  "fecha_creacion": "2025-12-11T12:00:00.000Z"
}
```

## API Endpoints

### Rutas Principales (Modificadas)
- `GET /api/getFiles` - Lista archivos filtrados por grupo del usuario
- `GET /api/getFileInfo/:fileName` - Información de archivo con verificación de acceso
- `POST /api/processFile` - Procesamiento con verificación de permisos

### Rutas de Administración (Nuevas)
- `GET /api/admin/authorizations` - Lista todas las autorizaciones
- `POST /api/admin/authorizations` - Crear nueva autorización
- `GET /api/user/authorization` - Obtener autorización del usuario actual

## Middleware Disponibles

### fullAuthMiddleware
Combina autenticación + autorización básica
```javascript
app.get('/ruta', fullAuthMiddleware, handler);
```

### fileAuthorizationMiddleware
Verificación específica para archivos
```javascript
app.get('/file/:fileName', fullAuthMiddleware, fileAuthorizationMiddleware, handler);
```

### bucketAuthorizationMiddleware
Verificación específica para buckets
```javascript
app.get('/bucket-data', fullAuthMiddleware, bucketAuthorizationMiddleware('bucket-name'), handler);
```

## Mapeo de Tipologías

```javascript
const typeToGroupMap = {
  'Carta': 'Cartas',
  'Factura': 'Facturas', 
  'Documento': 'Cartas' // Por defecto
};
```

## Datos de Prueba

El sistema incluye datos de prueba iniciales:
- usuario1: Acceso a Cartas
- usuario2: Acceso a Facturas

## Configuración

### Variables de Entorno
Las mismas que el sistema existente:
- `S3_BUCKET_NAME`
- `S3_SOURCE_PREFIX`
- `S3_DESTINATION_PREFIX`

### Inicialización Automática
- El sistema crea automáticamente el directorio `data/` si no existe
- En desarrollo, inicializa datos de prueba automáticamente

## Seguridad

### Verificaciones de Seguridad
1. **Autenticación previa**: Requiere token válido de Cognito
2. **Autorización específica**: Verifica permisos por recurso
3. **Validación de datos**: Valida grupos de documentos permitidos
4. **Auditoría**: Logs de accesos y denegaciones

### Respuestas de Error
```json
{
  "error": "Sin autorización",
  "message": "El usuario no tiene permisos configurados para acceder a este sistema"
}
```

## Uso en el Frontend

El frontend existente funcionará automáticamente con el nuevo sistema. Los usuarios solo verán los archivos y tendrán acceso a los recursos para los que están autorizados.

## Administración

### Crear Nueva Autorización
```bash
POST /api/admin/authorizations
Content-Type: application/json
Authorization: Bearer <token>

{
  "username": "nuevo_usuario",
  "bucket": "mi-bucket",
  "grupo_documentos": "Cartas"
}
```

### Verificar Autorización
```bash
GET /api/user/authorization
Authorization: Bearer <token>
```

## Logs

El sistema registra:
- Verificaciones de autorización exitosas/fallidas
- Accesos a archivos específicos
- Creación/actualización de permisos
- Filtrado de archivos por grupo

## Mantenimiento

### Backup de Autorizaciones
La base de datos SQLite `user_authorization.db` debe incluirse en respaldos regulares.

### Consultas SQL Directas
```sql
-- Ver todas las autorizaciones
SELECT * FROM user_authorizations;

-- Ver autorizaciones activas
SELECT * FROM user_authorizations WHERE activo = 1;

-- Desactivar usuario
UPDATE user_authorizations SET activo = 0 WHERE username = 'usuario';
```

## Troubleshooting

### Error: "Usuario no tiene permisos configurados"
- Verificar que el usuario existe en la tabla `user_authorizations`
- Verificar que `activo = 1`
- Consultar: `SELECT * FROM user_authorizations WHERE username = 'usuario'`

### Error: "Acceso denegado al grupo de documentos"
- Verificar el mapeo de tipologías de archivos
- Verificar el grupo asignado al usuario en la base de datos

### Error: "Base de datos no inicializada"
- Verificar que SQLite3 está instalado
- Verificar permisos de escritura en directorio `backend/data/`

### Archivos no aparecen en la lista
- Verificar filtrado por grupo de documentos
- Verificar bucket autorizado del usuario
- Consultar logs del servidor para más detalles
