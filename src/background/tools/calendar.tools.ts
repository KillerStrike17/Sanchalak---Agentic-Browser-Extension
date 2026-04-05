// ─── Calendar & Scheduling Tools ────────────────────────────────────────────
// Phase 3: Calendar management, bookings, and reservations.
// Works with Google Calendar, Outlook Calendar, Calendly, and booking sites.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

function createContentTool(tool: Omit<Tool, 'execute'>): Tool {
  return {
    ...tool,
    execute: async (params) => {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('No active tab');
      await ensureContentScript(tab.id);
      const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
        tab.id,
        { type: 'EXECUTE_TOOL', tool: tool.name, params, requestId: `tool_${Date.now()}` }
      );
      return response?.result || { success: false, error: 'No response from content script' };
    },
  };
}

export function registerCalendarTools(): void {

  // ── Calendar Management (11 tools) ───────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'check_availability',
    description: 'Check the calendar for free time slots on a given date or date range.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'date', type: 'string', description: 'Date to check in YYYY-MM-DD or natural language (e.g. "next Tuesday")', required: true },
      { name: 'duration', type: 'number', description: 'Duration of the slot needed in minutes (default: 60)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_event',
    description: 'Create a new calendar event with title, date, time, and optional attendees.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'title', type: 'string', description: 'Event title', required: true },
      { name: 'date', type: 'string', description: 'Event date in YYYY-MM-DD or natural language', required: true },
      { name: 'startTime', type: 'string', description: 'Start time in HH:MM (24-hour)', required: false },
      { name: 'endTime', type: 'string', description: 'End time in HH:MM (24-hour)', required: false },
      { name: 'duration', type: 'number', description: 'Duration in minutes (alternative to endTime)', required: false },
      { name: 'location', type: 'string', description: 'Physical or virtual meeting location/URL', required: false },
      { name: 'description', type: 'string', description: 'Event description or agenda', required: false },
      { name: 'attendees', type: 'string', description: 'Comma-separated list of attendee email addresses', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'edit_event',
    description: 'Modify an existing calendar event (title, time, location, description, attendees).',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Title or partial title to find the event', required: true },
      { name: 'newTitle', type: 'string', description: 'Updated event title', required: false },
      { name: 'newDate', type: 'string', description: 'Updated date', required: false },
      { name: 'newStartTime', type: 'string', description: 'Updated start time in HH:MM', required: false },
      { name: 'newEndTime', type: 'string', description: 'Updated end time in HH:MM', required: false },
      { name: 'newLocation', type: 'string', description: 'Updated location', required: false },
      { name: 'newDescription', type: 'string', description: 'Updated description', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'delete_event',
    description: 'Delete or cancel a calendar event. Requires confirmation.',
    category: 'calendar',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Title or partial title of the event to delete', required: true },
      { name: 'date', type: 'string', description: 'Date of the event to narrow results', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_attendees',
    description: 'Add attendees to an existing calendar event.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Title of the event to add attendees to', required: true },
      { name: 'attendees', type: 'string', description: 'Comma-separated email addresses to add', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'send_invites',
    description: 'Send or re-send calendar invitations to attendees of an event.',
    category: 'calendar',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Event title to send invites for', required: true },
      { name: 'attendees', type: 'string', description: 'Specific attendees to invite (all if omitted)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'set_reminder',
    description: 'Set or update a reminder notification for an event.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Event title to set reminder for', required: true },
      { name: 'minutesBefore', type: 'number', description: 'Minutes before the event to send reminder (e.g. 15, 30, 60)', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'find_meeting_time',
    description: 'Find a common free time slot for multiple attendees based on calendar availability.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'attendees', type: 'string', description: 'Comma-separated email addresses to find a time for', required: true },
      { name: 'duration', type: 'number', description: 'Required meeting duration in minutes', required: true },
      { name: 'dateRange', type: 'string', description: 'Date range to search in, e.g. "next week", "April 10-15"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'reschedule_meeting',
    description: 'Move an existing event to a new date and/or time. Requires confirmation.',
    category: 'calendar',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'eventTitle', type: 'string', description: 'Event title to reschedule', required: true },
      { name: 'newDate', type: 'string', description: 'New date for the event', required: true },
      { name: 'newStartTime', type: 'string', description: 'New start time in HH:MM', required: false },
      { name: 'notifyAttendees', type: 'boolean', description: 'Send update notifications to attendees (default: true)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'view_week',
    description: 'Switch the calendar to week view and extract all events for the current or specified week.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'weekOf', type: 'string', description: 'Date within the target week in YYYY-MM-DD (default: current week)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'view_month',
    description: 'Switch the calendar to month view and extract all events for the current or specified month.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'month', type: 'string', description: 'Month to view in YYYY-MM format (default: current month)', required: false },
    ],
  }));

  // ── Booking & Reservations (8 tools) ─────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'book_flight',
    description: 'Search for and initiate a flight booking on a travel site. Shows options — user confirms purchase.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'from', type: 'string', description: 'Departure city or airport code', required: true },
      { name: 'to', type: 'string', description: 'Destination city or airport code', required: true },
      { name: 'departDate', type: 'string', description: 'Departure date in YYYY-MM-DD', required: true },
      { name: 'returnDate', type: 'string', description: 'Return date in YYYY-MM-DD (for round-trip)', required: false },
      { name: 'passengers', type: 'number', description: 'Number of passengers (default: 1)', required: false },
      { name: 'cabinClass', type: 'string', description: 'Cabin class: "economy", "business", "first"', required: false, enum: ['economy', 'business', 'first'], default: 'economy' },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'book_hotel',
    description: 'Search for and initiate a hotel reservation. Shows options — user confirms booking.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'location', type: 'string', description: 'City or area to search for hotels', required: true },
      { name: 'checkIn', type: 'string', description: 'Check-in date in YYYY-MM-DD', required: true },
      { name: 'checkOut', type: 'string', description: 'Check-out date in YYYY-MM-DD', required: true },
      { name: 'guests', type: 'number', description: 'Number of guests (default: 1)', required: false },
      { name: 'maxPricePerNight', type: 'number', description: 'Maximum price per night in USD', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'book_restaurant',
    description: 'Make a restaurant reservation on OpenTable, Yelp, or the restaurant website.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'restaurant', type: 'string', description: 'Restaurant name or search query', required: true },
      { name: 'date', type: 'string', description: 'Reservation date in YYYY-MM-DD', required: true },
      { name: 'time', type: 'string', description: 'Preferred time in HH:MM', required: true },
      { name: 'partySize', type: 'number', description: 'Number of diners', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'book_appointment',
    description: 'Schedule an appointment on a booking site (doctor, salon, mechanic, etc.).',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'service', type: 'string', description: 'Type of service/appointment', required: true },
      { name: 'preferredDate', type: 'string', description: 'Preferred date in YYYY-MM-DD', required: false },
      { name: 'preferredTime', type: 'string', description: 'Preferred time in HH:MM', required: false },
      { name: 'notes', type: 'string', description: 'Special instructions or notes for the booking', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'check_booking_availability',
    description: 'Check available dates/times for a service, restaurant, flight, or hotel.',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'service', type: 'string', description: 'Service type to check availability for', required: true },
      { name: 'dateRange', type: 'string', description: 'Date range to check, e.g. "April 15-20"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'cancel_booking',
    description: 'Cancel an existing reservation or booking. Requires confirmation.',
    category: 'calendar',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'bookingId', type: 'string', description: 'Booking reference ID or confirmation number', required: false },
      { name: 'bookingType', type: 'string', description: 'Type of booking: "flight", "hotel", "restaurant", "appointment"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'modify_reservation',
    description: 'Change the details of an existing reservation (date, time, number of guests, etc.).',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'bookingId', type: 'string', description: 'Booking reference ID or confirmation number', required: false },
      { name: 'changeType', type: 'string', description: 'What to change: "date", "time", "guests", "room", "seat"', required: true },
      { name: 'newValue', type: 'string', description: 'New value for the change', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_special_requests',
    description: 'Add special requests or notes to an existing booking (dietary restrictions, room preferences, etc.).',
    category: 'calendar',
    safetyLevel: 'safe',
    parameters: [
      { name: 'request', type: 'string', description: 'Special request or note to add', required: true },
      { name: 'bookingId', type: 'string', description: 'Booking reference ID', required: false },
    ],
  }));
}
