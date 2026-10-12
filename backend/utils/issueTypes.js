export const ISSUE_TYPES = [
  'Maintenance',
  'Engine',
  'Transmission',
  'Brakes',
  'Electrical',
  'Suspension',
  'Cooling',
  'Exhaust',
  'Tyres',
  'Body',
  'Other',
];

export function inferIssueType(name = '', requiredSkill = '') {
  const value = `${name} ${requiredSkill}`.toLowerCase();
  if (/brake/.test(value)) return 'Brakes';
  if (/engine/.test(value)) return 'Engine';
  if (/electrical|electric/.test(value)) return 'Electrical';
  if (/transmission|gearbox/.test(value)) return 'Transmission';
  if (/suspension|steering/.test(value)) return 'Suspension';
  if (/cooling|radiator/.test(value)) return 'Cooling';
  if (/exhaust/.test(value)) return 'Exhaust';
  if (/tyre|tire|wheel/.test(value)) return 'Tyres';
  if (/body|paint|dent/.test(value)) return 'Body';
  if (/oil|service|maintenance/.test(value)) return 'Maintenance';
  return 'Other';
}
