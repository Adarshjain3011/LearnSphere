// Importing necessary modules and packages
const express = require("express");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const path = require("path");

// Load environment variables from .env file
dotenv.config();

// Importing routes and configurations
const userRoutes = require("./routes/user");
const profileRoutes = require("./routes/profile");
const courseRoutes = require("./routes/Course");
const paymentRoutes = require("./routes/Payments");
const contactUsRoute = require("./routes/Contact");
const database = require("./config/database");
const { cloudinaryConnect } = require("./config/cloudinary");

// Setting up the express application
const app = express();

// Setting up port number
const PORT = process.env.PORT || 4000;
console.log("Server is running on port:", PORT);

// Connecting to database


database.connect();

// Connecting to cloudinary

cloudinaryConnect();

// Middlewares
app.use(express.json()); // For parsing JSON requests
app.use(cookieParser()); // For handling cookies

// CORS middleware to allow requests from your frontend on Vercel
app.use(
	cors({
		origin:"*", // Update to your actual frontend URL
		credentials: true, // To support cookies and credentials across origins
	})
);

// File upload middleware
app.use(
	fileUpload({
		useTempFiles: true,
		tempFileDir: "/tmp/",
	})
);

// Serving static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Setting up API routes
app.use("/api/v1/auth", userRoutes);
app.use("/api/v1/profile", profileRoutes);
app.use("/api/v1/course", courseRoutes);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/reach", contactUsRoute);

// Route for server testing
app.get("/", (req, res) => {
	return res.json({
		success: true,
		message: "Your server is up and running ...",
	});
});


// Start the server and listen on the specified port
app.listen(PORT, () => {

	console.log(`App is listening on port ${PORT}`);

	
});



