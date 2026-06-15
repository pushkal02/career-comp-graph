import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient.js';

export const signup = async (req, res) => {
  try {
    const { username, email, passwordHash, name } = req.body;

    if (!username || !email || !passwordHash || !name) {
      return res.status(400).json({ error: 'Username, email, password, and name are required.' });
    }

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedEmail = email.trim().toLowerCase();

    // Check if username already exists
    const existingUserByUsername = await prisma.user.findUnique({
      where: { username: trimmedUsername }
    });

    if (existingUserByUsername) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    // Check if email already exists
    const existingUserByEmail = await prisma.user.findUnique({
      where: { email: trimmedEmail }
    });

    if (existingUserByEmail) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    // Hash the transit passwordHash (using 10 salt rounds)
    const salt = await bcrypt.genSalt(10);
    const doubleHash = await bcrypt.hash(passwordHash, salt);

    // Create the user in the database
    const user = await prisma.user.create({
      data: {
        username: trimmedUsername,
        email: trimmedEmail,
        passwordHash: doubleHash,
        name: name.trim()
      }
    });

    // Generate a JWT with a 30-day expiration
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'super-secret-key-change-this-in-production',
      { expiresIn: '30d' }
    );

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        startDate: user.startDate,
        currency: user.currency,
        theme: user.theme
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    return res.status(500).json({ error: 'Internal server error during registration.' });
  }
};

export const login = async (req, res) => {
  try {
    const { username, passwordHash } = req.body; // username represents either username or email input

    if (!username || !passwordHash) {
      return res.status(400).json({ error: 'Username or email and password are required.' });
    }

    const trimmedIdentifier = username.trim().toLowerCase();

    // Find the user by username OR email
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: trimmedIdentifier },
          { email: trimmedIdentifier }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Compare entered transit hash with stored double hash
    const isMatch = await bcrypt.compare(passwordHash, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password.' });
    }

    // Generate JWT (30-day persistence)
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'super-secret-key-change-this-in-production',
      { expiresIn: '30d' }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        startDate: user.startDate,
        currency: user.currency,
        theme: user.theme
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login.' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true,
        username: true,
        name: true,
        startDate: true,
        currency: true,
        theme: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json(user);
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const { name, startDate, currency, theme, passwordHash } = req.body;

    let updatedPasswordHash = undefined;
    if (passwordHash) {
      const salt = await bcrypt.genSalt(10);
      updatedPasswordHash = await bcrypt.hash(passwordHash, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.userId },
      data: {
        name: name !== undefined ? name.trim() : undefined,
        startDate: startDate || undefined,
        currency: currency || undefined,
        theme: theme || undefined,
        passwordHash: updatedPasswordHash || undefined
      },
      select: {
        id: true,
        username: true,
        name: true,
        startDate: true,
        currency: true,
        theme: true
      }
    });

    return res.json(updatedUser);
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Internal server error updating settings.' });
  }
};
