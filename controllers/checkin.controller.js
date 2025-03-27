// controllers/checkin.controller.js
const db = require("../database");

exports.registerCheckin = (req, res) => {
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

  // Verificar se o responsável existe
  db.get(
    `SELECT id FROM responsaveis WHERE cpf = ?`,
    [responsavel_cpf],
    (err, responsavel) => {
      if (err) return res.status(400).json({ error: err.message });
      if (!responsavel)
        return res.status(404).json({ error: "Responsável não encontrado." });

      const responsavel_id = responsavel.id;
      const dataHora = new Date().toISOString();

      // Inserir o check-in principal
      db.run(
        `INSERT INTO checkins (responsavel_id, data_hora) VALUES (?, ?)`,
        [responsavel_id, dataHora],
        function (err) {
          if (err) return res.status(400).json({ error: err.message });

          const checkin_id = this.lastID;

          // Inserir vínculos com as crianças
          const placeholders = criancas_ids.map(() => "(?, ?)").join(", ");
          const values = criancas_ids.flatMap((crianca_id) => [
            checkin_id,
            crianca_id,
          ]);

          db.run(
            `INSERT INTO checkin_crianca (checkin_id, crianca_id) VALUES ${placeholders}`,
            values,
            function (err) {
              if (err) return res.status(400).json({ error: err.message });

              res.json({
                checkin_id,
                data_hora: dataHora,
                criancas_ids,
                responsavel_id,
              });
            }
          );
        }
      );
    }
  );
};
