const express = require("express");
const controller = require("../controllers/statsController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/:establishmentId/summary", authenticate, authorize("ADMIN", "ATTENDANT"), asyncHandler(controller.summary));
router.get("/:establishmentId/prediction", authenticate, authorize("ADMIN", "ATTENDANT"), asyncHandler(controller.prediction));

module.exports = router;
