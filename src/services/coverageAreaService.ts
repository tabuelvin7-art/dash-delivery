import { CoverageArea, ICoverageArea } from '../models/CoverageArea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCoverageAreaInput {
  name: string;
  city: string;
  boundaries: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

export interface UpdateCoverageAreaInput {
  name?: string;
  city?: string;
  boundaries?: {
    type: 'Polygon';
    coordinates: number[][][];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeError(message: string, code: string): Error {
  return Object.assign(new Error(message), { code });
}

// ---------------------------------------------------------------------------
// Task 8.1 – Coverage area service
// ---------------------------------------------------------------------------

/**
 * Create a new coverage area.
 * Requirements: 12.1, 12.2
 */
export async function createCoverageArea(
  nameOrInput: string | CreateCoverageAreaInput,
  city?: string,
  boundaries?: CreateCoverageAreaInput['boundaries']
): Promise<ICoverageArea> {
  let name: string;
  let resolvedCity: string;
  let resolvedBoundaries: CreateCoverageAreaInput['boundaries'];

  if (typeof nameOrInput === 'object') {
    name = nameOrInput.name;
    resolvedCity = nameOrInput.city;
    resolvedBoundaries = nameOrInput.boundaries;
  } else {
    name = nameOrInput;
    resolvedCity = city!;
    resolvedBoundaries = boundaries!;
  }

  if (!name || name.trim().length === 0) throw makeError('Area name is required', 'VALIDATION_ERROR');
  if (!resolvedCity || resolvedCity.trim().length === 0) throw makeError('City is required', 'VALIDATION_ERROR');
  if (!resolvedBoundaries || !resolvedBoundaries.coordinates) throw makeError('Boundary coordinates are required', 'VALIDATION_ERROR');

  return CoverageArea.create({
    name,
    city: resolvedCity,
    boundaries: resolvedBoundaries,
    isActive: true,
  });
}

/**
 * List all active coverage areas.
 * Requirements: 12.4
 */
export async function getCoverageAreas(): Promise<ICoverageArea[]> {
  return CoverageArea.find({ isActive: true }).sort({ name: 1 });
}

/**
 * Get a single coverage area by areaId.
 */
export async function getCoverageAreaById(areaId: string): Promise<ICoverageArea> {
  const area = await CoverageArea.findOne({ areaId });
  if (!area) throw makeError(`Coverage area ${areaId} not found`, 'NOT_FOUND');
  return area;
}

/**
 * Update coverage area details.
 * Requirements: 12.2
 */
export async function updateCoverageArea(
  areaId: string,
  data: UpdateCoverageAreaInput
): Promise<ICoverageArea> {
  const area = await CoverageArea.findOne({ areaId });
  if (!area) throw makeError(`Coverage area ${areaId} not found`, 'NOT_FOUND');

  if (data.name !== undefined) area.name = data.name;
  if (data.city !== undefined) area.city = data.city;
  if (data.boundaries !== undefined) area.boundaries = data.boundaries;

  await area.save();
  return area;
}

/**
 * Deactivate a coverage area.
 * Requirements: 12.2
 */
export async function deactivateCoverageArea(areaId: string): Promise<ICoverageArea> {
  const area = await CoverageArea.findOne({ areaId });
  if (!area) throw makeError(`Coverage area ${areaId} not found`, 'NOT_FOUND');

  area.isActive = false;
  await area.save();
  return area;
}

/**
 * Validate whether an address falls within any active coverage area.
 * Uses case-insensitive string matching against city and area names.
 * Requirements: 12.3
 */
export async function validateAddressInCoverage(address: string): Promise<boolean> {
  if (!address || address.trim().length === 0) return false;

  const areas = await CoverageArea.find({ isActive: true }).select('name city');
  const lowerAddress = address.toLowerCase();

  return areas.some(
    (area) =>
      lowerAddress.includes(area.city.toLowerCase()) ||
      lowerAddress.includes(area.name.toLowerCase())
  );
}
