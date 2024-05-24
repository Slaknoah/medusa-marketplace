const dotenv = require("dotenv");

let ENV_FILE_NAME = "";
switch (process.env.NODE_ENV) {
  // case "production":
  //   ENV_FILE_NAME = ".env.production";
  //   break;
  // case "staging":
  //   ENV_FILE_NAME = ".env.staging";
  //   break;
  // case "test":
  //   ENV_FILE_NAME = ".env.test";
  //   break;
  case "development":
  default:
    ENV_FILE_NAME = ".env";
    break;
}

try {
  dotenv.config({ path: process.cwd() + "/" + ENV_FILE_NAME });
} catch (e) { }

// CORS when consuming Medusa from admin
const ADMIN_CORS =
  process.env.ADMIN_CORS || "http://localhost:7000,http://localhost:7001";

// CORS to avoid issues when consuming Medusa from a client
const STORE_CORS = process.env.STORE_CORS || "http://localhost:8000";

const DATABASE_TYPE = process.env.DATABASE_TYPE || "sqlite";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://localhost/medusa-store";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const plugins = [];

const modules = {}

/** @type {import('@medusajs/medusa').ConfigModule["projectConfig"]} */
const projectConfig = {
  port: process.env.PORT ? Number(process.env.PORT) : 9000,
  jwt_secret: process.env.JWT_SECRET,
  cookie_secret: process.env.COOKIE_SECRET,
  database_type: DATABASE_TYPE,
  database_url: DATABASE_URL,
  store_cors: STORE_CORS,
  admin_cors: ADMIN_CORS,
  redis_url: REDIS_URL,
  stripe: {
    api_key: process.env.STRIPE_API_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
    app_url: process.env.APP_URL || "http://localhost:9000",
    capture: true,
  },
  app_url: process.env.APP_URL || "http://localhost:9000",
}

if (process.env.NODE_ENV === 'development') {
  modules.eventBus = {
    resolve: "@medusajs/event-bus-local",
  }
  plugins.push("medusa-fulfillment-manual")
  plugins.push({
    resolve: "@medusajs/admin",
    /** @type {import('@medusajs/admin').PluginOptions} */
    options: {
      autoRebuild: true,
      develop: {
        open: process.env.OPEN_BROWSER !== "false",
      },
    },
  });
}

/** @type {import('@medusajs/medusa').ConfigModule} */
module.exports = {
  projectConfig,
  plugins,
  modules,
};
