const fileTypes = {
  // Facturación Electricidad PVPC
  'BIOKTYP001': { descripcion: 'Facturación Electricidad PVPC Horario' },
  'BIOKTYP016': { descripcion: 'Facturación Electricidad PVPC Táctico' },
  
  // Facturación Electricidad Bono Social
  'BIOKTYP002': { descripcion: 'Facturación Electricidad Bono social' },
  
  // Facturación Electricidad Precio Fijo
  'BIOKTYP003': { descripcion: 'Facturación Electricidad Precio Fijo' },
  
  // Facturación Electricidad Transitorio
  'BIOKTYP015': { descripcion: 'Facturación Electricidad Transitorio' },
  
  // Facturación Electricidad Cargos Varios
  'BIOKTYP007': { descripcion: 'Facturación Electricidad Cargos Varios' },
  
  // Facturación Gas
  'BIOKTYP027': { descripcion: 'Facturación Gas RL.1' },
  'BIOKTYP028': { descripcion: 'Facturación Gas RL.2' },
  'BIOKTYP029': { descripcion: 'Facturación Gas RL.3' },
  'BIOKTYP030': { descripcion: 'Facturación Gas Transitorio' },
  'BIOKTYP021': { descripcion: 'Facturación Gas Cargos Varios' },
  'BIOKTYP022': { descripcion: 'Facturación Gas Clientes VIP' },
  
  // Facturas GNCOM y otras
  'F001': { descripcion: 'Facturas GNCOM gas' },
  'F002': { descripcion: 'Facturas GNCOM electricidad' },
  'F003': { descripcion: 'Facturas GNL' },
  'F004': { descripcion: 'Facturas Clientes No Finales' },
  'F401': { descripcion: 'Factura gas de Gas Natural Comercializadora' },
  'F402': { descripcion: 'Factura eléctrica de Gas Natural Comercializadora' },
  
  // Cartas de cobro
  'C001': { descripcion: 'Cartas de cobro' },
  'C002': { descripcion: 'Cartas de cobro' },
  'C003': { descripcion: 'Cartas de cobro' },
  'C003_1': { descripcion: 'Cartas de cobro' },
  'C004': { descripcion: 'Cartas de cobro' },
  'C005': { descripcion: 'Cartas de cobro' },
  'C009': { descripcion: 'Cartas de cobro' },
  'C010': { descripcion: 'Cartas de cobro' },
  'C011': { descripcion: 'Cartas de cobro' },
  'C012': { descripcion: 'Cartas de cobro' },
  'C013': { descripcion: 'Cartas de cobro' },
  'C014': { descripcion: 'Cartas de cobro' },
  'C015': { descripcion: 'Cartas de cobro' },
  'C016': { descripcion: 'Cartas de cobro' },
  'C017': { descripcion: 'Cartas de cobro' },
  'C018': { descripcion: 'Cartas de cobro' },
  'C019': { descripcion: 'Cartas de cobro' },
  'C101': { descripcion: 'Cartas de cobro' },
  'C102': { descripcion: 'Cartas de cobro' },
  'C103': { descripcion: 'Cartas de cobro' },
  'C104': { descripcion: 'Cartas de cobro' },
  'C105': { descripcion: 'Cartas de cobro' },
  'C107': { descripcion: 'Cartas de cobro' },
  'C109': { descripcion: 'Cartas de cobro' },
  'C110': { descripcion: 'Cartas de cobro' },
  'C111': { descripcion: 'Cartas de cobro' },
  'C112': { descripcion: 'Cartas de cobro' },
  'C113': { descripcion: 'Cartas de cobro' },
  'C114': { descripcion: 'Cartas de cobro' },
  'C117': { descripcion: 'Cartas de cobro' },
  'C120': { descripcion: 'Cartas de cobro' },
  'C121': { descripcion: 'Cartas de cobro' },
  'C124': { descripcion: 'Cartas de cobro' },
  'C125': { descripcion: 'Cartas de cobro' },
  'C126': { descripcion: 'Cartas de cobro' },
  'C132': { descripcion: 'Cartas de cobro' },
  'C144': { descripcion: 'Cartas de cobro' },
  'C301': { descripcion: 'Cartas de cobro' },
  'C302': { descripcion: 'Cartas de cobro' },
  'C303': { descripcion: 'Cartas de cobro' },
  'C304': { descripcion: 'Cartas de cobro' },
  'C308': { descripcion: 'Cartas de cobro' },
  'C309': { descripcion: 'Cartas de cobro' },
  'C312': { descripcion: 'Cartas de cobro' },
  'C401': { descripcion: 'Cartas de cobro' },
  'C402': { descripcion: 'Cartas de cobro' },
  
  // Cartas de Contratación
  'G347': { descripcion: 'Cartas de Contratación' },
  'G348': { descripcion: 'Cartas de Contratación' },
  'G349': { descripcion: 'Cartas de Contratación' }
};

// Función para extraer tipología del nombre del archivo
function getFileTypeFromName(fileName) {
  // Buscar patrones típicos en nombres de archivo
  const patterns = Object.keys(fileTypes);
  
  for (const pattern of patterns) {
    if (fileName.includes(pattern)) {
      return {
        tipologia: pattern,
        descripcion: fileTypes[pattern].descripcion
      };
    }
  }
  
  return {
    tipologia: 'UNKNOWN',
    descripcion: 'Tipo de archivo no identificado'
  };
}

module.exports = {
  fileTypes,
  getFileTypeFromName
};
