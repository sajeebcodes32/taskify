import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence the "workspace root" warning on machines with
  // multiple package-lock.json files in parent directories
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
