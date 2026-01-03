const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const Ticket = dynamoose.model("tickets", {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    event_id: {
        type: String,
        index: {
            name: "EventTicketsIndex",
            global: true, // GSI for querying by event_id
        },
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    max_num: {
        type: Number,
        required: true,
    },
    total_seats_assigned: {
        type: Number,
        default: 0,
    },
    available_quantity: {
        type: Number,
        default: 0,
    },
});

module.exports = Ticket