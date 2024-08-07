import { Schema, model } from "mongoose";

// User Schema
const userSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  userId: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // Issue: Password saved in clear text
});

// User Account Schema
const accountSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true }, // References to User Model
  balance: { type: Number, required: true }, // Ideally type is Int with float point representation
});

export const User = model("users", userSchema);
export const Account = model("accounts", accountSchema);
