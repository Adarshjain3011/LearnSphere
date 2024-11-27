const { instance } = require("../config/razorpay");
const Course = require("../models/Course");
const crypto = require("crypto");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const mongoose = require("mongoose");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { paymentSuccessEmail } = require("../mail/templates/paymentSuccessEmail");
const CourseProgress = require("../models/CourseProgress");

// Capture Payment and Create Razorpay Order
exports.capturePayment = async (req, res) => {
  const { courses } = req.body;
  const userId = req.user.id;

  if (!courses || courses.length === 0) {
    return res.status(400).json({ success: false, message: "Please provide Course IDs." });
  }

  let totalAmount = 0;

  try {
    for (const courseId of courses) {
      const course = await Course.findById(courseId);
      if (!course) {
        return res.status(404).json({ success: false, message: `Course ${courseId} not found.` });
      }

      const uid = new mongoose.Types.ObjectId(userId);
      if (course.studentsEnroled.includes(uid)) {
        return res.status(400).json({ success: false, message: "Already enrolled in this course." });
      }

      totalAmount += course.price;
    }

    const options = {
      amount: totalAmount * 100,
      currency: "INR",
      receipt: `receipt_${Math.random().toString(36).substring(7)}`,
      notes: { courses, userId },
    };

    const paymentResponse = await instance.orders.create(options);
    res.status(200).json({ success: true, data: paymentResponse });
  } catch (error) {
    console.error("Error in capturePayment:", error);
    res.status(500).json({ success: false, message: "Could not initiate payment." });
  }
};

// Verify Payment
exports.verifyPayment = async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courses } = req.body;
  const userId = req.user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !courses || !userId) {
    return res.status(400).json({ success: false, message: "Missing required payment details." });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  if (expectedSignature === razorpay_signature) {
    await enrollStudents(courses, userId, res);
    return res.status(200).json({ success: true, message: "Payment Verified and Enrollment Successful." });
  }

  res.status(400).json({ success: false, message: "Payment verification failed." });
};

// Handle Razorpay Webhook
exports.webhookHandler = async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET; // Use the Webhook Secret, not the API Secret
  const razorpaySignature = req.headers['x-razorpay-signature']; // Signature sent by Razorpay

  // Convert request body to a string
  const webhookBody = JSON.stringify(req.body);

  // Generate the expected signature using HMAC-SHA256
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret) // Use the Webhook Secret here
    .update(webhookBody) // Use the raw webhook body
    .digest("hex");

  // Compare the expected signature with the one sent by Razorpay
  if (expectedSignature !== razorpaySignature) {
    return res.status(400).json({ success: false, message: "Invalid webhook signature." });
  }

  // Process the webhook event
  const { event, payload } = req.body;

  if (event === "payment.captured" || event === "order.paid") {
    const { notes } = payload.payment.entity || payload.order.entity;
    const { courses, userId } = notes || {};

    if (courses && userId) {
      await enrollStudents(JSON.parse(courses), userId, res);
    }
  }

  res.status(200).json({ success: true });
};




// Send Payment Success Email
exports.sendPaymentSuccessEmail = async (req, res) => {
  const { orderId, paymentId, amount } = req.body;
  const userId = req.user.id;

  if (!orderId || !paymentId || !amount || !userId) {
    return res.status(400).json({ success: false, message: "Incomplete payment details." });
  }

  try {
    const user = await User.findById(userId);
    await mailSender(
      user.email,
      "Payment Successful",
      paymentSuccessEmail(user.firstName + " " + user.lastName, amount / 100, orderId, paymentId)
    );
    res.status(200).json({ success: true, message: "Payment success email sent." });
  } catch (error) {
    console.error("Error sending payment success email:", error);
    res.status(500).json({ success: false, message: "Email not sent." });
  }
};

// Enroll Students
const enrollStudents = async (courses, userId, res) => {
  for (const courseId of courses) {
    try {
      const enrolledCourse = await Course.findByIdAndUpdate(
        courseId,
        { $push: { studentsEnroled: userId } },
        { new: true }
      );

      if (!enrolledCourse) {
        return res.status(404).json({ success: false, message: `Course ${courseId} not found.` });
      }

      const courseProgress = await CourseProgress.create({ courseID: courseId, userId, completedVideos: [] });

      const user = await User.findByIdAndUpdate(
        userId,
        { $push: { courses: courseId, courseProgress: courseProgress._id } },
        { new: true }
      );

      await mailSender(
        user.email,
        `Enrolled in ${enrolledCourse.courseName}`,
        courseEnrollmentEmail(enrolledCourse.courseName, `${user.firstName} ${user.lastName}`)
      );
    } catch (error) {
      console.error("Error enrolling student:", error);
      res.status(500).json({ success: false, message: "Enrollment failed." });
    }
  }
};



