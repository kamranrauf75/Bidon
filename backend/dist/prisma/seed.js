"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = Array.from({ length: 100 }, (_, index) => {
        const id = index + 1;
        return {
            id,
            name: `User ${id}`,
            email: `user${id}@paynest.local`,
        };
    });
    await prisma.user.createMany({
        data: users,
        skipDuplicates: true,
    });
}
main()
    .catch((error) => {
    console.error(error);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed.js.map