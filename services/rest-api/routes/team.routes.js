const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../lib/db'); // Impor db in-memory

const router = express.Router();

// GET /api/teams - Get all teams
router.get('/', (req, res) => {
  res.json(db.teams);
});

// POST /api/teams - Create new team
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  const newTeam = {
    id: uuidv4(),
    name: name,
    createdAt: new Date().toISOString()
  };
  
  db.teams.push(newTeam);
  res.status(201).json(newTeam);
});

// GET /api/teams/:id - Get team by ID (termasuk anggota)
router.get('/:id', (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team) {
    return res.status(404).json({ error: 'Team not found' });
  }

  // Cari anggota tim
  const members = db.users
    .filter(u => u.teamId === req.params.id)
    .map(u => {
      const { password, ...member } = u; // Hapus password
      return member;
    });

  res.json({ ...team, members });
});

module.exports = router;