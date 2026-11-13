'use strict';

/**
 * The Plumtree Connect catalogue.
 *
 * This module is the single source of truth for the taxonomy that groups job
 * and service listings into browsable category pages. It is deliberately plain
 * data with no database or framework dependency, so it can be required by the
 * seeder, the API routes and any tooling without pulling in the rest of the app.
 *
 * Shape:
 *   GROUPS             umbrella pages ("Real estate", "Agriculture", ...)
 *   JOB_CATEGORIES     job sub-categories, each pointing at a group slug
 *   SERVICE_CATEGORIES service sub-categories, each pointing at a group slug
 *   LOCATIONS          towns, wards and villages in the coverage area
 *
 * A group with scope 'both' appears on the jobs board and the service
 * directory. A group with scope 'job' or 'service' appears on one only.
 */

const GROUPS = [
  ['real-estate', 'Real estate & property', '🏠', 'both', 'Property sales, letting, caretaking and estate management'],
  ['agriculture', 'Agriculture & livestock', '🌾', 'both', 'Crops, livestock, irrigation, agro-processing and farm work'],
  ['transport-logistics', 'Transport & logistics', '🚚', 'both', 'Driving, haulage, courier, removals and cross-border trade'],
  ['retail-wholesale', 'Retail & wholesale', '🛒', 'both', 'Shop floor, tills, merchandising, supply and distribution'],
  ['professional-services', 'Professional services', '💼', 'both', 'Accounting, legal, consulting, marketing and business support'],
  ['construction-trades', 'Construction & trades', '🧱', 'both', 'Building, plumbing, electrical work and site labour'],
  ['manufacturing-industry', 'Manufacturing & industry', '🏭', 'both', 'Welding, metalwork, carpentry, milling and production'],
  ['energy-utilities', 'Energy & utilities', '⚡', 'both', 'Solar, electrical installation, water and power services'],
  ['ict-admin', 'ICT & admin', '💻', 'both', 'Clerical work, data capture, IT support and equipment repair'],
  ['health-care', 'Health & care', '🩺', 'both', 'Nursing, care work, pharmacy and community health'],
  ['education-training', 'Education & training', '📚', 'both', 'Teaching, tutoring, ECD and vocational instruction'],
  ['hospitality-tourism', 'Hospitality & tourism', '🍽️', 'both', 'Lodges, kitchens, housekeeping, tours and event catering'],
  ['home-domestic', 'Home & domestic', '🧹', 'both', 'Housekeeping, gardening, cleaning, laundry and general hands'],
  ['personal-care', 'Personal care & wellness', '💅', 'service', 'Hair, nails, grooming, make-up and wellness treatments'],
  ['security', 'Security services', '🛡️', 'both', 'Guarding, gate control, patrol work and alarms'],
  ['events-media', 'Events & media', '🎉', 'both', 'Tents, décor, sound, photography, printing and promotion'],
];

// [group slug, name, icon, description]
const JOB_CATEGORIES = [
  ['agriculture', 'Agriculture & Farming', '🌾', 'Field work, irrigation, crop handling and produce grading'],
  ['agriculture', 'Livestock & Herding', '🐄', 'Cattle, goats, dipping, feeding and livestock records'],
  ['real-estate', 'Real Estate & Property', '🏠', 'Estate agents, letting staff, caretakers and property managers'],
  ['construction-trades', 'Construction & Trades', '🧱', 'Bricklaying, plumbing, carpentry, painting and general building'],
  ['manufacturing-industry', 'Manufacturing & Production', '🏭', 'Factory hands, machine operators, milling and packaging'],
  ['energy-utilities', 'Energy & Utilities', '⚡', 'Electrical, solar, water reticulation and plant maintenance'],
  ['transport-logistics', 'Transport & Logistics', '🚚', 'Driving, cross-border haulage, loading and courier work'],
  ['retail-wholesale', 'Retail & Sales', '🛒', 'Shop assistants, tills, merchandising and sales agents'],
  ['retail-wholesale', 'Wholesale & Distribution', '📦', 'Warehouse, stock control, dispatch and wholesale supply'],
  ['professional-services', 'Professional Services', '💼', 'Administrators, consultants, agents and business support'],
  ['professional-services', 'Finance & Accounting', '🏦', 'Bookkeepers, cashiers, credit control and audit assistants'],
  ['ict-admin', 'ICT & Admin', '💻', 'Clerical work, data capture, IT support and reception'],
  ['health-care', 'Health & Care', '🩺', 'Nursing, care work, pharmacy and community health'],
  ['education-training', 'Education & Training', '📚', 'Teaching, tutoring, ECD and vocational instruction'],
  ['hospitality-tourism', 'Hospitality & Catering', '🍽️', 'Lodges, kitchens, housekeeping and event catering'],
  ['home-domestic', 'Domestic & General Work', '🧹', 'Housekeeping, gardening and general hands'],
  ['security', 'Security Services', '🛡️', 'Guarding, gate control and patrol work'],
  ['events-media', 'Events & Media', '🎉', 'Event crew, photography, sound and promotion'],
];

// [group slug, name, icon, description]
const SERVICE_CATEGORIES = [
  ['construction-trades', 'Building & Renovation', '🏗️', 'Builders, plasterers, tilers and renovations'],
  ['construction-trades', 'Plumbing & Boreholes', '🚰', 'Pipe fitting, borehole drilling and pump repair'],
  ['energy-utilities', 'Electrical & Solar', '💡', 'Wiring, solar installation and appliance repair'],
  ['manufacturing-industry', 'Welding & Metalwork', '🔧', 'Gates, window frames, burglar bars and repairs'],
  ['manufacturing-industry', 'Carpentry & Furniture', '🪚', 'Fitted cupboards, doors, roofing timber and furniture'],
  ['transport-logistics', 'Transport & Moving', '🚛', 'Truck hire, removals and cross-border errands'],
  ['home-domestic', 'Cleaning & Laundry', '🧼', 'Home and office cleaning, laundry services'],
  ['home-domestic', 'Home & Garden', '🌳', 'Gardening, tree felling, pest control and fencing'],
  ['events-media', 'Events & Catering', '🎉', 'Tents, décor, catering and sound hire'],
  ['personal-care', 'Beauty & Wellness', '💅', 'Hair, nails, make-up and grooming'],
  ['agriculture', 'Agriculture Services', '🐄', 'Livestock handling, dip tank and irrigation services'],
  ['real-estate', 'Real Estate Services', '🏠', 'Estate agents, letting, valuations and property management'],
  ['professional-services', 'Business Services', '💼', 'Accounting, legal, consulting, printing and marketing'],
  ['retail-wholesale', 'Retail & Wholesale', '🛒', 'Hardware supply, wholesale stock and trade counters'],
  ['ict-admin', 'ICT & Repairs', '🖥️', 'Computer, phone and appliance repair and IT support'],
  ['security', 'Security & Alarms', '🛡️', 'Guarding, alarms, fencing and access control'],
  ['health-care', 'Health & Wellness Services', '🩺', 'Home care, physiotherapy and mobile health services'],
];

const LOCATIONS = [
  ['Plumtree Town', 'town', 'Central business district, border post and main market area'],
  ['Dingumuzi', 'ward', 'High-density suburb south east of the town centre'],
  ['Empandeni', 'ward', 'Rural ward along the Bulilima road'],
  ['Tshitshi', 'ward', 'Rural ward with strong cattle farming activity'],
  ['Matjinge', 'ward', 'Farming ward near the Botswana border'],
  ['Marula', 'ward', 'Mining and farming ward'],
  ['Ndiweni', 'ward', 'Residential ward close to the bus terminus'],
  ['Bhango', 'village', 'Village community with a growing market centre'],
  ['Mangwe', 'ward', 'District ward with a rural service centre'],
  ['Bulilima', 'ward', 'Border ward with cross-border trading'],
  ['Figtree', 'village', 'Railway village 25km east of Plumtree'],
  ['Gwanda', 'town', 'Provincial capital of Matabeleland South'],
  ['Esigodini', 'town', 'Growth point on the Bulawayo road'],
  ['Filabusi', 'town', 'Small town in Insiza district'],
  ['Beitbridge', 'town', 'Busy border town and trade corridor'],
];

const CATEGORY_KINDS = { JOB: 'job', SERVICE: 'service' };

function groupBySlug(slug) {
  return GROUPS.find(([s]) => s === slug) || null;
}

function categorySlug(name) {
  return String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Categories for a kind, each annotated with its resolved group slug. */
function categoriesFor(kind) {
  const rows = kind === CATEGORY_KINDS.SERVICE ? SERVICE_CATEGORIES : JOB_CATEGORIES;
  return rows.map(([group, name, icon, description]) => ({ group, name, slug: categorySlug(name), icon, description }));
}

/** Groups that apply to a kind, preserving catalogue order. */
function groupsFor(kind) {
  return GROUPS.filter(([, , , scope]) => scope === 'both' || scope === kind)
    .map(([slug, name, icon, scope, description]) => ({ slug, name, icon, scope, description }));
}

module.exports = {
  GROUPS,
  JOB_CATEGORIES,
  SERVICE_CATEGORIES,
  LOCATIONS,
  CATEGORY_KINDS,
  groupBySlug,
  categorySlug,
  categoriesFor,
  groupsFor,
};
