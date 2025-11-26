import express, { urlencoded } from "express";
import cors from "cors";
import session from "express-session"
import MongoStore from "connect-mongo";
import passport from "passport";
// import "./auth/passport.mjs"
import 'dotenv/config';
import 'http';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// import userrouter from "./routes/userrouter.mjs";
import lightsrouter from "./routes/lightsrouter.mjs";
import pcrouter from "./routes/pcrouter.mjs";
import projectorrouter from "./routes/projecterrouter.mjs";
import screensrouter from "./routes/screensrouter.mjs";
import devicerouter from "./routes/devicerouter.mjs";

// CHECK ideascomment (IDC) for changes and notes

const PORT = process.env.PORT || 5050;
const hostname = "192.168.1.199" //IDC: replace with wtv static ip we are using
const app = express();

app.use(cors( {
    origin: ["http://localhost:5173", "http://localhost:4173"],
    credentials: false //IDC: should disable credentials needer for now?
}));
app.use(express.json());
app.use(urlencoded({extended: true}))

// app.use(session({
//     secret: process.env.SESSION_SECRET,
//     resave: false,
//     saveUninitialized: false,
//     store: MongoStore.create({
//         mongoUrl: 'mongodb://localhost:27017/ideas_db',
//         autoRemove: 'native'
//     }),
//     cookie: {
//         maxAge: 24 * 60 * 60 * 1000, //24 hours till it will expire
//         sameSite: 'strict'
//     }
// }))
 
// app.use(passport.initialize())
// app.use(passport.session())
//IDC disable passportjs for auth for now


// app.use("/users", userrouter);
app.use("/device",devicerouter)
app.use("/lights", lightsrouter)
app.use("/projector", projectorrouter)
app.use("/computer", pcrouter)
app.use("/screens", screensrouter)

import path from 'path';

const options = {
    root: __dirname
}
app.get("/",(req,res) => {
    res.sendFile('test.html', options);
})

//Starting the Express Server
app.listen(PORT,hostname, () => {
    console.log(`Server is running on port: http://${hostname}:${PORT}`);
});
