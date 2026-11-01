import { useEffect, useState } from 'react';
import { Pencil, Plus, Star, Trash2, Phone } from 'lucide-react';
import { RELATIONSHIPS } from '../data/helplines.js';
import {
  createContact,
  deleteContact,
  listContacts,
  setPrimaryContact,
  updateContact,
  contactsRequireBackend,
} from '../services/emergencyContacts.js';
import { isValidMobile, isValidName, telHref } from '../utils/validation.js';
import { useAuth } from '../context/AuthContext.jsx';
import BackendNotice from './BackendNotice.jsx';
import FormField from './FormField.jsx';

const emptyForm = { name: '', phone: '', relationship: 'Parent', isPrimary: false };

export default function EmergencyContactsPanel() {
  const { token } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const temporary = contactsRequireBackend() || !token;

  const refresh = async () => {
    const data = await listContacts(token);
    setContacts(data.contacts || data || []);
  };

  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [token]);

  const validate = () => {
    const next = {};
    if (!isValidName(form.name)) next.name = 'Enter the contact’s name.';
    if (!isValidMobile(form.phone)) next.phone = 'Enter a valid mobile number with country code.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    if (!validate()) return;
    try {
      if (editingId) {
        await updateContact(token, editingId, form);
        setMessage('Contact updated.');
      } else {
        await createContact(token, form);
        setMessage('Contact added.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEdit = (contact) => {
    setEditingId(contact.id);
    setForm({
      name: contact.name,
      phone: contact.phone,
      relationship: contact.relationship,
      isPrimary: Boolean(contact.isPrimary),
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this emergency contact from this device?')) return;
    try {
      await deleteContact(token, id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handlePrimary = async (id) => {
    try {
      await setPrimaryContact(token, id);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-4" id="contacts">
      {temporary && (
        <BackendNotice title="Temporary device storage">
          These contacts stay on this browser only. They are not a secure account record and will not sync until the backend contact API is connected.
        </BackendNotice>
      )}

      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <h3 className="text-sm font-semibold text-text-dark flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          {editingId ? 'Edit contact' : 'Add emergency contact'}
        </h3>
        <FormField
          id="contact-name"
          label="Contact name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
          required
        />
        <FormField
          id="contact-phone"
          label="Mobile number"
          type="tel"
          placeholder="+91 98765 43210"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          error={errors.phone}
          hint="Include country code (India default +91)."
          required
        />
        <div>
          <label htmlFor="contact-rel" className="block text-xs font-semibold text-text-muted mb-1 uppercase tracking-wide">
            Relationship
          </label>
          <select
            id="contact-rel"
            value={form.relationship}
            onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            className="w-full border border-border rounded-xl px-3 py-2.5 text-sm text-text-dark bg-white outline-none focus:border-primary"
          >
            {RELATIONSHIPS.map((rel) => (
              <option key={rel} value={rel}>{rel}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-text-dark">
          <input
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => setForm({ ...form, isPrimary: e.target.checked })}
          />
          Set as primary emergency contact
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm">
            {editingId ? 'Save changes' : 'Add contact'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => { setEditingId(null); setForm(emptyForm); }}
            >
              Cancel
            </button>
          )}
        </div>
        {message && <p className="text-xs text-success">{message}</p>}
        {error && <p className="text-xs text-danger">{error}</p>}
      </form>

      <div className="space-y-2">
        {contacts.length === 0 && (
          <p className="text-sm text-text-muted">No emergency contacts saved yet.</p>
        )}
        {contacts.map((c) => {
          const href = telHref(c.phone);
          return (
            <div key={c.id} className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-text-dark">{c.name}</p>
                  {c.isPrimary && (
                    <span className="text-[10px] uppercase font-bold bg-blue-50 text-primary px-2 py-0.5 rounded-full">Primary</span>
                  )}
                  {c.temporary && (
                    <span className="text-[10px] uppercase font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full">Temporary</span>
                  )}
                </div>
                <p className="text-sm text-text-muted">{c.relationship} · {c.phone}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {href && (
                  <a href={href} className="btn-danger text-xs py-2 px-3 inline-flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" /> Call
                  </a>
                )}
                {!c.isPrimary && (
                  <button type="button" onClick={() => handlePrimary(c.id)} className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" /> Primary
                  </button>
                )}
                <button type="button" onClick={() => handleEdit(c)} className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1">
                  <Pencil className="w-3.5 h-3.5" /> Edit
                </button>
                <button type="button" onClick={() => handleDelete(c.id)} className="btn-secondary text-xs py-2 px-3 inline-flex items-center gap-1 text-danger">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
