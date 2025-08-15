import express from "express";
import cors from "cors";
import authRouter from "./routes/authRoutes.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/v1", authRouter);

app.listen(process.env.VITE_API_BACKEND_PORT, () => {
  console.log(
    `The server has been running on port ${process.env.VITE_API_BACKEND_PORT}`
  );
});
