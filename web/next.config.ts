import type { NextConfig } from "next";
import path from "node:path";

const appRoot = path.resolve(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: appRoot,
  outputFileTracingIncludes: {
    "/api/bank-statement-imports": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/bank-statement-imports/reprocess": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
    "/api/statement-upload-finalize": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
  serverExternalPackages: ["@napi-rs/canvas", "pdf-parse"],
  turbopack: {
    root: appRoot,
  },
};

export default nextConfig;
