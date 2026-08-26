const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Username is required"],
      unique: true,
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [20, "Username cannot exceed 20 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      // 'select: false' means password is never returned in queries by default
      // You must explicitly do User.findOne().select('+password') to get it
      select: false,
    },
  },
  {
    timestamps: true, // auto createdAt and updatedAt
  }
);

// --- Pre-save hook: Hash password before saving ---
// This runs automatically before every .save() call
// It does NOT run on .findOneAndUpdate() — that's intentional
userSchema.pre("save", async function (next) {
  // Only hash if password was actually modified (prevents re-hashing on profile updates)
  if (!this.isModified("password")) return next();

  // saltRounds=10 is the industry standard. Higher = slower but more secure
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// --- Instance method: Compare entered password with hashed password ---
// Used during login: user.comparePassword(enteredPassword)
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
