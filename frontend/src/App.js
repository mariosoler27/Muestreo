import React, { useState, useEffect } from 'react';
import './App.css';
import FileExplorer from './components/FileExplorer';
import FileDetails from './components/FileDetails';
import FolderExplorer from './components/FolderExplorer';
import Login from './components/Login';
import { getFilesByFolder, getFileInfo, processFile } from './services/api';
import { isAuthenticated, getUserInfo, logout, initAuth } from './services/auth';

function App() {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDetails, setFileDetails] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Inicializar autenticación al cargar la aplicación
  useEffect(() => {
    initAuth();
    checkAuthStatus();
  }, []);

  // Verificar estado de autenticación
  const checkAuthStatus = () => {
    const isAuth = isAuthenticated();
    setAuthenticated(isAuth);
    
    if (isAuth) {
      const userInfo = getUserInfo();
      setUser(userInfo);
      loadFiles();
    } else {
      setLoading(false);
    }
  };

  // Manejar login exitoso
  const handleLoginSuccess = (loginData) => {
    setAuthenticated(true);
    const userInfo = getUserInfo();
    setUser(userInfo);
    loadFiles();
  };

  // Manejar logout
  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setUser(null);
    setFiles([]);
    setSelectedFile(null);
    setFileDetails(null);
  };

  // Cargar archivos (solo si está autenticado)
  useEffect(() => {
    if (authenticated) {
      loadFiles();
    }
  }, [authenticated]);

  const loadFiles = async (folderPath = null) => {
    if (!folderPath) {
      // Si no hay carpeta seleccionada, limpiar archivos
      setFiles([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const filesData = await getFilesByFolder(folderPath);
      setFiles(filesData);
    } catch (error) {
      console.error('Error cargando archivos:', error);
      setError('Error al cargar los archivos del servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleFolderSelect = async (folder) => {
    setSelectedFolder(folder);
    // Limpiar selecciones anteriores
    setSelectedFile(null);
    setFileDetails(null);
    // Cargar archivos de la carpeta seleccionada
    await loadFiles(folder.path);
  };

  const handleFileSelect = async (file) => {
    try {
      setSelectedFile(file);
      setLoading(true);
      setError(null);
      
      if (!selectedFolder) {
        throw new Error('No hay carpeta seleccionada');
      }
      
      const details = await getFileInfo(file.name, selectedFolder.path);
      setFileDetails(details);
    } catch (error) {
      console.error('Error cargando detalles del archivo:', error);
      setError('Error al cargar los detalles del archivo');
      setFileDetails(null);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessFile = async (processData) => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await processFile({
        fileName: selectedFile.name,
        ...processData
      });

      alert(`Archivo procesado exitosamente: ${result.message}`);
      
      // Recargar la lista de archivos y limpiar selección
      setSelectedFile(null);
      setFileDetails(null);
      // Recargar archivos de la carpeta actual
      await loadFiles(selectedFolder?.path);
      
    } catch (error) {
      console.error('Error procesando archivo:', error);
      setError('Error al procesar el archivo');
    } finally {
      setLoading(false);
    }
  };

  // Mostrar pantalla de login si no está autenticado
  if (!authenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Procesador de Ficheros S3</h1>
        <p>Gestión y procesamiento de archivos CSV desde Amazon S3</p>
        {user && (
          <div className="user-info">
            <span>Bienvenido, {user.name || user.username}</span>
            <button onClick={handleLogout} className="logout-btn">
              Cerrar Sesión
            </button>
          </div>
        )}
      </header>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError(null)}>Cerrar</button>
        </div>
      )}

      <main className="App-main">
        <div className="container">
          <div className="folder-panel">
            <FolderExplorer
              onFolderSelect={handleFolderSelect}
              selectedFolder={selectedFolder}
              loading={loading}
            />
          </div>

          <div className="files-panel">
            <FileExplorer
              files={files}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              selectedFolder={selectedFolder}
              loading={loading}
              onRefresh={() => loadFiles(selectedFolder?.path)}
            />
          </div>
          
          <div className="details-panel">
            <FileDetails
              fileDetails={fileDetails}
              selectedFile={selectedFile}
              loading={loading}
              onProcessFile={handleProcessFile}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
