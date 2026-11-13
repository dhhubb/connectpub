import { serializeApplication } from './jobs';
import { APPLICATION_STATUS_LABELS, REQUEST_STATUS_LABELS, type Row } from './util';

/** Application row joined with job/applicant columns, shaped for the dashboard tables. */
export function serializeApplicationRow(row: Row): Row {
  const base = serializeApplication(row);
  return {
    ...base,
    jobTitle: row.job_title ?? null,
    company: row.company ?? null,
    jobStatus: row.job_status ?? null,
    locationName: row.location_name ?? null,
    categoryName: row.category_name ?? null,
    categoryIcon: row.category_icon ?? null,
    applicantName: row.applicant_name ?? null,
    applicantEmail: row.applicant_email ?? null,
    applicantPhone: row.applicant_phone ?? null,
    applicantWard: row.applicant_ward ?? null,
    applicantBio: row.applicant_bio ?? null,
    statusLabel: APPLICATION_STATUS_LABELS[row.status] || row.status,
  };
}

export function serializeRequestRow(row: Row): Row {
  return {
    id: row.id,
    providerId: row.provider_id,
    businessName: row.business_name,
    requesterId: row.requester_id,
    requesterName: row.requester_name,
    name: row.name,
    phone: row.phone,
    email: row.email,
    serviceNeeded: row.service_needed,
    details: row.details,
    preferredDate: row.preferred_date,
    budget: row.budget,
    status: row.status,
    statusLabel: REQUEST_STATUS_LABELS[row.status] || row.status,
    response: row.response,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeAudit(row: Row): Row {
  let details = row.details;
  if (details) {
    try { details = JSON.parse(details); } catch { /* keep raw string */ }
  }
  return {
    id: row.id,
    actorId: row.actor_id,
    actorName: row.actor_name,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    details,
    createdAt: row.created_at,
  };
}
