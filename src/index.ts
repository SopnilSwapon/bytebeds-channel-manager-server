import express from "express";
import cors from "cors";
import authRouter from "./routes/authRoutes.js";
import advanceUsersRoutes from "./routes/advanceUsersRoutes.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(express.json());

app.use("/api/v1", authRouter);
app.use("/api/v1", advanceUsersRoutes);

app.listen(process.env.VITE_API_BACKEND_PORT, () => {
  console.log(
    `The server has been running on port ${process.env.VITE_API_BACKEND_PORT}`
  );
});
