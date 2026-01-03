const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const SeatBooking = dynamoose.model('seatbookings', {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId()
    },
    seat_id: {
        type: String,
        required: true
    },
    payment_id: {
        type: String,
        required: true,
        index: { name: "PaymentIndex", global: true },
    }
});

module.exports = SeatBooking