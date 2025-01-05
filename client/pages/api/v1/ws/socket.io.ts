import type { NextApiRequest, NextApiResponse } from "next";
import { createProxyMiddleware } from "http-proxy-middleware";

const proxyTarget = process.env.SERVER_URL ?? "http://localhost:3000";

const proxy = createProxyMiddleware({
  target: proxyTarget,
  ws: true,
  pathRewrite: { "^/api/v1/ws/socket.io": "/v1/ws/socket.io/" },
  changeOrigin: true,
  // logger: console,
});

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  proxy(req, res, (err) => {
    if (err) {
      console.error(err);
      throw err;
    }

    throw new Error("Bad request");
  });
}
