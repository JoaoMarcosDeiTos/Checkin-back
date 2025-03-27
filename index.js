const express = require("express");
const cors = require("cors");

const app = express();

// Configuração do CORS para permitir requisições do GitHub Pages
app.use(
  cors({
    origin: "https://joaomarcosdeitos.github.io",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

// Importação e uso das rotas
const responsibleRoutes = require("./routes/responsible.routes");
const childRoutes = require("./routes/child.routes");
const checkinRoutes = require("./routes/checkin.routes");

app.use("/responsible", responsibleRoutes);
app.use("/children", childRoutes);
app.use("/checkin", checkinRoutes);

// Definição da porta
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port} 🚀`);
});
