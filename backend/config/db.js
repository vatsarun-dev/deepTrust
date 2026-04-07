const mongoose = require("mongoose");

let databaseStatus = {
  connected: false,
  message: "Database not connected yet.",
};

async function connectDB() {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    databaseStatus = {
      connected: false,
      message: "MONGO_URI is not defined in the environment.",
    };
    console.warn(databaseStatus.message);
    return null;
  }

  try {
    const connection = await mongoose.connect(mongoUri);
    databaseStatus = {
      connected: true,
      message: `MongoDB connected: ${connection.connection.host}`,
    };
    console.log(`MongoDB connected: ${connection.connection.host}`);
    return connection;
  } catch (error) {
    databaseStatus = {
      connected: false,
      message: `MongoDB connection error: ${error.message}`,
    };
    console.error(`MongoDB connection error: ${error.message}`);
    return null;
  }
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

function getDatabaseStatus() {
  return {
    connected: isDatabaseReady() || databaseStatus.connected,
    message: databaseStatus.message,
    readyState: mongoose.connection.readyState,
  };
}

module.exports = connectDB;
module.exports.isDatabaseReady = isDatabaseReady;
module.exports.getDatabaseStatus = getDatabaseStatus;
