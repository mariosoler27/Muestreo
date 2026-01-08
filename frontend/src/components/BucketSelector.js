import React, { useState, useEffect } from 'react';
import { getAvailableBuckets, setSelectedBucket } from '../services/api';
// Los estilos se importan desde el index.css principal

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
        // Obtener buckets únicos (puede haber múltiples autorizaciones con el mismo bucket)
        const uniqueBuckets = [];
        const seenBuckets = new Set();
        
        response.buckets.forEach(auth => {
          if (!seenBuckets.has(auth.bucket)) {
            uniqueBuckets.push({
              id: auth.id,
              bucket: auth.bucket,
              // Para mostrar solo el bucket, no los grupos
              description: auth.bucket
            });
            seenBuckets.add(auth.bucket);
          }
        });
        
        setBuckets(uniqueBuckets);
        setCurrentBucket(response.currentBucket);
        
        // Informar al componente padre
        if (onBucketChange) {
          onBucketChange({
            buckets: uniqueBuckets,
            currentBucket: response.currentBucket,
            hasMultipleBuckets: uniqueBuckets.length > 1,
            allAuthorizations: response.buckets // Pasar todas las autorizaciones para FolderExplorer
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
    const selectedBucketInfo = buckets.find(bucket => bucket.id === selectedBucketId);
    
    if (selectedBucketInfo) {
      setCurrentBucket(selectedBucketInfo);
      setSelectedBucket(selectedBucketInfo);
      
      // Informar al componente padre del cambio
      if (onBucketChange) {
        onBucketChange({
          buckets,
          currentBucket: selectedBucketInfo,
          hasMultipleBuckets: buckets.length > 1,
          selectedBucket: selectedBucketInfo
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
          <span className="bucket-label">Bucket:</span>
          <span className="bucket-name">{buckets[0].bucket}</span>
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
              {bucket.bucket}
            </option>
          ))}
        </select>
      </div>
      <div className="current-bucket-info">
        <span className="info-label">Bucket activo:</span>
        <span className="info-value">
          {currentBucket?.bucket || 'Ninguno seleccionado'}
        </span>
      </div>
    </div>
  );
};

export default BucketSelector;
