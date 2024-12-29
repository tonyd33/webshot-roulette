import type { NextApiRequest, NextApiResponse } from "next";
import { createProxyMiddleware } from "http-proxy-middleware";

const proxy = createProxyMiddleware({
  target: "http://localhost:3000",
  ws: true,
  pathRewrite: { "^/api/v1/socket.io": "/socket.io/" },
  followRedirects: true,
});

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  proxy(req, res, (err) => {
    if (err) {
      throw err;
    }

    throw new Error("Bad request");
  });
}

export const config = {
  api: {
    bodyParser: false,
  },
};
