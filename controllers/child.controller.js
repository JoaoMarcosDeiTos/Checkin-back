// controllers/child.controller.js
const db = require("../database");
const calculateAge = require("../utils/calculateAge");

exports.createChildWithResponsibles = (req, res) => {
  const {
    nome,
    data_nascimento,
    responsavel_principal_cpf,
    sub_responsaveis_cpfs = [],
  } = req.body;

  db.get(
    `SELECT id FROM responsaveis WHERE cpf = ?`,
    [responsavel_principal_cpf],
    (err, responsavelRow) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!responsavelRow) {
        return res
          .status(404)
          .json({ error: "Responsável principal não encontrado." });
      }

      const responsavel_principal_id = responsavelRow.id;

      db.run(
        `INSERT INTO criancas (nome, data_nascimento) VALUES (?, ?)`,
        [nome, data_nascimento],
        function (err) {
          if (err) return res.status(400).json({ error: err.message });

          const crianca_id = this.lastID;

          db.run(
            `INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES (?, ?, 'principal')`,
            [responsavel_principal_id, crianca_id],
            function (err) {
              if (err) return res.status(400).json({ error: err.message });

              if (!sub_responsaveis_cpfs.length) {
                return res.json({
                  id: crianca_id,
                  mensagem: "Criança cadastrada com sucesso.",
                });
              }

              processarSubResponsaveis(0);

              function processarSubResponsaveis(index) {
                if (index >= sub_responsaveis_cpfs.length) {
                  return res.json({
                    id: crianca_id,
                    mensagem: "Criança cadastrada e todos os vínculos criados.",
                  });
                }

                const cpfSub = sub_responsaveis_cpfs[index];
                db.get(
                  `SELECT id FROM responsaveis WHERE cpf = ?`,
                  [cpfSub],
                  (err, row) => {
                    if (err || !row) return processarSubResponsaveis(index + 1);

                    db.run(
                      `INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES (?, ?, 'sub')`,
                      [row.id, crianca_id],
                      () => processarSubResponsaveis(index + 1)
                    );
                  }
                );
              }
            }
          );
        }
      );
    }
  );
};

exports.createChildrenBatch = (req, res) => {
  const children = req.body;

  if (!Array.isArray(children) || children.length === 0) {
    return res.status(400).json({ error: "Envie um array de crianças" });
  }

  const resultados = [];
  let index = 0;

  function processarCrianca() {
    if (index >= children.length) {
      return res.json({
        mensagem: "Crianças processadas",
        resultados,
      });
    }

    const { nome, data_nascimento, responsavel_cpf } = children[index];

    if (!nome || !data_nascimento || !responsavel_cpf) {
      resultados.push({
        nome,
        status: "erro",
        motivo: "Dados obrigatórios ausentes",
      });
      index++;
      return processarCrianca();
    }

    // Busca os responsáveis com base no CPF informado, utilizando o campo is_principal para definir o tipo
    const buscarFamiliaresQuery = `
      SELECT DISTINCT r.id, r.cpf,
        CASE WHEN r.is_principal = 1 THEN 'principal' ELSE 'sub' END AS tipo
      FROM responsaveis r
      WHERE r.cpf = ?
         OR r.id IN (
           SELECT sub_responsavel_id 
           FROM responsavel_principal_sub 
           WHERE responsavel_principal_id = (SELECT id FROM responsaveis WHERE cpf = ?)
         )
         OR r.id IN (
           SELECT responsavel_principal_id 
           FROM responsavel_principal_sub 
           WHERE sub_responsavel_id = (SELECT id FROM responsaveis WHERE cpf = ?)
         )
    `;

    db.all(
      buscarFamiliaresQuery,
      [responsavel_cpf, responsavel_cpf, responsavel_cpf],
      (err, responsaveis) => {
        if (err || !responsaveis.length) {
          resultados.push({
            nome,
            status: "erro",
            motivo: "Nenhum responsável encontrado com o CPF fornecido",
          });
          index++;
          return processarCrianca();
        }

        // Insere a criança
        db.run(
          `INSERT INTO criancas (nome, data_nascimento) VALUES (?, ?)`,
          [nome, data_nascimento],
          function (err) {
            if (err) {
              resultados.push({
                nome,
                status: "erro",
                motivo: "Erro ao inserir criança",
              });
              index++;
              return processarCrianca();
            }

            const crianca_id = this.lastID;
            let respIndex = 0;

            // Vincula cada responsável encontrado à criança, utilizando o tipo correto
            function vincularResponsaveis() {
              if (respIndex >= responsaveis.length) {
                resultados.push({
                  nome,
                  status: "ok",
                  crianca_id,
                  mensagem:
                    "Criança cadastrada com sucesso com vínculos familiares",
                });
                index++;
                return processarCrianca();
              }

              const resp = responsaveis[respIndex++];
              db.run(
                `INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES (?, ?, ?)`,
                [resp.id, crianca_id, resp.tipo],
                (err) => {
                  // Continua vinculando mesmo que ocorra algum erro
                  vincularResponsaveis();
                }
              );
            }

            vincularResponsaveis();
          }
        );
      }
    );
  }

  processarCrianca();
};

exports.listChildrenByCpf = (req, res) => {
  const { cpf_responsavel } = req.query;
  if (!cpf_responsavel) {
    return res.status(400).json({ error: "CPF do responsável é necessário" });
  }

  const query = `
    SELECT DISTINCT c.*
    FROM criancas c
    JOIN responsavel_crianca rc ON c.id = rc.crianca_id
    JOIN responsaveis r ON rc.responsavel_id = r.id
    LEFT JOIN responsavel_principal_sub rps ON r.id = rps.responsavel_principal_id
    LEFT JOIN responsaveis sub ON rps.sub_responsavel_id = sub.id
    WHERE r.cpf = ? OR sub.cpf = ?
  `;

  db.all(query, [cpf_responsavel, cpf_responsavel], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });

    const criancas = rows.map((c) => ({
      ...c,
      idade: calculateAge(c.data_nascimento),
    }));

    res.json(criancas);
  });
};

exports.updateChild = (req, res) => {
  const crianca_id = req.params.id;
  const { nome, data_nascimento } = req.body;

  db.run(
    `UPDATE criancas SET nome = ?, data_nascimento = ? WHERE id = ?`,
    [nome, data_nascimento, crianca_id],
    function (err) {
      if (err) return res.status(400).json({ error: err.message });
      if (this.changes === 0) {
        return res.status(404).json({ error: "Criança não encontrada" });
      }
      res.json({ atualizado: true });
    }
  );
};

exports.deleteChild = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM criancas WHERE id = ?`, [id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Criança não encontrada" });
    }

    res.json({ deleted: true });
  });
};
