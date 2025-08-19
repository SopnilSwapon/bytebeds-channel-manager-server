import express, { type Request, type Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { connectToDB } from "../lib/db.js";
import type { RowDataPacket, ResultSetHeader } from "mysql2";

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
  name: string;
  email: string;
  mobile_no: number;
  username: string;
  password: string;
  user_type: string;
}

// Role's permissions type
interface IAdvanceRolePermissions extends RowDataPacket {
  permissions?: Record<string, any>;
}

// ---------------------- Router ----------------------
const authRouter = express.Router();

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

      const db = await connectToDB();

      // Check duplicate username (select only needed columns)
      const [dupRows] = await db.query<IAdvanceUserRow[]>(
        "SELECT id, username FROM `advance-users` WHERE username = ? LIMIT 1",
        [username]
      );
      const [rolePermissions] = await db.query<IAdvanceRolePermissions[]>(
        "SELECT rp.permissions FROM advanceRoles AS rp WHERE rp.id = ?",
        [role_id]
      );
      const permissions =
        JSON.stringify(rolePermissions[0]?.permissions) ?? null;

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
      const isAutoPropertyAssignInt = toTinyintBool(is_auto_property_assign);

      // Insert user
      const [insertResult] = await db.query<ResultSetHeader>(
        `INSERT INTO \`advance-users\`
         (name, email, mobile_no, username, role_id, is_auto_property_assign, password, permissions)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          email,
          mobile_no,
          username,
          role_id,
          isAutoPropertyAssignInt,
          hashPassword,
          permissions,
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
        "SELECT id, password, name, email, user_type, username, mobile_no FROM `advance-users` WHERE username = ? LIMIT 1",
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

      const token = jwt.sign({ id: user.id }, secret, { expiresIn: "10s" });

      return res.status(200).json({
        code: "USER_LOGGED_IN",
        message: "User login successfully",
        data: {
          id: user.id,
          name: user.username,
          user_name: user.username,
          user_type: user.user_type,
          access_token: token,
          email: user.email,
          mobile_no: user.mobile_no,
        },
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

// get permissions of current login users
authRouter.get(
  "advance/user/permissions",
  async (req: Request, res: Response) => {}
);

export default authRouter;
