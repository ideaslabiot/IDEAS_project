import passport from "passport";
import db from "../db/conn.mjs"
import LocalStrategy from "passport-local"
import {OAuth2Strategy as GoogleStrategy} from "passport-google-oauth"
import { valid_password } from "./passwordauth.mjs"
import { ObjectId } from "mongodb";
import 'dotenv/config';

passport.use(new LocalStrategy({usernameField: 'email', passwordField: 'password'}, async function verify(email, password, cb) {
    try {
        let user = await db.collection("members").findOne({email: email})

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


/*passport.use(new GoogleStrategy({
    clientID: process.env.GOOG_CLIENT_ID, 
    clientSecret: process.env.GOOG_CLIENT_SECRET, 
    callbackURL: "http://localhost:5050/members/auth/google/callback"
}, async (accesstoken, refreshtoken, profile, done) => {
    try {
        let user = await db.collection("members").findOne({email: profile.emails[0].value})
        console.log(profile.emails[0].value)

        if (!user) {
            return done(null, false, {message: "No admin account associated with this email."}) 
        } else {
            return done(null, user)
        }
    } catch (err) {
        console.log(err)
        return done(err, null)
    }
}))*/

passport.serializeUser((user, done) => {
    console.log("Serializing user:", user); 
    done(null,user._id)
})

passport.deserializeUser(async (user_id, done) => {
    console.log("Deserializing user ID:", user_id);
    try {
        let user = await db.collection("members").findOne({_id: new ObjectId(user_id)}) 
        done(null, user)
    } catch(err) {
        done(err)
    }
})
