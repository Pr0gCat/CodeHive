import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up tech stack tables...');
  
  try {
    // Try to create default global settings
    await prisma.globalSettings.upsert({
      where: { id: 'global' },
      update: {},
      create: {
        id: 'global',
        preferredFramework: '',
        preferredLanguage: '',
        preferredPackageManager: '',
        preferredTestFramework: '',
        preferredLintTool: '',
        preferredBuildTool: '',
      },
    });
    
    console.log('✅ Tech stack setup complete!');
  } catch (error) {
    console.error('❌ Error setting up tech stack:', error);
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });