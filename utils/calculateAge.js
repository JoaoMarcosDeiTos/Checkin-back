module.exports = function calculateAge(dataNascimento) {
  const hoje = new Date();

  let nascimento;

  // Se for string, faz o split — compatível com dados antigos/testes
  if (typeof dataNascimento === "string") {
    const [year, month, day] = dataNascimento.split("-");
    nascimento = new Date(Number(year), Number(month) - 1, Number(day));
  } else {
    // Se já for objeto Date (como no PostgreSQL), usa direto
    nascimento = new Date(dataNascimento);
  }

  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }

  return idade;
};
