import express, { type Request } from "express";
import { connectToDB } from "../lib/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { toTinyIntBool, type IAdvanceRolePermissions } from "./authRoutes.js";

interface IAdvanceUser extends RowDataPacket {
  id: number;
  role_id: number;
  name: string;
  email: string;
  mobile_no: string;
  username: string;
  is_auto_property_assign: boolean;
  role_name: string | null;
  status: boolean;
  created_by?: string | null;
}

const advanceUserRoutes = express.Router();

// get all users
advanceUserRoutes.get("/advance/users", async (req, res) => {
  try {
    const sql = "SELECT * FROM `advance-users`";
    const db = await connectToDB();

    const [userRows] = await db.query(sql);
    const users = userRows as IAdvanceUser[];
    if (users.length > 0) {
      res.json({
        code: "Succeed",
        message: "User fetched successfully!",
        data: {
          users: users,
          count: users.length,
        },
      });
    } else {
      res.json({
        code: "Succeed",
        message: "User fetched successfully!",
        data: {
          users: [],
          count: 0,
        },
      });
    }
  } catch (error) {
    console.error("Server Error:", error);
    res
      .status(500)
      .json({ code: "Error", message: "Server error", data: null });
  }
});

// update a user

advanceUserRoutes.patch(
  "/advance/users/:id",
  async (req: Request<{}, {}, IAdvanceUser>, res) => {
    try {
      const db = await connectToDB();
      const {
        name,
        email,
        mobile_no,
        role_id,
        is_auto_property_assign,
        username,
        status,
      } = req.body;
      const currentLoggedUserName = req.headers.name;
      const tinyIsAutoPropertyAssign = toTinyIntBool(is_auto_property_assign);
      //  check requested user existed or not
      const sql =
        "SELECT username FROM `advance-users` WHERE username = ? LIMIT 1";
      const [hasCurrentUserRow] = await db.query<IAdvanceUser[]>(sql, [
        username,
      ]);
      if (hasCurrentUserRow) {
        return res.status(409).json({
          code: "UQ_USERNAME",
          reason: "Username already exists",
          message: "User has already existed",
        });
      } else {
        const [rolePermissions] = await db.query<IAdvanceRolePermissions[]>(
          "SELECT rp.permissions FROM advanceRoles AS rp WHERE rp.id = ?",
          [role_id]
        );
        const permissions = JSON.stringify(rolePermissions[0]?.permissions);
        const [updateResult] = await db.query<ResultSetHeader>(
          "UPDATE `advance-users` SET name = ?, email = ?, mobile_no = ?, role_id = ?, is_auto_property_assign = ? username = ? status = ?, permissions",
          [name, email, mobile_no, role_id, tinyIsAutoPropertyAssign, username]
        );
      }
    } catch (error) {}
  }
);

export default advanceUserRoutes;
