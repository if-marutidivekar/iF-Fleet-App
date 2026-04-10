/**
 * iF Fleet — Staging Seed Script
 * Run: pnpm --filter @if-fleet/api db:seed
 *
 * Creates demo accounts for QA/UAT:
 *   Admin:    admin@ideaforgetech.com    / EMP-ADMIN-001
 *   Employee: employee@ideaforgetech.com / EMP-001
 *   Driver:   driver@ideaforgetech.com   / EMP-DRV-001
 *
 * Also seeds: vehicles, driver profile, preset locations, app config.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding iF Fleet staging database…');

  // ── Migrate legacy @company.com emails if present ──────────────────────────
  await prisma.user.updateMany({
    where: { email: 'admin@company.com' },
    data: { email: 'admin@ideaforgetech.com' },
  });
  await prisma.user.updateMany({
    where: { email: 'employee@company.com' },
    data: { email: 'employee@ideaforgetech.com' },
  });
  await prisma.user.updateMany({
    where: { email: 'driver@company.com' },
    data: { email: 'driver@ideaforgetech.com' },
  });

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.upsert({
    where: { email: 'admin@ideaforgetech.com' },
    update: {},
    create: {
      employeeId: 'EMP-ADMIN-001',
      name: 'Fleet Administrator',
      email: 'admin@ideaforgetech.com',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@ideaforgetech.com' },
    update: {},
    create: {
      employeeId: 'EMP-001',
      name: 'Jane Employee',
      email: 'employee@ideaforgetech.com',
      role: 'EMPLOYEE',
      status: 'ACTIVE',
    },
  });

  const driverUser = await prisma.user.upsert({
    where: { email: 'driver@ideaforgetech.com' },
    update: {},
    create: {
      employeeId: 'EMP-DRV-001',
      name: 'John Driver',
      email: 'driver@ideaforgetech.com',
      role: 'DRIVER',
      status: 'ACTIVE',
    },
  });

  // ── Driver Profile ─────────────────────────────────────────────────────────
  const driverProfile = await prisma.driverProfile.upsert({
    where: { userId: driverUser.id },
    update: {},
    create: {
      userId: driverUser.id,
      licenseNumber: 'DL-MH-0012345',
      licenseExpiry: new Date('2027-12-31'),
      shiftReady: true,
    },
  });

  // ── Vehicles ───────────────────────────────────────────────────────────────
  const vehicles = await Promise.all([
    prisma.vehicle.upsert({
      where: { vehicleNo: 'MH-01-AA-1234' },
      update: {},
      create: {
        vehicleNo: 'MH-01-AA-1234',
        type: 'SEDAN',
        make: 'Toyota',
        model: 'Etios',
        year: 2022,
        capacity: 4,
        ownership: 'OWNED',
        status: 'AVAILABLE',
      },
    }),
    prisma.vehicle.upsert({
      where: { vehicleNo: 'MH-01-BB-5678' },
      update: {},
      create: {
        vehicleNo: 'MH-01-BB-5678',
        type: 'SUV',
        make: 'Mahindra',
        model: 'XUV500',
        year: 2021,
        capacity: 6,
        ownership: 'OWNED',
        status: 'AVAILABLE',
      },
    }),
    prisma.vehicle.upsert({
      where: { vehicleNo: 'MH-01-CC-9012' },
      update: {},
      create: {
        vehicleNo: 'MH-01-CC-9012',
        type: 'VAN',
        make: 'Tata',
        model: 'Winger',
        year: 2020,
        capacity: 12,
        ownership: 'LEASED',
        status: 'AVAILABLE',
      },
    }),
  ]);

  // ── Preset Locations ───────────────────────────────────────────────────────
  const presets = await Promise.all([
    prisma.presetLocation.upsert({
      where: { id: 'preset-hq' },
      update: {},
      create: {
        id: 'preset-hq',
        name: 'Head Office',
        address: '100 Corporate Park, Andheri East, Mumbai 400069',
        latitude: 19.1136,
        longitude: 72.8697,
        isActive: true,
      },
    }),
    prisma.presetLocation.upsert({
      where: { id: 'preset-warehouse' },
      update: {},
      create: {
        id: 'preset-warehouse',
        name: 'Warehouse B',
        address: 'Plot 22, Industrial Estate, Bhiwandi 421302',
        latitude: 19.2952,
        longitude: 73.0558,
        isActive: true,
      },
    }),
    prisma.presetLocation.upsert({
      where: { id: 'preset-site-alpha' },
      update: {},
      create: {
        id: 'preset-site-alpha',
        name: 'Site Alpha',
        address: 'NH-48, Pune 411057',
        latitude: 18.5204,
        longitude: 73.8567,
        isActive: true,
      },
    }),
    prisma.presetLocation.upsert({
      where: { id: 'preset-airport' },
      update: {},
      create: {
        id: 'preset-airport',
        name: 'Airport Terminal 2',
        address: 'CSIA, Santacruz East, Mumbai 400099',
        latitude: 19.0896,
        longitude: 72.8656,
        isActive: true,
      },
    }),
  ]);

  // ── App Config (bootstrap defaults) ────────────────────────────────────────
  await prisma.appConfig.upsert({
    where: { key: 'auth.companyDomain' },
    update: {},
    create: { key: 'auth.companyDomain', value: 'ideaforgetech.com' },
  });
  console.log('✓ AppConfig: auth.companyDomain = ideaforgetech.com');

  console.log(`✓ Users: admin(${admin.id}), employee(${employee.id}), driver(${driverUser.id})`);
  console.log(`✓ Driver profile: ${driverProfile.id}`);
  console.log(`✓ Vehicles: ${vehicles.map((v) => v.vehicleNo).join(', ')}`);
  console.log(`✓ Preset locations: ${presets.map((p) => p.name).join(', ')}`);
  console.log('\nSeed complete.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
