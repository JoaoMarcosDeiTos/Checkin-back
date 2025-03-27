const pool = require("../database/connection");
const calculateAge = require("../utils/calculateAge");

exports.createResponsible = async (req, res) => {
  const {
    nome,
    cpf,
    telefone,
    parentesco,
    pode_fazer_checkin = true,
  } = req.body;

  try {
    const existing = await pool.query(
      "SELECT id FROM responsaveis WHERE cpf = $1",
      [cpf]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "CPF já cadastrado" });
    }

    const result = await pool.query(
      "INSERT INTO responsaveis (nome, cpf, telefone, parentesco, pode_fazer_checkin, is_principal) VALUES ($1, $2, $3, $4, $5, true) RETURNING id",
      [nome, cpf, telefone, parentesco, pode_fazer_checkin ? true : false]
    );

    res.json({ id: result.rows[0].id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.findResponsibleByCpf = async (req, res) => {
  const { cpf } = req.query;
  if (!cpf) return res.status(400).json({ error: "CPF é necessário" });

  try {
    const result = await pool.query(
      "SELECT * FROM responsaveis WHERE cpf = $1",
      [cpf]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Responsável não encontrado" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.findResponsiblesByCpf = async (req, res) => {
  const { cpf } = req.query;
  if (!cpf) return res.status(400).json({ error: "CPF é necessário" });

  try {
    const query = `
      SELECT r.*
      FROM responsaveis r
      LEFT JOIN responsavel_principal_sub rps ON r.id = rps.sub_responsavel_id
      LEFT JOIN responsaveis rp ON rp.id = rps.responsavel_principal_id
      WHERE rp.cpf = $1 OR r.cpf = $1
    `;
    const result = await pool.query(query, [cpf]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Nenhum responsável encontrado para este CPF" });
    }

    res.json(result.rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateResponsible = async (req, res) => {
  const responsavel_id = req.params.id;
  const { nome, cpf, telefone, parentesco, pode_fazer_checkin } = req.body;

  try {
    const check = await pool.query(
      "SELECT id FROM responsaveis WHERE cpf = $1 AND id != $2",
      [cpf, responsavel_id]
    );
    if (check.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "CPF já cadastrado para outro responsável" });
    }

    const result = await pool.query(
      "UPDATE responsaveis SET nome = $1, cpf = $2, telefone = $3, parentesco = $4, pode_fazer_checkin = $5 WHERE id = $6",
      [
        nome,
        cpf,
        telefone,
        parentesco,
        pode_fazer_checkin !== undefined
          ? pode_fazer_checkin
            ? true
            : false
          : true,
        responsavel_id,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Responsável não encontrado" });
    }

    res.json({ atualizado: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createAndLinkSubResponsible = async (req, res) => {
  const {
    nome,
    cpf,
    telefone,
    parentesco,
    pode_fazer_checkin = true,
    criador_id,
    criador_cpf,
  } = req.body;

  if (!criador_id && !criador_cpf) {
    return res.status(400).json({
      error:
        "É necessário informar o ID ou CPF de quem está criando o responsável.",
    });
  }

  try {
    // Verifica se o CPF já existe
    const existingResp = await pool.query(
      "SELECT id FROM responsaveis WHERE cpf = $1",
      [cpf]
    );
    if (existingResp.rows.length > 0) {
      return res
        .status(409)
        .json({ error: "Este CPF já está cadastrado para outro responsável." });
    }

    // Função para buscar o principal real
    const obterPrincipalReal = async (idOuCpf) => {
      const campo = typeof idOuCpf === "number" ? "id" : "cpf";
      const { rows } = await pool.query(
        `SELECT id, is_principal FROM responsaveis WHERE ${campo} = $1`,
        [idOuCpf]
      );
      if (rows.length === 0) {
        throw new Error(`Responsável não encontrado (${campo}).`);
      }
      const row = rows[0];
      if (row.is_principal) {
        return row.id;
      } else {
        const vinculo = await pool.query(
          "SELECT responsavel_principal_id FROM responsavel_principal_sub WHERE sub_responsavel_id = $1",
          [row.id]
        );
        if (vinculo.rows.length === 0) {
          throw new Error(
            "Este responsável não está vinculado a um responsável principal."
          );
        }
        return await obterPrincipalReal(
          vinculo.rows[0].responsavel_principal_id
        );
      }
    };

    const idOuCpfCriador = criador_id ? Number(criador_id) : criador_cpf;
    const principalId = await obterPrincipalReal(idOuCpfCriador);

    // Limites de parentesco
    const limites = {
      father: 1,
      mother: 1,
      grandfather: 2,
      grandmother: 2,
    };

    const parentescoTraduzido = {
      father: "pai",
      mother: "mãe",
      grandfather: "avôs",
      grandmother: "avós",
    };

    const parentescoNormalizado = parentesco?.toLowerCase();

    if (limites[parentescoNormalizado] !== undefined) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS count
         FROM responsaveis r
         WHERE r.id = ANY (
           SELECT sub_responsavel_id FROM responsavel_principal_sub WHERE responsavel_principal_id = $1
           UNION
           SELECT $1
         )
         AND LOWER(r.parentesco) = $2`,
        [principalId, parentescoNormalizado]
      );

      const count = parseInt(rows[0].count, 10);
      const limite = limites[parentescoNormalizado];

      if (count >= limite) {
        const nomeTraduzido =
          parentescoTraduzido[parentescoNormalizado] || parentescoNormalizado;
        return res.status(400).json({
          error: `Só é permitido ${limite} "${nomeTraduzido}" por responsável.`,
        });
      }
    }

    // Cria o sub
    const insertSub = await pool.query(
      `INSERT INTO responsaveis (nome, cpf, telefone, parentesco, pode_fazer_checkin, is_principal)
       VALUES ($1, $2, $3, $4, $5, false) RETURNING id`,
      [nome, cpf, telefone, parentesco, !!pode_fazer_checkin]
    );
    const novoSubRespId = insertSub.rows[0].id;

    // Vincula ao principal
    await pool.query(
      `INSERT INTO responsavel_principal_sub (responsavel_principal_id, sub_responsavel_id)
       VALUES ($1, $2)`,
      [principalId, novoSubRespId]
    );

    // Busca as crianças do principal
    const criancasResult = await pool.query(
      "SELECT crianca_id FROM responsavel_crianca WHERE responsavel_id = $1",
      [principalId]
    );

    if (criancasResult.rows.length === 0) {
      return res.json({
        id: novoSubRespId,
        mensagem:
          "Responsável cadastrado e vinculado ao principal, mas nenhuma criança foi encontrada.",
      });
    }

    const criancasComVinculo = [];
    const criancasSemVinculo = [];

    for (const crianca of criancasResult.rows) {
      try {
        // Verifica se já existe o vínculo
        const existe = await pool.query(
          `SELECT 1 FROM responsavel_crianca 
       WHERE responsavel_id = $1 AND crianca_id = $2`,
          [novoSubRespId, crianca.crianca_id]
        );

        if (existe.rows.length === 0) {
          await pool.query(
            `INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo)
         VALUES ($1, $2, 'sub')`,
            [novoSubRespId, crianca.crianca_id]
          );
          criancasComVinculo.push(crianca.crianca_id);
        } else {
          criancasSemVinculo.push({
            id: crianca.crianca_id,
            motivo: "Vínculo já existia.",
          });
        }
      } catch (err) {
        criancasSemVinculo.push({
          id: crianca.crianca_id,
          motivo: "Erro ao criar vínculo com a criança.",
        });
      }
    }

    res.json({
      id: novoSubRespId,
      mensagem:
        criancasComVinculo.length > 0
          ? `Responsável cadastrado e vinculado a ${criancasComVinculo.length} criança(s).`
          : "Responsável cadastrado, mas não vinculado a nenhuma criança.",
      criancas_vinculadas: criancasComVinculo,
      criancas_sem_vinculo: criancasSemVinculo,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.listChildrenByResponsible = async (req, res) => {
  const cpf = req.params.cpf;

  try {
    const responsavelResult = await pool.query(
      "SELECT id, nome, parentesco FROM responsaveis WHERE cpf = $1",
      [cpf]
    );
    if (responsavelResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Responsável não encontrado com este CPF" });
    }
    const responsavel = responsavelResult.rows[0];
    const responsavel_id = responsavel.id;

    const criancasDiretasResult = await pool.query(
      `SELECT c.id, c.nome, c.data_nascimento, rc.tipo AS tipo_vinculo
       FROM criancas c
       JOIN responsavel_crianca rc ON c.id = rc.crianca_id
       WHERE rc.responsavel_id = $1`,
      [responsavel_id]
    );
    const criancasDiretas = criancasDiretasResult.rows;

    const respPrincipaisResult = await pool.query(
      "SELECT responsavel_principal_id FROM responsavel_principal_sub WHERE sub_responsavel_id = $1",
      [responsavel_id]
    );

    if (respPrincipaisResult.rows.length === 0) {
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

    const principaisIds = respPrincipaisResult.rows.map(
      (r) => r.responsavel_principal_id
    );

    const criancasIndiretasResult = await pool.query(
      `SELECT c.id, c.nome, c.data_nascimento, 'principal_vinculado' AS tipo_vinculo
       FROM criancas c
       JOIN responsavel_crianca rc ON c.id = rc.crianca_id
       WHERE rc.responsavel_id = ANY($1)
         AND rc.tipo = 'principal'
         AND c.id NOT IN (
           SELECT crianca_id FROM responsavel_crianca WHERE responsavel_id = $2
         )`,
      [principaisIds, responsavel_id]
    );
    const criancasIndiretas = criancasIndiretasResult.rows;

    const todasCriancas = [...criancasDiretas, ...criancasIndiretas].map(
      (c) => ({
        ...c,
        idade: calculateAge(c.data_nascimento),
      })
    );

    const responsaveisPrincipaisResult = await pool.query(
      "SELECT id, nome, cpf FROM responsaveis WHERE id = ANY($1)",
      [principaisIds]
    );

    res.json({
      responsavel,
      responsaveis_principais: responsaveisPrincipaisResult.rows,
      criancas: todasCriancas,
      total: todasCriancas.length,
      tipo: "sub_responsavel",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteResponsible = async (req, res) => {
  const { id } = req.params;

  try {
    const respResult = await pool.query(
      "SELECT is_principal FROM responsaveis WHERE id = $1",
      [id]
    );

    if (respResult.rows.length === 0) {
      return res.status(404).json({ error: "Responsável não encontrado." });
    }

    const isPrincipal = respResult.rows[0].is_principal;

    // Busca todas as crianças vinculadas a esse responsável
    const criancasResult = await pool.query(
      `SELECT c.id, c.nome FROM criancas c
       JOIN responsavel_crianca rc ON rc.crianca_id = c.id
       WHERE rc.responsavel_id = $1`,
      [id]
    );

    const criancasComSomenteEsseResponsavel = [];

    for (const crianca of criancasResult.rows) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) FROM responsavel_crianca
         WHERE crianca_id = $1 AND responsavel_id != $2`,
        [crianca.id, id]
      );

      const count = parseInt(rows[0].count, 10);
      if (count === 0) {
        criancasComSomenteEsseResponsavel.push(crianca.nome);
      }
    }

    if (criancasComSomenteEsseResponsavel.length > 0) {
      return res.status(400).json({
        error: `Não é possível excluir este responsável, pois ele é o único vinculado às seguintes crianças: ${criancasComSomenteEsseResponsavel.join(
          ", "
        )}.`,
      });
    }

    // Se for principal, promove um sub para principal
    if (isPrincipal) {
      const subsResult = await pool.query(
        "SELECT sub_responsavel_id FROM responsavel_principal_sub WHERE responsavel_principal_id = $1",
        [id]
      );

      if (subsResult.rows.length > 0) {
        const novoPrincipalId = subsResult.rows[0].sub_responsavel_id;

        await pool.query(
          "UPDATE responsaveis SET is_principal = true WHERE id = $1",
          [novoPrincipalId]
        );

        await pool.query(
          "DELETE FROM responsavel_principal_sub WHERE sub_responsavel_id = $1",
          [novoPrincipalId]
        );

        const subIds = subsResult.rows
          .map((s) => s.sub_responsavel_id)
          .filter((sid) => sid !== novoPrincipalId);

        for (const subId of subIds) {
          await pool.query(
            `UPDATE responsavel_principal_sub 
             SET responsavel_principal_id = $1 
             WHERE sub_responsavel_id = $2`,
            [novoPrincipalId, subId]
          );
        }

        await pool.query(
          `UPDATE responsavel_crianca 
           SET responsavel_id = $1 
           WHERE responsavel_id = $2 AND tipo = 'principal'`,
          [novoPrincipalId, id]
        );
      }
    }

    // Finalmente, deleta o responsável
    await pool.query("DELETE FROM responsaveis WHERE id = $1", [id]);

    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
