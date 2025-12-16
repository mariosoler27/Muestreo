import React, { useState } from 'react';
import { downloadDocument } from '../services/api';
import { getDocumentTypeDisplay, isValidDocumentType } from '../config/documentTypes';

const FileDetails = ({ fileDetails, selectedFile, loading, onProcessFile }) => {
  const [downloadingDocument, setDownloadingDocument] = useState(null); // Cambiar a null para manejar ID específico
  const [formData, setFormData] = useState({
    idSpool: '',
    tipoDocumento: '',
    idDocumento: '',
    resultado: '',
    idUsuario: '',
    nombreUsuario: ''
  });

  const [processingErrors, setProcessingErrors] = useState({});

  // Opciones para el selector de resultado
  const resultadoOptions = [
    { value: '', label: 'Seleccionar resultado...' },
    { value: 'OK', label: 'OK' },
    { value: 'KO', label: 'KO' },
    { value: 'KO parcial', label: 'KO parcial' }
  ];

  // Cargar datos del usuario desde sessionStorage al montar el componente
  React.useEffect(() => {
    const username = sessionStorage.getItem('username');
    const idToken = sessionStorage.getItem('idToken');
    
    let nombreUsuario = 'Usuario';
    
    // Intentar obtener el nombre del token ID si está disponible
    if (idToken) {
      try {
        const payload = JSON.parse(atob(idToken.split('.')[1]));
        nombreUsuario = payload.name || payload['cognito:username'] || username || 'Usuario';
      } catch (error) {
        console.error('Error decodificando token:', error);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      idUsuario: username || '',
      nombreUsuario: nombreUsuario
    }));
  }, []);

  // Actualizar formData cuando cambian los detalles del archivo
  React.useEffect(() => {
    if (fileDetails && fileDetails.data && fileDetails.data.length > 0) {
      const firstRecord = fileDetails.data[0];
      setFormData(prev => ({
        ...prev,
        idSpool: firstRecord.idSpool || '',
        tipoDocumento: firstRecord.tipologia || '', // Usar tipologia del CSV
        idDocumento: firstRecord.idDocumento || ''
      }));
    }
  }, [fileDetails]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error del campo cuando el usuario empiece a escribir
    if (processingErrors[field]) {
      setProcessingErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    // Solo validar que el resultado esté seleccionado
    if (!formData.resultado) {
      errors.resultado = 'Resultado es obligatorio';
    }
    
    setProcessingErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Función para verificar si el formulario es válido para habilitar el botón
  const isFormValid = () => {
    return formData.resultado && formData.resultado.trim() !== '';
  };

  const handleProcessFile = () => {
    if (!validateForm()) {
      return;
    }
    
    // Agregar información de la carpeta actual
    const processData = {
      ...formData,
      fileName: fileDetails.fileName,
      folderPath: fileDetails.folderPath
    };
    
    onProcessFile(processData);
  };

  // Función para descargar documento desde la tabla CSV
  const handleDownloadDocumentFromRow = async (idDocumento) => {
    if (!idDocumento) {
      alert('No hay ID de documento para descargar');
      return;
    }

    setDownloadingDocument(idDocumento);
    try {
      // Usar la función centralizada de la API
      const blob = await downloadDocument(idDocumento);
      
      // Crear URL y descargar archivo
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = idDocumento;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Error descargando documento:', error);
      alert(`Error descargando documento: ${error.message}`);
    } finally {
      setDownloadingDocument(null);
    }
  };

  if (!selectedFile) {
    return (
      <div className="file-details">
        <div className="no-selection">
          <h3>Vista de Detalles</h3>
          <p>Selecciona un archivo del navegador para ver sus detalles</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-details">
        <div className="loading">
          <h3>Cargando detalles...</h3>
          <p>Obteniendo información del archivo {selectedFile.name}</p>
        </div>
      </div>
    );
  }

  if (!fileDetails) {
    return (
      <div className="file-details">
        <div className="error">
          <h3>Error</h3>
          <p>No se pudieron cargar los detalles del archivo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-details">
      <div className="details-header">
        <h3>Detalles del Archivo</h3>
        <div className="file-info-summary">
          <h4>{fileDetails.fileName}</h4>
          <div className="type-info">
            <span className="tipologia-badge">{fileDetails.tipologia}</span>
          </div>
          <p className="description">{fileDetails.descripcion}</p>
        </div>
      </div>

      <div className="csv-data-section">
        <h4>Contenido CSV</h4>
        {fileDetails.data && fileDetails.data.length > 0 ? (
          <div className="csv-table">
            <table>
              <thead>
                <tr>
                  <th>ID Spool</th>
                  <th>Tipo Documento</th>
                  <th>ID Documento</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {fileDetails.data.map((row, index) => (
                  <tr key={index}>
                    <td>{row.idSpool}</td>
                    <td>
                      <span className="tipologia-badge" title={getDocumentTypeDisplay(row.tipologia)}>
                        {getDocumentTypeDisplay(row.tipologia)}
                      </span>
                    </td>
                    <td>{row.idDocumento}</td>
                    <td>
                      {row.idDocumento && (
                        <button
                          type="button"
                          className="download-btn-small"
                          onClick={() => handleDownloadDocumentFromRow(row.idDocumento)}
                          disabled={downloadingDocument === row.idDocumento}
                          title={`Descargar ${row.idDocumento}`}
                        >
                          {downloadingDocument === row.idDocumento ? '⏳' : '📥'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No se encontraron datos en el archivo</p>
        )}
      </div>

      <div className="processing-section">
        <h4>Procesar Archivo</h4>
        
        <div className="form-row">
          <div className="form-field">
            <label htmlFor="resultado">Resultado:</label>
            <select
              id="resultado"
              value={formData.resultado}
              onChange={(e) => handleInputChange('resultado', e.target.value)}
              className={processingErrors.resultado ? 'error' : ''}
            >
              {resultadoOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {processingErrors.resultado && (
              <span className="field-error">{processingErrors.resultado}</span>
            )}
          </div>
        </div>


        <div className="form-row">
          <div className="form-field">
            <label htmlFor="idUsuario">ID Usuario:</label>
            <input
              type="text"
              id="idUsuario"
              value={formData.idUsuario}
              readOnly
              className="readonly-field"
              title="Campo automático basado en usuario autenticado"
            />
          </div>

          <div className="form-field">
            <label htmlFor="nombreUsuario">Nombre Usuario:</label>
            <input
              type="text"
              id="nombreUsuario"
              value={formData.nombreUsuario}
              readOnly
              className="readonly-field"
              title="Campo automático basado en usuario autenticado"
            />
          </div>
        </div>

        <div className="process-actions">
          <button 
            className="process-btn"
            onClick={handleProcessFile}
            disabled={loading || !isFormValid()}
          >
            {loading ? 'Procesando...' : 'Procesar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileDetails;
