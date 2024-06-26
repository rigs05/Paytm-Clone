import jwt from "jsonwebtoken";
import { signupUserSchema, updatesUserSchema } from "../database/zodSchema.js";
import { User, Account } from "../database/users.js";
import { Router } from "express";
import "dotenv/config";
import { authMiddleware } from "../middleware/authMiddleware.js";
const router = Router();

// Sign-up Route
router.post("/signup", async (req, res) => {
  const userDataInput = req.body;
  try {
    // Zod Validation of input data
    const zodValidation = await signupUserSchema.safeParse(userDataInput);
    if (!zodValidation.success) {
      return res.json({
        message: "Error occurred. Incorrect input data found.",
        error: zodValidation.error,
      });
    }

    // Checking if user already exists in db
    let userExist = await User.findOne({ userId: userDataInput.userId });
    if (userExist) {
      return res.status(411).json({
        message: "User already exist in database, please login.",
      });
    }

    // If not, create a new User model and save to the users db
    userExist = new User({
      firstName: userDataInput.firstName,
      lastName: userDataInput.lastName,
      userId: userDataInput.userId,
      password: userDataInput.password,
    });

    // Create an account with initial balance in accounts db
    const accountBalance = new Account({
      userId: userDataInput.userId,
      balance: userDataInput.balance,
    });

    // Create and return JWT token
    const token = jwt.sign(
      { userId: userExist.userId },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    await userExist.save();
    await accountBalance.save();
    res
      .status(200)
      .json({ token: token, message: "User created successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// Sign-in Route
router.post("/signin", async (req, res) => {
  const { userId, password } = req.body;
  try {
    // Check if user exists in db
    const userExist = await User.findOne({ userId, password });
    if (!userExist) {
      return res
        .status(411)
        .json({ message: "Error while loggin in. Check userId or password." });
    }

    // If user exists, return a JWT token along with userId as payload
    const token = jwt.sign(
      { userId: userId, firstName: userExist.firstName },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );
    res.status(200).json({ token: token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// User details update Route (Can update First Name, Last Name, and Password)
router.put("/", authMiddleware, async (req, res) => {
  const { password, firstName, lastName } = req.body;
  try {
    // Add all the given updated input in an Object
    let updates = {};
    if (firstName) {
      updates.firstName = firstName;
    }
    if (lastName) {
      updates.lastName = lastName;
    }
    if (password) {
      updates.password = password;
    }

    // Zod Validation of updated data (return appropriate error message if any)
    const zodValidation = updatesUserSchema.safeParse(updates);
    if (!zodValidation.success) {
      return res.status(411).json({ error: zodValidation.error });
    }

    // Update the value in the db
    const userUpdate = await User.updateOne(
      { userId: req.userId },
      { $set: updates }
    );

    if (!userUpdate) {
      return res.status(404).json({ message: "User not found." });
    } else if (!userUpdate.modifiedCount) {
      return res.status(200).json({ message: "No changes made." });
    }
    res.status(200).json({
      message: `User updated successfully. Changes made: ${Object.keys(
        updates
      )}`,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error}." });
  }
});

// Check this route ; Search all the available Users in db using filter query
router.get("/bulk", authMiddleware, async (req, res) => {
  const { filter } = req.query;
  try {
    const name = new RegExp(filter, "g");

    // Check if queried user exists in db using keywords
    const userExist = await User.findOne({ name });
    if (!userExist) {
      return res.status(411).json({ message: "No such user." });
    }

    // Return a list of similar user names
    const list = userExist.map((user) => {
      user.firstName, user.lastName, user._id;
    });
    res.status(200).json({ users: list });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Unable to find search query. Internal server error." });
  }
});

export default router;
