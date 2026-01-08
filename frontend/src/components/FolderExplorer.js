import React, { useState, useEffect } from 'react';
import { getAvailableBuckets, getFilesByFolder } from '../services/api';

const FolderExplorer = ({ onFolderSelect, selectedFolder, loading: parentLoading, refreshKey, bucketInfo }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderStructure, setFolderStructure] = useState([]);
  const [userAuthorizations, setUserAuthorizations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar autorizaciones del usuario al montar el componente
  useEffect(() => {
    loadUserAuthorizations();
  }, []);

  // Recargar cuando cambie el refreshKey o bucketInfo
  useEffect(() => {
    if (refreshKey || bucketInfo) {
      loadUserAuthorizations();
    }
  }, [refreshKey, bucketInfo]);

  const loadUserAuthorizations = async () => {
    try {
      setLoading(true);
      const response = await getAvailableBuckets();
      
      if (response.success && response.buckets) {
        setUserAuthorizations(response.buckets);
        await buildFolderStructure(response.buckets);
      }
    } catch (error) {
      console.error('Error cargando autorizaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFolderStructure = async (authorizations) => {
    try {
      // Filtrar autorizaciones por bucket si hay uno específicamente seleccionado
      let filteredAuthorizations = authorizations;
      
      if (bucketInfo && bucketInfo.selectedBucket && bucketInfo.selectedBucket.bucket) {
        const selectedBucketName = bucketInfo.selectedBucket.bucket;
        filteredAuthorizations = authorizations.filter(auth => auth.bucket === selectedBucketName);
        console.log(`Filtrando por bucket: ${selectedBucketName}. Autorizaciones encontradas: ${filteredAuthorizations.length}`);
      }
      
      // Agrupar autorizaciones filtradas por subcarpeta
      const groupedAuth = {};
      
      filteredAuthorizations.forEach(auth => {
        const subcarpeta = auth.grupoDocumentos.replace('Recepcion/Muestreo/', '');
        
        if (!groupedAuth[subcarpeta]) {
          groupedAuth[subcarpeta] = {
            name: subcarpeta,
            path: auth.grupoDocumentos
          };
        }
      });

      // Para cada subcarpeta permitida, cargar su contenido (archivos y carpetas)
      const subcarpetas = [];
      for (const [subcarpetaName, subcarpetaInfo] of Object.entries(groupedAuth)) {
        try {
          // Usar getFilesByFolder que ya maneja la autenticación correctamente
          const files = await getFilesByFolder(subcarpetaInfo.path);
          
          const folders = [];
          let fileCount = 0;
          
          if (files && Array.isArray(files)) {
            const folderSet = new Set();
            
            files.forEach(file => {
              if (file.folder && file.folder !== subcarpetaInfo.path) {
                // Es un archivo dentro de una subcarpeta - extraer nombre de la carpeta
                const relativePath = file.folder.replace(subcarpetaInfo.path + '/', '');
                const folderName = relativePath.split('/')[0];
                
                if (!folderSet.has(folderName)) {
                  folderSet.add(folderName);
                  folders.push({
                    id: `${subcarpetaName.toLowerCase()}-${folderName.toLowerCase()}`,
                    name: folderName,
                    path: `${subcarpetaInfo.path}/${folderName}`,
                    type: 'folder',
                    parent: subcarpetaName.toLowerCase()
                  });
                }
              } else if (file.folder === subcarpetaInfo.path) {
                // Es un archivo en el directorio raíz de la subcarpeta - contar
                fileCount++;
              }
            });
          }

          subcarpetas.push({
            id: subcarpetaName.toLowerCase(),
            name: subcarpetaName,
            path: subcarpetaInfo.path,
            type: 'group',
            parent: 'recepcion-muestreo',
            children: folders,
            fileCount: fileCount
          });
        } catch (error) {
          console.error(`Error cargando contenido para ${subcarpetaName}:`, error);
          // Añadir subcarpeta vacía si hay error
          subcarpetas.push({
            id: subcarpetaName.toLowerCase(),
            name: subcarpetaName,
            path: subcarpetaInfo.path,
            type: 'group',
            parent: 'recepcion-muestreo',
            children: []
          });
        }
      }

      // Crear estructura jerárquica
      const structure = [{
        id: 'recepcion-muestreo',
        name: 'Recepcion/Muestreo',
        path: 'Recepcion/Muestreo',
        type: 'root',
        children: subcarpetas
      }];

      setFolderStructure(structure);
      
      // Expandir automáticamente Recepcion/Muestreo
      setExpandedFolders(new Set(['recepcion-muestreo']));
      
    } catch (error) {
      console.error('Error construyendo estructura de carpetas:', error);
    }
  };

  const toggleFolder = (folderId) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFolderClick = (folder) => {
    if (folder.type === 'folder' || folder.type === 'group') {
      onFolderSelect(folder);
      // Si es un grupo con hijos, también expandir/colapsar
      if (folder.type === 'group') {
        toggleFolder(folder.id);
      }
    }
  };

  const renderFolder = (folder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const isSelected = selectedFolder && selectedFolder.id === folder.id;
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id} className="folder-item-container">
        <div 
          className={`folder-item ${isSelected ? 'selected' : ''} ${folder.type}`}
          style={{ paddingLeft: `${12 + (level * 20)}px` }}
          onClick={() => handleFolderClick(folder)}
        >
          <div className="folder-icon">
            {hasChildren ? (
              <span className={`expand-icon ${isExpanded ? 'expanded' : ''}`}>
                ▶
              </span>
            ) : (
              <span className="folder-icon-symbol">📁</span>
            )}
          </div>
          <span className="folder-name">{folder.name}</span>
          {folder.type === 'group' && (
            <span className="folder-count">
              ({folder.fileCount || 0} archivo{(folder.fileCount || 0) !== 1 ? 's' : ''})
            </span>
          )}
        </div>
        
        {hasChildren && isExpanded && (
          <div className="folder-children">
            {folder.children.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="folder-explorer">
        <div className="loading">
          <p>Cargando estructura de carpetas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="folder-explorer">
      <div className="folder-structure">
        {folderStructure.length > 0 ? (
          folderStructure.map(folder => renderFolder(folder))
        ) : (
          <div className="no-folders">
            <p>No se encontraron carpetas accesibles</p>
          </div>
        )}
      </div>
      
      {selectedFolder && (
        <div className="selection-info">
          <p>📂 {selectedFolder.name}</p>
          <small>{selectedFolder.path}</small>
        </div>
      )}
    </div>
  );
};

export default FolderExplorer;
