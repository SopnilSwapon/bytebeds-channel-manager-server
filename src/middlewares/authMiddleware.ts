import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface IJwtPayLoad {
  id: number;
}

export interface IAuthenticatedRequest extends Request {
  user: IJwtPayLoad;
}

export const authMiddleware = (
  req: IAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res
        .status(401)
        .json({ code: "NO_TOKEN", message: "No token provided" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ code: "INVALID_TOKEN", message: "Invalid token formate" });
    }
    const secretKey = process.env.JWT_SECRET_KEY;
    if (!secretKey) {
      throw new Error("JWT secret key missing");
    }
    const decoded = jwt.verify(token, secretKey) as IJwtPayLoad;
    req.user = decoded;
    next();
  } catch (error) {
    console.log("Auth error", error);
    return res
      .status(401)
      .json({ code: "UNAUTHORIZED", message: "Unauthorized" });
  }
};
