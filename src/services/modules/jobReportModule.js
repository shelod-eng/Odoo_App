// src/services/modules/jobReportModule.js
// JobReport model service - follows Odoo ORM pattern

import {
  searchOdooRecords,
  getOdooRecord,
  createOdooRecord,
  updateOdooRecord,
  deleteOdooRecord,
  callOdooAction,
  odooSession,
} from '../odoo';

const MODEL = 'job.report';

// ── Field Definitions (mirror Odoo model) ─────────────
const JOB_REPORT_FIELDS = [
  'id',
  'job_date',
  'project_id',
  'stage_id',
  'job_time_in',
  'job_previous_incomplete',
  'job_new_scope',
  'job_tasks_complete',
  'job_comments_complete',
  'job_tasks_incomplete',
  'job_comments_incomplete',
  'job_time_out',
  'technician_id',
  'job_next_date',
  'job_next_depends',
  'job_signature',
  'job_handover_contact',
  'job_before_pic',
  'job_after_pic',
];

// ── Get all job reports for current user ──────────────
export const getMyJobReports = async (limit = 50) => {
  try {
    if (!odooSession.uid) {
      throw new Error('Not authenticated');
    }

    // Get technician records for current user
    const domain = [['technician_id', 'ilike', odooSession.userInfo?.name || '']];
    const reports = await searchOdooRecords(MODEL, domain, JOB_REPORT_FIELDS, limit);

    return reports;
  } catch (error) {
    console.error('Failed to fetch job reports:', error);
    throw error;
  }
};

// ── Get single job report ───────────────────────────────
export const getJobReport = async (jobReportId) => {
  try {
    const report = await getOdooRecord(MODEL, jobReportId, JOB_REPORT_FIELDS);
    return report;
  } catch (error) {
    console.error('Failed to get job report:', error);
    throw error;
  }
};

// ── Create new job report ───────────────────────────────
// Follows the _defaults pattern from Odoo models
export const createJobReport = async (values) => {
  try {
    // Set defaults matching Odoo model
    const defaults = {
      job_date: new Date().toISOString().split('T')[0], // Today
      job_time_in: new Date().toISOString(),
      job_time_out: new Date().toISOString(),
      technician_id: [[6, 0, [odooSession.uid]]], // Many2many format
      ...values, // Override with passed values
    };

    const jobReportId = await createOdooRecord(MODEL, defaults);
    return jobReportId;
  } catch (error) {
    console.error('Failed to create job report:', error);
    throw error;
  }
};

// ── Update job report ───────────────────────────────────
export const updateJobReport = async (jobReportId, values) => {
  try {
    const result = await updateOdooRecord(MODEL, jobReportId, values);
    return result;
  } catch (error) {
    console.error('Failed to update job report:', error);
    throw error;
  }
};

// ── Save job time in ────────────────────────────────────
export const recordTimeIn = async (jobReportId, projectId, stageId = null) => {
  try {
    const values = {
      job_time_in: new Date().toISOString(),
      project_id: projectId,
      stage_id: stageId,
    };

    await updateOdooRecord(MODEL, jobReportId, values);
    return true;
  } catch (error) {
    console.error('Failed to record time in:', error);
    throw error;
  }
};

// ── Save job time out ───────────────────────────────────
export const recordTimeOut = async (jobReportId, tasksCompleted, tasksIncomplete, comments = '') => {
  try {
    const values = {
      job_time_out: new Date().toISOString(),
      job_tasks_complete: tasksCompleted,
      job_tasks_incomplete: tasksIncomplete,
      job_comments_complete: comments,
    };

    await updateOdooRecord(MODEL, jobReportId, values);
    return true;
  } catch (error) {
    console.error('Failed to record time out:', error);
    throw error;
  }
};

// ── Upload signature (binary field) ─────────────────────
export const uploadSignature = async (jobReportId, base64Data) => {
  try {
    // Odoo stores binary as base64 string
    const values = {
      job_signature: base64Data,
    };

    await updateOdooRecord(MODEL, jobReportId, values);
    return true;
  } catch (error) {
    console.error('Failed to upload signature:', error);
    throw error;
  }
};

// ── Mark photos captured (before/after) ─────────────────
export const markPhotoCaptured = async (jobReportId, type = 'before') => {
  try {
    const field = type === 'before' ? 'job_before_pic' : 'job_after_pic';
    const values = {
      [field]: true,
    };

    await updateOdooRecord(MODEL, jobReportId, values);
    return true;
  } catch (error) {
    console.error('Failed to mark photo captured:', error);
    throw error;
  }
};

// ── Schedule next job ───────────────────────────────────
export const scheduleNextJob = async (jobReportId, nextDate, requirements = '') => {
  try {
    const values = {
      job_next_date: nextDate,
      job_next_depends: requirements,
    };

    await updateOdooRecord(MODEL, jobReportId, values);
    return true;
  } catch (error) {
    console.error('Failed to schedule next job:', error);
    throw error;
  }
};

// ── Delete job report ───────────────────────────────────
export const deleteJobReport = async (jobReportId) => {
  try {
    const result = await deleteOdooRecord(MODEL, jobReportId);
    return result;
  } catch (error) {
    console.error('Failed to delete job report:', error);
    throw error;
  }
};

// ── Search by project ───────────────────────────────────
export const getJobReportsByProject = async (projectId) => {
  try {
    const domain = [['project_id', '=', projectId]];
    const reports = await searchOdooRecords(MODEL, domain, JOB_REPORT_FIELDS);
    return reports;
  } catch (error) {
    console.error('Failed to fetch reports by project:', error);
    throw error;
  }
};

// ── Search by date range ────────────────────────────────
export const getJobReportsByDateRange = async (startDate, endDate) => {
  try {
    const domain = [
      ['job_date', '>=', startDate],
      ['job_date', '<=', endDate],
    ];
    const reports = await searchOdooRecords(MODEL, domain, JOB_REPORT_FIELDS);
    return reports;
  } catch (error) {
    console.error('Failed to fetch reports by date range:', error);
    throw error;
  }
};

export default {
  getMyJobReports,
  getJobReport,
  createJobReport,
  updateJobReport,
  recordTimeIn,
  recordTimeOut,
  uploadSignature,
  markPhotoCaptured,
  scheduleNextJob,
  deleteJobReport,
  getJobReportsByProject,
  getJobReportsByDateRange,
  MODEL,
  FIELDS: JOB_REPORT_FIELDS,
};
