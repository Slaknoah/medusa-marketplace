import cors from "cors";
import { Router } from "express";
import * as bodyParser from "body-parser";
import helloRouteHandler from "./hello";
import {
  wrapHandler,
} from "@medusajs/medusa";

import customRouteHandler from "./custom-route-handler";

const storeRouter = Router();
export function getStoreRouter(storeCorsOptions): Router {
  storeRouter.use(cors(storeCorsOptions), bodyParser.json());

  storeRouter.get("/store/hello", wrapHandler(helloRouteHandler));

  // Define a GET endpoint on the root route of our custom path
  storeRouter.get("/", wrapHandler(customRouteHandler));

  return storeRouter;
}

// Initialize a custom router
const router = Router();

export function attachStoreRoutes(storeRouter: Router) {
  // Attach our router to a custom path on the store router
  storeRouter.use("/custom", router);

  // Define a GET endpoint on the root route of our custom path
  router.get("/", wrapHandler(customRouteHandler));
}
