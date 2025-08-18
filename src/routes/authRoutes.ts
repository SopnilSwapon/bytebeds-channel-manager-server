// import express from "express";
// import bcrypt from "bcrypt";
// import { connectToDB } from "../lib/db.js";
// import jwt from "jsonwebtoken";

// interface IAdvanceUserFormValues {
//   name: string;
//   email: string;
//   mobile_no: string;
//   username: string;
//   role_id: number | string;
//   is_auto_property_assign: boolean | string;
//   password: string;
//   permissions?: JSON;
// }
// interface IUserLogin {
//   id: number;
//   username: string;
//   password: string;
// }
// const authRouter = express.Router();

// // Register a user
// authRouter.post(
//   "/advance/users",
//   async (req: express.Request<{}, {}, IAdvanceUserFormValues>, res) => {
//     const {
//       username,
//       email,
//       is_auto_property_assign,
//       mobile_no,
//       name,
//       password,
//       role_id,
//     } = req.body;
//     try {
//       const db = await connectToDB();
//       const sql = "SELECT * FROM `advance-users` WHERE username = ?";
//       const [userRows] = await db.query(sql, [username]);
//       const users = userRows as IAdvanceUserFormValues[];
//       if (users.length > 0) {
//         return res.status(409).json({
//           code: "UQ_USERNAME",
//           reason: "Username already exists",
//           message: "User has already existed",
//         });
//       } else {
//         const hashPassword = await bcrypt.hash(password, 10);
//         const isAutoPropertyAssignInt =
//           is_auto_property_assign === true || is_auto_property_assign === "true"
//             ? 1
//             : 0;
//         await db.query(
//           "INSERT INTO `advance-users` (name, email, mobile_no, username, role_id, is_auto_property_assign, password) VALUES (?, ?, ?, ?, ?, ?, ?)",
//           [
//             name,
//             email,
//             mobile_no,
//             username,
//             role_id,
//             isAutoPropertyAssignInt,
//             hashPassword,
//           ]
//         );
//         return res.status(201).json({
//           code: "USER_CREATED",
//           message: "User created successfully",
//         });
//       }
//     } catch (error) {
//       console.error(error, "check error");
//       res.status(500).json({
//         code: "SERVER_ERROR",
//         message: "Internal server error",
//       });
//     }
//   }
// );

// // login a user

// authRouter.post(
//   "/login",
//   async (req: express.Request<{}, {}, IAdvanceUserFormValues>, res) => {
//     const { username, password } = req.body;
//     try {
//       const db = await connectToDB();
//       const sql = "SELECT * FROM `advance-users` WHERE username = ?";
//       const [userRows] = await db.query(sql, [username]);

//       const users = userRows as IUserLogin[];
//       if (users.length === 0) {
//         return res.status(404).json({
//           code: "UQ_USERNAME",
//           reason: "username or password wrong",
//           message: "User not existed",
//         });
//       } else {
//         const isPasswordMatched = await bcrypt.compare(
//           password,
//           users[0]?.password!
//         );

//         if (!isPasswordMatched || username !== users[0]?.username) {
//           return res.status(404).json({
//             code: "UQ_USERNAME",
//             reason: "username or password wrong",
//             message: "Invalid username or password",
//           });
//         }
//         const token = jwt.sign(
//           { id: users[0].id },
//           process.env.JWT_SECRET_KEY!,
//           { expiresIn: "1h" }
//         );
//         return res.status(201).json({
//           code: "user logged",
//           message: "User login successfully",
//           data: { token, type: "advance" },
//         });
//       }
//     } catch (error) {
//       console.error(error, "check error");
//       res.status(500).json({
//         code: "SERVER_ERROR",
//         message: "Internal server error",
//       });
//     }
//   }
// );

// export default authRouter;
// src/routes/authRoutes.ts
import express, { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { connectToDB } from "../lib/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

// ---------------------- Types ----------------------
interface IAdvanceUserFormValues {
  name: string;
  email: string;
  mobile_no: string;
  username: string;
  role_id: number | string;
  is_auto_property_assign: boolean | string;
  password: string;
  permissions?: Record<string, any>;
}

interface IUserLoginRequest {
  username: string;
  password: string;
}

// Exact row shape we read from DB when checking duplicate username
interface IAdvanceUserRow extends RowDataPacket {
  id: number;
  username: string;
}

// Minimal row shape we read for login
interface IUserLoginRow extends RowDataPacket {
  id: number;
  username: string;
  password: string;
}

// ---------------------- Router ----------------------
const authRouter = express.Router();

// ---------------------- Helpers ----------------------
function toInt(value: number | string): number {
  if (typeof value === "number") return value;
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error("Invalid numeric value");
  return n;
}

function toTinyintBool(value: boolean | string): 0 | 1 {
  if (typeof value === "boolean") return value ? 1 : 0;
  const v = String(value).toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes" ? 1 : 0;
}

// ---------------------- Register ----------------------
authRouter.post(
  "/advance/users",
  async (req: Request<{}, {}, IAdvanceUserFormValues>, res: Response) => {
    try {
      const {
        username,
        email,
        is_auto_property_assign,
        mobile_no,
        name,
        password,
        role_id,
      } = req.body;

      // Basic validation (prevents bcrypt error when password is missing)
      if (!username || !password || !name || !email) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "name, email, username and password are required",
        });
      }

      const db = await connectToDB();

      // Check duplicate username (select only needed columns)
      const [dupRows] = await db.query<IAdvanceUserRow[]>(
        "SELECT id, username FROM `advance-users` WHERE username = ? LIMIT 1",
        [username]
      );

      if (dupRows.length > 0) {
        return res.status(409).json({
          code: "UQ_USERNAME",
          reason: "Username already exists",
          message: "User has already existed",
        });
      }

      // Hash password (ensure saltRounds provided)
      const hashPassword = await bcrypt.hash(password, 10);

      // Normalize values for DB
      const roleId = toInt(role_id);
      const isAutoPropertyAssignInt = toTinyintBool(is_auto_property_assign);

      // Insert user
      const [insertResult] = await db.query<ResultSetHeader>(
        `INSERT INTO \`advance-users\`
         (name, email, mobile_no, username, role_id, is_auto_property_assign, password)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          email,
          mobile_no ?? "",
          username,
          roleId,
          isAutoPropertyAssignInt,
          hashPassword,
        ]
      );

      if (insertResult.affectedRows !== 1) {
        return res.status(500).json({
          code: "DB_INSERT_FAILED",
          message: "Failed to create user",
        });
      }

      return res.status(201).json({
        code: "USER_CREATED",
        message: "User created successfully",
      });
    } catch (error) {
      console.error("REGISTER_ERROR:", error);
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });
    }
  }
);

// ---------------------- Login ----------------------
authRouter.post(
  "/login",
  async (req: Request<{}, {}, IUserLoginRequest>, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          code: "INVALID_INPUT",
          message: "username and password are required",
        });
      }

      const db = await connectToDB();

      // Select only what's needed for login
      const [rows] = await db.query<IUserLoginRow[]>(
        "SELECT id, username, password FROM `advance-users` WHERE username = ? LIMIT 1",
        [username]
      );

      if (rows.length === 0) {
        return res.status(404).json({
          code: "INVALID_CREDENTIALS",
          reason: "username or password wrong",
          message: "Invalid username or password",
        });
      }

      const user = rows[0];

      // Guard: ensure hashed password exists
      if (!user?.password) {
        return res.status(500).json({
          code: "USER_DATA_CORRUPT",
          message: "User record missing password hash",
        });
      }

      const isPasswordMatched = await bcrypt.compare(password, user.password);
      if (!isPasswordMatched) {
        return res.status(401).json({
          code: "INVALID_CREDENTIALS",
          reason: "username or password wrong",
          message: "Invalid username or password",
        });
      }

      const secret = process.env.JWT_SECRET_KEY;
      if (!secret) {
        console.error("JWT_SECRET_KEY is not set in environment variables");
        return res.status(500).json({
          code: "SERVER_MISCONFIG",
          message: "JWT secret missing",
        });
      }

      const token = jwt.sign({ id: user.id }, secret, { expiresIn: "1h" });

      return res.status(200).json({
        code: "USER_LOGGED_IN",
        message: "User login successfully",
        data: { token, type: "advance" },
      });
    } catch (error) {
      console.error("LOGIN_ERROR:", error);
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });
    }
  }
);

export default authRouter;
