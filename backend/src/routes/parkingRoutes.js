const express = require("express");
const controller = require("../controllers/parkingController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/establishment/:establishmentId", authenticate, asyncHandler(controller.listByEstablishment));
router.post("/", authenticate, authorize("ADMIN"), asyncHandler(controller.create));

module.exports = router;
