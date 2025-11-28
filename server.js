import "dotenv/config";
import app from "./src/app.js";
import { connectMongo } from "./src/config/mongo.js";

const PORT = process.env.PORT || 4000;

connectMongo().then(() => {
  app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
}).catch(err => {
  console.error("❌ Mongo connect error:", err.message);
  process.exit(1);
});
