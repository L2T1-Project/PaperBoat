const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
	cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadBufferToCloudinary = (buffer, options) =>
	new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
			if (error) return reject(error);
			return resolve(result);
		});
		stream.end(buffer);
	});

const uploadUserProfileImage = async (buffer, userId, mimeType = "image/jpeg") => {
	if (!buffer) {
		throw new Error("No file buffer provided");
	}

	const format = (mimeType?.split("/")?.[1] || "jpg").replace("jpeg", "jpg");

	const result = await uploadBufferToCloudinary(buffer, {
		folder: "paperboat/profile_images",
		public_id: `user_${userId}_${Date.now()}`,
		overwrite: true,
		resource_type: "image",
		format,
		transformation: [
			{ width: 600, height: 600, crop: "limit" },
			{ quality: "auto" },
			{ fetch_format: "auto" },
		],
	});

	return result.secure_url;
};

module.exports = {
	uploadUserProfileImage,
};
