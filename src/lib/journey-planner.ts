import { Route, Stop, Trip, JourneySearchResult, ServiceDisruption } from '@/types/transit';

export interface PlanJourneyOptions {
  originStopId: string;
  destinationStopId: string;
  travelDate: string;
  preferredTime?: string;
  passengers?: number;
}

/**
 * Validates whether a route services origin -> destination in the correct sequence direction.
 * If originStopSequence < destinationStopSequence, the direction is valid.
 * Otherwise, the route is travelling in the reverse direction.
 */
export function isDirectionallyValid(
  route: Route,
  originStopId: string,
  destinationStopId: string
): { isValid: boolean; originIndex: number; destinationIndex: number; durationOffset: number } {
  // Sort stops by stopSequence
  const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);

  const originIndex = sortedStops.findIndex((s) => s.stopId === originStopId);
  const destIndex = sortedStops.findIndex((s) => s.stopId === destinationStopId);

  if (originIndex === -1 || destIndex === -1) {
    return { isValid: false, originIndex: -1, destinationIndex: -1, durationOffset: 0 };
  }

  if (originIndex >= destIndex) {
    // Reverse direction or same stop! Not valid for requested direction
    return { isValid: false, originIndex, destinationIndex: destIndex, durationOffset: 0 };
  }

  const originStop = sortedStops[originIndex];
  const destStop = sortedStops[destIndex];
  const durationOffset = (destStop.arrivalOffsetMinutes || 0) - (originStop.departureOffsetMinutes || 0);

  return {
    isValid: true,
    originIndex,
    destinationIndex: destIndex,
    durationOffset: Math.max(durationOffset, 15), // fallback min 15 mins
  };
}

/**
 * Searches for all available single-leg trips matching the origin, destination,
 * travel date, and directional constraints.
 */
export function searchDirectJourneys(
  routes: Route[],
  trips: Trip[],
  stops: Record<string, Stop>,
  disruptions: ServiceDisruption[],
  options: PlanJourneyOptions
): JourneySearchResult[] {
  const { originStopId, destinationStopId, travelDate, preferredTime, passengers = 1 } = options;

  const originStop = stops[originStopId];
  const destinationStop = stops[destinationStopId];

  if (!originStop || !destinationStop || originStopId === destinationStopId) {
    return [];
  }

  const results: JourneySearchResult[] = [];

  for (const route of routes) {
    if (route.status !== 'active') continue;

    const directionalCheck = isDirectionallyValid(route, originStopId, destinationStopId);
    if (!directionalCheck.isValid) continue;

    // Find scheduled or active trips for this route on this travel date
    const matchingTrips = trips.filter(
      (t) =>
        t.routeId === route.id &&
        t.travelDate === travelDate &&
        (t.status === 'scheduled' || t.status === 'boarding' || t.status === 'in_progress')
    );

    for (const trip of matchingTrips) {
      // Calculate remaining seats
      const availableSeats = Math.max(0, trip.totalSeats - trip.bookedSeats);

      // Check if enough seats for requested passengers
      const isBookingAllowed =
        availableSeats >= passengers && (trip.status === 'scheduled' || trip.status === 'boarding');

      // Check departure time preference if specified
      if (preferredTime && trip.departureTime < preferredTime) {
        // Skip trips earlier than preferred time
        continue;
      }

      // Check disruptions affecting this route or stops
      const activeDisruptions = disruptions.filter(
        (d) =>
          d.status === 'active' &&
          (d.routeId === route.id ||
            d.affectedRoutes.includes(route.routeNumber) ||
            d.stopId === originStopId ||
            d.stopId === destinationStopId)
      );

      // Calculate origin stop departure time and destination arrival time
      const sortedStops = [...route.stops].sort((a, b) => a.stopSequence - b.stopSequence);
      const originRouteStop = sortedStops[directionalCheck.originIndex];
      const destRouteStop = sortedStops[directionalCheck.destinationIndex];

      const depTime = addMinutesToTimeString(
        trip.departureTime,
        originRouteStop.departureOffsetMinutes || 0
      );
      const arrTime = addMinutesToTimeString(
        trip.departureTime,
        destRouteStop.arrivalOffsetMinutes || directionalCheck.durationOffset
      );

      results.push({
        route,
        trip,
        originStop,
        destinationStop,
        originIndex: directionalCheck.originIndex,
        destinationIndex: directionalCheck.destinationIndex,
        departureTime: depTime,
        arrivalTime: arrTime,
        estimatedDurationMinutes: directionalCheck.durationOffset,
        availableSeats,
        totalSeats: trip.totalSeats,
        fareAmount: route.fareAmount,
        isBookingAllowed,
        disruptions: activeDisruptions,
      });
    }
  }

  // Sort by departure time
  return results.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
}

/**
 * Helper to add minutes to "HH:MM" string format
 */
export function addMinutesToTimeString(timeStr: string, minutesToAdd: number): string {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = parseInt(mStr, 10) || 0;

  const totalMinutes = h * 60 + m + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60) % 24;
  const newMins = totalMinutes % 60;

  return `${String(newHours).padStart(2, '0')}:${String(newMins).padStart(2, '0')}`;
}
