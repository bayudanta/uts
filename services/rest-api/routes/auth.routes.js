const express = require('express');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { privateKey, publicKey } = require('../lib/keys');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const { db } = require('../lib/db'); // Impor db in-memory

const router = express.Router();

// GET /auth/public-key - Endpoint untuk API Gateway
router.get('/public-key', (req, res) => {
  // Hanya kirim public key
  res.json({ publicKey: publicKey });
});

// POST /auth/register
router.post('/register', validateRegistration, async (req, res) => {
  const { name, email, password, teamName } = req.body;

  // Cek jika user sudah ada
  if (db.users.find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already exists' });
  }

  // Buat tim baru jika teamName diberikan
  let teamId = null;
  if (teamName) {
    const newTeam = {
      id: uuidv4(),
      name: teamName,
      createdAt: new Date().toISOString()
    };
    db.teams.push(newTeam);
    teamId = newTeam.id;
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const newUser = {
    id: uuidv4(),
    name,
    email,
    password: hashedPassword,
    teamId: teamId, // Bisa null jika tidak mendaftar dengan tim
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);

  // Jangan kirim password kembali
  const { password: _, ...userResponse } = newUser;

  res.status(201).json({
    message: 'User registered successfully',
    user: userResponse
  });
});

// POST /auth/login
router.post('/login', validateLogin, async (req, res) => {
  const { email, password } = req.body;

  const user = db.users.find(u => u.email === email);
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Buat Token Payload
  const payload = {
    id: user.id,
    email: user.email,
    name: user.name,
    teamId: user.teamId
  };

  // Tanda tangani token menggunakan Private Key
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1h' // Token berlaku 1 jam
  });

  res.json({
    message: 'Login successful',
    token: token,
    user: payload // Kirim data user untuk disimpan di frontend
  });
});

module.exports = router;