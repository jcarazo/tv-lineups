import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { checkLogoUrl } from "@/lib/logo/check";

const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
let server: http.Server;
let base: string;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    switch (req.url) {
      case "/ok.svg":
        res.writeHead(200, { "content-type": "image/svg+xml" }).end('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
        break;
      case "/ok.png":
        res.writeHead(200, { "content-type": "image/png" }).end(PNG);
        break;
      case "/redirect":
        res.writeHead(302, { location: "/ok.svg" }).end();
        break;
      case "/page":
        res.writeHead(200, { "content-type": "text/html" }).end("<html></html>");
        break;
      case "/fake.svg":
        res.writeHead(200, { "content-type": "image/svg+xml" }).end("<html>oops</html>");
        break;
      case "/slow":
        setTimeout(() => res.writeHead(200, { "content-type": "image/png" }).end(PNG), 2000);
        break;
      default:
        res.writeHead(404, { "content-type": "text/html" }).end("not found");
    }
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.closeAllConnections();
  server.close();
});

describe("checkLogoUrl", () => {
  it("accepts real images, following redirects", async () => {
    expect((await checkLogoUrl(`${base}/ok.svg`)).ok).toBe(true);
    expect((await checkLogoUrl(`${base}/ok.png`)).ok).toBe(true);
    expect((await checkLogoUrl(`${base}/redirect`)).ok).toBe(true);
  });

  it("rejects 404s, html pages and fake svgs", async () => {
    expect(await checkLogoUrl(`${base}/missing.svg`)).toMatchObject({ ok: false, httpStatus: 404, error: "HTTP 404" });
    expect((await checkLogoUrl(`${base}/page`)).error).toMatch(/Not an image/);
    expect((await checkLogoUrl(`${base}/fake.svg`)).error).toMatch(/not a valid SVG/);
  });

  it("times out", async () => {
    expect((await checkLogoUrl(`${base}/slow`, 200)).error).toMatch(/Timed out/);
  });

  it("reports connection errors", async () => {
    const r = await checkLogoUrl("http://127.0.0.1:1/x.svg");
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });
});
