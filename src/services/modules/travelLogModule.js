// src/services/modules/travelLogModule.js
// TravelLog model service - includes computed fields and actions

import {
  searchOdooRecords,
  getOdooRecord,
  createOdooRecord,
  updateOdooRecord,
  deleteOdooRecord,
  callOdooAction,
  odooSession,
  getOdooFields,
  searchOdooNameRecords,
} from '../odoo';
import { odooConfig } from '../../config/odooConfig';

const MODEL = 'travel.log';

// ── Field Definitions ───────────────────────────────────
const TRAVEL_LOG_FIELDS = [
  'id',
  'travel_date',
  'travel_check_in_time',
  'travel_check_out_time',
  'travel_status', // Computed field
  'travel_expense_alert', // Computed field
  'travel_to_site_id',
  'travel_from_site_id',
  'travel_kilometers',
  'employee_id',
  'travel_is_company_vehicle',
  'technician_id',
  'travel_screenshot',
  'travel_notes',
  'travel_expense_created', // Computed field
  'travel_checkout_unlocked',
  'travel_expense_id', // Many2one to hr.expense
];

const formatOdooDate = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().split('T')[0];
};

const dateToFloatTime = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return d.getHours() + d.getMinutes() / 60.0;
};

const many2OneName = (value) => {
  if (Array.isArray(value)) return value[1] || '';
  return value || '';
};

let siteRelationModel = null;

const getTravelSiteModel = async () => {
  if (siteRelationModel) return siteRelationModel;

  const fieldMeta = await getOdooFields(MODEL, ['travel_from_site_id', 'travel_to_site_id']);
  siteRelationModel =
    fieldMeta?.travel_from_site_id?.relation ||
    fieldMeta?.travel_to_site_id?.relation ||
    odooConfig.siteModel;

  if (!siteRelationModel) {
    throw new Error('Could not discover the Odoo site model from travel.log fields.');
  }

  return siteRelationModel;
};

const resolveSiteId = async (value) => {
  if (!value) return false;
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value.id) return value.id;

  const model = await getTravelSiteModel();
  const records = await searchOdooNameRecords(model, value, 10);
  const exact = records.find(
    (record) =>
      record.name?.toLowerCase() === String(value).toLowerCase() ||
      record.display_name?.toLowerCase() === String(value).toLowerCase()
  );

  return (exact || records[0])?.id || false;
};

const normaliseTechnicianIds = (teamOnSite = []) => {
  const ids = teamOnSite
    .map((member) => member.id || member.uid)
    .filter((id) => typeof id === 'number');

  if (!ids.includes(odooSession.uid)) {
    ids.unshift(odooSession.uid);
  }

  return [...new Set(ids)];
};

export const toSubmittedLogCard = (log) => ({
  id: log.id,
  odooId: log.id,
  siteFrom: many2OneName(log.travel_from_site_id),
  siteTo: many2OneName(log.travel_to_site_id),
  kilometres: log.travel_kilometers,
  transport: log.travel_is_company_vehicle ? 'company' : 'my',
  whoseClaim: many2OneName(log.employee_id) || odooSession.userInfo?.name,
  checkin: `${log.travel_date}T${floatTimeToHHMM(log.travel_check_in_time || 0)}:00`,
  checkout: log.travel_check_out_time
    ? `${log.travel_date}T${floatTimeToHHMM(log.travel_check_out_time)}:00`
    : null,
  status: log.travel_status,
  expenseStatus: log.travel_expense_created ? 'Expense Created' : log.travel_expense_alert,
  expenseId: Array.isArray(log.travel_expense_id) ? log.travel_expense_id[0] : null,
  teamOnSite: Array.isArray(log.technician_id)
    ? log.technician_id.map((id) => ({ uid: id, fullName: `User ${id}` }))
    : [],
});

// ── Get all travel logs for current employee ──────────
export const getMyTravelLogs = async (limit = 50) => {
  try {
    if (!odooSession.uid) {
      throw new Error('Not authenticated');
    }

    // Get logs for current user's employee record
    const domain = [['employee_id', '=', odooSession.userInfo?.employee_id?.[0] || false]];
    const logs = await searchOdooRecords(MODEL, domain, TRAVEL_LOG_FIELDS, limit);

    return logs;
  } catch (error) {
    console.error('Failed to fetch travel logs:', error);
    throw error;
  }
};

// ── Get single travel log ───────────────────────────────
export const getTravelLog = async (travelLogId) => {
  try {
    const log = await getOdooRecord(MODEL, travelLogId, TRAVEL_LOG_FIELDS);
    return log;
  } catch (error) {
    console.error('Failed to get travel log:', error);
    throw error;
  }
};

// ── Create travel log with defaults ─────────────────────
// Mirrors default_get from Odoo model
export const createTravelLog = async (values) => {
  try {
    const now = new Date();
    const currentFloatTime = now.getHours() + now.getMinutes() / 60.0;

    const defaults = {
      travel_date: now.toISOString().split('T')[0], // Today
      travel_check_in_time: currentFloatTime, // Float format (14.5 = 14:30)
      employee_id: odooSession.userInfo?.employee_id?.[0] || false,
      technician_id: [[6, 0, [odooSession.uid]]], // Many2many format
      travel_is_company_vehicle: true,
      ...values,
    };

    const travelLogId = await createOdooRecord(MODEL, defaults);
    return travelLogId;
  } catch (error) {
    console.error('Failed to create travel log:', error);
    throw error;
  }
};

export const submitTravelLogToOdoo = async (payload) => {
  const fromSiteId = await resolveSiteId(payload.siteFrom || payload.fromSite);
  const toSiteId = await resolveSiteId(payload.siteTo || payload.toSite);

  if (!fromSiteId || !toSiteId) {
    const model = await getTravelSiteModel();
    throw new Error(
      `Could not match the route sites in Odoo. Check "${payload.siteFrom}" and "${payload.siteTo}" against ${model}.`
    );
  }

  const technicianIds = normaliseTechnicianIds(payload.teamOnSite);
  const values = {
    travel_date: formatOdooDate(payload.checkin || payload.travelDate || new Date()),
    travel_check_in_time: dateToFloatTime(payload.checkin || new Date()),
    travel_check_out_time: payload.checkout ? dateToFloatTime(payload.checkout) : 0,
    travel_from_site_id: fromSiteId,
    travel_to_site_id: toSiteId,
    travel_kilometers: Number(payload.kilometres || payload.kilometers || 0),
    travel_is_company_vehicle: payload.transport !== 'my',
    travel_notes: payload.notes || '',
    travel_screenshot: Boolean(payload.screenshotAttached),
    employee_id: odooSession.userInfo?.employee_id?.[0] || false,
    technician_id: [[6, 0, technicianIds]],
  };

  const travelLogId = await createTravelLog(values);

  if (payload.checkout) {
    try {
      await recordCheckOut(travelLogId);
    } catch (error) {
      console.warn('Odoo checkout action failed after travel log create:', error.message);
    }
  }

  try {
    await createExpenseFromTravel(travelLogId);
  } catch (error) {
    console.warn('Odoo expense action failed after travel log create:', error.message);
  }

  return getTravelLog(travelLogId);
};

// ── Update travel log ───────────────────────────────────
export const updateTravelLog = async (travelLogId, values) => {
  try {
    const result = await updateOdooRecord(MODEL, travelLogId, values);
    return result;
  } catch (error) {
    console.error('Failed to update travel log:', error);
    throw error;
  }
};

// ── Record check-in time ────────────────────────────────
export const recordCheckIn = async (travelLogId, toSiteId, fromSiteId, kilometers) => {
  try {
    const now = new Date();
    const checkInTime = now.getHours() + now.getMinutes() / 60.0;

    const values = {
      travel_check_in_time: checkInTime,
      travel_to_site_id: toSiteId,
      travel_from_site_id: fromSiteId,
      travel_kilometers: kilometers,
    };

    await updateOdooRecord(MODEL, travelLogId, values);
    return true;
  } catch (error) {
    console.error('Failed to record check-in:', error);
    throw error;
  }
};

// ── Record check-out time (matches action_set_check_out_time) ───────
export const recordCheckOut = async (travelLogId) => {
  try {
    const now = new Date();
    const checkOutTime = now.getHours() + now.getMinutes() / 60.0;

    // Call the Odoo action instead of direct update
    // This ensures all server-side logic runs (constraints, audit, etc.)
    const result = await callOdooAction(MODEL, travelLogId, 'action_set_check_out_time');

    return result;
  } catch (error) {
    console.error('Failed to record check-out:', error);
    throw error;
  }
};

// ── Create expense from travel log (matches action_create_expense) ──
export const createExpenseFromTravel = async (travelLogId) => {
  try {
    // Call the Odoo action that handles all the expense creation logic
    const result = await callOdooAction(MODEL, travelLogId, 'action_create_expense');

    return result;
  } catch (error) {
    console.error('Failed to create expense:', error);
    throw error;
  }
};

// ── Open linked expense (matches action_open_expense) ───
export const openLinkedExpense = async (travelLogId) => {
  try {
    const log = await getTravelLog(travelLogId);

    if (!log.travel_expense_id || !log.travel_expense_id[0]) {
      throw new Error('No expense linked to this travel log');
    }

    // Return the expense ID so app can navigate to it
    return log.travel_expense_id[0];
  } catch (error) {
    console.error('Failed to open expense:', error);
    throw error;
  }
};

// ── Update vehicle type ─────────────────────────────────
export const setVehicleType = async (travelLogId, isCompanyVehicle) => {
  try {
    const values = {
      travel_is_company_vehicle: isCompanyVehicle,
    };

    await updateOdooRecord(MODEL, travelLogId, values);
    return true;
  } catch (error) {
    console.error('Failed to update vehicle type:', error);
    throw error;
  }
};

// ── Mark screenshot captured ────────────────────────────
export const markScreenshotCaptured = async (travelLogId, base64Data = null) => {
  try {
    const values = {
      travel_screenshot: true,
    };

    // If base64 provided, attach as attachment (optional)
    // In full implementation, you might store this separately

    await updateOdooRecord(MODEL, travelLogId, values);
    return true;
  } catch (error) {
    console.error('Failed to mark screenshot:', error);
    throw error;
  }
};

// ── Add travel notes ────────────────────────────────────
export const addTravelNotes = async (travelLogId, notes) => {
  try {
    const values = {
      travel_notes: notes,
    };

    await updateOdooRecord(MODEL, travelLogId, values);
    return true;
  } catch (error) {
    console.error('Failed to add notes:', error);
    throw error;
  }
};

// ── Unlock checkout for editing ─────────────────────────
export const unlockCheckoutEdit = async (travelLogId) => {
  try {
    const values = {
      travel_checkout_unlocked: true,
    };

    await updateOdooRecord(MODEL, travelLogId, values);
    return true;
  } catch (error) {
    console.error('Failed to unlock checkout:', error);
    throw error;
  }
};

// ── Delete travel log ───────────────────────────────────
// Odoo's unlink() automatically deletes linked expenses
export const deleteTravelLog = async (travelLogId) => {
  try {
    const result = await deleteOdooRecord(MODEL, travelLogId);
    return result;
  } catch (error) {
    console.error('Failed to delete travel log:', error);
    throw error;
  }
};

// ── Get open travel logs (not checked out) ───────────────
export const getOpenTravelLogs = async () => {
  try {
    const domain = [['travel_status', '=', 'open']];
    const logs = await searchOdooRecords(MODEL, domain, TRAVEL_LOG_FIELDS);
    return logs;
  } catch (error) {
    console.error('Failed to fetch open logs:', error);
    throw error;
  }
};

// ── Get logs needing expense ────────────────────────────
// Matches travel_expense_alert computed field
export const getLogsNeedingExpense = async () => {
  try {
    const domain = [['travel_expense_alert', '=', 'expense']];
    const logs = await searchOdooRecords(MODEL, domain, TRAVEL_LOG_FIELDS);
    return logs;
  } catch (error) {
    console.error('Failed to fetch logs needing expense:', error);
    throw error;
  }
};

// ── Get logs by date range ──────────────────────────────
export const getTravelLogsByDateRange = async (startDate, endDate) => {
  try {
    const domain = [
      ['travel_date', '>=', startDate],
      ['travel_date', '<=', endDate],
    ];
    const logs = await searchOdooRecords(MODEL, domain, TRAVEL_LOG_FIELDS);
    return logs;
  } catch (error) {
    console.error('Failed to fetch logs by date range:', error);
    throw error;
  }
};

// ── Utility: Convert float time to HH:MM format ────────
export const floatTimeToHHMM = (floatTime) => {
  if (!floatTime) return '--:--';
  const hours = Math.floor(floatTime);
  const minutes = Math.round((floatTime - hours) * 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

// ── Utility: Convert HH:MM to float time ────────────────
export const HHMMToFloatTime = (hours, minutes) => {
  return hours + minutes / 60.0;
};

export default {
  getMyTravelLogs,
  getTravelLog,
  createTravelLog,
  updateTravelLog,
  recordCheckIn,
  recordCheckOut,
  createExpenseFromTravel,
  openLinkedExpense,
  setVehicleType,
  markScreenshotCaptured,
  addTravelNotes,
  unlockCheckoutEdit,
  deleteTravelLog,
  getOpenTravelLogs,
  getLogsNeedingExpense,
  getTravelLogsByDateRange,
  floatTimeToHHMM,
  HHMMToFloatTime,
  MODEL,
  FIELDS: TRAVEL_LOG_FIELDS,
  submitTravelLogToOdoo,
  toSubmittedLogCard,
};
