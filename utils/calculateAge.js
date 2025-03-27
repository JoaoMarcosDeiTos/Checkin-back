module.exports = function calculateAge(dataNascimento) {
  const hoje = new Date();

  // Quebra "YYYY-MM-DD" em partes
  const [year, month, day] = dataNascimento.split("-");
  // Cria data local, sem hora (não sofre offset de fuso horário)
  const nascimento = new Date(Number(year), Number(month) - 1, Number(day));

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
};
