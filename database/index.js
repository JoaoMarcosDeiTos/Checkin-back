// backend/database.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.resolve(__dirname, "../database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  // Tabela Responsáveis
  db.run(`CREATE TABLE IF NOT EXISTS responsaveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    telefone TEXT NOT NULL,
    parentesco TEXT,
    pode_fazer_checkin INTEGER DEFAULT 1,
    is_principal INTEGER DEFAULT 1, -- 1 para responsável principal, 0 para sub-responsável
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela Crianças
  db.run(`CREATE TABLE IF NOT EXISTS criancas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    data_nascimento TEXT NOT NULL,
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP
  )`);

  // Tabela intermediária Responsáveis-Crianças (muitos-para-muitos)
  db.run(`CREATE TABLE IF NOT EXISTS responsavel_crianca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel_id INTEGER NOT NULL,
    crianca_id INTEGER NOT NULL,
    tipo TEXT DEFAULT 'principal', /* 'principal' ou 'sub' */
    data_vinculo TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(responsavel_id) REFERENCES responsaveis(id),
    FOREIGN KEY(crianca_id) REFERENCES criancas(id)
  )`);

  // Tabela para registrar relações entre responsáveis principais e sub-responsáveis
  db.run(`CREATE TABLE IF NOT EXISTS responsavel_principal_sub (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel_principal_id INTEGER NOT NULL,
    sub_responsavel_id INTEGER NOT NULL,
    data_cadastro TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(responsavel_principal_id) REFERENCES responsaveis(id),
    FOREIGN KEY(sub_responsavel_id) REFERENCES responsaveis(id),
    UNIQUE(responsavel_principal_id, sub_responsavel_id)
  )`);

  // Tabela de check-ins
  db.run(`CREATE TABLE IF NOT EXISTS checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    responsavel_id INTEGER NOT NULL,
    data_hora TEXT NOT NULL,
    FOREIGN KEY(responsavel_id) REFERENCES responsaveis(id)
  )`);

  // Tabela de vínculo entre check-in e crianças
  db.run(`CREATE TABLE IF NOT EXISTS checkin_crianca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    checkin_id INTEGER NOT NULL,
    crianca_id INTEGER NOT NULL,
    FOREIGN KEY(checkin_id) REFERENCES checkins(id),
    FOREIGN KEY(crianca_id) REFERENCES criancas(id)
  )`);
});

module.exports = db;
