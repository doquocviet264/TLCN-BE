import mongoose from "mongoose";

const uri = "mongodb+srv://hieu:Hieu01032004.@cluster0.dbiooay.mongodb.net/travela?retryWrites=true&w=majority";
import { Tour } from "./src/models/Tour.js";

export const test = async () => {
  await mongoose.connect(uri);

  const pipeline = [
    { $match: { startDate: { $exists: true }, endDate: { $exists: true } } },
    {
      $addFields: {
        durationMs: { $subtract: ["$endDate", "$startDate"] },
      }
    },
    {
      $addFields: {
        // Cộng thêm 1 ngày vì từ 1/1 đến 2/1 là 2 ngày 1 đêm (gói gọn trong 2 ngày)
        durationDays: { $add: [{ $round: [{ $divide: ["$durationMs", 1000 * 60 * 60 * 24] }, 0] }, 1] }
      }
    },
    { $limit: 3 },
    { $project: { title: 1, startDate: 1, endDate: 1, durationMs: 1, durationDays: 1, time: 1 } }
  ];

  const docs = await Tour.aggregate(pipeline);
  console.log(JSON.stringify(docs, null, 2));

  mongoose.disconnect();
};

test().catch(console.error);
