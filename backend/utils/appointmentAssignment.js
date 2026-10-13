export function appointmentAssignmentTime(appointment) {
  if (!appointment?.assignedTechnician) return null;
  if (appointment.technicianAssignedAt) return appointment.technicianAssignedAt;
  const event = [...(appointment.history || [])].reverse().find(item =>
    item.details?.includes('Technician assignment changed') || item.action === 'Technician assigned' ||
    (item.action === 'Appointment created' && item.details?.includes('Initial status: Confirmed')),
  );
  return event?.timestamp || null;
}
