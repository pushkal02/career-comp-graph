import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import prisma from '../prismaClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const sqliteDbPath = path.resolve(__dirname, '../prisma/dev.db');

console.log('Starting migration from SQLite to MongoDB (Single User Collection)...');
console.log('SQLite database path:', sqliteDbPath);
console.log('MongoDB connection string loaded from environment.');

const db = new sqlite3.Database(sqliteDbPath, sqlite3.OPEN_READONLY, (err) => {
  if (err) {
    console.error('❌ Failed to open SQLite database:', err.message);
    process.exit(1);
  }
  console.log('🔌 Connected to SQLite database in read-only mode.');
});

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runMigration() {
  let userCount = 0;
  let userMerged = 0;
  let totalSalariesMigrated = 0;
  let totalCompsMigrated = 0;

  try {
    // 1. Fetch all records from SQLite
    console.log('Reading data from SQLite...');
    const sqliteUsers = await dbAll('SELECT * FROM User');
    const sqliteSalaryEvents = await dbAll('SELECT * FROM SalaryEvent');
    const sqliteCompEvents = await dbAll('SELECT * FROM CompEvent');

    console.log(`Found in SQLite: ${sqliteUsers.length} users, ${sqliteSalaryEvents.length} salary events, ${sqliteCompEvents.length} comp events.`);

    for (const u of sqliteUsers) {
      const trimmedUsername = u.username.trim().toLowerCase();
      const trimmedEmail = u.email.trim().toLowerCase();

      // Find and map associated salary events for this user
      const userSalaries = sqliteSalaryEvents
        .filter(s => s.userId === u.id)
        .map(s => ({
          id: s.id,
          date: s.date,
          salary: Number(s.salary),
          type: s.type,
          title: s.title || '',
          company: s.company || '',
          currency: s.currency || null,
          country: s.country || null,
          location: s.location || null,
          monthlyNetSalary: s.monthlyNetSalary !== null ? Number(s.monthlyNetSalary) : null,
          createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
          updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date()
        }));

      // Find and map associated comp events for this user
      const userComps = sqliteCompEvents
        .filter(c => c.userId === u.id)
        .map(c => ({
          id: c.id,
          date: c.date,
          amount: Number(c.amount),
          type: c.type,
          title: c.title || '',
          company: c.company || '',
          currency: c.currency || null,
          country: c.country || null,
          location: c.location || null,
          createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
          updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date()
        }));

      // Check if user already exists in MongoDB
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { username: trimmedUsername },
            { email: trimmedEmail }
          ]
        }
      });

      if (existingUser) {
        console.log(`ℹ️ User already exists in MongoDB: ${trimmedUsername} (${trimmedEmail}). Overwriting timeline with migrated arrays.`);
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            salaryEvents: userSalaries,
            compEvents: userComps
          }
        });
        userMerged++;
      } else {
        console.log(`🆕 Creating user with nested events in MongoDB: ${trimmedUsername} (${trimmedEmail})`);
        await prisma.user.create({
          data: {
            id: u.id,
            username: trimmedUsername,
            email: trimmedEmail,
            passwordHash: u.passwordHash,
            name: u.name,
            startDate: u.startDate,
            currency: u.currency,
            theme: u.theme,
            createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
            salaryEvents: userSalaries,
            compEvents: userComps
          }
        });
        userCount++;
      }

      totalSalariesMigrated += userSalaries.length;
      totalCompsMigrated += userComps.length;
    }

    console.log('\n🎉 Migration process completed successfully!');
    console.log('------------------------------------------------');
    console.log(`👥 Users - Created: ${userCount}, Overwritten/Merged: ${userMerged}`);
    console.log(`📈 Total Embedded Salary Events Migrated: ${totalSalariesMigrated}`);
    console.log(`💰 Total Embedded Comp Events Migrated: ${totalCompsMigrated}`);
    console.log('------------------------------------------------');
    console.log('You can now log in to the application and verify your data.');
    console.log('Once you confirm everything is correct, you can manually delete the SQLite database file: backend/prisma/dev.db');

  } catch (err) {
    console.error('❌ Migration error occurred:', err);
  } finally {
    db.close((err) => {
      if (err) console.error('Failed to close SQLite database:', err.message);
      else console.log('🔌 Closed SQLite database connection.');
    });
    await prisma.$disconnect();
    console.log('🔌 Disconnected from MongoDB client.');
  }
}

runMigration();
