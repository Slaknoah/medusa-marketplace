// import cors from "cors";
// import { Request, Response, Router } from "express";
// import * as bodyParser from "body-parser";
// import { authenticate, wrapHandler } from "@medusajs/medusa";


// const adminRouter = Router();
// export function getAdminRouter(adminCorsOptions): Router {
//   adminRouter.use(cors(adminCorsOptions), bodyParser.json());

//   adminRouter.use(
//     // /\/admin\/[^(auth)].*/,
//     "/admin/*",
//     authenticate(),
//     registerLoggedInUser()
//   );

//   return adminRouter;
// }

import { registerLoggedInUser } from "../../middlewares/logged-in-user";
import { Router } from "express";
import { authenticate, wrapHandler } from "@medusajs/medusa";
import customRouteHandler from "./custom-route-handler";
import { Request, Response } from 'express'

// Initialize a custom router
const router = Router();
export function attachAdminRoutes(adminRouter: Router) {
  // Admin logged in user router
  // adminRouter.use(
  //   // /\/admin\/[^(auth)].*/,
  //   "/admin/*",
  //   authenticate(),
  //   registerLoggedInUser()
  // );

  // Attach routes for onboarding experience, defined separately
}
