const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const User = dynamoose.model('users', {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    user_name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        index: {
            name: "EmailIndex",
            global: true
        },
    },
    password: { type: String, required: true },
    phone_num: { type: String },
    user_type: { type: String, enum: ['attendee', 'organizer', 'admin'], required: true },
    organization_name: { type: String },
    first_time_login: { type: Boolean, default: true }
});

module.exports = User