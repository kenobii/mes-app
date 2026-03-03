const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'mes.db');
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Banco de dados removido. Execute npm run migrate para recriar.');
} else {
  console.log('Nenhum banco encontrado.');
}
