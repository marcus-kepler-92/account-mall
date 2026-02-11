import { prisma } from "./lib/prisma";

async function main() {
    try {
        console.log("Testing Prisma connection...");
        const users = await prisma.user.findMany();
        console.log("Successfully fetched users:", users.length);
        const firstUser = await prisma.user.findFirst();
        console.log("First user:", firstUser);
    } catch (e) {
        console.error("Prisma Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
