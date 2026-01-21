import express from "express";
import db from "../db/conn.mjs"
import { ObjectId } from "mongodb";
import { generate_password } from "../auth/passwordauth.mjs";
import passport from "passport";
import 'dotenv/config';

const router = express.Router();

//----- GET ROUTES -----//
//get list of users in db
// router.get("/", async (req,res) => {
//     try {
//         let collection = await db.collection("members");
//         const members = await collection.find().toArray();
//         res.status(200).json(members)
//     }catch (err) {
//         console.error("Error fetching members: ", err)
//         res.status(500).json({ message: err.message})
//     }
// });

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
// router.post("/register", async (req,res) => {
//     try {
//         req.isAuthenticated()
//         if (true) {
//             let salt
//             let hash

//             //add null checkers and other data validation here
//             //name, password, email

//             //db does not save password as is (unsafe) saves as hash and salt, req.body.password is still here as it is what the user will enter
//             if (req.body.password) {
//                 if (req.body.password !== null) {
//                     const salt_hash = generate_password(req.body.password)

//                     salt = salt_hash.salt
//                     hash = salt_hash.hash
//                 }
//             } else {
//                 return res.status(400).json({ message: "Users require passwords!" })
//             }

//             let new_user = {
//                 name: req.body.name,
//                 email: req.body.email,
//                 hash: hash,
//                 salt: salt
//             };

//             let collection = await db.collection("users");

//             let check_duplicate_records = await collection.find().toArray()

//             for (let i = 0; i < check_duplicate_records.length; i++) {
//                 if (check_duplicate_records[i].email == req.body.email) {
//                     return res.status(400).json({message: "A member with this email already exists!"})
//                 }
//             }

//             await collection.insertOne(new_user)

//             return res.status(201).json({
//                 message: "Member added successfully!"
//             });
//         } else {
//             return res.status(401).json({message: "You are not authorized to do this action!"})
//         }
        
//     }catch (err) {
//         console.error("Error adding new member: ", err)
//         return res.status(500).json({ message: err.message})
//     }
// });

//login user
router.post('/login', async (req, res) => { 
    try {
        if (req.isAuthenticated()) {
            return res.status(200).json({ message: "Already logged in" });
        }

        if (req.body.email) {
            let collection = await db.collection("users")

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
// router.patch("/:id", async (req,res) => {
//     try {
//         if (req.isAuthenticated()) {
//             let updated_data
//             const query = { _id: new ObjectId(req.params.id) };

//             updated_data = {
//                 $set: {
//                     name:req.body.name,
//                     email:req.body.email
//                 }
//             }

//             if (req.body.password) {
//                 const {salt, hash} = generate_password(req.body.password)
//                 updated_data.$set.salt = salt;
//                 updated_data.$set.hash = hash
//             } 

//             //updating of password only can be done by admin,
//             //the ui will not have the current password available as the password is hashed and salted and then
//             //stored in the database for safety purposes (you cant unencrypt the password as that is how hashing and salting works)

//             let collection = await db.collection("users");
            
//             let check_record = await collection.findOne(query)

//             if ((check_record.salt == null || check_record.hash == null) && req.body.password == null) {
//                 return res.status(400).json({ message: "User roles require a password!"})
//             }


//             let check_duplicate_records = await collection.find().toArray()

//             for (let i = 0; i < check_duplicate_records.length; i++) {
//                 if (check_duplicate_records[i].email == req.body.email) {
//                     if (check_duplicate_records[i]._id.toString() == query._id.toString()) {
//                         continue
//                     } else {
//                         return res.status(400).json({message: "A member with this email already exists!"})
//                     }
//                 }
//             }

//             await collection.updateOne(query, updated_data);

//             return res.status(200).json({
//                 message: "Member updated successfully!"
//             });
//         } else {
//             return res.status(401).json({message: "You are not authorized to do this action!"})
//         }
//     } catch(err) {
//         console.error("Error updating member: ", err)
//         return res.status(500).json({ message: err.message})
//     }
    
// });

//----- DELETE ROUTES -----//

//deleting user
// router.delete("/:id", async (req,res) => {
//     try {
//         if (req.isAuthenticated()) {
//             try {
//                 const query = { _id: new ObjectId(req.params.id) };
        
//                 const collection = db.collection("users");
        
//                 let check = await collection.findOne(query)
        
//                 if (!check) {
//                     return res.status(400).json({
//                         message:"Member does not exist!"
//                     })
//                 } else {
//                     await collection.deleteOne(query);
        
//                     return res.status(200).json({
//                         message: "Member deleted successfully!"
//                     });
//                 }
//             } catch (err) {
//                 console.error("Error deleting member: ", err)
//                 return res.status(500).json({ message: err.message })
//             }
//         } else {
//             return res.status(401).json({message: "You are not authorized to do this action!"})
//         }
//     } catch(err) {
//         console.error("Error updating member: ", err)
//         return res.status(500).json({ message: err.message})
//     }
    
// });

export default router;
