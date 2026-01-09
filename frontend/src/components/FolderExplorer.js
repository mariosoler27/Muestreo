import React, { useState, useEffect } from 'react';
import { getDocumentGroups, getFilesByFolder } from '../services/api';

const FolderExplorer = ({ onFolderSelect, selectedFolder, loading: parentLoading, refreshKey, activeBucket }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderStructure, setFolderStructure] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar estructura cuando cambie el bucket activo
  useEffect(() => {
    if (activeBucket) {
      loadFolderStructure(activeBucket);
    }
  }, [activeBucket, refreshKey]);

  const loadFolderStructure = async (bucket) => {
    try {
      setLoading(true);
      console.log(`📂 CARGANDO ESTRUCTURA para bucket: ${bucket}`);
      
      const response = await getDocumentGroups(bucket);
      
      if (response.success && response.documentGroups) {
        console.log(`📋 GRUPOS OBTENIDOS:`, response.documentGroups);
        await buildFolderStructure(response.documentGroups);
      }
    } catch (error) {
      console.error('Error cargando estructura de carpetas:', error);
      setFolderStructure([]);
    } finally {
      setLoading(false);
    }
  };

  const buildFolderStructure = async (documentGroups) => {
    try {
      // Procesar cada grupo de documentos
      const subcarpetas = [];
      
      for (const groupPath of documentGroups) {
        try {
          // Extraer nombre de la subcarpeta (ej: "Recepcion/Muestreo/Facturas" -> "Facturas")
          const subcarpetaName = groupPath.split('/').pop();
          
          // Cargar archivos y subcarpetas de este grupo
          const files = await getFilesByFolder(groupPath);
          
          const folders = [];
          let fileCount = 0;
          
          if (files && Array.isArray(files)) {
            const folderSet = new Set();
            
            files.forEach(file => {
              if (file.folder && file.folder !== groupPath) {
                // Es un archivo dentro de una subcarpeta - extraer nombre de la carpeta
                const relativePath = file.folder.replace(groupPath + '/', '');
                const folderName = relativePath.split('/')[0];
                
                if (!folderSet.has(folderName)) {
                  folderSet.add(folderName);
                  folders.push({
                    id: `${subcarpetaName.toLowerCase()}-${folderName.toLowerCase()}`,
                    name: folderName,
                    path: `${groupPath}/${folderName}`,
                    type: 'folder',
                    parent: subcarpetaName.toLowerCase()
                  });
                }
              } else if (file.folder === groupPath) {
                // Es un archivo en el directorio raíz de la subcarpeta - contar
                fileCount++;
              }
            });
          }

          subcarpetas.push({
            id: subcarpetaName.toLowerCase(),
            name: subcarpetaName,
            path: groupPath,
            type: 'group',
            parent: 'recepcion-muestreo',
            children: folders,
            fileCount: fileCount
          });
        } catch (error) {
          console.error(`Error cargando contenido para ${groupPath}:`, error);
          // Añadir subcarpeta vacía si hay error
          const subcarpetaName = groupPath.split('/').pop();
          subcarpetas.push({
            id: subcarpetaName.toLowerCase(),
            name: subcarpetaName,
            path: groupPath,
            type: 'group',
            parent: 'recepcion-muestreo',
            children: [],
            fileCount: 0
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
      
      console.log(`✅ ESTRUCTURA CONSTRUIDA: ${subcarpetas.length} subcarpetas`);
      
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
