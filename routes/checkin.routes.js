const express = require("express");
const router = express.Router();
const CheckinController = require("../controllers/checkin.controller");

router.post("/", CheckinController.registerCheckin);

module.exports = router;
