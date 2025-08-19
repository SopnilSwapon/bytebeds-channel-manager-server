import express, { type Request, type Response } from "express";
import { connectToDB } from "../lib/db.js";
import type { RowDataPacket } from "mysql2";

interface IAdvancePermission {
  id: number;
  code: string;
  name: string;
}

interface IAdvanceModuleWithPermissions {
  module: string;
  permissions: IAdvancePermission[];
}

interface IAdvancePermissionsResponse {
  permissions_by_module: IAdvanceModuleWithPermissions[];
}

interface IAdvancePermissionRow extends RowDataPacket {
  module_id: number;
  module_name: string;
  permission_id: number | null;
  code: string | null;
  permission_name: string | null;
}

// create advance role type
export interface ICreateRoleParams {
  name: string;
  description: string;
  permissions: {
    [key: string]: boolean | string | Date;
  };
}

interface IRoleNames extends RowDataPacket {
  name: string;
}
// get all roles type
export interface IAdvanceRolesResponse extends RowDataPacket {
  id: number;
  role: string;
  name: string;
  description?: string;
  status: boolean;
  created_by?: string;
}

const advanceRolesRoutes = express.Router();

// Get Advance roles permissions
advanceRolesRoutes.get(
  "/advance/roles/permissions",
  async (req: Request, res: Response) => {
    try {
      const db = await connectToDB();

      // Joined advancePermissions table & advanceModules table SQL query
      const sql = `
        SELECT am.id AS module_id, am.module_name,
               ap.id AS permission_id, ap.code, ap.name AS permission_name
        FROM advanceModules am
        LEFT JOIN advancePermissions ap ON am.id = ap.module_id
        ORDER BY am.id, ap.id
      `;

      // all data of joined advancePermissions table & advanceModules table

      const [rows] = await db.query<IAdvancePermissionRow[]>(sql);

      // Transform flat rows → nested structure
      const result: IAdvanceModuleWithPermissions[] = [];
      const moduleMap = new Map<number, IAdvanceModuleWithPermissions>();

      for (const row of rows) {
        if (!moduleMap.has(row.module_id)) {
          const newModule: IAdvanceModuleWithPermissions = {
            module: row.module_name,
            permissions: [],
          };
          moduleMap.set(row.module_id, newModule);
          result.push(newModule);
        }

        if (row.permission_id) {
          moduleMap.get(row.module_id)!.permissions.push({
            id: row.permission_id,
            code: row.code ?? "",
            name: row.permission_name ?? "",
          });
        }
      }

      const responseData: IAdvancePermissionsResponse = {
        permissions_by_module: result,
      };

      res.json({
        code: "Succeed",
        message: "Advance Permissions Fetched Successfully!",
        data: responseData,
      });
    } catch (error) {
      console.error("Server Error:", error);
      res.status(500).json({
        code: "Error",
        message: "Server error",
        data: null,
      });
    }
  }
);

// Create a advance role
advanceRolesRoutes.post(
  "/advance/roles",
  async (req: Request<{}, {}, ICreateRoleParams>, res: Response) => {
    const { name, description, permissions } = req.body;
    const status = true;

    try {
      const db = await connectToDB();

      const sql = `SELECT ar.name FROM advanceRoles as ar WHERE ar.name = ?`;
      const [rolesRows] = await db.query<IRoleNames[]>(sql, [name]);

      // check this role already have or not
      if (rolesRows.length > 0 && rolesRows[0]?.name) {
        return res.status(409).json({
          code: "UQ_ROLE_NAME",
          reason: "Role already exists",
          message: "Role name already in use. Please try another one.",
        });
      }

      await db.query(
        "INSERT INTO advanceRoles (name, description, permissions, status) VALUES (?, ?, ?, ?)",
        [name, description, JSON.stringify(permissions), status]
      );

      return res.status(201).json({
        code: "ROLES_CREATED",
        message: "Role created successfully",
      });
    } catch (error) {
      console.error("Role Create Error:", error);
      return res.status(500).json({
        code: "SERVER_ERROR",
        message: "Internal server error",
      });
    }
  }
);

// Get all roles
advanceRolesRoutes.get(
  "/advance/roles",
  async (req: Request<{}, {}>, res: Response) => {
    const db = await connectToDB();
    try {
      const sql =
        "SELECT r.id, r.name, r.description, r.status, r.created_by FROM advanceRoles AS r";
      const [rolesRows] = await db.query<IAdvanceRolesResponse[]>(sql);
      res.json({
        code: "Succeed",
        message: "Advance Roles Fetched Successfully!",
        data: {
          roles: rolesRows,
          count: rolesRows.length,
        },
      });
    } catch (error) {
      console.log(error, "check error");
      return res.status(500).json({
        code: "Error",
        message: "Server error",
        data: null,
      });
    }
  }
);

// Get roles dropdown
advanceRolesRoutes.get(
  "/advance/roles/dropdown",
  async (req: Request, res: Response) => {
    const db = await connectToDB();
    try {
      const sql = "SELECT r.id, r.name FROM advanceRoles AS r";
      const [rolesDropdownRows] = await db.query(sql);
      res.send({
        code: "Success",
        message: "Roles Fetched Successfully!",
        data: rolesDropdownRows,
      });
    } catch (error) {
      console.log(error, "check roles dropdown error");
      return res.status(500).json({
        code: "Error",
        message: "Internal server error",
        data: null,
      });
    }
  }
);

export default advanceRolesRoutes;
