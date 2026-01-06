const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'payment-gateway-secret-key';

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, address } = req.body;
    
    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    const user = new User({ username, email, password, full_name, phone, address });
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const user = await User.findOne({ 
      $or: [{ username }, { email: username }],
      is_active: true 
    });
    
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Validate session
router.get('/validate-session', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.is_active) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    res.json({
      success: true,
      valid: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    res.status(401).json({ success: false, valid: false, message: 'Invalid token' });
  }
});

// Get user by ID
router.get('/user/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone,
        address: user.address
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;