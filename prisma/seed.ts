/**
 * Seeds the registry tables (tools, policies), a demo user and default settings.
 * All business data (sales, customers, emails) is FAKE / DEMONSTRATION DATA
 * and lives in lib/data/fake-data.ts.
 */
import { PrismaClient } from "@prisma/client";
import { TOOL_METADATA } from "../lib/tools/registry";
import { POLICY_DEFINITIONS } from "../lib/firewall/policy-engine";
import { CUSTOMER_RECORDS, EMAIL_RECORDS, SALES_RECORDS, DATA_NOTICE } from "../lib/data/fake-data";

const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({
    where: { email: "demo.user@example.com" },
    create: { name: "Demo User", email: "demo.user@example.com" },
    update: {},
  });

  for (const t of TOOL_METADATA) {
    const data = {
      description: t.description,
      dataClassification: t.dataClassification,
      externalImpact: t.externalImpact,
      requiresExplicitAuthorization: t.requiresExplicitAuthorization,
      riskWeight: t.riskWeight,
    };
    await prisma.tool.upsert({ where: { name: t.name }, create: { name: t.name, ...data }, update: data });
  }

  for (const p of POLICY_DEFINITIONS) {
    const data = { name: p.name, description: p.description, severity: p.severity, order: p.order, enabled: true };
    await prisma.policy.upsert({ where: { code: p.code }, create: { code: p.code, ...data }, update: data });
  }

  console.log(`Seeded ${TOOL_METADATA.length} tools, ${POLICY_DEFINITIONS.length} policies and the demo user.`);
  console.log(`${DATA_NOTICE}: ${SALES_RECORDS.length} sales records, ${CUSTOMER_RECORDS.length} customers, ${EMAIL_RECORDS.length} emails (1 prompt-injection email).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
