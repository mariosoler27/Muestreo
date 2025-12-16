import { getAuthHeaders, checkTokensValidity, logout } from './auth';

const API_BASE_URL = 'http://localhost:5000/api';

// Función helper para manejar respuestas de la API
const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    
    // Si es error 401, verificar si los tokens han expirado
    if (response.status === 401) {
      if (!checkTokensValidity()) {
        // Los tokens han expirado, redirigir al login
        logout();
        throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      }
    }
    
    throw new Error(errorData.message || errorData.error || `Error ${response.status}: ${response.statusText}`);
  }
  return response.json();
};

// Función helper para hacer peticiones autenticadas
const authenticatedFetch = async (url, options = {}) => {
  // Verificar que los tokens son válidos antes de hacer la petición
  if (!checkTokensValidity()) {
    throw new Error('No hay sesión válida. Por favor, inicia sesión.');
  }
  
  // Añadir headers de autenticación
  const authHeaders = getAuthHeaders();
  
  const requestOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...options.headers
    }
  };
  
  return fetch(url, requestOptions);
};

// Obtener lista de archivos del bucket S3 (requiere autenticación)
export const getFiles = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/getFiles`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getFiles:', error);
    throw error;
  }
};

// Obtener información detallada de un archivo específico (requiere autenticación)
export const getFileInfo = async (fileName, folderPath) => {
  try {
    if (!folderPath) {
      throw new Error('Parámetro folderPath es requerido');
    }
    
    const response = await authenticatedFetch(`${API_BASE_URL}/getFileInfo/${encodeURIComponent(fileName)}?folder=${encodeURIComponent(folderPath)}`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getFileInfo:', error);
    throw error;
  }
};

// Procesar un archivo (requiere autenticación)
export const processFile = async (processData) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/processFile`, {
      method: 'POST',
      body: JSON.stringify(processData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en processFile:', error);
    throw error;
  }
};

// Verificar estado del servidor
export const checkServerHealth = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en checkServerHealth:', error);
    throw error;
  }
};

// Obtener carpetas disponibles para el usuario (requiere autenticación)
export const getFolders = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/getFolders`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getFolders:', error);
    throw error;
  }
};

// Obtener archivos de una carpeta específica (requiere autenticación)
export const getFilesByFolder = async (folderPath) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/getFiles?folder=${encodeURIComponent(folderPath)}`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getFilesByFolder:', error);
    throw error;
  }
};

// Descargar documento desde S3 (requiere autenticación)
export const downloadDocument = async (documentId) => {
  try {
    // Verificar que los tokens son válidos antes de hacer la petición
    if (!checkTokensValidity()) {
      throw new Error('No hay sesión válida. Por favor, inicia sesión.');
    }
    
    // Añadir headers de autenticación
    const authHeaders = getAuthHeaders();
    
    const response = await fetch(`${API_BASE_URL}/downloadDocument/${encodeURIComponent(documentId)}`, {
      method: 'GET',
      headers: {
        ...authHeaders
      }
    });
    
    if (!response.ok) {
      // Manejar errores sin intentar parsear como JSON si es un error de stream
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { message: `Error ${response.status}: ${response.statusText}` };
      }
      
      // Si es error 401, verificar si los tokens han expirado
      if (response.status === 401) {
        if (!checkTokensValidity()) {
          logout();
          throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
        }
      }
      
      throw new Error(errorData.message || errorData.error || `Error descargando documento: ${response.statusText}`);
    }
    
    // Devolver el blob directamente para la descarga
    return await response.blob();
  } catch (error) {
    console.error('Error en downloadDocument:', error);
    throw error;
  }
};
