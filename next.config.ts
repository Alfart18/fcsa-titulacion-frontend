import os from "os";
import type { NextConfig } from "next";

const lanIps = Object.values(os.networkInterfaces())
  .flat()
  .filter(
    (iface): iface is os.NetworkInterfaceInfo =>
      Boolean(iface && iface.family === "IPv4" && !iface.internal),
  )
  .map((iface) => iface.address);

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: [
    ...lanIps,
    "127.0.0.1",
    "192.168.*.*",
    "10.*.*.*",
    "172.16.*.*",
    "172.17.*.*",
    "172.18.*.*",
    "172.19.*.*",
    "172.2*.*.*",
    "172.30.*.*",
    "172.31.*.*",
    "*.local",
  ],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
