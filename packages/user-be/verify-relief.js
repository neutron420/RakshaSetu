
const path = require("path");
const { PrismaClient } = require(path.resolve(__dirname, "../../prisma/generated/prisma"));
const prisma = new PrismaClient();

async function runVerification() {
    console.log("--- Relief Center Verification & Seeding ---");

    try {
        // 1. Seed some realistic data in New Delhi
        console.log("Seeding test centers in New Delhi...");

        const centers = [
            {
                name: "AIIMS Hospital",
                type: "HOSPITAL",
                status: "OPEN",
                description: "Main emergency wing",
                address: "Ansari Nagar, New Delhi",
                maxCapacity: 500,
                latitude: 28.5672,
                longitude: 77.2100,
                contactPhone: "011-26588500"
            },
            {
                name: "Siri Fort Shelter Home",
                type: "SHELTER",
                status: "OPEN",
                description: "Community shelter for disaster relief",
                address: "Siri Fort Road, New Delhi",
                maxCapacity: 200,
                latitude: 28.5529,
                longitude: 77.2215,
                contactPhone: "011-12345678"
            }
        ];

        for (const data of centers) {
            await prisma.$executeRaw`
        INSERT INTO "ReliefCenter" (
          "id", "name", "type", "status", "description", "address", 
          "maxCapacity", "currentCount", "latitude", "longitude", "locationGeo", 
          "contactPhone", "updatedAt"
        ) VALUES (
          gen_random_uuid(), ${data.name}, ${data.type}::"ReliefCenterType", 
          ${data.status}::"ReliefCenterStatus", ${data.description}, 
          ${data.address}, ${data.maxCapacity}, 0,
          ${data.latitude}, ${data.longitude}, 
          ST_SetSRID(ST_MakePoint(${data.longitude}, ${data.latitude}), 4326)::geography,
          ${data.contactPhone}, NOW()
        ) ON CONFLICT DO NOTHING
      `;
        }

        // 2. Test Spatial Query (as a user in New Delhi)
        console.log("\nTesting spatial query (Searching near New Delhi @ 28.56, 77.21)...");
        const userLat = 28.5600;
        const userLng = 77.2100;
        const radius = 10000; // 10km

        const nearby = await prisma.$queryRaw`
      SELECT 
        name, type, status, 
        ST_Distance(
          "locationGeo", 
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography
        ) as distance
      FROM "ReliefCenter"
      WHERE ST_DWithin(
        "locationGeo", 
        ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
        ${radius}
      )
      ORDER BY distance ASC
    `;

        console.log(`Found ${nearby.length} centers within 10km.`);
        nearby.forEach(c => {
            console.log(`- ${c.name} (${c.type}): ${Math.round(c.distance)} meters away`);
        });

        if (nearby.length > 0) {
            console.log("\n✅ SUCCESS: Proximity query works perfectly.");
        } else {
            console.error("\n❌ FAILURE: No centers found.");
        }

    } catch (err) {
        console.error("Verification Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

runVerification();
