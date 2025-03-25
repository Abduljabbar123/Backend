import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const registerUser = asyncHandler(async (req, res) => {
  // get user detail
  // validation - not empty
  // check if user is already exist
  // check for images, check for avatar
  // upload them to uploadOnCloudinary
  // create user object
  // create entry in database
  // remove password and refresh token feild from response
  // check for user creation.
  // return response.

  const { fullName, email, username, password } = req.body;
  console.log("data ::", fullName, email, username, password);

  if (
    [fullName, email, username, password].some((feild) => feild?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters");
  }
  if (fullName == "") {
    throw new ApiError(400, "Full name is required");
  }
  if (email == "") {
    throw new ApiError(400, "Email is required");
  }
  if (username == "") {
    throw new ApiError(400, "Username is required");
  }

  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User already exist");
  }

  const avatarLocalPath = req.files?.avatar[0].path;
  const coverImageLocalPath = req.files?.coverImage[0].path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  avatar && console.log("avatar is uploaded on cloudinary", avatar);
  coverImage && console.log("coverImage is uploaded on cloudinary", coverImage);

  const user = await User.create({
    fullName,
    email,
    username: username.toLowerCase(),
    password,
    avatar: avatar.url || "",
    coverImage: coverImage.url || "",
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw new ApiError(400, "Something went wrong while registering user");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User created successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // user login
  // get data from request
  // find the user
  // password check
  // accessa and refresh token
  // send cookie

  const { email, username, password } = req.body;

  console.log("Username", username);
  console.log("Email", email);
  console.log("Password", password);

  if (!email && !username) {
    throw new ApiError(400, "Email or username is required");
  }
  if (!password) {
    throw new ApiError(400, "Password is required");
  }

  if (username || email) {
    const user = await User.findOne({ $or: [{ username }, { email }] });
    if (!user) {
      throw new ApiError(401, "User not found");
    }
    const isPasswordCorrect = await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      throw new ApiError(401, "Password is incorrect");
    }

    const { accessToken, refreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const findUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!findUser) {
      throw new ApiError(400, "Something went wrong while login user");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { user: findUser, accessToken, refreshToken },
          "Login successful"
        )
      );
  }
});

const generateAccessTokenAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };

    if (!user) {
      throw new ApiError(404, "User not found");
    }
    return accessToken;
  } catch (error) {
    throw error;
  }
};

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    { $set: { refreshToken: undefined } },
    { new: true }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", "", options)
    .clearCookie("refreshToken", "", options)
    .json(new ApiResponse(200, {}, "Logout successful"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incommingRefreshToken = req.cookies.refreshToken || req.body;
  if (!incommingRefreshToken) {
    throw new ApiError(401, "Refresh token is required");
  }

  try {
    const decoded = jwt.verify(
      incommingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decoded._id);
    if (!user) {
      throw new ApiError(401, "User not found, Invalid Refresh token");
    }

    if (user.refreshToken !== incommingRefreshToken) {
      throw new ApiError(401, "User Invalid Refresh token");
    }

    const { accessToken, newRefreshToken } =
      await generateAccessTokenAndRefreshToken(user._id);

    const options = {
      httpOnly: true,
      secure: true,
    };
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid Refresh token");
  }
});

const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(401, "Old password is incorrect");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const gerCurrentUser = asyncHandler(async (req, res) => {
  return res.status(200).json(new ApiResponse(200, req.user, "User found"));
});

const updateUser = asyncHandler(async (req, res) => {
  const { username, email, avatar, coverImage } = req.body;
  const user = await User.findById(req.user._id);
  user.username = username;
  user.email = email;
  user.avatar = avatar;
  user.coverImage = coverImage;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User updated successfully"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarFilePath = req.file.path;

  if (!avatarFilePath) {
    throw new ApiError(400, "Avatar is required");
  }

  const avatar = await uploadOnCloudinary(avatarFilePath);

  if (!avatar?.url) {
    throw new ApiError(400, "Something went wrong while uploading avatar");
  }

  const user = await User.findById(req.user._id);
  if (!user) {
    throw new ApiError(400, "Something went wrong while updating avatar");
  }

  user.avatar = avatar.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageFilePath = req.file.path;

  if (!coverImageFilePath) {
    throw new ApiError(400, "Cover image is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageFilePath);

  if (!coverImage?.url) {
    throw new ApiError(400, "Something went wrong while uploading cover image");
  }

  const user = await User.findById(req.user._id); // Replace with the actual user ID

  if (!user) {
    throw new ApiError(400, "Something went wrong while updating cover image");
  }

  user.coverImage = coverImage.url;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"));
});

export {
  registerUser,
  loginUser,
  refreshAccessToken,
  logoutUser,
  changePassword,
  gerCurrentUser,
  updateUser,
  updateUserAvatar,
  updateUserCoverImage,
};
