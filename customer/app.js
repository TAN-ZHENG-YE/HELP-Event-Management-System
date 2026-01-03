const express = require('express');
const cors = require('cors');
const dynamoose = require('dynamoose');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

const User = require('./models/users.js');
const Event = require('./models/events.js');
const Ticket = require('./models/tickets.js');
const Seat = require('./models/seats.js');
const Payment = require('./models/payments.js');
const SeatBooking = require('./models/seatbookings.js');
const Waitlist = require('./models/waitlists.js');

const app = express();

app.use(cors());
app.use(express.json());

const ddb = new dynamoose.aws.ddb.DynamoDB({
    credentials: {
        "accessKeyId": "ID",
        "secretAccessKey": "SECRET"
    },
    region: "us-east-1",
    endpoint: process.env.APP_DB_HOST
});
dynamoose.aws.ddb.set(ddb);

function errorHandler(res, err, msg) {
    console.error(msg + '\n', err);
    res.status(500).json({ error: 'Server Error' });
}

// Register User
app.post("/register", async (req, res) => {
    try {
        const { user_name, email, phone_num, password } = req.body;

        // Check if required fields are present
        if (!user_name || !email || !password) {
            return res.status(400).json({ message: "Please provide all required fields" });
        }

        // Check if user exists
        const existingUser = await User.query("email").eq(email).exec();
        if (existingUser.length) return res.status(400).json({ message: "User already exists" });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user to database
        const newUser = new User({ user_name, email, phone_num, password: hashedPassword, user_type: "attendee", first_time_login: false });
        await newUser.save();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        errorHandler(res, error, "Error in /register");
    }
});

// login user
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await User.query("email").eq(email).exec();
        if (!response.length) {
            return res.status(400).json({ message: 'User not found' });
        }

        const user = response[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid Password' });
        }

        if (user.user_type !== 'attendee') {
            return res.status(400).json({ message: 'Invalid User Type' });
        }

        const tokenPayload = {
            email: user.email,
            user_type: user.user_type,
            user_id: user._id
        };

        const token = jwt.sign(
            tokenPayload,
            'your_secret_key',
            { expiresIn: '1h' }
        );

        return res.json({
            token,
            user_type: user.user_type,
            message: 'Login successful',
            first_time_login: false
        });

    } catch (error) {
        errorHandler(res, error, 'Error in /login');
    }
});

// Route to fetch all public events
app.get('/event', async (req, res) => {
    try {
        const events = await Event.scan("is_public").eq(true).all().exec();

        // Filter only upcoming events
        const now = new Date();
        const filteredEvents = events.filter(ev => {
            return new Date(ev.event_date_time).getTime() > now.getTime();
        });

        // Sort by event_date_time ascending
        filteredEvents.sort(
            (a, b) => new Date(a.event_date_time) - new Date(b.event_date_time)
        );

        res.status(200).json(filteredEvents);
    } catch (error) {
        errorHandler(res, error, 'Error on /event');
    }
});

// fetch specific event
app.get('/event/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;
        const foundEvent = await Event.get(eventId);

        if (!foundEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.status(200).json(foundEvent);
    } catch (error) {
        errorHandler(res, error, 'Error on /event/:eventId');
    }
});

// fetch ticket type for specific event
app.get('/ticket/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // Query tickets by event_id (using GSI)
        const tickets = await Ticket.query("event_id").eq(eventId).all().exec();

        // Sort by price descending
        const sortedTickets = tickets.sort((a, b) => b.price - a.price);

        res.status(200).json(sortedTickets);
    } catch (error) {
        errorHandler(res, error, 'Error on /ticket/:eventId');
    }
});

// fetch seat status for specific event
app.get('/seat/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;

        const tickets = await Ticket.query("event_id").eq(eventId).all().exec();

        if (!tickets || tickets.length === 0) {
            return res.status(404).json({ message: 'No tickets found for this event' });
        }

        const ticketIds = tickets.map(t => t._id);
        let seats = [];

        for (const ticketId of ticketIds) {
            const ticketSeats = await Seat.query("ticket_type_id").eq(ticketId).all().exec();
            // Optionally attach ticket info
            const enrichedSeats = ticketSeats.map(s => ({
                ...s,
                ticket_type_id: tickets.find(t => t._id === s.ticket_type_id),
            }));
            seats = seats.concat(enrichedSeats);
        }
        res.status(200).json(seats);
    } catch (error) {
        errorHandler(res, error, 'Error on /seat/:eventId');
    }
});

// get seat booking
app.get('/seat-booking/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;

        if (!paymentId) {
            return res.status(400).json({ message: 'Payment ID is required' });
        }

        const seatBookings = await SeatBooking.query("payment_id").eq(paymentId).all().exec();

        const tickets = [];
        for (const booking of seatBookings) {
            const seat = await Seat.get(booking.seat_id);

            if (!tickets.find((t) => t._id === seat.ticket_type_id)) {
                const ticket = await Ticket.get(seat.ticket_type_id);
                tickets.push(ticket);
            }

            booking.seat_id = seat;
            booking.seat_id.ticket_type_id = tickets.find((t) => t._id === seat.ticket_type_id);
        }

        res.status(200).json(seatBookings);
    } catch (error) {
        errorHandler(res, error, 'Error on /seat-booking/:paymentId');
    }
})

// post seat booking
app.post('/seat-booking/', async (req, res) => {
    try {
        const data = req.body;
        for (let i = 0; i < data.seat_id.length; i++) {
            const seat = await Seat.get(data.seat_id[i]);
            seat.seat_status = "booked";
            await seat.save();

            // Decrease available quantity for the ticket category
            await Ticket.update(
                { _id: seat.ticket_type_id },
                { $ADD: { available_quantity: -1 } }
            );

            const seatBooking = new SeatBooking({
                seat_id: data.seat_id[i],
                payment_id: data.payment_id
            });
            await seatBooking.save();
        }
        res.status(200).json({ message: "Success" });
    } catch (error) {
        errorHandler(res, error, 'Error on /seat-booking/');
    }
});

// get payment by payment id
app.get('/payment/:paymentId', async (req, res) => {
    try {
        const paymentId = req.params.paymentId;
        const payment = await Payment.get(paymentId);
        const paymentEvent = await Event.get(payment.event_id);
        payment.event_id = paymentEvent;

        res.status(200).json(payment);
    } catch (error) {
        errorHandler(res, error, 'Error on /payment/:paymentId');
    }
});

// get payment by user id
app.get('/payment/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const payments = await Payment.query("user_id").eq(userId).all().exec();

        for (const payment of payments) {
            const paymentEvent = await Event.get(payment.event_id);
            payment.event_id = paymentEvent;
        }

        payments.sort((a, b) => new Date(b.purchase_time) - new Date(a.purchase_time));

        res.status(200).json(payments);
    } catch (error) {
        errorHandler(res, error, 'Error on /payment/user/:userId');
    }
});

// post payment
app.post('/payment/', async (req, res) => {
    try {
        const data = req.body;

        const payment = new Payment(data);
        const savedPayment = await payment.save();

        res.status(200).json(savedPayment);
    } catch (error) {
        errorHandler(res, error, 'Error on /payment/');
    }
});

// get waitlist
app.get('/waitlist/user/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const waitlists = await Waitlist.query("user_id").eq(userId).all().exec();

        for (const waitlist of waitlists) {
            const eventDetail = await Event.get(waitlist.event_id);
            waitlist.event_id = eventDetail;
        }

        res.status(200).json(waitlists);
    } catch (error) {
        errorHandler(res, error, 'Error on /waitlist/user/:userId');
    }
});

// get specific waitlist
app.get('/waitlist/user/:userId/:eventId', async (req, res) => {
    try {
        const { userId, eventId } = req.params;

        const result = await Waitlist.query("user_id").eq(userId).where("event_id").eq(eventId).exec();

        if (!result || result.length === 0) {
            res.status(404).json({ message: 'Waitlist not found' });
        } else {
            res.status(200).json(result[0]);
        }

    } catch (error) {
        errorHandler(res, error, 'Error on /waitlist/user/:userId/:eventId');
    }
});

// post waitlist
app.post('/waitlist/', async (req, res) => {
    try {
        const body = req.body;
        const { user_id, event_id } = body;

        const result = await Waitlist.query("user_id").eq(user_id).where("event_id").eq(event_id).exec();

        if (result && result.length > 0) {
            res.status(400).json({ message: 'User is already in the waitlist' });
        }

        const newWaitlist = new Waitlist({ user_id, event_id });
        await newWaitlist.save();

        res.status(200).json({ message: "Success" });
    } catch (error) {
        errorHandler(res, error, 'Error on /waitlist/');
    }
});

app.delete('/waitlist/:waitlistId', async (req, res) => {
    try {
        const waitlistId = req.params.waitlistId;

        const waitlist = await Waitlist.get(waitlistId)
        await waitlist.delete();

        res.status(200).json({ message: 'Waitlist deleted successfully' });
    } catch (error) {
        errorHandler(res, error, 'Error on /waitlist/:waitlistId');
    }
});

app.all(/(.*)/, (req, res) => {
    res.status(404).json({ message: "Route not found" });
});

module.exports = app;