import React, { useState, useEffect } from 'react';
import { getAvailableBuckets, setSelectedBucket } from '../services/api';
import './BucketSelector.css';

const BucketSelector = ({ onBucketChange, onLoading }) => {
  const [buckets, setBuckets] = useState([]);
  const [currentBucket, setCurrentBucket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadAvailableBuckets();
  }, []);

  const loadAvailableBuckets = async () => {
    try {
      setLoading(true);
      setError(null);
      if (onLoading) onLoading(true);

      const response = await getAvailableBuckets();
      
      if (response.success) {
        setBuckets(response.buckets);
        setCurrentBucket(response.currentBucket);
        
        // Si hay múltiples buckets, informar al componente padre
        if (onBucketChange) {
          onBucketChange({
            buckets: response.buckets,
            currentBucket: response.currentBucket,
            hasMultipleBuckets: response.buckets.length > 1
          });
        }
      }
    } catch (error) {
      console.error('Error cargando buckets disponibles:', error);
      setError('Error al cargar los buckets disponibles');
    } finally {
      setLoading(false);
      if (onLoading) onLoading(false);
    }
  };

  const handleBucketChange = (event) => {
    const selectedBucketId = parseInt(event.target.value);
    const selectedBucket = buckets.find(bucket => bucket.id === selectedBucketId);
    
    if (selectedBucket) {
      // Actualizar el bucket seleccionado en el estado local
      setCurrentBucket(selectedBucket);
      
      // Establecer el bucket seleccionado en la API para futuras peticiones
      setSelectedBucket(selectedBucket);
      
      // Informar al componente padre del cambio
      if (onBucketChange) {
        onBucketChange({
          buckets,
          currentBucket: selectedBucket,
          hasMultipleBuckets: buckets.length > 1,
          selectedBucket
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="bucket-selector loading">
        <span>Cargando buckets disponibles...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bucket-selector error">
        <span className="error-text">{error}</span>
        <button onClick={loadAvailableBuckets} className="retry-btn">
          Reintentar
        </button>
      </div>
    );
  }

  if (buckets.length === 0) {
    return (
      <div className="bucket-selector no-buckets">
        <span>No se encontraron buckets disponibles</span>
      </div>
    );
  }

  // Si solo hay un bucket, mostrar solo información
  if (buckets.length === 1) {
    return (
      <div className="bucket-selector single-bucket">
        <div className="bucket-info">
          <span className="bucket-label">Bucket actual:</span>
          <span className="bucket-name">{currentBucket?.grupoDocumentos || buckets[0].descripcion}</span>
        </div>
      </div>
    );
  }

  // Si hay múltiples buckets, mostrar selector
  return (
    <div className="bucket-selector multiple-buckets">
      <div className="selector-container">
        <label htmlFor="bucket-select" className="selector-label">
          Seleccionar bucket:
        </label>
        <select
          id="bucket-select"
          value={currentBucket?.id || ''}
          onChange={handleBucketChange}
          className="bucket-dropdown"
        >
          {buckets.map(bucket => (
            <option key={bucket.id} value={bucket.id}>
              {bucket.bucket}: {bucket.grupoDocumentos}
            </option>
          ))}
        </select>
      </div>
      <div className="current-bucket-info">
        <span className="info-label">Bucket activo:</span>
        <span className="info-value">
          {currentBucket?.grupoDocumentos || 'Ninguno seleccionado'}
        </span>
      </div>
    </div>
  );
};

export default BucketSelector;
