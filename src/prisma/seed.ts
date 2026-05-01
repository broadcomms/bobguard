import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcrypt';

/**
 * Prisma Seed Script
 * 
 * Generates synthetic test data using Faker:
 * - 1 demo user (demo@bobguard.test)
 * - 5 patients with synthetic PHI
 * - 3 encounters per patient
 * 
 * ❌ DELIBERATE VIOLATIONS:
 * - PHI stored unencrypted (§164.312(a)(2)(iv))
 * - No audit logging (§164.312(b))
 */

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear existing data
  console.log('🗑️  Clearing existing data...');
  await prisma.encounter.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.user.deleteMany();

  // Create demo user
  console.log('👤 Creating demo user...');
  const demoPassword = 'Demo123!'; // Plain text for documentation
  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@bobguard.test',
      password: hashedPassword,
    },
  });
  
  console.log(`   ✓ Demo user created: ${demoUser.email}`);
  console.log(`   ℹ️  Password: ${demoPassword}`);

  // Create 5 patients with synthetic PHI
  console.log('🏥 Creating 5 patients with synthetic PHI...');
  const patients = [];
  
  for (let i = 0; i < 5; i++) {
    const patient = await prisma.patient.create({
      data: {
        name: faker.person.fullName(),
        dob: faker.date.birthdate({ min: 1940, max: 2010, mode: 'year' })
          .toISOString()
          .split('T')[0],
        mrn: `MRN-${faker.string.alphanumeric(8).toUpperCase()}`,
        ssn: faker.string.numeric(9), // ❌ VIOLATION: Stored as plain text
      },
    });
    
    patients.push(patient);
    console.log(`   ✓ Patient ${i + 1}: ${patient.name} (MRN: ${patient.mrn})`);
  }

  // Create 3 encounters per patient
  console.log('📋 Creating 3 encounters per patient...');
  let encounterCount = 0;
  
  for (const patient of patients) {
    for (let i = 0; i < 3; i++) {
      const providerId = `PROV-${faker.string.alphanumeric(6).toUpperCase()}`;
      const encounterTypes = [
        'Annual physical examination',
        'Follow-up visit for chronic condition management',
        'Acute care visit for respiratory symptoms',
        'Preventive care and health screening',
        'Consultation for medication review',
      ];
      
      const notes = `${faker.helpers.arrayElement(encounterTypes)}. ${faker.lorem.sentences(2)}`;
      
      await prisma.encounter.create({
        data: {
          patientId: patient.id,
          providerId,
          notes,
        },
      });
      
      encounterCount++;
    }
  }
  
  console.log(`   ✓ Created ${encounterCount} encounters`);

  // Summary
  console.log('\n✅ Seed completed successfully!');
  console.log('\n📊 Summary:');
  console.log(`   - Users: 1 (demo@bobguard.test)`);
  console.log(`   - Patients: ${patients.length}`);
  console.log(`   - Encounters: ${encounterCount}`);
  console.log('\n⚠️  HIPAA Violations Present:');
  console.log('   - PHI stored unencrypted (dob, mrn, ssn)');
  console.log('   - No audit trail for data creation');
  console.log('\n🔐 Demo Credentials:');
  console.log(`   Email: demo@bobguard.test`);
  console.log(`   Password: ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Made with Bob