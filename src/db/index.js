import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_NAME}`
    );
    console.log("Database connected", connectionInstance.connection.config);
  } catch (error) {
    console.log(error);
    // what does this means
    process.exit(1);
  }
};

export { connectDB };
