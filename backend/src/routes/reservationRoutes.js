const express = require("express");
const controller = require("../controllers/reservationController");
const { authenticate, authorize } = require("../middleware/auth");
const asyncHandler = require("../utils/asyncHandler");

const router = express.Router();

router.post("/", authenticate, authorize("USER"), asyncHandler(controller.createReservation));
router.get("/mine", authenticate, authorize("USER"), asyncHandler(controller.myReservations));
router.get("/:id/qr", authenticate, authorize("USER"), asyncHandler(controller.getQrImage));
router.post("/:id/cancel", authenticate, authorize("USER"), asyncHandler(controller.cancelReservation));
router.get(
  "/establishment/:establishmentId",
  authenticate,
  authorize("ADMIN", "ATTENDANT"),
  asyncHandler(controller.listForEstablishment)
);

module.exports = router;
