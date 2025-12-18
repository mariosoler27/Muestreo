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

// Variable global para el bucket seleccionado
let selectedBucketInfo = null;

// Función para establecer el bucket seleccionado
export const setSelectedBucket = (bucketInfo) => {
  selectedBucketInfo = bucketInfo;
};

// Función para obtener el bucket seleccionado
export const getSelectedBucket = () => {
  return selectedBucketInfo;
};

// Función helper para hacer peticiones autenticadas
const authenticatedFetch = async (url, options = {}) => {
  // Verificar que los tokens son válidos antes de hacer la petición
  if (!checkTokensValidity()) {
    throw new Error('No hay sesión válida. Por favor, inicia sesión.');
  }
  
  // Añadir headers de autenticación
  const authHeaders = getAuthHeaders();
  
  // Añadir headers del bucket seleccionado si existe
  const bucketHeaders = {};
  if (selectedBucketInfo) {
    bucketHeaders['X-Selected-Bucket-Id'] = selectedBucketInfo.id.toString();
    bucketHeaders['X-Selected-Group-Documents'] = selectedBucketInfo.grupoDocumentos;
  }
  
  const requestOptions = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...bucketHeaders,
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

// Obtener buckets disponibles para el usuario (requiere autenticación)
export const getAvailableBuckets = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/user/availableBuckets`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getAvailableBuckets:', error);
    throw error;
  }
};

// Obtener autorización actual del usuario (requiere autenticación)
export const getUserAuthorization = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/user/authorization`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getUserAuthorization:', error);
    throw error;
  }
};

// Verificar si el usuario es administrador (requiere autenticación)
export const checkIsAdmin = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/admin/isAdmin`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en checkIsAdmin:', error);
    return { success: false, isAdmin: false };
  }
};

// ===== FUNCIONES DE ADMINISTRACIÓN =====

// Obtener todas las autorizaciones (solo admins)
export const getAllAuthorizations = async () => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/admin/all-authorizations`);
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en getAllAuthorizations:', error);
    throw error;
  }
};

// Crear nueva autorización (solo admins)
export const createAuthorization = async (authData) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/admin/create-authorization`, {
      method: 'POST',
      body: JSON.stringify(authData),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en createAuthorization:', error);
    throw error;
  }
};

// Actualizar autorización (solo admins)
export const updateAuthorization = async (id, updates) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/admin/update-authorization/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en updateAuthorization:', error);
    throw error;
  }
};

// Eliminar autorización (solo admins)
export const deleteAuthorization = async (id) => {
  try {
    const response = await authenticatedFetch(`${API_BASE_URL}/admin/delete-authorization/${id}`, {
      method: 'DELETE',
    });
    return await handleResponse(response);
  } catch (error) {
    console.error('Error en deleteAuthorization:', error);
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
