const pool = require("../database/connection");
const calculateAge = require("../utils/calculateAge");

exports.createChildWithResponsibles = async (req, res) => {
  const {
    nome,
    data_nascimento,
    responsavel_principal_cpf,
    sub_responsaveis_cpfs = [],
  } = req.body;
  try {
    // Busca o responsável principal
    const principalResult = await pool.query(
      "SELECT id FROM responsaveis WHERE cpf = $1",
      [responsavel_principal_cpf]
    );
    if (principalResult.rows.length === 0) {
      return res
        .status(404)
        .json({ error: "Responsável principal não encontrado." });
    }
    const responsavel_principal_id = principalResult.rows[0].id;

    // Insere a criança e recupera o ID
    const childResult = await pool.query(
      "INSERT INTO criancas (nome, data_nascimento) VALUES ($1, $2) RETURNING id",
      [nome, data_nascimento]
    );
    const crianca_id = childResult.rows[0].id;

    // Vincula a criança ao responsável principal
    await pool.query(
      "INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES ($1, $2, 'principal')",
      [responsavel_principal_id, crianca_id]
    );

    // Processa os sub-responsáveis (se houver), ignorando erros individuais
    for (const cpfSub of sub_responsaveis_cpfs) {
      try {
        const subResult = await pool.query(
          "SELECT id FROM responsaveis WHERE cpf = $1",
          [cpfSub]
        );
        if (subResult.rows.length > 0) {
          await pool.query(
            "INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES ($1, $2, 'sub')",
            [subResult.rows[0].id, crianca_id]
          );
        }
      } catch (error) {
        // Ignora erro para este sub-responsável e continua
        continue;
      }
    }

    const mensagem =
      sub_responsaveis_cpfs.length > 0
        ? "Criança cadastrada e todos os vínculos criados."
        : "Criança cadastrada com sucesso.";
    res.json({ id: crianca_id, mensagem });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.createChildrenBatch = async (req, res) => {
  const children = req.body;
  if (!Array.isArray(children) || children.length === 0) {
    return res.status(400).json({ error: "Envie um array de crianças" });
  }

  const resultados = [];
  for (const child of children) {
    const { nome, data_nascimento, responsavel_cpf } = child;
    if (!nome || !data_nascimento || !responsavel_cpf) {
      resultados.push({
        nome,
        status: "erro",
        motivo: "Dados obrigatórios ausentes",
      });
      continue;
    }

    try {
      // Busca os responsáveis com base no CPF informado
      const buscarFamiliaresQuery = `
        SELECT DISTINCT r.id, r.cpf,
          CASE WHEN r.is_principal THEN 'principal' ELSE 'sub' END AS tipo
        FROM responsaveis r
        WHERE r.cpf = $1
           OR r.id IN (
             SELECT sub_responsavel_id 
             FROM responsavel_principal_sub 
             WHERE responsavel_principal_id = (SELECT id FROM responsaveis WHERE cpf = $1)
           )
           OR r.id IN (
             SELECT responsavel_principal_id 
             FROM responsavel_principal_sub 
             WHERE sub_responsavel_id = (SELECT id FROM responsaveis WHERE cpf = $1)
           )
      `;
      const familiaresResult = await pool.query(buscarFamiliaresQuery, [
        responsavel_cpf,
      ]);
      if (familiaresResult.rows.length === 0) {
        resultados.push({
          nome,
          status: "erro",
          motivo: "Nenhum responsável encontrado com o CPF fornecido",
        });
        continue;
      }

      // Insere a criança e recupera o ID
      const childInsert = await pool.query(
        "INSERT INTO criancas (nome, data_nascimento) VALUES ($1, $2) RETURNING id",
        [nome, data_nascimento]
      );
      const crianca_id = childInsert.rows[0].id;

      // Vincula cada responsável encontrado à criança, conforme o tipo (principal ou sub)
      for (const resp of familiaresResult.rows) {
        try {
          await pool.query(
            "INSERT INTO responsavel_crianca (responsavel_id, crianca_id, tipo) VALUES ($1, $2, $3)",
            [resp.id, crianca_id, resp.tipo]
          );
        } catch (error) {
          // Continua mesmo que ocorra erro em algum vínculo
          continue;
        }
      }
      resultados.push({
        nome,
        status: "ok",
        crianca_id,
        mensagem: "Criança cadastrada com sucesso com vínculos familiares",
      });
    } catch (error) {
      resultados.push({
        nome,
        status: "erro",
        motivo: "Erro ao processar criança",
      });
    }
  }
  res.json({ mensagem: "Crianças processadas", resultados });
};

exports.listChildrenByCpf = async (req, res) => {
  const { cpf_responsavel } = req.query;
  if (!cpf_responsavel) {
    return res.status(400).json({ error: "CPF do responsável é necessário" });
  }
  try {
    const query = `
      SELECT DISTINCT c.*
      FROM criancas c
      JOIN responsavel_crianca rc ON c.id = rc.crianca_id
      JOIN responsaveis r ON rc.responsavel_id = r.id
      LEFT JOIN responsavel_principal_sub rps ON r.id = rps.responsavel_principal_id
      LEFT JOIN responsaveis sub ON rps.sub_responsavel_id = sub.id
      WHERE r.cpf = $1 OR sub.cpf = $1
    `;
    const result = await pool.query(query, [cpf_responsavel]);
    const criancas = result.rows.map((c) => ({
      ...c,
      idade: calculateAge(c.data_nascimento),
    }));
    res.json(criancas);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.updateChild = async (req, res) => {
  const crianca_id = req.params.id;
  const { nome, data_nascimento } = req.body;
  try {
    const result = await pool.query(
      "UPDATE criancas SET nome = $1, data_nascimento = $2 WHERE id = $3",
      [nome, data_nascimento, crianca_id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Criança não encontrada" });
    }
    res.json({ atualizado: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.deleteChild = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query("DELETE FROM criancas WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Criança não encontrada" });
    }
    res.json({ deleted: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
