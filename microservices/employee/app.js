const express = require('express');
const cors = require('cors');
const dynamoose = require('dynamoose');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
// const { S3Client, ListBucketsCommand, PutObjectCommand } = require("@aws-sdk/client-s3");

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

// mail transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: "zhengxianyap@gmail.com",
        pass: "vlwh xavq jepm fxwg"
    },
    tls: {
        rejectUnauthorized: false
    }
});

const storage = multer.diskStorage( {
    destination: (req, file, cb) => {
        cb(null, './website/image/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// const upload = multer({ storage: multer.memoryStorage() });

// const s3Client = new S3Client({
//     region: 'us-east-1',
//     credentials: {
//         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//     },
// });

// let s3BucketName = '';
// s3Client.send(new ListBucketsCommand({ Prefix: 'event-website' })).then(
//     (data) => {
//         if (data.Buckets && data.Buckets.length > 0) {
//             s3BucketName = data.Buckets[0].Name;
//         }
//     },
//     (err) => {
//         console.log(err);
//     }
// );

// async function uploadFile(fileBuffer, fileName) {
//     const uploadParams = {
//         Bucket: s3BucketName,
//         Key: "/image/uploads/" + fileName,
//         cacheControl: "max-age=486000",
//         Body: fileBuffer,
//     };

//     try {
//         const data = await s3Client.send(new PutObjectCommand(uploadParams));
//         console.log("File uploaded successfully:", data);
//         return data;
//     } catch (err) {
//         console.error("Error uploading file:", err);
//         throw err;
//     }
// }

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

        // Check if first-time login
        if (user.first_time_login) {
            return res.json({
                message: "First-time login detected, please reset your password",
                first_time_login: true,
                email: user.email,
            });
        }

        const tokenPayload = {
            email: user.email,
            user_type: user.user_type,
            user_id: user._id
        };

        // Generate JWT token including organizer_name if applicable
        if (user.user_type === 'organizer') {
            tokenPayload.organizer_name = user.organization_name || user.user_name;
        }

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

// Register Event Organizer Route
app.post("/registerOrganizer", async (req, res) => {
    const { user_name, email, phone_num, organization_name } = req.body;

    try {
        // Check if user already exists
        const existingUser = await User.query("email").eq(email).exec();
        if (existingUser.length) return res.status(400).json({ message: "User already exists" });

        // Hash password
        const randomPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Save as organizer in database
        const newOrganizer = new User({
            user_name,
            email,
            phone_num,
            password: hashedPassword,
            user_type: "organizer",
            organization_name,
            first_time_login: true
        });

        await newOrganizer.save();

        const emailHTML = `
        <h3>Hello ${user_name},</h3>
        <p>Your event organizer account has been created successfully.</p>
        <p><strong>Password:</strong> ${randomPassword}</p>
        <p>Please change it after logging in.</p>
        <br>
        <p>Best Regards,</p>
        <p><strong>Help Me Event Management System</strong></p>`;

        await transporter.sendMail({
            from: process.env.EMAIL,
            to: email,
            subject: "Register Successfully for Help Me Event Organizer Account",
            html: emailHTML
        });

        res.status(200).json({ message: "Event Organizer registered successfully. Please Check your Email for the password" });

    } catch (error) {
        errorHandler(res, error, 'Error in /registerOrganizer');
    }
});

app.post('/reset-password', async (req, res) => {
    const { email, newPassword } = req.body;

    try {
        const user = await User.query("email").eq(email).exec();
        if (!user || user.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        const selectedUser = user[0]

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        selectedUser.first_time_login = false;
        selectedUser.password = hashedPassword;

        await selectedUser.save();
        res.json({ message: 'Password reset successful. Please log in with your new password.' });
    } catch (error) {
        errorHandler(res, error, 'Error in /reset-password');
    }
});

// Route to create a new event with file upload
app.post('/events', upload.single('event_image'), async (req, res) => {
    try {
        const newEvent = new Event({
            event_name: req.body.event_name,
            event_date_time: req.body.event_date_time,
            event_duration: req.body.event_duration,
            event_description: req.body.event_description,
            event_image: req.file ? `/image/uploads/${req.file.filename}` : null,
            organizer_name: req.body.organizer_name
        });
        await newEvent.save();

        // if (req.file) {
        //     uploadFile(req.file.buffer, req.file.originalname);
        // }

        res.status(201).json(newEvent);
    } catch (error) {
        errorHandler(res, error, 'Error in /events');
    }
});

// Route to fetch all events
app.get('/events', async (req, res) => {
    try {
        const events = await Event.scan().all().exec();
        res.status(200).json(events);
    } catch (error) {
        errorHandler(res, error, 'Error in /events');
    }
});

// Route to fetch event names
app.get('/events/names', async (req, res) => {
    try {
        const events = await Event.scan().all().exec();
        const eventNames = events.map(event => event.event_name);
        res.status(200).json(eventNames);
    } catch (error) {
        errorHandler(res, error, 'Error in /events/names');
    }
});

// Route to fetch event dates
app.get('/events/dates', async (req, res) => {
    try {
        const events = await Event.scan().all().exec();
        const eventDates = events.map(event => {
            const dateValue = event.event_date_time;
            const date = new Date(dateValue);

            if (isNaN(date.getTime())) {
                console.error('Invalid date:', dateValue);
                return null;
            }
            return date.toISOString().split('T')[0];
        }).filter(date => date !== null);
        res.status(200).json(eventDates);
    } catch (error) {
        console.error('Error fetching event dates:', error);
        res.status(500).json({ message: 'Error fetching event dates' });
    }
});

// Route to fetch events by organizer name
app.get('/events/by-organizer/:organizerName', async (req, res) => {
    try {
        const organizerName = req.params.organizerName;

        const events = await Event.scan('organizer_name').eq(organizerName).all().exec();
        res.status(200).json(events);
    } catch (error) {
        errorHandler(res, error, 'Error in /events/by-organizer/:organizerName');
    }
});

// Add ticket type creation route
app.post('/ticket', async (req, res) => {
    try {
        const { category, price, max_num, event_id } = req.body;

        if (!category || !price || !max_num || !event_id) {
            return res.status(400).json({ message: 'All fields (category, price, max_num, event_id) are required' });
        }

        const ticket = new Ticket({ category, price, max_num, event_id });
        await ticket.save();
        res.status(201).json({ message: 'Ticket type added successfully', ticket });
    } catch (error) {
        errorHandler(res, error, 'Error in /ticket');
    }
});

// Delete ticket category route
app.delete('/ticket/:ticketId', async (req, res) => {
    try {
        const ticketId = req.params.ticketId;

        // Find and delete the ticket
        const ticket = await Ticket.get(ticketId);

        if (!ticket || ticket.length === 0) {
            return res.status(404).json({ message: 'Ticket category not found' });
        }

        await ticket.delete();

        // Remove all seats associated with the deleted ticket category
        const seats = await Seat.query('ticket_type_id').eq(ticketId).all().exec();
        for (const seat of seats) {
            await seat.delete();
        }

        res.status(200).json({ message: 'Ticket category and associated seat sections removed successfully' });
    } catch (error) {
        errorHandler(res, error, 'Error in /ticket/:ticketId');
    }
});

// Add seat section assignment route
app.post('/seat-section/assign', async (req, res) => {
    try {
        const { event_id, seat_section, ticket_category_id } = req.body;

        if (!event_id || !seat_section || !ticket_category_id) {
            return res.status(400).json({ message: 'All fields (event_id, seat_section, ticket_category_id) are required' });
        }

        const ticketCategory = await Ticket.get(ticket_category_id);
        if (!ticketCategory || ticketCategory.length === 0) {
            return res.status(404).json({ message: 'Ticket category not found' });
        }

        const currentAssignedSeats = await Seat.query("ticket_type_id").eq(ticket_category_id).count().exec();
        const seatLayout = {
            "A": [[43, 42, 41, 40, 39, 38, 37, 36], [33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [8, 7, 6, 5, 4, 3, 2, 1]],
            "B": [[44, 43, 42, 41, 40, 39, 38, 37, 36], [34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "C": [[46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "D": [[47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "E": [[47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "F": [[47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "G": [[47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "H": [[46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "J": [[45, 44, 43, 42, 41, 40, 39, 38, 37, 36], [29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "K": [[43, 42, 41, 40, 39, 38, 37, 36], [30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [8, 7, 6, 5, 4, 3, 2, 1]],
            "L": [[40, 39, 38, 37, 36], [], [5, 4, 3, 2, 1]],
            "AA": [[50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37], [36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "BB": [[50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37], [36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "CC": [[50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37], [36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "DD": [[49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37], [35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15], [13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]],
            "EE": [[48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37], [], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]]
        };

        if (!seatLayout[seat_section]) {
            return res.status(400).json({ message: `Invalid seat section: ${seat_section}` });
        }

        const newSeatsCount = seatLayout[seat_section].flat().length;
        const totalSeatsAfterAssignment = currentAssignedSeats + newSeatsCount;

        if (totalSeatsAfterAssignment > ticketCategory.max_num) {
            return res.status(400).json({
                message: `The max number of tickets (${ticketCategory.max_num}) for this category will be exceeded after assigning this section. You CANNOT assign this seat section to "${ticketCategory.category}" category.`
            });
        }

        const seatAssignments = seatLayout[seat_section].flat().map((seatNum) => ({
            event_id,
            seat_section,
            ticket_type_id: ticket_category_id,
            seat_num: `${seat_section}${seatNum}`,
            seat_status: 'available'
        }));

        for (let i = 0; i < seatAssignments.length; i += 10) {
            const batch = seatAssignments.slice(i, i + 10);
            await Seat.batchPut(batch);
        }

        // Update ticket category with new total seats assigned and available quantity
        await Ticket.update(
            { _id: ticket_category_id },
            {
                $ADD: {
                    total_seats_assigned: newSeatsCount,
                    available_quantity: newSeatsCount
                }
            }
        );

        res.status(201).json({ message: `All seats in section ${seat_section} assigned to the selected ticket category.` });
    } catch (error) {
        errorHandler(res, error, 'Error on /seat-section/assign');
    }
});

// Add new route to handle event publication
app.put('/events/publish/:eventId', async (req, res) => {
    try {
        const eventId = req.params.eventId;

        // Check if ticket categories exist
        const tickets = await Ticket.query('event_id').eq(eventId).all().exec();
        if (tickets.length === 0) {
            return res.status(400).json({
                message: 'Cannot publish event. No ticket categories have been created.'
            });
        }

        // Check if seats have been assigned
        const seats = await Seat.query('event_id').eq(eventId).all().exec();
        if (seats.length === 0) {
            return res.status(400).json({
                message: 'Cannot publish event. No seats have been assigned.'
            });
        }

        // Update event status to public
        const updatedEvent = await Event.update(
            { _id: eventId },
            { is_public: true },
        );

        if (!updatedEvent) {
            return res.status(404).json({ message: 'Event not found' });
        }

        res.json(updatedEvent);
    } catch (error) {
        errorHandler(res, error, 'Error on /events/publish/:eventId');
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

app.all(/(.*)/, (req, res) => {
    res.status(404).json({ message: "Route not found" });
});

module.exports = app;