// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest';

let mockExistingShifts: any[] = [];

vi.mock('../utils/supabase', () => {
  const builder = {
    select: vi.fn(() => builder),
    in: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    gt: vi.fn(() => builder),
    neq: vi.fn(() => Promise.resolve({ data: mockExistingShifts, error: null })),
  };

  return {
    supabase: {
      from: vi.fn(() => builder),
      auth: {
        getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      functions: {
        setAuth: vi.fn(),
      },
    },
  };
});

vi.mock('../utils/activityLogger', () => ({
  activityLogger: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('./emailService', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('./SMSService', () => ({
  sendBulkSms: vi.fn().mockResolvedValue({ success: true }),
}));

import { filterShifts, findShiftConflicts, generateShiftDrafts, matchesRosterSearch } from './securityRosterService';

describe('findShiftConflicts', () => {
  afterEach(() => {
    mockExistingShifts = [];
  });

  it('does not flag a valid handover pair as a conflict', async () => {
    mockExistingShifts = [
      {
        id: 'shift-1',
        employee_id: 'guard-a',
        replacement_id: 'guard-b',
        start_time: '2026-04-10T08:00:00.000Z',
        end_time: '2026-04-10T16:00:00.000Z',
        status: 'scheduled',
        security_sites: { name: 'Main Site' },
      },
    ];

    const conflicts = await findShiftConflicts(
      [
        {
          site_id: 'site-1',
          post_id: null,
          employee_id: 'guard-b',
          replacement_id: null,
          start_time: '2026-04-10T08:00:00.000Z',
          end_time: '2026-04-10T16:00:00.000Z',
          status: 'scheduled',
          notes: null,
          workflow_status: 'draft',
        },
      ],
      [
        { id: 'guard-a', full_name: 'Guard A' },
        { id: 'guard-b', full_name: 'Guard B' },
      ] as any
    );

    expect(conflicts).toEqual([]);
  });

  it('still flags a real overlap for the same guard', async () => {
    mockExistingShifts = [
      {
        id: 'shift-2',
        employee_id: 'guard-b',
        replacement_id: null,
        start_time: '2026-04-10T08:00:00.000Z',
        end_time: '2026-04-10T16:00:00.000Z',
        status: 'scheduled',
        security_sites: { name: 'Main Site' },
      },
    ];

    const conflicts = await findShiftConflicts(
      [
        {
          site_id: 'site-1',
          post_id: null,
          employee_id: 'guard-b',
          replacement_id: null,
          start_time: '2026-04-10T08:00:00.000Z',
          end_time: '2026-04-10T16:00:00.000Z',
          status: 'scheduled',
          notes: null,
          workflow_status: 'draft',
        },
      ],
      [{ id: 'guard-b', full_name: 'Guard B' }] as any
    );

    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({
      employeeId: 'guard-b',
      employeeName: 'Guard B',
      conflictingShiftId: 'shift-2',
      source: 'existing',
    });
  });
});

describe('roster filtering', () => {
  it('matches query text across guard, site, post, county, and date', () => {
    const shift = {
      employee_id: 'guard-b',
      start_time: '2026-04-10T08:00:00.000Z',
      end_time: '2026-04-10T16:00:00.000Z',
      status: 'scheduled',
      security_sites: { name: 'Main Site', county: 'Nairobi' },
      security_posts: { name: 'Gate 1' },
      profiles: { full_name: 'Guard B' },
      workflow_status: 'draft',
      reason: null,
      notes: null,
    } as any;

    expect(matchesRosterSearch(shift, 'guard b')).toBe(true);
    expect(matchesRosterSearch(shift, 'main')).toBe(true);
    expect(matchesRosterSearch(shift, 'gate 1')).toBe(true);
    expect(matchesRosterSearch(shift, 'nairobi')).toBe(true);
    expect(matchesRosterSearch(shift, '2026-04-10')).toBe(true);
  });

  it('applies county and search filters together', () => {
    const shifts = [
      {
        employee_id: 'guard-a',
        start_time: '2026-04-10T08:00:00.000Z',
        end_time: '2026-04-10T16:00:00.000Z',
        status: 'scheduled',
        security_sites: { name: 'Main Site', county: 'Nairobi' },
        security_posts: { name: 'Gate 1' },
        profiles: { full_name: 'Guard A' },
        workflow_status: 'draft',
        reason: null,
        notes: null,
        site_id: 'site-1',
      },
      {
        employee_id: 'guard-b',
        start_time: '2026-04-10T08:00:00.000Z',
        end_time: '2026-04-10T16:00:00.000Z',
        status: 'scheduled',
        security_sites: { name: 'Coast Site', county: 'Mombasa' },
        security_posts: { name: 'Gate 2' },
        profiles: { full_name: 'Guard B' },
        workflow_status: 'draft',
        reason: null,
        notes: null,
        site_id: 'site-2',
      },
    ] as any[];

    const filtered = filterShifts(
      shifts as any,
      { timeframe: 'all', site_id: 'all', post_id: 'all', branch_id: 'all', employee_id: 'all', county: 'Nairobi', query: 'guard a' },
      new Date('2026-04-10T00:00:00.000Z')
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0].employee_id).toBe('guard-a');
  });
});

describe('bulk draft generation', () => {
  it('rejects a bulk request with no guards', () => {
    expect(() =>
      generateShiftDrafts({
        site_id: 'site-1',
        post_id: '',
        employee_id: '',
        employee_ids: [],
        replacement_id: null,
        start_date: '2026-04-10',
        end_date: '2026-04-10',
        start_time: '08:00',
        end_time: '16:00',
        pattern: 'daily',
        notes: '',
      })
    ).toThrow('Site, at least one guard, start date, and end date are required.');
  });
});
