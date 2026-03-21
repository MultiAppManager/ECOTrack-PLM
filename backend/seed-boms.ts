/**
 * One-shot BOM seeder — run with:
 *   npx ts-node --esm seed-boms.ts
 */
import { randomUUID } from 'crypto';
import prisma from './lib/prisma.js';

const BOMS = [
  {
    pc: 'PROD-001', name: 'Pump Housing Kit',
    components: [
      { name: 'Steel Ring',       qty: 6,  unit: 'pcs', notes: 'Grade A stainless' },
      { name: 'O-Ring Seal',      qty: 12, unit: 'pcs', notes: 'NBR 70 shore' },
      { name: 'Pump Shaft',       qty: 1,  unit: 'pcs', notes: 'Surface hardened' },
      { name: 'Impeller Blade',   qty: 4,  unit: 'pcs', notes: null },
    ],
  },
  {
    pc: 'PROD-002', name: 'Motor Rotor-Stator Set',
    components: [
      { name: 'Copper Wind Wire', qty: 2.5, unit: 'm',   notes: '0.8mm diameter' },
      { name: 'Rotor Core',       qty: 1,   unit: 'pcs', notes: 'Laminated silicon steel' },
      { name: 'Insulation Film',  qty: 0.5, unit: 'm²',  notes: 'Nomex 410' },
      { name: 'Bearing 6204',     qty: 2,   unit: 'pcs', notes: null },
    ],
  },
  {
    pc: 'PROD-003', name: 'Gear Train Assembly',
    components: [
      { name: 'Helical Gear 48T', qty: 2,  unit: 'pcs', notes: 'Module 2, 20° pressure angle' },
      { name: 'Pinion Gear 16T',  qty: 2,  unit: 'pcs', notes: 'Hardened alloy steel' },
      { name: 'Grease EP2',       qty: 75, unit: 'ml',  notes: 'NLGI Grade 2' },
      { name: 'Gear Housing',     qty: 1,  unit: 'pcs', notes: 'Die-cast aluminium' },
    ],
  },
  {
    pc: 'PROD-004', name: 'Servo PCB Assembly',
    components: [
      { name: 'Capacitor 100µF',  qty: 14, unit: 'pcs', notes: 'Electrolytic, 50V' },
      { name: 'DSP Chip TMS320',  qty: 1,  unit: 'pcs', notes: 'Texas Instruments' },
      { name: 'MOSFET IRF540N',   qty: 4,  unit: 'pcs', notes: 'N-Channel 100V' },
      { name: 'PCB FR4 2-Layer',  qty: 1,  unit: 'pcs', notes: '1.6mm thickness' },
    ],
  },
  {
    pc: 'PROD-005', name: 'Actuator Linkage Set',
    components: [
      { name: 'Pneumatic Cylinder', qty: 2, unit: 'pcs', notes: 'Bore 63mm, Stroke 150mm' },
      { name: 'Seal Kit',           qty: 1, unit: 'set', notes: 'Polyurethane seals' },
      { name: 'Mounting Bracket',   qty: 2, unit: 'pcs', notes: 'Laser-cut steel' },
      { name: 'Clevis Pin M10',     qty: 4, unit: 'pcs', notes: null },
    ],
  },
  {
    pc: 'PROD-006', name: 'Conveyor Roller Kit',
    components: [
      { name: 'Drive Roller Ø80',   qty: 4,  unit: 'pcs', notes: 'Galvanised steel' },
      { name: 'PVC Belt 400mm',     qty: 2,  unit: 'm',   notes: '3-ply construction' },
      { name: 'Bearing Block UCP',  qty: 8,  unit: 'pcs', notes: null },
      { name: 'Drive Chain 08B',    qty: 0.5,unit: 'm',   notes: null },
    ],
  },
  {
    pc: 'PROD-007', name: 'Linear Ball Screw Kit',
    components: [
      { name: 'Ball Screw SFU1610', qty: 1, unit: 'pcs', notes: 'Lead 10mm, length 500mm' },
      { name: 'Ball Nut Flange',    qty: 1, unit: 'pcs', notes: 'Double nut type' },
      { name: 'End Support BK12',   qty: 1, unit: 'pcs', notes: 'Fixed end' },
      { name: 'End Support BF12',   qty: 1, unit: 'pcs', notes: 'Floating end' },
    ],
  },
  {
    pc: 'PROD-008', name: 'Encoder Mounting Pack',
    components: [
      { name: 'Encoder Disc 1000ppr', qty: 1, unit: 'pcs', notes: '100mm diameter' },
      { name: 'Flexible Coupling',    qty: 1, unit: 'pcs', notes: 'Jaw type, 10-14mm' },
      { name: 'Mounting Bracket SS',  qty: 1, unit: 'pcs', notes: 'Stainless steel' },
    ],
  },
  {
    pc: 'PROD-009', name: 'Pressure Valve Assembly Kit',
    components: [
      { name: 'Valve Body Brass',   qty: 1, unit: 'pcs', notes: 'DZR brass, 1/2" BSP' },
      { name: 'Compression Spring', qty: 3, unit: 'pcs', notes: 'Stainless steel k=4.5N/mm' },
      { name: 'Seal Washer PTFE',   qty: 4, unit: 'pcs', notes: '15mm OD' },
      { name: 'Lock Nut M18',       qty: 2, unit: 'pcs', notes: null },
    ],
  },
  {
    pc: 'PROD-010', name: 'Conveyor Belt Legacy Kit',
    components: [
      { name: 'Rubber Belt 300mm', qty: 3,  unit: 'm',   notes: 'Legacy spec' },
      { name: 'Lace Clip',         qty: 20, unit: 'pcs', notes: 'Stainless clip-type' },
    ],
  },
];

async function main() {
  // Check how many BOMs already exist
  const existing = await prisma.$queryRawUnsafe<{ count: number }[]>(
    `SELECT COUNT(*)::int AS count FROM bill_of_materials`
  );
  if ((existing?.[0]?.count || 0) > 0) {
    console.log(`⚠️  ${existing[0].count} BOMs already exist — clearing and re-seeding…`);
    await prisma.$executeRawUnsafe(`DELETE FROM bill_of_materials`);
  }

  let i = 1;
  for (const b of BOMS) {
    const bomCode = `BOM-${String(i).padStart(3, '0')}`;
    await prisma.$executeRawUnsafe(
      `INSERT INTO bill_of_materials (id,"bomCode",name,"productCode",version,components,notes,status,"isLatest","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,1,$5::json,null,'Active',true,NOW(),NOW())`,
      randomUUID(), bomCode, b.name, b.pc, JSON.stringify(b.components)
    );
    console.log(`✅  ${bomCode} · ${b.name}  →  ${b.pc}`);
    i++;
  }

  console.log('\n🎉 Seeded 10 BOMs successfully!');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
