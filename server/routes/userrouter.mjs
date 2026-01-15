import express from "express";
import db from "../db/conn.mjs"
import { ObjectId } from "mongodb";
import { generate_password } from "../auth/passwordauth.mjs";
import passport from "passport";
import { google } from "googleapis";
import 'dotenv/config';

const router = express.Router();

const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';
const GOOGLE_PRIVATE_KEY = process.env.GOOG_PRIVATE_KEY
const GOOGLE_PROJECT_NUMBER = process.env.GOOG_PROJECT_NUMBER
const GOOGLE_CALENDAR_ID = process.env.GOOG_CALENDAR_ID
const GOOGLE_CLIENT_EMAIL = process.env.GOOG_CLIENT_EMAIL

const jwtClient = new google.auth.JWT(
    GOOGLE_CLIENT_EMAIL,
    null,
    GOOGLE_PRIVATE_KEY,
    SCOPES
);

const calendar = google.calendar({
    version: 'v3',
    project: GOOGLE_PROJECT_NUMBER,
    auth: jwtClient
});

//----- GET ROUTES -----//
//get list of users in db
router.get("/", async (req,res) => {
    try {
        let collection = await db.collection("members");
        const members = await collection.find().toArray();
        res.status(200).json(members)
    }catch (err) {
        console.error("Error fetching members: ", err)
        res.status(500).json({ message: err.message})
    }
});

// Visiting this route logs the user out
router.get('/logout', (req, res) => {
    try {
        req.logout(function(err) {
            if (err) {
                return res.status(500).json({message: "Error in logging out user"})
            }
    
            req.session.destroy((err) => {
                if (err) {
                    return res.status(500).json({ message: "Error in destroying session" });
                }
    
                return res.status(200).json({ message: "Logged out successfully" });
            });
        });
    } catch (err) {
        console.error("Error fetching member: ", err)
        return res.status(500).json({ message: err.message})
    }
});

//route to check if user is auth
router.get("/auth", async (req,res) => {
    try {
        console.log("is authed", req.isAuthenticated())

        if (req.isAuthenticated()) {
            return res.status(200).json({ message: "User is authorized.", name: req.user.name })
        } else {
            return res.status(401).json({ message: "You are not authorized to access this page!" })
        }

    } catch (err) {
        console.error("Error fetching member: ", err)
        return res.status(500).json({ message: err.message})
    }
})

//google login
router.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
}));

router.get("/auth/google/callback", async (req,res) => {
    passport.authenticate("google", async(err,user,info) => {
        try {
            let msg = ""
            if (err) {
                console.log("Error during authentication")
                msg = "Error encountered, try again or contact the Admin."
                return res.redirect(`http://localhost:4173/goog-auth-failure/${msg}`)
            }

            if(!user) {
                console.log("User with this email does not exist!")
                msg = "No user exists that is an admin with this email!"
                return res.redirect(`http://localhost:4173/goog-auth-failure/${msg}`)
            }

            req.login(user, (error) => {
                if (error) {
                    console.log("Error during login and setting up session token for user.")
                    msg = "Error during login and setting up session token for user."
                    return res.redirect(`http://localhost:4173/goog-auth-failure/${msg}`)
                }

                console.log(req.session)
                return res.redirect("http://localhost:4173/admin")
            })
        } catch(err) {
            console.error("Error authenticating member: ", err)
            msg = "Error encountered, try again or contact the Admin."
            return res.redirect(`http://localhost:4173/goog-auth-failure/${msg}`)
        }
    })(req, res)
})

//get user by id
router.get("/:id", async (req,res) => {
    if (req.isAuthenticated()) {
        try {
            let collection = await db.collection("members");
            let query = {_id: new ObjectId(req.params.id)};
            const member = await collection.findOne(query);
    
            return res.status(200).json(member)
        }catch (err) {
            console.error("Error fetching member: ", err)
            return res.status(500).json({ message: err.message})
        }
    } else {
        return res.status(401).json({message: "You are not authorized to do this action!"})
    }
});

//----- POST ROUTES -----//

//add new user
router.post("/register", async (req,res) => {
    try {
        if (req.isAuthenticated()) {
            let salt
            let hash

            //add null checkers and other data validation here
            //name, password, email, personal_mobile, ice_mobile, year_of_study, role, allergies

            //if any is null (ie. the optional fields or non applicable, handle in frontend logic)
            //db does not save password as is (unsafe) saves as hash and salt, req.body.password is still here as it is what the user will enter
            if (req.body.role !== "Member") {
                if (req.body.password) {
                    if (req.body.password !== null) {
                        const salt_hash = generate_password(req.body.password)

                        salt = salt_hash.salt
                        hash = salt_hash.hash
                    }
                } else {
                    return res.status(400).json({message: "Admin roles require passwords!"})
                }
            }

            let new_user = {
                name: req.body.name,
                email: req.body.email,
                personal_mobile: req.body.personal_mobile,
                ice_mobile: req.body.ice_mobile,
                year_of_study: req.body.year_of_study,
                role: req.body.role,
                allergies: req.body.allergies,
                hash: hash,
                salt: salt
            };

            let collection = await db.collection("members");

            let check_duplicate_records = await collection.find().toArray()

            for (let i = 0; i < check_duplicate_records.length; i++) {
                if (check_duplicate_records[i].email == req.body.email) {
                    return res.status(400).json({message: "A member with this email already exists!"})
                }
            }

            await collection.insertOne(new_user)

            return res.status(201).json({
                message: "Member added successfully!"
            });
        } else {
            return res.status(401).json({message: "You are not authorized to do this action!"})
        }
        
    }catch (err) {
        console.error("Error adding new member: ", err)
        return res.status(500).json({ message: err.message})
    }
});

//login user
router.post('/login', async (req, res) => { 
    try {
        if (req.isAuthenticated()) {
            return res.status(200).json({ message: "Already logged in" });
        }

        if (req.body.email) {
            let collection = await db.collection("members")

            const member_admin = await collection.findOne({ email: req.body.email })

            if (!member_admin) {
                return res.status(401).json({ message: "No user with this email exists!" })
            }

            if (member_admin.hash == null && member_admin.salt == null) {
                return res.status(401).json({ message: "This user is not an admin!" })
            }
        }

        passport.authenticate("local", (err, user, info) => {
            if (err) {
                return res.status(500).json({ message: err.message })
            }

            if (!user) {
                return res.status(401).json({ message: info.message || "Authentication failed" })
            }

            req.login(user, (error) => {
                if (error) {
                    return res.status(500).json({ message: "Failed to log in" })
                }

                console.log(req.session)
                return res.status(200).json({ message: "User authenticated successfully" })
            })
        })(req, res)
    } catch (err) {
        console.error("Error authenticating member: ", err)
        return res.status(500).json({ message: err.message})
    }
});

//----- PATCH ROUTES -----//

//update user details
router.patch("/:id", async (req,res) => {
    try {
        if (req.isAuthenticated()) {
            let updated_data

            if (req.body.role == "Member") { //if role is set to member, no password is needed as they are not admin role, hence salt and hash are overriden to null
                updated_data = {
                    $set: {
                        name: req.body.name,
                        email: req.body.email,
                        personal_mobile: req.body.personal_mobile,
                        ice_mobile: req.body.ice_mobile,
                        year_of_study: req.body.year_of_study,
                        role: req.body.role,
                        allergies: req.body.allergies,
                        salt: null,
                        hash: null
                    }
                };
            } else if (req.body.password) { //if role is not set to member and if there is a password in the req.body
                if (req.body.password !== null) { //if the password is not null
                    const salt_hash = generate_password(req.body.password) //generate password and register normally

                    let salt
                    let hash

                    salt = salt_hash.salt
                    hash = salt_hash.hash

                    updated_data = {
                        $set: {
                            name: req.body.name,
                            email: req.body.email,
                            personal_mobile: req.body.personal_mobile,
                            ice_mobile: req.body.ice_mobile,
                            year_of_study: req.body.year_of_study,
                            role: req.body.role,
                            allergies: req.body.allergies,
                            salt: salt,
                            hash: hash
                        }
                    };
                } else { //if req.body.role is not member (meaning the member is an admin role already) and in the event password is somehow null (should not be happening) as a failsafe just set it as no password
                    updated_data = {
                        $set: {
                            name: req.body.name,
                            email: req.body.email,
                            personal_mobile: req.body.personal_mobile,
                            ice_mobile: req.body.ice_mobile,
                            year_of_study: req.body.year_of_study,
                            role: req.body.role,
                            allergies: req.body.allergies,
                            salt: null,
                            hash: null
                        }
                    };
                }
            } else { //if req.body.role is not member but no password is present in req.body (meaning there is no intention to update the password), do as per normal (updating rest of fields)
                updated_data = {
                    $set: {
                        name: req.body.name,
                        email: req.body.email,
                        personal_mobile: req.body.personal_mobile,
                        ice_mobile: req.body.ice_mobile,
                        year_of_study: req.body.year_of_study,
                        role: req.body.role,
                        allergies: req.body.allergies,
                    }
                };
            }

            const query = { _id: new ObjectId(req.params.id) };

            //updating of password only can be done by admin,
            //the ui will not have the current password available as the password is hashed and salted and then
            //stored in the database for safety purposes (you cant unencrypt the password as that is how hashing and salting works)

            let collection = await db.collection("members");
            

            if (req.body.role !== "Member") {
                let check_record = await collection.findOne(query)

                if ((check_record.salt == null || check_record.hash == null) && req.body.password == null) {
                    return res.status(400).json({ message: "Admin roles require a password to be inputted! If you just made this member a admin, do edit the password!"})
                }
            }

            let check_duplicate_records = await collection.find().toArray()

            for (let i = 0; i < check_duplicate_records.length; i++) {
                if (check_duplicate_records[i].email == req.body.email) {
                    if (check_duplicate_records[i]._id.toString() == query._id.toString()) {
                        continue
                    } else {
                        return res.status(400).json({message: "A member with this email already exists!"})
                    }
                }
            }

            await collection.updateOne(query, updated_data);

            return res.status(200).json({
                message: "Member updated successfully!"
            });
        } else {
            return res.status(401).json({message: "You are not authorized to do this action!"})
        }
    } catch(err) {
        console.error("Error updating member: ", err)
        return res.status(500).json({ message: err.message})
    }
    
});

//----- DELETE ROUTES -----//

//deleting user
router.delete("/:id", async (req,res) => {
    try {
        if (req.isAuthenticated()) {
            try {
                const query = { _id: new ObjectId(req.params.id) };
        
                const collection = db.collection("members");
        
                let check = await collection.findOne(query)
        
                if (!check) {
                    return res.status(400).json({
                        message:"Member does not exist!"
                    })
                } else {
                    await collection.deleteOne(query);
        
                    return res.status(200).json({
                        message: "Member deleted successfully!"
                    });
                }
            } catch (err) {
                console.error("Error deleting member: ", err)
                return res.status(500).json({ message: err.message })
            }
        } else {
            return res.status(401).json({message: "You are not authorized to do this action!"})
        }
    } catch(err) {
        console.error("Error updating member: ", err)
        return res.status(500).json({ message: err.message})
    }
    
});

export default router;
