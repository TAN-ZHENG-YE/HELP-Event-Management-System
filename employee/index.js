const express = require('express');
const cors = require('cors');
const path = require('node:path');

const app = require('./app');

const main = express();
main.use(cors());

// api routes
main.use("/admin/api/", app);

// client routes
main.use('/admin/', express.static(path.join(__dirname, './website')));

main.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, './website/index.html'));
});

main.listen(8080, () => {
    console.log('Server is running on port 8080');
});