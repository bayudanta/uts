const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

// Hash password default 'password'
const defaultHash = bcrypt.hashSync('password', 10);

// In-memory database
let users = [
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    password: defaultHash,
    teamId: 'team1',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'Basic User',
    email: 'user@example.com',
    password: defaultHash,
    teamId: 'team1',
    createdAt: new Date().toISOString(),
  }
];

let teams = [
    {
        id: 'team1',
        name: 'Development Team',
        createdAt: new Date().toISOString()
    }
];

// Ekspor sebagai satu objek 'db'
const db = {
    users,
    teams
};

module.exports = { db };