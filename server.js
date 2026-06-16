import "dotenv/config";
import { createServer } from "http";
import app from "./src/app.js";
import { connectMongo } from "./src/config/mongo.js";
import { initSocket } from "./src/socket.js";

const PORT = process.env.PORT || 4000;

const httpServer = createServer(app);
initSocket(httpServer);

connectMongo().then(() => {
  httpServer.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
}).catch(err => {
  console.error("❌ Mongo connect error:", err.message);
  process.exit(1);
});
