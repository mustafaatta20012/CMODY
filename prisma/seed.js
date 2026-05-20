// prisma/seed.js
// Run: node prisma/seed.js  OR  npm run db:seed

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

// ── helpers ──────────────────────────────────────────────
function slug(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── products (same 12 from main.js, now in DB) ───────────
const PRODUCTS = [
  {
    name: "Premium Arabica Beans",
    price: 16.99,
    category: "coffee",
    badge: "BESTSELLER",
    stock: 150,
    isFeatured: true,
    description:
      "100% Arabica beans from the finest Colombian highlands. Rich, smooth flavor with notes of chocolate and caramel.",
    images: [
      "/uploads/spinning_coffee_cup.png",
      "/uploads/luxury_coffee_bags.png",
    ],
    ratingAvg: 5.0,
    reviewCount: 128,
  },
  {
    name: "Cold Brew Coffee",
    price: 4.99,
    category: "coffee",
    badge: null,
    stock: 80,
    isFeatured: true,
    description:
      "Smooth cold brew concentrate, steeped for 18 hours for the perfect bold flavor.",
    images: ["/uploads/iced_black_coffee.png"],
    ratingAvg: 4.9,
    reviewCount: 89,
  },
  {
    name: "Brass Coffee Pot",
    price: 49.99,
    category: "brass",
    badge: "NEW",
    stock: 40,
    isFeatured: true,
    description:
      "Handcrafted traditional brass coffee pot with intricate engravings. A timeless piece for your kitchen.",
    images: [
      "/uploads/arabic_coffee_pot.png",
      "/uploads/silver_traditional_pot.png",
    ],
    ratingAvg: 4.0,
    reviewCount: 64,
  },
  {
    name: "Cappuccino To-Go",
    price: 3.99,
    category: "drinks",
    badge: null,
    stock: 200,
    isFeatured: true,
    description:
      "Creamy Italian-style cappuccino, made fresh and ready to take anywhere you go.",
    images: ["/uploads/latte_art_cup.png"],
    ratingAvg: 5.0,
    reviewCount: 95,
  },
  {
    name: "Brass Decorative Bowl",
    price: 29.99,
    category: "brass",
    badge: null,
    stock: 30,
    isFeatured: false,
    description:
      "Elegant decorative brass bowl, perfect as a centerpiece or for holding small items.",
    images: ["/uploads/traditional_brass_bowl.png"],
    ratingAvg: 4.0,
    reviewCount: 43,
  },
  {
    name: "Mango Smoothie",
    price: 5.49,
    category: "drinks",
    badge: "HOT",
    stock: 120,
    isFeatured: true,
    description:
      "Fresh mango blended with yogurt and a hint of honey. Tropical and refreshing.",
    images: ["/uploads/iced_orange_juice.png"],
    ratingAvg: 5.0,
    reviewCount: 77,
  },
  {
    name: "Ethiopian Yirgacheffe",
    price: 18.99,
    category: "coffee",
    badge: "PREMIUM",
    stock: 60,
    isFeatured: true,
    description:
      "Single-origin Ethiopian beans with floral, fruity notes. Light roast, complex and bright.",
    images: [
      "/uploads/luxury_coffee_bags.png",
      "/uploads/luxury_coffee_bag2.png",
    ],
    ratingAvg: 5.0,
    reviewCount: 112,
  },
  {
    name: "Cold Brew Starter Set",
    price: 34.99,
    category: "coffee",
    badge: null,
    stock: 45,
    isFeatured: false,
    description:
      "Everything you need to make perfect cold brew at home. Includes jar, filter, and guide.",
    images: ["/uploads/coffee_preparation.png"],
    ratingAvg: 4.0,
    reviewCount: 58,
  },
  {
    name: "Mango Lassi",
    price: 4.49,
    category: "drinks",
    badge: null,
    stock: 90,
    isFeatured: false,
    description:
      "Classic Indian-style mango lassi with fresh mango, yogurt, and a pinch of cardamom.",
    images: ["/uploads/pink_drink.png"],
    ratingAvg: 4.0,
    reviewCount: 34,
  },
  {
    name: "Copper Coffee Mug",
    price: 22.99,
    category: "brass",
    badge: null,
    stock: 55,
    isFeatured: true,
    description:
      "Pure copper mug that keeps your coffee hot longer. Naturally antimicrobial and beautiful.",
    images: [
      "/uploads/golden_coffee_cup.png",
      "/uploads/arabic_coffee_pot.png",
    ],
    ratingAvg: 5.0,
    reviewCount: 87,
  },
  {
    name: "Tropical Smoothie",
    price: 5.99,
    category: "drinks",
    badge: "NEW",
    stock: 100,
    isFeatured: false,
    description:
      "A blend of pineapple, coconut, and mango — a tropical vacation in every sip.",
    images: ["/uploads/red_cold_drink.png"],
    ratingAvg: 4.0,
    reviewCount: 45,
  },
  {
    name: "Brass Incense Holder",
    price: 19.99,
    category: "brass",
    badge: null,
    stock: 35,
    isFeatured: false,
    description:
      "Beautifully crafted brass incense holder with geometric patterns. Adds elegance to any room.",
    images: ["/uploads/silver_traditional_pot.png"],
    ratingAvg: 4.0,
    reviewCount: 29,
  },
];

const COUPONS = [
  {
    code: "GODMODE10",
    discountPercent: 10,
    maxUses: 1000,
    isActive: true,
  },
  {
    code: "SAVE20",
    discountPercent: 20,
    maxUses: 500,
    isActive: true,
  },
  {
    code: "WELCOME5",
    discountPercent: 5,
    maxUses: null,
    isActive: true,
  },
];

// ── main seed function ────────────────────────────────────
async function main() {
  console.log("🌱 Seeding database...\n");

  // 1. Clear existing data (order matters for FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.review.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.product.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();
  console.log("🗑  Cleared existing data");

  // 2. Create admin user
  const adminHash = await bcrypt.hash("Admin@godmode2026", 12);
  const admin = await prisma.user.create({
    data: {
      email: "admin@godmode.com",
      passwordHash: adminHash,
      firstName: "GODMODE",
      lastName: "Admin",
      role: "ADMIN",
      isVerified: true,
    },
  });
  console.log(`👤 Admin created: ${admin.email}`);

  // 3. Create demo customer
  const demoHash = await bcrypt.hash("Demo1234!", 12);
  const demo = await prisma.user.create({
    data: {
      email: "demo@godmode.com",
      passwordHash: demoHash,
      firstName: "Demo",
      lastName: "User",
      role: "CUSTOMER",
      isVerified: true,
      addresses: {
        create: {
          fullName: "Demo User",
          street: "123 Coffee Street",
          city: "New York",
          state: "NY",
          zip: "10001",
          country: "US",
          isDefault: true,
        },
      },
    },
  });
  console.log(`👤 Demo customer created: ${demo.email}`);

  // 4. Seed products
  const createdProducts = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: slug(p.name),
        description: p.description,
        price: p.price,
        stock: p.stock,
        category: p.category,
        badge: p.badge,
        isFeatured: p.isFeatured,
        isActive: true,
        images: p.images,
        ratingAvg: p.ratingAvg,
        reviewCount: p.reviewCount,
      },
    });
    createdProducts.push(product);
  }
  console.log(`📦 ${createdProducts.length} products seeded`);

  // 5. Seed coupons
  for (const c of COUPONS) {
    await prisma.coupon.create({ data: c });
  }
  console.log(`🎟  ${COUPONS.length} coupons seeded`);

  // 6. Seed sample order for demo user
  const sampleItems = createdProducts.slice(0, 2);
  const subtotal = sampleItems.reduce((s, p) => s + Number(p.price), 0);

  await prisma.order.create({
    data: {
      orderNumber: "GM-2026-0001",
      userId: demo.id,
      status: "DELIVERED",
      paymentMethod: "CARD",
      subtotal,
      shippingCost: 0,
      discountAmount: 0,
      total: subtotal,
      shippingName: "Demo User",
      shippingStreet: "123 Coffee Street",
      shippingCity: "New York",
      shippingZip: "10001",
      shippingCountry: "US",
      paidAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      items: {
        create: sampleItems.map((p) => ({
          productId: p.id,
          productName: p.name,
          qty: 1,
          unitPrice: p.price,
          totalPrice: p.price,
        })),
      },
    },
  });
  console.log("🛒 Sample order created for demo user");

  // 7. Seed sample reviews
  await prisma.review.createMany({
    data: [
      {
        productId: createdProducts[0].id,
        userId: demo.id,
        rating: 5,
        comment: "Best coffee I've ever had! Smooth and rich.",
        isVerified: true,
      },
    ],
  });
  console.log("⭐ Sample review created");

  console.log("\n✅ Seeding complete!\n");
  console.log("─────────────────────────────");
  console.log("🔑 Admin:  admin@godmode.com  /  Admin@godmode2026");
  console.log("🔑 Demo:   demo@godmode.com   /  Demo1234!");
  console.log("🎟  Coupons: GODMODE10  |  SAVE20  |  WELCOME5");
  console.log("─────────────────────────────\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
