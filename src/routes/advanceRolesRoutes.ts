import express from "express";
import { connectToDB } from "../lib/db.js";

const advanceRolesRoutes = express.Router();

// Get Advance roles permissions
advanceRolesRoutes.get("/advance/roles/permissions", async (req, res) => {
  try {
    const db = await connectToDB();

    // Join advanceModules table & advancePermissions table;

    const sql = `SELECT am.id as module_id, am.module_name
                        ap.id as permission_id, p.code, p.name as permission_name
                 FROM advanceModules am
                 LEFT JOIN advancePermissions ap ON am.id = ap.module_id
                 ORDER BY am.id, ap.id`;

    // // JOIN modules + permissions
    // const sql = `
    //   SELECT m.id as module_id, m.module_name,
    //          p.id as permission_id, p.code, p.name as permission_name
    //   FROM advanceModules m
    //   LEFT JOIN advancePermissions p ON m.id = p.module_id
    //   ORDER BY m.id, p.id
    // `;

    const [rows] = await db.query(sql);

    // Transform flat rows → nested structure
    const result: any[] = [];
    const moduleMap = new Map<number, any>();

    for (const row of rows as any[]) {
      if (!moduleMap.has(row.module_id)) {
        const newModule = {
          module: row.module_name,
          permissions: [],
        };
        moduleMap.set(row.module_id, newModule);
        result.push(newModule);
      }

      if (row.permission_id) {
        moduleMap.get(row.module_id).permissions.push({
          id: row.permission_id,
          code: row.code,
          name: row.permission_name,
        });
      }
    }

    res.json({
      code: "Succeed",
      message: "Advance Permissions Fetched Successfully!",
      data: {
        permissions_by_module: result,
      },
    });
  } catch (error) {
    console.error("Server Error:", error);
    res
      .status(500)
      .json({ code: "Error", message: "Server error", data: null });
  }
});

export default advanceRolesRoutes;
