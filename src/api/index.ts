import cors from "cors";
import { Router } from "express";
import { getConfigFile } from "medusa-core-utils";
import { ConfigModule } from "@medusajs/medusa/dist/types/global";
import { UserRoles, authenticate, wrapHandler, registerOverriddenValidators } from "@medusajs/medusa";
import { registerLoggedInUser } from "./middlewares/logged-in-user";
import { IsEmail, IsEnum } from "class-validator";
import { attachAdminRoutes } from "./routes/admin";
import bodyParser from "body-parser";
import { attachStoreRoutes } from "./routes/store";
import {
  StoreGetProductsParams as MedusaStoreGetProductsParams,
} from "@medusajs/medusa/dist/api/routes/store/products/list-products";
import {  getStripePayments } from "../controllers/get-payments"
import hooks from "./hooks"

import { IsString, IsOptional } from "class-validator"
import { completeStripeConnect, connectStripe, refreshStripeConnect } from "../controllers/connect-stripe";

class StoreGetProductsParams extends MedusaStoreGetProductsParams {
  @IsString()
  @IsOptional()
  store_id?: string;
}

registerOverriddenValidators(StoreGetProductsParams)


export class AdminPostInvitesReq {
  @IsEmail()
  user: string;

  @IsEnum(UserRoles)
  role: UserRoles;
}

// TODO: this needs some cleanup
export default (rootDirectory) => {
  const {
    configModule: { projectConfig },
  } = getConfigFile(rootDirectory, "medusa-config") as {
    configModule: ConfigModule;
  };

  const storeCorsOptions = {
    origin: projectConfig.store_cors.split(","),
    credentials: true,
  };
  const adminCorsOptions = {
    origin: projectConfig.admin_cors.split(","),
    credentials: true,
  };

  const router = Router();

  // Register stripe hook
  hooks(router)

  // middleware for core route
  const exemptedRoutes = {
    "/admin/invites/accept": ["POST"],
    "/admin/users/password-token": ["POST"],
    "/admin/users/reset-password": ["POST"],
    "/admin/store/stripe/connect-complete": ["GET"],
    "/admin/store/stripe/connect-refresh": ["GET"],
    "/stripe/hooks": ["GET"],
  };
  const maybe = (fn) => {
    return function (req, res, next) {
      if (
        exemptedRoutes[req.baseUrl] &&
        exemptedRoutes[req.baseUrl].includes(req.method)
      ) {
        next();
      } else {
        fn(req, res, next);
      }
    };
  };

  const commonMiddleware = [
    maybe(authenticate()),
    maybe(registerLoggedInUser()),
  ];

   // Set up root routes for store and admin endpoints, with appropriate CORS settings
   router.use("/store", cors(storeCorsOptions), bodyParser.json());
   router.use("/admin", cors(adminCorsOptions), bodyParser.json());
 
  // Add authentication to all admin routes *except* auth and account invite ones
   router.use(
     /\/admin\/((?!auth)(?!invites)(?!store\/stripe\/connect-complete)(?!store\/stripe\/connect-refresh)(?!stripe\/hooks)(?!users\/reset-password)(?!users\/password-token).*)/,
     authenticate(),
     registerLoggedInUser(),
   );
  router.use("/admin/invites*", commonMiddleware);

  // Stripe payments routes
  router.use(
    `/admin/orders/stripe-payments/:order_id`,
    cors(adminCorsOptions),
    authenticate(),
    registerLoggedInUser(),
  )
  router.get(`/admin/orders/stripe-payments/:order_id`, async (req, res) => {
    const payments = await getStripePayments(req)
    res.json({ payments })
  })

  // Stripe connect routes
  router.post(
    '/admin/store/stripe/connect',
    cors(adminCorsOptions),
    authenticate(),
    registerLoggedInUser(),
    async (req, res) => {
      const data = await connectStripe(req)
      res.json({ data })
    },
  )
  router.get(
    '/admin/store/stripe/connect-complete',
    cors(adminCorsOptions),
    completeStripeConnect,
  )
  router.get(
    '/admin/store/stripe/connect-refresh',
    cors(adminCorsOptions),
    refreshStripeConnect,
  )

  router.get(
    "/hc",
    wrapHandler(async (req, res) => {
      res.sendStatus(200);
    })
  );

  // Set up routers for store and admin endpoints
  const storeRouter = Router();
  const adminRouter = Router();

  router.use("/admin", adminRouter);
  router.use("/store", storeRouter);

  attachAdminRoutes(adminRouter);
  attachStoreRoutes(storeRouter);

  return router;
};
