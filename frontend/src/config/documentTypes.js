/**
 * Configuración de tipos de documento y sus descripciones
 * Relación entre códigos de tipología y sus descripciones correspondientes
 */

export const DOCUMENT_TYPES = {
  // Cartas de Cobros
  'C101': 'Cartas de Cobros',
  'C102': 'Cartas de Cobros',
  'C103': 'Cartas de Cobros',
  'C104': 'Cartas de Cobros',
  'C105': 'Cartas de Cobros',
  'C107': 'Cartas de Cobros',
  'C109': 'Cartas de Cobros',
  'C110': 'Cartas de Cobros',
  'C111': 'Cartas de Cobros',
  'C112': 'Cartas de Cobros',
  'C113': 'Cartas de Cobros',
  'C114': 'Cartas de Cobros',
  'C015': 'Cartas de Cobros',
  'C117': 'Cartas de Cobros',
  'C120': 'Cartas de Cobros',
  'C121': 'Cartas de Cobros',
  'C124': 'Cartas de Cobros',
  'C125': 'Cartas de Cobros',
  'C126': 'Cartas de Cobros',
  'C132': 'Cartas de Cobros',
  'C144': 'Cartas de Cobros',
  'C301': 'Cartas de Cobros',
  'C302': 'Cartas de Cobros',
  'C303': 'Cartas de Cobros',
  'C304': 'Cartas de Cobros',
  'C308': 'Cartas de Cobros',
  'C309': 'Cartas de Cobros',
  'C310': 'Cartas de Cobros',
  'C312': 'Cartas de Cobros',
  
  // Cartas de Contratación
  'G035': 'Cartas de Contratación',
  'G036': 'Cartas de Contratación',
  'G037': 'Cartas de Contratación',
  'G340': 'Cartas de Contratación',
  'G350': 'Cartas de Contratación',
  'G351': 'Cartas de Contratación',
  
  // Cartas de Vulnerabilidad
  'G345': 'Cartas de Vulnerabilidad',
  'G346': 'Cartas de Vulnerabilidad',
  'G347': 'Cartas de Vulnerabilidad',
  'G348': 'Cartas de Vulnerabilidad',
  'G349': 'Cartas de Vulnerabilidad',
  
  // Contratos
  'G013': 'Contratos',
  'G311': 'Contratos',
  
  // Facturas
  'F301': 'Facturas',
  'F302': 'Facturas',
  'F303': 'Facturas',
  'F304': 'Facturas',
  'F305': 'Facturas',
  'F306': 'Facturas',
  'F307': 'Facturas',
  'F308': 'Facturas',
  'F309': 'Facturas',
  'F310': 'Facturas',
  'F311': 'Facturas',
  'F312': 'Facturas',
  'F313': 'Facturas',
  'F314': 'Facturas',
  'F351': 'Facturas',
  'F352': 'Facturas',
  'F353': 'Facturas',
  'F354': 'Facturas',
  'F365': 'Facturas',
  'F366': 'Facturas',
  'F367': 'Facturas',
  'F368': 'Facturas',
  'F363': 'Facturas',
  'F364': 'Facturas',
  'F369': 'Facturas',
  'F370': 'Facturas',
  'OOEE': 'Facturas'
};

/**
 * Obtener la descripción de un tipo de documento
 * @param {string} documentType - Código del tipo de documento (ej: 'C101')
 * @returns {string} Descripción del tipo de documento
 */
export const getDocumentTypeDescription = (documentType) => {
  return DOCUMENT_TYPES[documentType] || 'Tipo desconocido';
};

/**
 * Obtener el texto completo para mostrar (código + descripción)
 * @param {string} documentType - Código del tipo de documento (ej: 'C101')
 * @returns {string} Texto completo: "C101 - Cartas de Cobros"
 */
export const getDocumentTypeDisplay = (documentType) => {
  const description = getDocumentTypeDescription(documentType);
  return `${documentType} - ${description}`;
};

/**
 * Verificar si un tipo de documento es válido
 * @param {string} documentType - Código del tipo de documento
 * @returns {boolean} True si el tipo es válido
 */
export const isValidDocumentType = (documentType) => {
  return documentType && DOCUMENT_TYPES.hasOwnProperty(documentType);
};

/**
 * Obtener todos los tipos de documento por categoría
 * @returns {object} Objeto agrupado por categorías
 */
export const getDocumentTypesByCategory = () => {
  const categories = {};
  
  Object.entries(DOCUMENT_TYPES).forEach(([code, description]) => {
    if (!categories[description]) {
      categories[description] = [];
    }
    categories[description].push(code);
  });
  
  return categories;
};
