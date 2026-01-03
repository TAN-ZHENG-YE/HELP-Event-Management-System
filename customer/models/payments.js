const crypto = require('crypto');
const dynamoose = require('dynamoose');

function generateObjectId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16);
    const random1 = crypto.randomBytes(4).toString("hex");
    const random2 = crypto.randomBytes(4).toString("hex");

    return timestamp + random1 + random2;
}

const Payment = dynamoose.model("payments", {
    _id: {
        type: String,
        hashKey: true,
        default: () => generateObjectId(),
    },
    transaction_num: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
        index: { name: "UserIndex", global: true },
    },
    total_price: {
        type: Number,
        required: true,
    },
    purchase_time: {
        type: String,
        default: () => new Date().toISOString(),
    },
    payment_type: {
        type: String,
        enum: ["fpx", "paypal", "tng", "visa"],
        required: true,
    },
    payment_status: {
        type: String,
        enum: ["completed", "failed", "cancelled"],
        required: true,
    },
    promo_code_id: {
        type: String,
    },
    event_id: {
        type: String,
        required: true,
    },
});

module.exports = Payment;