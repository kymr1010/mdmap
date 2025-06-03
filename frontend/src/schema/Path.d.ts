import { Dimmension } from "../schema/Point.js";

export interface Path {
  from: Dimmension;
  to: Dimmension;
  c: {
    from: Dimmension;
    to: Dimmension;
    points?: Array<{
      p: Dimmension;
      c: Dimmension;
    }>;
  };
}
