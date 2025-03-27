
const fs = require("fs");
const path = require("path");
const pool = require("./connection");

const schemaPath = path.resolve(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf8");

pool.query(schema)
  .then(() => {
    console.log("Tabelas criadas com sucesso!");
    process.exit();
  })
  .catch((err) => {
    console.error("Erro ao criar tabelas:", err);
    process.exit(1);
  });
