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

export default advanceRolesRoutes;
