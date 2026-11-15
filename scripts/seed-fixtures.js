export const SEED_SOURCE = 'calle-live-demo-fixture';

const TENANT_A = { tenantId: 'tenant-a', userId: 'user-a' };
const TENANT_B = { tenantId: 'tenant-b', userId: 'user-b' };
const FUTURE_EXPIRY = new Date('2026-12-31T00:00:00.000Z');

function internetTerms(monthlyPrice, promotionEndsAt = FUTURE_EXPIRY) {
  return {
    provider: 'DemoNet',
    monthlyPrice,
    currency: 'CAD',
    downloadMbps: 500,
    uploadMbps: 100,
    dataCap: 'unlimited',
    contractMonths: 12,
    modemMonthlyFee: 10,
    promotionEndsAt,
    commitment: {
      type: 'fixed_term',
      endsAt: new Date('2027-05-31T00:00:00.000Z'),
      terminationFee: { status: 'known', amount: 150, currency: 'CAD' },
    },
  };
}

export async function seedFixtures({ db, memoryService }) {
  await db.collection('memories').deleteMany({
    tenantId: { $in: [TENANT_A.tenantId, TENANT_B.tenantId] },
    source: SEED_SOURCE,
  });

  await memoryService.saveMemory(db, TENANT_A, {
    content: 'DemoNet offered Tenant A $75 per month for 12 months.',
    source: SEED_SOURCE,
    expiresAt: FUTURE_EXPIRY,
    terms: internetTerms(75),
  });
  await memoryService.saveMemory(db, TENANT_B, {
    content: 'DemoNet offered Tenant B $70 per month for 12 months.',
    source: SEED_SOURCE,
    expiresAt: FUTURE_EXPIRY,
    terms: internetTerms(70),
  });
  await memoryService.saveMemory(db, TENANT_A, {
    content: 'Tenant A expired offer was $65 per month.',
    source: SEED_SOURCE,
    expiresAt: new Date('2026-01-01T00:00:00.000Z'),
    terms: internetTerms(65, new Date('2026-01-01T00:00:00.000Z')),
  });

  const original = await memoryService.saveMemory(db, TENANT_A, {
    content: 'Tenant A original offer was $90 per month.',
    source: SEED_SOURCE,
    expiresAt: FUTURE_EXPIRY,
    terms: internetTerms(90),
  });
  await memoryService.correctMemory(db, TENANT_A, original._id, {
    content: 'Tenant A corrected offer was $80 per month.',
    source: SEED_SOURCE,
    expiresAt: FUTURE_EXPIRY,
    terms: internetTerms(80),
  });
}
