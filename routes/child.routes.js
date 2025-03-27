// routes/child.routes.js
const express = require("express");
const router = express.Router();
const ChildController = require("../controllers/child.controller");

router.post("/", ChildController.createChildWithResponsibles);
router.get("/", ChildController.listChildrenByCpf);
router.put("/:id", ChildController.updateChild);
router.post("/batch", ChildController.createChildrenBatch);
router.delete("/:id", ChildController.deleteChild);

module.exports = router;
