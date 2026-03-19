import { Types } from 'mongoose';
import { Agent, IAgent } from '../models/Agent';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateAgentInput {
  userId: string;
  locationName: string;
  address: string;
  neighborhood: string;
  city: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  contactPhone: string;
  operatingHours: {
    open: string;
    close: string;
    daysOfWeek: string[];
  };
  capacity: {
    totalShelves: number;
    availableShelves: number;
  };
}

export interface UpdateAgentInput {
  locationName?: string;
  address?: string;
  neighborhood?: string;
  city?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  contactPhone?: string;
  operatingHours?: {
    open: string;
    close: string;
    daysOfWeek: string[];
  };
  capacity?: {
    totalShelves?: number;
    availableShelves?: number;
  };
}

export interface AgentFilters {
  city?: string;
  neighborhood?: string;
  page?: number;
  includeInactive?: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// ---------------------------------------------------------------------------
// Task 7.1 – Agent management service
// ---------------------------------------------------------------------------

/**
 * Create a new agent location.
 * Admin-only enforcement is handled at the route level.
 *
 * Requirements: 11.1
 */
export async function createAgent(data: CreateAgentInput): Promise<IAgent> {
  const agent = await Agent.create({
    userId: new Types.ObjectId(data.userId),
    locationName: data.locationName,
    address: data.address,
    neighborhood: data.neighborhood,
    city: data.city,
    coordinates: data.coordinates,
    contactPhone: data.contactPhone,
    operatingHours: data.operatingHours,
    capacity: data.capacity,
    isActive: true,
  });

  return agent;
}

/**
 * List active agents with optional city/neighborhood filtering and pagination.
 *
 * Requirements: 11.4, 11.5
 */
export async function getAgents(filters: AgentFilters = {}): Promise<PaginatedResult<IAgent>> {
  const { city, neighborhood, page = 1, includeInactive = false } = filters;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const query: Record<string, any> = {};
  if (!includeInactive) query['isActive'] = true;

  if (city) query['city'] = new RegExp(`^${city}$`, 'i');
  if (neighborhood) query['neighborhood'] = new RegExp(`^${neighborhood}$`, 'i');

  const skip = (page - 1) * PAGE_LIMIT;
  const [data, total] = await Promise.all([
    Agent.find(query).sort({ locationName: 1 }).skip(skip).limit(PAGE_LIMIT),
    Agent.countDocuments(query),
  ]);

  return {
    data,
    page,
    limit: PAGE_LIMIT,
    total,
    totalPages: Math.ceil(total / PAGE_LIMIT),
  };
}

/**
 * Get a single agent by agentId.
 *
 * Requirements: 11.1
 */
export async function getAgentById(agentId: string): Promise<IAgent> {
  const agent = await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }
  return agent;
}

/**
 * Update agent details.
 * Admin-only enforcement is handled at the route level.
 *
 * Requirements: 11.3
 */
export async function updateAgent(agentId: string, data: UpdateAgentInput): Promise<IAgent> {
  const agent = Types.ObjectId.isValid(agentId)
    ? await Agent.findById(agentId)
    : await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  if (data.locationName !== undefined) agent.locationName = data.locationName;
  if (data.address !== undefined) agent.address = data.address;
  if (data.neighborhood !== undefined) agent.neighborhood = data.neighborhood;
  if (data.city !== undefined) agent.city = data.city;
  if (data.contactPhone !== undefined) agent.contactPhone = data.contactPhone;

  if (data.coordinates !== undefined) {
    agent.coordinates = data.coordinates;
  }

  if (data.operatingHours !== undefined) {
    agent.operatingHours = data.operatingHours;
  }

  if (data.capacity !== undefined) {
    if (data.capacity.totalShelves !== undefined) {
      agent.capacity.totalShelves = data.capacity.totalShelves;
    }
    if (data.capacity.availableShelves !== undefined) {
      agent.capacity.availableShelves = data.capacity.availableShelves;
    }
  }

  await agent.save();
  return agent;
}

/**
 * Deactivate an agent by setting isActive=false.
 * Admin-only enforcement is handled at the route level.
 *
 * Requirements: 11.3
 */
export async function deactivateAgent(agentId: string): Promise<IAgent> {
  const agent = Types.ObjectId.isValid(agentId)
    ? await Agent.findById(agentId)
    : await Agent.findOne({ agentId });
  if (!agent) {
    throw makeError(`Agent ${agentId} not found`, 'NOT_FOUND');
  }

  agent.isActive = false;
  await agent.save();
  return agent;
}

/**
 * Find active agents within a given radius (km) of a coordinate point.
 * Uses a bounding-box approximation since the Agent model stores flat
 * latitude/longitude rather than a GeoJSON Point field.
 *
 * 1 degree latitude ≈ 111 km; longitude degrees vary by latitude.
 *
 * Requirements: 11.2, 11.4
 */
export async function getNearbyAgents(
  lat: number,
  lng: number,
  radiusKm: number
): Promise<IAgent[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));

  const agents = await Agent.find({
    isActive: true,
    'coordinates.latitude': { $gte: lat - latDelta, $lte: lat + latDelta },
    'coordinates.longitude': { $gte: lng - lngDelta, $lte: lng + lngDelta },
  });

  // Filter precisely by Haversine distance
  return agents.filter((agent) => {
    const d = haversineKm(lat, lng, agent.coordinates.latitude, agent.coordinates.longitude);
    return d <= radiusKm;
  });
}

/** Haversine formula – returns distance in km between two lat/lng points. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
