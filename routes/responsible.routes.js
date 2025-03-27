// routes/responsible.routes.js
const express = require("express");
const router = express.Router();
const ResponsibleController = require("../controllers/responsible.controller");

router.post("/", ResponsibleController.createResponsible);
router.get("/", ResponsibleController.findResponsibleByCpf);
router.get("/all", ResponsibleController.findResponsiblesByCpf);
router.put("/:id", ResponsibleController.updateResponsible);
router.post("/sub", ResponsibleController.createAndLinkSubResponsible);
router.get(
  "/children-by-cpf/:cpf",
  ResponsibleController.listChildrenByResponsible
);
router.delete("/:id", ResponsibleController.deleteResponsible);

module.exports = router;
