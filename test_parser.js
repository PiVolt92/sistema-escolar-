// test_parser.js
const xlsx = require('xlsx');

function parseRosterRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return { error: 'La planilla está vacía.' };

  // 1. Detect header row
  let headerRowIdx = -1;
  let colApellido = -1;
  let colNombre = -1;
  let colNombreCompleto = -1;
  let colDni = -1;

  for (let r = 0; r < Math.min(25, rawRows.length); r++) {
    const row = rawRows[r];
    if (!row || !Array.isArray(row)) continue;

    let foundInThisRow = 0;
    let tempAp = -1, tempNom = -1, tempFull = -1, tempDni = -1;

    for (let c = 0; c < row.length; c++) {
      const val = String(row[c] || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents

      if (val.includes('apellido y nombre') || val.includes('nombre y apellido') || 
          val.includes('estudiante') || val.includes('alumno') || 
          val.includes('nomina') || val.includes('nombre completo') || val === 'datos') {
        tempFull = c;
        foundInThisRow++;
      } else if (val === 'apellido' || val === 'apellidos') {
        tempAp = c;
        foundInThisRow++;
      } else if (val === 'nombre' || val === 'nombres') {
        tempNom = c;
        foundInThisRow++;
      } else if (val.includes('dni') || val.includes('documento') || val.includes('cedula') || val.includes('legajo')) {
        tempDni = c;
        foundInThisRow++;
      }
    }

    if (foundInThisRow > 0) {
      headerRowIdx = r;
      colApellido = tempAp;
      colNombre = tempNom;
      colNombreCompleto = tempFull;
      colDni = tempDni;
      break;
    }
  }

  // 2. If no explicit header was found, auto-detect by column data types
  const startRow = headerRowIdx !== -1 ? headerRowIdx + 1 : 0;

  if (colNombreCompleto === -1 && (colApellido === -1 || colNombre === -1)) {
    // Scan sample rows to find text columns vs number columns
    const colScores = {};
    for (let r = startRow; r < Math.min(startRow + 20, rawRows.length); r++) {
      const row = rawRows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const val = String(row[c] || '').trim();
        if (!colScores[c]) colScores[c] = { textLen: 0, hasSpaces: 0, isNum: 0, isDni: 0 };
        if (/^\d{7,9}$/.test(val.replace(/\./g, ''))) {
          colScores[c].isDni++;
        } else if (/^\d+$/.test(val)) {
          colScores[c].isNum++;
        } else if (val.length >= 3 && /[a-zA-ZáéíóúñÁÉÍÓÚÑ]/.test(val)) {
          colScores[c].textLen += val.length;
          if (val.includes(' ') || val.includes(',')) colScores[c].hasSpaces++;
        }
      }
    }

    // Best DNI column
    let bestDniCol = -1, maxDniScore = 0;
    // Best Full Name column
    let bestNameCol = -1, maxNameScore = 0;

    Object.keys(colScores).forEach(cStr => {
      const c = parseInt(cStr, 10);
      const s = colScores[c];
      if (s.isDni > maxDniScore) {
        maxDniScore = s.isDni;
        bestDniCol = c;
      }
      const nameScore = s.hasSpaces * 3 + s.textLen;
      if (nameScore > maxNameScore) {
        maxNameScore = nameScore;
        bestNameCol = c;
      }
    });

    if (colDni === -1 && bestDniCol !== -1) colDni = bestDniCol;
    if (colNombreCompleto === -1 && bestNameCol !== -1) colNombreCompleto = bestNameCol;
  }

  // Default fallback if still not found
  if (colNombreCompleto === -1 && colApellido === -1) {
    colNombreCompleto = 0;
  }

  // 3. Extract students
  const estudiantes = [];

  for (let r = startRow; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;

    let apellido = '';
    let nombre = '';
    let dni = colDni !== -1 ? String(row[colDni] || '').trim() : '';

    if (colApellido !== -1 && colNombre !== -1) {
      apellido = String(row[colApellido] || '').trim();
      nombre = String(row[colNombre] || '').trim();
    } else {
      const targetCol = colNombreCompleto !== -1 ? colNombreCompleto : (colApellido !== -1 ? colApellido : 0);
      const fullText = String(row[targetCol] || '').trim();
      if (!fullText) continue;

      // Filter out footer rows
      const lower = fullText.toLowerCase();
      if (lower.includes('total') || lower.includes('promedio') || lower.includes('presentes') || 
          lower.includes('ausentes') || lower.includes('observaciones') || lower.includes('firma')) {
        continue;
      }

      // If fullText is purely a number (like an order number 1, 2, 3), skip
      if (/^\d+$/.test(fullText)) continue;

      if (fullText.includes(',')) {
        const parts = fullText.split(',');
        apellido = parts[0].trim();
        nombre = parts.slice(1).join(' ').trim();
      } else {
        const words = fullText.split(/\s+/).filter(Boolean);
        if (words.length <= 1) {
          apellido = words[0] || '';
          nombre = '-';
        } else if (words.length === 2) {
          apellido = words[0];
          nombre = words[1];
        } else {
          // Check common Argentine compound surname prefixes
          const compoundPrefixes = ['de', 'del', 'de la', 'de los', 'di', 'san', 'santa'];
          const firstTwo = (words[0] + ' ' + words[1]).toLowerCase();
          if (compoundPrefixes.includes(words[0].toLowerCase())) {
            apellido = words.slice(0, 2).join(' ');
            nombre = words.slice(2).join(' ');
          } else if (compoundPrefixes.includes(firstTwo)) {
            apellido = words.slice(0, 3).join(' ');
            nombre = words.slice(3).join(' ');
          } else {
            apellido = words[0];
            nombre = words.slice(1).join(' ');
          }
        }
      }
    }

    // Clean strings
    apellido = apellido.replace(/^[,;.\s]+|[,;.\s]+$/g, '').toUpperCase();
    nombre = nombre.replace(/^[,;.\s]+|[,;.\s]+$/g, '').toUpperCase();
    dni = dni.replace(/[^0-9]/g, '');

    if (apellido && apellido !== '-') {
      if (!nombre || nombre === '-') nombre = ' ';
      estudiantes.push({ apellido, nombre, dni });
    }
  }

  return { estudiantes, colApellido, colNombre, colNombreCompleto, colDni, headerRowIdx };
}

// Test with tricky layouts
console.log('Test 1 (Order #, Name, DNI):');
const mock1 = [
  ['N°', 'Apellido y Nombre', 'DNI'],
  [1, 'GARCIA, JUAN CARLOS', '45.123.456'],
  [2, 'IBARRA SEBASTIAN', '45.987.654'],
  [3, 'PEREZ', '44.000.111'],
  ['TOTAL', 3, '']
];
console.log(parseRosterRows(mock1));

console.log('Test 2 (Separate Apellido, Nombre, DNI):');
const mock2 = [
  ['ID', 'Apellido', 'Nombre', 'DNI'],
  [1, 'ALVAREZ', 'MATEO', '45123456'],
  [2, 'DE LA VEGA', 'LUCAS', '45678901']
];
console.log(parseRosterRows(mock2));

console.log('Test 3 (No header row, started with numbers in col 0):');
const mock3 = [
  [1, 'GONZALES JUAN', '44123123'],
  [2, 'MARTINEZ CAMILA', '44444555']
];
console.log(parseRosterRows(mock3));
