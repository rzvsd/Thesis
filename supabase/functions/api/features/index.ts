// Feature registry. Owner: M0, frozen (docs/rebuild/OWNERSHIP.md).
// Every planned feature is listed here already, so milestones only edit their own feature folders.
// The Router throws at start-up if two features register the same method and path.
import type { FeatureModule } from "../router.ts";
import { feature as health } from "./health/index.ts";
import { feature as auth } from "./auth/index.ts";
import { feature as user } from "./user/index.ts";
import { feature as account } from "./account/index.ts";
import { feature as watchlist } from "./watchlist/index.ts";
import { feature as holdings } from "./holdings/index.ts";
import { feature as devices } from "./devices/index.ts";
import { feature as tickers } from "./tickers/index.ts";
import { feature as pulse } from "./pulse/index.ts";
import { feature as reports } from "./reports/index.ts";
import { feature as web } from "./web/index.ts";
import { feature as jobs } from "./jobs/index.ts";
import { feature as internalJobs } from "./internal-jobs/index.ts";
import { feature as historical } from "./historical/index.ts";
import { feature as research } from "./research/index.ts";
import { feature as alerts } from "./alerts/index.ts";
import { feature as internalData } from "./internal-data/index.ts";
import { feature as exports } from "./exports/index.ts";
import { feature as billing } from "./billing/index.ts";
import { feature as internalPush } from "./internal-push/index.ts";

export const features: FeatureModule[] = [
  health,
  auth,
  user,
  account,
  watchlist,
  holdings,
  devices,
  tickers,
  pulse,
  reports,
  web,
  jobs,
  internalJobs,
  historical,
  research,
  alerts,
  internalData,
  exports,
  billing,
  internalPush,
];
