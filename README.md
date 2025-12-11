# Aplicación de Procesamiento de Ficheros S3

Aplicación React + Node.js para gestionar y procesar archivos CSV desde un bucket de Amazon S3.

## Características

### Frontend (React)
- **Navegador de ficheros** en la parte izquierda que muestra los archivos del bucket S3
- **Clasificación automática** de tipología basada en el nombre del archivo
- **Vista de detalles** en la parte derecha mostrando el contenido del archivo CSV seleccionado
- **Formulario de procesamiento** con campos para:
  - ID Spool (extraído del CSV)
  - Tipo Documento (extraído del CSV)
  - Selector de Resultado (OK, KO, KO parcial)
  - ID Usuario y Nombre Usuario (configurables)
- **Botón "Procesar"** para actualizar y mover el archivo

### Backend (Node.js + Express)
- **Servicio getFiles**: Lista archivos del bucket S3 con información de tipología
- **Servicio getFileInfo**: Lee y parsea archivos CSV específicos
- **Servicio processFile**: Actualiza archivos CSV y los mueve a carpeta Resultado
- **Clasificación completa** de tipologías por sistema (Delta Smile, Delta MAY)

## Tipologías Soportadas

### Delta Smile
- **Cartas**: C101-C144, C302-C312, G340, G347-G351 (Modelos 347, Cobros, Reubicación, Vulnerabilidad, Reprocesos)
- **Contratos**: G013, G311
- **Facturas**: F301-F370 (Electricidad PVPC, Bono Social, Gas, Precio fijo, etc.)

### Delta MAY
- **Cartas**: C001-C402 (Modelos 347, Cobros)
- **Facturas**: F001-F402 (Gas, Electricidad, GNL, Clientes No Finales)

## Estructura del Proyecto

```
/
├── package.json                    # Configuración principal y scripts
├── backend/                        # Servidor Node.js
│   ├── package.json               # Dependencias del backend
│   ├── server.js                  # Servidor Express principal
│   ├── config/
│   │   └── fileTypes.js          # Configuración de tipologías
│   └── services/
│       └── s3Services.js         # Servicios de Amazon S3
├── frontend/                       # Aplicación React
│   └── (generada por create-react-app)
└── README.md                      # Este archivo
```

## Configuración

### Prerrequisitos
- Node.js 16 o superior
- Credenciales AWS configuradas localmente
- Acceso al bucket S3: `rgpdintcomer-des-deltasmile-servinform`

### Instalación

1. **Instalar dependencias**:
   ```bash
   npm run install-all
   ```

2. **Configurar AWS**:
   - Asegurarse de que las credenciales AWS estén configuradas localmente
   - El backend usará la configuración por defecto del SDK de AWS

### Ejecución

**Desarrollo (ambos servidores)**:
```bash
npm run dev
```

**Solo backend**:
```bash
npm run server
```

**Solo frontend**:
```bash
npm run client
```

## API Endpoints

### GET /api/getFiles
Lista todos los archivos del bucket S3 con información de tipología.

**Respuesta**:
```json
[
  {
    "name": "C101_archivo.csv",
    "key": "Recepcion/Muestreo/C101_archivo.csv",
    "size": 1024,
    "lastModified": "2024-01-01T00:00:00Z",
    "tipologia": "C101",
    "sistema": "Delta Smile",
    "descripcion": "Modelo 347",
    "grupo": "Cartas"
  }
]
```

### GET /api/getFileInfo/:fileName
Obtiene información detallada de un archivo CSV específico.

**Respuesta**:
```json
{
  "fileName": "C101_archivo.csv",
  "tipologia": "C101",
  "sistema": "Delta Smile",
  "descripcion": "Modelo 347",
  "grupo": "Cartas",
  "data": [
    {
      "idSpool": "12345",
      "tipoDocumento": "Factura"
    }
  ]
}
```

### POST /api/processFile
Procesa un archivo actualizando su contenido y moviéndolo a la carpeta Resultado.

**Body**:
```json
{
  "fileName": "C101_archivo.csv",
  "idSpool": "12345",
  "tipoDocumento": "Factura",
  "resultado": "OK",
  "idUsuario": "user123",
  "nombreUsuario": "Juan Pérez"
}
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Archivo C101_archivo.csv procesado y movido a Resultado",
  "processedBy": "Juan Pérez",
  "processedAt": "2024-01-01T00:00:00.000Z",
  "resultado": "OK"
}
```

## Flujo de Trabajo

1. **Carga inicial**: La aplicación lista automáticamente los archivos del bucket S3
2. **Selección**: El usuario selecciona un archivo del navegador
3. **Vista de datos**: Se muestra el contenido CSV parseado en la vista de detalles
4. **Configuración**: El usuario ajusta los campos y selecciona el resultado
5. **Procesamiento**: Al hacer clic en "Procesar", el archivo se actualiza con:
   - Resultado seleccionado
   - ID y nombre del usuario
   - Timestamp del procesamiento
6. **Movimiento**: El archivo se mueve automáticamente a la carpeta `Resultado/`

## Rutas S3

- **Origen**: `rgpdintcomer-des-deltasmile-servinform/Recepcion/Muestreo/`
- **Destino**: `rgpdintcomer-des-deltasmile-servinform/Recepcion/Muestreo/Resultado/`

## Desarrollo

### Tecnologías Utilizadas
- **Frontend**: React, CSS3, HTML5
- **Backend**: Node.js, Express.js
- **AWS**: SDK de JavaScript para S3
- **Parsing**: csv-parser para procesar archivos CSV

### Puerto por Defecto
- **Backend**: http://localhost:5000
- **Frontend**: http://localhost:3000

### CORS
El backend está configurado con CORS habilitado para permitir comunicación con el frontend durante el desarrollo.
