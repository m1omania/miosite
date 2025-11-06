const path = require('path');
const fs = require('fs');

// От app/page.tsx
const from1 = path.resolve(__dirname, '../../shared/types.ts');
console.log('От app/page.tsx:', from1, fs.existsSync(from1) ? '✅' : '❌');

// От app/report/[id]/page.tsx  
const from2 = path.resolve(__dirname, '../report/[id]/../../../../shared/types.ts');
console.log('От app/report/[id]/page.tsx:', from2, fs.existsSync(from2) ? '✅' : '❌');

// Правильный путь
const from3 = path.resolve(__dirname, '../report/[id]/../../../shared/types.ts');
console.log('Правильный путь:', from3, fs.existsSync(from3) ? '✅' : '❌');
