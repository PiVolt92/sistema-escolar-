const xlsx = require('xlsx');

const csvContent = `Estudiante,31/03/2026,07/04/2026,14/04/2026,28/04/2026,05/05/2026,12/05/2026,26/05/2026,02/06/2026,16/06/2026,23/06/2026,07/07/2026,11/08/2026,18/08/2026,25/08/2026,01/09/2026,15/09/2026,29/09/2026,06/10/2026,13/10/2026,27/10/2026,03/11/2026
JANNON MATEO,P,P,P,P,P,A,P,A,P,P,A,P,P,P,P,P,P,P,P,P,P
LAVIN LARA,P,P,P,P,P,P,P,A,P,P,A,A,A,P,P,A,A,P,P,A,A
OJEDA PAULA,P,P,P,A,P,P,P,A,P,P,P,P,A,A,P,A,P,P,P,P,P
ORTIZ LEANDRO EZEQUIEL,P,P,P,A,P,P,P,P,P,P,P,A,P,P,P,P,A,A,A,P,P
PEREZ AGUSTINA,P,P,P,P,A,P,P,P,P,P,A,P,A,A,P,P,A,P,A,A,A
PEREZ VALENTINO ,P,P,A,P,P,A,A,P,P,A,P,A,P,A,A,P,A,P,P,P,P
SACCO BRUNO AGUSTIN,P,P,A,P,P,P,P,P,P,P,A,A,P,P,P,P,P,P,P,P,P
SALINAS RUIZ AXEL URIEL,P,P,P,P,P,P,P,P,P,P,A,P,P,P,P,P,A,P,P,P,P
SOLA ROMAN,P,A,P,P,P,P,P,P,P,P,P,P,A,A,P,A,P,A,P,P,P
TABELA,A,A,A,A,A,A,P,A,A,A,A,A,A,A,A,A,A,A,A,A,A
TAHUIL MATEO ELIAS,P,P,P,P,P,P,P,P,P,P,A,A,P,P,A,P,A,P,P,P,P
TOCCI TOBIA,A,P,P,P,P,P,P,P,P,A,A,A,P,P,A,P,A,P,P,P,P
VILLAGRA LAUTARO EZEQUIEL,P,P,P,P,P,A,P,P,P,P,P,A,P,P,P,P,A,P,A,P,P`;

// Now let's test what happens when FileReader reads as ArrayBuffer in browser:
// XLSX.read(new Uint8Array(buffer), { type: 'array' })
const buffer = Buffer.from(csvContent, 'utf8');
const array = new Uint8Array(buffer);

try {
  const wb = xlsx.read(array, { type: 'array' });
  console.log('SheetNames:', wb.SheetNames);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  console.log('Total rawRows from ArrayBuffer:', rawRows.length);
  console.log('Row 0:', rawRows[0]);
  console.log('Row 1:', rawRows[1]);
  console.log('Row 10 (TABELA):', rawRows[10]);
} catch (e) {
  console.error('Error reading array:', e.message);
}
