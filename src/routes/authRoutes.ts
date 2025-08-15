import express from "express";
import bcrypt from "bcrypt";
import { connectToDB } from "../lib/db.js";

interface IAdvanceUserFormValues {
  name: string;
  email: string;
  mobile_no: string;
  username: string;
  role_id: number | string;
  is_auto_property_assign: boolean | string;
  password: string;
  permissions?: JSON;
}
const authRouter = express.Router();

// Register a user
authRouter.post(
  "/advance/users",
  async (req: express.Request<{}, {}, IAdvanceUserFormValues>, res) => {
    const {
      username,
      email,
      is_auto_property_assign,
      mobile_no,
      name,
      password,
      role_id,
    } = req.body;
    try {
      const db = await connectToDB();
      const sql = "SELECT * FROM `advance-users` WHERE username = ?";
      const [userRows] = await db.query(sql, [username]);
      const users = userRows as IAdvanceUserFormValues[];
      if (users.length > 0) {
        return res.status(409).json({
          code: "UQ_USERNAME",
          reason: "Username already exists",
          message: "User has already existed",
        });
      } else {
        const hashPassword = await bcrypt.hash(password, 10);
        const isAutoPropertyAssignInt =
          is_auto_property_assign === true || is_auto_property_assign === "true"
            ? 1
            : 0;
        await db.query(
          "INSERT INTO `advance-users` (name, email, mobile_no, username, role_id, is_auto_property_assign, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            name,
            email,
            mobile_no,
            username,
            role_id,
            isAutoPropertyAssignInt,
            hashPassword,
          ]
        );
        return res.status(201).json({
          code: "USER_CREATED",
          message: "User created successfully",
        });
      }
    } catch (error) {
      console.error(error, "check error");
      res.status(500).json({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });
    }
  }
);

// login a user

authRouter.post(
  "/login",
  async (req: express.Request<{}, {}, IAdvanceUserFormValues>, res) => {
    const { username, password } = req.body;
    try {
      const db = await connectToDB();
      const sql = "SELECT * FROM `advance-users` WHERE username = ?";
      const [userRows] = await db.query(sql, [username]);

      const users = userRows as IAdvanceUserFormValues[];
      if (users.length === 0) {
        return res.status(404).json({
          code: "UQ_USERNAME",
          reason: "Username not exists",
          message: "User not existed",
        });
      } else {
        const isMatched = await bcrypt.compare(password, users[0]?.password!);
        const hashPassword = await bcrypt.hash(password, 10);
        await db.query(
          "INSERT INTO `advance-users` (name, email, mobile_no, username, role_id, is_auto_property_assign, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [username, hashPassword]
        );
        return res.status(201).json({
          code: "USER_CREATED",
          message: "User created successfully",
        });
      }
    } catch (error) {
      console.error(error, "check error");
      res.status(500).json({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });
    }
  }
);

export default authRouter;
