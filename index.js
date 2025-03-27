const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

// Corrigindo os nomes dos arquivos de rotas para corresponder aos nomes reais
const responsibleRoutes = require("./routes/responsible.routes");
const childRoutes = require("./routes/child.routes");
const checkinRoutes = require("./routes/checkin.routes");

// Corrigindo os caminhos das rotas
app.use("/responsible", responsibleRoutes);
app.use("/children", childRoutes);
app.use("/checkin", checkinRoutes);

app.listen(3001, () => {
  console.log("Server running on port 3001 🚀");
});
