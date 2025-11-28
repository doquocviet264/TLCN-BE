import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  process.env.DB_NAME || "travela",
  process.env.DB_USER || "root",
  process.env.DB_PASS || "1234",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "mysql",
    logging: false,
    
  }
);

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ MySQL connected!");
  } catch (err) {
    console.error("❌ DB connect error:", err.message);
  }
};