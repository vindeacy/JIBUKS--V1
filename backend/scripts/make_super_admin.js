import { prisma } from '../src/lib/prisma.js';

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/make_super_admin.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const existingPermissions = user.permissions && typeof user.permissions === 'object' ? user.permissions : {};

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      role: 'ADMIN',
      tenantId: null,
      permissions: {
        ...existingPermissions,
        superAdmin: true,
        canManageTenants: true,
      },
    },
    select: { id: true, email: true, role: true, tenantId: true, permissions: true },
  });

  console.log('✅ Super admin granted:', updated);
}

main()
  .catch((err) => {
    console.error('Failed to grant super admin:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
