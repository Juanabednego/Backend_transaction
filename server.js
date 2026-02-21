const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => res.json({ message: 'Test OK' }));
app.get('/api/health', (req, res) => res.json({ status: 'healthy' }));

app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));

module.exports = app;
