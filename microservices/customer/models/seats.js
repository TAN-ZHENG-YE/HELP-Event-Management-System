const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const Seat = dynamoose.model("seats", {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    event_id: {
        type: String,
        index: {
            name: "EventSeatsIndex",
            global: true,
        },
        required: true,
    },
    seat_section: {
        type: String,
        required: true,
    },
    ticket_type_id: {
        type: String,
        index: {
            name: "TicketSeatsIndex",
            global: true,
        },
        required: true,
    },
    seat_num: {
        type: String,
        required: true,
    },
    seat_status: {
        type: String,
        enum: ["available", "selected", "booked", "unavailable"],
        default: "available",
    },
});

module.exports = Seat