const mongoose = require("mongoose");

let databaseStatus = {
  connected: false,
  message: "Database not connected yet.",
  database: null,
};
let connectionPromise = null;

function getCanonicalDatabaseName() {
  // Atlas database names are case-sensitive. Existing DeepTrust data is in this
  // database, so every model must share this one name regardless of URI casing.
  return String(process.env.MONGODB_DB_NAME || "DeepTrust").trim() || "DeepTrust";
}

function getMongoUri() {
  return String(process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();
}

async function connectDB() {
  const mongoUri = getMongoUri();
  const database = getCanonicalDatabaseName();

  if (!mongoUri) {
    databaseStatus = {
      connected: false,
      message: "MONGODB_URI is not defined in the environment.",
      database,
    };
    console.warn(databaseStatus.message);
    return null;
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(mongoUri, {
        dbName: database,
        serverSelectionTimeoutMS: 10000,
      })
      .then((connection) => {
        databaseStatus = {
          connected: true,
          database: connection.connection.name,
          message: `MongoDB connected: ${connection.connection.host}/${connection.connection.name}`,
        };
        console.log(`[DB] Connected: ${connection.connection.host}/${connection.connection.name}`);
        return connection;
      })
      .catch((error) => {
        databaseStatus = {
          connected: false,
          database,
          message: `MongoDB connection error: ${error.message}`,
        };
        console.error(`[DB] Connection error: ${error.message}`);
        return null;
      })
      .finally(() => {
        connectionPromise = null;
      });
  }

  return connectionPromise;
}

function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

function getDatabaseStatus() {
  return {
    connected: isDatabaseReady() || databaseStatus.connected,
    message: databaseStatus.message,
    readyState: mongoose.connection.readyState,
    database: mongoose.connection.name || databaseStatus.database || getCanonicalDatabaseName(),
  };
}

module.exports = connectDB;
module.exports.isDatabaseReady = isDatabaseReady;
module.exports.getDatabaseStatus = getDatabaseStatus;
module.exports.getCanonicalDatabaseName = getCanonicalDatabaseName;
