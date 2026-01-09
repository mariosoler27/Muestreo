import React, { useState, useEffect } from 'react';
import { getAvailableBuckets } from '../services/api';
// Los estilos se importan desde el index.css principal

// Funciones para manejar bucket activo en localStorage
const getActiveBucket = () => {
  try {
    return localStorage.getItem('activeBucket');
  } catch (error) {
    console.error('Error leyendo bucket activo de localStorage:', error);
    return null;
  }
};

const setActiveBucket = (bucket) => {
  try {
    if (bucket) {
      localStorage.setItem('activeBucket', bucket);
      console.log(`💾 BUCKET ACTIVO guardado en localStorage: ${bucket}`);
    } else {
      localStorage.removeItem('activeBucket');
    }
  } catch (error) {
    console.error('Error guardando bucket activo en localStorage:', error);
  }
};

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
      
      if (response.success && response.buckets) {
        setBuckets(response.buckets);
        
        // Determinar bucket inicial: localStorage o primer bucket
        const savedBucket = getActiveBucket();
        const initialBucket = (savedBucket && response.buckets.includes(savedBucket)) 
          ? savedBucket 
          : response.buckets[0];
        
        setCurrentBucket(initialBucket);
        setActiveBucket(initialBucket);
        
        console.log(`🔧 BUCKETS CARGADOS:`, {
          total: response.buckets.length,
          buckets: response.buckets,
          savedBucket,
          initialBucket
        });
        
        // Informar al componente padre
        if (onBucketChange) {
          onBucketChange({
            activeBucket: initialBucket,
            allBuckets: response.buckets,
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
    const selectedBucket = event.target.value;
    
    console.log(`🔄 CAMBIO DE BUCKET:`, {
      anterior: currentBucket,
      nuevo: selectedBucket
    });
    
    setCurrentBucket(selectedBucket);
    setActiveBucket(selectedBucket);
    
    // Informar al componente padre del cambio
    if (onBucketChange) {
      onBucketChange({
        activeBucket: selectedBucket,
        allBuckets: buckets,
        hasMultipleBuckets: buckets.length > 1
      });
    }
    
    console.log(`✅ BUCKET ACTIVO CAMBIADO a: ${selectedBucket}`);
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
          <span className="bucket-name">{buckets[0]}</span>
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
          value={currentBucket || ''}
          onChange={handleBucketChange}
          className="bucket-dropdown"
        >
          {buckets.map(bucket => (
            <option key={bucket} value={bucket}>
              {bucket}
            </option>
          ))}
        </select>
      </div>
      <div className="current-bucket-info">
        <span className="info-label">Bucket activo:</span>
        <span className="info-value">
          {currentBucket || 'Ninguno seleccionado'}
        </span>
      </div>
    </div>
  );
};

export default BucketSelector;
