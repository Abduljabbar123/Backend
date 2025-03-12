import mongoose, {Schema} from "mongoose";
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        lowercase : true,
        trim : true,
        index : true,   // it optimize the searching in database
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase : true,
        trim : true,
    },
    fullname: {
        type: String,
        required: true,
        trim : true,
        index: true,
    },
    avatar: {
        type: String,   // cloudinary
        required: true,
    },
    coverImage : {
        type: String,   // cloudinary
    },
    watchHistory : {
        type: Schema.Types.ObjectId,
        ref: "Video",
    }
    password: {
        type: String,
        required: [true, "Password is required"],
    },
    refreshToken : {
        type: String,
    }
 },
 {
    timestamps: true,
 }
)

// save password as hash just before saving
// one problem when the data save it changes the password so solve this problem by using if/else to check the password is modified

userSchema.pre("save", async function(next) {
    if(!this.isModified("password")) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
})


// For Desinging Custom Methods
// userSchema.methods.comparePassword = async function(password) {
//     const isMatch = await bcrypt.compare(password, this.password);
//     return isMatch;
// }


// To compare password is correct or not
userSchema.methods.isPasswordCorrect = async function(password) {
    const isMatch = await bcrypt.compare(password, this.password);
    return isMatch;
}

userSchema.methods.generateRefreshToken = async function() {
  return jwt.sign({_id: this._id}, process.env.REFRESH_TOKEN_SECRET, {expiresIn: process.env.REFRESH_TOKEN_EXPIRY})
}

userSchema.generateAccessToken = async function() {
   return jwt.sign({_id: this._id, username: this.username, email: this.email, fullname: this.fullname}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: process.env.ACCESS_TOKEN_EXPIRY})
}

export default mongoose.model("User", userSchema);