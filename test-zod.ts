import { z } from "zod";
try {
  z.string().uuid().parse("00000000-0000-0000-0000-000000000001");
  console.log("Valid!");
} catch (e) {
  console.error("Invalid:", e);
}
