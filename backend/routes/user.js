import jwt from "jsonwebtoken";
import { signupUserSchema, updatesUserSchema } from "../database/zodSchema.js";
import { User, Account } from "../database/users.js";
import { Router } from "express";
import "dotenv/config";
import { authMiddleware } from "../middleware/authMiddleware.js";
const router = Router();

// Verify Users (for redirection of signed users to Dash & unsigned users to login)
router.get("/me", authMiddleware, (_req, res) => {
  res.status(200).json({ message: "User valid and signed in." });
});

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
    const savedUser = await userExist.save();

    // Create an account with initial balance in accounts db
    const accountBalance = new Account({
      userId: savedUser._id, // Save the User Id of created User
      // balance: userDataInput.balance,
      balance: Math.round(10000 * Math.random()), // Saving Random balance below 10000
    });

    await accountBalance.save();

    /***** Sign up should directly redirect user to dashboard and NOT to login page *****/
    res.status(200).json({
      message: `User ${userDataInput.firstName} created successfully.`,
    });
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

    // Sending Token inside Cookie
    res.cookie("jwt", token, {
      httpOnly: true, // Only server can read it, not client-JS
      secure: true, // Only transfer cookie via HTTPS
      sameSite: "Lax", // Will prevent sending cookie to target site
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days from today
    });

    res.cookie("userId", userId, {
      sameSite: "None",
      secure: true,
    });

    res.cookie("user", userExist.firstName, {
      sameSite: "None",
      secure: true,
    });

    res.status(200).json({ message: "Login successful." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  }
});

// User details update Route (Can update First Name, Last Name, and Password)
// Make Frontend page
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
    if (!filter) {
      const users = await User.find({ userId: { $ne: req.userId } });
      const userList = users
        // .filter((user) => user.userId !== req.userId)
        .map((user) => {
          return {
            _id: user._id,
            name: `${user.firstName} ${user.lastName}`,
          };
        });
      // console.log("User list accessed: ", userList);
      return res.status(200).json({ userList });
    }
    const name = new RegExp(filter, "i");

    // Check if queried user exists in db using keywords
    // const userExist = await User.find({ $and: [{
    //   $or: [{ firstName: name }, { lastName: name }]},
    // {userId: {$ne: {req.userId}
    // });
    const userExist = await User.find({
      $and: {
        userId: { $ne: req.userId },
        $or: [{ firstName: name }, { lastName: name }],
      },
    });
    if (!userExist || userExist.length === 0) {
      return res.status(411).json({ message: "No user with such query." });
    }

    // Return a list of similar user names
    const list = userExist.map((user) => {
      return {
        _id: user._id,
        name: `${user.firstName} ${user.lastName}`,
      };
    });
    res.status(200).json({ userList: list });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ error: "Unable to find search query. Internal server error." });
  }
});

export default router;
