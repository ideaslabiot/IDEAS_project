import passport from "passport";
import db from "../db/conn.mjs"
import LocalStrategy from "passport-local"
import { valid_password } from "./passwordauth.mjs"
import { ObjectId } from "mongodb";
import 'dotenv/config';

passport.use(new LocalStrategy({usernameField: 'email', passwordField: 'password'}, async function verify(email, password, cb) {
    try {
        let user = await db.collection("users").findOne({email: email})

        if (!user) {
            return cb(null, false, {message: "Incorrect email or password."})
        }

        const validated = valid_password(password, user.hash, user.salt)

        if (validated) {
            return cb(null, user)
        } else {
            return cb(null, false, {message: "Incorrect email or password."})
        }

    } catch(err) {
        return cb(err)
    }
}))

passport.serializeUser((user, done) => {
    console.log("Serializing user:", user); 
    done(null,user._id)
})

passport.deserializeUser(async (user_id, done) => {
    console.log("Deserializing user ID:", user_id);
    try {
        let user = await db.collection("users").findOne({_id: new ObjectId(user_id)}) 
        done(null, user)
    } catch(err) {
        done(err)
    }
})
