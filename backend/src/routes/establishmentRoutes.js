const express = require("express");
const controller = require("../controllers/establishmentController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/public", asyncHandler(controller.listPublic));
router.get("/", authenticate, asyncHandler(controller.list));
router.get("/:id", authenticate, asyncHandler(controller.getOne));
router.get("/:id/map", authenticate, asyncHandler(controller.map));
router.post("/", authenticate, authorize("ADMIN"), asyncHandler(controller.create));
router.put("/:id", authenticate, authorize("ADMIN"), asyncHandler(controller.update));

module.exports = router;
