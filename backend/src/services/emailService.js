const nodemailer = require('nodemailer');

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function sendTempPasswordEmail(to, name, password) {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASS;
  if (!user || !pass) {
    console.warn('GMAIL_USER / GMAIL_PASS não configurados. Email não enviado.');
    return false;
  }
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
  await transporter.sendMail({
    from: `"Dados Operacionais" <${user}>`,
    to,
    subject: 'Seu acesso ao Dados Operacionais',
    html: `
      <p>Olá, <strong>${name}</strong>!</p>
      <p>Sua conta foi criada no sistema <strong>Dados Operacionais</strong>.</p>
      <p>Sua senha temporária é: <strong style="font-size:18px;letter-spacing:2px">${password}</strong></p>
      <p>Você deverá alterá-la no primeiro acesso.</p>
    `,
  });
  return true;
}

module.exports = { generateTempPassword, sendTempPasswordEmail };
