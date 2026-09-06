const express = require("express");
const controller = require("../controllers/companyController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.get("/", authenticate, asyncHandler(controller.list));
router.post("/", authenticate, authorize("ADMIN"), asyncHandler(controller.create));

module.exports = router;
