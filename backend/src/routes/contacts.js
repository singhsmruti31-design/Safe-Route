import express from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import {
  findContactsByUserId,
  createContact,
  updateContact,
  deleteContact,
  setPrimaryContact
} from '../db/contactsRepo.js';

const router = express.Router();

// All emergency contacts endpoints require verified JWT
router.use(requireAuth);

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Contact name is required.').max(150),
  phone: z.string().trim().min(3, 'Phone number is required.').max(50),
  relationship: z.string().trim().max(50).optional().default('Other'),
  isPrimary: z.boolean().optional().default(false)
});

const updateSchema = contactSchema.partial().extend({
  id: z.coerce.string().optional()
});

/**
 * GET /api/contacts
 * Retrieve all emergency contacts for the authenticated user.
 */
router.get('/', async (req, res, next) => {
  try {
    const contacts = await findContactsByUserId(req.user.id);
    res.json({ contacts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/contacts
 * Add a new emergency contact.
 */
router.post('/', async (req, res, next) => {
  try {
    const validated = contactSchema.parse(req.body);
    const contact = await createContact(req.user.id, validated);
    const contacts = await findContactsByUserId(req.user.id);

    res.status(201).json({
      contact,
      contacts,
      message: 'Emergency contact added successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
});

/**
 * PUT /api/contacts or PUT /api/contacts/:id
 * Update an existing emergency contact.
 */
const handleUpdate = async (req, res, next) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'Contact ID is required for update.' });
    }

    const validated = updateSchema.parse(req.body);
    const updated = await updateContact(req.user.id, id, validated);
    const contacts = await findContactsByUserId(req.user.id);

    res.json({
      contact: updated,
      contacts,
      message: 'Emergency contact updated successfully.'
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors[0]?.message || 'Validation error' });
    }
    next(err);
  }
};

router.put('/:id', handleUpdate);
router.put('/', handleUpdate);

/**
 * DELETE /api/contacts or DELETE /api/contacts/:id
 * Remove an emergency contact.
 */
const handleDelete = async (req, res, next) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'Contact ID is required for deletion.' });
    }

    await deleteContact(req.user.id, id);
    const contacts = await findContactsByUserId(req.user.id);

    res.json({
      ok: true,
      message: 'Emergency contact deleted successfully.',
      contacts
    });
  } catch (err) {
    next(err);
  }
};

router.delete('/:id', handleDelete);
router.delete('/', handleDelete);

/**
 * PATCH /api/contacts or PATCH /api/contacts/:id
 * Set a contact as the primary emergency contact.
 */
const handleSetPrimary = async (req, res, next) => {
  try {
    const id = req.params.id || req.body.id;
    if (!id) {
      return res.status(400).json({ error: 'Contact ID is required.' });
    }

    const contacts = await setPrimaryContact(req.user.id, id);
    res.json({
      ok: true,
      contacts,
      message: 'Primary emergency contact set.'
    });
  } catch (err) {
    next(err);
  }
};

router.patch('/:id', handleSetPrimary);
router.patch('/', handleSetPrimary);

export default router;

