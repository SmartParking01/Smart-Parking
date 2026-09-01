const express = require("express");
const authController = require("../controllers/authController");
const { authenticate } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/register", asyncHandler(authController.register));
router.post("/login", asyncHandler(authController.login));
router.post("/forgot-password", asyncHandler(authController.requestPasswordReset));
router.post("/reset-password", asyncHandler(authController.resetPassword));
router.get("/me", authenticate, asyncHandler(authController.me));

module.exports = router;
