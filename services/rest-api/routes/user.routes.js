const express = require('express');
const { db } = require('../lib/db'); // Impor db in-memory

const router = express.Router();

// GET /api/users - Get all users
router.get('/', (req, res) => {
  // Sembunyikan password
  const users = db.users.map(u => {
    const { password, ...user } = u;
    return user;
  });
  res.json(users);
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const { password, ...userData } = user;
  res.json(userData);
});

// (PUT, DELETE, dll. dapat ditambahkan di sini)

module.exports = router;