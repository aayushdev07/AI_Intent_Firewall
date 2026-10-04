/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prisma + the OpenAI client only ever run on the server.
  experimental: { serverComponentsExternalPackages: ["@prisma/client"] },
};
export default nextConfig;
