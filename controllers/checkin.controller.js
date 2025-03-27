const pool = require("../database/connection");

exports.registerCheckin = async (req, res) => {
  const { responsavel_cpf, criancas_ids } = req.body;

  if (
    !responsavel_cpf ||
    !Array.isArray(criancas_ids) ||
    criancas_ids.length === 0
  ) {
    return res.status(400).json({
      error: "Informe o CPF do responsável e pelo menos uma criança.",
    });
  }

  try {
    // Verifica se o responsável existe
    const respResult = await pool.query(
      "SELECT id FROM responsaveis WHERE cpf = $1",
      [responsavel_cpf]
    );
    if (respResult.rows.length === 0) {
      return res.status(404).json({ error: "Responsável não encontrado." });
    }
    const responsavel_id = respResult.rows[0].id;
    const dataHora = new Date().toISOString();

    // Insere o check-in principal e retorna o ID
    const checkinResult = await pool.query(
      "INSERT INTO checkins (responsavel_id, data_hora) VALUES ($1, $2) RETURNING id",
      [responsavel_id, dataHora]
    );
    const checkin_id = checkinResult.rows[0].id;

    // Insere os vínculos com as crianças (bulk insert)
    const placeholders = criancas_ids
      .map((_, index) => `($${index * 2 + 1}, $${index * 2 + 2})`)
      .join(", ");
    const values = criancas_ids.flatMap((crianca_id) => [
      checkin_id,
      crianca_id,
    ]);

    await pool.query(
      `INSERT INTO checkin_crianca (checkin_id, crianca_id) VALUES ${placeholders}`,
      values
    );

    res.json({
      checkin_id,
      data_hora: dataHora,
      criancas_ids,
      responsavel_id,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
