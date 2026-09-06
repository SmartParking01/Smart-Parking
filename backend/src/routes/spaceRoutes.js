const express = require("express");
const controller = require("../controllers/spaceController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/parking/:parkingId", authenticate, asyncHandler(controller.listByParking));
router.post("/", authenticate, authorize("ADMIN"), asyncHandler(controller.create));
router.patch("/:id/blocked", authenticate, authorize("ADMIN"), asyncHandler(controller.setBlocked));
router.delete("/:id", authenticate, authorize("ADMIN"), asyncHandler(controller.remove));

module.exports = router;
