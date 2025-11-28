import "dotenv/config";
import mongoose from "mongoose";
import bcryptjs from "bcryptjs";
import { Admin } from "../src/models/Admin.js";
import { connectMongo } from "../src/config/mongo.js";

// Admin test data
const adminData = [
  {
    fullName: "Admin Manager",
    username: "admin",
    email: "admin@travel.com",
    password: "Admin@12345",
    address: "123 Main Street, City"
  },
  {
    fullName: "Super Admin",
    username: "superadmin",
    email: "superadmin@travel.com",
    password: "SuperAdmin@12345",
    address: "456 Admin Avenue, City"
  }
];

async function seedAdmin() {
  try {
    console.log("🔄 Starting admin seed...");
    
    // Connect to MongoDB
    await connectMongo();
    console.log("✅ MongoDB connected");

    // Clear existing admins (optional - comment out if you want to keep existing data)
    const deletedCount = await Admin.deleteMany({});
    console.log(`🗑️  Deleted ${deletedCount.deletedCount} existing admins`);

    // Hash passwords and create admins
    const adminsToCreate = [];
    for (const admin of adminData) {
      const hashedPassword = await bcryptjs.hash(admin.password, 10);
      adminsToCreate.push({
        ...admin,
        password: hashedPassword
      });
      console.log(`🔐 Password hashed for admin: ${admin.username}`);
    }

    // Insert admins
    const createdAdmins = await Admin.insertMany(adminsToCreate);
    console.log(`✅ Successfully created ${createdAdmins.length} admin(s)`);

    // Log created admins (without showing passwords)
    console.log("\n📋 Created Admins:");
    console.log("=".repeat(60));
    createdAdmins.forEach((admin, index) => {
      console.log(`\n${index + 1}. Admin Details:`);
      console.log(`   ID: ${admin._id}`);
      console.log(`   Full Name: ${admin.fullName}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Address: ${admin.address}`);
      console.log(`   Created At: ${admin.createdDate}`);
    });
    console.log("\n" + "=".repeat(60));

    // Test login credentials
    console.log("\n🔑 Test Login Credentials:");
    console.log("=".repeat(60));
    adminData.forEach((admin, index) => {
      console.log(`\n${index + 1}. Login Test:`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Password: ${admin.password}`);
      console.log(`   Email: ${admin.email}`);
    });
    console.log("\n" + "=".repeat(60));

    console.log("\n✨ Admin seed completed successfully!");
    
  } catch (error) {
    console.error("❌ Error seeding admin:", error.message);
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.disconnect();
    console.log("🔌 MongoDB disconnected");
    process.exit(0);
  }
}

seedAdmin();
