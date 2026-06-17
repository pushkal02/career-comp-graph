import prisma from '../prismaClient.js';

export const getEvents = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { salaryEvents: true, compEvents: true }
    });

    return res.json({
      salaryEvents: user?.salaryEvents || [],
      compEvents: user?.compEvents || []
    });
  } catch (err) {
    console.error('Get events error:', err);
    return res.status(500).json({ error: 'Internal server error fetching events.' });
  }
};

export const syncEvents = async (req, res) => {
  try {
    const { salaryEvents = [], compEvents = [] } = req.body;

    const mappedSalaries = salaryEvents.map(e => ({
      id: e.id,
      date: e.date,
      salary: parseFloat(e.salary),
      type: e.type,
      title: e.title || '',
      company: e.company || '',
      currency: e.currency || null,
      country: e.country || null,
      location: e.location || null,
      monthlyNetSalary: e.monthlyNetSalary !== undefined && e.monthlyNetSalary !== null ? parseFloat(e.monthlyNetSalary) : null,
      createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
      updatedAt: e.updatedAt ? new Date(e.updatedAt) : new Date()
    }));

    const mappedComps = compEvents.map(e => ({
      id: e.id,
      date: e.date,
      amount: parseFloat(e.amount),
      type: e.type,
      title: e.title || '',
      company: e.company || '',
      currency: e.currency || null,
      country: e.country || null,
      location: e.location || null,
      createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
      updatedAt: e.updatedAt ? new Date(e.updatedAt) : new Date()
    }));

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        salaryEvents: mappedSalaries,
        compEvents: mappedComps
      }
    });

    return res.json({ success: true, message: 'Timeline synced successfully.' });
  } catch (err) {
    console.error('Sync events error:', err);
    return res.status(500).json({ error: 'Internal server error syncing events.' });
  }
};

export const createSalaryEvent = async (req, res) => {
  try {
    const { id, date, salary, type, title, company, currency, country, location, monthlyNetSalary } = req.body;

    if (!id || !date || salary === undefined || !type) {
      return res.status(400).json({ error: 'ID, date, salary, and type are required.' });
    }

    const newEvent = {
      id,
      date,
      salary: parseFloat(salary),
      type,
      title: title || '',
      company: company || '',
      currency: currency || null,
      country: country || null,
      location: location || null,
      monthlyNetSalary: monthlyNetSalary !== undefined && monthlyNetSalary !== null ? parseFloat(monthlyNetSalary) : null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        salaryEvents: { push: newEvent }
      }
    });

    return res.status(201).json(newEvent);
  } catch (err) {
    console.error('Create salary event error:', err);
    return res.status(500).json({ error: 'Internal server error saving salary milestone.' });
  }
};

export const updateSalaryEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, salary, type, title, company, currency, country, location, monthlyNetSalary } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let found = false;
    const updatedEvents = (user.salaryEvents || []).map(e => {
      if (e.id === id) {
        found = true;
        return {
          ...e,
          date: date || e.date,
          salary: salary !== undefined ? parseFloat(salary) : e.salary,
          type: type || e.type,
          title: title !== undefined ? title : e.title,
          company: company !== undefined ? company : e.company,
          currency: currency !== undefined ? currency : e.currency,
          country: country !== undefined ? country : e.country,
          location: location !== undefined ? location : e.location,
          monthlyNetSalary: monthlyNetSalary !== undefined ? (monthlyNetSalary !== null ? parseFloat(monthlyNetSalary) : null) : e.monthlyNetSalary,
          updatedAt: new Date()
        };
      }
      return e;
    });

    if (!found) {
      return res.status(404).json({ error: 'Salary event not found.' });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { salaryEvents: updatedEvents }
    });

    const updatedEvent = updatedEvents.find(e => e.id === id);
    return res.json(updatedEvent);
  } catch (err) {
    console.error('Update salary event error:', err);
    return res.status(500).json({ error: 'Internal server error updating salary milestone.' });
  }
};

export const deleteSalaryEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedEvents = (user.salaryEvents || []).filter(e => e.id !== id);

    await prisma.user.update({
      where: { id: req.userId },
      data: { salaryEvents: updatedEvents }
    });

    return res.json({ success: true, message: 'Salary event deleted.' });
  } catch (err) {
    console.error('Delete salary event error:', err);
    return res.status(500).json({ error: 'Internal server error deleting salary milestone.' });
  }
};

export const createCompEvent = async (req, res) => {
  try {
    const { id, date, amount, type, title, company, currency, country, location } = req.body;

    if (!id || !date || amount === undefined || !type) {
      return res.status(400).json({ error: 'ID, date, amount, and type are required.' });
    }

    const newEvent = {
      id,
      date,
      amount: parseFloat(amount),
      type,
      title: title || '',
      company: company || '',
      currency: currency || null,
      country: country || null,
      location: location || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        compEvents: { push: newEvent }
      }
    });

    return res.status(201).json(newEvent);
  } catch (err) {
    console.error('Create comp event error:', err);
    return res.status(500).json({ error: 'Internal server error saving compensation event.' });
  }
};

export const updateCompEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, amount, type, title, company, currency, country, location } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    let found = false;
    const updatedEvents = (user.compEvents || []).map(e => {
      if (e.id === id) {
        found = true;
        return {
          ...e,
          date: date || e.date,
          amount: amount !== undefined ? parseFloat(amount) : e.amount,
          type: type || e.type,
          title: title !== undefined ? title : e.title,
          company: company !== undefined ? company : e.company,
          currency: currency !== undefined ? currency : e.currency,
          country: country !== undefined ? country : e.country,
          location: location !== undefined ? location : e.location,
          updatedAt: new Date()
        };
      }
      return e;
    });

    if (!found) {
      return res.status(404).json({ error: 'Compensation event not found.' });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: { compEvents: updatedEvents }
    });

    const updatedEvent = updatedEvents.find(e => e.id === id);
    return res.json(updatedEvent);
  } catch (err) {
    console.error('Update comp event error:', err);
    return res.status(500).json({ error: 'Internal server error updating compensation event.' });
  }
};

export const deleteCompEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedEvents = (user.compEvents || []).filter(e => e.id !== id);

    await prisma.user.update({
      where: { id: req.userId },
      data: { compEvents: updatedEvents }
    });

    return res.json({ success: true, message: 'Compensation event deleted.' });
  } catch (err) {
    console.error('Delete comp event error:', err);
    return res.status(500).json({ error: 'Internal server error deleting compensation event.' });
  }
};
