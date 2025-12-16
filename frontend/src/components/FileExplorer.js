import React from 'react';

const FileExplorer = ({ files, onFileSelect, selectedFile, loading, onRefresh }) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('es-ES');
  };

  if (loading && files.length === 0) {
    return (
      <div className="file-explorer">
        <div className="explorer-header">
          <h2>Navegador de Ficheros</h2>
          <button onClick={onRefresh} disabled className="refresh-btn">
            Actualizando...
          </button>
        </div>
        <div className="loading">
          <p>Cargando archivos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <h2>Navegador de Ficheros</h2>
        <button onClick={onRefresh} disabled={loading} className="refresh-btn">
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      
      <div className="files-count">
        <p>{files.length} archivo{files.length !== 1 ? 's' : ''} encontrado{files.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="files-list">
        {files.length === 0 ? (
          <div className="no-files">
            <p>No se encontraron archivos</p>
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.key}
              className={`file-item ${selectedFile?.key === file.key ? 'selected' : ''}`}
              onClick={() => onFileSelect(file)}
            >
              <div className="file-main-info">
                <div className="file-name">{file.name}</div>
                <div className="file-type-info">
                  <span className="tipologia">{file.tipologia}</span>
                </div>
              </div>
              
              <div className="file-details">
                <div className="file-description">{file.descripcion}</div>
              </div>
              
              <div className="file-meta">
                <span>Tamaño: {formatFileSize(file.size)}</span>
                <span>Modificado: {formatDate(file.lastModified)}</span>
              </div>
            </div>
          ))
        )}
      </div>
      
      {selectedFile && (
        <div className="selection-info">
          <p><strong>Seleccionado:</strong> {selectedFile.name}</p>
        </div>
      )}
    </div>
  );
};

export default FileExplorer;
