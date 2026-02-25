import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import getDb from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, topic, shop } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const current = payload.current as string[];
  if (session) {
    const db = getDb();
    await db
      .prepare(`UPDATE sessions SET scope = ? WHERE id = ?`)
      .bind(current.toString(), session.id)
      .run();
  }

  return new Response();
};
