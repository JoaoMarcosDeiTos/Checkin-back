require("dotenv").config();

const express = require("express");
const cors = require("cors");
const app = express();

app.use(express.json());
const allowedOrigins = [
  "https://joaomarcosdeitos.github.io", // seu GitHub Pages
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

const responsibleRoutes = require("./routes/responsible.routes");
const childRoutes = require("./routes/child.routes");
const checkinRoutes = require("./routes/checkin.routes");

app.use("/responsible", responsibleRoutes);
app.use("/children", childRoutes);
app.use("/checkin", checkinRoutes);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port} 🚀`);
});
