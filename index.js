require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { read, write } = require('./store');
const { auth, role, SECRET } = require('./middleware');

const app = express();
app.use(cors());
app.use(express.json());
const id = () => crypto.randomUUID();

app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'EventPulse API' }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role: userRole } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required.' });
  if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters.' });
  if (!['student', 'organizer'].includes(userRole)) return res.status(400).json({ message: 'Choose a valid account type.' });
  const db = read();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ message: 'An account with this email already exists.' });
  const user = { id: id(), name: name.trim(), email: email.toLowerCase().trim(), password: await bcrypt.hash(password, 10), role: userRole };
  db.users.push(user); write(db);
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const db = read();
  const user = db.users.find(u => u.email === String(email || '').toLowerCase().trim());
  if (!user || !(await bcrypt.compare(password || '', user.password))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  const token = jwt.sign({ id: user.id, name: user.name, email: user.email, role: user.role }, SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.get('/api/events', (req, res) => {
  const db = read();
  const { search = '', category = '', date = '' } = req.query;
  let events = db.events.map(e => ({
    ...e,
    registeredCount: db.registrations.filter(r => r.eventId === e.id && r.status !== 'Cancelled').length,
    availableSeats: Math.max(0, e.capacity - db.registrations.filter(r => r.eventId === e.id && r.status !== 'Cancelled').length)
  }));
  if (search) events = events.filter(e => `${e.title} ${e.venue} ${e.description}`.toLowerCase().includes(search.toLowerCase()));
  if (category && category !== 'All') events = events.filter(e => e.category === category);
  if (date) events = events.filter(e => e.date >= date);
  res.json(events.sort((a, b) => a.date.localeCompare(b.date)));
});

app.get('/api/events/:eventId', (req, res) => {
  const db = read(); const e = db.events.find(x => x.id === req.params.eventId);
  if (!e) return res.status(404).json({ message: 'Event not found.' });
  const registeredCount = db.registrations.filter(r => r.eventId === e.id && r.status !== 'Cancelled').length;
  res.json({ ...e, registeredCount, availableSeats: Math.max(0, e.capacity - registeredCount) });
});

app.post('/api/events', auth, role('organizer'), (req, res) => {
  const { title, category, date, time, venue, description, capacity, image } = req.body;
  if (!title || !category || !date || !time || !venue || !capacity || Number(capacity) < 1) return res.status(400).json({ message: 'Please complete all required event fields.' });
  const db = read();
  const event = { id: id(), title, category, date, time, venue, description: description || '', capacity: Number(capacity), image: image || '', organizerId: req.user.id, createdAt: new Date().toISOString() };
  db.events.push(event); write(db); res.status(201).json(event);
});

app.put('/api/events/:eventId', auth, role('organizer'), (req, res) => {
  const db = read(); const event = db.events.find(e => e.id === req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  if (event.organizerId !== req.user.id) return res.status(403).json({ message: 'You can only edit events created by your account.' });
  const active = db.registrations.filter(r => r.eventId === event.id && r.status !== 'Cancelled').length;
  const nextCapacity = Number(req.body.capacity ?? event.capacity);
  if (!Number.isFinite(nextCapacity) || nextCapacity < active || nextCapacity < 1) return res.status(400).json({ message: `Capacity cannot be lower than ${active} current registrations.` });
  Object.assign(event, req.body, { capacity: nextCapacity, id: event.id, organizerId: event.organizerId });
  write(db); res.json(event);
});

app.delete('/api/events/:eventId', auth, role('organizer'), (req, res) => {
  const db = read(); const event = db.events.find(e => e.id === req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  if (event.organizerId !== req.user.id) return res.status(403).json({ message: 'You can only delete events created by your account.' });
  db.events = db.events.filter(e => e.id !== event.id);
  db.registrations = db.registrations.filter(r => r.eventId !== event.id);
  write(db); res.json({ message: 'Event deleted.' });
});

app.post('/api/events/:eventId/register', auth, role('student'), (req, res) => {
  const db = read(); const event = db.events.find(e => e.id === req.params.eventId);
  if (!event) return res.status(404).json({ message: 'Event not found.' });
  const existing = db.registrations.find(r => r.eventId === event.id && r.studentId === req.user.id);
  if (existing && existing.status !== 'Cancelled') return res.status(409).json({ message: 'You are already registered for this event.' });
  const count = db.registrations.filter(r => r.eventId === event.id && r.status !== 'Cancelled').length;
  if (count >= event.capacity) return res.status(409).json({ message: 'Sorry, this event is full.' });
  const registration = { id: id(), eventId: event.id, studentId: req.user.id, studentName: req.user.name, studentEmail: req.user.email, status: 'Registered', registeredAt: new Date().toISOString() };
  if (existing) Object.assign(existing, registration); else db.registrations.push(registration);
  write(db); res.status(201).json(registration);
});

app.get('/api/my/registrations', auth, role('student'), (req, res) => {
  const db = read();
  res.json(db.registrations.filter(r => r.studentId === req.user.id).map(r => ({ ...r, event: db.events.find(e => e.id === r.eventId) })).filter(r => r.event));
});

app.patch('/api/registrations/:registrationId/status', auth, role('organizer'), (req, res) => {
  const db = read(); const registration = db.registrations.find(r => r.id === req.params.registrationId);
  if (!registration) return res.status(404).json({ message: 'Registration not found.' });
  const event = db.events.find(e => e.id === registration.eventId);
  if (!event || event.organizerId !== req.user.id) return res.status(403).json({ message: 'You cannot manage this registration.' });
  if (!['Registered', 'Attended', 'Cancelled'].includes(req.body.status)) return res.status(400).json({ message: 'Invalid participation status.' });
  registration.status = req.body.status; write(db); res.json(registration);
});

app.get('/api/organizer/overview', auth, role('organizer'), (req, res) => {
  const db = read(); const events = db.events.filter(e => e.organizerId === req.user.id);
  const ids = events.map(e => e.id); const registrations = db.registrations.filter(r => ids.includes(r.eventId));
  res.json({ events, registrations: registrations.map(r => ({ ...r, eventTitle: events.find(e => e.id === r.eventId)?.title })), stats: { events: events.length, registrations: registrations.filter(r => r.status !== 'Cancelled').length, attended: registrations.filter(r => r.status === 'Attended').length } });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`EventPulse API running at http://localhost:${PORT}`));
