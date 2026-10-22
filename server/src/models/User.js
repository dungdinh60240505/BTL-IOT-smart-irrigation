const { Schema, model } = require('mongoose');

const userSchema = new Schema(
	{
		username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3, maxlength: 40 },
		password: { type: String, required: true, select: false },
		priority: { type: Number },
		status_online: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

module.exports = model('User', userSchema);
