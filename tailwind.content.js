  const path = require("path")

  const devPath = path.join(__dirname, "..", "..", "src/admin/**/*.{js,jsx,ts,tsx}")

  module.exports = {
    content: [
      devPath,
      
    ],
  }
