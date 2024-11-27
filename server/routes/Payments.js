// Import the required modules
const express = require("express");
const router = express.Router();
const {
  capturePayment,
  verifyPayment,
  sendPaymentSuccessEmail,
  webhookHandler, // Add the webhook handler
} = require("../controllers/payments");
const { auth, isInstructor, isStudent, isAdmin } = require("../middleware/auth");

// Payment routes
router.post("/capturePayment", auth, isStudent, capturePayment);
router.post("/verifyPayment", auth, isStudent, verifyPayment);
router.post("/sendPaymentSuccessEmail", auth, isStudent, sendPaymentSuccessEmail);

// Webhook route for Razorpay
router.post("/razorpay-webhook", express.raw({ type: "application/json" }), webhookHandler); // Add raw body parsing

module.exports = router;


