import type { NextApiRequest, NextApiResponse } from "next";
import { runQuery } from "../../lib/snowflake";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await runQuery("SELECT CURRENT_TIMESTAMP;");
    res.status(200).json(rows);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
}
