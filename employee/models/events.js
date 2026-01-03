const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const Event = dynamoose.model("events", {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    organizer_name: { type: String, required: true },
    event_name: { type: String, required: true },
    event_date_time: { type: String, required: true },
    event_duration: { type: String, required: true },
    event_description: { type: String, required: true },
    event_image: { type: String },
    is_public: { type: Boolean, default: false },
});

module.exports = Event;