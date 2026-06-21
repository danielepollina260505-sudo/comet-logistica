'use strict';
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const { authMiddleware } = require('./middleware/auth');

app.use(express.static(path.join(__dirname, '../public')));
app.use('/auth', require('./routes/auth'));
app.use('/api', authMiddleware, require('./routes/api'));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, () => {
  console.log(`\n🚛 COMET LOGISTICA PRO`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   DB: ${process.env.DATABASE_URL ? 'PostgreSQL' : 'NON CONFIGURATO'}`);
  console.log(`   Utenti: ${process.env.ALLOWED_EMAILS}\n`);
});
