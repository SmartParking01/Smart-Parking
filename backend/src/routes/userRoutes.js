const express = require("express");
const controller = require("../controllers/userController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/staff", authenticate, authorize("ADMIN"), asyncHandler(controller.createStaff));
router.get("/staff/:establishmentId", authenticate, authorize("ADMIN"), asyncHandler(controller.listStaff));
router.get("/", authenticate, authorize("ADMIN"), asyncHandler(controller.listUsers));

module.exports = router;
