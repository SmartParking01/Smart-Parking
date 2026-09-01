const express = require("express");
const controller = require("../controllers/entryController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/scan-qr", authenticate, authorize("SECURITY", "ADMIN"), asyncHandler(controller.scanQr));
router.post("/walk-in", authenticate, authorize("SECURITY", "ADMIN"), asyncHandler(controller.assignWalkIn));
router.post("/exit", authenticate, authorize("SECURITY", "ADMIN"), asyncHandler(controller.registerExit));
router.get("/open", authenticate, authorize("SECURITY", "ADMIN"), asyncHandler(controller.listOpenEntries));
router.get("/mine", authenticate, authorize("USER"), asyncHandler(controller.myHistory));

module.exports = router;
