DROP TABLE IF EXISTS checkin_crianca;
DROP TABLE IF EXISTS checkins;
DROP TABLE IF EXISTS responsavel_principal_sub;
DROP TABLE IF EXISTS responsavel_crianca;
DROP TABLE IF EXISTS criancas;
DROP TABLE IF EXISTS responsaveis;

CREATE TABLE IF NOT EXISTS responsaveis (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cpf TEXT UNIQUE NOT NULL,
  telefone TEXT NOT NULL,
  parentesco TEXT,
  pode_fazer_checkin BOOLEAN DEFAULT TRUE,
  is_principal BOOLEAN DEFAULT TRUE,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS criancas (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  data_nascimento DATE NOT NULL,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS responsavel_crianca (
  id SERIAL PRIMARY KEY,
  responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  crianca_id INTEGER NOT NULL REFERENCES criancas(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'principal',
  data_vinculo TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (responsavel_id, crianca_id)
);

CREATE TABLE IF NOT EXISTS responsavel_principal_sub (
  id SERIAL PRIMARY KEY,
  responsavel_principal_id INTEGER NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  sub_responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(responsavel_principal_id, sub_responsavel_id)
);

CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  responsavel_id INTEGER NOT NULL REFERENCES responsaveis(id) ON DELETE CASCADE,
  data_hora TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS checkin_crianca (
  id SERIAL PRIMARY KEY,
  checkin_id INTEGER NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  crianca_id INTEGER NOT NULL REFERENCES criancas(id) ON DELETE CASCADE
);
