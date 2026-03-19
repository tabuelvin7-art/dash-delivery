import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { CoverageArea } from '../models/CoverageArea';
import {
  createCoverageArea,
  getCoverageAreas,
  getCoverageAreaById,
  updateCoverageArea,
  validateAddressInCoverage,
  deactivateCoverageArea,
} from './coverageAreaService';

// A minimal valid GeoJSON Polygon (a small square)
const SAMPLE_POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [36.8, -1.3],
      [36.9, -1.3],
      [36.9, -1.2],
      [36.8, -1.2],
      [36.8, -1.3],
    ],
  ],
};

describe('CoverageAreaService', () => {
  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await CoverageArea.deleteMany({});
  });

  // -------------------------------------------------------------------------
  // createCoverageArea()
  // -------------------------------------------------------------------------

  describe('createCoverageArea()', () => {
    it('creates a coverage area and auto-generates areaId', async () => {
      const area = await createCoverageArea('Westlands', 'Nairobi', SAMPLE_POLYGON);
      expect(area.name).toBe('Westlands');
      expect(area.city).toBe('Nairobi');
      expect(area.areaId).toMatch(/^AREA-\d{8}-\d{5}$/);
      expect(area.isActive).toBe(true);
    });

    it('stores the GeoJSON boundaries', async () => {
      const area = await createCoverageArea('Kilimani', 'Nairobi', SAMPLE_POLYGON);
      expect(area.boundaries.type).toBe('Polygon');
      expect(area.boundaries.coordinates).toEqual(SAMPLE_POLYGON.coordinates);
    });

    it('rejects empty name', async () => {
      await expect(createCoverageArea('', 'Nairobi', SAMPLE_POLYGON)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects empty city', async () => {
      await expect(createCoverageArea('Westlands', '', SAMPLE_POLYGON)).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });

    it('rejects invalid boundaries', async () => {
      await expect(
        createCoverageArea('Westlands', 'Nairobi', { type: 'Polygon', coordinates: null as any })
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  // -------------------------------------------------------------------------
  // getCoverageAreas()
  // -------------------------------------------------------------------------

  describe('getCoverageAreas()', () => {
    it('returns only active areas', async () => {
      const a1 = await createCoverageArea('Westlands', 'Nairobi', SAMPLE_POLYGON);
      const a2 = await createCoverageArea('Kilimani', 'Nairobi', SAMPLE_POLYGON);
      await deactivateCoverageArea(a2.areaId);

      const areas = await getCoverageAreas();
      expect(areas).toHaveLength(1);
      expect(areas[0].areaId).toBe(a1.areaId);
    });

    it('returns empty array when no active areas exist', async () => {
      const areas = await getCoverageAreas();
      expect(areas).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // getCoverageAreaById()
  // -------------------------------------------------------------------------

  describe('getCoverageAreaById()', () => {
    it('returns the area for a valid areaId', async () => {
      const created = await createCoverageArea('CBD', 'Nairobi', SAMPLE_POLYGON);
      const found = await getCoverageAreaById(created.areaId);
      expect(found.areaId).toBe(created.areaId);
      expect(found.name).toBe('CBD');
    });

    it('throws NOT_FOUND for unknown areaId', async () => {
      await expect(getCoverageAreaById('AREA-99999999-00001')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  // -------------------------------------------------------------------------
  // updateCoverageArea()
  // -------------------------------------------------------------------------

  describe('updateCoverageArea()', () => {
    it('updates name and city', async () => {
      const area = await createCoverageArea('Old Name', 'Old City', SAMPLE_POLYGON);
      const updated = await updateCoverageArea(area.areaId, {
        name: 'New Name',
        city: 'Mombasa',
      });
      expect(updated.name).toBe('New Name');
      expect(updated.city).toBe('Mombasa');
    });

    it('throws NOT_FOUND for unknown areaId', async () => {
      await expect(
        updateCoverageArea('AREA-00000000-00001', { name: 'X' })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });
  });

  // -------------------------------------------------------------------------
  // validateAddressInCoverage()
  // -------------------------------------------------------------------------

  describe('validateAddressInCoverage()', () => {
    beforeEach(async () => {
      await createCoverageArea('Westlands', 'Nairobi', SAMPLE_POLYGON);
    });

    it('returns true when address contains the area name', async () => {
      const result = await validateAddressInCoverage('123 Westlands Road, Nairobi');
      expect(result).toBe(true);
    });

    it('returns true when address contains the city name', async () => {
      const result = await validateAddressInCoverage('Some Street, Nairobi');
      expect(result).toBe(true);
    });

    it('is case-insensitive', async () => {
      const result = await validateAddressInCoverage('WESTLANDS AVENUE');
      expect(result).toBe(true);
    });

    it('returns false when address does not match any area', async () => {
      const result = await validateAddressInCoverage('123 Mombasa Road, Mombasa');
      expect(result).toBe(false);
    });

    it('returns false for empty address', async () => {
      const result = await validateAddressInCoverage('');
      expect(result).toBe(false);
    });

    it('returns false when no active areas exist', async () => {
      await CoverageArea.deleteMany({});
      const result = await validateAddressInCoverage('Westlands, Nairobi');
      expect(result).toBe(false);
    });

    it('ignores deactivated areas', async () => {
      const area = await createCoverageArea('Kilimani', 'Nairobi', SAMPLE_POLYGON);
      await deactivateCoverageArea(area.areaId);
      // "Kilimani" is now inactive; "Nairobi" still matches via Westlands area
      const kilimaniOnly = await validateAddressInCoverage('Kilimani Estate, Kisumu');
      expect(kilimaniOnly).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // deactivateCoverageArea()
  // -------------------------------------------------------------------------

  describe('deactivateCoverageArea()', () => {
    it('sets isActive=false', async () => {
      const area = await createCoverageArea('Parklands', 'Nairobi', SAMPLE_POLYGON);
      const deactivated = await deactivateCoverageArea(area.areaId);
      expect(deactivated.isActive).toBe(false);
    });

    it('throws NOT_FOUND for unknown areaId', async () => {
      await expect(deactivateCoverageArea('AREA-00000000-00001')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
