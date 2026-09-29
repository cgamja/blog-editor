// Supabase Edge Function 입구(Deno) — 앱은 번들(app.js, ADR-046)에 있고 여기는 env를 넘겨 띄우기만 한다.
// 요청마다 앱을 새로 만들지 않도록 핸들러는 인스턴스가 켜질 때 한 번 만든다.
import { createEdgeHandler } from "./app.js";

Deno.serve(createEdgeHandler(Deno.env.toObject()));
