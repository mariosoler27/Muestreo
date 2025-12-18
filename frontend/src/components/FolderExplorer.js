import React, { useState, useEffect } from 'react';
import { getFolders } from '../services/api';

const FolderExplorer = ({ onFolderSelect, selectedFolder, loading: parentLoading, refreshKey }) => {
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [folderStructure, setFolderStructure] = useState([]);
  const [userAuthorization, setUserAuthorization] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar autorización del usuario al montar el componente
  useEffect(() => {
    loadUserFolders();
  }, []);

  // Recargar cuando cambie el refreshKey (cambio de bucket)
  useEffect(() => {
    if (refreshKey) {
      loadUserFolders();
    }
  }, [refreshKey]);

  const loadUserFolders = async () => {
    try {
      setLoading(true);
      const response = await getFolders();
      
      setUserAuthorization({
        basePath: response.basePath,
        folders: response.folders
      });
      
      buildFolderStructure(response);
    } catch (error) {
      console.error('Error cargando carpetas:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildFolderStructure = (response) => {
    const { basePath, folders } = response;
    
    // Extraer el nombre del grupo de la ruta base (última parte)
    const groupName = basePath.split('/').pop();
    
    // Crear estructura de carpetas
    const structure = [{
      id: groupName.toLowerCase(),
      name: groupName,
      path: basePath,
      type: 'group',
      children: folders.map(folder => ({
        id: folder.name.toLowerCase(),
        name: folder.name,
        path: folder.path,
        type: 'folder',
        parent: groupName.toLowerCase()
      }))
    }];

    setFolderStructure(structure);
    
    // Expandir automáticamente el grupo principal
    setExpandedFolders(new Set([groupName.toLowerCase()]));
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
    if (folder.type === 'folder') {
      onFolderSelect(folder);
    } else if (folder.type === 'group') {
      toggleFolder(folder.id);
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
              ({folder.children.length})
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
        <div className="explorer-header">
          <h2>📁 Carpetas</h2>
        </div>
        <div className="loading">
          <p>Cargando estructura de carpetas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="folder-explorer">
      <div className="explorer-header">
        <h2>📁 Carpetas</h2>
        {userAuthorization && (
          <div className="auth-info">
            <span className="auth-path">{userAuthorization.basePath.split('/').pop()}</span>
          </div>
        )}
      </div>
      
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
