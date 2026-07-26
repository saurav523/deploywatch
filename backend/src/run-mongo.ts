import path from "path";
import fs from "fs";

// Configure paths on the D drive
const downloadDir = "d:\\.mongodb-binaries";
const dbPath = "d:\\.mongodb-data";

// Set environment variable so mongodb-memory-server knows where to download binaries
process.env.MONGOMS_DOWNLOAD_DIR = downloadDir;

import { MongoMemoryServer } from "mongodb-memory-server";

async function startMongo() {
  console.log(`Setting MONGOMS_DOWNLOAD_DIR to: ${downloadDir}`);
  
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  console.log("Starting MongoDB Memory Server with persistent WiredTiger engine...");
  try {
    const mongoServer = await MongoMemoryServer.create({
      instance: {
        port: 27017,
        dbPath: dbPath,
        storageEngine: "wiredTiger",
      },
    });
    console.log(`MongoDB started successfully on: ${mongoServer.getUri()}`);
    console.log(`Data directory: ${dbPath}`);
    console.log("Keep this process running to maintain database availability.");
  } catch (error) {
    console.error("Failed to start MongoDB Memory Server:", error);
    process.exit(1);
  }
}

startMongo();
