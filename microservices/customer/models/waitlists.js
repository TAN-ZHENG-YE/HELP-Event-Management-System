const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const Waitlist = dynamoose.model('waitlists', {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    event_id: {
        type: String,
        required: true,
        index: {
            name: "EventIndex",
            global: true
        },
    },
    user_id: {
        type: String,
        required: true,
        index: {
            name: "UserIndex",
            global: true
        },
    },
    registration_time: {
        type: String,
        default: () => new Date().toISOString(),
    }
});

module.exports = Waitlist