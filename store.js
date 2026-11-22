const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'data.json');

const initial = {
  users: [],
  events: [
    { id: 'ev1', title: 'Design Thinking Workshop', category: 'Workshop', date: '2026-12-05', time: '10:00', venue: 'Innovation Lab, Block A', description: 'A hands-on session to turn everyday problems into thoughtful product ideas. Bring your curiosity and a notebook.', capacity: 60, organizerId: 'seed', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000', createdAt: new Date().toISOString() },
    { id: 'ev2', title: 'CodeSprint 2026', category: 'Technology', date: '2026-12-12', time: '09:00', venue: 'Main Auditorium', description: 'A fast-paced team coding challenge. Build, collaborate and present a working solution in one day.', capacity: 120, organizerId: 'seed', image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1000', createdAt: new Date().toISOString() },
    { id: 'ev3', title: 'Campus Acoustic Evening', category: 'Music', date: '2026-12-18', time: '17:30', venue: 'Open Air Theatre', description: 'An evening of live acoustic performances, student bands and good campus energy.', capacity: 90, organizerId: 'seed', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1000', createdAt: new Date().toISOString() },
    { id: 'ev4', title: 'Inter-College Sports Meet', category: 'Sports', date: '2027-01-08', time: '08:30', venue: 'University Sports Ground', description: 'Represent your department across track, court and field events. Spectators are welcome too.', capacity: 200, organizerId: 'seed', image: 'https://images.unsplash.com/photo-1461896836934-234b9c1c7e5b?w=1000', createdAt: new Date().toISOString() }
  ],
  registrations: []
};

function read() {
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(initial, null, 2));
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function write(data) { fs.writeFileSync(file, JSON.stringify(data, null, 2)); }
module.exports = { read, write };
