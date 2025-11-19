import { MongoClient } from "mongodb";

const client = new MongoClient("mongodb://localhost:27017/");

let conn;
try{
    console.log("Connecting to Local MongoDB");
    conn = await client.connect();

    console.log("Connected successfully to MongoDB");

} catch(err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1); //exits the process with error code 1
}

const db = conn.db("ideas_db")

//using event listeners to monitor connection status
client.on("serverOpening", () => console.log("MongoDB server connection opened"));
client.on("serverClosed", () => console.log("MongoDB server connection closed"));
client.on("serverDescriptionChanged", (event) => console.log("MongoDB server description changed: ", event));

export default db;
