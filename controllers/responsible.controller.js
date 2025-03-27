const db = require("../database");
const calculateAge = require("../utils/calculateAge");

exports.createResponsible = (req, res) => {
  const { nome, cpf, telefone, parentesco, pode_fazer_checkin = 1 } = req.body;

  db.get(`SELECT id FROM responsaveis WHERE cpf = ?`, [cpf], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });

    if (row) {
      return res.status(409).json({ error: "CPF já cadastrado" });
    }

    db.run(
      `INSERT INTO responsaveis (nome, cpf, telefone, parentesco, pode_fazer_checkin, is_principal) VALUES (?, ?, ?, ?, ?, 1)`,
      [nome, cpf, telefone, parentesco, pode_fazer_checkin ? 1 : 0],
      function (err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID });
      }
    );
  });
};

exports.findResponsibleByCpf = (req, res) => {
  const { cpf } = req.query;

  if (!cpf) {
    return res.status(400).json({ error: "CPF é necessário" });
  }

  db.get(`SELECT * FROM responsaveis WHERE cpf = ?`, [cpf], (err, row) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!row)
      return res.status(404).json({ error: "Responsável não encontrado" });

    res.json(row);
  });
};

exports.findResponsiblesByCpf = (req, res) => {
  const { cpf } = req.query;

  if (!cpf) {
    return res.status(400).json({ error: "CPF é necessário" });
  }

  const query = `
    SELECT r.*
    FROM responsaveis r
    LEFT JOIN responsavel_principal_sub rps ON r.id = rps.sub_responsavel_id
    LEFT JOIN responsaveis rp ON rp.id = rps.responsavel_principal_id
    WHERE rp.cpf = ? OR r.cpf = ?
  `;

  db.all(query, [cpf, cpf], (err, rows) => {
    if (err) return res.status(400).json({ error: err.message });

    if (!rows || rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Nenhum responsável encontrado para este CPF" });
    }

    res.json(rows);
  });
};

exports.updateResponsible = (req, res) => {
  const responsavel_id = req.params.id;
  const { nome, cpf, telefone, parentesco, pode_fazer_checkin } = req.body;

  db.get(
    `SELECT id FROM responsaveis WHERE cpf = ? AND id != ?`,
    [cpf, responsavel_id],
    (err, row) => {
      if (err) return res.status(400).json({ error: err.message });

      if (row) {
        return res
          .status(409)
          .json({ error: "CPF já cadastrado para outro responsável" });
      }

      const podeCheckin =
        pode_fazer_checkin !== undefined ? (pode_fazer_checkin ? 1 : 0) : 1;

      db.run(
        `UPDATE responsaveis SET nome = ?, cpf = ?, telefone = ?, parentesco = ?, pode_fazer_checkin = ? WHERE id = ?`,
        [nome, cpf, telefone, parentesco, podeCheckin, responsavel_id],
        function (err) {
          if (err) return res.status(400).json({ error: err.message });
          if (this.changes === 0)
            return res
              .status(404)
              .json({ error: "Responsável não encontrado" });

          res.json({ atualizado: true });
        }
      );
    }
  );
};

exports.createAndLinkSubResponsible = (req, res) => {
  const {
    nome,
    cpf,
    telefone,
    parentesco,
    pode_fazer_checkin = 1,
    criador_id, // ID ou CPF de quem está criando o sub
    criador_cpf,
  } = req.body;

  if (!criador_id && !criador_cpf) {
    return res.status(400).json({
      error:
        "É necessário informar o ID ou CPF de quem está criando o novo sub",
    });
  }

  // 1) Verifica se o CPF do novo sub já existe
  db.get(
    `SELECT id FROM responsaveis WHERE cpf = ?`,
    [cpf],
    (err, existingResp) => {
      if (err) return res.status(400).json({ error: err.message });
      if (existingResp) {
        return res
          .status(409)
          .json({ error: "CPF já cadastrado para outro responsável" });
      }

      // 2) Função que retorna o ID do principal real
      const obterPrincipalReal = (idOuCpf, callback) => {
        // Pode receber ID ou CPF; determine se é ID ou CPF
        const campo = typeof idOuCpf === "number" ? "id" : "cpf";
        db.get(
          `SELECT id, is_principal FROM responsaveis WHERE ${campo} = ?`,
          [idOuCpf],
          (err, row) => {
            if (err) return res.status(400).json({ error: err.message });
            if (!row) {
              return res
                .status(404)
                .json({ error: `Responsável não encontrado (${campo})` });
            }

            if (row.is_principal === 1) {
              // Achamos o principal real
              callback(row.id);
            } else {
              // Se não é principal, busque na tabela responsavel_principal_sub
              // quem é o principal dele. Aqui assumimos que cada sub tem apenas 1 principal
              db.get(
                `SELECT responsavel_principal_id FROM responsavel_principal_sub WHERE sub_responsavel_id = ?`,
                [row.id],
                (err, vinculo) => {
                  if (err) return res.status(400).json({ error: err.message });
                  if (!vinculo) {
                    // Se não encontrou, significa que esse sub não está vinculado a ninguém
                    return res.status(409).json({
                      error: "Este sub não está vinculado a um principal.",
                    });
                  }
                  // Chama a função novamente para subir na hierarquia
                  obterPrincipalReal(
                    vinculo.responsavel_principal_id,
                    callback
                  );
                }
              );
            }
          }
        );
      };

      // 3) Busca o principal real a partir de quem está criando
      const idOuCpfCriador = criador_id ? Number(criador_id) : criador_cpf; // decide se é ID ou CPF
      obterPrincipalReal(idOuCpfCriador, (principalId) => {
        // Agora principalId é realmente is_principal=1

        // Exemplo: verificação father/mother duplicado (se quiser)
        // ... (caso precise checar se já existe father ou mother)

        // 4) Cria o novo sub
        db.run(
          `INSERT INTO responsaveis (nome, cpf, telefone, parentesco, pode_fazer_checkin, is_principal)
         VALUES (?, ?, ?, ?, ?, 0)`,
          [nome, cpf, telefone, parentesco, pode_fazer_checkin ? 1 : 0],
          function (err) {
            if (err) return res.status(400).json({ error: err.message });
            const novoSubRespId = this.lastID;

            // 5) Vincula ao principal real
            db.run(
              `INSERT INTO responsavel_principal_sub (responsavel_principal_id, sub_responsavel_id)
             VALUES (?, ?)`,
              [principalId, novoSubRespId],
              function (err) {
                if (err) {
                  console.error(
                    "Erro ao vincular sub-responsável ao principal:",
                    err
                  );
                  return res.status(400).json({ error: err.message });
                }

                // 6) Se quiser vincular as crianças do principal ao novo sub
                db.all(
                  `SELECT crianca_id FROM responsavel_crianca WHERE responsavel_id = ?`,
                  [principalId],
                  (err, criancasRows) => {
                    if (err)
                      return res.status(400).json({ error: err.message });

                    if (criancasRows.length === 0) {
                      return res.json({
                        id: novoSubRespId,
                        mensagem:
                          "Sub-responsável cadastrado e vinculado ao principal, mas o principal não possui crianças vinculadas",
                      });
                    }

                    let criancasSemVinculo = [];
                    let criancasComVinculo = [];

                    const vincularUmaPorUma = (index) => {
                      if (index >= criancasRows.length) {
                        return res.json({
                          id: novoSubRespId,
                          mensagem:
                            criancasComVinculo.length > 0
                              ? `Sub-responsável cadastrado e vinculado a ${criancasComVinculo.length} crianças`
                              : "Sub cadastrado mas não vinculado a nenhuma criança",
                          criancas_vinculadas: criancasComVinculo,
                          criancas_sem_vinculo: criancasSemVinculo,
                        });
                      }

                      const crianca_id = criancasRows[index].crianca_id;
                      // Exemplo: checar limites father/mother
                      // ...
                      db.run(
                        `INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo)
                       VALUES (?, ?, 'sub')`,
                        [novoSubRespId, crianca_id],
                        (err) => {
                          if (err) {
                            criancasSemVinculo.push({
                              id: crianca_id,
                              motivo: "Erro ao criar vínculo",
                            });
                          } else {
                            criancasComVinculo.push(crianca_id);
                          }
                          vincularUmaPorUma(index + 1);
                        }
                      );
                    };

                    vincularUmaPorUma(0);
                  }
                );
              }
            );
          }
        );
      });
    }
  );
};

exports.listChildrenByResponsible = (req, res) => {
  const cpf = req.params.cpf;

  db.get(
    `SELECT id, nome, parentesco FROM responsaveis WHERE cpf = ?`,
    [cpf],
    (err, responsavel) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!responsavel) {
        return res
          .status(404)
          .json({ error: "Responsável não encontrado com este CPF" });
      }

      const responsavel_id = responsavel.id;

      db.all(
        `SELECT c.id, c.nome, c.data_nascimento, rc.tipo AS tipo_vinculo
         FROM criancas c
         JOIN responsavel_crianca rc ON c.id = rc.crianca_id
         WHERE rc.responsavel_id = ?`,
        [responsavel_id],
        (err, criancasDiretas) => {
          if (err) return res.status(400).json({ error: err.message });

          db.all(
            `SELECT rps.responsavel_principal_id
             FROM responsavel_principal_sub rps
             WHERE rps.sub_responsavel_id = ?`,
            [responsavel_id],
            (err, respPrincipais) => {
              if (err) return res.status(400).json({ error: err.message });

              if (respPrincipais.length === 0) {
                const criancasComIdade = criancasDiretas.map((c) => ({
                  ...c,
                  idade: calculateAge(c.data_nascimento),
                }));

                return res.json({
                  responsavel,
                  criancas: criancasComIdade,
                  total: criancasComIdade.length,
                  tipo: "direto",
                });
              }

              let principaisIds = respPrincipais.map(
                (r) => r.responsavel_principal_id
              );
              let placeholders = principaisIds.map(() => "?").join(",");

              db.all(
                `SELECT c.id, c.nome, c.data_nascimento, 'principal_vinculado' AS tipo_vinculo
                 FROM criancas c
                 JOIN responsavel_crianca rc ON c.id = rc.crianca_id
                 WHERE rc.responsavel_id IN (${placeholders})
                 AND rc.tipo = 'principal'
                 AND c.id NOT IN (
                   SELECT crianca_id FROM responsavel_crianca WHERE responsavel_id = ?
                 )`,
                [...principaisIds, responsavel_id],
                (err, criancasIndiretas) => {
                  if (err) return res.status(400).json({ error: err.message });

                  let todasCriancas = [
                    ...criancasDiretas,
                    ...criancasIndiretas,
                  ].map((c) => ({
                    ...c,
                    idade: calculateAge(c.data_nascimento),
                  }));

                  db.all(
                    `SELECT id, nome, cpf FROM responsaveis WHERE id IN (${placeholders})`,
                    principaisIds,
                    (err, responsaveisPrincipais) => {
                      if (err)
                        return res.status(400).json({ error: err.message });

                      res.json({
                        responsavel,
                        responsaveis_principais: responsaveisPrincipais,
                        criancas: todasCriancas,
                        total: todasCriancas.length,
                        tipo: "sub_responsavel",
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.deleteResponsible = (req, res) => {
  const { id } = req.params;

  db.run(`DELETE FROM responsaveis WHERE id = ?`, [id], function (err) {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: "Responsável não encontrado" });
    }

    res.json({ deleted: true });
  });
};
