import express from "express";
import cors from "cors";

const app = express();

app.use(cors());

app.get("/api/hello", (_req, res) => {
  res.json({
    message: "Hello from Node.js Backend!",
  });
});

export default app;