import crypto from "node:crypto"


function valid_password(password, hash, salt) {
    var verify_hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString("hex")
    return hash === verify_hash
}

function generate_password(password) {
    var salt = crypto.randomBytes(32).toString("hex")
    var generated_hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString("hex")

    return {salt: salt, hash: generated_hash}
}

export {valid_password, generate_password}