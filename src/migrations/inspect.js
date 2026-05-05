import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

async function inspect() {
  await mongoose.connect(process.env.MONGODB_URI);
  const b = await mongoose.connection.collection('tbl_booking').findOne({ code: { $exists: false } });
  console.log(JSON.stringify(b, null, 2));
  process.exit(0);
}

inspect();
